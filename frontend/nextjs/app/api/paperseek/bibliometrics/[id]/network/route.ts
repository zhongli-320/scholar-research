import { paperseekPath, paperseekRequest } from '@/lib/paperseek/server';
export async function POST(request: Request, { params }: { params: { id: string } }) {
  return paperseekRequest(request, paperseekPath('bibliometrics', params.id, 'network'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: await request.text() });
}
