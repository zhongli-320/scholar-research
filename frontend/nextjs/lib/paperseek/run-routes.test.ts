import { afterEach, expect, it, vi } from 'vitest';
import { GET as getRun } from '../../app/api/paperseek/runs/[id]/route';
import { GET as events } from '../../app/api/paperseek/runs/[id]/events/route';
import { GET as artifact } from '../../app/api/paperseek/runs/[id]/artifacts/[artifactId]/route';

afterEach(() => vi.unstubAllGlobals());
it('refresh only reads the encoded existing run', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetch);
  await getRun(new Request('http://localhost'), { params: { id: 'a/b' } });
  expect(fetch.mock.calls[0][0]).toBe('http://127.0.0.1:8767/api/v1/runs/a%2Fb');
  expect(fetch.mock.calls[0][1].method ?? 'GET').toBe('GET');
});
it('forwards SSE cursor and streams the unbuffered response', async () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({ start(c) { controller = c; } });
  const fetch = vi.fn().mockResolvedValue(new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', 'x-accel-buffering': 'no' } }));
  vi.stubGlobal('fetch', fetch);
  const response = await events(new Request('http://localhost', { headers: { 'Last-Event-ID': '42' } }), { params: { id: 'a/b' } });
  expect(fetch.mock.calls[0][0]).toBe('http://127.0.0.1:8767/api/v1/runs/a%2Fb/events');
  expect(new Headers(fetch.mock.calls[0][1].headers).get('Last-Event-ID')).toBe('42');
  expect(response.headers.get('content-type')).toBe('text/event-stream');
  expect(response.headers.get('cache-control')).toBe('no-cache');
  expect(response.headers.get('x-accel-buffering')).toBe('no');
  const reader = response.body!.getReader();
  controller.enqueue(new TextEncoder().encode('live'));
  expect(new TextDecoder().decode((await reader.read()).value)).toBe('live');
  controller.close();
});
it('encodes artifact and run segments and preserves download headers', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('file', { headers: { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="x.csv"' } }));
  vi.stubGlobal('fetch', fetch);
  const response = await artifact(new Request('http://localhost'), { params: { id: 'a/b', artifactId: 'c/d' } });
  expect(fetch.mock.calls[0][0]).toBe('http://127.0.0.1:8767/api/v1/runs/a%2Fb/artifacts/c%2Fd');
  expect(response.headers.get('content-disposition')).toBe('attachment; filename="x.csv"');
  expect(await response.text()).toBe('file');
});
it('aborts the upstream event request when the browser disconnects', async () => {
  const aborter = new AbortController();
  let signal!: AbortSignal;
  vi.stubGlobal('fetch', vi.fn(async (_url, options: RequestInit) => { signal = options.signal!; return new Response(''); }));
  await events(new Request('http://localhost', { signal: aborter.signal }), { params: { id: 'run' } });
  aborter.abort();
  expect(signal.aborted).toBe(true);
});
