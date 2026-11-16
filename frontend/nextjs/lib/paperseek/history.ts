import { PaperSeekApiError } from './client';
import type { PaperSeekHistoryItem } from './types';

export function latestSearch(items: PaperSeekHistoryItem[]): PaperSeekHistoryItem | null {
  return items.reduce<PaperSeekHistoryItem | null>((latest, item) => {
    if (item.kind && item.kind !== 'research') return latest;
    return !latest || Date.parse(item.created_at) > Date.parse(latest.created_at) ? item : latest;
  }, null);
}

async function check(response: Response): Promise<void> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new PaperSeekApiError(body?.error?.code || 'PAPERSEEK_ERROR', body?.error?.message || 'PaperSeek 请求失败', response.status);
  }
}

export async function renameSearch(id: string, title: string): Promise<void> {
  if (!title.trim()) throw new Error('标题不能为空');
  await check(await fetch(`/api/paperseek/history/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim() }) }));
}

export async function deleteSearch(id: string): Promise<void> {
  await check(await fetch(`/api/paperseek/history/${encodeURIComponent(id)}`, { method: 'DELETE' }));
}
