import type {
  SigmaGraphDocument,
  SigmaGraphEdge,
  SigmaGraphJsonObject,
  SigmaGraphNode,
} from './types';

export const sigmaGraphDocumentSchemaVersion = 'sigma.graph.document.v1';

export function isSigmaGraphJsonObject(value: unknown): value is SigmaGraphJsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeSigmaGraphLabel(value: unknown, fallback = 'Untitled') {
  const label = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return label || fallback;
}

export function normalizeSigmaGraphNode(node: SigmaGraphNode): SigmaGraphNode {
  return {
    ...node,
    id: String(node.id),
    type: normalizeSigmaGraphLabel(node.type, 'node'),
    label: normalizeSigmaGraphLabel(node.label || node.id),
    size: Number.isFinite(node.size) && node.size ? Math.max(Number(node.size), 1) : 6,
    data: isSigmaGraphJsonObject(node.data) ? node.data : {},
    metadata: isSigmaGraphJsonObject(node.metadata) ? node.metadata : {},
  };
}

export function normalizeSigmaGraphEdge(edge: SigmaGraphEdge): SigmaGraphEdge {
  return {
    ...edge,
    id: String(edge.id),
    source: String(edge.source),
    target: String(edge.target),
    type: normalizeSigmaGraphLabel(edge.type, 'RELATED_TO'),
    label: edge.label ? normalizeSigmaGraphLabel(edge.label) : undefined,
    size: Number.isFinite(edge.size) && edge.size ? Math.max(Number(edge.size), 1) : 1,
    data: isSigmaGraphJsonObject(edge.data) ? edge.data : {},
    metadata: isSigmaGraphJsonObject(edge.metadata) ? edge.metadata : {},
  };
}

export function normalizeSigmaGraphDocument(document: SigmaGraphDocument): SigmaGraphDocument {
  const nodesById = new Map<string, SigmaGraphNode>();
  for (const node of document.nodes || []) {
    const normalized = normalizeSigmaGraphNode(node);
    nodesById.set(normalized.id, normalized);
  }

  const edgesById = new Map<string, SigmaGraphEdge>();
  for (const edge of document.edges || []) {
    const normalized = normalizeSigmaGraphEdge(edge);
    if (!nodesById.has(normalized.source) || !nodesById.has(normalized.target)) {
      continue;
    }
    edgesById.set(normalized.id, normalized);
  }

  return {
    ...document,
    schemaVersion: document.schemaVersion || sigmaGraphDocumentSchemaVersion,
    nodes: [...nodesById.values()],
    edges: [...edgesById.values()],
    metadata: isSigmaGraphJsonObject(document.metadata) ? document.metadata : {},
  };
}
