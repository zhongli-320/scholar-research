// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import LiteratureRunScreen from './LiteratureRunScreen';
import { getRun } from '@/lib/paperseek/client';
import { openRunEvents } from '@/lib/paperseek/events';
vi.mock('@/lib/paperseek/client', () => ({
  getRun: vi.fn(), cancelRun: vi.fn(), exportRun: vi.fn().mockReturnValue('/export'), exportSelected: vi.fn(), getResults: vi.fn().mockResolvedValue({ results: [], total_count: 0 }),
  getCitationMap: vi.fn().mockResolvedValue({ nodes: [], edges: [] }), listArtifacts: vi.fn().mockResolvedValue([]),
  PaperSeekApiError: class extends Error {},
}));
vi.mock('@/lib/paperseek/events', async (importOriginal) => ({ ...await importOriginal(), openRunEvents: vi.fn().mockReturnValue(() => {}) }));
vi.stubGlobal('React', React);
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
afterEach(() => vi.clearAllMocks());
it('loads the existing run before subscribing and refreshes when it completes with warnings', async () => {
  let resolve!: (run: never) => void;
  vi.mocked(getRun).mockReturnValueOnce(new Promise((done) => { resolve = done; })).mockResolvedValueOnce({ id: 'a', question: 'q', display_title: '', source: 'openalex', status: 'completed_with_warnings', result_count: 3 });
  const container = document.createElement('div'); const root = createRoot(container);
  await act(async () => { root.render(<LiteratureRunScreen id="a" />); });
  expect(getRun).toHaveBeenCalledWith('a'); expect(openRunEvents).not.toHaveBeenCalled();
  await act(async () => { resolve({ id: 'a', question: 'q', display_title: '', source: 'openalex', status: 'running', result_count: 0 } as never); });
  const handlers = vi.mocked(openRunEvents).mock.calls[0][1];
  await act(async () => { handlers.onEvent({ run_id: 'a', sequence: 3, event_type: 'run.completed_with_warnings', stage: 'lifecycle', occurred_at: '', schema_version: 1, payload: {} }); });
  expect(getRun).toHaveBeenCalledTimes(2);
  expect(container.textContent).toContain('completed_with_warnings');
  await act(async () => root.unmount());
});

it('applies terminal failure before a failed refresh and offers same-run recovery', async () => {
  vi.mocked(getRun).mockResolvedValueOnce({ id: 'a', question: 'q', display_title: '', source: 'openalex', status: 'running', result_count: 0 }).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ id: 'a', question: 'q', display_title: '', source: 'openalex', status: 'failed', error_code: 'TIMEOUT', result_count: 0 });
  const container = document.createElement('div'); const root = createRoot(container);
  await act(async () => { root.render(<LiteratureRunScreen id="a" />); });
  const handlers = vi.mocked(openRunEvents).mock.calls[0][1];
  await act(async () => { handlers.onEvent({ run_id: 'a', sequence: 9, event_type: 'run.failed', stage: 'lifecycle', occurred_at: '', schema_version: 1, payload: { code: 'TIMEOUT' } }); });
  expect(container.textContent).toContain('failed'); expect(container.textContent).toContain('TIMEOUT');
  expect(container.textContent).not.toContain('取消此检索');
  const retry = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('重试'))!;
  await act(async () => retry.click());
  expect(vi.mocked(getRun).mock.calls.map(([id]) => id)).toEqual(['a', 'a', 'a']);
  await act(async () => root.unmount());
});

it('offers recovery when the event stream fails', async () => {
  vi.mocked(getRun).mockResolvedValue({ id: 'a', question: 'q', display_title: '', source: 'openalex', status: 'running', result_count: 0 });
  const container = document.createElement('div'); const root = createRoot(container);
  await act(async () => { root.render(<LiteratureRunScreen id="a" />); });
  await act(async () => vi.mocked(openRunEvents).mock.calls[0][1].onError?.());
  expect(container.textContent).toContain('重试');
  await act(async () => root.unmount());
});
it('shows terminal state while its state refresh is still pending', async () => {
  vi.mocked(getRun).mockResolvedValueOnce({ id: 'a', question: 'q', display_title: '', source: 'openalex', status: 'running', result_count: 0 }).mockReturnValueOnce(new Promise(() => {}));
  const container = document.createElement('div'); const root = createRoot(container);
  await act(async () => { root.render(<LiteratureRunScreen id="a" />); });
  await act(async () => { vi.mocked(openRunEvents).mock.calls[0][1].onEvent({ run_id: 'a', sequence: 9, event_type: 'run.failed', stage: 'lifecycle', occurred_at: '', schema_version: 1, payload: { code: 'TIMEOUT' } }); });
  expect(container.textContent).toContain('状态：failed');
  expect(container.textContent).not.toContain('取消此检索');
  await act(async () => root.unmount());
});
