import type { GraphDocument, GraphRuntimeEvent } from './types';

export const graphNodeRuntimeStatuses = [
  'idle',
  'queued',
  'running',
  'waiting',
  'succeeded',
  'failed',
  'skipped',
] as const;

export const graphEdgeRuntimeStatuses = [
  'inactive',
  'transmitting',
  'blocked',
  'completed',
  'failed',
] as const;

export type GraphNodeRuntimeStatus = (typeof graphNodeRuntimeStatuses)[number];

export type GraphEdgeRuntimeStatus = (typeof graphEdgeRuntimeStatuses)[number];

export type GraphRuntimeEventListener = (event: GraphRuntimeEvent) => void;

export type GraphRuntimeEventUnsubscribe = () => void;

export interface GraphRuntimeEventStreamAdapter {
  getSnapshot?: () => GraphRuntimeEvent[] | Promise<GraphRuntimeEvent[]>;
  subscribe?: (listener: GraphRuntimeEventListener) => GraphRuntimeEventUnsubscribe;
}

export interface GraphRuntimeTimeline {
  events: GraphRuntimeEvent[];
  startedAt?: string;
  endedAt?: string;
}

function compareRuntimeEvents(left: GraphRuntimeEvent, right: GraphRuntimeEvent) {
  return left.timestamp.localeCompare(right.timestamp);
}

function eventIsBeforeOrAt(event: GraphRuntimeEvent, timestamp: string) {
  return event.timestamp.localeCompare(timestamp) <= 0;
}

export function isGraphNodeRuntimeStatus(value: string): value is GraphNodeRuntimeStatus {
  return graphNodeRuntimeStatuses.includes(value as GraphNodeRuntimeStatus);
}

export function isGraphEdgeRuntimeStatus(value: string): value is GraphEdgeRuntimeStatus {
  return graphEdgeRuntimeStatuses.includes(value as GraphEdgeRuntimeStatus);
}

export function createGraphRuntimeTimeline(events: GraphRuntimeEvent[]): GraphRuntimeTimeline {
  const sortedEvents = [...events].sort(compareRuntimeEvents);
  return {
    events: sortedEvents,
    startedAt: sortedEvents[0]?.timestamp,
    endedAt: sortedEvents[sortedEvents.length - 1]?.timestamp,
  };
}

export function applyRuntimeEventsToGraphDocument(
  document: GraphDocument,
  events: GraphRuntimeEvent[]
): GraphDocument {
  const nodeStatusById = new Map<string, string>();
  const edgeStatusById = new Map<string, string>();

  for (const event of [...events].sort(compareRuntimeEvents)) {
    if (!event.status) {
      continue;
    }

    if (event.nodeId) {
      nodeStatusById.set(event.nodeId, event.status);
    }

    if (event.edgeId) {
      edgeStatusById.set(event.edgeId, event.status);
    }
  }

  return {
    ...document,
    nodes: document.nodes.map((node) => ({
      ...node,
      status: nodeStatusById.get(node.id) ?? node.status,
    })),
    edges: document.edges.map((edge) => ({
      ...edge,
      status: edgeStatusById.get(edge.id) ?? edge.status,
    })),
  };
}

export function replayGraphRuntimeEvents(
  document: GraphDocument,
  timeline: GraphRuntimeTimeline,
  untilTimestamp?: string
): GraphDocument {
  const events = untilTimestamp
    ? timeline.events.filter((event) => eventIsBeforeOrAt(event, untilTimestamp))
    : timeline.events;

  return applyRuntimeEventsToGraphDocument(document, events);
}
