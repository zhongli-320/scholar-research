import { describe, it, expect, vi, afterEach } from 'vitest';
import { GET } from '@/app/api/paperseek/settings/route';
import { POST as create } from '@/app/api/paperseek/settings/connections/route';
import { POST as probe } from '@/app/api/paperseek/settings/connections/[id]/test/route';
import { DELETE as remove } from '@/app/api/paperseek/settings/connections/[id]/route';
import { PUT as defaults } from '@/app/api/paperseek/settings/defaults/route';
const bad = { api_key: 'SECRET' };
const fetcher = vi.fn();
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function setup(body: unknown, status = 200) { fetcher.mockReset().mockImplementation(() => Promise.resolve(Response.json(body, { status }))); vi.stubGlobal('fetch', fetcher); }
const mutating = (url: string, body?: string, headers: Record<string, string> = {}) => new Request(url, { method: 'POST', headers, ...(body === undefined ? {} : { body }) });
describe('settings gateway boundary', () => {
  it('rejects nested non-scalar secrets in all response shapes', async () => {
    setup({ connections: [{ model: bad }], sources: [{ options: { pubmed_email: bad } }], defaults: { source: bad }, proxy: { hosts: [bad] } });
    const response = await GET(new Request('http://localhost/api/paperseek/settings'));
    expect(await response.text()).not.toContain('SECRET');
    expect(response.status).toBe(502);
    setup({ ok: false, code: bad, latency_ms: null });
    const test = await probe(mutating('http://localhost/api/paperseek/settings/connections/a/test', undefined, { Origin: 'http://localhost' }), { params: { id: 'a' } });
    expect(await test.text()).not.toContain('SECRET'); expect(test.status).toBe(502);
  });
  it('blocks foreign origins and text/plain without contacting the upstream', async () => {
    setup({});
    expect((await create(mutating('http://localhost/api/paperseek/settings/connections', '{}', { Origin: 'http://evil.example', 'Content-Type': 'application/json' }))).status).toBe(403);
    expect((await probe(mutating('http://localhost/api/paperseek/settings/connections/a/test', undefined, { Origin: 'http://evil.example' }), { params: { id: 'a' } })).status).toBe(403);
    expect((await create(mutating('http://localhost/api/paperseek/settings/connections', '{}', { Origin: 'http://localhost', 'Content-Type': 'text/plain' }))).status).toBe(415);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    ['http://localhost:3000', '127.0.0.1:3000', 'http://127.0.0.1:3000'],
    ['http://127.0.0.1:3000', 'localhost:3000', 'http://localhost:3000'],
    ['http://localhost:3000', '[::1]:3000', 'http://[::1]:3000'],
    ['http://localhost', 'LOCALHOST:80', 'http://localhost'],
  ])('accepts browser-facing loopback origin %s with Host %s and Origin %s', async (internalUrl, Host, Origin) => {
    setup({ ok: true, code: '', latency_ms: 12 });
    const request = mutating(`${internalUrl}/api/paperseek/settings/connections/a/test`, undefined, { Host, Origin });
    expect((await probe(request, { params: { id: 'a' } })).status).toBe(200);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it.each(['evil.example:3000', 'localhost.evil.example:3000', '192.168.1.10:3000', '[::2]:3000'])(
    'blocks writes and probes when non-loopback Host and Origin match for %s', async (Host) => {
      setup({});
      const headers = { Host, Origin: `http://${Host}` };
      expect((await create(mutating('http://localhost:3000/api/paperseek/settings/connections', '{}', { ...headers, 'Content-Type': 'application/json' }))).status).toBe(403);
      expect((await probe(mutating('http://localhost:3000/api/paperseek/settings/connections/a/test', undefined, headers), { params: { id: 'a' } })).status).toBe(403);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it('allows a safe read through a public Host while keeping writes loopback-only', async () => {
    setup({ connections: [], sources: [], defaults: { search_llm: '', review_llm: '', pre_ranking: 'local_fusion', embedding: '', reranker: '', decision: '', source: '' }, proxy: null });
    const response = await GET(new Request('http://localhost:3000/api/paperseek/settings', {
      headers: { Host: 'evil.example:3000' },
    }));
    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('allows a loopback settings read without an Origin header', async () => {
    setup({ connections: [], sources: [], defaults: { search_llm: '', review_llm: '', pre_ranking: 'local_fusion', embedding: '', reranker: '', decision: '', source: '' }, proxy: null });
    const response = await GET(new Request('http://localhost:3000/api/paperseek/settings', {
      headers: { Host: '[::1]:3000' },
    }));
    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it.each(['https://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'])('requires the exact scheme, port and host of the browser Origin %s', async (Origin) => {
    setup({});
    const request = mutating('http://localhost:3000/api/paperseek/settings/connections/a/test', undefined, { Host: 'localhost:3000', Origin });
    expect((await probe(request, { params: { id: 'a' } })).status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(['.', '..', 'a/SECRET', 'a\\SECRET', 'a/../SECRET'])('returns a sanitized 400 for invalid decoded path segment %s', async (id) => {
    setup({ ok: true, code: '', latency_ms: 12 });
    const request = mutating('http://localhost/api/paperseek/settings/connections/a/test', undefined, { Origin: 'http://localhost' });
    const response = await probe(request, { params: { id } });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { code: 'INVALID_REQUEST', message: 'PaperSeek settings request failed' } });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not forward a creation request without its required JSON body', async () => {
    setup({});
    const request = mutating('http://localhost/api/paperseek/settings/connections', undefined, { Origin: 'http://localhost' });
    expect((await create(request)).status).toBe(415);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('allows a bodyless probe when Next wraps the empty request in a stream', async () => {
    setup({ ok: true, code: '', latency_ms: 12 });
    const request = mutating('http://localhost/api/paperseek/settings/connections/a/test', '', { Origin: 'http://localhost' });
    expect((await probe(request, { params: { id: 'a' } })).status).toBe(200);
    expect(fetcher.mock.calls[0][1].body).toBeUndefined();
  });
  it('retains safe error code and status but never the upstream message', async () => {
    setup({ error: { code: 'connection_in_use', message: 'SECRET', details: bad } }, 409);
    const response = await defaults(new Request('http://localhost/api/paperseek/settings/defaults', { method: 'PUT', headers: { Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: '{}' }));
    expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: { code: 'connection_in_use', message: 'PaperSeek settings request failed' } });
  });
  it('converts invalid 2xx JSON and non-JSON to stable 502 and keeps offline 503', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response('SECRET', { status: 200 }))));
    expect((await GET(new Request('http://localhost'))).status).toBe(502);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const response = await GET(new Request('http://localhost'));
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('PAPERSEEK_UNAVAILABLE');
  });
  it('preserves the installed API validation code', async () => {
    setup({ error: { code: 'invalid_request', message: 'SECRET' } }, 422);
    const request = mutating('http://localhost/api/paperseek/settings/connections', '{}', { Origin: 'http://localhost', 'Content-Type': 'application/json' });
    const response = await create(request);
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe('invalid_request');
  });
  it('returns a stable error for unexpected redirects and bodies on 204 routes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 304 })));
    expect((await GET(new Request('http://localhost'))).status).toBe(502);
    setup({ ok: true, code: '', latency_ms: null });
    const request = new Request('http://localhost/api/paperseek/settings/connections/a?replacement=b', { method: 'DELETE', headers: { Origin: 'http://localhost' } });
    expect((await remove(request, { params: { id: 'a' } })).status).toBe(502);
  });
});

it('validates each client response and strips nested unknown fields', async () => {
  const { testSource } = await import('./settings');
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(Response.json({ ok: true, latency_ms: null, code: '', extra: { api_key: 'SECRET' } }))));
  expect(JSON.stringify(await testSource('openalex'))).not.toContain('SECRET');
});

it('rejects malformed nested fields and overlong hints in every gateway shape', async () => {
  const baseTest = { status: 'untested', latency_ms: null, code: '', tested_at: null };
  const c = { id: 'x', kind: 'llm', provider: 'openai', api_type: '', base_url: '', model: '', has_key: true, key_hint: '1234', requires_key: true, test: baseTest, created_at: '', updated_at: '' };
  const source = { id: 'pubmed', has_key: false, key_origin: '', key_hint: '', usable: true, options: { pubmed_email: '' }, test: baseTest };
  const d = { search_llm: '', review_llm: '', pre_ranking: 'local_fusion', embedding: '', reranker: '', decision: '', source: '' };
  const proxy = { origin: '', hosts: [], scope: [] };
  const cases = [
    { connections: [{ ...c, model: bad }], sources: [source], defaults: d, proxy },
    { connections: [c], sources: [{ ...source, options: { pubmed_email: bad } }], defaults: d, proxy },
    { connections: [c], sources: [source], defaults: { ...d, source: bad }, proxy },
    { connections: [c], sources: [source], defaults: d, proxy: { ...proxy, hosts: [bad] } },
    { connections: [{ ...c, key_hint: '12345' }], sources: [source], defaults: d, proxy },
  ];
  for (const value of cases) {
    setup(value);
    const response = await GET(new Request('http://localhost/api/paperseek/settings'));
    expect(response.status).toBe(502); expect(await response.text()).not.toContain('SECRET');
  }
});

it('rejects unexpected empty successful responses', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  expect((await GET(new Request('http://localhost/api/paperseek/settings'))).status).toBe(502);
  expect((await probe(mutating('http://localhost/api/paperseek/settings/connections/a/test', undefined, { Origin: 'http://localhost' }), { params: { id: 'a' } })).status).toBe(502);
});
