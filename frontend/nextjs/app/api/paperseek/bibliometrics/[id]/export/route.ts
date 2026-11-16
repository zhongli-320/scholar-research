import { paperseekPath, paperseekRequest } from '@/lib/paperseek/server';
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const input = new URL(request.url).searchParams; const query = new URLSearchParams();
  for (const value of input.getAll('format')) query.append('format', value);
  return paperseekRequest(request, paperseekPath('bibliometrics', params.id, 'export') + (query.size ? `?${query}` : ''));
}
