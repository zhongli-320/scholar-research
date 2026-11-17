'use client';

import { useCallback, useEffect, useState } from 'react';
import { createConnection, deleteConnection, loadPaperSeekSettings, saveDefaults, saveProxy, saveSource, testConnection, testDraftConnection, testSource, updateConnection, type ConnectionInput, type ConnectionKind, type Defaults, type PaperSeekWorkspaceSettings, type Probe, type TestStatus } from '@/lib/paperseek/settings';

const input = 'gr-input mt-1 block w-full bg-paper px-3 py-2 shadow-[inset_0_0_0_1px_rgba(29,25,21,0.26)]';
const fields = ['search_llm', 'review_llm', 'pre_ranking', 'embedding', 'reranker', 'decision', 'source'] as const;
const names: Record<string, string> = { search_llm: '检索模型', review_llm: '综述模型', pre_ranking: '预排序', embedding: '嵌入模型', reranker: '重排序模型', decision: '决策模型', source: '默认数据源' };
const optionNames: Record<string, string[]> = { openalex: ['openalex_email'], crossref: ['crossref_email'], pubmed: ['pubmed_tool', 'pubmed_email'], wos: ['wos_db'] };
const scopes = ['models', 'ip_limited_sources', 'other_sources'];
function value(form: FormData, key: string) { return String(form.get(key) || ''); }
function connectionData(form: FormData): ConnectionInput { return { kind: value(form, 'kind') as ConnectionKind, provider: value(form, 'provider'), api_type: value(form, 'api_type'), base_url: value(form, 'base_url'), model: value(form, 'model'), api_key: value(form, 'api_key') }; }
function testStatus(test: TestStatus) {
  const status = { ok: '正常', failed: '失败', untested: '未测试' }[test.status] ?? test.status;
  return test.code ? `${status} (${test.code})` : status;
}

export default function PaperSeekSettings() {
  const [settings, setSettings] = useState<PaperSeekWorkspaceSettings | null>(null);
  const [selected, setSelected] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [replacement, setReplacement] = useState('');
  const load = useCallback(async () => setSettings(await loadPaperSeekSettings()), []);
  useEffect(() => { void load().catch(() => setStatus('无法连接 PaperSeek，请检查服务。')); }, [load]);
  const refresh = async (message?: string) => {
    try {
      await load();
      setRefreshFailed(false);
      setStatus(message || '设置已刷新。');
    } catch {
      setRefreshFailed(true);
      setStatus(message ? `${message}，刷新失败。` : '刷新失败，请重试。');
    }
  };
  const run = async (action: () => Promise<unknown>, message = '已保存') => {
    setBusy(true); setStatus('');
    try {
      await action();
      await refresh(message);
    } catch { setStatus('操作失败，请检查输入或 PaperSeek 连接。'); }
    finally { setBusy(false); }
  };
  const probe = async (action: () => Promise<Probe>) => {
    setBusy(true); setStatus('');
    try {
      const result = await action();
      await refresh(result.ok ? '测试成功' : `测试失败：${result.code}`);
    } catch { setStatus('测试失败，请检查 PaperSeek 连接。'); }
    finally { setBusy(false); }
  };
  const retryRefresh = async () => {
    setBusy(true);
    await refresh();
    setBusy(false);
  };
  if (!settings) return <p role="status" className="p-6">{status || '正在加载设置…'}</p>;
  const current = settings.connections.find(c => c.id === selected);
  const isDefault = current && [settings.defaults.search_llm, settings.defaults.review_llm, settings.defaults.embedding, settings.defaults.reranker, settings.defaults.decision].includes(current.id);
  const alternatives = current ? settings.connections.filter(c => c.kind === current.kind && c.id !== current.id) : [];
  return <div className="space-y-10 p-5 sm:p-8">
    <div>
      <p role="status" aria-live="polite">{status}</p>
      {refreshFailed && <button disabled={busy} className="gr-btn-line mt-2" type="button" onClick={() => void retryRefresh()}>重新加载设置</button>}
    </div>
    <fieldset disabled={busy} aria-busy={busy} className="min-w-0 space-y-10">
    <section><h2 className="text-xl font-semibold">模型连接</h2>
      <label className="mt-3 block">选择连接<select className={input} value={selected} onChange={e => { setSelected(e.target.value); setReplacement(''); }}><option value="">新增连接</option>{settings.connections.map(c => <option key={c.id} value={c.id}>{c.kind} · {c.provider} · {c.model}</option>)}</select></label>
      <form key={selected} className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const data = connectionData(new FormData(form)); void run(async () => { if (current) await updateConnection(current.id, data); else await createConnection(data); form.reset(); setSelected(''); }); }}>
        <label>类型<select name="kind" className={input} defaultValue={current?.kind || 'llm'}>{['llm', 'embedding', 'reranker', 'decision'].map(k => <option key={k}>{k}</option>)}</select></label>
        <label>提供商<input required name="provider" className={input} defaultValue={current?.provider} placeholder="openai" /></label>
        <label>API 类型<input name="api_type" className={input} defaultValue={current?.api_type} placeholder="留空使用默认值" /></label>
        <label>模型<input name="model" className={input} defaultValue={current?.model} placeholder="留空使用默认值" /></label>
        <label>服务地址<input name="base_url" className={input} defaultValue={current?.base_url} placeholder="留空使用默认值" /></label>
        <label>API 密钥<input name="api_key" type="password" autoComplete="new-password" className={input} placeholder={current?.has_key ? '已配置；留空保持不变' : '输入新密钥'} /><span className="text-sm text-ink-3">{current?.has_key ? `已配置 ${current.key_hint ? `（尾号 ${current.key_hint}）` : ''}` : current?.requires_key ? '需要密钥' : '未配置密钥'}</span></label>
        <div className="flex flex-wrap gap-3 sm:col-span-2"><button disabled={busy} className="gr-btn" type="submit">保存连接</button>
          <button disabled={busy} className="gr-btn-line" type="button" onClick={e => { const form = e.currentTarget.form; if (form) { const data = connectionData(new FormData(form)); void probe(() => testDraftConnection({ ...data, ...(current ? { id: current.id } : {}) })); } }}>测试当前填写</button>
          {current && isDefault && alternatives.length > 0 && <label>替代默认连接<select name="replacement" value={replacement} onChange={e => setReplacement(e.target.value)} className={input}><option value="">请选择</option>{alternatives.map(c => <option key={c.id} value={c.id}>{c.provider} · {c.model}</option>)}</select></label>}
          {current && <><button disabled={busy} className="gr-btn-line" type="button" onClick={() => void probe(() => testConnection(current.id))}>测试已保存连接</button><button disabled={busy || Boolean(isDefault && alternatives.length && !replacement)} className="gr-btn-line" type="button" onClick={() => { if (window.confirm('删除此连接？')) void run(async () => { await deleteConnection(current.id, replacement); setSelected(''); }, '连接已删除'); }}>删除连接</button></>}
        </div>
      </form>{current && <p className="mt-2 text-sm text-ink-3">上次测试：{testStatus(current.test)}</p>}
    </section>
    <section><h2 className="text-xl font-semibold">默认设置</h2><form key={JSON.stringify(settings.defaults)} className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); const defaults = Object.fromEntries(fields.map(k => [k, value(form, k)])) as Defaults; void run(() => saveDefaults(defaults)); }}>
      {fields.map(key => <label key={key}>{names[key]}<select name={key} className={input} defaultValue={settings.defaults[key]}>{key !== 'pre_ranking' && <option value="">默认</option>}{key === 'source' ? settings.sources.filter(s => s.usable).map(s => <option key={s.id} value={s.id}>{s.id}</option>) : key === 'pre_ranking' ? ['local_fusion', 'embedding_rerank', 'decision'].map(v => <option key={v}>{v}</option>) : settings.connections.filter(c => c.kind === (key.endsWith('llm') ? 'llm' : key)).map(c => <option key={c.id} value={c.id}>{c.provider} · {c.model}</option>)}</select></label>)}<button disabled={busy} className="gr-btn w-fit" type="submit">保存默认设置</button>
    </form></section>
    <section><h2 className="text-xl font-semibold">数据源</h2><div className="mt-4 space-y-5">{settings.sources.map(source => <form key={source.id} className="border-t border-rule-soft pt-4" onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const data = new FormData(form); const options = Object.fromEntries((optionNames[source.id] || []).map(k => [k, value(data, k)])); void run(async () => { await saveSource(source.id, { api_key: value(data, 'api_key'), options }); form.reset(); }); }}>
      <h3 className="font-semibold">{source.id} · {source.has_key ? `已配置密钥 ${source.key_hint ? `（尾号 ${source.key_hint}）` : ''}` : '未配置密钥'} · {testStatus(source.test)}</h3>
      <div className="mt-2 grid gap-3 sm:grid-cols-2"><label>API 密钥<input name="api_key" type="password" autoComplete="new-password" className={input} placeholder="留空保持不变" /></label>{(optionNames[source.id] || []).map(k => <label key={k}>{k}<input name={k} className={input} defaultValue={source.options?.[k] || ''} /></label>)}</div>
      <div className="mt-3 flex gap-3"><button disabled={busy} className="gr-btn-line" type="submit">保存数据源</button><button disabled={busy} className="gr-btn-line" type="button" onClick={() => void probe(() => testSource(source.id))}>测试数据源</button></div>
    </form>)}</div></section>
    <section><h2 className="text-xl font-semibold">代理</h2><p className="mt-2 text-sm text-ink-3">已配置：{settings.proxy?.hosts.join(', ') || '无'}。地址留空保持现有设置。</p><form key={JSON.stringify(settings.proxy)} className="mt-3 space-y-3" onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const data = new FormData(form); const urls = value(data, 'urls'); const scope = data.getAll('scope').map(String); if (!scope.length) { setStatus('请至少选择一个代理范围。'); return; } void run(async () => { await saveProxy({ ...(urls.trim() ? { urls } : {}), scope }); form.reset(); }); }}>
      <label>代理地址，每行一个<textarea name="urls" className={input} rows={3} autoComplete="off" /></label>
      <fieldset><legend>代理范围</legend>{scopes.map(scope => <label key={scope} className="mr-4 inline-flex gap-1"><input type="checkbox" name="scope" value={scope} defaultChecked={settings.proxy?.hosts.length ? settings.proxy.scope.includes(scope) : true} />{scope}</label>)}</fieldset>
      <button disabled={busy} className="gr-btn-line" type="submit">保存代理</button>
      {settings.proxy?.origin === 'settings' && <button disabled={busy} className="gr-btn-line ml-3" type="button" onClick={() => { if (window.confirm('移除已保存的代理地址？')) void run(() => saveProxy({ urls: '', scope: settings.proxy?.scope.length ? settings.proxy.scope : scopes }), '代理已移除'); }}>移除已保存代理</button>}
    </form></section>
    </fieldset>
  </div>;
}
