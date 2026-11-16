import type { PaperSeekArtifact, PaperSeekCitationMap, PaperSeekFilters, PaperSeekHistoryPage, PaperSeekResultPage, PaperSeekRun, PaperSeekRunInput, PaperSeekSource } from './types';

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
  return read(await fetch('/api/paperseek/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(input),
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
