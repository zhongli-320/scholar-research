import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { TopBar } from './ui';

vi.stubGlobal('React', React);
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

describe('mobile navigation', () => {
  it('groups history links inside a closed history disclosure', () => {
    const document = new JSDOM(renderToStaticMarkup(React.createElement(TopBar))).window.document;
    const mobile = document.querySelector('details.md\\:hidden');
    const history = mobile?.querySelector('nav > details');
    expect(history?.querySelector('summary')?.textContent).toBe('历史记录');
    expect(history?.hasAttribute('open')).toBe(false);
    expect(Array.from(history?.querySelectorAll('a') ?? [], (link) => link.getAttribute('href')))
      .toEqual(['/history/searches', '/history/reviews']);
  });
});
