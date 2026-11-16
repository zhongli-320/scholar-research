import { paperseekRequest } from '@/lib/paperseek/server';

export function GET(request: Request) {
  return paperseekRequest(request, '/api/v1/sources');
}
