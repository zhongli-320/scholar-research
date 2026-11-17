// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { MockMode } from './mode';
import HomeScreen from './HomeScreen';
import ArchiveScreen from './ArchiveScreen';
import MockRun from '../mocks/_components/MockRun';
import { archive } from '../mocks/_data/archive';
import { Favicon, Thumb } from './Favicon';
import Lightbox from './Lightbox';
import { useCitedHtml } from './Sheet';

vi.mock('next/navigation', () => ({ usePathname: () => '/mocks/home', useRouter: () => ({ push: vi.fn() }) }));
function setup() {
  vi.stubGlobal('React', React); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ response: { content: 'unexpected live response' } }) }));
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
}
function CitedImage() {
  const html = useCitedHtml('![remote](https://images.example/test.png)', []);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

it('keeps report suggestions and typed chat in the real preview component offline', async () => {
  setup(); window.history.replaceState({}, '', '/mocks/report?tab=chat');
  const element = document.createElement('div'); const root = createRoot(element);
  await act(async () => root.render(<MockMode archive={archive}><MockRun at={9999} tab="chat" /></MockMode>));
  const suggestion = [...element.querySelectorAll('button')].find(button => button.textContent === '哪些因素可能改变当前结论？')!;
  expect(suggestion).toBeDefined();
  await act(async () => suggestion.click());
  expect(fetch).not.toHaveBeenCalled();
  expect(element.textContent).toContain('预览回复：');
  const textarea = element.querySelector<HTMLTextAreaElement>('textarea[placeholder="围绕这篇综述提问"]')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'A different question'); textarea.dispatchEvent(new Event('input', { bubbles: true })); });
  await act(async () => textarea.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(fetch).not.toHaveBeenCalled();
  expect(element.textContent).toContain('A different question');
  await act(async () => root.unmount()); vi.unstubAllGlobals();
});

it('renders old mock home, archive and report images without external image URLs', async () => {
  setup(); window.history.replaceState({}, '', '/mocks/report');
  const element = document.createElement('div'); const root = createRoot(element);
  await act(async () => root.render(<MockMode archive={archive}><HomeScreen /><ArchiveScreen /><MockRun at={9999} figure={0} /><Favicon domain="example.com" /><Thumb src="https://images.example/thumb.png" /><Lightbox images={['https://images.example/large.png']} index={0} onIndex={() => {}} onClose={() => {}} /><CitedImage /></MockMode>));
  const externalImages = [...element.querySelectorAll('img')].map(img => img.getAttribute('src') ?? '').filter(src => /^(?:https?:)?\/\//i.test(src));
  expect(externalImages).toEqual([]);
  await act(async () => root.unmount()); vi.unstubAllGlobals();
});

it('hydrates the offline mock home without a server/client mismatch', async () => {
  setup(); window.history.replaceState({}, '', '/mocks/home?backend=offline');
  const realWindow = window;
  const tree = <MockMode archive={archive}><HomeScreen /></MockMode>;
  vi.stubGlobal('window', undefined);
  const html = renderToString(tree);
  vi.stubGlobal('window', realWindow);
  const element = document.createElement('div'); element.innerHTML = html; document.body.appendChild(element);
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  let root!: ReturnType<typeof hydrateRoot>;
  await act(async () => { root = hydrateRoot(element, tree); });
  expect(element.textContent).toContain('无法连接后端');
  expect(errors).not.toHaveBeenCalled();
  await act(async () => root.unmount()); element.remove(); errors.mockRestore(); vi.unstubAllGlobals();
});


it('preserves the normal report chat and image behavior outside mock mode', async () => {
  setup(); window.history.replaceState({}, '', '/research/example');
  const element = document.createElement('div'); const root = createRoot(element);
  await act(async () => root.render(<><MockRun at={9999} tab="chat" /><Favicon domain="example.com" /></>));
  expect(element.querySelector('img[src^="https://www.google.com/s2/favicons"]')).not.toBeNull();
  const suggestion = [...element.querySelectorAll('button')].find(button => button.textContent === '哪些因素可能改变当前结论？')!;
  await act(async () => suggestion.click());
  expect(fetch).toHaveBeenCalledOnce();
  expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/chat');
  expect(element.textContent).toContain('unexpected live response');
  await act(async () => root.unmount()); vi.unstubAllGlobals();
});
