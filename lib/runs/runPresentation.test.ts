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

  it('summarizes verbose validation failures while keeping the source error intact', () => {
    const run = { id: 'schema-run', status: 'failed' as const, error: 'input is not of type object\nFailed validating type in schema' };
    expect(describeRunEvidence(run)).toContain('required schema');
    expect(run.error).toContain('Failed validating');
    expect(describeRunEvidence({ id: 'finished', status: 'completed' })).toContain('Inspect outputs and evidence');
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
