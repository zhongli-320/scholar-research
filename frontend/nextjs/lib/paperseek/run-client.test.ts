import { afterEach, expect, it, vi } from 'vitest';
import { cancelRun, exportSelected, getResults, getRun } from './client';
afterEach(() => vi.unstubAllGlobals());
it('loads a run without posting and encodes every filter', async () => {
  const fetcher = vi.fn().mockImplementation(async () => Response.json({})); vi.stubGlobal('fetch', fetcher);
  await getRun('a/b');
  await getResults('a/b', { cursor: 'a+b', page_size: 5, query: 'robot topic', min_score: 0, metadata: 'doi', sort: 'score', journal: 'cas1', acceptance: 'oral' });
  expect(fetcher.mock.calls[0][0]).toBe('/api/paperseek/runs/a%2Fb');
  expect(fetcher.mock.calls[0][1].method ?? 'GET').toBe('GET');
  expect(fetcher.mock.calls[1][0]).toBe('/api/paperseek/runs/a%2Fb/results?cursor=a%2Bb&page_size=5&query=robot+topic&min_score=0&metadata=doi&sort=score&journal=cas1&acceptance=oral');
});
it('cancels only the specified run and posts selected export with format and IDs', async () => {
  const fetcher = vi.fn().mockImplementation(async () => Response.json({})); vi.stubGlobal('fetch', fetcher);
  await cancelRun('a/b'); await exportSelected('a/b', 'ris', ['one', 'two']);
  expect(fetcher.mock.calls[0]).toEqual(['/api/paperseek/runs/a%2Fb/cancel', { method: 'POST' }]);
  expect(fetcher.mock.calls[1][0]).toBe('/api/paperseek/runs/a%2Fb/export-selected');
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ format: 'ris', uids: ['one', 'two'] });
});
