import { paperseekPath, paperseekRequest } from '@/lib/paperseek/server';

type Context = { params: { id: string } };
export async function PATCH(request: Request, { params }: Context) {
  return paperseekRequest(request, paperseekPath('history', params.id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: await request.text() });
}
export async function DELETE(request: Request, { params }: Context) {
  return paperseekRequest(request, paperseekPath('history', params.id), { method: 'DELETE' });
}
