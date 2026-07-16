import { describe, expect, it } from 'vitest';
import {
  readPersistentCycleConfiguration,
  writePersistentCycleConfiguration,
} from '@/lib/workflows/persistentCycle';

describe('persistent cycle workflow metadata', () => {
  it('reads backend defaults when no cycle policy exists', () => {
    expect(readPersistentCycleConfiguration({})).toEqual({
      enabled: false,
      intervalSeconds: 60,
      failureBackoffMultiplier: 2,
      maxIntervalSeconds: 3600,
      maxConsecutiveFailures: 5,
      maxCycles: null,
      maxNoProgressCycles: null,
    });
  });

  it('preserves unrelated lifecycle and advanced cycle metadata', () => {
    const metadata = writePersistentCycleConfiguration(
      {
        source: 'catalog',
        execution_lifecycle: {
          terminate_container_on_completion: false,
          persistent_cycle: { jitter_ratio: 0.1, history_limit: 10 },
        },
      },
      {
        enabled: true,
        intervalSeconds: 30,
        failureBackoffMultiplier: 3,
        maxIntervalSeconds: 300,
        maxConsecutiveFailures: 4,
        maxCycles: 20,
        maxNoProgressCycles: 5,
      }
    );

    expect(metadata).toEqual({
      source: 'catalog',
      execution_lifecycle: {
        terminate_container_on_completion: false,
        persistent_cycle: {
          jitter_ratio: 0.1,
          history_limit: 10,
          enabled: true,
          interval_seconds: 30,
          failure_backoff_multiplier: 3,
          max_interval_seconds: 300,
          max_consecutive_failures: 4,
          max_cycles: 20,
          max_no_progress_cycles: 5,
        },
      },
    });
  });
});
