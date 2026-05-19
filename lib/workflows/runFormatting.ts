import type { AgentRun } from '@/types/runtime';

export function normalizeRunStatus(status?: string | null): AgentRun['status'] {
  switch (status) {
    case 'created':
    case 'queued':
    case 'running':
    case 'waiting_for_approval':
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
