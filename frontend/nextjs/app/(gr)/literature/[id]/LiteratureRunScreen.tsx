'use client';

import { useEffect, useState } from 'react';
import { cancelRun, getRun, PaperSeekApiError } from '@/lib/paperseek/client';
import { openRunEvents, reducePaperSeekEvents } from '@/lib/paperseek/events';
import type { PaperSeekEvent, PaperSeekRun } from '@/lib/paperseek/types';
import LiteratureResults from '../../_components/LiteratureResults';
import { Eye } from '../../_components/ui';

const terminal = (status: string) => ['completed', 'completed_with_warnings', 'failed', 'cancelled'].includes(status);
const message = (error: unknown) => error instanceof PaperSeekApiError ? `${error.message} (${error.code})` : '无法连接 PaperSeek，请稍后重试。';

export default function LiteratureRunScreen({ id }: { id: string }) {
  const [run, setRun] = useState<PaperSeekRun | null>(null);
  const [events, setEvents] = useState<PaperSeekEvent[]>([]);
  const [problem, setProblem] = useState('');
  const [cancelling, setCancelling] = useState(false);
  useEffect(() => {
    let active = true;
    setRun(null); setEvents([]); setProblem('');
    void getRun(id).then((value) => { if (active) setRun(value); }).catch((error) => { if (active) setProblem(message(error)); });
    return () => { active = false; };
  }, [id]);
  useEffect(() => {
    if (!run || terminal(run.status)) return;
    let active = true;
    const close = openRunEvents(id, { onEvent: (event) => {
      if (!active) return;
      setEvents((previous) => previous.some((item) => item.sequence === event.sequence) ? previous : [...previous, event]);
      if (['run.completed', 'run.completed_with_warnings', 'run.failed', 'run.cancelled'].includes(event.event_type)) {
        void getRun(id).then((value) => { if (active) setRun(value); }).catch((error) => { if (active) setProblem(message(error)); });
      }
    } });
    return () => { active = false; close(); };
  }, [id, run]);
  const progress = reducePaperSeekEvents(events);
  async function cancel() {
    setCancelling(true); setProblem('');
    try { setRun(await cancelRun(id)); } catch (error) { setProblem(message(error)); } finally { setCancelling(false); }
  }
  return <main className="mx-auto w-full max-w-[1000px] px-5 pb-16 pt-12 sm:px-8">
    <Eye>PaperSeek · 文献检索</Eye>
    {problem && <p role="alert" className="mt-4 text-rubric">{problem}</p>}
    {!run && !problem && <p className="mt-5">正在加载检索任务…</p>}
    {run && <>
      <h1 className="mt-5 font-display text-3xl font-semibold">{run.display_title || run.question}</h1>
      <p className="mt-3 text-sm text-ink-3">{run.source} · 状态：{run.status} · 阶段：{progress.stage || run.current_step || '—'} · 结果：{run.result_count}</p>
      {[...new Set([...(run.warnings ?? []), ...progress.warnings])].map((warning) => <p key={warning} className="mt-2 text-sm text-rubric">警告：{warning}</p>)}
      {(run.error_code || progress.errorCode) && <p role="alert" className="mt-2 text-rubric">错误代码：{run.error_code || progress.errorCode}</p>}
      {!terminal(run.status) && <button className="gr-btn mt-5" type="button" onClick={() => void cancel()} disabled={cancelling || run.status === 'cancelling'}>{cancelling || run.status === 'cancelling' ? '正在取消' : '取消此检索'}</button>}
      {progress.events.length > 0 && <details className="mt-5 text-sm"><summary className="cursor-pointer">检索进度（{progress.events.length}）</summary><ol className="mt-2 space-y-1">{progress.events.map((event) => <li key={event.sequence}>{event.sequence}. {event.stage} · {event.event_type} {Object.entries(event.payload ?? {}).filter(([key, value]) => /count|completed_batches|batch_count/.test(key) && typeof value === 'number').map(([key, value]) => `${key}: ${value}`).join(' · ')}</li>)}</ol></details>}
      {['completed', 'completed_with_warnings'].includes(run.status) && <LiteratureResults id={id} />}
    </>}
  </main>;
}
