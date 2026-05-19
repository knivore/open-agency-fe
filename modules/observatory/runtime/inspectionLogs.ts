import type { ObservatoryLayoutDocument } from '@/modules/observatory/engine/world/layoutTypes';
import type { ObservatoryRuntimeLevel } from '@/modules/observatory/runtime/events';
import type { RunSessionSummary } from '@/types/runtime';
import type { WorkflowDefinition } from '@/types/workflows';

export type ObservatoryInspectionLogSource = 'layout-runtime' | 'runtime-event' | 'runtime-log';

export type ObservatoryInspectionLogStatus = 'empty' | 'error' | 'loading' | 'ready';

export interface ObservatoryInspectionLogEntry {
  agentId?: string;
  eventType?: string;
  id: string;
  level: ObservatoryRuntimeLevel;
  message: string;
  objectId?: string;
  roomId?: string;
  runId?: string;
  source: ObservatoryInspectionLogSource;
  taskId?: string;
  timestamp?: string;
  workflowId?: string;
}

export interface ObservatoryInspectionLogQuery {
  agentId?: string;
  limit?: number;
  objectId?: string;
  roomId?: string;
  runId?: string;
  workflowId?: string;
}

export interface ObservatoryInspectionLogResult {
  entries: ObservatoryInspectionLogEntry[];
  error?: string;
  query: ObservatoryInspectionLogQuery;
  status: ObservatoryInspectionLogStatus;
}

export interface ObservatoryRuntimeLogAdapter {
  getAgentLogs(query: ObservatoryInspectionLogQuery): Promise<ObservatoryInspectionLogResult>;
  getObjectLogs(query: ObservatoryInspectionLogQuery): Promise<ObservatoryInspectionLogResult>;
  getRoomLogs(query: ObservatoryInspectionLogQuery): Promise<ObservatoryInspectionLogResult>;
}

export interface ObservatoryRuntimeInspectionEvent {
  agentId?: string | null;
  eventType: string;
  message: string;
  sequence: number;
  taskId?: string | null;
  timestamp?: string | null;
}

export interface ObservatoryRuntimeInspectionContext {
  events: ObservatoryRuntimeInspectionEvent[];
  logs: string[];
  run: RunSessionSummary;
  workflow: WorkflowDefinition | null;
}

const defaultInspectionLogLimit = 80;

export function createObservatoryLayoutInspectionLogEntries(
  layout: ObservatoryLayoutDocument
): ObservatoryInspectionLogEntry[] {
  return layout.world.maps.flatMap((map) => [
    ...map.rooms.flatMap((room) =>
      createRuntimeMetadataEntries({
        entityId: room.id,
        kind: 'room',
        metadata: room.runtime,
        roomId: room.id,
      })
    ),
    ...map.objects.flatMap((object) =>
      createRuntimeMetadataEntries({
        entityId: object.id,
        kind: 'object',
        metadata: object.runtime,
        objectId: object.id,
        roomId: object.roomId,
      })
    ),
    ...map.agents.flatMap((agent) =>
      createRuntimeMetadataEntries({
        agentId: agent.id,
        entityId: agent.id,
        kind: 'agent',
        metadata: agent.runtime,
        roomId: agent.roomId,
      })
    ),
  ]);
}

export function createObservatoryRuntimeContextInspectionLogEntries(
  contexts: ObservatoryRuntimeInspectionContext[]
): ObservatoryInspectionLogEntry[] {
  return contexts.flatMap((context) => {
    const workflowId = context.run.workflowId ?? context.workflow?.id ?? undefined;
    const agentLookup = createWorkflowAgentLookup(context.workflow);
    const events = context.events.map((event) => ({
      agentId: event.agentId ?? undefined,
      eventType: event.eventType,
      id: createInspectionLogId('run', context.run.id, 'event', event.sequence, event.message),
      level: inferEventLevel(event.eventType, event.message, context.run.status),
      message: event.message,
      runId: context.run.id,
      source: 'runtime-event' as const,
      taskId: event.taskId ?? undefined,
      timestamp: event.timestamp ?? undefined,
      workflowId,
    }));
    const logs = context.logs.map((message, index) => {
      const agentId = inferAgentIdFromMessage(message, agentLookup);

      return {
        agentId,
        id: createInspectionLogId('run', context.run.id, 'log', index, message),
        level: inferLogLevel(message),
        message,
        runId: context.run.id,
        source: 'runtime-log' as const,
        workflowId,
      };
    });

    return [...events, ...logs];
  });
}

export function selectObservatoryAgentInspectionLogs(
  entries: ObservatoryInspectionLogEntry[],
  query: ObservatoryInspectionLogQuery
): ObservatoryInspectionLogResult {
  return toInspectionLogResult(
    entries.filter((entry) =>
      Boolean(
        (query.agentId && entry.agentId === query.agentId) ||
        (query.runId && entry.runId === query.runId) ||
        (query.workflowId && entry.workflowId === query.workflowId)
      )
    ),
    query
  );
}

export function selectObservatoryObjectInspectionLogs(
  entries: ObservatoryInspectionLogEntry[],
  query: ObservatoryInspectionLogQuery
): ObservatoryInspectionLogResult {
  return toInspectionLogResult(
    entries.filter((entry) =>
      Boolean(
        (query.objectId && entry.objectId === query.objectId) ||
        (query.workflowId && entry.workflowId === query.workflowId) ||
        (query.runId && entry.runId === query.runId)
      )
    ),
    query
  );
}

export function selectObservatoryRoomInspectionLogs(
  entries: ObservatoryInspectionLogEntry[],
  query: ObservatoryInspectionLogQuery
): ObservatoryInspectionLogResult {
  return toInspectionLogResult(
    entries.filter((entry) =>
      Boolean(
        (query.roomId && entry.roomId === query.roomId) ||
        (query.workflowId && entry.workflowId === query.workflowId) ||
        (query.runId && entry.runId === query.runId)
      )
    ),
    query
  );
}

export function createObservatoryStaticRuntimeLogAdapter(
  entries: ObservatoryInspectionLogEntry[]
): ObservatoryRuntimeLogAdapter {
  return {
    getAgentLogs: async (query) => selectObservatoryAgentInspectionLogs(entries, query),
    getObjectLogs: async (query) => selectObservatoryObjectInspectionLogs(entries, query),
    getRoomLogs: async (query) => selectObservatoryRoomInspectionLogs(entries, query),
  };
}

function createRuntimeMetadataEntries({
  agentId,
  entityId,
  kind,
  metadata,
  objectId,
  roomId,
}: {
  agentId?: string;
  entityId: string;
  kind: 'agent' | 'object' | 'room';
  metadata?: ObservatoryLayoutDocument['world']['maps'][number]['agents'][number]['runtime'];
  objectId?: string;
  roomId?: string;
}): ObservatoryInspectionLogEntry[] {
  if (!metadata) {
    return [];
  }

  const base = {
    agentId,
    objectId,
    roomId,
    runId: metadata.runId,
    workflowId: metadata.workflowId,
  };
  const logs = (metadata.logs ?? []).filter(Boolean).map((message, index) => ({
    ...base,
    id: createInspectionLogId(kind, entityId, 'log', index, message),
    level: inferLogLevel(message),
    message,
    source: 'runtime-log' as const,
  }));
  const recentEvents = (metadata.recentEvents ?? []).filter(Boolean).map((message, index) => ({
    ...base,
    id: createInspectionLogId(kind, entityId, 'event', index, message),
    level: inferLogLevel(message),
    message,
    source: 'runtime-event' as const,
  }));

  return [...logs, ...recentEvents];
}

function toInspectionLogResult(
  entries: ObservatoryInspectionLogEntry[],
  query: ObservatoryInspectionLogQuery
): ObservatoryInspectionLogResult {
  const limit = query.limit ?? defaultInspectionLogLimit;
  const limitedEntries = entries.slice(-limit);

  return {
    entries: limitedEntries,
    query,
    status: limitedEntries.length > 0 ? 'ready' : 'empty',
  };
}

function inferLogLevel(message: string): ObservatoryRuntimeLevel {
  const normalized = message.toLowerCase();

  if (
    normalized.includes('error') ||
    normalized.includes('failed') ||
    normalized.includes('failure')
  ) {
    return 'error';
  }

  if (
    normalized.includes('approval') ||
    normalized.includes('blocked') ||
    normalized.includes('warning')
  ) {
    return 'warning';
  }

  if (normalized.includes('completed') || normalized.includes('success')) {
    return 'success';
  }

  if (normalized.includes('debug') || normalized.includes('trace')) {
    return 'debug';
  }

  return 'info';
}

function inferEventLevel(
  eventType: string,
  message: string,
  status: RunSessionSummary['status']
): ObservatoryRuntimeLevel {
  const normalized = `${eventType} ${message} ${status}`.toLowerCase();

  if (
    normalized.includes('failed') ||
    normalized.includes('error') ||
    normalized.includes('cancelled')
  ) {
    return 'error';
  }

  if (
    normalized.includes('approval') ||
    normalized.includes('blocked') ||
    normalized.includes('waiting')
  ) {
    return 'warning';
  }

  if (normalized.includes('completed') || normalized.includes('success')) {
    return 'success';
  }

  if (normalized.includes('debug') || normalized.includes('trace')) {
    return 'debug';
  }

  return 'info';
}

function createWorkflowAgentLookup(workflow: WorkflowDefinition | null) {
  const lookup = new Map<string, string>();

  workflow?.agent_definitions?.forEach((agent) => {
    lookup.set(agent.id.toLowerCase(), agent.id);
    if (agent.name) {
      lookup.set(agent.name.toLowerCase(), agent.id);
    }
  });

  return lookup;
}

function inferAgentIdFromMessage(message: string, agentLookup: Map<string, string>) {
  const normalized = message.toLowerCase();

  for (const [token, agentId] of agentLookup) {
    if (token && normalized.includes(token)) {
      return agentId;
    }
  }

  const bracketedAgent = normalized.match(/^\[([^\]]+)\]/)?.[1];
  return bracketedAgent ? agentLookup.get(bracketedAgent) : undefined;
}

function createInspectionLogId(
  kind: string,
  entityId: string,
  source: string,
  index: number,
  message: string
) {
  return `${kind}:${entityId}:${source}:${index}:${hashMessage(message)}`;
}

function hashMessage(message: string) {
  let hash = 0;

  for (let index = 0; index < message.length; index += 1) {
    hash = (hash * 31 + message.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}
