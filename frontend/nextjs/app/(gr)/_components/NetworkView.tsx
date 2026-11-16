'use client';
import { useState } from 'react';
import { buildNetwork } from '@/lib/paperseek/client';
import { layoutNetwork } from '@/lib/paperseek/network';
import type { PaperSeekMetricNetwork, PaperSeekNetworkParameters } from '@/lib/paperseek/types';

export default function NetworkView({ id }: { id: string }) {
  const [params, setParams] = useState<PaperSeekNetworkParameters>({ kind: 'keywords', min_occurrences: 2, max_nodes: 100, max_edges: 500, min_weight: 1 });
  const [frequency, setFrequency] = useState('');
  const [network, setNetwork] = useState<PaperSeekMetricNetwork | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true); setError('');
    try { setNetwork(await buildNetwork(id, { ...params, ...(params.kind === 'coupling' && frequency ? { max_reference_frequency: Number(frequency) } : {}) })); }
    catch (e) { setError(e instanceof Error ? e.message : '网络生成失败'); } finally { setBusy(false); }
  }
  const layout = network ? layoutNetwork(network, 800, 500) : null;
  const positions = new Map(layout?.nodes.map((node) => [node.id, node]));
  const weights = new Map<string, number>();
  network?.edges.forEach((edge) => { weights.set(edge.source, (weights.get(edge.source) ?? 0) + edge.weight); if (edge.target !== edge.source) weights.set(edge.target, (weights.get(edge.target) ?? 0) + edge.weight); });
  return <section className="mt-12"><h2 className="font-display text-2xl">网络分析</h2>
    <form className="mt-4 flex flex-wrap items-end gap-4" onSubmit={(event) => { event.preventDefault(); if (!busy) void submit(); }}>
      <label>网络类型<select className="block border border-rule bg-paper-hi p-2" value={params.kind} onChange={(event) => setParams({ ...params, kind: event.target.value as 'keywords' | 'coupling' })}><option value="keywords">关键词共现</option><option value="coupling">文献耦合</option></select></label>
      {([['min_occurrences', '最少出现次数', 1, 10000], ['min_weight', '最小边权重', 1, 10000], ['max_nodes', '最多节点', 10, 300], ['max_edges', '最多连边', 10, 2000]] as const).map(([key, label, min, max]) => <label key={key}>{label}<input className="block w-24 border border-rule bg-paper-hi p-2" type="number" required min={min} max={max} value={params[key] ?? ''} onChange={(event) => setParams({ ...params, [key]: Number(event.target.value) })} /></label>)}
      {params.kind === 'coupling' && <label>参考文献最大频次（可选）<input className="block w-28 border border-rule bg-paper-hi p-2" type="number" min={2} max={10000} value={frequency} onChange={(event) => setFrequency(event.target.value)} /></label>}
      <button className="gr-btn" disabled={busy} type="submit">生成网络</button>
    </form>
    {error && <p role="alert" className="mt-4 text-rubric">{error}</p>}
    {network && layout && <div className="mt-5"><p>语料 {network.corpus_count} 篇 · 符合条件的论文 {network.eligible_paper_count} · 显示节点 {network.nodes.length} / 符合条件的节点 {network.eligible_node_count} · 显示连边 {network.edges.length} / 连边总数 {network.total_edge_count} · 排除参考文献 {network.excluded_reference_count}</p>
      {network.warnings?.length > 0 && <div role="status" className="mt-3"><strong>网络提示</strong><ul>{network.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></div>}
      <svg className="mt-4 w-full border border-rule" viewBox="0 0 800 500" role="img" aria-label="网络图，节点清单位于图后">
        {layout.edges.map((edge, i) => { const from = positions.get(edge.source), to = positions.get(edge.target); return from && to ? <line key={`${edge.source}-${edge.target}-${i}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="currentColor" strokeOpacity="0.25" /> : null; })}
        {layout.nodes.map((node) => <g key={node.id}><circle cx={node.x} cy={node.y} r={Math.min(14, 4 + Math.sqrt(node.count))} fill="currentColor" /><title>{node.label}: {node.count}</title></g>)}
      </svg>
      <h3 className="mt-5 font-semibold">节点列表（按关联边权重总和排序）</h3><ol className="mt-2 max-h-80 overflow-auto">{[...network.nodes].sort((a, b) => (weights.get(b.id) ?? 0) - (weights.get(a.id) ?? 0) || b.count - a.count).map((node) => <li data-network-node key={node.id}>{node.label} · 权重 {weights.get(node.id) ?? 0} · 出现 {node.count}</li>)}</ol>
    </div>}
  </section>;
}
