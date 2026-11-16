import { paperseekPath, paperseekRequest } from './server';
import { defaultsSchema, probeSchema, proxySchema, safeConnection, safeWorkspace, withoutEmptyKey } from './settings';

const errorCodes = new Set([
  'connection_in_use', 'connection_not_found', 'connection_kind_mismatch', 'connection_key_required',
  'connection_replacement_invalid', 'connection_provider_unsupported', 'connection_api_type_unsupported',
  'connection_base_url_invalid', 'connection_model_required', 'source_unavailable', 'source_not_found',
  'source_key_not_supported', 'source_option_unsupported', 'proxy_set_by_environment', 'proxy_url_invalid',
  'invalid_request', 'PAPERSEEK_UNAVAILABLE',
]);
const headers = { 'Cache-Control': 'no-store' };
const error = (status: number, code: string) => Response.json({ error: { code, message: 'PaperSeek settings request failed' } }, { status, headers });
export async function settingsGateway(request: Request, segments: string[], shape: 'workspace' | 'connection' | 'other' = 'other', omitBlankKey = false) {
  const url = new URL(request.url);
  if (request.method !== 'GET') {
    const origin = request.headers.get('origin');
    // Next may build request.url with its internal listening hostname.
    const host = request.headers.get('host') ?? url.host;
    if (origin !== `${url.protocol}//${host}`) return error(403, 'FORBIDDEN_ORIGIN');
  }
  let body: string | undefined;
  if (request.method === 'PUT' || (request.method === 'POST' && segments.length < 3)) {
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) return error(415, 'JSON_REQUIRED');
    try {
      const input = await request.json();
      body = JSON.stringify(omitBlankKey ? withoutEmptyKey(input) : input);
    } catch { return error(400, 'INVALID_REQUEST'); }
  }
  const query = request.method === 'DELETE' ? url.searchParams.get('replacement') : null;
  const path = paperseekPath('settings', ...segments) + (query ? `?${new URLSearchParams({ replacement: query })}` : '');
  const upstream = await paperseekRequest(request, path, { method: request.method, ...(body !== undefined ? { body, headers: { 'content-type': 'application/json' } } : {}) });
  if (!upstream.ok) {
    if (upstream.status < 400) return error(502, 'INVALID_UPSTREAM_RESPONSE');
    const data = await upstream.json().catch(() => null);
    const code = data?.error?.code;
    return error(upstream.status, typeof code === 'string' && errorCodes.has(code) ? code : 'PAPERSEEK_ERROR');
  }
  const expectsNoContent = request.method === 'DELETE' || (request.method === 'PUT' && segments[0] === 'sources');
  if (expectsNoContent && upstream.status === 204) return new Response(null, { status: 204, headers });
  if (expectsNoContent || upstream.status === 204 || upstream.status === 205) return error(502, 'INVALID_UPSTREAM_RESPONSE');
  try {
    const data: unknown = await upstream.json();
    const allowed = shape === 'workspace' ? safeWorkspace(data) : shape === 'connection' ? safeConnection(data) : segments[0] === 'defaults' ? defaultsSchema.parse(data) : segments[0] === 'proxy' ? proxySchema.parse(data) : probeSchema.parse(data);
    return Response.json(allowed, { status: upstream.status, headers });
  } catch { return error(502, 'INVALID_UPSTREAM_RESPONSE'); }
}
