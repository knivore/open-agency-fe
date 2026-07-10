import { normalizeSigmaGraphDocument, sigmaGraphDocumentSchemaVersion } from '../normalize';
import type {
  SigmaGraphDataAdapter,
  SigmaGraphDocument,
  SigmaGraphEdge,
  SigmaGraphJsonObject,
  SigmaGraphJsonValue,
  SigmaGraphNode,
} from '../types';

export interface GraphReadDtoNode {
  id: string;
  type?: string;
  labels?: string[];
  properties?: Record<string, unknown>;
}

export interface GraphReadDtoEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  properties?: Record<string, unknown>;
}

export interface GraphReadDtoOperationalProjection {
  nodes?: GraphReadDtoNode[];
  edges?: GraphReadDtoEdge[];
  coverage?: Record<string, unknown>;
}

export interface GraphReadDtoDocument {
  nodes: GraphReadDtoNode[];
  edges: GraphReadDtoEdge[];
  meta?: Record<string, unknown>;
  operational?: GraphReadDtoOperationalProjection;
  operational_nodes?: GraphReadDtoNode[];
  operational_edges?: GraphReadDtoEdge[];
  operational_coverage?: Record<string, unknown>;
}

export const graphReadDtoAdapter: SigmaGraphDataAdapter<GraphReadDtoDocument> = {
  id: 'graph-read-dto',
  load(source) {
    return graphReadDtoToSigmaGraph(source);
  },
  normalize: normalizeSigmaGraphDocument,
};

export function graphReadDtoToSigmaGraph(source: GraphReadDtoDocument): SigmaGraphDocument {
  const operationalNodes = [
    ...(source.operational?.nodes || []),
    ...(source.operational_nodes || []),
  ];
  const operationalEdges = [
    ...(source.operational?.edges || []),
    ...(source.operational_edges || []),
  ];
  const nodes = mergeSigmaNodes([
    ...source.nodes.map((node) => toSigmaNode(node)),
    ...operationalNodes.map((node) => toSigmaNode(node, true)),
  ]);
  const edges = mergeSigmaEdges([
    ...source.edges.map((edge) => toSigmaEdge(edge)),
    ...operationalEdges.map((edge) => toSigmaEdge(edge, true)),
  ]);
  const metadata = graphReadMetadata(source, operationalNodes.length, operationalEdges.length);
  return normalizeSigmaGraphDocument({
    schemaVersion: sigmaGraphDocumentSchemaVersion,
    id: stringProperty(source.meta, 'id'),
    title: stringProperty(source.meta, 'title'),
    nodes,
    edges,
    metadata,
  });
}

function toSigmaNode(node: GraphReadDtoNode, operationalCoverage = false): SigmaGraphNode {
  const properties = jsonObject(node.properties);
  const type = node.type || node.labels?.[0] || 'Node';
  const temporal = temporalRange(properties);
  return {
    id: node.id,
    type,
    label: displayLabelForGraphNode(type, node.id, properties, temporal),
    clusterId: type,
    startedAt: temporal.startedAt,
    endedAt: temporal.endedAt,
    data: properties,
    metadata: operationalCoverage
      ? {
          graph_read_operational_coverage: true,
        }
      : undefined,
  };
}

function toSigmaEdge(edge: GraphReadDtoEdge, operationalCoverage = false): SigmaGraphEdge {
  const properties = jsonObject(edge.properties);
  const temporal = temporalRange(properties);
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type || 'RELATED_TO',
    label: edge.type,
    startedAt: temporal.startedAt,
    endedAt: temporal.endedAt,
    data: properties,
    metadata: operationalCoverage
      ? {
          graph_read_operational_coverage: true,
        }
      : undefined,
  };
}

function mergeSigmaNodes(nodes: SigmaGraphNode[]) {
  const byId = new Map<string, SigmaGraphNode>();
  for (const node of nodes) {
    const existing = byId.get(node.id);
    byId.set(node.id, existing ? mergeSigmaNode(existing, node) : node);
  }
  return [...byId.values()];
}

function mergeSigmaEdges(edges: SigmaGraphEdge[]) {
  const byId = new Map<string, SigmaGraphEdge>();
  for (const edge of edges) {
    const existing = byId.get(edge.id);
    byId.set(edge.id, existing ? mergeSigmaEdge(existing, edge) : edge);
  }
  return [...byId.values()];
}

function mergeSigmaNode(base: SigmaGraphNode, override: SigmaGraphNode): SigmaGraphNode {
  return {
    ...base,
    ...override,
    data: {
      ...(base.data || {}),
      ...(override.data || {}),
    },
    metadata: {
      ...(base.metadata || {}),
      ...(override.metadata || {}),
    },
  };
}

function mergeSigmaEdge(base: SigmaGraphEdge, override: SigmaGraphEdge): SigmaGraphEdge {
  return {
    ...base,
    ...override,
    data: {
      ...(base.data || {}),
      ...(override.data || {}),
    },
    metadata: {
      ...(base.metadata || {}),
      ...(override.metadata || {}),
    },
  };
}

function graphReadMetadata(
  source: GraphReadDtoDocument,
  operationalNodeCount: number,
  operationalEdgeCount: number
) {
  const metadata = jsonObject(source.meta);
  const coverage = jsonObject(source.operational?.coverage || source.operational_coverage);
  if (operationalNodeCount > 0) {
    metadata.operational_node_count = operationalNodeCount;
  }
  if (operationalEdgeCount > 0) {
    metadata.operational_edge_count = operationalEdgeCount;
  }
  if (Object.keys(coverage).length > 0) {
    metadata.operational_coverage = coverage;
  }
  return metadata;
}

function jsonObject(value: unknown): SigmaGraphJsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, jsonValue(item)])
  );
}

function jsonValue(value: unknown): SigmaGraphJsonValue {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
    return value as SigmaGraphJsonValue;
  }
  if (Array.isArray(value)) {
    return value.map(jsonValue);
  }
  if (typeof value === 'object') {
    return jsonObject(value);
  }
  return String(value);
}

function stringProperty(value: unknown, key: string) {
  const object = jsonObject(value);
  const raw = object[key];
  return typeof raw === 'string' && raw.trim() ? raw : undefined;
}

function displayLabelForGraphNode(
  type: string,
  nodeId: string,
  properties: SigmaGraphJsonObject,
  temporal: { startedAt?: string; endedAt?: string }
) {
  const explicit =
    firstStringProperty(properties, [
      'display_name',
      'displayName',
      'name',
      'title',
      'summary',
      'label',
      'filename',
      'container_name',
      'containerName',
      'task_name',
      'taskName',
      'agent_name',
      'agentName',
      'model',
      'provider',
      'email',
    ]) || undefined;
  if (explicit) {
    return truncateLabel(explicit, 80);
  }

  const status = normalizeStatus(firstStringProperty(properties, ['status']));
  const createdAt = temporal.startedAt || temporal.endedAt;
  const timeLabel = createdAt ? formatShortDateTime(createdAt) : undefined;
  const taskId = firstStringProperty(properties, ['task_id', 'taskId']);
  const agentId = firstStringProperty(properties, ['agent_id', 'agentId']);
  const eventType = firstStringProperty(properties, ['event_type', 'eventType']);
  const triggerType = firstStringProperty(properties, ['trigger_type', 'triggerType']);

  switch (type) {
    case 'WorkflowRun':
    case 'Run':
      return compactLabel([status ? `${status} run` : 'Run', triggerType, timeLabel]);
    case 'StepRun':
      return compactLabel([humanizeIdentifier(taskId) || 'Step', status]);
    case 'Workflow':
      return humanizeIdentifier(nodeId) || 'Workflow';
    case 'Agent':
      return humanizeIdentifier(agentId || nodeId) || 'Agent';
    case 'Task':
      return humanizeIdentifier(taskId || nodeId) || 'Task';
    case 'ExecutionEvent':
    case 'ContainerEvent':
      return compactLabel([eventType ? humanizeEventType(eventType) : type, status, timeLabel]);
    case 'RuntimeRevision':
      return compactLabel(['Runtime revision', shortFingerprint(nodeId)]);
    case 'RuntimeContainer':
      return compactLabel(['Runtime container', status]);
    case 'Error':
      return truncateLabel(firstStringProperty(properties, ['error', 'message']) || 'Error', 80);
    default:
      return humanizeIdentifier(nodeId) || type || 'Node';
  }
}

function firstStringProperty(properties: SigmaGraphJsonObject, keys: string[]) {
  for (const key of keys) {
    const raw = properties[key];
    if (typeof raw === 'string' && raw.trim()) {
      return raw.trim();
    }
  }
  return undefined;
}

function compactLabel(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(' - ');
}

function normalizeStatus(status?: string) {
  return status ? humanizeIdentifier(status) : undefined;
}

function humanizeEventType(value: string) {
  return humanizeIdentifier(value.replace(/\./g, ' '));
}

function humanizeIdentifier(value?: string) {
  if (!value) {
    return undefined;
  }
  const normalized = value
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '')
    .replace(/[0-9a-f]{24,}/gi, '')
    .replace(/\b(workflow|execution|run|node|task|agent|edge|memory|document)\b/gi, '')
    .replace(/[_:./-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) {
    return undefined;
  }
  return normalized
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function shortFingerprint(value: string) {
  const match = value.match(/[0-9a-f]{8,}/i);
  return match ? match[0].slice(0, 8) : undefined;
}

function formatShortDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function truncateLabel(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}...`;
}

function temporalProperty(value: unknown, keys: string[]) {
  const object = jsonObject(value);
  for (const key of keys) {
    const raw = object[key];
    if (typeof raw === 'string' && raw.trim() && Number.isFinite(Date.parse(raw))) {
      return raw;
    }
  }
  return undefined;
}

function temporalRange(properties: SigmaGraphJsonObject) {
  const explicitStart = temporalProperty(properties, ['started_at', 'startedAt']);
  const createdAt = temporalProperty(properties, ['created_at', 'createdAt']);
  const explicitEnd = temporalProperty(properties, [
    'ended_at',
    'endedAt',
    'completed_at',
    'completedAt',
  ]);
  return {
    startedAt: explicitStart || createdAt,
    endedAt: explicitEnd || (explicitStart ? undefined : createdAt),
  };
}
