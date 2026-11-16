import { afterEach, expect, it, vi } from 'vitest';
import { buildNetwork, createAnalysis, deleteAnalysis, renameAnalysis } from './client';
import { layoutNetwork } from './network';
import type { PaperSeekMetricNetwork } from './types';

afterEach(() => vi.unstubAllGlobals());
const network = { nodes: [], edges: [] } as unknown as PaperSeekMetricNetwork;
it('creates an analysis with only its source and title and an idempotency key', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ id: 'a' }, { status: 201 }));
  vi.stubGlobal('fetch', fetcher); vi.stubGlobal('crypto', { randomUUID: () => 'key' });
  await createAnalysis({ source_run_id: 'run', title: 'title', extra: 'ignored' } as never);
  expect(fetcher).toHaveBeenCalledWith('/api/paperseek/bibliometrics', expect.objectContaining({ method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'key' }, body: '{"source_run_id":"run","title":"title"}' }));
});
it('does not send a blank rename and accepts only 204 for deletion', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 202 })); vi.stubGlobal('fetch', fetcher);
  await expect(renameAnalysis('a', '  ')).rejects.toThrow(); expect(fetcher).not.toHaveBeenCalled();
  await expect(deleteAnalysis('a')).rejects.toThrow();
});
it('uses PaperSeek network defaults', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json(network)); vi.stubGlobal('fetch', fetcher);
  await buildNetwork('a');
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ kind: 'keywords', min_occurrences: 2, max_nodes: 100, max_edges: 500 });
});
it('layouts empty, isolated and unknown endpoints with finite coordinates', () => {
  expect(layoutNetwork(network, 500, 300).nodes).toEqual([]);
  const result = layoutNetwork({ ...network, nodes: [{ id: 'n', label: 'N', count: 2 }], edges: [{ source: 'n', target: 'missing', weight: 1, similarity: 1 }] }, 500, 300);
  expect(result.nodes[0]).toMatchObject({ id: 'n' });
  expect(Number.isFinite(result.nodes[0].x) && Number.isFinite(result.nodes[0].y)).toBe(true);
  expect(result.edges[0]).toMatchObject({ source: 'n', target: 'missing' });
});

it('forwards a supplied retry key without adding it to the body', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ id: 'a' }, { status: 201 })); vi.stubGlobal('fetch', fetcher);
  await createAnalysis({ source_run_id: 'r', title: 't' }, 'reused-key');
  const request = fetcher.mock.calls[0][1];
  expect(request.headers['Idempotency-Key']).toBe('reused-key');
  expect(JSON.parse(request.body)).toEqual({ source_run_id: 'r', title: 't' });
});
