// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import PaperSeekSettings from './PaperSeekSettings';
import * as api from '@/lib/paperseek/settings';
vi.mock('@/lib/paperseek/settings', () => ({ loadPaperSeekSettings: vi.fn(), saveDefaults: vi.fn(), saveProxy: vi.fn(), saveSource: vi.fn(), createConnection: vi.fn(), updateConnection: vi.fn(), deleteConnection: vi.fn(), testConnection: vi.fn(), testDraftConnection: vi.fn(), testSource: vi.fn() }));
vi.stubGlobal('React', React); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
const status = { status: 'untested', latency_ms: null, code: '', tested_at: null };
const con = (id: string) => ({ id, kind: 'llm' as const, provider: 'openai', api_type: '', base_url: '', model: id, has_key: true, key_hint: '1234', requires_key: true, test: status, created_at: '', updated_at: '' });
const settings: api.PaperSeekWorkspaceSettings = { connections: [con('one'), con('two')], sources: [{ id: 'openalex', has_key: false, key_origin: '', key_hint: '', usable: true, options: {}, test: status }, { id: 'wos', has_key: false, key_origin: '', key_hint: '', usable: false, options: {}, test: status }], defaults: { search_llm: 'one', review_llm: 'one', pre_ranking: 'local_fusion', embedding: '', reranker: '', decision: '', source: 'openalex' }, proxy: { origin: '', hosts: [], scope: [] } };
let container: HTMLDivElement, root: Root;
beforeEach(async () => { vi.clearAllMocks(); vi.mocked(api.loadPaperSeekSettings).mockResolvedValue(settings); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); await act(async () => { root.render(<PaperSeekSettings />); }); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
function formOf(name: string) { return Array.from(container.querySelectorAll('form')).find(f => f.textContent?.includes(name))!; }
function button(name: string) { return Array.from(container.querySelectorAll('button')).find(b => b.textContent === name)!; }
async function click(el: HTMLElement) { await act(async () => { el.click(); }); }
it('submits valid ranking and offers only usable sources', async () => {
  const form = formOf('默认设置');
  expect(form.querySelector('select[name="pre_ranking"] option[value=""]')).toBeNull();
  expect(form.querySelector('select[name="source"] option[value="wos"]')).toBeNull();
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(vi.mocked(api.saveDefaults).mock.calls[0][0].pre_ranking).toBe('local_fusion');
});
it('initializes proxy scopes and supports explicit removal', async () => {
  const boxes = Array.from(container.querySelectorAll<HTMLInputElement>('input[name="scope"]'));
  expect(boxes.every(box => box.checked)).toBe(true);
  vi.mocked(api.loadPaperSeekSettings).mockResolvedValue({ ...settings, proxy: { origin: 'settings', hosts: ['proxy:8080'], scope: ['models'] } });
  await click(button('保存代理'));
  expect(container.textContent).toContain('proxy:8080');
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  await click(button('移除已保存代理'));
  expect(api.saveProxy).toHaveBeenLastCalledWith(expect.objectContaining({ urls: '' }));
});
it('uses a same-kind replacement when deleting a default connection', async () => {
  const select = container.querySelector<HTMLSelectElement>('select')!;
  await act(async () => { select.value = 'one'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  const replacement = container.querySelector<HTMLSelectElement>('select[name="replacement"]')!;
  expect(Array.from(replacement.options).map(o => o.value)).toContain('two');
  await act(async () => { replacement.value = 'two'; replacement.dispatchEvent(new Event('change', { bubbles: true })); });
  vi.spyOn(window, 'confirm').mockReturnValue(true); await click(button('删除连接'));
  expect(api.deleteConnection).toHaveBeenCalledWith('one', 'two');
});
it('refreshes stored failed test status and displays the safe failure code', async () => {
  vi.mocked(api.testSource).mockImplementation(async () => {
    vi.mocked(api.loadPaperSeekSettings).mockResolvedValue({ ...settings, sources: settings.sources.map(source => source.id === 'openalex' ? { ...source, test: { ...status, status: 'failed', code: 'source_unavailable' } } : source) });
    return { ok: false, code: 'source_unavailable', latency_ms: null };
  });
  await click(button('测试数据源'));
  expect(api.loadPaperSeekSettings).toHaveBeenCalledTimes(2);
  expect(container.textContent).toContain('source_unavailable');
  expect(container.querySelector('h3')?.textContent).toContain('failed (source_unavailable)');
});

it('requires at least one proxy scope before saving', async () => {
  for (const box of Array.from(container.querySelectorAll<HTMLInputElement>('input[name="scope"]'))) await click(box);
  await click(button('保存代理'));
  expect(api.saveProxy).not.toHaveBeenCalled();
  expect(container.textContent).toContain('请至少选择一个代理范围');
});
