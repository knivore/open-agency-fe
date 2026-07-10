import type {
  GraphDocument,
  GraphDocumentValidator,
  GraphEdge,
  GraphEdgeTypeDescriptor,
  GraphJsonObject,
  GraphModuleConfig,
  GraphNode,
  GraphNodeTypeDescriptor,
  GraphPaletteItem,
  GraphToolbarAction,
} from './types';
import { createGraphEdgeId, createGraphId } from './ids';
import { normalizeGraphLabel, normalizeGraphMetadata } from './normalize';
import { validateGraphDocument } from './validation';

export interface CreateGraphDefinitionInput {
  schemaVersion?: string;
  nodeTypes?: Record<string, GraphNodeTypeDescriptor>;
  edgeTypes?: Record<string, GraphEdgeTypeDescriptor>;
  paletteItems?: GraphPaletteItem[];
  toolbarActions?: GraphToolbarAction[];
  defaultNodes?: GraphNode[];
  defaultEdges?: GraphEdge[];
  validators?: GraphDocumentValidator[];
  metadata?: GraphJsonObject;
}

export interface CreateGraphNodeInput<TData extends GraphJsonObject = GraphJsonObject> {
  id?: string;
  type: string;
  label?: string;
  description?: string;
  position?: GraphNode['position'];
  size?: GraphNode['size'];
  status?: string;
  data?: TData;
  metadata?: GraphJsonObject;
}

export interface CreateGraphEdgeInput<TData extends GraphJsonObject = GraphJsonObject> {
  id?: string;
  source: string;
  target: string;
  type: string;
  label?: string;
  status?: string;
  sourceHandle?: string;
  targetHandle?: string;
  data?: TData;
  metadata?: GraphJsonObject;
}

export interface CreateGraphDocumentInput {
  id?: string;
  title?: string;
  description?: string;
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  metadata?: GraphJsonObject;
}

export interface GraphDefinition {
  readonly schemaVersion: string;
  readonly nodeTypes: Record<string, GraphNodeTypeDescriptor>;
  readonly edgeTypes: Record<string, GraphEdgeTypeDescriptor>;
  readonly paletteItems: GraphPaletteItem[];
  readonly toolbarActions: GraphToolbarAction[];
  readonly defaultNodes: GraphNode[];
  readonly defaultEdges: GraphEdge[];
  readonly validators: GraphDocumentValidator[];
  readonly metadata: GraphJsonObject;
  createNode<TData extends GraphJsonObject = GraphJsonObject>(
    input: CreateGraphNodeInput<TData>
  ): GraphNode<TData>;
  createEdge<TData extends GraphJsonObject = GraphJsonObject>(
    input: CreateGraphEdgeInput<TData>
  ): GraphEdge<TData>;
  createDocument(input?: CreateGraphDocumentInput): GraphDocument;
  createConfig(overrides?: Partial<GraphModuleConfig>): GraphModuleConfig;
  validate(document: GraphDocument): ReturnType<typeof validateGraphDocument>;
}

const defaultGraphSchemaVersion = 'graph.document.v1';

function resolveDefaultData<TData extends GraphJsonObject>(
  descriptor?: GraphNodeTypeDescriptor<TData> | GraphEdgeTypeDescriptor<TData>,
  fallback?: TData
) {
  if (!descriptor?.defaultData) {
    return fallback;
  }

  return typeof descriptor.defaultData === 'function'
    ? descriptor.defaultData()
    : descriptor.defaultData;
}

export function createGraphDefinition(input: CreateGraphDefinitionInput = {}): GraphDefinition {
  const schemaVersion = input.schemaVersion ?? defaultGraphSchemaVersion;
  const nodeTypes = input.nodeTypes ?? {};
  const edgeTypes = input.edgeTypes ?? {};
  const validators = input.validators ?? [];

  return {
    schemaVersion,
    nodeTypes,
    edgeTypes,
    paletteItems: input.paletteItems ?? [],
    toolbarActions: input.toolbarActions ?? [],
    defaultNodes: input.defaultNodes ?? [],
    defaultEdges: input.defaultEdges ?? [],
    validators,
    metadata: normalizeGraphMetadata(input.metadata),
    createNode<TData extends GraphJsonObject = GraphJsonObject>(
      nodeInput: CreateGraphNodeInput<TData>
    ) {
      const descriptor = nodeTypes[nodeInput.type] as unknown as
        | GraphNodeTypeDescriptor<TData>
        | undefined;
      const label = normalizeGraphLabel(nodeInput.label, descriptor?.label ?? nodeInput.type);
      return {
        id: nodeInput.id ?? createGraphId(label, { prefix: nodeInput.type }),
        type: nodeInput.type,
        label,
        description: nodeInput.description ?? descriptor?.description,
        position: nodeInput.position,
        size: nodeInput.size,
        status: nodeInput.status,
        data: nodeInput.data ?? resolveDefaultData(descriptor),
        ports: descriptor?.defaultPorts,
        metadata: nodeInput.metadata,
      };
    },
    createEdge<TData extends GraphJsonObject = GraphJsonObject>(
      edgeInput: CreateGraphEdgeInput<TData>
    ) {
      const descriptor = edgeTypes[edgeInput.type] as unknown as
        | GraphEdgeTypeDescriptor<TData>
        | undefined;
      return {
        id:
          edgeInput.id ??
          createGraphEdgeId({
            source: edgeInput.source,
            target: edgeInput.target,
            type: edgeInput.type,
            sourceHandle: edgeInput.sourceHandle,
            targetHandle: edgeInput.targetHandle,
          }),
        source: edgeInput.source,
        target: edgeInput.target,
        sourceHandle: edgeInput.sourceHandle,
        targetHandle: edgeInput.targetHandle,
        type: edgeInput.type,
        label: edgeInput.label ?? descriptor?.label,
        status: edgeInput.status,
        data: edgeInput.data ?? resolveDefaultData(descriptor),
        metadata: edgeInput.metadata,
      };
    },
    createDocument(documentInput: CreateGraphDocumentInput = {}) {
      return {
        schemaVersion,
        id: documentInput.id,
        title: documentInput.title,
        description: documentInput.description,
        nodes: documentInput.nodes ?? input.defaultNodes ?? [],
        edges: documentInput.edges ?? input.defaultEdges ?? [],
        metadata: normalizeGraphMetadata(documentInput.metadata ?? input.metadata),
      };
    },
    createConfig(overrides: Partial<GraphModuleConfig> = {}) {
      return {
        schemaVersion,
        nodeTypes,
        edgeTypes,
        paletteItems: input.paletteItems ?? [],
        toolbarActions: input.toolbarActions ?? [],
        validators,
        metadata: normalizeGraphMetadata(input.metadata),
        ...overrides,
      };
    },
    validate(document: GraphDocument) {
      return validateGraphDocument(document, {
        nodeTypes,
        edgeTypes,
        validators,
      });
    },
  };
}
