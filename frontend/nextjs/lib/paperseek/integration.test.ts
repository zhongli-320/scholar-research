import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET as reports } from '@/app/api/reports/route';
import { GET as history } from '@/app/api/paperseek/history/route';
import { listHistory } from './client';
import { mockResponse } from '@/app/(gr)/mocks/_data/fixtures';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('workbench isolation', () => {
  it('keeps PaperSeek history available when the report backend is offline', async () => {
    vi.stubEnv('NEXT_PUBLIC_GPTR_API_URL', 'http://gptr.test');
    vi.stubEnv('PAPERSEEK_API_URL', 'http://paperseek.test');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith('http://gptr.test')) throw new Error('offline');
      if (url.startsWith('http://paperseek.test/api/v1/history')) return Response.json({ items: [{ id: 'saved', question: 'Saved search', display_title: 'Saved search', source: 'openalex', status: 'completed', result_count: 3, created_at: '2026-01-01' }], next_cursor: null, matched_count: 1 });
      if (url.startsWith('/api/paperseek/history')) return history(new Request(`http://localhost${url}`));
      throw new Error(`unexpected request ${url}`);
    }));
    expect((await reports(new Request('http://localhost/api/reports'))).status).toBe(500);
    expect((await listHistory()).items[0].display_title).toBe('Saved search');
  });

  it('keeps report reads on the report backend after PaperSeek returns 503', async () => {
    vi.stubEnv('NEXT_PUBLIC_GPTR_API_URL', 'http://gptr.test');
    vi.stubEnv('PAPERSEEK_API_URL', 'http://paperseek.test');
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input); urls.push(url);
      if (url.startsWith('http://paperseek.test')) return Response.json({ error: { code: 'PAPERSEEK_UNAVAILABLE' } }, { status: 503 });
      if (url === 'http://gptr.test/api/reports') return Response.json({ reports: [{ id: 'report-1' }] });
      throw new Error(`unexpected request ${url}`);
    }));
    expect((await history(new Request('http://localhost/api/paperseek/history'))).status).toBe(503);
    const response = await reports(new Request('http://localhost/api/reports'));
    expect((await response.json()).reports[0].id).toBe('report-1');
    expect(urls).toEqual(['http://paperseek.test/api/v1/history', 'http://gptr.test/api/reports']);
  });

  it('serves fixtures locally and rejects unmatched reads and every mutation', async () => {
    expect((await (await mockResponse('/api/paperseek/history')).json()).items[0].display_title).toBe('人工智能与科学研究');
    expect((await mockResponse('/api/paperseek/history', { method: 'DELETE' })).status).toBe(403);
    expect((await mockResponse('/api/paperseek/settings/connections/test', { method: 'POST' })).status).toBe(403);
    expect((await mockResponse('/unexpected')).status).toBe(403);
  });
});
