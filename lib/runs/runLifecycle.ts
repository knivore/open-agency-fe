import type { JsonObject } from '@/types/api';

export interface ActiveRunWait {
  waitId: string | null;
  kind: string;
  wakeAt: string | null;
  deadlineAt: string | null;
}

export interface PersistentRunCycle {
  enabled: boolean;
  phase: string | null;
  cycleNumber: number | null;
  nextCycleNumber: number | null;
  nextWakeAt: string | null;
  lastCycleStatus: string | null;
  consecutiveFailures: number;
  noProgressCycles: number;
  guardReason: string | null;
  lastError: string | null;
}

export interface RunLifecycleSummary {
  activeWait: ActiveRunWait | null;
  persistentCycle: PersistentRunCycle | null;
}

function isRecord(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function integerValue(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

export function readRunLifecycle(metadata: JsonObject | undefined): RunLifecycleSummary {
  const wait = isRecord(metadata?.active_wait) ? metadata.active_wait : null;
  const cycle = isRecord(metadata?.persistent_cycle) ? metadata.persistent_cycle : null;

  return {
    activeWait: wait
      ? {
          waitId: stringValue(wait.wait_id),
          kind: stringValue(wait.kind) ?? 'unknown',
          wakeAt: stringValue(wait.wake_at),
          deadlineAt: stringValue(wait.deadline_at),
        }
      : null,
    persistentCycle: cycle
      ? {
          enabled: cycle.enabled === true,
          phase: stringValue(cycle.phase),
          cycleNumber: integerValue(cycle.cycle_number),
          nextCycleNumber: integerValue(cycle.next_cycle_number),
          nextWakeAt: stringValue(cycle.next_wake_at),
          lastCycleStatus: stringValue(cycle.last_cycle_status),
          consecutiveFailures: integerValue(cycle.consecutive_failures) ?? 0,
          noProgressCycles: integerValue(cycle.no_progress_cycles) ?? 0,
          guardReason: stringValue(cycle.guard_reason),
          lastError: stringValue(cycle.last_error),
        }
      : null,
  };
}

export function describeWaitKind(kind: string) {
  switch (kind) {
    case 'input':
      return 'Waiting for user input';
    case 'approval':
      return 'Waiting for approval';
    case 'event':
      return 'Waiting for an external event';
    case 'sleep':
      return 'Sleeping between monitor cycles';
    default:
      return `Waiting: ${kind.replace(/_/g, ' ')}`;
  }
}

export function isPausableRunStatus(status: string) {
  return status === 'running' || status === 'sleeping';
}
