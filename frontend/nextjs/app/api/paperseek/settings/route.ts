import { settingsGateway } from '@/lib/paperseek/settings-server';
export const GET = (request: Request) => settingsGateway(request, [], 'workspace');
