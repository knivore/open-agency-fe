import type {
  ObservatoryEventValidationIssue,
  ObservatoryExternalRuntimeEvent,
  ObservatoryRuntimeLevel,
  ObservatoryRuntimeSourceType,
  ObservatoryValidatedExternalRuntimeEvent,
} from '@/modules/observatory/runtime/events';
import { AGENCY_RUNTIME_EVENT_SCHEMA_VERSION } from '@/modules/observatory/runtime/events';

const sourceTypes = new Set<ObservatoryRuntimeSourceType>([
  'agency',
  'hermes',
  'claude_code',
  'codex',
  'custom',
  'local',
]);
const levels = new Set<ObservatoryRuntimeLevel>(['debug', 'info', 'warning', 'error', 'success']);
const maxMessageLength = 1_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function pushIssue(issues: ObservatoryEventValidationIssue[], path: string, reason: string) {
  issues.push({ path, reason });
}

function optionalString(value: unknown) {
  return value === undefined || typeof value === 'string';
}

function optionalRecord(value: unknown) {
  return value === undefined || isRecord(value);
}

function validateActor(value: unknown, issues: ObservatoryEventValidationIssue[]) {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    pushIssue(issues, 'actor', 'must be an object');
    return;
  }

  if (!isNonEmptyString(value.id)) {
    pushIssue(issues, 'actor.id', 'must be a non-empty string');
  }

  for (const field of ['name', 'role', 'avatarAssetId']) {
    if (!optionalString(value[field])) {
      pushIssue(issues, `actor.${field}`, 'must be a string when present');
    }
  }
}

function validateWorkflow(value: unknown, issues: ObservatoryEventValidationIssue[]) {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    pushIssue(issues, 'workflow', 'must be an object');
    return;
  }

  if (!isNonEmptyString(value.id)) {
    pushIssue(issues, 'workflow.id', 'must be a non-empty string');
  }

  for (const field of ['name', 'roomId']) {
    if (!optionalString(value[field])) {
      pushIssue(issues, `workflow.${field}`, 'must be a string when present');
    }
  }
}

function validateTask(value: unknown, issues: ObservatoryEventValidationIssue[]) {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    pushIssue(issues, 'task', 'must be an object');
    return;
  }

  if (!isNonEmptyString(value.id)) {
    pushIssue(issues, 'task.id', 'must be a non-empty string');
  }

  if (!optionalString(value.title)) {
    pushIssue(issues, 'task.title', 'must be a string when present');
  }

  if (
    value.progress !== undefined &&
    (typeof value.progress !== 'number' || value.progress < 0 || value.progress > 1)
  ) {
    pushIssue(issues, 'task.progress', 'must be a number between 0 and 1 when present');
  }
}

export function validateObservatoryExternalRuntimeEvent(
  value: unknown
): ObservatoryValidatedExternalRuntimeEvent {
  const issues: ObservatoryEventValidationIssue[] = [];

  if (!isRecord(value)) {
    return { issues: [{ path: 'event', reason: 'must be an object' }] };
  }

  if (!isNonEmptyString(value.id)) {
    pushIssue(issues, 'id', 'must be a non-empty string');
  }

  if (
    value.schemaVersion !== undefined &&
    value.schemaVersion !== AGENCY_RUNTIME_EVENT_SCHEMA_VERSION
  ) {
    pushIssue(
      issues,
      'schemaVersion',
      `must be ${AGENCY_RUNTIME_EVENT_SCHEMA_VERSION} when present`
    );
  }

  if (!isNonEmptyString(value.source)) {
    pushIssue(issues, 'source', 'must be a non-empty string');
  }

  if (
    typeof value.sourceType !== 'string' ||
    !sourceTypes.has(value.sourceType as ObservatoryRuntimeSourceType)
  ) {
    pushIssue(issues, 'sourceType', 'must be agency, hermes, claude_code, codex, custom, or local');
  }

  if (!isNonEmptyString(value.type)) {
    pushIssue(issues, 'type', 'must be a non-empty string');
  }

  if (!isNonEmptyString(value.timestamp) || Number.isNaN(Date.parse(value.timestamp))) {
    pushIssue(issues, 'timestamp', 'must be a valid timestamp string');
  }

  if (
    value.level !== undefined &&
    (typeof value.level !== 'string' || !levels.has(value.level as ObservatoryRuntimeLevel))
  ) {
    pushIssue(issues, 'level', 'must be debug, info, warning, error, or success');
  }

  if (
    value.message !== undefined &&
    (typeof value.message !== 'string' || value.message.length > maxMessageLength)
  ) {
    pushIssue(
      issues,
      'message',
      `must be a string up to ${maxMessageLength} characters when present`
    );
  }

  if (!optionalRecord(value.metadata)) {
    pushIssue(issues, 'metadata', 'must be an object when present');
  }

  validateActor(value.actor, issues);
  validateWorkflow(value.workflow, issues);
  validateTask(value.task, issues);

  return {
    event: issues.length === 0 ? (value as unknown as ObservatoryExternalRuntimeEvent) : undefined,
    issues,
  };
}
