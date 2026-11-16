import { settingsGateway } from '@/lib/paperseek/settings-server';
export const PUT = (request: Request, { params }: { params: { id: string } }) => settingsGateway(request, ['sources', params.id], 'other', true);
