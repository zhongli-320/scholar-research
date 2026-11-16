import { afterEach, expect, it, vi } from 'vitest';
import { GET as list, POST as create } from '../../app/api/paperseek/bibliometrics/route';
import { DELETE, PATCH } from '../../app/api/paperseek/bibliometrics/[id]/route';
import { POST as network } from '../../app/api/paperseek/bibliometrics/[id]/network/route';
import { GET as exportFile } from '../../app/api/paperseek/bibliometrics/[id]/export/route';
afterEach(() => vi.unstubAllGlobals());
it('forwards allowed list parameters and the create idempotency key', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({})).mockResolvedValueOnce(Response.json({}, { status: 201 })); vi.stubGlobal('fetch', fetcher);
  await list(new Request('http://localhost/?q=abc&offset=2&limit=5&unexpected=x'));
  expect(fetcher.mock.calls[0][0]).toMatch(/bibliometrics\?q=abc&offset=2&limit=5$/);
  const response = await create(new Request('http://localhost/', { method: 'POST', headers: { 'Idempotency-Key': 'key' }, body: '{"source_run_id":"run","title":"t"}' }));
  expect(response.status).toBe(201); expect(new Headers(fetcher.mock.calls[1][1].headers).get('Idempotency-Key')).toBe('key');
});
it('encodes IDs and preserves 204 and download headers', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(Response.json({})).mockResolvedValueOnce(new Response('x', { headers: { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="bibliometrics.csv"' } })); vi.stubGlobal('fetch', fetcher);
  const context = { params: { id: 'a/b' } };
  expect((await PATCH(new Request('http://localhost/', { method: 'PATCH', body: '{"title":"t"}' }), context)).status).toBe(204);
  expect((await DELETE(new Request('http://localhost/', { method: 'DELETE' }), context)).status).toBe(204);
  await network(new Request('http://localhost/', { method: 'POST', body: '{"kind":"keywords"}' }), context);
  const result = await exportFile(new Request('http://localhost/?format=csv&unexpected=x'), context);
  expect(result.headers.get('content-disposition')).toContain('bibliometrics.csv');
  expect(fetcher.mock.calls.every((call) => String(call[0]).includes('a%2Fb'))).toBe(true);
  expect(fetcher.mock.calls[3][0]).toMatch(/export\?format=csv$/);
});
