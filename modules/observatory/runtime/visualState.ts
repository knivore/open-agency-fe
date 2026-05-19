import type {
  ObservatoryCharacterActionName,
  ObservatoryCharacterDirection,
} from '@/modules/observatory/engine/assets/assetRegistry';
import type {
  ObservatoryNormalizedOfficeEvent,
  ObservatoryNormalizedEventType,
  ObservatoryRuntimeLevel,
} from '@/modules/observatory/runtime/events';

export const OBSERVATORY_DEFAULT_MAX_FEED_ENTRIES = 1_000;
export const OBSERVATORY_DEFAULT_MAX_EVENT_HISTORY = 1_000;
export const OBSERVATORY_DEFAULT_MAX_SPEECH_CHARS = 160;

export type ObservatoryRuntimeEntityStatus = 'idle' | 'working' | 'blocked' | 'complete' | 'error' | 'unknown';

export interface ObservatoryRuntimeAgentState {
  id: string;
  status: ObservatoryRuntimeEntityStatus;
  lastEventId: string;
  lastUpdatedAt: string;
  currentRoomId?: string;
  currentTaskId?: string;
  taskProgress?: number;
  taskTitle?: string;
  lastMessage?: string;
  speechBubble?: {
    message: string;
    eventId: string;
    timestamp: string;
  };
  visualAction?: ObservatoryCharacterActionName;
  visualDirection?: ObservatoryCharacterDirection;
}

export interface ObservatoryRuntimeTaskState {
  id: string;
  title?: string;
  status: ObservatoryRuntimeEntityStatus;
  progress?: number;
  lastEventId: string;
  lastUpdatedAt: string;
}

export interface ObservatoryRuntimeWorkflowState {
  id: string;
  roomId?: string;
  status: ObservatoryRuntimeEntityStatus;
  lastEventId: string;
  lastUpdatedAt: string;
}

export interface ObservatoryActivityFeedEntry {
  id: string;
  eventId: string;
  source: string;
  type: ObservatoryNormalizedEventType;
  timestamp: string;
  level: ObservatoryRuntimeLevel;
  agentId?: string;
  workflowId?: string;
  taskId?: string;
  roomId?: string;
  title?: string;
  message?: string;
}

export interface ObservatoryRuntimeVisualState {
  agentsById: Record<string, ObservatoryRuntimeAgentState>;
  tasksById: Record<string, ObservatoryRuntimeTaskState>;
  workflowsById: Record<string, ObservatoryRuntimeWorkflowState>;
  activityFeed: ObservatoryActivityFeedEntry[];
  eventHistory: ObservatoryNormalizedOfficeEvent[];
  latestEventTimestamp?: string;
  droppedStaleEventCount: number;
  nextFeedSequence: number;
}

export interface ObservatoryRuntimeReducerOptions {
  maxEventHistory?: number;
  maxFeedEntries?: number;
  maxSpeechChars?: number;
}

export function createInitialObservatoryRuntimeVisualState(): ObservatoryRuntimeVisualState {
  return {
    activityFeed: [],
    agentsById: {},
    droppedStaleEventCount: 0,
    eventHistory: [],
    nextFeedSequence: 0,
    tasksById: {},
    workflowsById: {},
  };
}

export function reduceObservatoryRuntimeEvent(
  state: ObservatoryRuntimeVisualState,
  event: ObservatoryNormalizedOfficeEvent,
  options: ObservatoryRuntimeReducerOptions = {},
): ObservatoryRuntimeVisualState {
  const maxEventHistory = options.maxEventHistory ?? OBSERVATORY_DEFAULT_MAX_EVENT_HISTORY;
  const maxFeedEntries = options.maxFeedEntries ?? OBSERVATORY_DEFAULT_MAX_FEED_ENTRIES;
  const maxSpeechChars = options.maxSpeechChars ?? OBSERVATORY_DEFAULT_MAX_SPEECH_CHARS;
  const timestampMs = Date.parse(event.timestamp);
  const latestMs = state.latestEventTimestamp ? Date.parse(state.latestEventTimestamp) : Number.NEGATIVE_INFINITY;
  const isGloballyStale = Number.isFinite(timestampMs) && timestampMs < latestMs;
  const feedSequence = state.nextFeedSequence;
  const nextState: ObservatoryRuntimeVisualState = {
    ...state,
    activityFeed: trimEntries(insertFeedEntry(state.activityFeed, toFeedEntry(event, feedSequence)), maxFeedEntries),
    eventHistory: trimEntries(insertEventHistory(state.eventHistory, event), maxEventHistory),
    latestEventTimestamp: isGloballyStale ? state.latestEventTimestamp : event.timestamp,
    nextFeedSequence: feedSequence + 1,
  };

  let reducedState = nextState;

  if (event.agentId) {
    reducedState = updateAgentState(reducedState, event, maxSpeechChars);
  }

  if (event.taskId) {
    reducedState = updateTaskState(reducedState, event);
  }

  if (event.workflowId) {
    reducedState = updateWorkflowState(reducedState, event);
  }

  if (reducedState === nextState && isGloballyStale) {
    return {
      ...reducedState,
      droppedStaleEventCount: reducedState.droppedStaleEventCount + 1,
    };
  }

  return reducedState;
}

export function reduceObservatoryRuntimeEvents(
  state: ObservatoryRuntimeVisualState,
  events: ObservatoryNormalizedOfficeEvent[],
  options: ObservatoryRuntimeReducerOptions = {},
): ObservatoryRuntimeVisualState {
  return events.reduce((nextState, event) => reduceObservatoryRuntimeEvent(nextState, event, options), state);
}

function updateAgentState(
  state: ObservatoryRuntimeVisualState,
  event: ObservatoryNormalizedOfficeEvent,
  maxSpeechChars: number,
): ObservatoryRuntimeVisualState {
  if (!event.agentId || isEntityEventStale(state.agentsById[event.agentId]?.lastUpdatedAt, event.timestamp)) {
    return { ...state, droppedStaleEventCount: state.droppedStaleEventCount + 1 };
  }

  const existing = state.agentsById[event.agentId];
  const message = truncate(event.message, maxSpeechChars);
  const nextAgent: ObservatoryRuntimeAgentState = {
    id: event.agentId,
    status: agentStatusFromEvent(event, existing?.status),
    currentRoomId: event.roomId ?? existing?.currentRoomId,
    currentTaskId: event.taskId ?? existing?.currentTaskId,
    lastEventId: event.id,
    lastMessage: message ?? existing?.lastMessage,
    lastUpdatedAt: event.timestamp,
    speechBubble:
      event.type === 'AGENT_SPOKE' || event.type === 'LOG_RECEIVED'
        ? message
          ? { eventId: event.id, message, timestamp: event.timestamp }
          : existing?.speechBubble
        : existing?.speechBubble,
    taskProgress: resolveAgentTaskProgress(event, existing?.taskProgress),
    taskTitle: event.title ?? existing?.taskTitle,
    visualAction: coerceVisualAction(event.metadata?.visualAction) ?? existing?.visualAction,
    visualDirection: coerceVisualDirection(event.metadata?.visualDirection) ?? existing?.visualDirection,
  };

  return {
    ...state,
    agentsById: {
      ...state.agentsById,
      [event.agentId]: nextAgent,
    },
  };
}

function updateTaskState(
  state: ObservatoryRuntimeVisualState,
  event: ObservatoryNormalizedOfficeEvent,
): ObservatoryRuntimeVisualState {
  if (!event.taskId || isEntityEventStale(state.tasksById[event.taskId]?.lastUpdatedAt, event.timestamp)) {
    return { ...state, droppedStaleEventCount: state.droppedStaleEventCount + 1 };
  }

  const existing = state.tasksById[event.taskId];
  const nextTask: ObservatoryRuntimeTaskState = {
    id: event.taskId,
    lastEventId: event.id,
    lastUpdatedAt: event.timestamp,
    progress: resolveTaskProgress(event, existing?.progress),
    status: taskStatusFromEvent(event, existing?.status),
    title: event.title ?? existing?.title,
  };

  return {
    ...state,
    tasksById: {
      ...state.tasksById,
      [event.taskId]: nextTask,
    },
  };
}

function updateWorkflowState(
  state: ObservatoryRuntimeVisualState,
  event: ObservatoryNormalizedOfficeEvent,
): ObservatoryRuntimeVisualState {
  if (!event.workflowId || isEntityEventStale(state.workflowsById[event.workflowId]?.lastUpdatedAt, event.timestamp)) {
    return { ...state, droppedStaleEventCount: state.droppedStaleEventCount + 1 };
  }

  const existing = state.workflowsById[event.workflowId];
  const nextWorkflow: ObservatoryRuntimeWorkflowState = {
    id: event.workflowId,
    lastEventId: event.id,
    lastUpdatedAt: event.timestamp,
    roomId: event.roomId ?? existing?.roomId,
    status: workflowStatusFromEvent(event, existing?.status),
  };

  return {
    ...state,
    workflowsById: {
      ...state.workflowsById,
      [event.workflowId]: nextWorkflow,
    },
  };
}

function isEntityEventStale(existingTimestamp: string | undefined, nextTimestamp: string) {
  return existingTimestamp !== undefined && Date.parse(nextTimestamp) < Date.parse(existingTimestamp);
}

function agentStatusFromEvent(
  event: ObservatoryNormalizedOfficeEvent,
  fallback: ObservatoryRuntimeEntityStatus = 'unknown',
): ObservatoryRuntimeEntityStatus {
  if (event.type === 'AGENT_STATUS_CHANGED' && typeof event.metadata?.status === 'string') {
    return coerceStatus(event.metadata.status);
  }

  if (event.type === 'APPROVAL_REQUIRED') {
    return 'blocked';
  }

  if (event.type === 'TASK_FAILED' || event.type === 'TOOL_FAILED' || event.level === 'error') {
    return 'error';
  }

  if (event.type === 'TASK_COMPLETED' || event.type === 'TOOL_COMPLETED') {
    return 'complete';
  }

  if (event.type === 'TASK_STARTED' || event.type === 'TASK_PROGRESS' || event.type === 'TOOL_STARTED') {
    return 'working';
  }

  return fallback;
}

function taskStatusFromEvent(
  event: ObservatoryNormalizedOfficeEvent,
  fallback: ObservatoryRuntimeEntityStatus = 'unknown',
): ObservatoryRuntimeEntityStatus {
  if (event.type === 'TASK_STARTED') {
    return 'working';
  }

  if (event.type === 'TASK_PROGRESS') {
    return 'working';
  }

  if (event.type === 'APPROVAL_REQUIRED') {
    return 'blocked';
  }

  if (event.type === 'TASK_COMPLETED') {
    return 'complete';
  }

  if (event.type === 'TASK_FAILED') {
    return 'error';
  }

  return fallback;
}

function workflowStatusFromEvent(
  event: ObservatoryNormalizedOfficeEvent,
  fallback: ObservatoryRuntimeEntityStatus = 'unknown',
): ObservatoryRuntimeEntityStatus {
  if (event.type === 'APPROVAL_REQUIRED') {
    return 'blocked';
  }

  if (event.type === 'TASK_STARTED' || event.type === 'TASK_PROGRESS' || event.type === 'WORKFLOW_TRANSITIONED') {
    return 'working';
  }

  if (event.type === 'TASK_COMPLETED') {
    return 'complete';
  }

  if (event.type === 'TASK_FAILED') {
    return 'error';
  }

  return fallback;
}

function coerceStatus(status: string): ObservatoryRuntimeEntityStatus {
  if (status === 'idle' || status === 'working' || status === 'blocked' || status === 'complete' || status === 'error') {
    return status;
  }

  return 'unknown';
}

function coerceVisualAction(value: unknown): ObservatoryCharacterActionName | undefined {
  if (
    value === 'face' ||
    value === 'gift' ||
    value === 'grab-gun' ||
    value === 'gun-idle' ||
    value === 'high-chair-sit' ||
    value === 'hit' ||
    value === 'hurt' ||
    value === 'idle' ||
    value === 'lift' ||
    value === 'phone' ||
    value === 'pick-up' ||
    value === 'punch' ||
    value === 'push-cart' ||
    value === 'reading' ||
    value === 'shoot' ||
    value === 'sit' ||
    value === 'sleep' ||
    value === 'stab' ||
    value === 'throw' ||
    value === 'walk'
  ) {
    return value;
  }

  return undefined;
}

function coerceVisualDirection(value: unknown): ObservatoryCharacterDirection | undefined {
  if (value === 'down' || value === 'left' || value === 'right' || value === 'up') {
    return value;
  }

  return undefined;
}

function resolveAgentTaskProgress(event: ObservatoryNormalizedOfficeEvent, fallback: number | undefined) {
  if (event.type === 'TASK_STARTED') {
    return event.progress ?? 0;
  }

  if (event.type === 'TASK_COMPLETED') {
    return event.progress ?? 1;
  }

  if (event.type === 'TASK_PROGRESS' || event.type === 'TASK_FAILED') {
    return event.progress ?? fallback;
  }

  return fallback;
}

function resolveTaskProgress(event: ObservatoryNormalizedOfficeEvent, fallback: number | undefined) {
  if (event.type === 'TASK_STARTED') {
    return event.progress ?? 0;
  }

  if (event.type === 'TASK_COMPLETED') {
    return event.progress ?? 1;
  }

  return event.progress ?? fallback;
}

function insertFeedEntry(entries: ObservatoryActivityFeedEntry[], entry: ObservatoryActivityFeedEntry) {
  return [...entries, entry].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

function insertEventHistory(entries: ObservatoryNormalizedOfficeEvent[], event: ObservatoryNormalizedOfficeEvent) {
  return [...entries, event].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

function trimEntries<T>(entries: T[], maxEntries: number) {
  return entries.slice(0, Math.max(0, maxEntries));
}

function toFeedEntry(event: ObservatoryNormalizedOfficeEvent, sequence: number): ObservatoryActivityFeedEntry {
  return {
    agentId: event.agentId,
    eventId: event.id,
    id: `feed:${event.id}:${sequence}`,
    level: event.level,
    message: event.message,
    roomId: event.roomId,
    source: event.source,
    taskId: event.taskId,
    timestamp: event.timestamp,
    title: event.title,
    type: event.type,
    workflowId: event.workflowId,
  };
}

function truncate(value: string | undefined, maxChars: number) {
  if (!value) {
    return undefined;
  }

  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxChars - 1))}…`;
}
