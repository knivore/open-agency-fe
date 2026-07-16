import type { JsonObject } from '@/types/api';

export const workflowTaskInputSourceOptions = [
  {
    id: 'previous_task_output',
    label: 'Previous task output',
    description: 'Consumes outputs from upstream dependency tasks.',
  },
  {
    id: 'memory',
    label: 'Memory',
    description: 'Uses linked workflow or catalog memory context.',
  },
  {
    id: 'uploaded_documents',
    label: 'Uploaded documents',
    description: 'Uses documents uploaded into workflow or memory context.',
  },
  {
    id: 'human_input',
    label: 'Human input',
    description: 'Requires operator-provided input before or during execution.',
  },
] as const;

export type WorkflowTaskInputSource = (typeof workflowTaskInputSourceOptions)[number]['id'];

const workflowTaskInputSourceIds = new Set<string>(
  workflowTaskInputSourceOptions.map((option) => option.id)
);

function safeMetadata(metadata: unknown): JsonObject {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? (metadata as JsonObject)
    : {};
}

export function workflowTaskInputSourcesFromMetadata(metadata: unknown): WorkflowTaskInputSource[] {
  const value = safeMetadata(metadata).task_input_sources;
  if (!Array.isArray(value)) {
    return [];
  }

  return normalizeWorkflowTaskInputSources(value);
}

export function normalizeWorkflowTaskInputSources(values: unknown[]): WorkflowTaskInputSource[] {
  return values.filter(
    (source): source is WorkflowTaskInputSource =>
      typeof source === 'string' && workflowTaskInputSourceIds.has(source)
  );
}

export function workflowTaskMetadataWithInputSources(
  metadata: unknown,
  inputSources: WorkflowTaskInputSource[]
): JsonObject | undefined {
  const nextMetadata: JsonObject = { ...safeMetadata(metadata) };
  const uniqueSources = Array.from(
    new Set(inputSources.filter((source) => workflowTaskInputSourceIds.has(source)))
  );

  if (uniqueSources.length > 0) {
    nextMetadata.task_input_sources = uniqueSources;
  } else {
    delete nextMetadata.task_input_sources;
  }

  return Object.keys(nextMetadata).length > 0 ? nextMetadata : undefined;
}
