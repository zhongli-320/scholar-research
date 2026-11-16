import { settingsGateway } from '@/lib/paperseek/settings-server';
export const POST = (request: Request) => settingsGateway(request, ['connections', 'test'], 'other', true);
