// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import LiteratureRunScreen from './LiteratureRunScreen';
import { cancelRun, getRun, getResults } from '@/lib/paperseek/client';
import { openRunEvents } from '@/lib/paperseek/events';
vi.mock('@/lib/paperseek/client', () => ({
  getRun: vi.fn(), cancelRun: vi.fn(), exportRun: vi.fn().mockReturnValue('/export'), exportSelected: vi.fn(), getResults: vi.fn().mockResolvedValue({ results: [], total_count: 0 }),
  PaperSeekApiError: class extends Error {},
}));
vi.mock('@/lib/paperseek/events', async (importOriginal) => ({ ...await importOriginal(), openRunEvents: vi.fn().mockReturnValue(() => {}) }));
vi.stubGlobal('React', React);
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
afterEach(() => vi.clearAllMocks());
it('loads the existing run before subscribing and hides non-fatal warnings after results complete', async () => {
  let resolve!: (run: never) => void;
  vi.mocked(getRun).mockReturnValueOnce(new Promise((done) => { resolve = done; })).mockResolvedValueOnce({ id: 'a', question: 'q', display_title: '', source: 'openalex', status: 'completed_with_warnings', result_count: 3, warnings: ['source_rate_limited'] });
  const container = document.createElement('div'); const root = createRoot(container);
  await act(async () => { root.render(<LiteratureRunScreen id="a" />); });
  expect(getRun).toHaveBeenCalledWith('a'); expect(openRunEvents).not.toHaveBeenCalled();
  await act(async () => { resolve({ id: 'a', question: 'q', display_title: '', source: 'openalex', status: 'running', result_count: 0 } as never); });
  const handlers = vi.mocked(openRunEvents).mock.calls[0][1];
  await act(async () => { handlers.onEvent({ run_id: 'a', sequence: 3, event_type: 'run.completed_with_warnings', stage: 'lifecycle', occurred_at: '', schema_version: 1, payload: {} }); });
  expect(getRun).toHaveBeenCalledTimes(2);
  expect(container.textContent).toContain('已完成');
  expect(container.textContent).not.toContain('completed_with_warnings');
  expect(container.textContent).not.toContain('source_rate_limited');
  await act(async () => root.unmount());
});

it('applies terminal failure before a failed refresh and offers same-run recovery', async () => {
  vi.mocked(getRun).mockResolvedValueOnce({ id: 'a', question: 'q', display_title: '', source: 'openalex', status: 'running', result_count: 0 }).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ id: 'a', question: 'q', display_title: '', source: 'openalex', status: 'failed', error_code: 'TIMEOUT', result_count: 0, warnings: ['provider_interrupted'] });
  const container = document.createElement('div'); const root = createRoot(container);
  await act(async () => { root.render(<LiteratureRunScreen id="a" />); });
  const handlers = vi.mocked(openRunEvents).mock.calls[0][1];
  await act(async () => { handlers.onEvent({ run_id: 'a', sequence: 9, event_type: 'run.failed', stage: 'lifecycle', occurred_at: '', schema_version: 1, payload: { code: 'TIMEOUT' } }); });
  expect(container.textContent).toContain('失败'); expect(container.textContent).toContain('TIMEOUT');
  expect(container.textContent).not.toContain('取消此检索');
  const retry = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('重试'))!;
  await act(async () => retry.click());
  expect(vi.mocked(getRun).mock.calls.map(([id]) => id)).toEqual(['a', 'a', 'a']);
  expect(container.textContent).toContain('provider_interrupted');
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
  expect(container.textContent).toContain('状态：失败');
  expect(container.textContent).not.toContain('取消此检索');
  await act(async () => root.unmount());
});
it('loads results only after recovering a completed run when state and results are offline', async () => {
  let online = false;
  const run = { id: 'a', question: 'q', display_title: '', source: 'openalex', result_count: 1 };
  vi.mocked(getRun).mockResolvedValueOnce({ ...run, status: 'running' }).mockImplementation(async () => {
    if (!online) throw new Error('offline');
    return { ...run, status: 'completed' };
  });
  vi.mocked(getResults).mockImplementation(async () => {
    if (!online) throw new Error('offline');
    return { results: [], next_cursor: null, total_count: 1, matched_count: 1, scored_count: 1, high_score_count: 0, max_score: 3 };
  });
  const container = document.createElement('div'); const root = createRoot(container);
  await act(async () => root.render(<LiteratureRunScreen id="a" />));
  await act(async () => vi.mocked(openRunEvents).mock.calls[0][1].onEvent({ run_id: 'a', sequence: 4, event_type: 'run.completed', stage: 'lifecycle', occurred_at: '', schema_version: 1, payload: {} }));
  expect(container.textContent).toContain('状态：已完成');
  expect(container.textContent).not.toContain('取消此检索');
  expect(getResults).not.toHaveBeenCalled();
  online = true;
  const retry = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('重试'))!;
  await act(async () => retry.click());
  expect(vi.mocked(getRun).mock.calls.map(([id]) => id)).toEqual(['a', 'a', 'a']);
  expect(getResults).toHaveBeenCalledWith('a', expect.anything());
  expect(container.textContent).toContain('共 1 条');
  await act(async () => root.unmount());
});
it('retries failed results without rendering citation or artifact sections', async () => {
  vi.mocked(getRun).mockResolvedValue({ id: 'a', question: 'q', display_title: '', source: 'openalex', status: 'completed', result_count: 2 });
  vi.mocked(getResults).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ results: [], next_cursor: null, total_count: 2, matched_count: 2, scored_count: 2, high_score_count: 1, max_score: 5 });
  const container = document.createElement('div'); const root = createRoot(container);
  await act(async () => root.render(<LiteratureRunScreen id="a" />));
  const retry = (text: string) => Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes(text))!;
  expect(retry('重试结果')).toBeTruthy();
  await act(async () => retry('重试结果').click());
  expect(container.textContent).toContain('共 2 条'); expect(retry('重试结果')).toBeFalsy();
  expect(container.textContent).not.toContain('引用图与产物');
  await act(async () => root.unmount());
});

it('shows collapsible search paths, iteration details, and the actual ranking count', async () => {
  vi.mocked(getRun).mockResolvedValue({ id: 'a', question: '社交机器人', display_title: '', source: 'openalex', status: 'running', result_count: 256 });
  const container = document.createElement('div'); const root = createRoot(container);
  await act(async () => root.render(<LiteratureRunScreen id="a" />));
  const onEvent = vi.mocked(openRunEvents).mock.calls[0][1].onEvent;
  const event = (sequence: number, event_type: string, payload: Record<string, unknown>) => ({ run_id: 'a', sequence, event_type, stage: 'query', occurred_at: '', schema_version: 1, payload });
  await act(async () => {
    onEvent(event(1, 'query.planned', { intent: '研究社交机器人', current_query: 'social robots', query_view_count: 1, query_views: [{ view_id: 'core', purpose: '核心主题', concept_groups: [{ label: '主题', terms: ['social robot', '社交机器人'] }] }] }));
    onEvent(event(2, 'query.portfolio_recorded', { view_id: 'core', query: 'title.search:"social robot"', hit_count: 420, added_unique: 300 }));
    onEvent(event(3, 'query.progress', { iteration: 1, query: 'social robot', total: 420, hit_count: 300, decision: 'keep' }));
    onEvent(event(4, 'retrieval.completed', { candidate_count: 756 }));
    onEvent(event(5, 'ranking.completed', { candidate_count: 256, scored_count: 256 }));
  });
  const panels = container.querySelectorAll('[aria-label="检索过程"] > details');
  expect(panels).toHaveLength(4);
  expect(container.textContent).toContain('title.search:"social robot"');
  expect(container.textContent).toContain('第 1 轮');
  expect(container.textContent).toContain('进入排序256');
  expect(container.textContent).toContain('BM25');
  await act(async () => root.unmount());
});

it('ignores a late cancellation of A after changing to B and cancels B only on its own click', async () => {
  const base = { question: 'q', display_title: '', source: 'openalex', status: 'running', result_count: 0 };
  vi.mocked(getRun).mockImplementation(async (id) => ({ ...base, id, question: id }));
  let finish!: (value: typeof base & { id: string }) => void;
  vi.mocked(cancelRun).mockReturnValueOnce(new Promise((done) => { finish = done; })).mockResolvedValueOnce({ ...base, id: 'b', question: 'b', status: 'cancelling' });
  const container = document.createElement('div'); const root = createRoot(container);
  await act(async () => root.render(<LiteratureRunScreen id="a" />));
  await act(async () => container.querySelector('button')!.click());
  await act(async () => root.render(<LiteratureRunScreen id="b" />));
  expect(container.textContent).toContain('取消此检索'); expect(container.querySelector('button')!.disabled).toBe(false);
  await act(async () => finish({ ...base, id: 'a', question: 'a', status: 'cancelled' }));
  expect(container.querySelector('h1')!.textContent).toBe('b');
  await act(async () => container.querySelector('button')!.click());
  expect(vi.mocked(cancelRun).mock.calls.map(([id]) => id)).toEqual(['a', 'b']);
  await act(async () => root.unmount());
});

it('ignores a late retry of A after changing to B', async () => {
  const base = { question: 'q', display_title: '', source: 'openalex', status: 'running', result_count: 0 };
  let finish!: (value: typeof base & { id: string }) => void;
  vi.mocked(getRun).mockResolvedValueOnce({ ...base, id: 'a', question: 'a' }).mockReturnValueOnce(new Promise((done) => { finish = done; })).mockResolvedValueOnce({ ...base, id: 'b', question: 'b' });
  const container = document.createElement('div'); const root = createRoot(container);
  await act(async () => root.render(<LiteratureRunScreen id="a" />));
  await act(async () => vi.mocked(openRunEvents).mock.calls[0][1].onError?.());
  await act(async () => Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('重试'))!.click());
  await act(async () => root.render(<LiteratureRunScreen id="b" />));
  await act(async () => finish({ ...base, id: 'a', question: 'a', status: 'failed' }));
  expect(container.querySelector('h1')!.textContent).toBe('b'); expect(container.textContent).toContain('状态：运行中');
  await act(async () => root.unmount());
});

it('keeps recovery disabled while a cancellation is in flight', async () => {
  const run = { id: 'a', question: 'q', display_title: '', source: 'openalex', status: 'running', result_count: 0 };
  vi.mocked(getRun).mockResolvedValue(run);
  let finish!: (value: typeof run) => void;
  vi.mocked(cancelRun).mockReset().mockReturnValueOnce(new Promise((done) => { finish = done; }));
  const container = document.createElement('div'); const root = createRoot(container);
  await act(async () => root.render(<LiteratureRunScreen id="a" />));
  await act(async () => container.querySelector('button')!.click());
  await act(async () => vi.mocked(openRunEvents).mock.calls[0][1].onError?.());
  const retry = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('重试'))!;
  expect(retry?.disabled).toBe(true);
  await act(async () => finish({ ...run, status: 'cancelled' }));
  expect(container.textContent).toContain('状态：已取消');
  expect(container.textContent).not.toContain('正在取消');
  await act(async () => root.unmount());
});
