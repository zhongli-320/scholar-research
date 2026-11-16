import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestUpstream = vi.fn().mockResolvedValue(new Response('ok'));
vi.mock('./server', () => ({ paperseekRequest: (...args: unknown[]) => requestUpstream(...args) }));
import { GET } from '@/app/api/paperseek/history/route';
import { POST } from '@/app/api/paperseek/runs/route';

beforeEach(() => requestUpstream.mockClear());
describe('explicit PaperSeek routes', () => {
  it('forwards only supported history parameters', async () => {
    const request = new Request('http://localhost/api/paperseek/history?page_size=1&query=a%20b&cursor=c&other=secret');
    await GET(request);
    expect(requestUpstream).toHaveBeenCalledWith(request, '/api/v1/history?cursor=c&page_size=1&query=a+b');
  });
  it('forwards the run body using the shared helper', async () => {
    const request = new Request('http://localhost/api/paperseek/runs', { method: 'POST', headers: { 'Idempotency-Key': 'key' }, body: '{"question":"test"}' });
    await POST(request);
    expect(requestUpstream).toHaveBeenCalledWith(request, '/api/v1/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"question":"test"}' });
  });
});
