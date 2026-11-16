// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import LiteratureResults from './LiteratureResults';
import { getResults } from '@/lib/paperseek/client';
import type { PaperSeekResultPage } from '@/lib/paperseek/types';
vi.mock('@/lib/paperseek/client', () => ({ getResults: vi.fn(), getCitationMap: vi.fn().mockResolvedValue({ nodes: [], edges: [] }), listArtifacts: vi.fn().mockResolvedValue([]), exportRun: () => '/export', exportSelected: vi.fn(), PaperSeekApiError: class extends Error {} }));
vi.stubGlobal('React', React); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
const page = (cursor: string | null): PaperSeekResultPage => ({ results: [], next_cursor: cursor, total_count: 2, matched_count: 2, scored_count: 2, high_score_count: 1, max_score: 10 });
it('disables paging during requests and discards the previous filter cursor', async () => {
  let resolve!: (value: PaperSeekResultPage) => void;
  vi.mocked(getResults).mockResolvedValueOnce(page('old')).mockReturnValueOnce(new Promise((done) => { resolve = done; })).mockResolvedValue(page(null));
  const container = document.createElement('div'); const root = createRoot(container);
  await act(async () => root.render(<LiteratureResults id="a" />));
  const input = container.querySelector('input')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'new'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  const next = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === '下一页');
  expect(!next || next.disabled).toBe(true);
  expect(vi.mocked(getResults).mock.calls[1][1]).toMatchObject({ query: 'new', cursor: undefined });
  await act(async () => { resolve(page('new-cursor')); });
  const nextReady = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === '下一页')!;
  await act(async () => { nextReady.click(); nextReady.click(); });
  expect(vi.mocked(getResults).mock.calls).toHaveLength(3);
  expect(vi.mocked(getResults).mock.calls[2][1]).toMatchObject({ query: 'new', cursor: 'new-cursor' });
  await act(async () => root.unmount());
});
