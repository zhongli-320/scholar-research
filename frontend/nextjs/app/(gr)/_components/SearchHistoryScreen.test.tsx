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
