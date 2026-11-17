'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useBackend } from './backend';
import { useLinks } from './mode';
import { MAIN_NAV_ITEMS, HISTORY_NAV_ITEMS, SETTINGS_HREF, closeMenuDetails } from './navigation';

export const clock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const Eye = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <p className={`gr-eye ${className}`}>{children}</p>
);

export const Arrow = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className={className}>
    <path d="M2.5 8h11M9.5 4l4 4-4 4" />
  </svg>
);

const bare = (url: string) => url.replace(/^https?:\/\//, '');

/** Which Python backend this browser talks to; the address is changed in Settings. */
export function Connection() {
  const backend = useBackend();
  const mock = usePathname().startsWith('/mocks');
  const label = backend.status === 'online' ? bare(backend.host) : backend.status === 'offline' ? '离线' : '检查中';
  return (
    <Link
      href={mock ? '/mocks/settings?tab=gpt-researcher&section=backend' : '/settings?tab=gpt-researcher&section=backend'}
      aria-label={`后端：${label}`}
      className={`inline-flex h-8 items-center gap-2.5 font-code text-[11px] tracking-[0.06em] transition-colors ${
        backend.status === 'offline' ? 'text-rubric' : 'text-ink-3 hover:text-ink'
      }`}
    >
      <i
        className={`h-2 w-2 ${backend.status === 'online' ? 'bg-ink' : backend.status === 'offline' ? 'bg-rubric' : 'animate-[gr-blink_1s_steps(2,jump-none)_infinite] bg-ink-3'}`}
        aria-hidden="true"
      />
      <span>后端</span>
      <span className="underline decoration-rule underline-offset-4">{label}</span>
    </Link>
  );
}

export function TopBar() {
  const current = usePathname();
  const links = useLinks();
  const mock = current.startsWith('/mocks');
  const hrefFor = (href: string) => {
    if (!mock) return href;
    if (href === '/') return '/mocks/literature';
    if (href === '/bibliometrics') return '/mocks/bibliometrics';
    if (href === '/reviews/new') return links.reviewHome;
    if (href === '/settings') return '/mocks/settings';
    if (href === '/history/searches') return links.searchHistory;
    if (href === '/history/reviews') return links.reviewHistory;
    return href;
  };
  const itemLink = (item: { href: string; label: string }) => (
    <Link key={item.href} href={hrefFor(item.href)} onClick={(event) => closeMenuDetails(event.currentTarget)} aria-current={current === hrefFor(item.href) ? 'page' : undefined}
      className="transition-colors hover:text-ink aria-[current=page]:text-ink aria-[current=page]:underline aria-[current=page]:decoration-rubric aria-[current=page]:underline-offset-4">
      {item.label}
    </Link>
  );
  return (
    <header className="sticky top-0 z-40 grid h-16 grid-cols-[1fr_auto] items-center border-b border-rule-soft bg-paper/90 px-5 backdrop-blur md:grid-cols-[1fr_auto_1fr] md:px-8">
      <Link href={mock ? '/mocks/literature' : '/'} className="inline-flex items-center whitespace-nowrap text-[16px] font-semibold tracking-[-0.015em]">
        Scholar Research
      </Link>
      <nav className="hidden items-center gap-6 text-[14px] font-medium text-ink-2 md:flex" aria-label="主导航">
        {MAIN_NAV_ITEMS.map(itemLink)}
        <details className="relative">
          <summary className="cursor-pointer hover:text-ink">历史记录</summary>
          <div className="absolute right-0 top-full flex min-w-32 flex-col gap-4 border border-rule-soft bg-paper p-4 shadow-lg">
            {HISTORY_NAV_ITEMS.map(itemLink)}
          </div>
        </details>
        <Link href={hrefFor(SETTINGS_HREF)} className="hover:text-ink">设置</Link>
      </nav>
      <div className="flex items-center gap-5 justify-self-end">
        <details className="relative text-[14px] font-medium text-ink-2 md:hidden">
          <summary className="cursor-pointer">菜单</summary>
          <nav className="absolute right-0 top-full flex min-w-36 flex-col gap-4 border border-rule-soft bg-paper p-4 shadow-lg" aria-label="主导航">
            {MAIN_NAV_ITEMS.map(itemLink)}
            <details>
              <summary className="cursor-pointer hover:text-ink">历史记录</summary>
              <div className="mt-4 flex flex-col gap-4 pl-4">
                {HISTORY_NAV_ITEMS.map(itemLink)}
              </div>
            </details>
            <Link href={hrefFor(SETTINGS_HREF)} onClick={(event) => closeMenuDetails(event.currentTarget)}>设置</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
