import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import SettingsPage from './page';
vi.stubGlobal('React', React);

describe('split settings', () => {
  it('shows two separate systems and the requested GPT section', () => {
    const doc = new JSDOM(renderToStaticMarkup(<SettingsPage searchParams={{ tab: 'gpt-researcher', section: 'mcp' }} />)).window.document as Document;
    const systems = Array.from(doc.querySelectorAll('nav[aria-label="设置系统"] a'));
    expect(systems.map(a => a.textContent)).toEqual(['PaperSeek', 'Scholar Research']);
    expect(systems[1].getAttribute('aria-current')).toBe('page');
    expect(doc.body.textContent).toContain('Use MCP servers');
    expect(doc.querySelector('a[href="/settings?tab=gpt-researcher&section=research"]')).not.toBeNull();
  });
});
