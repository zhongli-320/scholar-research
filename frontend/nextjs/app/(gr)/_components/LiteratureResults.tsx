'use client';

import { useEffect, useRef, useState } from 'react';
import { exportRun, exportSelected, getResults, PaperSeekApiError } from '@/lib/paperseek/client';
import type { PaperSeekFilters, PaperSeekResultPage } from '@/lib/paperseek/types';

const errorText = (error: unknown) => error instanceof PaperSeekApiError ? `${error.message} (${error.code})` : '无法加载 PaperSeek 数据。';
const journals = ['ranked', 'cas1', 'cas2', 'cas3', 'castop', 'jcr1', 'jcr2', 'ccfa', 'ccfb', 'ccfc', 'pku', 'cssci', 'cssci_c', 'cssci_e'];
type ResultRequest = { filters: PaperSeekFilters; cursors: string[] };

export default function LiteratureResults({ id }: { id: string }) {
  const [filters, setFilters] = useState<PaperSeekFilters>({ page_size: 50, sort: 'rank' });
  const [request, setRequest] = useState<ResultRequest>({ filters, cursors: [] });
  const [applied, setApplied] = useState(request);
  const [page, setPage] = useState<PaperSeekResultPage | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [format, setFormat] = useState('bibtex');
  const [problem, setProblem] = useState('');
  const [resultProblem, setResultProblem] = useState('');
  const [loading, setLoading] = useState(true);
  const pending = useRef(true);
  useEffect(() => {
    let active = true;
    pending.current = true; setLoading(true);
    void getResults(id, request.filters).then((value) => {
      if (active) { setPage(value); setApplied(request); setResultProblem(''); }
    }).catch((error) => { if (active) setResultProblem(errorText(error)); }).finally(() => { if (active) { pending.current = false; setLoading(false); } });
    return () => { active = false; };
  }, [id, request]);
  function requestResults(next: ResultRequest) {
    pending.current = true;
    setLoading(true);
    setRequest(next);
  }
  const { cursors } = applied;
  const previousCursor = cursors[cursors.length - 1];
  async function downloadSelected() {
    setProblem('');
    try {
      const response = await exportSelected(id, format, selected);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const name = response.headers.get('content-disposition')?.match(/filename="?([^";]+)"?/i)?.[1];
      anchor.href = objectUrl; anchor.download = name || `paperseek.${format}`; anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (error) { setProblem(errorText(error)); }
  }
  return <section className="mt-10 border-t border-ink pt-5">
    <h2 className="font-display text-2xl font-semibold">检索结果</h2>
    {problem && <p role="alert" className="mt-3 text-sm text-rubric">{problem}</p>}
    {resultProblem && <p role="alert" className="mt-3 text-sm text-rubric">结果：{resultProblem} <button type="button" className="underline disabled:opacity-50" disabled={loading} onClick={() => { if (!pending.current) requestResults({ ...request }); }}>重试结果</button></p>}
    <form className="mt-5 flex flex-wrap items-end gap-3 text-sm" onSubmit={(event) => { event.preventDefault(); setProblem(''); setPage(null); requestResults({ filters: { ...filters, cursor: undefined }, cursors: [] }); }}>
      <label>关键词 <input className="border border-rule bg-paper-hi p-2" value={filters.query ?? ''} onChange={(event) => setFilters({ ...filters, query: event.target.value })} /></label>
      <label>最低分 <input className="w-20 border border-rule bg-paper-hi p-2" type="number" step="any" value={filters.min_score ?? ''} onChange={(event) => setFilters({ ...filters, min_score: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
      <label>元数据 <select className="gr-select" value={filters.metadata ?? ''} onChange={(event) => setFilters({ ...filters, metadata: event.target.value })}><option value="">全部</option><option value="abstract">有摘要</option><option value="doi">有 DOI</option><option value="pdf">有 PDF</option></select></label>
      <label>排序 <select className="gr-select" value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}><option value="rank">默认排名</option><option value="score">相关性</option><option value="citations">引用数</option><option value="year">年份</option><option value="impact">期刊影响</option></select></label>
      <label>期刊 <select className="gr-select" value={filters.journal ?? ''} onChange={(event) => setFilters({ ...filters, journal: event.target.value })}><option value="">全部</option>{journals.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select></label>
      <label>录用 <select className="gr-select" value={filters.acceptance ?? ''} onChange={(event) => setFilters({ ...filters, acceptance: event.target.value })}><option value="">全部</option><option value="accepted">已录用</option><option value="oral">Oral</option><option value="spotlight">Spotlight</option></select></label>
      <label>每页 <select className="gr-select" value={filters.page_size} onChange={(event) => setFilters({ ...filters, page_size: Number(event.target.value) })}>{[20, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
      <button className="gr-btn" type="submit">筛选</button>
    </form>
    {page && <><p className="mt-5 text-sm text-ink-3">共 {page.total_count} 条 · 匹配 {page.matched_count} 条 · 已评分 {page.scored_count} 条 · 高分 {page.high_score_count} 条 · 最高分 {page.max_score ?? '—'}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm"><label>导出格式 <select className="gr-select" value={format} onChange={(event) => setFormat(event.target.value)}>{['bibtex', 'ris', 'csv', 'json'].map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select></label><a className="underline" href={exportRun(id, format)}>导出全部</a><button type="button" className="underline disabled:opacity-50" disabled={!selected.length} onClick={() => void downloadSelected()}>导出选中（{selected.length}）</button></div>
      <ol>{page.results.map((item) => <li key={item.uid || item.rank} className="border-b border-rule-soft py-5"><label className="flex items-start gap-3"><input type="checkbox" checked={selected.includes(item.uid)} disabled={!item.uid} onChange={(event) => setSelected(event.target.checked ? [...selected, item.uid] : selected.filter((uid) => uid !== item.uid))} /><span className="font-display text-lg font-semibold">{item.rank}. {item.title}</span></label><div className="mt-2 pl-7 text-sm text-ink-3">{item.authors?.join(', ')} · {item.year ?? '年份未知'} · {item.venue} · 引用 {item.citation_count} · 相关性 {item.relevance_score ?? '—'}{item.doi && <> · DOI: {item.doi}</>}</div>{item.journal_metrics && <div className="mt-2 flex flex-wrap gap-2 pl-7 text-xs">{item.journal_metrics.jcr?.quartile && <span className="border border-rule-soft px-2 py-1">JCR {item.journal_metrics.jcr.quartile}</span>}{item.journal_metrics.jcr?.impact_factor != null && <span className="border border-rule-soft px-2 py-1">IF {item.journal_metrics.jcr.impact_factor}</span>}{item.journal_metrics.cas?.tier != null && <span className="border border-rule-soft px-2 py-1">中科院 {item.journal_metrics.cas.tier} 区</span>}{item.journal_metrics.cas?.top && <span className="border border-rule-soft px-2 py-1">Top</span>}{item.journal_metrics.ccf?.rank && <span className="border border-rule-soft px-2 py-1">CCF {item.journal_metrics.ccf.rank}</span>}</div>}{item.abstract && <p className="mt-3 pl-7 text-sm">摘要：{item.abstract}</p>}{item.relevance_reason && <p className="mt-2 pl-7 text-sm">相关性理由：{item.relevance_reason}</p>}{/^https?:\/\//i.test(item.url) && <a className="ml-7 mt-2 inline-block text-sm underline" href={item.url} target="_blank" rel="noreferrer">查看原文记录 ↗</a>}</li>)}</ol>
      <div className="mt-5 flex gap-5 text-sm"><button type="button" className="underline disabled:opacity-50" disabled={loading || !cursors.length} onClick={() => { if (!pending.current) requestResults({ filters: { ...applied.filters, cursor: previousCursor || undefined }, cursors: cursors.slice(0, -1) }); }}>上一页</button><button type="button" className="underline disabled:opacity-50" disabled={loading || !page.next_cursor} onClick={() => { if (!pending.current) requestResults({ filters: { ...applied.filters, cursor: page.next_cursor || undefined }, cursors: [...cursors, applied.filters.cursor || ''] }); }}>下一页</button></div></>}
  </section>;
}
