import { paperseekPath, paperseekRequest } from '@/lib/paperseek/server';
export async function POST(request: Request, { params }: { params: { id: string } }) {
  return paperseekRequest(request, paperseekPath('runs', params.id, 'cancel'), { method: 'POST' });
}
