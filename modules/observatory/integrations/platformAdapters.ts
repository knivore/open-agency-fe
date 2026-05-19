import type { ObservatoryRuntimeSourceConfig } from '@/modules/observatory/integrations/sourceRegistry';
import type {
  ObservatoryExternalRuntimeEvent,
  ObservatoryRuntimeSourceType,
} from '@/modules/observatory/runtime/events';

export type ObservatoryPlatformAdapterId = 'claude-code' | 'codex' | 'hermes';

export interface ObservatoryPlatformEventMapping {
  externalType: string;
  normalizedType: string;
  notes: string;
}

export interface ObservatoryPlatformAdapterDefinition {
  description: string;
  eventMappings: ObservatoryPlatformEventMapping[];
  id: ObservatoryPlatformAdapterId;
  label: string;
  recommendedTransports: Array<'postMessage' | 'sse' | 'websocket'>;
  sourceId: string;
  sourceType: Extract<ObservatoryRuntimeSourceType, 'claude_code' | 'codex' | 'hermes'>;
}

export const OBSERVATORY_HERMES_SOURCE_ID = 'platform-hermes';
export const OBSERVATORY_CLAUDE_CODE_SOURCE_ID = 'platform-claude-code';
export const OBSERVATORY_CODEX_SOURCE_ID = 'platform-codex';

export const OBSERVATORY_PLATFORM_ADAPTERS: ObservatoryPlatformAdapterDefinition[] = [
  {
    description: 'Placeholder adapter profile for Hermes runtime orchestration events.',
    eventMappings: [
      {
        externalType: 'task_started',
        normalizedType: 'TASK_STARTED',
        notes: 'Map Hermes run or task start events to the active agent, workflow, and room.',
      },
      {
        externalType: 'approval_required',
        normalizedType: 'APPROVAL_REQUIRED',
        notes: 'Use when Hermes blocks on a human approval gate.',
      },
      {
        externalType: 'log_received',
        normalizedType: 'LOG_RECEIVED',
        notes: 'Use for concise runtime logs after truncation at the producer boundary.',
      },
    ],
    id: 'hermes',
    label: 'Hermes',
    recommendedTransports: ['websocket', 'sse'],
    sourceId: OBSERVATORY_HERMES_SOURCE_ID,
    sourceType: 'hermes',
  },
  {
    description: 'Placeholder adapter profile for Claude Code local development events.',
    eventMappings: [
      {
        externalType: 'agent_status_changed',
        normalizedType: 'AGENT_STATUS_CHANGED',
        notes: 'Map plan/edit/test phases into agent status plus optional visualAction metadata.',
      },
      {
        externalType: 'file_changed',
        normalizedType: 'FILE_CHANGED',
        notes:
          'Use for edited files; include path details in metadata, not executable instructions.',
      },
      {
        externalType: 'tool_started',
        normalizedType: 'TOOL_STARTED',
        notes: 'Use for shell, browser, or editor tool activity.',
      },
    ],
    id: 'claude-code',
    label: 'Claude Code',
    recommendedTransports: ['postMessage', 'websocket'],
    sourceId: OBSERVATORY_CLAUDE_CODE_SOURCE_ID,
    sourceType: 'claude_code',
  },
  {
    description: 'Placeholder adapter profile for Codex coding-agent events.',
    eventMappings: [
      {
        externalType: 'task_progress',
        normalizedType: 'TASK_PROGRESS',
        notes: 'Map implementation progress into bounded task progress events.',
      },
      {
        externalType: 'tool_completed',
        normalizedType: 'TOOL_COMPLETED',
        notes: 'Use for completed terminal, browser, or code-edit tool calls.',
      },
      {
        externalType: 'task_completed',
        normalizedType: 'TASK_COMPLETED',
        notes: 'Use when Codex completes a requested unit of work.',
      },
    ],
    id: 'codex',
    label: 'Codex',
    recommendedTransports: ['postMessage', 'sse', 'websocket'],
    sourceId: OBSERVATORY_CODEX_SOURCE_ID,
    sourceType: 'codex',
  },
];

export function createObservatoryPlatformRuntimeSources(
  allowedOrigins: string[] = ['self']
): ObservatoryRuntimeSourceConfig[] {
  return OBSERVATORY_PLATFORM_ADAPTERS.map((adapter) => ({
    allowedOrigins,
    description: adapter.description,
    enabled: false,
    id: adapter.sourceId,
    label: adapter.label,
    type: adapter.sourceType,
  }));
}

export function getObservatoryPlatformAdapter(
  adapterId: ObservatoryPlatformAdapterId
): ObservatoryPlatformAdapterDefinition | undefined {
  return OBSERVATORY_PLATFORM_ADAPTERS.find((adapter) => adapter.id === adapterId);
}

export function createObservatoryPlatformSampleEvent(
  adapterId: ObservatoryPlatformAdapterId,
  overrides: Partial<ObservatoryExternalRuntimeEvent> = {}
): ObservatoryExternalRuntimeEvent {
  const adapter = getObservatoryPlatformAdapter(adapterId);

  if (!adapter) {
    throw new Error(`Unknown Observatory platform adapter "${adapterId}".`);
  }

  return {
    actor: {
      id: `agent:${adapter.id}`,
      name: adapter.label,
      role: 'platform-adapter',
    },
    id: `evt:${adapter.id}:sample`,
    message: `${adapter.label} adapter sample event`,
    source: adapter.sourceId,
    sourceType: adapter.sourceType,
    task: {
      id: `task:${adapter.id}:sample`,
      progress: 0.5,
      title: `${adapter.label} sample task`,
    },
    timestamp: '2026-05-09T00:00:00.000Z',
    type: 'task_progress',
    workflow: {
      id: `workflow:${adapter.id}:sample`,
      roomId: 'room:runtime-floor',
    },
    ...overrides,
  };
}
