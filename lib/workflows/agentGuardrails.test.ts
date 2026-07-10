import { describe, expect, it } from 'vitest';
import { normalizeWorkflowAgentGuardrails } from '@/lib/workflows/agentGuardrails';

describe('agent guardrails', () => {
  it('normalizes persisted workflow agent guardrails', () => {
    expect(
      normalizeWorkflowAgentGuardrails([
        {
          id: ' guardrail-1 ',
          name: ' Require approval ',
          description: ' Escalate risky actions. ',
          mode: 'tool',
          config: { severity: 'high' },
        },
        {
          id: '',
          name: 'Fallback mode',
          mode: 'invalid',
          config: null,
        },
        {
          name: '   ',
          mode: 'policy',
        },
      ])
    ).toEqual([
      {
        id: 'guardrail-1',
        name: 'Require approval',
        description: 'Escalate risky actions.',
        mode: 'tool',
        config: { severity: 'high' },
      },
      {
        id: 'guardrail-2',
        name: 'Fallback mode',
        description: null,
        mode: 'policy',
        config: {},
      },
    ]);
  });
});
