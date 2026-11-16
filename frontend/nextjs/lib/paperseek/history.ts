import { PaperSeekApiError } from './client';
import type { PaperSeekHistoryItem } from './types';

export function latestSearch(items: PaperSeekHistoryItem[]): PaperSeekHistoryItem | null {
  return items.reduce<PaperSeekHistoryItem | null>((latest, item) => {
    if (item.kind && item.kind !== 'research') return latest;
    if (!latest) return item;
    const difference = Date.parse(item.created_at) - Date.parse(latest.created_at);
    if (difference !== 0) return difference > 0 ? item : latest;
    const fraction = (value: string) => value.match(/\.(\d+)(?:Z|[+-]\d\d:?\d\d)?$/i)?.[1] ?? '';
    const a = fraction(item.created_at); const b = fraction(latest.created_at);
    const length = Math.max(a.length, b.length);
    return a.padEnd(length, '0') > b.padEnd(length, '0') ? item : latest;
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
