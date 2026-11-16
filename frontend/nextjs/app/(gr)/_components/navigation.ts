export const MAIN_NAV_ITEMS = [
  { label: '文献检索', href: '/' },
  { label: '文献计量', href: '/bibliometrics' },
  { label: '一键写综述', href: '/reviews/new' },
];
export const HISTORY_NAV_ITEMS = [
  { label: '检索历史', href: '/history/searches' },
  { label: '综述历史', href: '/history/reviews' },
];
export const SETTINGS_HREF = '/settings';

export function closeMenuDetails(link: HTMLElement) {
  let details = link.closest('details');
  while (details) {
    details.open = false;
    details = details.parentElement?.closest('details') ?? null;
  }
}
