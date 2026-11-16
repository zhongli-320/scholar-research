// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LiteratureHome from './LiteratureHome';
import { recent, sources } from '../mocks/_data/paperseek';
import { createRun, listHistory, listSources } from '@/lib/paperseek/client';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/paperseek/client', () => ({
  createRun: vi.fn(), listHistory: vi.fn(), listSources: vi.fn(),
  PaperSeekApiError: class extends Error {},
}));
vi.stubGlobal('React', React);
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listSources).mockResolvedValue(sources);
  vi.mocked(listHistory).mockResolvedValue({ items: [{ ...recent, created_at: '2026-01-01' }], next_cursor: null, matched_count: 1 });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

async function mount() { await act(async () => { root.render(<LiteratureHome />); }); }

describe('literature home async behavior', () => {
  it('keeps sources when history fails', async () => {
    vi.mocked(listHistory).mockRejectedValue(new Error('history error'));
    await mount();
    expect(container.textContent).toContain('学科');
    expect(container.textContent).toContain('检索历史加载失败');
    expect(container.textContent).not.toContain('PaperSeek 暂不可用');
  });
  it('keeps recent history when sources fail', async () => {
    vi.mocked(listSources).mockRejectedValue(new Error('sources error'));
    await mount();
    expect(container.textContent).toContain(recent.display_title);
    expect(container.textContent).toContain('数据源加载失败');
    expect(container.textContent).not.toContain('PaperSeek 暂不可用');
  });
  it('reports both loading failures without declaring the whole service offline', async () => {
    vi.mocked(listSources).mockRejectedValue(new Error('sources error'));
    vi.mocked(listHistory).mockRejectedValue(new Error('history error'));
    await mount();
    expect(container.textContent).toContain('数据源加载失败');
    expect(container.textContent).toContain('检索历史加载失败');
    expect(container.textContent).not.toContain('暂无检索记录');
  });
  it('ignores a successful create after unmount', async () => {
    let resolve!: (value: typeof recent) => void;
    vi.mocked(createRun).mockReturnValue(new Promise((done) => { resolve = done; }));
    await mount();
    const textarea = container.querySelector('textarea')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, '研究问题');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(createRun).toHaveBeenCalledOnce();
    await act(async () => { root.unmount(); });
    await act(async () => { resolve(recent); });
    expect(push).not.toHaveBeenCalled();
  });
});
