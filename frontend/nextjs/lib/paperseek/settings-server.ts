import { paperseekPath, paperseekRequest } from './server';
import { safeConnection, safeWorkspace, withoutEmptyKey } from './settings';

export async function settingsGateway(request: Request, segments: string[], shape: 'workspace' | 'connection' | 'other' = 'other', omitBlankKey = false) {
  let body: string | undefined;
  if (request.method === 'PUT' || (request.method === 'POST' && request.body)) {
    try {
      const input = await request.json();
      body = JSON.stringify(omitBlankKey ? withoutEmptyKey(input) : input);
    } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  }
  const query = request.method === 'DELETE' ? new URL(request.url).searchParams.get('replacement') : null;
  const path = paperseekPath('settings', ...segments) + (query ? `?${new URLSearchParams({ replacement: query })}` : '');
  const upstream = await paperseekRequest(request, path, { method: request.method, ...(body !== undefined ? { body, headers: { 'content-type': 'application/json' } } : {}) });
  if (!upstream.ok) return Response.json({ error: 'PaperSeek settings request failed' }, { status: upstream.status });
  if (upstream.status === 204) return new Response(null, { status: 204 });
  const data = await upstream.json();
  const allowed = shape === 'workspace' ? safeWorkspace(data) : shape === 'connection' ? safeConnection(data) : Object.fromEntries(Object.entries(data).filter(([key]) => ['search_llm','review_llm','pre_ranking','embedding','reranker','decision','source','origin','hosts','scope','ok','latency_ms','code'].includes(key)));
  return Response.json(allowed, { status: upstream.status, headers: { 'Cache-Control': 'no-store' } });
}
