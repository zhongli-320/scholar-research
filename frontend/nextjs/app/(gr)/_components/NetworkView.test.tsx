// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import NetworkView from './NetworkView';
import { buildNetwork } from '@/lib/paperseek/client';
vi.stubGlobal('React', React); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
vi.mock('@/lib/paperseek/client', () => ({ buildNetwork: vi.fn() }));
const result = (label: string) => ({ nodes: [{ id: label, label, count: 1 }], edges: [], warnings: [] }) as never;
const submit = (element: HTMLElement) => element.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
it('clears network and error across IDs and ignores results from an old ID', async () => {
  let oldResolve!: (value: never) => void;
  vi.mocked(buildNetwork).mockReset().mockReturnValueOnce(new Promise((resolve) => { oldResolve = resolve; })).mockResolvedValueOnce(result('new-result'));
  const element = document.createElement('div'); const root = createRoot(element); await act(async () => root.render(<NetworkView id="old" />));
  await act(async () => { submit(element); });
  await act(async () => root.render(<NetworkView id="new" />));
  await act(async () => { submit(element); }); expect(vi.mocked(buildNetwork).mock.calls[1][0]).toBe('new'); expect(element.textContent).toContain('new-result');
  await act(async () => oldResolve(result('old-result'))); expect(element.textContent).toContain('new-result'); expect(element.textContent).not.toContain('old-result');
  await act(async () => root.unmount());
});
it('invalidates a pending result when parameters change and clears an already generated result', async () => {
  let resolveOld!: (value: never) => void;
  vi.mocked(buildNetwork).mockReset().mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; })).mockResolvedValueOnce(result('current-result'));
  const element = document.createElement('div'); const root = createRoot(element); await act(async () => root.render(<NetworkView id="a" />));
  await act(async () => { submit(element); });
  const select = element.querySelector('select')!;
  await act(async () => { select.value = 'coupling'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => resolveOld(result('old-result'))); expect(element.textContent).not.toContain('old-result');
  await act(async () => { submit(element); }); expect(element.textContent).toContain('current-result');
  await act(async () => { select.value = 'keywords'; select.dispatchEvent(new Event('change', { bubbles: true })); }); expect(element.textContent).not.toContain('current-result');
  await act(async () => root.unmount());
});
it('clears errors on a parameter change and on an ID change', async () => {
  vi.mocked(buildNetwork).mockReset().mockRejectedValue(new Error('network error'));
  const element = document.createElement('div'); const root = createRoot(element); await act(async () => root.render(<NetworkView id="a" />));
  await act(async () => { submit(element); }); expect(element.textContent).toContain('network error');
  const select = element.querySelector('select')!; await act(async () => { select.value = 'coupling'; select.dispatchEvent(new Event('change', { bubbles: true })); }); expect(element.textContent).not.toContain('network error');
  await act(async () => { submit(element); }); expect(element.textContent).toContain('network error');
  await act(async () => root.render(<NetworkView id="b" />)); expect(element.textContent).not.toContain('network error');
  await act(async () => root.unmount());
});
