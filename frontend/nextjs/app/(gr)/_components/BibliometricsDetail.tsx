'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { exportAnalysis, getAnalysis } from '@/lib/paperseek/client';
import type { MetricBucket, PaperSeekAnalysis } from '@/lib/paperseek/types';
import NetworkView from './NetworkView';

export default function BibliometricsDetail({ id }: { id: string }) {
  const [analysis, setAnalysis] = useState<PaperSeekAnalysis | null>(null); const [error, setError] = useState('');
  useEffect(() => { let active = true; getAnalysis(id).then((result) => { if (active) setAnalysis(result); }).catch((e) => { if (active) setError(e.message); }); return () => { active = false; }; }, [id]);
  if (error) return <main className="mx-auto max-w-[860px] p-8"><p role="alert">{error}</p><Link href="/bibliometrics">返回文献计量</Link></main>;
  if (!analysis) return <main className="mx-auto max-w-[860px] p-8">正在加载分析…</main>;
  const s = analysis.statistics;
  const groups: [string, MetricBucket[], string?][] = [['年份', s.years, 'year'], ['期刊和来源', s.venues, 'venue'], ['数据提供方', s.providers, 'provider'], ['文献类型', s.document_types, 'document_types'], ['作者', s.authors, 'authors'], ['机构', s.institutions, 'institutions'], ['国家', s.countries, 'countries'], ['关键词', s.keywords, 'keywords'], ['关键词来源', s.keyword_sources, 'keyword_source'], ['引用来源', s.citation_sources, 'citation_source'], ['中科院分区', s.cas_tiers], ['JCR 分区', s.jcr_quartiles], ['CCF 等级', s.ccf_ranks]];
  const categoryLabel = (key?: string) => {
    const total = key ? s.category_totals?.[key] : undefined;
    if (total === undefined) return '';
    return key !== 'year' && total > s.category_limit ? `前 ${s.category_limit} / 共 ${total}` : `共 ${total}`;
  };
  const citationsMissing = s.coverage.find((item) => item.field === 'citations')?.available === 0;
  const scope = analysis.scope === 'retrieved_candidates' ? '检索候选文献' : analysis.scope === 'legacy_ranked_only' ? '历史排序结果' : analysis.scope;
  return <main className="mx-auto w-full max-w-[860px] px-5 pb-16 pt-[9vh] sm:px-8"><Link href="/bibliometrics" className="text-sm hover:text-rubric">← 文献计量</Link><h1 className="mt-4 font-display text-4xl font-semibold">{analysis.title}</h1>
    <p className="mt-4">论文 {s.paper_count} 篇 · 已评分 {s.scored_count} 篇 · {citationsMissing ? '引用数据缺失（有引用篇数未知）' : `引用 ${s.citation_sum} 次 · 有引用 ${s.cited_paper_count} 篇`} · 已匹配期刊分区 {s.ranked_paper_count ?? 0} 篇 · 中科院 Top {s.cas_top_count ?? 0} 篇</p>
    <p className="mt-2 text-sm text-ink-3">范围：{scope} · 来源检索：{analysis.source_run_id} · 来源报告总量：{analysis.source_reported_total ?? '未知'} · 检索池上限：{analysis.retrieval_pool_limit ?? '未知'} · 评分上限：{analysis.scoring_limit ?? '未知'}</p>
    {analysis.warnings.length > 0 && <section role="status" className="mt-4"><h2 className="font-semibold">分析提示</h2><ul>{analysis.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></section>}
    <div className="mt-5 flex gap-4"><a className="underline" href={exportAnalysis(id, 'csv')}>下载 CSV</a><a className="underline" href={exportAnalysis(id, 'json')}>下载 JSON</a></div>
    <div className="mt-8 grid gap-5 sm:grid-cols-2">{groups.map(([label, buckets, key]) => <section key={label} className="border-t border-rule pt-3"><h2 className="font-semibold">{label} <span className="text-sm font-normal text-ink-3">{categoryLabel(key)}</span></h2>{buckets?.length ? <ul className="mt-2 max-h-64 overflow-auto text-sm">{buckets.map((bucket, i) => <li key={`${bucket.label}-${i}`} className="flex justify-between gap-4"><span>{bucket.label}</span><span>{bucket.count}</span></li>)}</ul> : <p className="mt-2 text-sm text-ink-3">暂无数据</p>}</section>)}
    <section className="border-t border-rule pt-3"><h2 className="font-semibold">字段覆盖</h2><ul className="mt-2 text-sm">{s.coverage.map((item) => <li key={item.field}>{item.field}：{item.available} / {item.total}</li>)}</ul></section></div>
    <section className="mt-8 border-t border-rule pt-3"><h2 className="font-semibold">匹配期刊分区与影响因子 <span className="text-sm font-normal text-ink-3">{categoryLabel('ranked_venues')}</span></h2>{s.ranked_venues?.length ? <div className="mt-2 max-h-80 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th>期刊</th><th>篇数</th><th>中科院分区</th><th>Top</th><th>JCR</th><th>影响因子</th><th>CCF</th></tr></thead><tbody>{s.ranked_venues.map((venue) => <tr key={venue.label}><td>{venue.label}</td><td>{venue.count}</td><td>{venue.cas_tier ?? '—'}</td><td>{venue.cas_top ? '是' : '—'}</td><td>{venue.jcr_quartile || '—'}</td><td>{venue.impact_factor ?? '—'}</td><td>{venue.ccf_rank || '—'}</td></tr>)}</tbody></table></div> : <p className="mt-2 text-sm text-ink-3">暂无数据</p>}</section>
    <NetworkView id={id} />
  </main>;
}
