import { paperseekPath, paperseekRequest } from '@/lib/paperseek/server';
export async function GET(request: Request, { params }: { params: { id: string; artifactId: string } }) {
  return paperseekRequest(request, paperseekPath('runs', params.id, 'artifacts', params.artifactId));
}
