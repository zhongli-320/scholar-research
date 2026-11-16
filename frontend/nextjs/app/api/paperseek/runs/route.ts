import { paperseekRequest } from '@/lib/paperseek/server';

export async function POST(request: Request) {
  return paperseekRequest(request, '/api/v1/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: await request.text() });
}
