import { paperseekRequest } from '@/lib/paperseek/server';

export async function GET(request: Request) {
  const input = new URL(request.url).searchParams;
  const query = new URLSearchParams();
  for (const name of ['cursor', 'page_size', 'query']) {
    for (const value of input.getAll(name)) query.append(name, value);
  }
  const suffix = query.toString();
  return paperseekRequest(request, `/api/v1/history${suffix ? `?${suffix}` : ''}`);
}
