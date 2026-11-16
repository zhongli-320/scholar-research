import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { TopBar } from './ui';
import { closeMenuDetails } from './navigation';

vi.stubGlobal('React', React);
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

describe('mobile navigation', () => {
  it('groups history links inside a closed history disclosure', () => {
    const document = new JSDOM(renderToStaticMarkup(React.createElement(TopBar))).window.document as Document;
    const mobile = document.querySelector('details.md\\:hidden');
    const history = mobile?.querySelector('nav > details');
    expect(history?.querySelector('summary')?.textContent).toBe('历史记录');
    expect(history?.hasAttribute('open')).toBe(false);
    expect(Array.from(history?.querySelectorAll('a') ?? [], (link) => link.getAttribute('href')))
      .toEqual(['/history/searches', '/history/reviews']);
  });
});

it('closes all disclosure ancestors after following a menu link', () => {
  const document = new JSDOM('<details open><nav><details open><a href="/history/reviews">综述历史</a></details></nav></details>').window.document as Document;
  const link = document.querySelector('a')!;
  closeMenuDetails(link);
  expect(Array.from(document.querySelectorAll('details'), (details) => details.open)).toEqual([false, false]);
});
