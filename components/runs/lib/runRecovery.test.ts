import { describe, expect, it } from 'vitest';
import { diagnoseRunFailure } from '@/components/runs/lib/runRecovery';
import type { ExecutionEventRecord } from '@/types/runtime';

function event(eventType: string, error: string): ExecutionEventRecord {
  return {
    id: `event-${eventType}`,
    execution_id: 'run-1',
    sequence: 1,
    event_type: eventType,
    created_at: '2026-07-10T00:00:00.000Z',
    payload: { error },
  };
}

describe('diagnoseRunFailure', () => {
  it('prioritizes the first actionable failure event over the terminal summary', () => {
    const diagnosis = diagnoseRunFailure({
      events: [
        event('tool.execution.failed', 'Connector credential returned 401 Unauthorized.'),
        event('execution.failed', 'Workflow failed.'),
      ],
      runError: 'Generic terminal failure.',
      workflowId: 'workflow-1',
    });

    expect(diagnosis).toMatchObject({
      category: 'credentials',
      evidence: 'Connector credential returned 401 Unauthorized.',
      primaryAction: { href: '/integrations' },
    });
  });

  it('routes model capacity failures to model configuration', () => {
    const diagnosis = diagnoseRunFailure({
      events: [event('model.fallback.failed', 'All fallbacks failed after a rate limit.')],
    });

    expect(diagnosis.category).toBe('model');
    expect(diagnosis.primaryAction).toEqual({ label: 'Open Models', href: '/models' });
  });

  it('routes timeouts back to the workflow configuration', () => {
    const diagnosis = diagnoseRunFailure({
      events: [],
      runError: 'Task timed out after 120 seconds.',
      workflowId: 'workflow/with spaces',
    });

    expect(diagnosis.category).toBe('timeout');
    expect(diagnosis.primaryAction.href).toBe('/workflows/workflow%2Fwith%20spaces');
  });

  it('routes certificate verification failures to connector testing', () => {
    const diagnosis = diagnoseRunFailure({
      events: [
        event(
          'tool.call.failed',
          '[SSL: CERTIFICATE_VERIFY_FAILED] self-signed certificate in certificate chain'
        ),
      ],
    });

    expect(diagnosis).toMatchObject({
      category: 'connection',
      title: 'Secure connection failure',
      primaryAction: { href: '/integrations' },
    });
  });

  it('routes missing workflow references to workflow validation', () => {
    const diagnosis = diagnoseRunFailure({
      events: [event('tool.call.failed', "Workflow 'agency.system.graph' was not found")],
      workflowId: 'workflow-1',
    });

    expect(diagnosis).toMatchObject({
      category: 'validation',
      title: 'Workflow validation failure',
      primaryAction: { href: '/workflows/workflow-1' },
    });
  });

  it('provides an evidence-first fallback for unknown failures', () => {
    const diagnosis = diagnoseRunFailure({ events: [], runError: null });

    expect(diagnosis.category).toBe('unknown');
    expect(diagnosis.evidence).toContain('without a normalized error');
    expect(diagnosis.primaryAction.href).toBe('#run-timeline');
  });
});
