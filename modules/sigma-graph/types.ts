export type SigmaGraphId = string;

export type SigmaGraphJsonPrimitive = string | number | boolean | null;

export type SigmaGraphJsonValue =
  | SigmaGraphJsonPrimitive
  | SigmaGraphJsonValue[]
  | { [key: string]: SigmaGraphJsonValue };

export type SigmaGraphJsonObject = { [key: string]: SigmaGraphJsonValue };

export interface SigmaGraphPoint {
  x: number;
  y: number;
}

export interface SigmaGraphNode<TData extends SigmaGraphJsonObject = SigmaGraphJsonObject> {
  id: SigmaGraphId;
  type: string;
  label: string;
  size?: number;
  color?: string;
  position?: SigmaGraphPoint;
  clusterId?: string;
  startedAt?: string;
  endedAt?: string;
  data?: TData;
  metadata?: SigmaGraphJsonObject;
}

export interface SigmaGraphEdge<TData extends SigmaGraphJsonObject = SigmaGraphJsonObject> {
  id: SigmaGraphId;
  source: SigmaGraphId;
  target: SigmaGraphId;
  type: string;
  label?: string;
  size?: number;
  color?: string;
  startedAt?: string;
  endedAt?: string;
  data?: TData;
  metadata?: SigmaGraphJsonObject;
}

export interface SigmaGraphDocument<
  TNode extends SigmaGraphNode = SigmaGraphNode,
  TEdge extends SigmaGraphEdge = SigmaGraphEdge,
> {
  schemaVersion: string;
  id?: SigmaGraphId;
  title?: string;
  nodes: TNode[];
  edges: TEdge[];
  metadata?: SigmaGraphJsonObject;
}

export interface SigmaGraphDelta {
  upsertNodes?: SigmaGraphNode[];
  upsertEdges?: SigmaGraphEdge[];
  removeNodeIds?: SigmaGraphId[];
  removeEdgeIds?: SigmaGraphId[];
  metadata?: SigmaGraphJsonObject;
}

export interface SigmaGraphSelection {
  nodeIds: SigmaGraphId[];
  edgeIds: SigmaGraphId[];
}

export interface SigmaGraphTimeWindow {
  start?: string;
  end?: string;
}

export interface SigmaGraphFilterContext {
  document: SigmaGraphDocument;
  selection: SigmaGraphSelection;
  timeWindow: SigmaGraphTimeWindow | null;
}

export interface SigmaGraphFilterPredicate {
  node?(node: SigmaGraphNode, context: SigmaGraphFilterContext): boolean;
  edge?(edge: SigmaGraphEdge, context: SigmaGraphFilterContext): boolean;
}

export interface SigmaGraphFilter {
  id: SigmaGraphId;
  enabled?: boolean;
  predicate: SigmaGraphFilterPredicate;
}

export interface SigmaGraphCluster {
  id: SigmaGraphId;
  label: string;
  nodeIds: SigmaGraphId[];
  size: number;
  metadata?: SigmaGraphJsonObject;
}

export interface SigmaGraphLayoutRequest {
  algorithm: 'preset' | 'circle' | 'forceatlas2';
  options?: SigmaGraphJsonObject;
}

export interface SigmaGraphLayoutResult {
  positions: Record<SigmaGraphId, SigmaGraphPoint>;
  metadata?: SigmaGraphJsonObject;
}

export interface SigmaGraphLayoutEngine {
  id: string;
  run(
    document: SigmaGraphDocument,
    request: SigmaGraphLayoutRequest
  ): Promise<SigmaGraphLayoutResult>;
}

export type SigmaGraphUnsubscribe = () => void;

export interface SigmaGraphController {
  load(document: SigmaGraphDocument): void;
  patch(delta: SigmaGraphDelta): void;
  getDocument(): SigmaGraphDocument;
  subscribe(listener: (document: SigmaGraphDocument) => void): SigmaGraphUnsubscribe;
  select(selection: SigmaGraphSelection): void;
  getSelection(): SigmaGraphSelection;
  setFilters(filters: SigmaGraphFilter[]): void;
  getFilters(): SigmaGraphFilter[];
  setTimeWindow(window: SigmaGraphTimeWindow | null): void;
  getTimeWindow(): SigmaGraphTimeWindow | null;
}

export interface SigmaGraphDataAdapter<TSource = unknown> {
  id: string;
  load(source: TSource): Promise<SigmaGraphDocument> | SigmaGraphDocument;
  normalize?(document: SigmaGraphDocument): SigmaGraphDocument;
}

export interface SigmaGraphRealtimeConnection {
  close(): void;
  status(): SigmaGraphConnectionStatus;
  subscribe(listener: (delta: SigmaGraphDelta) => void): SigmaGraphUnsubscribe;
}

export type SigmaGraphConnectionStatus = 'connecting' | 'open' | 'closed' | 'error';

export interface SigmaGraphRealtimeAdapter<TParams = unknown> {
  id: string;
  connect(params: TParams): Promise<SigmaGraphRealtimeConnection> | SigmaGraphRealtimeConnection;
}

export interface SigmaGraphPluginContext {
  controller: SigmaGraphController;
}

export interface SigmaGraphPlugin {
  id: SigmaGraphId;
  setup(context: SigmaGraphPluginContext): void | SigmaGraphUnsubscribe;
}
