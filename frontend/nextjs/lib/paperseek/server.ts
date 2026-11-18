import {
  attachDeviceCookie,
  claimResource,
  ownedResourceIds,
  ownsResource,
  paperseekDevice,
  PaperSeekResourceKind,
  releaseResource,
} from './ownership';

export function paperseekPath(...segments: string[]): string {
  if (segments.some((segment) => segment === '.' || segment === '..' || /^[a-z][a-z\d+.-]*:\/\//i.test(segment))) {
    throw new Error('Invalid PaperSeek path segment');
  }
  return `/api/v1/${segments.map(encodeURIComponent).join('/')}`;
}

export async function paperseekRequest(request: Request, path: string, init: RequestInit = {}): Promise<Response> {
  const pathname = path.split('?')[0];
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    throw new Error('Invalid PaperSeek path');
  }
  if (!(pathname === '/ready' || pathname.startsWith('/api/v1/')) ||
      /[\x00-\x20\x7f\\#]/.test(path) || decoded.includes('\\') || decoded.split('/').some((segment) => segment === '.' || segment === '..')) {
    throw new Error('Invalid PaperSeek path');
  }

  const device = paperseekDevice(request);
  const method = (init.method || request.method || 'GET').toUpperCase();
  const segments = pathname.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment));
  const resource = resourceFromSegments(segments);
  if (resource && !(await ownsResource(device, resource.kind, resource.id))) {
    return attachDeviceCookie(Response.json({ error: { code: 'NOT_FOUND', message: 'Resource not found' } }, { status: 404 }), device);
  }
  if (device && method === 'GET' && pathname === '/api/v1/history') return ownedHistory(request, path, device);
  if (device && method === 'GET' && pathname === '/api/v1/bibliometrics') return ownedBibliometrics(request, path, device);
  if (device && method === 'POST' && pathname === '/api/v1/bibliometrics') {
    try {
      const sourceRunId = JSON.parse(String(init.body || '{}')).source_run_id;
      if (typeof sourceRunId !== 'string' || !(await ownsResource(device, 'run', sourceRunId))) {
        return attachDeviceCookie(Response.json({ error: { code: 'NOT_FOUND', message: 'Source run not found' } }, { status: 404 }), device);
      }
    } catch {
      return attachDeviceCookie(Response.json({ error: { code: 'INVALID_REQUEST', message: 'Invalid request' } }, { status: 400 }), device);
    }
  }
  if (publicCreateLimited(request, method, pathname)) {
    return attachDeviceCookie(Response.json({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }, { status: 429, headers: { 'retry-after': '3600' } }), device);
  }

  const headers = new Headers();
  for (const name of ['Idempotency-Key', 'Last-Event-ID']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const contentType = new Headers(init.headers).get('content-type');
  if (contentType) headers.set('content-type', contentType);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const base = (process.env.PAPERSEEK_API_URL || 'http://127.0.0.1:8767').replace(/\/+$/, '');
    const signal = init.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal;
    const upstream = await fetch(`${base}${path}`, { ...init, headers, signal, redirect: 'manual' });
    clearTimeout(timeout);
    const responseHeaders = new Headers();
    for (const name of ['content-type', 'content-disposition', 'cache-control', 'x-accel-buffering']) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    const response = new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
    if (device && upstream.ok && method === 'POST' && (pathname === '/api/v1/runs' || pathname === '/api/v1/bibliometrics')) {
      const body = await response.clone().json().catch(() => null) as { id?: unknown } | null;
      if (typeof body?.id === 'string') await claimResource(device, pathname.endsWith('/runs') ? 'run' : 'analysis', body.id);
    }
    if (device && upstream.ok && method === 'DELETE' && resource) await releaseResource(device, resource.kind, resource.id);
    return attachDeviceCookie(response, device);
  } catch {
    return attachDeviceCookie(Response.json({ error: { code: 'PAPERSEEK_UNAVAILABLE', message: 'PaperSeek is unavailable' } }, { status: 503 }), device);
  } finally {
    clearTimeout(timeout);
  }
}

function resourceFromSegments(segments: string[]): { kind: PaperSeekResourceKind; id: string } | null {
  if (segments[0] !== 'api' || segments[1] !== 'v1' || !segments[3]) return null;
  if (segments[2] === 'runs' || segments[2] === 'history') return { kind: 'run', id: segments[3] };
  if (segments[2] === 'bibliometrics') return { kind: 'analysis', id: segments[3] };
  return null;
}

async function rawPaperseekFetch(path: string): Promise<Response> {
  const base = (process.env.PAPERSEEK_API_URL || 'http://127.0.0.1:8767').replace(/\/+$/, '');
  return fetch(`${base}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) });
}

async function ownedHistory(request: Request, path: string, device: NonNullable<ReturnType<typeof paperseekDevice>>): Promise<Response> {
  const owned = await ownedResourceIds(device, 'run');
  const input = new URL(`http://paperseek.local${path}`).searchParams;
  const pageSize = Math.min(100, Math.max(1, Number(input.get('page_size')) || 20));
  const offset = Math.max(0, Number(input.get('cursor')) || 0);
  const items: unknown[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 100; page += 1) {
    const query = new URLSearchParams({ page_size: '100' });
    if (input.get('query')) query.set('query', input.get('query')!);
    if (cursor) query.set('cursor', cursor);
    const upstream = await rawPaperseekFetch(`/api/v1/history?${query}`);
    if (!upstream.ok) return attachDeviceCookie(upstream, device);
    const data = await upstream.json() as { items?: Array<{ id?: string }>; next_cursor?: string | null };
    for (const item of data.items || []) if (item.id && owned?.has(item.id)) items.push(item);
    cursor = data.next_cursor || null;
    if (!cursor) break;
  }
  const next = offset + pageSize < items.length ? String(offset + pageSize) : null;
  return attachDeviceCookie(Response.json({ items: items.slice(offset, offset + pageSize), next_cursor: next, matched_count: items.length }), device);
}

async function ownedBibliometrics(request: Request, path: string, device: NonNullable<ReturnType<typeof paperseekDevice>>): Promise<Response> {
  const owned = await ownedResourceIds(device, 'analysis');
  const input = new URL(`http://paperseek.local${path}`).searchParams;
  const requestedOffset = Math.max(0, Number(input.get('offset')) || 0);
  const requestedLimit = Math.min(100, Math.max(1, Number(input.get('limit')) || 20));
  const items: unknown[] = [];
  let upstreamOffset = 0;
  for (let page = 0; page < 100; page += 1) {
    const query = new URLSearchParams({ offset: String(upstreamOffset), limit: '100' });
    if (input.get('q')) query.set('q', input.get('q')!);
    const upstream = await rawPaperseekFetch(`/api/v1/bibliometrics?${query}`);
    if (!upstream.ok) return attachDeviceCookie(upstream, device);
    const data = await upstream.json() as { items?: Array<{ id?: string }>; next_offset?: number | null };
    for (const item of data.items || []) if (item.id && owned?.has(item.id)) items.push(item);
    if (data.next_offset === null || data.next_offset === undefined) break;
    upstreamOffset = data.next_offset;
  }
  const next = requestedOffset + requestedLimit < items.length ? requestedOffset + requestedLimit : null;
  return attachDeviceCookie(Response.json({ items: items.slice(requestedOffset, requestedOffset + requestedLimit), total_count: items.length, next_offset: next }), device);
}

const createWindows = new Map<string, { startedAt: number; count: number }>();
function publicCreateLimited(request: Request, method: string, pathname: string): boolean {
  if (process.env.PAPERSEEK_PUBLIC_MODE !== 'true' || method !== 'POST' || !['/api/v1/runs', '/api/v1/bibliometrics'].includes(pathname)) return false;
  const limit = Math.max(1, Number(process.env.PAPERSEEK_CREATE_LIMIT_PER_HOUR) || 10);
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
  const now = Date.now();
  const current = createWindows.get(ip);
  if (!current || now - current.startedAt >= 3_600_000) {
    createWindows.set(ip, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > limit;
}
