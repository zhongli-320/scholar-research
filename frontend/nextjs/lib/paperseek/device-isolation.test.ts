import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { POST as createRun } from '@/app/api/paperseek/runs/route';
import { GET as getRun } from '@/app/api/paperseek/runs/[id]/route';
import { GET as history } from '@/app/api/paperseek/history/route';

const ownershipFile = join(tmpdir(), `scholar-ownership-${process.pid}-${Math.random().toString(36).slice(2)}.json`);

beforeEach(() => {
  vi.stubEnv('PAPERSEEK_DEVICE_ISOLATION', 'true');
  vi.stubEnv('PAPERSEEK_DEVICE_SECRET', 'test-secret-with-enough-entropy');
  vi.stubEnv('PAPERSEEK_OWNERSHIP_FILE', ownershipFile);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await rm(ownershipFile, { force: true });
});

it('records a created run and only exposes it to the same anonymous device', async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(Response.json({ id: 'run-a', question: 'A' }, { status: 201 }))
    .mockResolvedValueOnce(Response.json({ id: 'run-a', question: 'A' }))
    .mockResolvedValueOnce(Response.json({
      items: [{ id: 'run-b', question: 'B' }, { id: 'run-a', question: 'A' }],
      next_cursor: null,
      matched_count: 2,
    }));
  vi.stubGlobal('fetch', fetcher);

  const created = await createRun(new Request('http://localhost/api/paperseek/runs', { method: 'POST', body: '{}' }));
  const cookie = created.headers.get('set-cookie')!.split(';', 1)[0];
  expect(created.status).toBe(201);

  const owned = await getRun(new Request('http://localhost/api/paperseek/runs/run-a', { headers: { cookie } }), { params: { id: 'run-a' } });
  expect(owned.status).toBe(200);

  const page = await history(new Request('http://localhost/api/paperseek/history?page_size=20', { headers: { cookie } }));
  expect(await page.json()).toMatchObject({ items: [{ id: 'run-a' }], matched_count: 1, next_cursor: null });

  const foreign = await getRun(new Request('http://localhost/api/paperseek/runs/run-a'), { params: { id: 'run-a' } });
  expect(foreign.status).toBe(404);
  expect(fetcher).toHaveBeenCalledTimes(3);
});
