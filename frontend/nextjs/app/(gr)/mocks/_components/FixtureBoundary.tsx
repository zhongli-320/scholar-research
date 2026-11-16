'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { mockResponse } from '../_data/fixtures';

export default function FixtureBoundary({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (!['/mocks/literature', '/mocks/results', '/mocks/search-history', '/mocks/bibliometrics', '/mocks/settings'].includes(path)) return <>{children}</>;
  return <FixtureGuard key={path}>{children}</FixtureGuard>;
}

function FixtureGuard({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = window.fetch;
    window.fetch = mockResponse;
    setReady(true);
    return () => { if (window.fetch === mockResponse) window.fetch = previous; };
  }, []);
  useEffect(() => {
    if (!ready || !container.current) return;
    const node = container.current;
    function containLinks() {
      node.querySelectorAll('a[href]').forEach((anchor) => {
        const href = anchor.getAttribute('href')!;
        if (href === '#') return;
        const url = new URL(href, window.location.href);
        let next = '#';
        if (url.origin === window.location.origin) {
          if (url.pathname.startsWith('/mocks/')) next = `${url.pathname}${url.search}${url.hash}`;
          else if (url.pathname === '/settings') next = `/mocks/settings${url.search}`;
          else if (url.pathname.startsWith('/literature/')) next = '/mocks/results';
          else if (url.pathname === '/bibliometrics' || url.pathname.startsWith('/bibliometrics/')) next = '/mocks/bibliometrics';
        }
        if (href !== next) anchor.setAttribute('href', next);
      });
    }
    containLinks();
    const observer = new MutationObserver(containLinks);
    observer.observe(node, { subtree: true, childList: true, attributes: true, attributeFilter: ['href'] });
    return () => observer.disconnect();
  }, [ready]);
  return <div ref={container} onClickCapture={(event) => {
    const anchor = (event.target as Element).closest('a');
    if (!anchor) return;
    event.preventDefault();
    const href = anchor.getAttribute('href');
    if (href?.startsWith('/mocks/')) window.location.assign(href);
  }}>{ready ? children : null}</div>;
}
