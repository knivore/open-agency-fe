export type GraphId = string;

export type GraphJsonPrimitive = string | number | boolean | null;

export type GraphJsonValue =
  | GraphJsonPrimitive
  | GraphJsonValue[]
  | { [key: string]: GraphJsonValue };

export type GraphJsonObject = { [key: string]: GraphJsonValue };

export interface GraphPosition {
  x: number;
  y: number;
}

export interface GraphSize {
  width: number;
  height: number;
}

export interface GraphVisualStyle {
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  accentColor?: string;
  icon?: string;
  className?: string;
  custom?: GraphJsonObject;
}

export type GraphPortDirection = 'input' | 'output' | 'bidirectional';

export interface GraphPort<TData extends GraphJsonObject = GraphJsonObject> {
  id: GraphId;
  label?: string;
  direction?: GraphPortDirection;
  data?: TData;
  metadata?: GraphJsonObject;
}

export interface GraphNode<
  TData extends GraphJsonObject = GraphJsonObject,
  TType extends string = string,
> {
  id: GraphId;
  type: TType;
  label: string;
  description?: string;
  position?: GraphPosition;
  size?: GraphSize;
  status?: string;
  data?: TData;
  style?: GraphVisualStyle;
  ports?: GraphPort[];
  capabilities?: string[];
  metadata?: GraphJsonObject;
}

export interface GraphEdge<
  TData extends GraphJsonObject = GraphJsonObject,
  TType extends string = string,
> {
  id: GraphId;
  source: GraphId;
  target: GraphId;
  sourceHandle?: GraphId;
  targetHandle?: GraphId;
  type: TType;
  label?: string;
  status?: string;
  data?: TData;
  style?: GraphVisualStyle;
  metadata?: GraphJsonObject;
}

export interface GraphViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface GraphSelection {
  nodeIds: GraphId[];
  edgeIds: GraphId[];
}

export interface GraphRuntimeEvent<TPayload extends GraphJsonObject = GraphJsonObject> {
  id: GraphId;
  type: string;
  timestamp: string;
  graphId?: GraphId;
  nodeId?: GraphId;
  edgeId?: GraphId;
  status?: string;
  payload?: TPayload;
  metadata?: GraphJsonObject;
}

export type GraphValidationSeverity = 'error' | 'warning' | 'info';

export type GraphValidationTarget = 'document' | 'node' | 'edge' | 'port' | 'viewport';

export interface GraphValidationIssue {
  id: GraphId;
  severity: GraphValidationSeverity;
  code: string;
  message: string;
  target: GraphValidationTarget;
  targetId?: GraphId;
  path?: string;
  metadata?: GraphJsonObject;
}

export interface GraphValidationContext<TDocument extends GraphDocument = GraphDocument> {
  document: TDocument;
  nodeTypes: Record<string, GraphNodeTypeDescriptor>;
  edgeTypes: Record<string, GraphEdgeTypeDescriptor>;
}

export type GraphDocumentValidator<TDocument extends GraphDocument = GraphDocument> = (
  context: GraphValidationContext<TDocument>
) => GraphValidationIssue[];

export type GraphNodeValidator<TNode extends GraphNode = GraphNode> = (
  node: TNode,
  context: GraphValidationContext
) => GraphValidationIssue[];

export type GraphEdgeValidator<TEdge extends GraphEdge = GraphEdge> = (
  edge: TEdge,
  context: GraphValidationContext
) => GraphValidationIssue[];

export type GraphSlotReference =
  | string
  | {
      slot: string;
      options?: GraphJsonObject;
    };

export interface GraphNodeTypeDescriptor<
  TData extends GraphJsonObject = GraphJsonObject,
  TType extends string = string,
> {
  type: TType;
  label: string;
  description?: string;
  icon?: string;
  color?: string;
  defaultData?: TData | (() => TData);
  defaultPorts?: GraphPort[];
  validate?: GraphNodeValidator<GraphNode<TData, TType>>;
  render?: GraphSlotReference;
  inspector?: GraphSlotReference;
  metadata?: GraphJsonObject;
}

export interface GraphPaletteItem<TData extends GraphJsonObject = GraphJsonObject> {
  id: GraphId;
  type: string;
  label: string;
  description?: string;
  icon?: string;
  color?: string;
  defaultData?: TData;
  metadata?: GraphJsonObject;
}

export interface GraphToolbarAction {
  id: GraphId;
  label: string;
  description?: string;
  icon?: string;
  disabled?: boolean;
  metadata?: GraphJsonObject;
}

export interface GraphEdgeTypeDescriptor<
  TData extends GraphJsonObject = GraphJsonObject,
  TType extends string = string,
> {
  type: TType;
  label: string;
  description?: string;
  defaultData?: TData | (() => TData);
  validate?: GraphEdgeValidator<GraphEdge<TData, TType>>;
  render?: GraphSlotReference;
  inspector?: GraphSlotReference;
  metadata?: GraphJsonObject;
}

export interface GraphDocument<
  TNode extends GraphNode = GraphNode,
  TEdge extends GraphEdge = GraphEdge,
> {
  schemaVersion: string;
  id?: GraphId;
  title?: string;
  description?: string;
  nodes: TNode[];
  edges: TEdge[];
  viewport?: GraphViewport;
  selection?: GraphSelection;
  metadata?: GraphJsonObject;
}

export interface GraphModuleConfig {
  schemaVersion?: string;
  readOnly?: boolean;
  allowCycles?: boolean;
  nodeTypes?: Record<string, GraphNodeTypeDescriptor>;
  edgeTypes?: Record<string, GraphEdgeTypeDescriptor>;
  paletteItems?: GraphPaletteItem[];
  toolbarActions?: GraphToolbarAction[];
  validators?: GraphDocumentValidator[];
  metadata?: GraphJsonObject;
}
