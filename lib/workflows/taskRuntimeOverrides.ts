import type { JsonObject } from '@/types/api';
import type { TaskDefinition } from '@/types/workflows';

export const workflowTaskApprovalPolicyOptions = [
  {
    id: 'inherit',
    label: 'Inherit task setting',
  },
  {
    id: 'none',
    label: 'No approval',
  },
  {
    id: 'required',
    label: 'Require approval',
  },
  {
    id: 'on_failure',
    label: 'Approve on failure',
  },
] as const;

export type WorkflowTaskApprovalPolicy = (typeof workflowTaskApprovalPolicyOptions)[number]['id'];

export interface WorkflowTaskRuntimeOverrides extends JsonObject {
  timeout_seconds?: number;
  max_retries?: number;
  model_profile_id?: string;
  max_tokens?: number;
  approval_policy?: WorkflowTaskApprovalPolicy;
}

type WorkflowTaskRuntimeOverrideSource = Partial<
  Pick<
    TaskDefinition,
    | 'metadata'
    | 'timeout_seconds'
    | 'max_retries'
    | 'model_profile_id'
    | 'max_tokens'
    | 'approval_policy'
  >
>;

const workflowTaskRuntimeOverridesMetadataKey = 'task_runtime_overrides';
const workflowTaskApprovalPolicyIds = new Set<string>(
  workflowTaskApprovalPolicyOptions.map((option) => option.id)
);

function safeMetadata(metadata: unknown): JsonObject {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? (metadata as JsonObject)
    : {};
}

function safeObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function normalizePositiveInteger(value: unknown): number | undefined {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.trunc(parsed);
}

function normalizeNonNegativeInteger(value: unknown): number | undefined {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }

  return Math.trunc(parsed);
}

function normalizeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeApprovalPolicy(value: unknown): WorkflowTaskApprovalPolicy | undefined {
  return typeof value === 'string' && workflowTaskApprovalPolicyIds.has(value)
    ? (value as WorkflowTaskApprovalPolicy)
    : undefined;
}

export function normalizeWorkflowTaskRuntimeOverrides(
  overrides: unknown
): WorkflowTaskRuntimeOverrides {
  const rawOverrides = safeObject(overrides);
  const normalized: WorkflowTaskRuntimeOverrides = {};
  const timeoutSeconds = normalizePositiveInteger(rawOverrides.timeout_seconds);
  const maxRetries = normalizeNonNegativeInteger(rawOverrides.max_retries);
  const maxTokens = normalizePositiveInteger(rawOverrides.max_tokens);
  const modelProfileId = normalizeString(rawOverrides.model_profile_id);
  const approvalPolicy = normalizeApprovalPolicy(rawOverrides.approval_policy);

  if (timeoutSeconds !== undefined) {
    normalized.timeout_seconds = timeoutSeconds;
  }
  if (maxRetries !== undefined) {
    normalized.max_retries = maxRetries;
  }
  if (modelProfileId) {
    normalized.model_profile_id = modelProfileId;
  }
  if (maxTokens !== undefined) {
    normalized.max_tokens = maxTokens;
  }
  if (approvalPolicy && approvalPolicy !== 'inherit') {
    normalized.approval_policy = approvalPolicy;
  }

  return normalized;
}

export function workflowTaskRuntimeOverridesFromMetadata(
  metadata: unknown
): WorkflowTaskRuntimeOverrides {
  return normalizeWorkflowTaskRuntimeOverrides(
    safeMetadata(metadata)[workflowTaskRuntimeOverridesMetadataKey]
  );
}

export function workflowTaskRuntimeOverridesFromTask(
  task: WorkflowTaskRuntimeOverrideSource
): WorkflowTaskRuntimeOverrides {
  return {
    ...workflowTaskRuntimeOverridesFromMetadata(task.metadata),
    ...normalizeWorkflowTaskRuntimeOverrides({
      timeout_seconds: task.timeout_seconds,
      max_retries: task.max_retries,
      model_profile_id: task.model_profile_id,
      max_tokens: task.max_tokens,
      approval_policy: task.approval_policy,
    }),
  };
}

export function workflowTaskMetadataWithRuntimeOverrides(
  metadata: unknown,
  overrides: unknown
): JsonObject | undefined {
  const nextMetadata: JsonObject = { ...safeMetadata(metadata) };
  const normalizedOverrides = normalizeWorkflowTaskRuntimeOverrides(overrides);

  if (Object.keys(normalizedOverrides).length > 0) {
    nextMetadata[workflowTaskRuntimeOverridesMetadataKey] = normalizedOverrides;
  } else {
    delete nextMetadata[workflowTaskRuntimeOverridesMetadataKey];
  }

  return Object.keys(nextMetadata).length > 0 ? nextMetadata : undefined;
}

export function workflowTaskRuntimeOverridePatch(
  metadata: unknown,
  overrides: unknown
): Pick<
  TaskDefinition,
  | 'metadata'
  | 'timeout_seconds'
  | 'max_retries'
  | 'model_profile_id'
  | 'max_tokens'
  | 'approval_policy'
> {
  const normalizedOverrides = normalizeWorkflowTaskRuntimeOverrides(overrides);

  return {
    timeout_seconds: normalizedOverrides.timeout_seconds ?? null,
    max_retries: normalizedOverrides.max_retries ?? null,
    model_profile_id: normalizedOverrides.model_profile_id ?? null,
    max_tokens: normalizedOverrides.max_tokens ?? null,
    approval_policy:
      normalizedOverrides.approval_policy && normalizedOverrides.approval_policy !== 'inherit'
        ? normalizedOverrides.approval_policy
        : null,
    metadata: workflowTaskMetadataWithRuntimeOverrides(metadata, {}),
  };
}
