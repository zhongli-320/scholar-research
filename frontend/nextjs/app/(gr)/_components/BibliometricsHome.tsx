'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createAnalysis, deleteAnalysis, listAnalyses, listHistory, renameAnalysis } from '@/lib/paperseek/client';
import type { PaperSeekAnalysisPage, PaperSeekHistoryPage } from '@/lib/paperseek/types';

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
  return <main className="mx-auto w-full max-w-[860px] px-5 pb-16 pt-[9vh] sm:px-8">
    <h1 className="font-display text-4xl font-semibold">文献计量</h1>
    {error && <p role="alert" className="mt-4 text-rubric">{error}</p>}
    <section className="mt-8"><h2 className="font-display text-2xl">从已完成检索创建分析</h2>
      {!searches ? <p>正在加载检索…</p> : <><ul className="mt-4 space-y-2">{eligible.map((item) => <li key={item.id}><label><input type="radio" name="source" checked={source === item.id} disabled={busy} onChange={() => { setSource(item.id); pendingKey.current = null; }} /> {item.display_title || item.question} · {item.result_count} 条</label></li>)}</ul>{eligible.length === 0 && <p className="mt-3 text-ink-3">本页没有已完成检索。</p>}
      <div className="mt-3 flex gap-4"><button disabled={busy || cursors.length === 1} onClick={() => setCursors(cursors.slice(0, -1))}>上一页</button><button disabled={busy || !searches.next_cursor} onClick={() => setCursors([...cursors, searches.next_cursor!])}>下一页</button></div></>}
      <form className="mt-4 flex flex-wrap gap-3" onSubmit={(event) => { event.preventDefault(); if (source) void mutate(async () => { const key = pendingKey.current ?? crypto.randomUUID(); pendingKey.current = key; const analysis = await createAnalysis({ source_run_id: source, title }, key); pendingKey.current = null; router.push(`/bibliometrics/${encodeURIComponent(analysis.id)}`); }); }}><label htmlFor="analysis-title">分析标题（可选）</label><input id="analysis-title" className="border border-rule bg-paper-hi p-2" maxLength={200} disabled={busy} value={title} onChange={(event) => { setTitle(event.target.value); pendingKey.current = null; }} /><button className="gr-btn" type="submit" disabled={busy || !source}>创建分析</button></form>
    </section>
    <section className="mt-12"><h2 className="font-display text-2xl">已有分析</h2>{!analyses ? <p>正在加载分析…</p> : analyses.items.length === 0 ? <p className="mt-3 text-ink-3">暂无分析记录。</p> : <ul className="mt-4">{analyses.items.map((item) => <li key={item.id} className="border-b border-rule-soft py-4"><Link className="font-semibold hover:text-rubric" href={`/bibliometrics/${encodeURIComponent(item.id)}`}>{item.title}</Link><p className="mt-1 text-sm text-ink-3">{item.paper_count} 篇 · {item.scope}</p>
      {edit === item.id ? <form className="mt-3 flex gap-3" onSubmit={(event) => { event.preventDefault(); if (editTitle.trim()) void mutate(async () => { await renameAnalysis(item.id, editTitle); setEdit(null); await loadAnalyses(); }); }}><label className="sr-only" htmlFor="edit-analysis">新标题</label><input id="edit-analysis" className="border border-rule bg-paper-hi p-2" maxLength={200} value={editTitle} onChange={(event) => setEditTitle(event.target.value)} /><button disabled={busy || !editTitle.trim()}>保存</button><button type="button" disabled={busy} onClick={() => setEdit(null)}>取消</button></form> : <div className="mt-3 flex gap-4 text-sm"><button disabled={busy} onClick={() => { setEdit(item.id); setEditTitle(item.title); setConfirm(null); }}>重命名</button>{confirm === item.id ? <><span role="alert">确定删除此分析？</span><button autoFocus disabled={busy} aria-label={`确认删除：${item.title}`} onClick={() => void mutate(async () => { await deleteAnalysis(item.id); setConfirm(null); await loadAnalyses(); })}>确认删除</button><button disabled={busy} onClick={() => setConfirm(null)}>取消</button></> : <button disabled={busy} onClick={() => setConfirm(item.id)}>删除</button>}</div>}</li>)}</ul>}
      {analyses && <div className="mt-4 flex gap-4"><button disabled={busy || offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>上一页</button><button disabled={busy || analyses.next_offset == null} onClick={() => setOffset(analyses.next_offset!)}>下一页</button></div>}
    </section>
  </main>;
}
