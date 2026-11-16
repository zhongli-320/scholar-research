import { settingsGateway } from '@/lib/paperseek/settings-server';
export const POST = (request: Request, { params }: { params: { id: string } }) => settingsGateway(request, ['connections', params.id, 'test']);
