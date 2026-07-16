import type { JsonObject } from '@/types/api';

export interface PersistentCycleConfiguration {
  enabled: boolean;
  intervalSeconds: number;
  failureBackoffMultiplier: number;
  maxIntervalSeconds: number;
  maxConsecutiveFailures: number;
  maxCycles: number | null;
  maxNoProgressCycles: number | null;
}

const DEFAULT_CONFIGURATION: PersistentCycleConfiguration = {
  enabled: false,
  intervalSeconds: 60,
  failureBackoffMultiplier: 2,
  maxIntervalSeconds: 3600,
  maxConsecutiveFailures: 5,
  maxCycles: null,
  maxNoProgressCycles: null,
};

function isRecord(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function positiveNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function optionalPositiveInteger(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

export function readPersistentCycleConfiguration(
  metadata: JsonObject | undefined
): PersistentCycleConfiguration {
  const lifecycle = isRecord(metadata?.execution_lifecycle)
    ? metadata.execution_lifecycle
    : undefined;
  const cycle = isRecord(lifecycle?.persistent_cycle) ? lifecycle.persistent_cycle : undefined;

  return {
    enabled: cycle?.enabled === true,
    intervalSeconds: positiveNumber(cycle?.interval_seconds, DEFAULT_CONFIGURATION.intervalSeconds),
    failureBackoffMultiplier: positiveNumber(
      cycle?.failure_backoff_multiplier,
      DEFAULT_CONFIGURATION.failureBackoffMultiplier
    ),
    maxIntervalSeconds: positiveNumber(
      cycle?.max_interval_seconds,
      DEFAULT_CONFIGURATION.maxIntervalSeconds
    ),
    maxConsecutiveFailures: optionalPositiveInteger(cycle?.max_consecutive_failures) ?? 5,
    maxCycles: optionalPositiveInteger(cycle?.max_cycles),
    maxNoProgressCycles: optionalPositiveInteger(cycle?.max_no_progress_cycles),
  };
}

export function writePersistentCycleConfiguration(
  metadata: JsonObject | undefined,
  configuration: PersistentCycleConfiguration
): JsonObject {
  const lifecycle = isRecord(metadata?.execution_lifecycle) ? metadata.execution_lifecycle : {};
  const existingCycle = isRecord(lifecycle.persistent_cycle) ? lifecycle.persistent_cycle : {};
  const persistentCycle: JsonObject = {
    ...existingCycle,
    enabled: configuration.enabled,
    interval_seconds: Math.max(1, configuration.intervalSeconds),
    failure_backoff_multiplier: Math.max(1, configuration.failureBackoffMultiplier),
    max_interval_seconds: Math.max(configuration.intervalSeconds, configuration.maxIntervalSeconds),
    max_consecutive_failures: Math.max(1, Math.floor(configuration.maxConsecutiveFailures)),
  };

  if (configuration.maxCycles === null) {
    delete persistentCycle.max_cycles;
  } else {
    persistentCycle.max_cycles = Math.max(1, Math.floor(configuration.maxCycles));
  }
  if (configuration.maxNoProgressCycles === null) {
    delete persistentCycle.max_no_progress_cycles;
  } else {
    persistentCycle.max_no_progress_cycles = Math.max(
      1,
      Math.floor(configuration.maxNoProgressCycles)
    );
  }

  return {
    ...(metadata ?? {}),
    execution_lifecycle: {
      ...lifecycle,
      persistent_cycle: persistentCycle,
    },
  };
}
