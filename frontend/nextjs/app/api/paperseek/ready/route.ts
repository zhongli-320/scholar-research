import { paperseekRequest } from '@/lib/paperseek/server';

export function GET(request: Request) {
  return paperseekRequest(request, '/ready');
}
