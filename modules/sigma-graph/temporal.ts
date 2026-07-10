import type {
  SigmaGraphDocument,
  SigmaGraphEdge,
  SigmaGraphNode,
  SigmaGraphTimeWindow,
} from './types';

export function applySigmaGraphTimeWindow(
  document: SigmaGraphDocument,
  window: SigmaGraphTimeWindow | null
): SigmaGraphDocument {
  if (!window || (!window.start && !window.end)) {
    return document;
  }
  const nodes = document.nodes.filter((node) => isTemporalItemVisible(node, window));
  const visibleNodeIds = new Set(nodes.map((node) => node.id));
  const edges = document.edges.filter(
    (edge) =>
      visibleNodeIds.has(edge.source) &&
      visibleNodeIds.has(edge.target) &&
      isTemporalItemVisible(edge, window)
  );
  return { ...document, nodes, edges };
}

export function isTemporalItemVisible(
  item: Pick<SigmaGraphNode | SigmaGraphEdge, 'startedAt' | 'endedAt'>,
  window: SigmaGraphTimeWindow
) {
  const itemStart = parseTimestamp(item.startedAt) ?? Number.NEGATIVE_INFINITY;
  const itemEnd = parseTimestamp(item.endedAt) ?? Number.POSITIVE_INFINITY;
  const windowStart = parseTimestamp(window.start) ?? Number.NEGATIVE_INFINITY;
  const windowEnd = parseTimestamp(window.end) ?? Number.POSITIVE_INFINITY;
  return itemStart <= windowEnd && itemEnd >= windowStart;
}

function parseTimestamp(value?: string) {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}
