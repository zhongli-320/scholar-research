'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deleteReport, reportsStore, type ReportRow } from '@/lib/research/reports';
import { FaviconStack } from './Favicon';
import { useLinks, useMock } from './mode';
import { Arrow, Eye } from './ui';
import { useReports } from './useReports';

const TYPES = ['简要综述', '详细综述', '深度研究综述', '多智能体综述'];
const UNDO_MS = 6000;

export default function ArchiveScreen() {
  const mock = useMock();
  const links = useLinks();
  const { rows: all, status } = useReports();
  const [filter, setFilter] = useState('全部');
  const [search, setSearch] = useState('');
  const [hidden, setHidden] = useState<string[]>([]);
  const [deleted, setDeleted] = useState<ReportRow>();
  const [problem, setProblem] = useState('');
  const pendingDelete = useRef<string>();

  const rows = useMemo(() => all.filter((r) => !hidden.includes(r.id)), [all, hidden]);
  const filters = ['全部', ...TYPES.filter((t) => rows.some((r) => r.type === t))];

  /** The delete only reaches the backend once the undo window has passed. */
  const commit = useCallback(
    (id: string, keepalive = false) => {
      pendingDelete.current = undefined;
      if (mock) return;
      deleteReport(id, keepalive)
        .then(() => reportsStore.drop(id))
        .catch(() => {
          setHidden((h) => h.filter((x) => x !== id));
          setProblem('无法删除该综述：后端没有响应，记录仍保留在综述历史中。');
        });
    },
    [mock],
  );

  useEffect(() => {
    if (!deleted) return;
    const timer = window.setTimeout(() => {
      commit(deleted.id);
      setDeleted(undefined);
    }, UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [deleted, commit]);

  useEffect(
    () => () => {
      if (pendingDelete.current) commit(pendingDelete.current, true);
    },
    [commit],
  );

  const term = search.trim().toLowerCase();
  const months = useMemo(() => {
    const shown = rows.filter((r) => (filter === '全部' || r.type === filter) && (!term || `${r.title} ${r.question}`.toLowerCase().includes(term)));
    return shown.reduce<Record<string, ReportRow[]>>((acc, r) => ({ ...acc, [r.month]: [...(acc[r.month] ?? []), r] }), {});
  }, [rows, filter, term]);

  const totalWords = rows.reduce((sum, r) => sum + r.words, 0);
  const totalSources = rows.reduce((sum, r) => sum + r.sources, 0);

  const remove = (report: ReportRow) => {
    if (pendingDelete.current) commit(pendingDelete.current);
    pendingDelete.current = report.id;
    setProblem('');
    setHidden((h) => [...h, report.id]);
    setDeleted(report);
  };

  const undo = () => {
    if (!deleted) return;
    pendingDelete.current = undefined;
    setHidden((h) => h.filter((x) => x !== deleted.id));
    setDeleted(undefined);
  };

  return (
    <>
      <main className="mx-auto w-full max-w-[1040px] px-5 pb-40 pt-14 sm:px-8 sm:pt-20">
        <Eye>综述历史</Eye>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="font-display text-[clamp(2.2rem,3.6vw,3.4rem)] font-semibold leading-[1.05] tracking-[-0.025em]">我的综述</h1>
            <p className="mt-3 font-code text-[12px] tabular-nums text-ink-3">
              {rows.length} 篇综述 · {totalWords.toLocaleString('zh-CN')} 字 · 已读 {totalSources} 个来源
            </p>
          </div>
          <label className="flex h-11 w-full items-center gap-3 bg-paper-hi px-4 shadow-[inset_0_0_0_1px_rgba(29,25,21,0.26)] focus-within:shadow-[inset_0_0_0_1px_#1A1612] sm:w-[320px]">
            <span className="sr-only">搜索综述</span>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="text-ink-3">
              <circle cx="7" cy="7" r="4.75" />
              <path d="M10.5 10.5 14 14" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索标题和问题"
              className="gr-input w-full bg-transparent text-[14.5px] outline-none"
            />
          </label>
        </div>

        {filters.length > 2 && (
          <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="综述类型">
            {filters.map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className="gr-btn-line">
                {f}
              </button>
            ))}
          </div>
        )}

        {problem && (
          <p role="alert" className="mt-8 text-[14px] leading-snug text-rubric">
            {problem}
          </p>
        )}

        {all.length === 0 ? (
          <div className="mt-12 border-t border-ink pt-6 text-[15px] text-ink-2">
            {status === 'error' ? (
              <p role="alert">
                无法从后端加载综述。{' '}
                <button type="button" onClick={() => void reportsStore.refresh()} className="font-medium underline decoration-rule underline-offset-4 hover:decoration-rubric">
                  重试
                </button>
              </p>
            ) : status === 'ready' ? (
              <p>
                尚无综述。{' '}
                <Link href={links.home} className="font-medium underline decoration-rule underline-offset-4 hover:decoration-rubric">
                  开始第一次研究
                </Link>
              </p>
            ) : (
              <p role="status">正在加载综述</p>
            )}
          </div>
        ) : (
          Object.keys(months).length === 0 && (
          <p className="mt-12 border-t border-ink pt-6 text-[15px] text-ink-2">
            {term ? `没有与“${search.trim()}”匹配的综述。` : '暂无此类型的综述。'}{' '}
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setFilter('全部');
              }}
              className="font-medium underline decoration-rule underline-offset-4 hover:decoration-rubric"
            >
              显示全部
            </button>
          </p>
          )
        )}

        {Object.entries(months).map(([month, list]) => (
          <section key={month} className="mt-12" aria-label={month}>
            <h2 className="gr-meta border-b border-ink pb-3">{month}</h2>
            <ul>
              {list.map((r) => (
                <li key={r.id} className="group relative border-b border-rule-soft">
                  <Link
                    href={links.report(r.id)}
                    className="grid grid-cols-[56px_minmax(0,1fr)] gap-x-4 gap-y-1 py-5 pr-16 transition-colors hover:bg-paper-hi sm:grid-cols-[72px_minmax(0,1fr)_96px_84px_92px_44px_20px] sm:items-baseline sm:px-2 sm:pr-20"
                  >
                    <span className="font-code text-[11px] uppercase tracking-[0.1em] text-ink-3">{r.date}</span>
                    <span className="min-w-0">
                      <span className="block font-display text-[19px] font-semibold leading-snug group-hover:text-rubric">{r.title}</span>
                      <span className="mt-1 block truncate text-[13.5px] text-ink-3">{r.question}</span>
                    </span>
                    <span className="col-start-2 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 sm:contents">
                      <span className="sm:mt-1 sm:self-start">
                        <FaviconStack domains={r.domains} max={4} label={`来源：${r.domains.join('、')}`} />
                      </span>
                      <span className="font-code text-[11px] uppercase tracking-[0.1em] text-ink-2">{r.type}</span>
                      <span className="font-code text-[11px] tabular-nums text-ink-2">{r.words.toLocaleString('zh-CN')} 字</span>
                    </span>
                    <span className="hidden text-right font-code text-[11px] tabular-nums text-ink-3 sm:block">{r.time}</span>
                    <Arrow className="hidden opacity-0 transition-opacity group-hover:opacity-100 sm:block" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(r)}
                    aria-label={`删除 ${r.title}`}
                    className="absolute right-0 top-5 font-code text-[10.5px] uppercase tracking-[0.1em] text-ink-3 transition-opacity hover:text-rubric focus-visible:opacity-100 sm:right-2 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    删除
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="mt-12 text-[13px] text-ink-3">综述保存在当前连接的后端中，因此可以从任意浏览器访问。</p>
      </main>

      <div role="status" aria-live="polite" className="fixed bottom-[72px] left-1/2 z-50 -translate-x-1/2">
        {deleted && (
          <div className="gr-in flex items-center gap-5 bg-ink px-4 py-3 text-[13.5px] text-paper-hi shadow-lg">
            <span className="max-w-[60vw] truncate">已删除“{deleted.title}”</span>
            <button type="button" onClick={undo} className="font-code text-[11px] uppercase tracking-[0.12em] text-[#E6DDCA] hover:text-paper-hi">
              撤销
            </button>
          </div>
        )}
      </div>
    </>
  );
}
