import { describe, expect, it } from 'vitest';
import { resolveAssistantRouteContext } from '@/lib/assistant/pageContextCatalog';

describe('resolveAssistantRouteContext', () => {
  it.each([
    ['/workflows', 'workflow.list'],
    ['/workflows/workflow-1', 'workflow.detail'],
    ['/agents', 'agent.list'],
    ['/goals', 'goal.list'],
    ['/goals/goal-1', 'goal.detail'],
    ['/persona', 'persona.list'],
    ['/persona/persona-1', 'persona.detail'],
    ['/runs', 'runs.list'],
    ['/runs/run-1', 'runs.detail'],
    ['/models', 'model.list'],
    ['/integrations', 'integrations'],
    ['/integrations/smart-home', 'smart-home'],
    ['/memory-graph', 'agency.graph'],
    ['/profile', 'profile'],
    ['/help/faq', 'faq'],
    ['/operations/memory', 'memory'],
    ['/operations/main-agent-monitor', 'monitor'],
    ['/operations/diagnostics', 'diagnostics'],
    ['/operations/devices', 'devices'],
    ['/observatory/builder', 'observatory.builder'],
    ['/assistant', 'assistant'],
  ])('maps %s to the %s Assistant surface', (pathname, surface) => {
    expect(resolveAssistantRouteContext(pathname).surface).toBe(surface);
  });

  it('provides non-mutating contextual prompts for operational pages', () => {
    const context = resolveAssistantRouteContext('/runs/run-failed');

    expect(context.suggestedPrompts).toHaveLength(3);
    expect(context.suggestedPrompts?.[0]).toMatchObject({
      label: 'Explain the failure',
      intent: 'diagnose',
      mutates: false,
    });
    expect(context.allowedActions).toContain('run.retry');
  });

  it('falls back to a safe explanatory prompt for an unknown route', () => {
    const context = resolveAssistantRouteContext('/future-surface');

    expect(context.surface).toBe('unknown');
    expect(context.suggestedPrompts).toEqual([
      expect.objectContaining({
        label: 'Explain this page',
        mutates: false,
      }),
    ]);
  });
});
