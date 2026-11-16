'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createRun, listHistory, listSources, PaperSeekApiError } from '@/lib/paperseek/client';
import type { PaperSeekRun, PaperSeekSource } from '@/lib/paperseek/types';
import { Arrow, Eye } from './ui';

type HomeData = { sources: PaperSeekSource[]; recent: PaperSeekRun | null };

export default function LiteratureHome({ mockData }: { mockData?: HomeData }) {
  const router = useRouter();
  const [sources, setSources] = useState<PaperSeekSource[]>(mockData?.sources ?? []);
  const [recent, setRecent] = useState<PaperSeekRun | null>(mockData?.recent ?? null);
  const [source, setSource] = useState(mockData?.sources.find((s) => s.default)?.id ?? 'openalex');
  const [question, setQuestion] = useState('');
  const [budget, setBudget] = useState('fast');
  const [fields, setFields] = useState<string[]>([]);
  const [hint, setHint] = useState('');
  const [citation, setCitation] = useState(true);
  const [wosDb, setWosDb] = useState('WOS');
  const [problem, setProblem] = useState('');
  const [offline, setOffline] = useState(false);
  const [starting, setStarting] = useState(false);
  const [sourceError, setSourceError] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (mockData) return;
    let active = true;
    void listSources().then((available) => {
      if (!active) return;
      setSources(available);
      setSource(available.find((item) => item.default)?.id ?? 'openalex');
    }).catch(() => { if (active) setSourceError(true); });
    void listHistory({ limit: 1 }).then((history) => {
      if (active) setRecent(history.items[0] ?? null);
    }).catch(() => { if (active) setHistoryError(true); });
    return () => { active = false; };
  }, [mockData]);

  const selected = sources.find((item) => item.id === source);
  const defaultSource = sources.find((item) => item.default);
  async function start() {
    if (mockData || starting || !question.trim()) return;
    setStarting(true);
    setProblem('');
    try {
      const run = await createRun({
        question: question.trim(), source, search_budget: budget,
        ...(selected?.capabilities.filter.mode === 'native' ? { field_ids: fields } : {}),
        ...(selected?.capabilities.filter.mode === 'text' ? { field_hint: hint } : {}),
        ...(selected?.capabilities.citation_expansion ? { citation_enabled: citation } : {}),
        ...(source === 'wos' ? { wos_db: wosDb } : {}),
      });
      if (mounted.current) router.push(`/literature/${encodeURIComponent(run.id)}`);
    } catch (error) {
      if (!mounted.current) return;
      setOffline(!(error instanceof PaperSeekApiError) || error.status === 503);
      setProblem(error instanceof PaperSeekApiError ? `${error.message} (${error.code})` : '无法连接 PaperSeek，请检查服务。');
    } finally {
      if (mounted.current) setStarting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[860px] px-5 pb-16 pt-[9vh] sm:px-8 sm:pt-[12vh]">
      <Eye>PaperSeek · 文献检索</Eye>
      <h1 className="mt-5 font-display text-[clamp(2.4rem,4.6vw,4.2rem)] font-semibold leading-[1.08] tracking-[-0.03em]">新建文献检索</h1>
      <p className="mt-4 text-ink-3">输入研究问题，发现相关文献。</p>
      <form className="mt-9" onSubmit={(event) => { event.preventDefault(); void start(); }}>
        <div className="bg-paper-hi px-5 pb-5 pt-5 shadow-[inset_0_0_0_1px_rgba(29,25,21,0.26)] focus-within:shadow-[inset_0_0_0_1px_#1A1612] sm:px-6">
          <label htmlFor="literature-question" className="sr-only">研究问题</label>
          <textarea id="literature-question" rows={3} maxLength={10000} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="输入研究问题或主题" className="gr-input w-full resize-y bg-transparent font-display text-[21px] leading-snug outline-none sm:text-[23px]" />
          <div className="mt-4 flex justify-end"><button type="submit" className="gr-btn" disabled={Boolean(mockData) || starting || !question.trim()}>{starting ? '正在创建' : '开始检索'} <Arrow /></button></div>
        </div>
        {mockData && <p className="mt-3 text-sm text-ink-3">预览模式：不会提交真实检索。</p>}
        {sourceError && <p role="alert" className="mt-3 text-sm text-rubric">数据源加载失败，请稍后重试。</p>}
        {historyError && <p role="alert" className="mt-3 text-sm text-rubric">检索历史加载失败，请稍后重试。</p>}
        {problem && <p role="alert" className="mt-3 text-sm text-rubric">{problem}</p>}
        {offline && <p role="alert" className="mt-3 text-sm text-rubric">PaperSeek 暂不可用，输入内容会保留。请检查服务或前往 <Link href="/settings?tab=paperseek" className="underline underline-offset-4">PaperSeek 设置</Link>。</p>}
        <div className="mt-6 flex flex-wrap gap-x-8 gap-y-4 text-sm">
          <label>数据源　<select className="gr-select" value={source} onChange={(event) => { setSource(event.target.value); setFields([]); setHint(''); setCitation(true); }}>{sources.length === 0 && <option value="openalex">OpenAlex</option>}{sources.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label>检索预算　<select className="gr-select" value={budget} onChange={(event) => setBudget(event.target.value)}><option value="fast">快速</option><option value="medium">中等</option><option value="high">深入</option><option value="max">最大</option></select></label>
        </div>
        <details className="mt-6 border-t border-rule-soft pt-4 text-sm">
          <summary className="cursor-pointer font-medium">高级条件</summary>
          <div className="mt-4 flex flex-col gap-4">
            {selected?.capabilities.filter.mode === 'native' && <fieldset><legend>{selected.capabilities.filter.label}</legend><div className="mt-2 flex flex-wrap gap-3">{selected.capabilities.filter.options.map((option) => <label key={option.id}><input type="checkbox" checked={fields.includes(option.id)} onChange={(event) => setFields(event.target.checked ? [...fields, option.id] : fields.filter((id) => id !== option.id))} /> {option.label}</label>)}</div></fieldset>}
            {selected?.capabilities.filter.mode === 'text' && <label>{selected.capabilities.filter.label} <input className="ml-2 border border-rule bg-paper-hi p-2" maxLength={500} value={hint} onChange={(event) => setHint(event.target.value)} /></label>}
            {selected?.capabilities.citation_expansion && <label><input type="checkbox" checked={citation} onChange={(event) => setCitation(event.target.checked)} /> 启用引用扩展</label>}
            {source === 'wos' && <label>Web of Science 数据库 <input className="ml-2 border border-rule bg-paper-hi p-2" maxLength={64} value={wosDb} onChange={(event) => setWosDb(event.target.value)} /></label>}
            {!selected && <span className="text-ink-3">{sourceError ? '数据源加载后可查看高级条件。' : '正在加载高级条件。'}</span>}
          </div>
        </details>
      </form>
      <section className="mt-14 border-t border-rule-soft pt-4" aria-labelledby="default-source"><h2 id="default-source" className="gr-meta">默认数据源</h2><p className="mt-3 text-sm">{defaultSource?.label ?? 'OpenAlex'} · 可在 <Link href="/settings?tab=paperseek" className="underline underline-offset-4">设置</Link> 中修改。</p></section>
      <section className="mt-12" aria-labelledby="recent-search"><div className="flex items-baseline justify-between border-b border-ink pb-3"><h2 id="recent-search" className="gr-meta">最近检索</h2></div>{recent ? <Link href={`/literature/${encodeURIComponent(recent.id)}`} className="block border-b border-rule-soft py-4 hover:text-rubric"><span className="font-display text-lg font-semibold">{recent.display_title || recent.question}</span><span className="mt-2 block text-sm text-ink-3">{recent.status} · {recent.result_count} 条结果 · {sources.find((item) => item.id === recent.source)?.label ?? recent.source} · 查看 →</span></Link> : !historyError && <p className="py-4 text-sm text-ink-3">暂无检索记录。</p>}</section>
    </main>
  );
}
