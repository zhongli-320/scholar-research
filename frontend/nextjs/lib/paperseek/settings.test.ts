import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPaperSeekSettings, updateConnection, saveDefaults, testConnection, testSource } from './settings';
import { GET } from '@/app/api/paperseek/settings/route';
import { PUT } from '@/app/api/paperseek/settings/connections/[id]/route';

const connection = { kind: 'llm' as const, provider: 'openai', api_type: '', base_url: '', model: '', api_key: '' };
afterEach(() => vi.restoreAllMocks());
describe('settings security', () => {
  it('strips secrets from the gateway response even if upstream returns them', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ connections: [{ id: 'a', api_key: 'SECRET', has_key: true }], sources: [{ id: 'b', api_key: 'SECRET' }], defaults: {}, proxy: null })));
    const response = await GET(new Request('http://localhost/api/paperseek/settings'));
    expect(JSON.stringify(await response.json())).not.toContain('SECRET');
  });
  it('omits blank keys in updates at both client and gateway', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ id: 'x' }));
    vi.stubGlobal('fetch', fetcher);
    await updateConnection('x/y', connection);
    expect(fetcher.mock.calls[0][0]).toBe('/api/paperseek/settings/connections/x%2Fy');
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).not.toHaveProperty('api_key');
    await PUT(new Request('http://localhost', { method: 'PUT', body: JSON.stringify(connection) }), { params: { id: 'x' } });
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).not.toHaveProperty('api_key');
  });
  it('uses only PaperSeek endpoints and encodes source and connection IDs', async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(Response.json({})));
    vi.stubGlobal('fetch', fetcher);
    await saveDefaults({ source: 'openalex' });
    await testConnection('x/y');
    await testSource('a/b');
    expect(fetcher.mock.calls.map(c => c[0])).toEqual(['/api/paperseek/settings/defaults', '/api/paperseek/settings/connections/x%2Fy/test', '/api/paperseek/settings/sources/a%2Fb/test']);
  });
  it('does not log or return secrets from client responses', async () => {
    const log = vi.spyOn(console, 'log');
    const error = vi.spyOn(console, 'error');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ connections: [{ api_key: 'SECRET' }], sources: [], defaults: {}, proxy: null })));
    expect(JSON.stringify(await loadPaperSeekSettings())).not.toContain('SECRET');
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});


it('sanitizes errors and does not log a draft test body', async () => {
  const { POST } = await import('@/app/api/paperseek/settings/connections/test/route');
  const spy = vi.spyOn(console, 'error');
  const log = vi.spyOn(console, 'log');
  const fetcher = vi.fn().mockResolvedValue(Response.json({ error: 'SECRET' }, { status: 422 }));
  vi.stubGlobal('fetch', fetcher);
  const response = await POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ ...connection, api_key: 'SECRET' }) }));
  expect(await response.text()).not.toContain('SECRET');
  expect(spy).not.toHaveBeenCalled();
  expect(log).not.toHaveBeenCalled();
});

it('encodes dynamic gateway IDs and omits empty source keys', async () => {
  const { PUT: save } = await import('@/app/api/paperseek/settings/sources/[id]/route');
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetcher);
  const response = await save(new Request('http://localhost', { method: 'PUT', body: JSON.stringify({ api_key: ' ', options: { openalex_email: 'research@example.org' } }) }), { params: { id: 'a/b' } });
  expect(response.status).toBe(204);
  expect(fetcher.mock.calls[0][0]).toContain('/api/v1/settings/sources/a%2Fb');
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).not.toHaveProperty('api_key');
});
