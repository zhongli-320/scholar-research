import { afterEach, describe, expect, it, vi } from 'vitest';
import { paperseekPath, paperseekRequest } from './server';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('PaperSeek gateway', () => {
  it('uses the default address and removes trailing slashes from an override', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetch);
    vi.stubEnv('PAPERSEEK_API_URL', '');
    await paperseekRequest(new Request('http://localhost'), '/ready');
    expect(fetch.mock.calls[0][0]).toBe('http://127.0.0.1:8767/ready');
    vi.stubEnv('PAPERSEEK_API_URL', 'http://127.0.0.1:1234///');
    await paperseekRequest(new Request('http://localhost'), '/api/v1/sources');
    expect(fetch.mock.calls[1][0]).toBe('http://127.0.0.1:1234/api/v1/sources');
  });

  it('rejects external URLs and traversal paths before fetching', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    for (const path of ['https://evil.example', '../settings', '/api/v1/../settings', '/api/v1/%2e%2e/settings', '/api/v1/%5c..%5csettings', '/other']) {
      await expect(paperseekRequest(new Request('http://localhost'), path)).rejects.toThrow();
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(() => paperseekPath('https://evil.example')).toThrow();
    expect(() => paperseekPath('..')).toThrow();
  });

  it('encodes dynamic path segments', () => {
    expect(paperseekPath('runs', 'id/with space')).toBe('/api/v1/runs/id%2Fwith%20space');
  });

  it('returns a stable 503 when the service cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('secret detail')));
    const response = await paperseekRequest(new Request('http://localhost'), '/ready');
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('secret detail');
  });

  it('preserves upstream status, body and content headers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('missing', {
      status: 404,
      headers: { 'content-type': 'text/plain', 'content-disposition': 'attachment; filename="x.txt"', 'x-private': 'hidden' },
    })));
    const response = await paperseekRequest(new Request('http://localhost'), '/api/v1/sources');
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toBe('text/plain');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="x.txt"');
    expect(response.headers.has('x-private')).toBe(false);
    expect(await response.text()).toBe('missing');
  });

  it('forwards only allowed request headers', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetch);
    const request = new Request('http://localhost', { headers: {
      'Idempotency-Key': 'key', 'Last-Event-ID': '42', 'Authorization': 'secret', 'Cookie': 'secret',
    } });
    await paperseekRequest(request, '/ready');
    const headers = new Headers(fetch.mock.calls[0][1].headers);
    expect(Array.from(headers.entries())).toEqual([['idempotency-key', 'key'], ['last-event-id', '42']]);
  });
});
