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
it('keeps the displayed page and cursor stack if the next page fails, then retries it', async () => {
  vi.clearAllMocks();
  vi.mocked(getResults).mockResolvedValueOnce(page('next')).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ...page(null), matched_count: 1 }).mockResolvedValueOnce(page('next'));
  const container = document.createElement('div'); const root = createRoot(container);
  await act(async () => root.render(<LiteratureResults id="a" />));
  const button = (text: string) => Array.from(container.querySelectorAll('button')).find((item) => item.textContent === text)!;
  await act(async () => button('下一页').click());
  expect(container.textContent).toContain('共 2 条'); expect(button('上一页').disabled).toBe(true);
  expect(button('重试结果')).toBeTruthy();
  await act(async () => button('重试结果').click());
  expect(vi.mocked(getResults).mock.calls[2][1]).toMatchObject({ cursor: 'next' });
  expect(container.textContent).toContain('匹配 1 条');
  expect(container.querySelector('[role=alert]')).toBeNull();
  expect(button('上一页').disabled).toBe(false);
  await act(async () => button('上一页').click());
  expect(vi.mocked(getResults).mock.calls[3][1]).toMatchObject({ cursor: undefined });
  await act(async () => root.unmount());
});

it('shows available journal rankings per result without empty labels', async () => {
  vi.clearAllMocks();
  const result = { rank: 1, uid: 'one', title: 'Paper', authors: ['Author'], year: 2025, venue: 'Journal', doi: '', url: '', abstract: '', relevance_score: 9, relevance_reason: '', citation_count: 1 };
  vi.mocked(getResults).mockResolvedValue({
    ...page(null),
    results: [
      { ...result, journal_metrics: { cas: { tier: 1, top: true }, jcr: { quartile: 'Q1', impact_factor: 18.8 } } },
      { ...result, rank: 2, uid: 'two', journal_metrics: { ccf: { rank: 'B' } } },
      { ...result, rank: 3, uid: 'three', journal_metrics: {} },
    ],
  });
  const container = document.createElement('div'); const root = createRoot(container);
  await act(async () => root.render(<LiteratureResults id="a" />));
  const results = Array.from(container.querySelectorAll('ol > li'));
  expect(results[0].textContent).toContain('JCR Q1');
  expect(results[0].textContent).toContain('IF 18.8');
  expect(results[0].textContent).toContain('中科院 1 区');
  expect(results[0].textContent).toContain('Top');
  expect(results[1].textContent).toContain('CCF B');
  expect(results[1].textContent).not.toMatch(/JCR|IF|中科院|Top/);
  expect(results[2].textContent).not.toMatch(/JCR|IF|中科院|Top|CCF/);
  await act(async () => root.unmount());
});
