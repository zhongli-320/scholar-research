import { settingsGateway } from '@/lib/paperseek/settings-server';
export const PUT = (request: Request) => settingsGateway(request, ['proxy']);
