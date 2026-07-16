import type { JsonObject } from '@/types/api';
import type { ExecutionEventRecord } from '@/types/runtime';

export type RunFailureCategory =
  | 'connection'
  | 'credentials'
  | 'model'
  | 'runtime'
  | 'timeout'
  | 'tool'
  | 'validation'
  | 'unknown';

export interface RunFailureDiagnosis {
  category: RunFailureCategory;
  title: string;
  evidence: string;
  evidenceEventType?: string;
  likelyCause: string;
  safestNextStep: string;
  primaryAction: {
    label: string;
    href: string;
  };
}

function record(value: unknown): JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : null;
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function eventFailureEvidence(event: ExecutionEventRecord) {
  const eventType = event.event_type.toLowerCase();
  const status = text(event.status)?.toLowerCase();
  if (!eventType.includes('fail') && !eventType.includes('error') && status !== 'failed') {
    return null;
  }
  const payload = record(event.payload);
  const error =
    text(payload?.error) ??
    text(payload?.message) ??
    text(payload?.reason) ??
    text(payload?.detail);
  if (!error) {
    return null;
  }
  return { error, eventType: event.event_type };
}

function firstFailureEvidence(events: ExecutionEventRecord[], runError?: string | null) {
  for (const event of events) {
    const evidence = eventFailureEvidence(event);
    if (evidence) {
      return evidence;
    }
  }
  return runError?.trim()
    ? { error: runError.trim(), eventType: undefined }
    : {
        error: 'The run ended in a failed state without a normalized error message.',
        eventType: undefined,
      };
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

export function diagnoseRunFailure({
  events,
  runError,
  workflowId,
}: {
  events: ExecutionEventRecord[];
  runError?: string | null;
  workflowId?: string | null;
}): RunFailureDiagnosis {
  const evidence = firstFailureEvidence(events, runError);
  const normalized = `${evidence.eventType ?? ''} ${evidence.error}`.toLowerCase();
  const workflowHref = workflowId ? `/workflows/${encodeURIComponent(workflowId)}` : '/workflows';

  if (
    includesAny(normalized, [
      'certificate verify failed',
      'connection refused',
      'dns',
      'self-signed certificate',
      'ssl',
      'tls',
    ])
  ) {
    return {
      category: 'connection',
      title: 'Secure connection failure',
      evidence: evidence.error,
      evidenceEventType: evidence.eventType,
      likelyCause:
        'The connector endpoint, certificate trust chain, DNS, or network route could not establish a secure connection.',
      safestNextStep:
        'Test the connector from Integrations and fix its endpoint or certificate trust before rerunning.',
      primaryAction: { label: 'Open Integrations', href: '/integrations' },
    };
  }

  if (
    includesAny(normalized, [
      '401',
      '403',
      'api key',
      'auth',
      'credential',
      'forbidden',
      'permission denied',
      'unauthorized',
    ])
  ) {
    return {
      category: 'credentials',
      title: 'Credential or permission failure',
      evidence: evidence.error,
      evidenceEventType: evidence.eventType,
      likelyCause:
        'A provider credential is missing, expired, scoped too narrowly, or unavailable to this workflow.',
      safestNextStep: 'Test the relevant integration or credential before starting another run.',
      primaryAction: { label: 'Open Integrations', href: '/integrations' },
    };
  }

  if (
    includesAny(normalized, [
      'context length',
      'context window',
      'fallback failed',
      'model.fallback',
      'model provider',
      'quota',
      'rate limit',
      'token limit',
    ])
  ) {
    return {
      category: 'model',
      title: 'Model or capacity failure',
      evidence: evidence.error,
      evidenceEventType: evidence.eventType,
      likelyCause:
        'The selected model, fallback route, quota, or context budget could not satisfy this run.',
      safestNextStep: 'Verify model health and fallback settings before rerunning the workflow.',
      primaryAction: { label: 'Open Models', href: '/models' },
    };
  }

  if (includesAny(normalized, ['deadline', 'timed out', 'timeout'])) {
    return {
      category: 'timeout',
      title: 'Execution timeout',
      evidence: evidence.error,
      evidenceEventType: evidence.eventType,
      likelyCause: 'A task, provider, or runtime exceeded its configured execution deadline.',
      safestNextStep:
        'Inspect the failed task and its timeout or retry policy before starting another run.',
      primaryAction: { label: 'Review Workflow', href: workflowHref },
    };
  }

  if (
    includesAny(normalized, [
      'connector',
      'mcp',
      'tool call',
      'tool execution',
      'tool failed',
      'webhook',
    ])
  ) {
    return {
      category: 'tool',
      title: 'Tool or connector failure',
      evidence: evidence.error,
      evidenceEventType: evidence.eventType,
      likelyCause: 'A workflow tool or external connector failed before returning a usable result.',
      safestNextStep:
        'Test the connector and review the selected tool parameters before rerunning.',
      primaryAction: { label: 'Open Integrations', href: '/integrations' },
    };
  }

  if (includesAny(normalized, ['container', 'docker', 'runtime adapter', 'spawn', 'worker'])) {
    return {
      category: 'runtime',
      title: 'Runtime or worker failure',
      evidence: evidence.error,
      evidenceEventType: evidence.eventType,
      likelyCause:
        'The selected runtime adapter, worker, or container could not complete the execution.',
      safestNextStep:
        'Confirm runtime health and worker availability before choosing a rerun adapter.',
      primaryAction: { label: 'Open Diagnostics', href: '/operations/diagnostics' },
    };
  }

  if (
    includesAny(normalized, [
      'agent not found',
      'invalid workflow',
      'missing agent',
      'missing task',
      'task not found',
      'validation',
    ]) ||
    (normalized.includes('workflow') && normalized.includes('not found'))
  ) {
    return {
      category: 'validation',
      title: 'Workflow validation failure',
      evidence: evidence.error,
      evidenceEventType: evidence.eventType,
      likelyCause: 'The saved workflow references missing or invalid execution configuration.',
      safestNextStep: 'Open the workflow readiness checks and fix every blocker before rerunning.',
      primaryAction: { label: 'Review Workflow', href: workflowHref },
    };
  }

  return {
    category: 'unknown',
    title: 'Run failure needs investigation',
    evidence: evidence.error,
    evidenceEventType: evidence.eventType,
    likelyCause: 'The backend reported a failure that does not match a known recovery category.',
    safestNextStep:
      'Inspect the timeline and ask the Assistant to correlate the error with the run evidence before rerunning.',
    primaryAction: { label: 'Inspect Timeline', href: '#run-timeline' },
  };
}
