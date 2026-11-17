import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRun, listHistory, PaperSeekApiError } from './client';

afterEach(() => vi.unstubAllGlobals());

describe('PaperSeek client', () => {
  it('submits the saved default connections instead of provider fallbacks', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({
        connections: [], sources: [],
        defaults: { search_llm: 'glm', review_llm: 'glm', pre_ranking: 'local_fusion', embedding: 'embedding', reranker: '', decision: '', source: 'openalex' },
        proxy: null,
      }))
      .mockResolvedValueOnce(Response.json({ id: 'run-1' }));
    vi.stubGlobal('fetch', fetcher);
    vi.stubGlobal('crypto', { randomUUID: () => 'key-1' });
    const input = { question: 'question', source: 'openalex', search_budget: 'fast', field_ids: ['1'], field_hint: 'hint', citation_enabled: true, wos_db: 'WOS' };
    await createRun(input);
    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/paperseek/settings', { method: 'GET', cache: 'no-store' });
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/paperseek/runs', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'key-1' },
      body: JSON.stringify({ ...input, connections: { llm: 'glm', embedding: 'embedding', reranker: '', decision: '' }, retrieval: { mode: 'local_fusion' } }),
    });
  });
  it('requests one recent history item', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ items: [] }));
    vi.stubGlobal('fetch', fetcher);
    await listHistory({ limit: 1 });
    expect(fetcher).toHaveBeenCalledWith('/api/paperseek/history?page_size=1');
  });
  it('exposes structured errors and handles non-JSON errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ error: { code: 'offline', message: 'Offline' } }, { status: 503 })).mockResolvedValueOnce(new Response('unavailable', { status: 502 })));
    await expect(listHistory({ limit: 1 })).rejects.toMatchObject({ code: 'offline', message: 'Offline', status: 503 });
    await expect(listHistory({ limit: 1 })).rejects.toBeInstanceOf(PaperSeekApiError);
  });
});
