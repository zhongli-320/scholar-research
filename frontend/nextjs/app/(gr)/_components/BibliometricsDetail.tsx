'use client';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { exportAnalysis, getAnalysis } from '@/lib/paperseek/client';
import type { MetricBucket, PaperSeekAnalysis } from '@/lib/paperseek/types';
import { analysisScopeLabel } from '@/lib/paperseek/bibliometrics';

type Metric = { title: string; items: MetricBucket[]; category?: string };

const coverageLabels: Record<string, string> = {
  year: '发表年份', venue: '期刊与来源', authors: '作者', institutions: '机构', countries: '国家或地区', keywords: '关键词',
  references: '参考文献', citations: '被引数据', doi: 'DOI', references_available: '参考文献可用性',
};

function MetricCard({ title, note, items }: { title: string; note: string; items: MetricBucket[] }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return <section className="border border-rule-soft bg-paper-hi p-5 shadow-[0_18px_50px_-42px_rgba(29,25,21,.7)]">
    <div className="flex items-baseline justify-between gap-4 border-b border-rule-soft pb-3">
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      {note && <span className="shrink-0 font-code text-[10px] uppercase tracking-[0.12em] text-ink-3">{note}</span>}
    </div>
    {items.length ? <ul className="gr-scroll mt-4 max-h-72 space-y-3 overflow-auto pr-1 text-sm">{items.map((item, i) => <li key={`${item.label}-${i}`}>
      <div className="mb-1.5 flex items-end justify-between gap-4"><span className="min-w-0 truncate" title={item.label}>{item.label}</span><span className="shrink-0 font-code text-xs text-ink-3">{item.count.toLocaleString()}</span></div>
      <div className="h-1.5 overflow-hidden bg-paper-deep"><span className="block h-full bg-rubric" style={{ width: `${Math.max(2, item.count / max * 100)}%` }} /></div>
    </li>)}</ul> : <p className="mt-4 text-sm text-ink-3">暂无数据</p>}
  </section>;
}

function Stat({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <div className="border border-rule-soft bg-paper-hi p-5"><p className="gr-meta">{label}</p><p className="mt-3 font-display text-3xl font-semibold tracking-[-0.03em]">{value}</p><p className="mt-1 text-xs text-ink-3">{detail}</p></div>;
}

function DistributionGroup({ title, description, metrics, label, children }: { title: string; description: string; metrics: Metric[]; label: (key?: string) => string; children?: ReactNode }) {
  return <section className="mt-8 border-t border-rule pt-5">
    <div className="mb-4 max-w-2xl"><h3 className="font-display text-2xl font-semibold">{title}</h3><p className="mt-1 text-sm text-ink-3">{description}</p></div>
    <div className="grid gap-4 md:grid-cols-2">{metrics.map((metric) => <MetricCard key={metric.title} title={metric.title} note={label(metric.category)} items={metric.items ?? []} />)}</div>
    {children}
  </section>;
}

export default function BibliometricsDetail({ id }: { id: string }) {
  const [state, setState] = useState<{ id: string; analysis?: PaperSeekAnalysis; error?: string }>({ id });
  useEffect(() => {
    let active = true; setState({ id });
    getAnalysis(id).then((analysis) => { if (active) setState({ id, analysis }); }).catch((e) => { if (active) setState({ id, error: e instanceof Error ? e.message : '加载失败' }); });
    return () => { active = false; };
  }, [id]);
  if (state.id !== id) return <main className="mx-auto max-w-[1180px] p-8">正在加载分析…</main>;
  if (state.error) return <main className="mx-auto max-w-[1180px] p-8"><p role="alert">{state.error}</p><Link href="/bibliometrics">返回文献计量</Link></main>;
  const analysis = state.analysis;
  if (!analysis) return <main className="mx-auto max-w-[1180px] p-8">正在加载分析…</main>;
  const s = analysis.statistics;
  const categoryLabel = (key?: string) => {
    const total = key ? s.category_totals?.[key] : undefined;
    if (total === undefined) return '';
    return key !== 'year' && total > s.category_limit ? `前 ${s.category_limit} / 共 ${total}` : `共 ${total}`;
  };
  const distributions = [
    { title: '时间与文献载体', description: '观察研究成果的时间演进及主要发表载体。', metrics: [
      { title: '年份', items: [...(s.years ?? [])].sort((a, b) => Number(b.label) - Number(a.label)), category: 'year' },
      { title: '期刊和来源', items: s.venues, category: 'venue' }, { title: '文献类型', items: s.document_types, category: 'document_types' },
    ] },
    { title: '研究主体与地域', description: '识别主要作者、研究机构及成果的地域分布。', metrics: [
      { title: '作者', items: s.authors, category: 'authors' }, { title: '机构', items: s.institutions, category: 'institutions' }, { title: '国家或地区', items: s.countries, category: 'countries' },
    ] },
    { title: '研究主题', description: '通过高频关键词概览研究议题与概念结构。', metrics: [{ title: '关键词', items: s.keywords, category: 'keywords' }] },
    { title: '期刊评价', description: '汇总已匹配期刊的主要分区与等级信息。', metrics: [
      { title: '中科院分区', items: s.cas_tiers }, { title: 'JCR 分区', items: s.jcr_quartiles }, { title: 'CCF 等级', items: s.ccf_ranks },
    ] },
  ];
  const coverage = s.coverage.filter((item) => item.field !== 'venue_rank');
  const citationsMissing = s.coverage.find((item) => item.field === 'citations')?.available === 0;
  const scope = analysisScopeLabel(analysis.scope);
  return <main className="mx-auto w-full max-w-[1180px] px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
    <Link href="/bibliometrics" className="font-code text-[11px] uppercase tracking-[0.12em] text-ink-3 transition-colors hover:text-rubric">← 文献计量</Link>
    <header className="mt-5 border-b border-rule pb-7"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="gr-eye">Bibliometric analysis</p><h1 className="mt-4 max-w-4xl font-display text-4xl font-semibold leading-[1.05] tracking-[-0.035em] sm:text-5xl">{analysis.title}</h1></div><div className="flex shrink-0 gap-2"><a className="gr-btn-line" href={exportAnalysis(id, 'csv')}>CSV</a><a className="gr-btn-line" href={exportAnalysis(id, 'json')}>JSON</a></div></div><p className="mt-5 max-w-5xl text-sm leading-6 text-ink-3">范围：{scope} · 来源检索：{analysis.source_run_id} · 来源报告总量：{analysis.source_reported_total ?? '未知'} · 检索池上限：{analysis.retrieval_pool_limit ?? '未知'} · 评分上限：{analysis.scoring_limit ?? '未知'}</p></header>

    <section className="mt-8" aria-labelledby="overview-heading"><div className="mb-4 flex items-end justify-between"><div><p className="gr-meta">Overview</p><h2 id="overview-heading" className="mt-2 font-display text-2xl font-semibold">分析概览</h2></div><p className="hidden text-sm text-ink-3 sm:block">论文 {s.paper_count} 篇 · 已评分 {s.scored_count} 篇</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Stat label="论文" value={s.paper_count} detail={`${s.scored_count ?? 0} 篇已评分`} /><Stat label="总引用" value={citationsMissing ? '—' : s.citation_sum} detail={citationsMissing ? '引用数据缺失（有引用篇数未知）' : `${s.cited_paper_count ?? 0} 篇有引用`} /><Stat label="期刊分区" value={s.ranked_paper_count ?? 0} detail="已匹配论文" /><Stat label="中科院 Top" value={s.cas_top_count ?? 0} detail="高水平期刊论文" /><Stat label="数据范围" value={scope} detail="本次分析口径" /></div></section>

    <section className="mt-12" aria-labelledby="distribution-heading"><p className="gr-meta">Distributions</p><h2 id="distribution-heading" className="mt-2 font-display text-3xl font-semibold">文献分布</h2>{distributions.map((group) => <DistributionGroup key={group.title} {...group} label={categoryLabel}>{group.title === '期刊评价' && <section className="mt-4 border border-rule-soft bg-paper-hi" aria-labelledby="journal-heading"><div className="flex items-baseline justify-between gap-4 border-b border-rule-soft px-5 py-4"><h3 id="journal-heading" className="font-display text-xl font-semibold">匹配期刊分区与影响因子</h3><span className="font-code text-[10px] uppercase tracking-[0.12em] text-ink-3">{categoryLabel('ranked_venues')}</span></div>{s.ranked_venues?.length ? <div className="gr-scroll max-h-[420px] overflow-auto"><table className="w-full min-w-[760px] border-collapse text-left text-sm"><thead className="sticky top-0 bg-paper-deep"><tr>{['期刊', '篇数', '中科院分区', 'Top', 'JCR', '影响因子', 'CCF'].map((heading) => <th key={heading} className="border-b border-rule-soft px-5 py-3 font-code text-[10px] uppercase tracking-[0.1em] text-ink-3">{heading}</th>)}</tr></thead><tbody>{s.ranked_venues.map((venue) => <tr key={venue.label} className="border-b border-rule-soft last:border-0 hover:bg-paper"><td className="px-5 py-3 font-medium">{venue.label}</td><td className="px-5 py-3 font-code">{venue.count}</td><td className="px-5 py-3">{venue.cas_tier ?? '—'}</td><td className="px-5 py-3">{venue.cas_top ? '是' : '—'}</td><td className="px-5 py-3">{venue.jcr_quartile || '—'}</td><td className="px-5 py-3 font-code">{venue.impact_factor ?? '—'}</td><td className="px-5 py-3">{venue.ccf_rank || '—'}</td></tr>)}</tbody></table></div> : <p className="p-5 text-sm text-ink-3">暂无数据</p>}</section>}</DistributionGroup>)}</section>

    <section className="mt-12 border-t border-rule pt-5" aria-labelledby="coverage-heading"><div className="mb-4 max-w-2xl"><h2 id="coverage-heading" className="font-display text-2xl font-semibold">数据质量</h2><p className="mt-1 text-sm text-ink-3">查看各项文献元数据在本次分析中的覆盖情况。</p></div><div className="border border-rule-soft bg-paper-hi p-5"><h3 className="border-b border-rule-soft pb-3 font-display text-xl font-semibold">字段覆盖</h3><ul className="mt-4 grid gap-x-8 gap-y-4 text-sm md:grid-cols-2">{coverage.map((item) => { const percentage = item.total ? item.available / item.total * 100 : 0; return <li key={item.field}><div className="mb-1.5 flex justify-between gap-4"><span>{coverageLabels[item.field] ?? '其他字段'}</span><span className="font-code text-xs text-ink-3">{item.available} / {item.total}</span></div><div className="h-1.5 bg-paper-deep"><span className="block h-full bg-ink" style={{ width: `${percentage}%` }} /></div></li>; })}</ul></div></section>

  </main>;
}
