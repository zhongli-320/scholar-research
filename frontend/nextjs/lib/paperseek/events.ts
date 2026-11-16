import type { PaperSeekEvent } from './types';

export function reducePaperSeekEvents(input: PaperSeekEvent[]) {
  const events = [...new Map(input.map((event) => [event.sequence, event])).values()].sort((a, b) => a.sequence - b.sequence);
  const warnings: string[] = [];
  let status = '';
  let errorCode = '';
  for (const event of events) {
    const code = typeof event.payload?.code === 'string' ? event.payload.code : '';
    if ((event.event_type.includes('degraded') || event.event_type.includes('warning')) && code) warnings.push(code);
    if (event.event_type === 'run.cancelling' && !status) status = 'cancelling';
    if (event.event_type === 'run.completed') status = 'completed';
    if (event.event_type === 'run.completed_with_warnings') status = 'completed_with_warnings';
    if (event.event_type === 'run.failed') { status = 'failed'; errorCode = code; }
    if (event.event_type === 'run.cancelled') status = 'cancelled';
  }
  return { events, stage: events.at(-1)?.stage ?? '', warnings, status, errorCode };
}

// shortcut: EventSource requires named listeners; update this list when PaperSeek adds research event types.
const eventTypes = [
  'run.created', 'run.claimed', 'run.cancelling', 'run.completed', 'run.completed_with_warnings', 'run.failed', 'run.cancelled',
  'workflow.started', 'workflow.completed', 'workflow.request_failed', 'workflow.recovery',
  'query.started', 'query.degraded', 'query.planned', 'query.request_started', 'query.progress', 'query.portfolio_request_started', 'query.portfolio_recorded', 'query.portfolio_degraded', 'query.refinement_stopped', 'query.resumed', 'query.selected', 'query.completed', 'query.failed',
  'retrieval.started', 'retrieval.embedding_completed', 'retrieval.lane_completed', 'retrieval.progress', 'retrieval.completed', 'retrieval.degraded', 'retrieval.failed',
  'selection.started', 'selection.embedding_completed', 'selection.completed', 'selection.degraded', 'selection.rerank_completed', 'selection.decision_started', 'selection.decision_progress', 'selection.decision_degraded', 'selection.decision_completed', 'selection.decision_failed',
  'ranking.started', 'ranking.batch_completed', 'ranking.batch_failed', 'ranking.reasons_progress', 'ranking.completed', 'ranking.degraded',
  'citation.started', 'citation.progress', 'citation.retrying', 'citation.skipped', 'citation.completed', 'citation.degraded', 'enrichment.completed', 'enrichment.failed',
];
export function openRunEvents(id: string, handlers: { onEvent: (event: PaperSeekEvent) => void; onError?: () => void }): () => void {
  const source = new EventSource(`/api/paperseek/runs/${encodeURIComponent(id)}/events`);
  const receive = (event: Event) => {
    try { handlers.onEvent(JSON.parse((event as MessageEvent).data) as PaperSeekEvent); } catch { /* Ignore malformed events. */ }
  };
  eventTypes.forEach((type) => source.addEventListener(type, receive));
  source.onmessage = receive;
  source.onerror = () => handlers.onError?.();
  return () => source.close();
}
