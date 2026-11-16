import { afterEach, expect, it, vi } from 'vitest';
import { deleteSearch, latestSearch, renameSearch } from './history';

afterEach(() => vi.unstubAllGlobals());

const item = (id: string, created_at: string, kind?: string) => ({ id, created_at, kind, question: id, display_title: id, source: 'openalex', status: 'completed', result_count: 1 });

it('selects the newest research record, preserving input order on ties', () => {
  const first = item('first', '2026-01-02T00:00:00Z', 'research');
  expect(latestSearch([])).toBeNull();
  expect(latestSearch([item('review', '2026-01-03T00:00:00Z', 'review')])).toBeNull();
  expect(latestSearch([item('old', '2026-01-01T00:00:00Z'), first, item('tie', '2026-01-02T00:00:00Z'), item('review', '2026-01-03T00:00:00Z', 'review')])).toBe(first);
});

it('does not send blank titles and encodes the id for rename', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetcher);
  await expect(renameSearch('a/b', '  ')).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
  await renameSearch('a/b', ' title ');
  expect(fetcher).toHaveBeenCalledWith('/api/paperseek/history/a%2Fb', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'title' }) });
});

it('accepts a 202 deletion receipt and encodes the id', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ status: 'accepted' }, { status: 202 }));
  vi.stubGlobal('fetch', fetcher);
  await expect(deleteSearch('a/b')).resolves.toBeUndefined();
  expect(fetcher).toHaveBeenCalledWith('/api/paperseek/history/a%2Fb', { method: 'DELETE' });
});
