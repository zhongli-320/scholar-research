import type { PaperSeekArtifact, PaperSeekCitationMap, PaperSeekFilters, PaperSeekHistoryPage, PaperSeekResultPage, PaperSeekRun, PaperSeekRunInput, PaperSeekSource } from './types';
import { loadPaperSeekSettings } from './settings';

export class PaperSeekApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = 'PaperSeekApiError';
  }
}

async function read<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new PaperSeekApiError(body?.error?.code || 'PAPERSEEK_ERROR', body?.error?.message || 'PaperSeek 请求失败', response.status);
  }
  return response.json() as Promise<T>;
}

export async function listSources(): Promise<PaperSeekSource[]> {
  return (await read<{ sources: PaperSeekSource[] }>(await fetch('/api/paperseek/sources'))).sources;
}
export async function listHistory(params: { limit?: number; cursor?: string; query?: string } = {}): Promise<PaperSeekHistoryPage> {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set('page_size', String(params.limit));
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.query) query.set('query', params.query);
  const suffix = query.toString();
  return read(await fetch(`/api/paperseek/history${suffix ? `?${suffix}` : ''}`));
}
export async function createRun(input: PaperSeekRunInput): Promise<PaperSeekRun> {
  const { defaults } = await loadPaperSeekSettings();
  return read(await fetch('/api/paperseek/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({
      ...input,
      connections: { llm: defaults.search_llm, embedding: defaults.embedding, reranker: defaults.reranker, decision: defaults.decision },
      retrieval: { mode: defaults.pre_ranking },
    }),
  }));
}

const runPath = (id: string) => `/api/paperseek/runs/${encodeURIComponent(id)}`;
export async function getRun(id: string): Promise<PaperSeekRun> {
  return read(await fetch(runPath(id), { cache: 'no-store' }));
}
export async function cancelRun(id: string): Promise<PaperSeekRun> {
  return read(await fetch(`${runPath(id)}/cancel`, { method: 'POST' }));
}
export async function getResults(id: string, filters: PaperSeekFilters = {}): Promise<PaperSeekResultPage> {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== '') query.set(key, String(value)); });
  return read(await fetch(`${runPath(id)}/results?${query}`));
}
export async function getCitationMap(id: string): Promise<PaperSeekCitationMap> {
  return read(await fetch(`${runPath(id)}/citation-map`));
}
export async function listArtifacts(id: string): Promise<PaperSeekArtifact[]> {
  return (await read<{ artifacts: PaperSeekArtifact[] }>(await fetch(`${runPath(id)}/artifacts`))).artifacts;
}
export function exportRun(id: string, format: string): string {
  return `${runPath(id)}/export?${new URLSearchParams({ format })}`;
}
export async function exportSelected(id: string, format: string, uids: string[]): Promise<Response> {
  const response = await fetch(`${runPath(id)}/export-selected`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format, uids }) });
  if (!response.ok) await read(response);
  return response;
}

const analysisPath = (id: string) => `/api/paperseek/bibliometrics/${encodeURIComponent(id)}`;
export async function createAnalysis(input: { source_run_id: string; title: string }, idempotencyKey = crypto.randomUUID()): Promise<import('./types').PaperSeekAnalysis> {
  return read(await fetch('/api/paperseek/bibliometrics', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ source_run_id: input.source_run_id, title: input.title }) }));
}
export async function listAnalyses(params: { q?: string; offset?: number; limit?: number } = {}): Promise<import('./types').PaperSeekAnalysisPage> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') query.set(key, String(value));
  return read(await fetch(`/api/paperseek/bibliometrics${query.size ? `?${query}` : ''}`, { cache: 'no-store' }));
}
export async function getAnalysis(id: string): Promise<import('./types').PaperSeekAnalysis> {
  return read(await fetch(analysisPath(id), { cache: 'no-store' }));
}
async function expectNoContent(response: Response): Promise<void> {
  if (response.status !== 204) {
    if (!response.ok) await read(response);
    throw new PaperSeekApiError('PAPERSEEK_ERROR', 'PaperSeek 返回了意外状态', response.status);
  }
}
export async function renameAnalysis(id: string, title: string): Promise<void> {
  if (!title.trim()) throw new Error('标题不能为空');
  await expectNoContent(await fetch(analysisPath(id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim() }) }));
}
export async function deleteAnalysis(id: string): Promise<void> {
  await expectNoContent(await fetch(analysisPath(id), { method: 'DELETE' }));
}
export async function buildNetwork(id: string, params: import('./types').PaperSeekNetworkParameters = { kind: 'keywords', min_occurrences: 2, max_nodes: 100, max_edges: 500 }): Promise<import('./types').PaperSeekMetricNetwork> {
  return read(await fetch(`${analysisPath(id)}/network`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) }));
}
export function exportAnalysis(id: string, format: 'csv' | 'json'): string {
  return `${analysisPath(id)}/export?${new URLSearchParams({ format })}`;
}
