import { describe, expect, it } from 'vitest';

import {
  createObservatoryPlatformRuntimeSources,
  createObservatoryPlatformSampleEvent,
  getObservatoryPlatformAdapter,
  OBSERVATORY_PLATFORM_ADAPTERS,
} from '@/modules/observatory/integrations/platformAdapters';
import { createObservatorySourceRegistry } from '@/modules/observatory/integrations/sourceRegistry';
import { normalizeObservatoryRuntimeEvent } from '@/modules/observatory/runtime/eventNormalizer';

describe('observatory pixel platform adapter placeholders', () => {
  it('defines Hermes, Claude Code, and Codex adapter profiles', () => {
    expect(OBSERVATORY_PLATFORM_ADAPTERS.map((adapter) => adapter.id)).toEqual([
      'hermes',
      'claude-code',
      'codex',
    ]);
    expect(getObservatoryPlatformAdapter('hermes')?.sourceType).toBe('hermes');
    expect(getObservatoryPlatformAdapter('claude-code')?.sourceType).toBe('claude_code');
    expect(getObservatoryPlatformAdapter('codex')?.sourceType).toBe('codex');
  });

  it('creates disabled runtime source placeholders until a host enables them', () => {
    const registry = createObservatorySourceRegistry(
      createObservatoryPlatformRuntimeSources(['https://example.test'])
    );
    const statuses = registry.listSources('https://example.test');

    expect(statuses).toHaveLength(3);
    expect(statuses.every((status) => status.enabled === false)).toBe(true);
    expect(statuses.every((status) => status.acceptsCurrentOrigin === true)).toBe(true);
    expect(registry.validateSourceOrigin('platform-codex', 'https://example.test')).toBe(false);
  });

  it('creates sample events compatible with the normalized runtime event contract', () => {
    const event = createObservatoryPlatformSampleEvent('codex');
    const normalized = normalizeObservatoryRuntimeEvent(event);

    expect(normalized.issues).toEqual([]);
    expect(normalized.event).toMatchObject({
      agentId: 'agent:codex',
      progress: 0.5,
      source: 'platform-codex',
      type: 'TASK_PROGRESS',
    });
  });
});
