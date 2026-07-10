import { normalizeSigmaGraphDocument } from './normalize';
import type {
  SigmaGraphController,
  SigmaGraphDelta,
  SigmaGraphDocument,
  SigmaGraphFilter,
  SigmaGraphSelection,
  SigmaGraphTimeWindow,
  SigmaGraphUnsubscribe,
} from './types';

const emptyDocument: SigmaGraphDocument = {
  schemaVersion: 'sigma.graph.document.v1',
  nodes: [],
  edges: [],
};

export function createEmptySigmaGraphSelection(): SigmaGraphSelection {
  return { nodeIds: [], edgeIds: [] };
}

export class InMemorySigmaGraphController implements SigmaGraphController {
  private document: SigmaGraphDocument;
  private selection: SigmaGraphSelection = createEmptySigmaGraphSelection();
  private filters: SigmaGraphFilter[] = [];
  private timeWindow: SigmaGraphTimeWindow | null = null;
  private listeners = new Set<(document: SigmaGraphDocument) => void>();

  constructor(document: SigmaGraphDocument = emptyDocument) {
    this.document = normalizeSigmaGraphDocument(document);
  }

  load(document: SigmaGraphDocument): void {
    this.document = normalizeSigmaGraphDocument(document);
    this.emit();
  }

  patch(delta: SigmaGraphDelta): void {
    const removeNodeIds = new Set(delta.removeNodeIds || []);
    const removeEdgeIds = new Set(delta.removeEdgeIds || []);
    const nodesById = new Map(this.document.nodes.map((node) => [node.id, node]));
    const edgesById = new Map(this.document.edges.map((edge) => [edge.id, edge]));

    for (const nodeId of removeNodeIds) {
      nodesById.delete(nodeId);
    }
    for (const edgeId of removeEdgeIds) {
      edgesById.delete(edgeId);
    }
    for (const node of delta.upsertNodes || []) {
      nodesById.set(node.id, node);
    }
    for (const edge of delta.upsertEdges || []) {
      edgesById.set(edge.id, edge);
    }

    this.document = normalizeSigmaGraphDocument({
      ...this.document,
      nodes: [...nodesById.values()],
      edges: [...edgesById.values()],
      metadata: { ...(this.document.metadata || {}), ...(delta.metadata || {}) },
    });
    this.emit();
  }

  getDocument(): SigmaGraphDocument {
    return this.document;
  }

  subscribe(listener: (document: SigmaGraphDocument) => void): SigmaGraphUnsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  select(selection: SigmaGraphSelection): void {
    this.selection = {
      nodeIds: [...selection.nodeIds],
      edgeIds: [...selection.edgeIds],
    };
  }

  getSelection(): SigmaGraphSelection {
    return this.selection;
  }

  setFilters(filters: SigmaGraphFilter[]): void {
    this.filters = [...filters];
  }

  getFilters(): SigmaGraphFilter[] {
    return this.filters;
  }

  setTimeWindow(window: SigmaGraphTimeWindow | null): void {
    this.timeWindow = window;
  }

  getTimeWindow(): SigmaGraphTimeWindow | null {
    return this.timeWindow;
  }

  private emit() {
    for (const listener of this.listeners) {
      listener(this.document);
    }
  }
}
