import { settingsGateway } from '@/lib/paperseek/settings-server';
type Context = { params: { id: string } };
export const PUT = (request: Request, { params }: Context) => settingsGateway(request, ['connections', params.id], 'connection', true);
export const DELETE = (request: Request, { params }: Context) => settingsGateway(request, ['connections', params.id]);
