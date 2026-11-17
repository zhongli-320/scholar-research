// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { TopBar, Connection } from './ui';
import HomeScreen from './HomeScreen';
import { MockMode } from './mode';
import Brief, { DEFAULT_BRIEF } from './Brief';

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/mocks/home', useRouter: () => router }));

it.each(['', '?backend=offline'])('keeps mock navigation and settings isolated without fetching (%s)', async (query) => {
  vi.stubGlobal('React', React); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  window.history.replaceState({}, '', `/mocks/home${query}`);
  localStorage.clear(); router.push.mockClear();
  const fetcher = vi.fn().mockRejectedValue(new Error('unexpected network'));
  vi.stubGlobal('fetch', fetcher);
  const element = document.createElement('div'); const root = createRoot(element);
  await act(async () => root.render(<><TopBar /><MockMode archive={[]}><HomeScreen settingsTab="mcp" /><Connection /></MockMode></>));
  expect(fetcher).not.toHaveBeenCalled();
  const navs = [...element.querySelectorAll('nav[aria-label="主导航"]')];
  const expected = ['/mocks/literature', '/mocks/bibliometrics', '/mocks/home', '/mocks/search-history', '/mocks/archive', '/mocks/settings'];
  expect(navs).toHaveLength(2);
  for (const nav of navs) expect([...nav.querySelectorAll('a')].map(a => a.getAttribute('href'))).toEqual(expected);
  expect(router.push).toHaveBeenCalledWith('/mocks/settings?tab=gpt-researcher&section=mcp');
  if (query) expect(element.textContent).toContain('无法连接后端');
  for (const link of element.querySelectorAll('a[href*="settings"]')) expect(link.getAttribute('href')).toMatch(/^\/mocks\/settings/);
  expect(fetcher).not.toHaveBeenCalled();
  await act(async () => root.unmount()); vi.unstubAllGlobals();
});


it.each(['', '{invalid'])('keeps the legacy MCP settings link inside mocks for config %s', async (config) => {
  vi.stubGlobal('React', React); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const element = document.createElement('div'); const root = createRoot(element);
  await act(async () => root.render(<MockMode archive={[]}><Brief value={{ ...DEFAULT_BRIEF, mcp_enabled: true, mcp_configs: config }} onChange={() => {}} /></MockMode>));
  expect(element.querySelector('a')?.getAttribute('href')).toBe('/mocks/settings?tab=gpt-researcher&section=mcp');
  await act(async () => root.unmount()); vi.unstubAllGlobals();
});
