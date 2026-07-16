import { describe, expect, it } from 'vitest';
import {
  describeRunEvidence,
  formatRunDuration,
  formatRunStatus,
} from '@/lib/runs/runPresentation';

describe('run presentation', () => {
  it('turns backend status identifiers into readable labels', () => {
    expect(formatRunStatus('waiting_for_approval')).toBe('waiting for approval');
  });

  it('prioritizes actionable failure evidence', () => {
    expect(
      describeRunEvidence({
        id: 'run-failed',
        status: 'failed',
        error: 'Provider credentials are missing.',
      })
    ).toBe('Provider credentials are missing.');
  });

  it('formats compact execution duration', () => {
    expect(
      formatRunDuration({
        id: 'run-complete',
        status: 'completed',
        startedAt: '2026-07-11T00:00:00.000Z',
        completedAt: '2026-07-11T00:02:05.000Z',
      })
    ).toBe('2m 5s');
  });
});
