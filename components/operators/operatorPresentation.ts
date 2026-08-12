import type { OperatorDefinition, OperatorStatus } from '@/types/operators';

function operatorDate(value: string) {
  // Backend domain timestamps are UTC even when SQLite/Pydantic serializes them without an offset.
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`;
  return new Date(normalized);
}

export const operatorStatusLabel: Record<OperatorStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  sleeping: 'Sleeping',
  waiting_for_input: 'Waiting for input',
  waiting_for_approval: 'Waiting for approval',
  paused: 'Paused',
  degraded: 'Degraded',
  stopped: 'Stopped',
  archived: 'Archived',
};

export const operatorStatusTone: Record<
  OperatorStatus,
  'neutral' | 'success' | 'warning' | 'danger' | 'info'
> = {
  draft: 'neutral',
  active: 'success',
  sleeping: 'info',
  waiting_for_input: 'warning',
  waiting_for_approval: 'warning',
  paused: 'neutral',
  degraded: 'danger',
  stopped: 'danger',
  archived: 'neutral',
};

export function formatOperatorTime(value?: string | null) {
  if (!value) return 'Not scheduled';
  const date = operatorDate(value);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatRelativeTime(value?: string | null) {
  if (!value) return 'Never';
  const date = operatorDate(value);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const ranges: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, size] of ranges) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
  }
  return formatter.format(seconds, 'second');
}

export function operatorBudget(operator: OperatorDefinition) {
  const policy = operator.budget_policy;
  const maxCost = Number(policy.max_cost ?? policy.max_model_spend ?? 0);
  const maxActions = Number(policy.max_actions ?? policy.max_actions_per_evaluation ?? 0);
  return {
    maxCost: Number.isFinite(maxCost) ? maxCost : 0,
    maxActions: Number.isFinite(maxActions) ? maxActions : 0,
  };
}

export function humanizeIdentifier(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
