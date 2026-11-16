import { describe, expect, it, vi } from 'vitest';
import { openRunEvents, reducePaperSeekEvents } from './events';
import type { PaperSeekEvent } from './types';

const event = (sequence: number, event_type: string, stage: string, payload: Record<string, unknown> = {}): PaperSeekEvent => ({ run_id: 'run', sequence, event_type, stage, payload, occurred_at: '', schema_version: 1 });

describe('PaperSeek progress', () => {
  it('orders and deduplicates replay while retaining warnings and terminal failure', () => {
    const warning = event(2, 'retrieval.degraded', 'retrieval', { code: 'SOURCE_DOWN' });
    const progress = reducePaperSeekEvents([event(3, 'run.failed', 'lifecycle', { code: 'TIMEOUT' }), warning, event(1, 'query.started', 'query'), warning]);
    expect(progress.events.map((item) => item.sequence)).toEqual([1, 2, 3]);
    expect(progress.stage).toBe('lifecycle');
    expect(progress.warnings).toContain('SOURCE_DOWN');
    expect(progress.status).toBe('failed');
    expect(progress.errorCode).toBe('TIMEOUT');
  });
});

it('recognizes completion with warnings as terminal', () => {
  expect(reducePaperSeekEvents([event(4, 'run.completed_with_warnings', 'lifecycle', { warning_count: 1 })]).status).toBe('completed_with_warnings');
});

it('subscribes to PaperSeek query selection and closes the stream', async () => {
  const listeners = new Map<string, (event: Event) => void>();
  const close = vi.fn();
  const source = { addEventListener: (type: string, listener: (event: Event) => void) => listeners.set(type, listener), close, onmessage: null, onerror: null };
  const create = vi.fn(function () { return source; });
  vi.stubGlobal('EventSource', create);
  const received = vi.fn();
  const cleanup = openRunEvents('a/b', { onEvent: received });
  expect(create).toHaveBeenCalledWith('/api/paperseek/runs/a%2Fb/events');
  listeners.get('query.selected')?.(new MessageEvent('query.selected', { data: JSON.stringify(event(5, 'query.selected', 'query')) }));
  expect(received).toHaveBeenCalledWith(expect.objectContaining({ sequence: 5 }));
  cleanup(); expect(close).toHaveBeenCalledOnce(); vi.unstubAllGlobals();
});
