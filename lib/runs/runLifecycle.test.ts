import { describe, expect, it } from 'vitest';
import { describeWaitKind, isPausableRunStatus, readRunLifecycle } from '@/lib/runs/runLifecycle';

describe('run lifecycle metadata', () => {
  it('derives active wait and persistent cycle state', () => {
    expect(
      readRunLifecycle({
        active_wait: {
          wait_id: 'wait-1',
          kind: 'sleep',
          wake_at: '2026-07-13T12:00:00Z',
        },
        persistent_cycle: {
          enabled: true,
          phase: 'sleeping',
          cycle_number: 3,
          next_cycle_number: 4,
          next_wake_at: '2026-07-13T12:00:00Z',
          consecutive_failures: 1,
          no_progress_cycles: 2,
        },
      })
    ).toEqual({
      activeWait: {
        waitId: 'wait-1',
        kind: 'sleep',
        wakeAt: '2026-07-13T12:00:00Z',
        deadlineAt: null,
      },
      persistentCycle: {
        enabled: true,
        phase: 'sleeping',
        cycleNumber: 3,
        nextCycleNumber: 4,
        nextWakeAt: '2026-07-13T12:00:00Z',
        lastCycleStatus: null,
        consecutiveFailures: 1,
        noProgressCycles: 2,
        guardReason: null,
        lastError: null,
      },
    });
  });

  it('allows an operator to pause a sleeping cycle but not unresolved input waits', () => {
    expect(isPausableRunStatus('sleeping')).toBe(true);
    expect(isPausableRunStatus('waiting_for_input')).toBe(false);
    expect(describeWaitKind('event')).toBe('Waiting for an external event');
  });
});
