// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import BibliometricsDetail from './BibliometricsDetail';
import { getAnalysis, buildNetwork } from '@/lib/paperseek/client';
vi.stubGlobal('React', React); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
vi.mock('@/lib/paperseek/client', () => ({ getAnalysis: vi.fn(), buildNetwork: vi.fn(), exportAnalysis: (_id: string, format: string) => `/export?format=${format}` }));
it('shows metrics and preserves analysis and network warnings', async () => {
  vi.mocked(getAnalysis).mockResolvedValue({ id: 'a', title: 'Title', source_run_id: 'run', paper_count: 2, scope: 'retrieved_candidates', created_at: '', source_reported_total: 5, retrieval_pool_limit: 4, scoring_limit: 3, warnings: ['bounded_retrieval'], statistics: { paper_count: 2, citation_sum: 10, years: [{ label: '2025', count: 2 }], venues: [], providers: [], authors: [], institutions: [], countries: [], keywords: [], coverage: [], jcr_quartiles: [], cas_tiers: [], ccf_ranks: [], ranked_venues: [] } } as never);
  vi.mocked(buildNetwork).mockResolvedValue({ nodes: [{ id: 'low', label: 'Low', count: 1 }, { id: 'high', label: 'High', count: 3 }], edges: [], warnings: ['network_warning'] } as never);
  const element = document.createElement('div'); const root = createRoot(element);
  await act(async () => root.render(<BibliometricsDetail id="a" />));
  expect(element.textContent).toContain('bounded_retrieval'); expect(element.textContent).toContain('2025');
  await act(async () => element.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(element.textContent).toContain('network_warning');
  const nodes = [...element.querySelectorAll('[data-network-node]')].map((node) => node.textContent);
  expect(nodes[0]).toContain('High'); expect(nodes[1]).toContain('Low');
  await act(async () => root.unmount());
});

it('shows source coverage, all descriptive metrics and truncated category totals', async () => {
  vi.mocked(getAnalysis).mockResolvedValue({ id: 'a', title: 'Title', source_run_id: 'run', paper_count: 2, scope: 'legacy_ranked_only', created_at: '', warnings: ['legacy_warning'], statistics: { paper_count: 2, scored_count: 1, cited_paper_count: 0, citation_sum: 0, ranked_paper_count: 1, cas_top_count: 1, years: [], venues: [], providers: [], authors: [{ label: 'Author', count: 1 }], institutions: [], countries: [], keywords: [], document_types: [{ label: 'Article', count: 2 }], keyword_sources: [{ label: 'keyword-provider', count: 1 }], citation_sources: [{ label: 'citation-provider', count: 1 }], coverage: [{ field: 'citations', available: 0, total: 2 }], category_totals: { authors: 150, ranked_venues: 101 }, category_limit: 100, jcr_quartiles: [], cas_tiers: [], ccf_ranks: [], ranked_venues: [{ label: 'Journal', count: 1, cas_tier: 1, cas_top: true, jcr_quartile: 'Q1', impact_factor: 5.2, ccf_rank: 'A' }] } } as never);
  const element = document.createElement('div'); const root = createRoot(element); await act(async () => root.render(<BibliometricsDetail id="a" />));
  for (const text of ['历史排序结果', '已评分', '有引用', '引用数据缺失', '文献类型', 'Article', '关键词来源', 'keyword-provider', '引用来源', 'citation-provider', '中科院 Top', 'Journal', '5.2', '前 100 / 共 150', '前 100 / 共 101', 'legacy_warning']) expect(element.textContent).toContain(text);
  await act(async () => root.unmount());
});
it('isolates coupling-only frequency and orders nodes by incident edge weight', async () => {
  vi.mocked(getAnalysis).mockResolvedValue({ id: 'a', title: 'T', source_run_id: 'r', paper_count: 2, scope: 'retrieved_candidates', warnings: [], statistics: { paper_count: 2, citation_sum: 0, years: [], venues: [], providers: [], authors: [], institutions: [], countries: [], keywords: [], coverage: [], jcr_quartiles: [], cas_tiers: [], ccf_ranks: [], ranked_venues: [] } } as never);
  vi.mocked(buildNetwork).mockReset().mockResolvedValue({ corpus_count: 3, eligible_paper_count: 2, eligible_node_count: 4, total_edge_count: 2, excluded_reference_count: 7, nodes: [{ id: 'a', label: 'A', count: 10 }, { id: 'b', label: 'B', count: 1 }, { id: 'c', label: 'C', count: 2 }, { id: 'd', label: 'D', count: 99 }], edges: [{ source: 'a', target: 'b', weight: 2 }, { source: 'b', target: 'c', weight: 5 }], warnings: [] } as never);
  const element = document.createElement('div'); const root = createRoot(element); await act(async () => root.render(<BibliometricsDetail id="a" />));
  const select = element.querySelector('select')!; await act(async () => { select.value = 'coupling'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  const freq = [...element.querySelectorAll('input')].find((input) => input.max === '10000' && !input.required)!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(freq, '20'); freq.dispatchEvent(new Event('input', { bubbles: true })); });
  const submit = () => element.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await act(async () => { submit(); }); expect(vi.mocked(buildNetwork).mock.calls[0][1]).toMatchObject({ kind: 'coupling', max_reference_frequency: 20 });
  await act(async () => { select.value = 'keywords'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => { submit(); }); expect(vi.mocked(buildNetwork).mock.calls[1][1]).not.toHaveProperty('max_reference_frequency');
  expect([...element.querySelectorAll('[data-network-node]')].map((x) => x.textContent?.trim()[0])).toEqual(['B', 'C', 'A', 'D']);
  for (const text of ['符合条件的论文 2', '显示节点 4', '符合条件的节点 4', '显示连边 2', '连边总数 2', '排除参考文献 7']) expect(element.textContent).toContain(text);
  await act(async () => root.unmount());
});
