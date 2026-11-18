'use client';

import { useEffect, useRef, useState } from 'react';
import { cancelRun, getRun, PaperSeekApiError } from '@/lib/paperseek/client';
import { openRunEvents, reducePaperSeekEvents } from '@/lib/paperseek/events';
import { runEventCountLabel, runEventLabel, runStageLabel, runStatusLabel } from '@/lib/paperseek/status';
import type { PaperSeekEvent, PaperSeekRun } from '@/lib/paperseek/types';
import LiteratureResults from '../../_components/LiteratureResults';
import { Eye } from '../../_components/ui';

const terminal = (status: string) => ['completed', 'completed_with_warnings', 'failed', 'cancelled'].includes(status);
const message = (error: unknown) => error instanceof PaperSeekApiError ? `${error.message} (${error.code})` : '无法连接 PaperSeek，请稍后重试。';

const numberFrom = (events: PaperSeekEvent[], ...keys: string[]) => {
  for (const event of [...events].reverse()) {
    for (const key of keys) {
      const value = event.payload?.[key];
      if (typeof value === 'number') return value;
    }
  }
  return 0;
};

const stringFrom = (events: PaperSeekEvent[], ...keys: string[]) => {
  for (const event of [...events].reverse()) {
    for (const key of keys) {
      const value = event.payload?.[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
  }
  return '';
};

function Metric({ value, label }: { value: number | string; label: string }) {
  return <p className="bg-paper-deep/70 px-3 py-2.5">
    <span className="block font-code text-xl font-medium tabular-nums text-ink">{typeof value === 'number' ? value.toLocaleString('zh-CN') : value}</span>
    <span className="mt-1 block text-xs text-ink-3">{label}</span>
  </p>;
}

function ProcessPanel({ title, description, summary, metrics, children, active = false }: {
  title: string;
  description: string;
  summary: string;
  metrics: Array<[string, number | string]>;
  children?: React.ReactNode;
  active?: boolean;
}) {
  const [expanded, setExpanded] = useState(active);
  useEffect(() => { if (active) setExpanded(true); }, [active]);
  return <details className={`border bg-paper px-4 py-4 ${active ? 'border-rubric' : 'border-rule'}`} open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
    <summary className="cursor-pointer select-none">
      <span className="ml-1 inline-flex w-[calc(100%-1rem)] flex-wrap items-baseline justify-between gap-2 align-middle">
        <span className="font-display text-lg font-semibold">{title}</span>
        <span className="text-sm font-normal text-ink-3">{summary}</span>
      </span>
    </summary>
    <div className="mt-3 border-t border-rule-soft pt-3">
      <p className="text-sm leading-relaxed text-ink-2">{description}</p>
      <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden bg-rule-soft sm:grid-cols-4">
        {metrics.map(([label, value]) => <Metric key={label} label={label} value={value} />)}
      </div>
      {children}
    </div>
  </details>;
}

const payloadText = (payload: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
};

const payloadNumber = (payload: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'number') return value;
  }
  return 0;
};

function SearchProcess({ run, events, currentStage }: { run: PaperSeekRun; events: PaperSeekEvent[]; currentStage: string }) {
  const planned = events.filter((event) => event.event_type === 'query.planned');
  const queryEvents = events.filter((event) => event.event_type.startsWith('query.'));
  const recallEvents = events.filter((event) => /^(retriev|candidate|selection|select|rank|rerank)/.test(event.event_type));
  const retrievalEvents = events.filter((event) => /^(retriev|candidate)/.test(event.event_type));
  const rankingEvents = events.filter((event) => /^(selection|select|rank|rerank)/.test(event.event_type));
  const portfolioEvents = events.filter((event) => event.event_type === 'query.portfolio_recorded');
  const query = stringFrom(planned, 'current_query', 'query');
  const intent = stringFrom(planned, 'intent');
  const decision = stringFrom(queryEvents, 'decision');
  const iterations = numberFrom(queryEvents, 'iteration');
  const totalHits = numberFrom(queryEvents, 'total');
  const returned = numberFrom(queryEvents, 'hit_count', 'retrieved_count');
  const views = numberFrom(planned, 'query_view_count');
  const candidates = numberFrom(retrievalEvents, 'candidate_count', 'total_candidates', 'fused_count', 'loaded_candidates');
  const ranked = numberFrom(rankingEvents, 'llm_gate_candidate_count', 'ranked_count', 'selected_count', 'sent_to_llm', 'scored_count', 'candidate_count');
  const finalCount = run.result_count || numberFrom(events, 'result_count', 'final_count');
  const statusText = runStatusLabel(run.status);
  const queryPaths = planned.flatMap((event) => Array.isArray(event.payload?.query_views)
    ? event.payload.query_views.filter((view): view is Record<string, unknown> => Boolean(view) && typeof view === 'object')
    : []);
  const iterationMap = new Map<number, Record<string, unknown>>();
  for (const event of queryEvents) {
    const iteration = event.payload?.iteration;
    if (typeof iteration !== 'number') continue;
    iterationMap.set(iteration, { ...(iterationMap.get(iteration) ?? {}), ...event.payload });
  }
  const iterationRows = [...iterationMap.entries()].sort(([left], [right]) => left - right);

  return <div className="mt-7 space-y-3" aria-label="检索过程">
    <ProcessPanel
      title="检索意图与检索式"
      description="识别研究问题的主题、范围和检索路径，并生成适配当前数据源的检索式。"
      summary={planned.length ? `已形成 ${views || 1} 条检索路径` : '正在分析研究问题'}
      metrics={[["检索路径", views], ["规划事件", planned.length]]}
      active={currentStage === 'query' && !planned.length}
    >
      {intent && <p className="mt-3 text-sm"><span className="text-ink-3">识别意图：</span>{intent}</p>}
      {queryPaths.length > 0 ? <div className="mt-3 space-y-2">
        {queryPaths.map((path, index) => {
          const viewId = payloadText(path, 'view_id');
          const recorded = portfolioEvents.find((event) => event.payload?.view_id === viewId)?.payload ?? {};
          const groups = Array.isArray(path.concept_groups) ? path.concept_groups.filter((group): group is Record<string, unknown> => Boolean(group) && typeof group === 'object') : [];
          const pathQuery = payloadText(recorded, 'query') || query;
          return <details key={viewId || index} className="border border-rule-soft bg-paper-hi px-3 py-2 text-sm">
            <summary className="cursor-pointer select-none font-medium">路径 {index + 1}：{payloadText(path, 'purpose') || payloadText(path, 'view_type') || '主题检索'}</summary>
            {pathQuery && <pre className="mt-2 overflow-x-auto bg-paper-deep px-3 py-2 font-code text-xs leading-relaxed whitespace-pre-wrap">{pathQuery}</pre>}
            {groups.map((group, groupIndex) => <p key={groupIndex} className="mt-2 text-xs text-ink-2">
              {payloadText(group, 'label', 'field_hint') || `概念组 ${groupIndex + 1}`}：{Array.isArray(group.terms) ? group.terms.join('、') : '—'}
            </p>)}
            {Object.keys(recorded).length > 0 && <p className="mt-2 text-xs text-ink-3">命中 {payloadNumber(recorded, 'hit_count', 'total').toLocaleString('zh-CN')} · 新增候选 {payloadNumber(recorded, 'added_unique').toLocaleString('zh-CN')}</p>}
          </details>;
        })}
      </div> : query && <pre className="mt-3 overflow-x-auto bg-paper-deep px-4 py-3 font-code text-xs leading-relaxed whitespace-pre-wrap">{query}</pre>}
    </ProcessPanel>

    <ProcessPanel
      title="检索迭代"
      description="根据命中规模逐轮调整检索范围。数据源总命中表示数据库中符合条件的总量，本轮取回表示当前轮实际载入的候选量。"
      summary={queryEvents.length ? `${iterations || 1} 轮 · ${decision === 'narrow' ? '正在缩小范围' : decision === 'broaden' ? '正在扩大范围' : '正在评估检索式'}` : '等待检索'}
      metrics={[["检索轮次", iterations], ["数据源总命中", totalHits], ["本轮取回", returned], ["迭代事件", queryEvents.length]]}
      active={currentStage === 'query' && planned.length > 0}
    >
      {iterationRows.length > 0 && <div className="mt-3 space-y-2">
        {iterationRows.map(([iteration, row]) => <details key={iteration} className="border border-rule-soft bg-paper-hi px-3 py-2 text-sm">
          <summary className="cursor-pointer select-none font-medium">第 {iteration} 轮 · 命中 {payloadNumber(row, 'hit_count', 'total').toLocaleString('zh-CN')} · {payloadText(row, 'decision') === 'narrow' ? '缩小范围' : payloadText(row, 'decision') === 'broaden' ? '扩大范围' : '保留或评估'}</summary>
          {payloadText(row, 'query') && <pre className="mt-2 overflow-x-auto bg-paper-deep px-3 py-2 font-code text-xs leading-relaxed whitespace-pre-wrap">{payloadText(row, 'query')}</pre>}
          <p className="mt-2 text-xs text-ink-3">数据源总命中 {payloadNumber(row, 'total').toLocaleString('zh-CN')} · 本轮取回 {payloadNumber(row, 'hit_count', 'retrieved_count').toLocaleString('zh-CN')}{payloadText(row, 'reason', 'message') ? ` · ${payloadText(row, 'reason', 'message')}` : ''}</p>
        </details>)}
      </div>}
    </ProcessPanel>

    <ProcessPanel
      title="候选召回与排序"
      description="汇总不同检索路径的候选文献，去重并筛选，再结合相关性评分确定最终展示顺序。"
      summary={recallEvents.length ? `已记录 ${recallEvents.length} 个召回与排序节点` : '等待候选文献'}
      metrics={[["候选文献", candidates], ["进入排序", ranked], ["处理节点", recallEvents.length]]}
      active={['retrieval', 'selection', 'ranking'].some((stage) => currentStage.includes(stage))}
    >
      <p className="mt-3 text-xs leading-relaxed text-ink-3">相关性评分：候选池先综合多路检索名次、主题相似度、BM25 与检索词覆盖率进行预排；进入排序的文献再依据稳定检索计划，以及题名、摘要、关键词等证据按 0–10 分独立评分。引用数不直接计入主题相关性。</p>
    </ProcessPanel>

    <ProcessPanel
      title="文献结果"
      description="保存最终文献列表及后续文献计量所需的数据。最终结果是本次检索完成后可查看和分析的文献数量。"
      summary={terminal(run.status) ? statusText : '等待检索完成'}
      metrics={[["最终结果", finalCount], ["警告", run.warnings?.length ?? 0]]}
      active={!terminal(run.status) && ['assemble', 'result'].some((stage) => currentStage.includes(stage))}
    />

    {events.length > 0 && <details className="border-t border-rule pt-3 text-sm">
      <summary className="cursor-pointer select-none font-code text-xs uppercase tracking-[0.08em] text-ink-2">查看详细记录（{events.length}）</summary>
      <ol className="mt-3 max-h-80 space-y-2 overflow-auto pr-2 text-ink-2">
        {events.map((event) => <li key={event.sequence} className="grid grid-cols-[32px_minmax(0,1fr)] gap-2">
          <span className="font-code tabular-nums text-ink-3">{event.sequence}</span>
          <span>{runEventLabel(event.event_type)} {Object.entries(event.payload ?? {}).filter(([key, value]) => /count|completed_batches|batch_count/.test(key) && typeof value === 'number').map(([key, value]) => `${runEventCountLabel(key)}：${value}`).join(' · ')}</span>
        </li>)}
      </ol>
    </details>}
  </div>;
}

export default function LiteratureRunScreen({ id }: { id: string }) {
  return <RunDetails key={id} id={id} />;
}

function RunDetails({ id }: { id: string }) {
  const [run, setRun] = useState<PaperSeekRun | null>(null);
  const [events, setEvents] = useState<PaperSeekEvent[]>([]);
  const [problem, setProblem] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const activeRequest = useRef<{ action: 'retry' | 'cancel' } | null>(null);
  useEffect(() => {
    let active = true;
    void getRun(id).then((value) => { if (active) setRun(value); }).catch((error) => { if (active) setProblem(message(error)); });
    return () => { active = false; activeRequest.current = null; };
  }, [id]);
  useEffect(() => {
    if (!run) return;
    let active = true;
    const close = openRunEvents(id, { onEvent: (event) => {
      if (!active) return;
      setEvents((previous) => previous.some((item) => item.sequence === event.sequence) ? previous : [...previous, event]);
      if (['run.completed', 'run.completed_with_warnings', 'run.failed', 'run.cancelled'].includes(event.event_type)) {
        close();
        void getRun(id).then((value) => { if (active) setRun(value); }).catch((error) => { if (active) setProblem(message(error)); });
      }
    }, onError: () => { if (active && !terminal(run.status)) setProblem('进度连接中断，请重试恢复此检索。'); } });
    return () => { active = false; close(); };
  }, [id, run?.status]);
  const progress = reducePaperSeekEvents(events);
  const status = run && terminal(run.status) ? run.status : progress.status || run?.status || '';
  async function updateRun(action: 'retry' | 'cancel') {
    if (activeRequest.current?.action === 'cancel') return;
    const request = { action };
    activeRequest.current = request;
    if (action === 'cancel') setCancelling(true);
    setProblem('');
    try {
      const value = await (action === 'cancel' ? cancelRun(id) : getRun(id));
      if (activeRequest.current === request) setRun(value);
    } catch (error) {
      if (activeRequest.current === request) setProblem(message(error));
    } finally {
      if (activeRequest.current === request) {
        activeRequest.current = null;
        if (action === 'cancel') setCancelling(false);
      }
    }
  }
  return <main className="mx-auto w-full max-w-[1100px] px-5 pb-16 pt-12 sm:px-8">
    <Eye>PaperSeek · 文献检索</Eye>
    {problem && <div role="alert" className="mt-4 text-rubric">{problem} <button type="button" className="underline disabled:opacity-50" disabled={cancelling} onClick={() => void updateRun('retry')}>重试恢复</button></div>}
    {!run && !problem && <p className="mt-5">正在加载检索任务…</p>}
    {run && <>
      <h1 className="mt-5 font-display text-3xl font-semibold">{run.display_title || run.question}</h1>
      <p className="mt-3 text-sm text-ink-3">{run.source} · 状态：{runStatusLabel(status)} · 阶段：{runStageLabel(progress.stage || run.current_step || '—')} · 结果：{run.result_count}</p>
      {['failed', 'cancelled'].includes(status) && [...new Set([...(run.warnings ?? []), ...progress.warnings])].map((warning) => <p key={warning} className="mt-2 text-sm text-rubric">警告：{warning}</p>)}
      {(run.error_code || progress.errorCode) && <p role="alert" className="mt-2 text-rubric">错误代码：{run.error_code || progress.errorCode}</p>}
      {!terminal(status) && <button className="gr-btn mt-5" type="button" onClick={() => void updateRun('cancel')} disabled={cancelling || status === 'cancelling'}>{cancelling || status === 'cancelling' ? '正在取消' : '取消此检索'}</button>}
      <SearchProcess run={run} events={progress.events} currentStage={progress.stage || run.current_step || ''} />
      {['completed', 'completed_with_warnings'].includes(run.status) && <LiteratureResults id={id} />}
    </>}
  </main>;
}
