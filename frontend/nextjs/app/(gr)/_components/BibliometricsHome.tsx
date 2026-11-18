'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createAnalysis, deleteAnalysis, listAnalyses, listHistory, renameAnalysis } from '@/lib/paperseek/client';
import type { PaperSeekAnalysisPage, PaperSeekHistoryPage } from '@/lib/paperseek/types';
import { analysisScopeLabel } from '@/lib/paperseek/bibliometrics';

export default function BibliometricsHome() {
  const router = useRouter();
  const [searches, setSearches] = useState<PaperSeekHistoryPage | null>(null);
  const [analyses, setAnalyses] = useState<PaperSeekAnalysisPage | null>(null);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [offset, setOffset] = useState(0);
  const [source, setSource] = useState(''); const [title, setTitle] = useState('');
  const pendingKey = useRef<string | null>(null);
  const [edit, setEdit] = useState<string | null>(null); const [editTitle, setEditTitle] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null); const [busy, setBusy] = useState(false); const lock = useRef(false);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; listHistory({ cursor: cursors[cursors.length - 1] }).then((page) => { if (active) setSearches(page); }).catch((e) => { if (active) setError(e.message); }); return () => { active = false; }; }, [cursors]);
  async function loadAnalyses(start = offset) { setAnalyses(await listAnalyses({ offset: start })); }
  useEffect(() => { let active = true; listAnalyses({ offset }).then((page) => { if (active) setAnalyses(page); }).catch((e) => { if (active) setError(e.message); }); return () => { active = false; }; }, [offset]);
  async function mutate(action: () => Promise<void>) {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : '操作失败'); } finally { lock.current = false; setBusy(false); }
  }
  const eligible = searches?.items.filter((item) => item.status === 'completed' && (!item.kind || item.kind === 'research')) ?? [];
  return <main className="mx-auto w-full max-w-[1080px] px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
    <header className="max-w-3xl"><p className="gr-eye">PaperSeek · Bibliometrics</p><h1 className="mt-5 font-display text-5xl font-semibold tracking-[-0.04em]">文献计量</h1><p className="mt-4 text-base leading-7 text-ink-3">从已完成的文献检索创建分析，查看主题、作者、机构、期刊分区与引用网络。</p></header>
    {error && <p role="alert" className="mt-6 border-l-2 border-rubric bg-rubric/5 px-4 py-3 text-rubric">{error}</p>}

    <section className="mt-10 border border-rule-soft bg-paper-hi p-5 sm:p-7" aria-labelledby="create-analysis">
      <div className="flex flex-col justify-between gap-2 border-b border-rule-soft pb-4 sm:flex-row sm:items-end"><div><p className="gr-meta">New analysis</p><h2 id="create-analysis" className="mt-2 font-display text-2xl font-semibold">从已完成检索创建分析</h2></div><p className="text-sm text-ink-3">选择一条检索记录作为数据源</p></div>
      {!searches ? <p className="mt-5 text-ink-3">正在加载检索…</p> : <>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">{eligible.map((item) => <label key={item.id} className={`cursor-pointer border p-4 transition-colors ${source === item.id ? 'border-rubric bg-rubric/5' : 'border-rule-soft hover:border-rule'}`}><span className="flex items-start gap-3"><input className="mt-1 accent-[#B8381C]" type="radio" name="source" checked={source === item.id} disabled={busy} onChange={() => { setSource(item.id); pendingKey.current = null; }} /><span className="min-w-0"><strong className="block truncate font-medium" title={item.display_title || item.question}>{item.display_title || item.question}</strong><span className="mt-1 block font-code text-xs text-ink-3">{item.result_count} 条文献</span></span></span></label>)}</div>
        {eligible.length === 0 && <p className="mt-5 text-sm text-ink-3">本页没有已完成检索。</p>}
        <div className="mt-4 flex gap-2"><button className="gr-btn-line" disabled={busy || cursors.length === 1} onClick={() => setCursors(cursors.slice(0, -1))}>上一页</button><button className="gr-btn-line" disabled={busy || !searches.next_cursor} onClick={() => setCursors([...cursors, searches.next_cursor!])}>下一页</button></div>
      </>}
      <form className="mt-6 flex flex-col gap-3 border-t border-rule-soft pt-5 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); if (source) void mutate(async () => { const key = pendingKey.current ?? crypto.randomUUID(); pendingKey.current = key; const analysis = await createAnalysis({ source_run_id: source, title }, key); pendingKey.current = null; router.push(`/bibliometrics/${encodeURIComponent(analysis.id)}`); }); }}>
        <label className="flex-1 text-sm font-medium" htmlFor="analysis-title">分析标题（可选）<input id="analysis-title" className="mt-2 block h-11 w-full border border-rule bg-paper px-3 outline-none transition-colors focus:border-rubric" maxLength={200} disabled={busy} value={title} onChange={(event) => { setTitle(event.target.value); pendingKey.current = null; }} placeholder="例如：生成式人工智能研究图谱" /></label><button className="gr-btn" type="submit" disabled={busy || !source}>创建分析</button>
      </form>
    </section>

    <section className="mt-12" aria-labelledby="existing-analysis">
      <div className="flex items-end justify-between border-b border-rule pb-4"><div><p className="gr-meta">Saved analyses</p><h2 id="existing-analysis" className="mt-2 font-display text-2xl font-semibold">已有分析</h2></div>{analyses && <span className="font-code text-xs text-ink-3">共 {analyses.total_count} 项</span>}</div>
      {!analyses ? <p className="mt-5 text-ink-3">正在加载分析…</p> : analyses.items.length === 0 ? <p className="mt-5 text-ink-3">暂无分析记录。</p> : <ul className="mt-5 grid gap-4 sm:grid-cols-2">{analyses.items.map((item) => <li key={item.id} className="group flex min-h-44 flex-col border border-rule-soft bg-paper-hi p-5 transition-transform hover:-translate-y-0.5">
        <Link className="font-display text-xl font-semibold leading-snug transition-colors hover:text-rubric" href={`/bibliometrics/${encodeURIComponent(item.id)}`}>{item.title}</Link><p className="mt-3 font-code text-xs text-ink-3">{item.paper_count} 篇 · {analysisScopeLabel(item.scope)}</p><div className="mt-auto pt-5">
        {edit === item.id ? <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); if (editTitle.trim()) void mutate(async () => { await renameAnalysis(item.id, editTitle); setEdit(null); await loadAnalyses(); }); }}><label className="sr-only" htmlFor={`edit-analysis-${item.id}`}>新标题</label><input id={`edit-analysis-${item.id}`} className="h-9 min-w-0 flex-1 border border-rule bg-paper px-2" maxLength={200} value={editTitle} onChange={(event) => setEditTitle(event.target.value)} /><button className="gr-btn-line" disabled={busy || !editTitle.trim()}>保存</button><button className="gr-btn-line" type="button" disabled={busy} onClick={() => setEdit(null)}>取消</button></form> : <div className="flex flex-wrap items-center gap-3 font-code text-[11px] uppercase tracking-[0.08em]"><button className="hover:text-rubric" disabled={busy} onClick={() => { setEdit(item.id); setEditTitle(item.title); setConfirm(null); }}>重命名</button>{confirm === item.id ? <><span role="alert" className="normal-case tracking-normal text-rubric">确定删除此分析？</span><button autoFocus className="text-rubric underline" disabled={busy} aria-label={`确认删除：${item.title}`} onClick={() => void mutate(async () => { await deleteAnalysis(item.id); setConfirm(null); await loadAnalyses(); })}>确认删除</button><button disabled={busy} onClick={() => setConfirm(null)}>取消</button></> : <button className="hover:text-rubric" disabled={busy} onClick={() => setConfirm(item.id)}>删除</button>}</div>}
        </div></li>)}</ul>}
      {analyses && <div className="mt-5 flex gap-2"><button className="gr-btn-line" disabled={busy || offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>上一页</button><button className="gr-btn-line" disabled={busy || analyses.next_offset == null} onClick={() => setOffset(analyses.next_offset!)}>下一页</button></div>}
    </section>
  </main>;
}
