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
    for (const name of ['content-type', 'content-disposition']) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
  } catch {
    return Response.json({ error: { code: 'PAPERSEEK_UNAVAILABLE', message: 'PaperSeek is unavailable' } }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}
