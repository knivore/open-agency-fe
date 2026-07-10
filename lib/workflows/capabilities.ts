import type { JsonObject, JsonValue } from '@/types/api';
import type { WorkflowCapabilityTag } from '@/types/workflows';

export const WORKFLOW_CAPABILITY_METADATA_KEY = 'workflow_capability_tags';

export const WORKFLOW_CAPABILITY_OPTIONS: Array<{
  tag: WorkflowCapabilityTag;
  label: string;
  description: string;
}> = [
  {
    tag: 'home-control',
    label: 'Smart Home control',
    description: 'Use Smart Home for rooms, entities, scenes, and safe actions.',
  },
  {
    tag: 'vision',
    label: 'Vision',
    description: 'Use Agency image analysis and scene understanding as a reusable capability.',
  },
  {
    tag: 'voice',
    label: 'Speech',
    description:
      'Use Agency speech, turn-taking, announcements, and conversational continuation surfaces.',
  },
];

function isWorkflowCapabilityTag(value: JsonValue): value is WorkflowCapabilityTag {
  return value === 'home-control' || value === 'vision' || value === 'voice';
}

export function readWorkflowCapabilityTags(
  metadata: JsonObject | null | undefined
): WorkflowCapabilityTag[] {
  const rawValue = metadata?.[WORKFLOW_CAPABILITY_METADATA_KEY];
  if (!Array.isArray(rawValue)) {
    return [];
  }

  return Array.from(new Set(rawValue.filter(isWorkflowCapabilityTag)));
}

export function writeWorkflowCapabilityTags(
  metadata: JsonObject | null | undefined,
  tags: WorkflowCapabilityTag[]
): JsonObject {
  const nextMetadata = { ...(metadata ?? {}) };
  const normalizedTags = Array.from(new Set(tags.filter(isWorkflowCapabilityTag)));

  if (normalizedTags.length === 0) {
    delete nextMetadata[WORKFLOW_CAPABILITY_METADATA_KEY];
    return nextMetadata;
  }

  nextMetadata[WORKFLOW_CAPABILITY_METADATA_KEY] = normalizedTags;
  return nextMetadata;
}
