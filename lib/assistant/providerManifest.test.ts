import { describe, expect, it } from 'vitest';
import { assistantProviderMetadata } from '@/lib/assistant/providerManifest';
import type { AssistantPageContextSnapshot } from '@/components/assistant/AssistantPageContext';

function pageContext(
  overrides: Partial<AssistantPageContextSnapshot>
): AssistantPageContextSnapshot {
  return {
    surface: 'unknown',
    route: '/test',
    pathname: '/test',
    title: 'Test',
    updatedAt: '2026-05-27T00:00:00.000Z',
    ...overrides,
  };
}

function providerIds(metadata: ReturnType<typeof assistantProviderMetadata>) {
  return ((metadata.assistant_providers as { providers: Array<{ id: string }> }).providers ?? [])
    .map((provider) => provider.id)
    .sort();
}

describe('assistantProviderMetadata', () => {
  it('exposes agent provider metadata on the agents page', () => {
    const metadata = assistantProviderMetadata(
      pageContext({
        surface: 'agent.list',
        route: '/agents',
        pathname: '/agents',
        entities: [{ type: 'agent', id: 'agent-main', name: 'Main Agent' }],
        selection: { agentId: 'agent-main' },
        allowedActions: ['agent.inspect', 'agent.propose_update'],
      })
    );

    expect(providerIds(metadata)).toEqual(['agent.provider']);
    expect(JSON.stringify(metadata)).toContain('agency.agent.propose-update');
    expect(JSON.stringify(metadata)).not.toContain('assistant_actions');
  });

  it('exposes execution provider metadata on run detail pages', () => {
    const metadata = assistantProviderMetadata(
      pageContext({
        surface: 'runs.detail',
        route: '/runs/run-1',
        pathname: '/runs/run-1',
        entities: [{ type: 'run', id: 'run-1', name: 'Run 1' }],
        selection: { runId: 'run-1' },
      })
    );

    expect(providerIds(metadata)).toEqual(['execution.provider']);
    expect(JSON.stringify(metadata)).toContain('agency.execution.pause');
  });

  it('exposes connector and tool provider metadata on integrations pages', () => {
    const metadata = assistantProviderMetadata(
      pageContext({
        surface: 'integrations',
        route: '/integrations',
        pathname: '/integrations',
        entities: [{ type: 'connector', id: 'telegram-bot', name: 'Telegram' }],
        selection: { provider: 'telegram-bot' },
      })
    );

    expect(providerIds(metadata)).toEqual(['connector.provider', 'tool.provider']);
    expect(JSON.stringify(metadata)).toContain('agency.connector.credentials');
    expect(JSON.stringify(metadata)).toContain('agency.connector.resolve');
  });
});
