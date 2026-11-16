import { paperseekRequest } from '@/lib/paperseek/server';
export async function GET(request: Request) {
  const input = new URL(request.url).searchParams; const query = new URLSearchParams();
  for (const name of ['q', 'offset', 'limit']) for (const value of input.getAll(name)) query.append(name, value);
  return paperseekRequest(request, `/api/v1/bibliometrics${query.size ? `?${query}` : ''}`);
}
export async function POST(request: Request) {
  return paperseekRequest(request, '/api/v1/bibliometrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: await request.text() });
}
