import { v4 as uuid } from 'uuid';
import { getHost } from '@/helpers/getHost';
import { startPayload, type BriefValue } from './brief';
import { parseEvent, type ResearchEvent } from './events';
import { getReport, reportsStore, saveReport, storedEvents, updateReport, type StoredChatMessage, type StoredReport } from './reports';
import { reduceRun } from './run';

/** A research running over `/ws` in this tab. Snapshots are replaced, never mutated, so React can subscribe. */
export interface LiveRun {
  id: string;
  question: string;
  brief: BriefValue;
  events: ResearchEvent[];
  /** `performance.now()` when the run started. */
  startedAt: number;
  stoppedAt?: number;
  /** The socket is closed: finished, stopped, failed or dropped. */
  ended: boolean;
  /** Resolves once the finished report is in the backend's store. */
  saved?: Promise<boolean>;
  chat: StoredChatMessage[];
}

const runs = new Map<string, LiveRun>();
const sockets = new Map<string, WebSocket>();
const listeners = new Map<string, Set<() => void>>();
const pending = new Map<string, number>();
const finishing = new Set<string>();

const PENDING_KEY = (id: string) => `gptr-run-${id}`;
const NOTIFY_MS = 80;
const RECOVERY_POLL_MS = 5_000;
const RECOVERY_ATTEMPTS = 360;

const notify = (id: string) => {
  if (pending.has(id)) return;
  pending.set(
    id,
    window.setTimeout(() => {
      pending.delete(id);
      listeners.get(id)?.forEach((l) => l());
    }, NOTIFY_MS),
  );
};

const update = (id: string, patch: Partial<LiveRun>) => {
  const run = runs.get(id);
  if (!run) return;
  runs.set(id, { ...run, ...patch });
  notify(id);
};

const secondsIn = (run: LiveRun) => (performance.now() - run.startedAt) / 1000;

const push = (id: string, event: ResearchEvent) => {
  const run = runs.get(id);
  if (run) update(id, { events: [...run.events, event] });
};

const wsUrl = () => `${getHost().replace(/\/+$/, '').replace(/^http/, 'ws')}/ws`;

/** Keeps the question and brief for this tab, so a reload mid run can offer to start it again. */
export function rememberedRun(id: string): { question: string; brief: BriefValue; startedAt?: number } | null {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING_KEY(id)) ?? 'null');
  } catch {
    return null;
  }
}

const fetchText = async (path: string) => {
  try {
    const res = await fetch(`/${path}`);
    return res.ok ? await res.text() : '';
  } catch {
    return '';
  }
};

/** Save the best report currently available. Some backends emit the completed
 * report without a following file-path event, so history must not depend on
 * generated downloads being present. */
function persist(id: string) {
  const run = runs.get(id);
  if (!run) return Promise.resolve(false);
  const state = reduceRun(run.question, run.events);
  if (!state.report.trim()) return Promise.resolve(false);
  const report: StoredReport = {
    id,
    question: run.question,
    answer: state.report,
    orderedData: run.events,
    chatMessages: run.chat,
    timestamp: Date.now(),
    brief: { report_type: run.brief.report_type, report_source: run.brief.report_source, tone: run.brief.tone, domains: run.brief.domains },
  };
  return saveReport(report)
    .then(() => {
      sessionStorage.removeItem(PENDING_KEY(id));
      reportsStore.upsert(report);
      return true;
    })
    .catch(() => false);
}

/** Multi agent runs may end without the report in the stream; the Markdown file the backend wrote has it. */
async function finish(id: string, path: ResearchEvent & { type: 'path' }) {
  const before = runs.get(id);
  if (!before) return;
  finishing.add(id);
  /** A detailed report's table of contents and references exist only in the assembled file. */
  const assembled = before.brief.report_type === 'detailed_report';
  if ((assembled || !reduceRun(before.question, before.events).report.trim()) && path.output.md) {
    const text = await fetchText(path.output.md);
    if (text.trim()) push(id, { type: 'report_complete', output: text, t: path.t });
  }
  push(id, path);
  const saved = persist(id);
  update(id, { ended: true, saved });
  finishing.delete(id);
  sockets.get(id)?.close(1000, 'Research finished');
}

function connect(id: string) {
  const run = runs.get(id)!;
  let opened = false;
  let heartbeat: number | undefined;
  const socket = new WebSocket(wsUrl());
  sockets.set(id, socket);

  socket.onopen = () => {
    opened = true;
    socket.send(`start ${JSON.stringify(startPayload(run.question, run.brief, id))}`);
    heartbeat = window.setInterval(() => socket.readyState === WebSocket.OPEN && socket.send('ping'), 30_000);
  };

  socket.onmessage = (message) => {
    if (message.data === 'pong') return;
    let data: unknown;
    try {
      data = JSON.parse(String(message.data));
    } catch {
      return;
    }
    const current = runs.get(id);
    const event = current && parseEvent(data, secondsIn(current));
    if (!event) return;
    if (event.type === 'path') return void finish(id, event);
    push(id, event);
    if (event.type === 'report_complete') update(id, { saved: persist(id) });
    if (event.type === 'error' || (event.type === 'logs' && event.content === 'error')) socket.close(1000, 'Research failed');
  };

  socket.onclose = () => {
    window.clearInterval(heartbeat);
    sockets.delete(id);
    const current = runs.get(id);
    if (!current || current.ended || finishing.has(id)) return;
    const failed = current.events.some((e) => e.type === 'error' || (e.type === 'logs' && e.content === 'error'));
    if (current.stoppedAt !== undefined || failed) {
      update(id, { ended: true });
      return;
    }
    if (!opened) {
      push(id, {
        type: 'error',
        output: `无法连接位于 ${getHost()} 的后端。请运行 python main.py 启动后端，然后重试。`,
        t: secondsIn(current),
      });
      update(id, { ended: true });
      return;
    }
    push(id, {
      type: 'logs',
      content: 'connection_recovering',
      output: '连接已中断，后台仍在继续；完成后将自动恢复结果。',
      t: secondsIn(current),
    });
    void recoverCompletedReport(id);
  };
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

async function recoverCompletedReport(id: string) {
  for (let attempt = 0; attempt < RECOVERY_ATTEMPTS; attempt += 1) {
    await wait(RECOVERY_POLL_MS);
    const current = runs.get(id);
    if (!current || current.ended || current.stoppedAt !== undefined) return;
    try {
      const report = await getReport(id);
      if (!report) continue;
      sessionStorage.removeItem(PENDING_KEY(id));
      reportsStore.upsert(report);
      update(id, {
        events: storedEvents(report.orderedData),
        chat: report.chatMessages ?? current.chat,
        ended: true,
        saved: Promise.resolve(true),
      });
      return;
    } catch {
      // A transient API failure should not discard a backend job.
    }
  }
  const current = runs.get(id);
  if (!current || current.ended) return;
  push(id, {
    type: 'error',
    output: '后台任务长时间未返回结果，请稍后到综述历史查看。',
    t: secondsIn(current),
  });
  update(id, { ended: true });
}

export function startResearch(question: string, brief: BriefValue): string {
  const id = uuid();
  runs.set(id, { id, question, brief, events: [], startedAt: performance.now(), ended: false, chat: [] });
  try {
    sessionStorage.setItem(PENDING_KEY(id), JSON.stringify({ question, brief, startedAt: Date.now() }));
  } catch {
    // Private mode can refuse storage; the run itself doesn't need it.
  }
  connect(id);
  return id;
}

/** Closing the socket is what stops the backend: it cancels the running task on disconnect. */
export function stopResearch(id: string) {
  const run = runs.get(id);
  if (!run || run.ended) return;
  update(id, { stoppedAt: secondsIn(run), ended: true });
  sockets.get(id)?.close(1000, 'Stopped by the user');
}

/** The multi agent editor reads `{type: 'human_feedback', content}` straight off the socket; `no` keeps its plan. */
export function sendFeedback(id: string, notes: string | null) {
  const run = runs.get(id);
  const socket = sockets.get(id);
  if (!run || socket?.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: 'human_feedback', content: notes ?? 'no' }));
  push(id, {
    type: 'logs',
    content: 'human_feedback_sent',
    output: notes ? `已将你的意见发送给编辑：${notes}` : '按此大纲开始研究',
    t: secondsIn(run),
  });
}

const chatSaves = new Map<string, Promise<boolean>>();

/** Saves queue per report: two PUTs in flight can land out of order and drop the newer chat. */
export function saveChat(id: string, chat: StoredChatMessage[]) {
  const run = runs.get(id);
  if (run) runs.set(id, { ...run, chat });
  const reportSaved = run ? (run.saved ?? Promise.resolve(false)) : Promise.resolve(true);
  const next = (chatSaves.get(id) ?? Promise.resolve(true))
    .then(() => reportSaved)
    .then((ok) => (ok ? updateReport(id, { chatMessages: chat }).then(() => true) : false))
    .catch(() => false);
  chatSaves.set(id, next);
  return next;
}

export const liveRuns = {
  get: (id: string) => runs.get(id),
  secondsIn,
  subscribe(id: string, listener: () => void) {
    if (!listeners.has(id)) listeners.set(id, new Set());
    listeners.get(id)!.add(listener);
    return () => {
      listeners.get(id)?.delete(listener);
    };
  },
};
