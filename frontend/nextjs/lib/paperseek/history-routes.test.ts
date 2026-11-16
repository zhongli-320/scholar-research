import { afterEach, expect, it, vi } from 'vitest';
import { DELETE, PATCH } from '../../app/api/paperseek/history/[id]/route';
afterEach(() => vi.unstubAllGlobals());
it('forwards a single encoded history id for rename and deletion', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(Response.json({ status: 'accepted' }, { status: 202 }));
  vi.stubGlobal('fetch', fetcher);
  const context = { params: { id: 'one/two' } };
  expect((await PATCH(new Request('http://localhost', { method: 'PATCH', body: '{"title":"New"}' }), context)).status).toBe(204);
  expect((await DELETE(new Request('http://localhost', { method: 'DELETE' }), context)).status).toBe(202);
  expect(fetcher.mock.calls[0][0]).toMatch(/\/api\/v1\/history\/one%2Ftwo$/);
  expect(fetcher.mock.calls[1][0]).toMatch(/\/api\/v1\/history\/one%2Ftwo$/);
});
