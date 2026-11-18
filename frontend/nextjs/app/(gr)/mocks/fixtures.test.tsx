// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import FixtureBoundary from './_components/FixtureBoundary';
import Results from './results/page';
import Bibliometrics from './bibliometrics/page';
import Settings from './settings/page';
import { saveDefaults } from '@/lib/paperseek/settings';
import { DEFAULT_BRIEF } from '@/lib/research/brief';
import { setBrief } from '../_components/preferences';
vi.stubGlobal('React', React); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/mocks/settings' }));
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

it('renders product results and paginates entirely through fixtures', async () => {
  const element = document.createElement('div'); const root = createRoot(element);
  await act(async () => root.render(<FixtureBoundary><Results /></FixtureBoundary>));
  expect(element.textContent).toContain('示例论文一');
  expect(element.querySelector('a')?.getAttribute('href')).not.toContain('/api/paperseek/');
  const next = [...element.querySelectorAll('button')].find(button => button.textContent === '下一页')!;
  await act(async () => next.click());
  expect(element.textContent).toContain('示例论文二');
  expect(element.textContent).not.toContain('示例论文一');
  await act(async () => root.unmount());
});

it('renders grouped bibliometrics without the removed network panel', async () => {
  const element = document.createElement('div'); const root = createRoot(element);
  await act(async () => root.render(<FixtureBoundary><Bibliometrics /></FixtureBoundary>));
  expect(element.textContent).toContain('示例文献计量分析');
  for (const heading of ['时间与文献载体', '研究主体与地域', '研究主题', '期刊评价', '数据质量']) expect(element.textContent).toContain(heading);
  expect(element.textContent).not.toContain('网络分析');
  expect(element.querySelector('[data-network-node]')).toBeNull();
  await act(async () => root.unmount());
});

it('shows keyboard links for both settings systems while disabling mutation controls', async () => {
  const element = document.createElement('div'); document.body.appendChild(element); const root = createRoot(element);
  await act(async () => root.render(<FixtureBoundary><Settings searchParams={{}} /></FixtureBoundary>));
  const tabs = [...element.querySelectorAll('nav[aria-label="设置系统"] a')];
  expect(tabs.map(tab => tab.textContent)).toEqual(['PaperSeek', 'Scholar Research']);
  expect(tabs[1].getAttribute('href')).toBe('/mocks/settings?tab=gpt-researcher');
  expect(tabs.every(tab => tab instanceof HTMLAnchorElement && tab.hasAttribute('href'))).toBe(true);
  for (const tab of tabs) { (tab as HTMLAnchorElement).focus(); expect(document.activeElement).toBe(tab); }
  expect([...element.querySelectorAll('button, input, select, textarea')].every(control => control.matches(':disabled'))).toBe(true);
  await act(async () => root.unmount()); element.remove();
});

it('keeps PaperSeek API writes and GPT Researcher browser preferences independent', async () => {
  window.history.pushState({}, '', '/settings');
  const fetcher = vi.fn().mockResolvedValue(Response.json({ search_llm: '', review_llm: '', pre_ranking: 'local_fusion', embedding: '', reranker: '', decision: '', source: 'openalex' }));
  vi.stubGlobal('fetch', fetcher);
  await saveDefaults({ source: 'openalex' });
  expect(fetcher).toHaveBeenCalledOnce();
  expect(fetcher.mock.calls[0][0]).toBe('/api/paperseek/settings/defaults');
  expect(localStorage.length).toBe(0);
  fetcher.mockClear();
  setBrief({ ...DEFAULT_BRIEF, tone: 'Objective' });
  expect(localStorage.getItem('gptr-brief')).not.toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

it('allows only local mock-page navigation requests through the fixture boundary', async () => {
  vi.stubGlobal('React', React); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const previous = vi.fn().mockResolvedValue(new Response('mock route'));
  vi.stubGlobal('fetch', previous);
  const element = document.createElement('div'); const root = createRoot(element);
  await act(async () => root.render(<FixtureBoundary><div>preview</div></FixtureBoundary>));
  const result = await fetch('/mocks/settings?_rsc=sample');
  expect(await result.text()).toBe('mock route');
  expect(previous).toHaveBeenCalledOnce();
  expect((await fetch('/api/paperseek/runs', { method: 'POST' })).status).toBe(403);
  expect((await fetch('/mocks/settings?_rsc=sample', { method: 'POST' })).status).toBe(403);
  expect((await fetch('http://other.example/mocks/settings?_rsc=sample')).status).toBe(403);
  expect(previous).toHaveBeenCalledOnce();
  await act(async () => root.unmount()); vi.unstubAllGlobals();
});
