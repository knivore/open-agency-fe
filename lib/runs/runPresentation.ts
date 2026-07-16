import type { RunSessionSummary } from '@/types/runtime';

const runDateTimeFormatter = new Intl.DateTimeFormat('en-SG', {
  timeZone: 'Asia/Singapore',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatRunStatus(status: string) {
  return status.replace(/_/g, ' ');
}

export function runStatusTone(status: string) {
  switch (status) {
    case 'completed':
      return {
        card: 'border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-500/12',
        badge:
          'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200',
        dot: 'bg-emerald-500',
        text: 'text-emerald-700 dark:text-emerald-200',
      };
    case 'running':
    case 'queued':
    case 'created':
      return {
        card: 'border-l-sky-500 bg-sky-50/50 dark:bg-sky-500/12',
        badge:
          'border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-200',
        dot: 'bg-sky-500',
        text: 'text-sky-700 dark:text-sky-200',
      };
    case 'waiting_for_approval':
    case 'waiting_for_input':
    case 'waiting_for_event':
    case 'sleeping':
    case 'paused':
    case 'cancelling':
      return {
        card: 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-500/12',
        badge:
          'border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200',
        dot: 'bg-amber-500',
        text: 'text-amber-700 dark:text-amber-200',
      };
    case 'failed':
    case 'cancelled':
      return {
        card: 'border-l-red-500 bg-red-50/50 dark:bg-red-500/12',
        badge:
          'border-red-200 bg-red-100 text-red-800 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200',
        dot: 'bg-red-500',
        text: 'text-red-700 dark:text-red-200',
      };
    default:
      return {
        card: 'border-l-neutral-400 bg-neutral-50/70 dark:bg-white/4',
        badge:
          'border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-white/10 dark:bg-white/6 dark:text-neutral-200',
        dot: 'bg-neutral-400',
        text: 'text-neutral-600 dark:text-neutral-300',
      };
  }
}

export function formatRunListDateTime(value?: string | null) {
  if (!value) {
    return 'Not started';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown time' : runDateTimeFormatter.format(date);
}

export function formatRunDuration(run: RunSessionSummary) {
  if (!run.startedAt) {
    return 'Not started';
  }

  const startedAt = new Date(run.startedAt).getTime();
  const finishedAt = run.completedAt ? new Date(run.completedAt).getTime() : Date.now();
  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt) || finishedAt < startedAt) {
    return 'Unknown';
  }

  const seconds = Math.max(0, Math.round((finishedAt - startedAt) / 1000));
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export function describeRunEvidence(run: RunSessionSummary) {
  if (run.error?.trim()) {
    return run.error.trim();
  }
  if (run.status === 'waiting_for_approval') {
    return run.currentNodeId
      ? `Approval or input required at ${run.currentNodeId}.`
      : 'Approval or input is required before execution can continue.';
  }
  if (run.status === 'waiting_for_input') {
    return run.currentNodeId
      ? `Waiting for input at ${run.currentNodeId}.`
      : 'User input is required before execution can continue.';
  }
  if (run.status === 'waiting_for_event') {
    return 'Waiting for an external event before execution can continue.';
  }
  if (run.status === 'sleeping') {
    return 'Sleeping until the next persistent monitor cycle.';
  }
  if (run.status === 'running') {
    return run.currentNodeId ? `Running ${run.currentNodeId}.` : 'Execution is in progress.';
  }
  if (run.status === 'queued' || run.status === 'created') {
    return 'Waiting for a runtime worker.';
  }
  if (run.status === 'paused') {
    return run.currentNodeId ? `Paused at ${run.currentNodeId}.` : 'Execution is paused.';
  }
  if (run.status === 'completed') {
    return 'Execution completed successfully.';
  }
  if (run.status === 'cancelled') {
    return 'Execution was stopped before completion.';
  }
  return run.runtimeAdapterId
    ? `Runtime: ${run.runtimeAdapterId}`
    : 'No execution evidence reported yet.';
}
