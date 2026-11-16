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
beforeEach(async () => { vi.resetAllMocks(); vi.mocked(api.loadPaperSeekSettings).mockResolvedValue(settings); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); await act(async () => { root.render(<PaperSeekSettings />); }); });
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });
function formOf(name: string) { return Array.from(container.querySelectorAll('form')).find(f => f.textContent?.includes(name))!; }
function button(name: string) { return Array.from(container.querySelectorAll('button')).find(b => b.textContent === name)!; }
async function click(el: HTMLElement) { await act(async () => { el.click(); }); }
async function selectConnection(id: string) {
  const select = container.querySelector('select')!;
  await act(async () => { select.value = id; select.dispatchEvent(new Event('change', { bubbles: true })); });
  return select;
}
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
  await selectConnection('one');
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

it('locks the connection selection and editable fields through a delayed save and reload', async () => {
  const select = await selectConnection('two');
  const model = container.querySelector<HTMLInputElement>('input[name="model"]')!;
  const proxy = container.querySelector<HTMLTextAreaElement>('textarea[name="urls"]')!;
  model.value = 'updated-model';
  proxy.value = 'unsaved-proxy';
  let finishSave!: (connection: api.Connection) => void;
  let finishLoad!: (workspace: api.PaperSeekWorkspaceSettings) => void;
  vi.mocked(api.updateConnection).mockReturnValueOnce(new Promise(resolve => { finishSave = resolve; }));
  vi.mocked(api.loadPaperSeekSettings).mockReturnValueOnce(new Promise(resolve => { finishLoad = resolve; }));

  await click(button('保存连接'));
  expect(api.updateConnection).toHaveBeenCalledWith('two', expect.objectContaining({ model: 'updated-model' }));
  for (const control of [select, model, proxy]) {
    expect(control.matches(':disabled')).toBe(true);
    control.focus();
    expect(document.activeElement).not.toBe(control);
  }
  expect(select.value).toBe('two');
  await act(async () => { finishSave({ ...con('two'), model: 'updated-model' }); });
  expect(select.matches(':disabled')).toBe(true);
  expect(proxy.matches(':disabled')).toBe(true);
  await act(async () => { finishLoad({ ...settings, connections: [con('one'), { ...con('two'), model: 'updated-model' }] }); });
  expect(select.matches(':disabled')).toBe(false);
  expect(proxy.matches(':disabled')).toBe(false);
  expect(proxy.value).toBe('unsaved-proxy');
});

it.each([
  ['保存连接', 'updateConnection', '已保存'],
  ['删除连接', 'deleteConnection', '连接已删除'],
] as const)('reports successful %s when refresh fails and retries only the read', async (action, method, success) => {
  await selectConnection('two');
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.mocked(api.updateConnection).mockResolvedValueOnce({ ...con('two'), model: 'updated-model' });
  const connections = method === 'deleteConnection' ? [con('one')] : [con('one'), { ...con('two'), model: 'updated-model' }];
  vi.mocked(api.loadPaperSeekSettings).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ...settings, connections });

  await click(button(action));
  expect(container.querySelector('[role="status"]')?.textContent).toContain(`${success}，刷新失败`);
  expect(api[method]).toHaveBeenCalledOnce();
  await click(button('重新加载设置'));
  expect(api.loadPaperSeekSettings).toHaveBeenCalledTimes(3);
  expect(api[method]).toHaveBeenCalledOnce();
  expect(button('重新加载设置')).toBeUndefined();
  expect(container.querySelector('select')?.options.length).toBe(connections.length + 1);
});
