import { recent, sources } from './paperseek';

const item = { ...recent, created_at: '2026-01-01T00:00:00Z' };
const history = { items: [item], next_cursor: null, matched_count: 1 };
const defaults = { search_llm: '', review_llm: '', pre_ranking: 'local_fusion', embedding: '', reranker: '', decision: '', source: 'openalex' };
const settings = { connections: [], sources: [{ id: 'openalex', has_key: false, key_origin: '', key_hint: '', usable: true, options: {}, test: { status: 'untested', latency_ms: null, code: '', tested_at: null } }], defaults, proxy: null };
const statistics = { paper_count: 2, scored_count: 2, cited_paper_count: 2, citation_sum: 9, years: [{ label: '2025', count: 2 }], venues: [], providers: [], document_types: [], authors: [], institutions: [], countries: [], keywords: [], keyword_sources: [], citation_sources: [], coverage: [], category_totals: {}, category_limit: 100, ranked_paper_count: 0, cas_top_count: 0, cas_tiers: [], jcr_quartiles: [], ccf_ranks: [], ranked_venues: [] };
const analysis = { id: 'example-analysis', source_run_id: recent.id, title: '示例文献计量分析', paper_count: 2, scope: 'retrieved_candidates', created_at: item.created_at, source_reported_total: 2, retrieval_pool_limit: null, scoring_limit: null, warnings: [], statistics };
const network = { parameters: { kind: 'keywords', min_occurrences: 2, max_nodes: 100, max_edges: 500, min_weight: 1 }, corpus_count: 2, eligible_paper_count: 2, eligible_node_count: 2, total_edge_count: 1, excluded_reference_count: 0, nodes: [{ id: 'ai', label: '人工智能', count: 2 }, { id: 'science', label: '科学研究', count: 2 }], edges: [{ source: 'ai', target: 'science', weight: 2, similarity: 1 }], warnings: [] };

export async function mockResponse(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://localhost');
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (url.origin !== 'http://localhost') return new Response(null, { status: 403 });
  if (method === 'POST' && url.pathname === '/api/paperseek/bibliometrics/example-analysis/network') return Response.json(network);
  if (method !== 'GET') return new Response(null, { status: 403 });
  const path = url.pathname;
  if (path === '/api/paperseek/sources') return Response.json({ sources });
  if (path === '/api/paperseek/history') return Response.json(history);
  if (path === '/api/paperseek/settings') return Response.json(settings);
  if (path === '/api/paperseek/bibliometrics') return Response.json({ items: [analysis], total_count: 1, next_offset: null });
  if (path === '/api/paperseek/bibliometrics/example-analysis') return Response.json(analysis);
  if (path === '/api/paperseek/runs/example-run') return Response.json(recent);
  if (path === '/api/paperseek/runs/example-run/citation-map') return Response.json({ nodes: [], edges: [], enabled: false });
  if (path === '/api/paperseek/runs/example-run/artifacts') return Response.json({ artifacts: [] });
  if (path === '/api/paperseek/runs/example-run/results') {
    const second = url.searchParams.has('cursor');
    return Response.json({ results: [{ uid: second ? '2' : '1', rank: second ? 2 : 1, title: second ? '示例论文二' : '示例论文一', authors: ['示例作者'], year: 2025, venue: '示例期刊', doi: '', url: '', abstract: '', relevance_score: 9, relevance_reason: '', citation_count: 3 }], next_cursor: second ? null : 'page-two', total_count: 2, matched_count: 2, scored_count: 2, high_score_count: 2, max_score: 9 });
  }
  return new Response(null, { status: 403 });
}
