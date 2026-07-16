import type { AgentRun } from '@/types/runtime';

const runDateTimeFormatter = new Intl.DateTimeFormat('en-SG', {
  timeZone: 'Asia/Singapore',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export function normalizeRunStatus(status?: string | null): AgentRun['status'] {
  switch (status) {
    case 'created':
    case 'queued':
    case 'running':
    case 'waiting_for_input':
    case 'waiting_for_approval':
    case 'waiting_for_event':
    case 'sleeping':
    case 'paused':
    case 'cancelling':
    case 'completed':
    case 'failed':
    case 'cancelled':
      return status;
    default:
      return 'unknown';
  }
}

export function formatRunError(error?: string | null) {
  return error?.trim() || 'No runtime error reported.';
}

export function formatRunDateTime(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : runDateTimeFormatter.format(date);
}
