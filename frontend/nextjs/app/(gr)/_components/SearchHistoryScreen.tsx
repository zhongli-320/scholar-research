'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { listHistory } from '@/lib/paperseek/client';
import { deleteSearch, renameSearch } from '@/lib/paperseek/history';
import { runStatusLabel } from '@/lib/paperseek/status';
import type { PaperSeekHistoryItem } from '@/lib/paperseek/types';

export default function SearchHistoryScreen() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<PaperSeekHistoryItem[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const requestId = useRef(0);
  const busyRef = useRef(false);
  const restoreDeleteFocus = useRef<string | null>(null);

  async function load(search: string, pages: (string | undefined)[]) {
    const id = ++requestId.current;
    setLoading(true); setError(''); setNext(null); setConfirmId(null); setEditId(null);
    setQuery(search); setCursors(pages); setItems([]);
    try {
      const cursor = pages[pages.length - 1];
      const page = await listHistory({ ...(search ? { query: search } : {}), ...(cursor ? { cursor } : {}) });
      if (id !== requestId.current) return;
      setItems(page.items.filter((item) => !item.kind || item.kind === 'research'));
      setNext(page.next_cursor);
    } catch (err) {
      if (id === requestId.current) { setItems([]); setError(err instanceof Error ? err.message : '历史加载失败'); }
    } finally { if (id === requestId.current) setLoading(false); }
  }
  useEffect(() => { const counter = requestId; void load('', [undefined]); return () => { counter.current++; }; }, []);

  async function mutate(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try { await action(); await load(query, [undefined]); }
    catch (err) { setError(err instanceof Error ? err.message : '操作失败'); }
    finally { busyRef.current = false; setBusy(false); }
  }

  return <main className="mx-auto w-full max-w-[860px] px-5 pb-16 pt-[9vh] sm:px-8">
    <h1 className="font-display text-4xl font-semibold">检索历史</h1>
    <form className="mt-8 flex gap-3" onSubmit={(event) => { event.preventDefault(); if (!busyRef.current) void load(input.trim(), [undefined]); }}>
      <label htmlFor="history-query" className="sr-only">搜索历史</label><input id="history-query" className="w-full border border-rule bg-paper-hi p-2" value={input} onChange={(event) => setInput(event.target.value)} placeholder="搜索标题或研究问题" />
      <button className="gr-btn" type="submit" disabled={busy}>搜索</button>
    </form>
    {error && <p role="alert" className="mt-4 text-rubric">{error}</p>}
    {loading ? <p className="mt-6">正在加载…</p> : items.length === 0 ? <p className="mt-6 text-ink-3">暂无检索记录。</p> : <ul className="mt-6">
      {items.map((item) => <li key={item.id} className="border-b border-rule-soft py-4">
        <Link href={`/literature/${encodeURIComponent(item.id)}`} className="font-display text-lg font-semibold hover:text-rubric">{item.display_title || item.question}</Link>
        <p className="mt-2 text-sm text-ink-3">{runStatusLabel(item.status)} · {item.result_count} 条结果 · {item.source}</p>
        {editId === item.id ? <form className="mt-3 flex gap-3" onSubmit={(event) => { event.preventDefault(); if (title.trim()) void mutate(() => renameSearch(item.id, title)); }}><label className="sr-only" htmlFor="history-title">新标题</label><input id="history-title" className="border border-rule bg-paper-hi p-2" maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} /><button disabled={busy || !title.trim()} type="submit">保存</button><button type="button" onClick={() => setEditId(null)}>取消</button></form> : <div className="mt-3 flex gap-4 text-sm"><button disabled={busy} onClick={() => { setEditId(item.id); setTitle(item.display_title || item.question); setConfirmId(null); }}>重命名</button>{confirmId === item.id ? <><span role="alert">确定删除这条检索？</span><button autoFocus aria-label={`确认删除：${item.display_title || item.question}`} disabled={busy} onClick={() => void mutate(() => deleteSearch(item.id))}>确认删除</button><button disabled={busy} onClick={() => { restoreDeleteFocus.current = item.id; setConfirmId(null); }}>取消</button></> : <button ref={(node) => { if (node && restoreDeleteFocus.current === item.id) { restoreDeleteFocus.current = null; node.focus(); } }} disabled={busy} onClick={() => setConfirmId(item.id)}>删除</button>}</div>}
      </li>)}
    </ul>}
    <div className="mt-6 flex gap-4"><button disabled={loading || busy || cursors.length <= 1} onClick={() => void load(query, cursors.slice(0, -1))}>上一页</button><button disabled={loading || busy || !next} onClick={() => { if (next) void load(query, [...cursors, next]); }}>下一页</button></div>
  </main>;
}
