// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import SearchHistoryScreen from './SearchHistoryScreen';
import { listHistory } from '@/lib/paperseek/client';
import { deleteSearch } from '@/lib/paperseek/history';
vi.stubGlobal('React', React);
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
vi.mock('@/lib/paperseek/client', () => ({ listHistory: vi.fn() }));
vi.mock('@/lib/paperseek/history', () => ({ deleteSearch: vi.fn(), renameSearch: vi.fn() }));
it('resets pagination on query and requires a second click to delete', async () => {
  const item = { id: 'one', question: 'One', display_title: 'One', source: 'openalex', status: 'completed', result_count: 1, created_at: '2026-01-01' };
  vi.mocked(listHistory).mockResolvedValue({ items: [item], next_cursor: 'old-cursor', matched_count: 1 });
  vi.mocked(deleteSearch).mockResolvedValue();
  const container = document.createElement('div'); const root = createRoot(container);
  await act(async () => root.render(<SearchHistoryScreen />));
  const button = (label: string) => [...container.querySelectorAll('button')].find((b) => b.textContent === label)!;
  await act(async () => button('删除').click());
  expect(deleteSearch).not.toHaveBeenCalled();
  await act(async () => button('确认删除').click());
  expect(deleteSearch).toHaveBeenCalledWith('one');
  const input = container.querySelector('input')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'new'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(vi.mocked(listHistory).mock.calls.at(-1)?.[0]).toEqual({ query: 'new' });
  await act(async () => root.unmount());
});

it('ignores an older page response after a new query', async () => {
  let resolveOld!: (page: Awaited<ReturnType<typeof listHistory>>) => void;
  vi.mocked(listHistory).mockReset().mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; })).mockResolvedValueOnce({ items: [{ id: 'new', question: 'New', display_title: 'New', source: 'openalex', status: 'completed', result_count: 1, created_at: '2026-01-02' }], next_cursor: 'new-cursor', matched_count: 1 });
  const container = document.createElement('div'); const root = createRoot(container);
  await act(async () => root.render(<SearchHistoryScreen />));
  const input = container.querySelector('input')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'new'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await act(async () => resolveOld({ items: [{ id: 'old', question: 'Old', display_title: 'Old', source: 'openalex', status: 'completed', result_count: 1, created_at: '2026-01-01' }], next_cursor: 'old-cursor', matched_count: 1 }));
  expect(container.textContent).toContain('New');
  expect(container.textContent).not.toContain('Old');
  vi.mocked(listHistory).mockResolvedValue({ items: [], next_cursor: null, matched_count: 0 });
  await act(async () => [...container.querySelectorAll('button')].find((b) => b.textContent === '下一页')!.click());
  expect(vi.mocked(listHistory).mock.calls.at(-1)?.[0]).toEqual({ query: 'new', cursor: 'new-cursor' });
  await act(async () => root.unmount());
});

it('clears the old cursor session immediately when a new query fails', async () => {
  vi.mocked(listHistory).mockReset().mockResolvedValueOnce({ items: [], next_cursor: 'old-next', matched_count: 0 }).mockResolvedValueOnce({ items: [], next_cursor: 'old-next-2', matched_count: 0 }).mockRejectedValueOnce(new Error('offline'));
  const container = document.createElement('div'); const root = createRoot(container);
  await act(async () => root.render(<SearchHistoryScreen />));
  const button = (label: string) => [...container.querySelectorAll('button')].find((b) => b.textContent === label)!;
  await act(async () => button('下一页').click());
  const input = container.querySelector('input')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'new'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(container.textContent).toContain('offline');
  expect(button('上一页').disabled).toBe(true);
  expect(button('下一页').disabled).toBe(true);
  expect(vi.mocked(listHistory).mock.calls.at(-1)?.[0]).toEqual({ query: 'new' });
  await act(async () => root.unmount());
});

it('moves focus to confirmation and returns it to the same delete button on cancel', async () => {
  vi.mocked(listHistory).mockReset().mockResolvedValue({ items: [{ id: 'one', question: 'One', display_title: 'One', source: 'openalex', status: 'completed', result_count: 1, created_at: '2026-01-01' }], next_cursor: null, matched_count: 1 });
  vi.mocked(deleteSearch).mockReset();
  const container = document.createElement('div'); document.body.appendChild(container); const root = createRoot(container);
  await act(async () => root.render(<SearchHistoryScreen />));
  const button = (label: string) => [...container.querySelectorAll('button')].find((b) => b.textContent === label)!;
  const original = button('删除'); await act(async () => original.focus());
  await act(async () => original.click());
  expect(document.activeElement).toBe(button('确认删除'));
  await act(async () => button('取消').click());
  expect(document.activeElement).toBe(button('删除'));
  expect(deleteSearch).not.toHaveBeenCalled();
  await act(async () => root.unmount()); container.remove();
});

it('does not restore focus to a record after successful deletion', async () => {
  const item = { id: 'one', question: 'One', display_title: 'One', source: 'openalex', status: 'completed', result_count: 1, created_at: '2026-01-01' };
  vi.mocked(listHistory).mockReset().mockResolvedValueOnce({ items: [item], next_cursor: null, matched_count: 1 }).mockResolvedValueOnce({ items: [], next_cursor: null, matched_count: 0 });
  let resolveDelete!: () => void;
  vi.mocked(deleteSearch).mockReset().mockReturnValue(new Promise<void>((resolve) => { resolveDelete = resolve; }));
  const container = document.createElement('div'); document.body.appendChild(container); const root = createRoot(container);
  await act(async () => root.render(<SearchHistoryScreen />));
  const button = (label: string) => [...container.querySelectorAll('button')].find((b) => b.textContent === label)!;
  await act(async () => button('删除').click());
  const confirmation = button('确认删除');
  expect(confirmation.getAttribute('aria-label')).toContain('One');
  await act(async () => confirmation.click());
  expect(button('取消').disabled).toBe(true);
  await act(async () => resolveDelete());
  expect(container.textContent).not.toContain('One');
  expect(document.activeElement).not.toBe(confirmation);
  expect(vi.mocked(deleteSearch)).toHaveBeenCalledOnce();
  await act(async () => root.unmount()); container.remove();
});

it('prevents cancellation and repeated confirmation during deletion and recovers after failure', async () => {
  const item = { id: 'one', question: 'One', display_title: 'One', source: 'openalex', status: 'completed', result_count: 1, created_at: '2026-01-01' };
  vi.mocked(listHistory).mockReset().mockResolvedValue({ items: [item], next_cursor: null, matched_count: 1 });
  let rejectDelete!: (error: Error) => void;
  vi.mocked(deleteSearch).mockReset().mockReturnValueOnce(new Promise((_, reject) => { rejectDelete = reject; }));
  const container = document.createElement('div'); document.body.appendChild(container); const root = createRoot(container);
  await act(async () => root.render(<SearchHistoryScreen />));
  const button = (label: string) => [...container.querySelectorAll('button')].find((b) => b.textContent === label)!;
  await act(async () => button('删除').click());
  await act(async () => button('确认删除').click());
  expect(button('确认删除').disabled).toBe(true);
  expect(button('取消').disabled).toBe(true);
  await act(async () => { button('取消').click(); button('确认删除').click(); });
  expect(vi.mocked(deleteSearch)).toHaveBeenCalledOnce();
  expect(container.textContent).toContain('确认删除');
  await act(async () => rejectDelete(new Error('删除失败')));
  expect(button('确认删除').disabled).toBe(false);
  expect(button('取消').disabled).toBe(false);
  await act(async () => button('取消').click());
  expect(document.activeElement).toBe(button('删除'));
  await act(async () => root.unmount()); container.remove();
});
