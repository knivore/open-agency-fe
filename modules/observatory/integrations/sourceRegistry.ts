import type { ObservatoryRuntimeSourceType } from '@/modules/observatory/runtime/events';
import { createObservatoryPlatformRuntimeSources } from '@/modules/observatory/integrations/platformAdapters';

export interface ObservatoryRuntimeSourceConfig {
  id: string;
  label: string;
  type: ObservatoryRuntimeSourceType;
  enabled: boolean;
  allowedOrigins: string[];
  description?: string;
}

export interface ObservatoryRuntimeSourceStatus {
  id: string;
  label: string;
  type: ObservatoryRuntimeSourceType;
  enabled: boolean;
  acceptsCurrentOrigin: boolean;
  description?: string;
}

export interface ObservatorySourceRegistry {
  getSource(sourceId: string): ObservatoryRuntimeSourceConfig | undefined;
  listSources(currentOrigin?: string): ObservatoryRuntimeSourceStatus[];
  upsertSource(source: ObservatoryRuntimeSourceConfig): void;
  validateSourceOrigin(sourceId: string, origin: string): boolean;
}

export const OBSERVATORY_LOCAL_SOURCE_ID = 'local-preview';
export const OBSERVATORY_POST_MESSAGE_SOURCE_ID = 'post-message-preview';
export const OBSERVATORY_LOCAL_SDK_SOURCE_ID = 'local-sdk-preview';
export const OBSERVATORY_GENERIC_WEBSOCKET_SOURCE_ID = 'generic-websocket';
export const OBSERVATORY_GENERIC_SSE_SOURCE_ID = 'generic-sse';

export const OBSERVATORY_DEFAULT_RUNTIME_SOURCES: ObservatoryRuntimeSourceConfig[] = [
  {
    id: OBSERVATORY_LOCAL_SOURCE_ID,
    label: 'Local sample replay',
    type: 'local',
    enabled: true,
    allowedOrigins: ['self'],
    description: 'Built-in sample event replay used by the runs preview.',
  },
  {
    id: OBSERVATORY_LOCAL_SDK_SOURCE_ID,
    label: 'Local SDK client',
    type: 'custom',
    enabled: true,
    allowedOrigins: ['self'],
    description: 'In-memory client for FE-only integration tests and demos.',
  },
  {
    id: OBSERVATORY_POST_MESSAGE_SOURCE_ID,
    label: 'Window postMessage',
    type: 'custom',
    enabled: true,
    allowedOrigins: ['self'],
    description: 'Same-origin browser event bridge for previewing external event producers.',
  },
  {
    id: OBSERVATORY_GENERIC_WEBSOCKET_SOURCE_ID,
    label: 'Generic WebSocket stream',
    type: 'custom',
    enabled: true,
    allowedOrigins: ['self'],
    description: 'Direct browser WebSocket adapter for external runtime event producers.',
  },
  {
    id: OBSERVATORY_GENERIC_SSE_SOURCE_ID,
    label: 'Generic SSE stream',
    type: 'custom',
    enabled: true,
    allowedOrigins: ['self'],
    description: 'Direct browser Server-Sent Events adapter for external runtime event producers.',
  },
  ...createObservatoryPlatformRuntimeSources(),
];

function resolveAllowedOrigins(allowedOrigins: string[], currentOrigin?: string) {
  return allowedOrigins
    .map((origin) => (origin === 'self' ? currentOrigin : origin))
    .filter(Boolean) as string[];
}

export function validateObservatoryRuntimeSource(source: ObservatoryRuntimeSourceConfig): string[] {
  const issues: string[] = [];

  if (!source.id.trim()) {
    issues.push('source.id is required');
  }

  if (!source.label.trim()) {
    issues.push('source.label is required');
  }

  if (source.allowedOrigins.length === 0) {
    issues.push('source.allowedOrigins must include at least one origin');
  }

  return issues;
}

export function createObservatorySourceRegistry(
  initialSources: ObservatoryRuntimeSourceConfig[] = OBSERVATORY_DEFAULT_RUNTIME_SOURCES
): ObservatorySourceRegistry {
  const sources = new Map<string, ObservatoryRuntimeSourceConfig>();

  initialSources.forEach((source) => {
    if (validateObservatoryRuntimeSource(source).length === 0) {
      sources.set(source.id, { ...source, allowedOrigins: [...source.allowedOrigins] });
    }
  });

  return {
    getSource(sourceId) {
      const source = sources.get(sourceId);
      return source ? { ...source, allowedOrigins: [...source.allowedOrigins] } : undefined;
    },
    listSources(currentOrigin) {
      return [...sources.values()].map((source) => {
        const allowedOrigins = resolveAllowedOrigins(source.allowedOrigins, currentOrigin);
        const acceptsCurrentOrigin = currentOrigin
          ? allowedOrigins.includes(currentOrigin)
          : source.allowedOrigins.includes('self');
        return {
          id: source.id,
          label: source.label,
          type: source.type,
          enabled: source.enabled,
          acceptsCurrentOrigin,
          description: source.description,
        };
      });
    },
    upsertSource(source) {
      const issues = validateObservatoryRuntimeSource(source);
      if (issues.length > 0) {
        throw new Error(`Invalid Observatory runtime source: ${issues.join(', ')}`);
      }
      sources.set(source.id, { ...source, allowedOrigins: [...source.allowedOrigins] });
    },
    validateSourceOrigin(sourceId, origin) {
      const source = sources.get(sourceId);
      if (!source?.enabled) {
        return false;
      }

      return resolveAllowedOrigins(source.allowedOrigins, origin).includes(origin);
    },
  };
}
