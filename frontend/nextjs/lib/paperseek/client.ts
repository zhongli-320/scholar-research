import type { PaperSeekHistoryPage, PaperSeekRun, PaperSeekRunInput, PaperSeekSource } from './types';

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
