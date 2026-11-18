// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import BibliometricsDetail from './BibliometricsDetail';
import { getAnalysis } from '@/lib/paperseek/client';
vi.stubGlobal('React', React); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
vi.mock('@/lib/paperseek/client', () => ({ getAnalysis: vi.fn(), exportAnalysis: (_id: string, format: string) => `/export?format=${format}` }));

const statistics = (overrides = {}) => ({ paper_count: 2, scored_count: 1, cited_paper_count: 1, citation_sum: 10, ranked_paper_count: 1, cas_top_count: 1, years: [], venues: [], providers: [], authors: [], institutions: [], countries: [], keywords: [], document_types: [], keyword_sources: [], citation_sources: [], coverage: [], category_totals: {}, category_limit: 100, jcr_quartiles: [], cas_tiers: [], ccf_ranks: [], ranked_venues: [], ...overrides });
const detail = (id: string, overrides = {}) => ({ id, title: `Title ${id}`, source_run_id: id, paper_count: 2, scope: 'retrieved_candidates', created_at: '', warnings: [], statistics: statistics(), ...overrides }) as never;

it('groups distributions, sorts years descending and omits removed sections', async () => {
  vi.mocked(getAnalysis).mockResolvedValue(detail('a', { warnings: ['bounded_retrieval'], statistics: statistics({ years: [{ label: '2024', count: 1 }, { label: '2026', count: 2 }, { label: '2025', count: 3 }], providers: [{ label: 'openalex', count: 2 }], keyword_sources: [{ label: 'provider-keyword', count: 1 }], citation_sources: [{ label: 'provider-citation', count: 1 }] }) }));
  const element = document.createElement('div'); const root = createRoot(element); await act(async () => root.render(<BibliometricsDetail id="a" />));
  for (const text of ['时间与文献载体', '研究主体与地域', '研究主题', '期刊评价', '数据质量']) expect(element.textContent).toContain(text);
  const years = [...element.querySelectorAll('section')].find((node) => node.querySelector('h3')?.textContent === '年份')!.textContent!;
  expect(years.indexOf('2026')).toBeLessThan(years.indexOf('2025')); expect(years.indexOf('2025')).toBeLessThan(years.indexOf('2024'));
  for (const removed of ['分析提示', 'bounded_retrieval', '数据提供方', 'openalex', '关键词来源', 'provider-keyword', '引用来源', 'provider-citation', '网络分析']) expect(element.textContent).not.toContain(removed);
  await act(async () => root.unmount());
});

it('localizes coverage labels and removes venue rank coverage', async () => {
  vi.mocked(getAnalysis).mockResolvedValue(detail('a', { statistics: statistics({ coverage: [
    { field: 'year', available: 2, total: 2 }, { field: 'venue', available: 2, total: 2 }, { field: 'authors', available: 2, total: 2 },
    { field: 'institutions', available: 1, total: 2 }, { field: 'countries', available: 1, total: 2 }, { field: 'keywords', available: 2, total: 2 },
    { field: 'references', available: 1, total: 2 }, { field: 'citations', available: 2, total: 2 }, { field: 'doi', available: 2, total: 2 },
    { field: 'references_available', available: 2, total: 2 }, { field: 'venue_rank', available: 1, total: 2 },
  ] }) }));
  const element = document.createElement('div'); const root = createRoot(element); await act(async () => root.render(<BibliometricsDetail id="a" />));
  for (const text of ['发表年份', '期刊与来源', '作者', '机构', '国家或地区', '关键词', '参考文献', '被引数据', 'DOI', '参考文献可用性']) expect(element.textContent).toContain(text);
  expect(element.textContent).not.toContain('venue_rank');
  await act(async () => root.unmount());
});

it('shows retained metrics and truncated category totals', async () => {
  vi.mocked(getAnalysis).mockResolvedValue(detail('a', { scope: 'legacy_ranked_only', statistics: statistics({ authors: [{ label: 'Author', count: 1 }], document_types: [{ label: 'Article', count: 2 }], keywords: [{ label: 'AI', count: 2 }], category_totals: { authors: 150, ranked_venues: 101 }, ranked_venues: [{ label: 'Journal', count: 1, cas_tier: 1, cas_top: true, jcr_quartile: 'Q1', impact_factor: 5.2, ccf_rank: 'A' }] }) }));
  const element = document.createElement('div'); const root = createRoot(element); await act(async () => root.render(<BibliometricsDetail id="a" />));
  for (const text of ['历史排序结果', '文献类型', 'Article', '作者', 'Author', '关键词', 'AI', '中科院 Top', 'Journal', '5.2', '前 100 / 共 150', '前 100 / 共 101']) expect(element.textContent).toContain(text);
  const journalGroup = [...element.querySelectorAll('section')].find((section) => section.querySelector(':scope > div > h3')?.textContent === '期刊评价');
  expect(journalGroup?.querySelector('#journal-heading')?.textContent).toBe('匹配期刊分区与影响因子');
  await act(async () => root.unmount());
});

it('isolates detail state across IDs and ignores late responses', async () => {
  let resolveOld!: (value: never) => void;
  vi.mocked(getAnalysis).mockReset().mockResolvedValueOnce(detail('first')).mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; })).mockResolvedValueOnce(detail('third'));
  const element = document.createElement('div'); const root = createRoot(element);
  await act(async () => root.render(<BibliometricsDetail id="first" />)); expect(element.textContent).toContain('Title first');
  await act(async () => root.render(<BibliometricsDetail id="second" />)); expect(element.textContent).not.toContain('Title first'); expect(element.querySelector('a[href*="export"]')).toBeNull();
  await act(async () => root.render(<BibliometricsDetail id="third" />)); expect(element.textContent).toContain('Title third');
  await act(async () => resolveOld(detail('second'))); expect(element.textContent).toContain('Title third'); expect(element.textContent).not.toContain('Title second');
  await act(async () => root.unmount());
});

it('clears an error when switching to another analysis', async () => {
  vi.mocked(getAnalysis).mockReset().mockRejectedValueOnce(new Error('old error')).mockResolvedValueOnce(detail('new'));
  const element = document.createElement('div'); const root = createRoot(element);
  await act(async () => root.render(<BibliometricsDetail id="old" />)); expect(element.textContent).toContain('old error');
  await act(async () => root.render(<BibliometricsDetail id="new" />)); expect(element.textContent).toContain('Title new'); expect(element.textContent).not.toContain('old error');
  await act(async () => root.unmount());
});
