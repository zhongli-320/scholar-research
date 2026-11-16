import type { PaperSeekMetricNetwork } from './types';

export function layoutNetwork(network: PaperSeekMetricNetwork, width: number, height: number) {
  const w = Number.isFinite(width) ? Math.max(0, width) : 0;
  const h = Number.isFinite(height) ? Math.max(0, height) : 0;
  const nodes = network.nodes.map((node, i) => {
    const angle = 2 * Math.PI * i / network.nodes.length - Math.PI / 2;
    return { ...node, x: w / 2 + Math.cos(angle) * w * 0.4, y: h / 2 + Math.sin(angle) * h * 0.4 };
  });
  return { ...network, nodes };
}
