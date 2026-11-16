import { afterEach, describe, expect, it, vi } from 'vitest';
import { paperseekPath, paperseekRequest } from './server';

afterEach(() => {
  vi.useRealTimers();
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
    for (const path of ['https://evil.example', '../settings', '/api/v1/../settings', '/api/v1/%2e%2e/settings', '/api/v1/%5c..%5csettings', '/api/v1/\n../settings', '/api/v1/.. ', '/other']) {
      await expect(paperseekRequest(new Request('http://localhost'), path)).rejects.toThrow();
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(() => paperseekPath('https://evil.example')).toThrow();
    expect(() => paperseekPath('..')).toThrow();
  });

  it('encodes dynamic path segments and accepts encoded spaces', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetch);
    const path = paperseekPath('runs', 'id/with space');
    expect(path).toBe('/api/v1/runs/id%2Fwith%20space');
    expect((await paperseekRequest(new Request('http://localhost'), path)).status).toBe(200);
  });

  it('returns a stable 503 when the service cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('secret detail')));
    const response = await paperseekRequest(new Request('http://localhost'), '/ready');
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('secret detail');
  });

  it('times out before response headers without exposing the failure', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new Error('timeout detail')));
    })));
    let settled = false;
    const pending = paperseekRequest(new Request('http://localhost'), '/ready').then((response) => { settled = true; return response; });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(settled).toBe(true);
    const response = await pending;
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('timeout detail');
  });

  it('keeps the response stream alive after headers arrive', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal;
    vi.stubGlobal('fetch', vi.fn(async (_url, options: RequestInit) => {
      signal = options.signal!;
      return new Response(new ReadableStream({
        start(controller) {
          setTimeout(() => {
            if (signal.aborted) controller.error(new Error('aborted'));
            else { controller.enqueue(new TextEncoder().encode('later')); controller.close(); }
          }, 31_000);
        },
      }));
    }));
    const response = await paperseekRequest(new Request('http://localhost'), '/ready');
    const body = response.text();
    await vi.advanceTimersByTimeAsync(31_000);
    expect(await body).toBe('later');
    expect(signal!.aborted).toBe(false);
  });

  it('does not follow redirects even when the caller requests it', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 302 }));
    vi.stubGlobal('fetch', fetch);
    await paperseekRequest(new Request('http://localhost'), '/ready', { redirect: 'follow' });
    expect(fetch.mock.calls[0][1].redirect).toBe('manual');
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
