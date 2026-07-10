import { validateObservatoryExternalRuntimeEvent } from '@/modules/observatory/runtime/eventValidation';
import type {
  ObservatoryEventNormalizationResult,
  ObservatoryExternalRuntimeEvent,
  ObservatoryNormalizedEventType,
  ObservatoryNormalizedOfficeEvent,
  ObservatoryRuntimeLevel,
} from '@/modules/observatory/runtime/events';

const externalToNormalizedType: Record<string, ObservatoryNormalizedEventType> = {
  agent_said: 'AGENT_SPOKE',
  agent_spoke: 'AGENT_SPOKE',
  agent_status_changed: 'AGENT_STATUS_CHANGED',
  approval_required: 'APPROVAL_REQUIRED',
  file_changed: 'FILE_CHANGED',
  log_received: 'LOG_RECEIVED',
  task_completed: 'TASK_COMPLETED',
  task_failed: 'TASK_FAILED',
  task_progress: 'TASK_PROGRESS',
  task_started: 'TASK_STARTED',
  tool_completed: 'TOOL_COMPLETED',
  tool_failed: 'TOOL_FAILED',
  tool_started: 'TOOL_STARTED',
  workflow_transitioned: 'WORKFLOW_TRANSITIONED',
};

const defaultLevelsByType: Partial<
  Record<ObservatoryNormalizedEventType, ObservatoryRuntimeLevel>
> = {
  TASK_COMPLETED: 'success',
  TASK_FAILED: 'error',
  TOOL_FAILED: 'error',
};

export function normalizeObservatoryRuntimeEvent(
  rawEvent: unknown
): ObservatoryEventNormalizationResult {
  const validation = validateObservatoryExternalRuntimeEvent(rawEvent);

  if (!validation.event) {
    return { issues: validation.issues };
  }

  return normalizeValidatedObservatoryRuntimeEvent(validation.event);
}

export function normalizeValidatedObservatoryRuntimeEvent(
  event: ObservatoryExternalRuntimeEvent
): ObservatoryEventNormalizationResult {
  const normalizedType = externalToNormalizedType[event.type];

  if (!normalizedType) {
    return {
      issues: [{ path: 'type', reason: `unsupported external event type: ${event.type}` }],
    };
  }

  return {
    event: toNormalizedEvent(event, normalizedType),
    issues: [],
  };
}

function toNormalizedEvent(
  event: ObservatoryExternalRuntimeEvent,
  normalizedType: ObservatoryNormalizedEventType
): ObservatoryNormalizedOfficeEvent {
  return {
    id: event.id,
    source: event.source,
    type: normalizedType,
    timestamp: event.timestamp,
    agentId: event.actor?.id,
    workflowId: event.workflow?.id,
    taskId: event.task?.id,
    roomId: event.workflow?.roomId,
    level: event.level ?? defaultLevelsByType[normalizedType] ?? 'info',
    title: event.task?.title ?? event.workflow?.name,
    message: event.message,
    progress: event.task?.progress,
    metadata: event.metadata,
  };
}
