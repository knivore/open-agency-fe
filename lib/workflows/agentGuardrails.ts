import type { JsonObject } from '@/types/api';
import type { AgentGuardrailDefinition } from '@/types/agents';

export const workflowAgentGuardrailModes = ['input', 'output', 'tool', 'policy', 'other'] as const;

export type WorkflowAgentGuardrailMode = (typeof workflowAgentGuardrailModes)[number];

const workflowAgentGuardrailModeSet = new Set<string>(workflowAgentGuardrailModes);

function safeRecord(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function normalizeGuardrailMode(value: unknown): WorkflowAgentGuardrailMode {
  return typeof value === 'string' && workflowAgentGuardrailModeSet.has(value)
    ? (value as WorkflowAgentGuardrailMode)
    : 'policy';
}

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function normalizeWorkflowAgentGuardrails(value: unknown): AgentGuardrailDefinition[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item, index) => {
    const record = safeRecord(item);
    const name = normalizeString(record.name);

    if (!name) {
      return [];
    }

    return [
      {
        id: normalizeString(record.id) ?? `guardrail-${index + 1}`,
        name,
        description: normalizeString(record.description),
        mode: normalizeGuardrailMode(record.mode),
        config: safeRecord(record.config),
      },
    ];
  });
}

export function createWorkflowAgentGuardrailDraft(index: number): AgentGuardrailDefinition {
  const randomId =
    globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 12) ??
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  return {
    id: `guardrail-${randomId}`,
    name: `Guardrail ${index + 1}`,
    description: '',
    mode: 'policy',
    config: {},
  };
}
