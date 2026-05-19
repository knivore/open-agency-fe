export type ObservatoryAgentVisibilityMode =
  | 'activeWorkflow'
  | 'all'
  | 'executedWorkflow'
  | 'workflow';

export const DEFAULT_OBSERVATORY_RUNS_AGENT_VISIBILITY_MODE: ObservatoryAgentVisibilityMode =
  'activeWorkflow';

export const OBSERVATORY_AGENT_VISIBILITY_STORAGE_KEY = 'observatory:agent-visibility-mode';

const observatoryAgentVisibilityModes = new Set<ObservatoryAgentVisibilityMode>([
  'activeWorkflow',
  'all',
  'executedWorkflow',
  'workflow',
]);

export function normalizeObservatoryAgentVisibilityMode(
  value: unknown,
  fallback: ObservatoryAgentVisibilityMode = DEFAULT_OBSERVATORY_RUNS_AGENT_VISIBILITY_MODE
): ObservatoryAgentVisibilityMode {
  return typeof value === 'string' &&
    observatoryAgentVisibilityModes.has(value as ObservatoryAgentVisibilityMode)
    ? (value as ObservatoryAgentVisibilityMode)
    : fallback;
}

export function readObservatoryAgentVisibilityMode(
  fallback: ObservatoryAgentVisibilityMode = DEFAULT_OBSERVATORY_RUNS_AGENT_VISIBILITY_MODE
) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  return normalizeObservatoryAgentVisibilityMode(
    window.localStorage.getItem(OBSERVATORY_AGENT_VISIBILITY_STORAGE_KEY),
    fallback
  );
}

export function writeObservatoryAgentVisibilityMode(mode: ObservatoryAgentVisibilityMode) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(OBSERVATORY_AGENT_VISIBILITY_STORAGE_KEY, mode);
}
