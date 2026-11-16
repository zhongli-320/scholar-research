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
