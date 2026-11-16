import { paperseekPath, paperseekRequest } from '@/lib/paperseek/server';
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const incoming = new URL(request.url).searchParams;
  const query = new URLSearchParams();
  for (const name of ['cursor', 'page_size', 'query', 'min_score', 'metadata', 'sort', 'journal', 'acceptance']) {
    for (const value of incoming.getAll(name)) query.append(name, value);
  }
  const suffix = query.toString();
  return paperseekRequest(request, paperseekPath('runs', params.id, 'results') + (suffix ? `?${suffix}` : ''));
}
