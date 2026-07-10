import type { SigmaGraphDocument, SigmaGraphFilter, SigmaGraphFilterContext } from './types';

export function applySigmaGraphFilters(
  document: SigmaGraphDocument,
  filters: SigmaGraphFilter[],
  context?: Partial<SigmaGraphFilterContext>
): SigmaGraphDocument {
  const enabledFilters = filters.filter((filter) => filter.enabled !== false);
  if (enabledFilters.length === 0) {
    return document;
  }
  const filterContext: SigmaGraphFilterContext = {
    document,
    selection: context?.selection || { nodeIds: [], edgeIds: [] },
    timeWindow: context?.timeWindow || null,
  };
  const nodes = document.nodes.filter((node) =>
    enabledFilters.every((filter) => filter.predicate.node?.(node, filterContext) ?? true)
  );
  const visibleNodeIds = new Set(nodes.map((node) => node.id));
  const edges = document.edges.filter(
    (edge) =>
      visibleNodeIds.has(edge.source) &&
      visibleNodeIds.has(edge.target) &&
      enabledFilters.every((filter) => filter.predicate.edge?.(edge, filterContext) ?? true)
  );
  return { ...document, nodes, edges };
}

export function createTypeFilter(id: string, allowedTypes: string[]): SigmaGraphFilter {
  const allowed = new Set(allowedTypes);
  return {
    id,
    predicate: {
      node: (node) => allowed.has(node.type),
      edge: (edge) => allowed.has(edge.type) || allowed.has('edge'),
    },
  };
}
