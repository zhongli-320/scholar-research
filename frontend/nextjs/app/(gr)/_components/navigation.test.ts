import { describe, expect, it } from 'vitest';
import { MAIN_NAV_ITEMS, HISTORY_NAV_ITEMS, SETTINGS_HREF } from './navigation';

describe('workbench navigation', () => {
  it('lists the main tasks in order', () => {
    expect(MAIN_NAV_ITEMS).toEqual([
      { label: '文献检索', href: '/' },
      { label: '文献计量', href: '/bibliometrics' },
      { label: '一键写综述', href: '/reviews/new' },
    ]);
  });

  it('provides separate histories and settings', () => {
    expect(HISTORY_NAV_ITEMS).toEqual([
      { label: '检索历史', href: '/history/searches' },
      { label: '综述历史', href: '/history/reviews' },
    ]);
    expect(SETTINGS_HREF).toBe('/settings');
  });
});
