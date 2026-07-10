import type { Agent, AgentConfig, AgentDefinition, BehaviorTuningProfile } from '@/types/agents';
import type {
  AgentRun,
  ExecutionRecord,
  RunContainerInfo,
  RunReplacementDetails,
  RunRuntimeDetails,
  RunSessionDetail,
  RunSessionSummary,
} from '@/types/runtime';
import type { Task, TaskDefinition } from '@/types/workflows';

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function toAgentConfig(definition: AgentDefinition): AgentConfig {
  const maybeCamelDefinition = definition as AgentDefinition & {
    toolIds?: unknown;
    handoffAgentIds?: unknown;
  };

  return {
    instructions:
      definition.instructions ?? definition.objective ?? definition.system_prompt ?? null,
    systemPrompt: definition.system_prompt ?? definition.instructions ?? null,
    modelProfileId: definition.model_profile_id ?? null,
    toolIds:
      stringArray(definition.tool_ids).length > 0
        ? stringArray(definition.tool_ids)
        : stringArray(maybeCamelDefinition.toolIds),
    handoffAgentIds:
      stringArray(definition.handoff_agent_ids).length > 0
        ? stringArray(definition.handoff_agent_ids)
        : stringArray(maybeCamelDefinition.handoffAgentIds),
    metadata: definition.metadata,
  };
}

export function toAgent(definition: AgentDefinition): Agent {
  return {
    id: definition.id,
    name: definition.name,
    description: definition.description ?? null,
    role: definition.role ?? null,
    backstory: definition.backstory ?? null,
    config: toAgentConfig(definition),
  };
}

export function toBehaviorTuningProfile(profile: {
  id: string;
  name: string;
  provider: string;
  model: string;
  description?: string | null;
  temperature?: number | null;
  max_tokens?: number | null;
  top_p?: number | null;
  supports_tools?: boolean;
  supports_structured_output?: boolean;
  supports_vision?: boolean;
  supports_streaming?: boolean;
  fallback_strategy?: BehaviorTuningProfile['fallbackStrategy'];
  fallback_models?: BehaviorTuningProfile['fallbackModels'];
  fallback_policy?: BehaviorTuningProfile['fallbackPolicy'];
  parameters?: BehaviorTuningProfile['parameters'];
}): BehaviorTuningProfile {
  return {
    id: profile.id,
    name: profile.name,
    provider: profile.provider,
    model: profile.model,
    description: profile.description ?? null,
    temperature: profile.temperature ?? null,
    maxTokens: profile.max_tokens ?? null,
    topP: profile.top_p ?? null,
    supportsTools: profile.supports_tools,
    supportsStructuredOutput: profile.supports_structured_output,
    supportsVision: profile.supports_vision,
    supportsStreaming: profile.supports_streaming,
    fallbackStrategy: profile.fallback_strategy ?? 'auto',
    fallbackModels: profile.fallback_models ?? [],
    fallbackPolicy: profile.fallback_policy,
    parameters: profile.parameters,
  };
}

export function toRunContainerInfo(record: {
  container_id?: string | null;
  container_name?: string | null;
  container_image?: string | null;
  container_status?: string | null;
  container_started_at?: string | null;
  container_ended_at?: string | null;
  container_exit_code?: number | null;
}): RunContainerInfo {
  return {
    containerId: record.container_id ?? null,
    containerName: record.container_name ?? null,
    image: record.container_image ?? null,
    status: record.container_status ?? null,
    startedAt: record.container_started_at ?? null,
    endedAt: record.container_ended_at ?? null,
    exitCode: record.container_exit_code ?? null,
  };
}

export function toRunSessionSummary(record: ExecutionRecord): RunSessionSummary {
  return {
    id: record.id,
    workflowId: record.workflow_id ?? null,
    runtimeAdapterId: record.runtime_adapter_id ?? null,
    runtimeRevisionId: record.runtime_revision_id ?? null,
    runtimeFingerprint: record.runtime_fingerprint ?? null,
    status: record.status ?? 'unknown',
    triggerType: record.trigger_type ?? null,
    createdAt: record.created_at ?? null,
    startedAt: record.started_at ?? null,
    completedAt: record.completed_at ?? null,
    updatedAt: record.updated_at ?? null,
    createdBy: record.created_by ?? null,
    workerId: record.worker_id ?? null,
    lastHeartbeatAt: record.last_heartbeat_at ?? null,
    currentNodeId: record.current_node_id ?? null,
    container: toRunContainerInfo(record),
    replacementOfExecutionId: record.replacement_of_execution_id ?? null,
    restartReason: record.restart_reason ?? null,
    inputPayload: record.input_payload ?? null,
    outputPayload: record.output_payload ?? null,
    metadata: record.metadata,
    error: record.error ?? null,
  };
}

export function toAgentRun(record: ExecutionRecord): AgentRun {
  return toRunSessionSummary(record);
}

function toRuntimeDetails(runtime?: RunRuntimeDetails | null): RunSessionDetail['runtime'] {
  if (!runtime) {
    return undefined;
  }

  return {
    revision: runtime.runtime_revision ?? null,
    container: runtime.container
      ? {
          containerId: runtime.container.container_id ?? null,
          containerName: runtime.container.container_name ?? null,
          image: runtime.container.image ?? null,
          status: runtime.container.status ?? null,
          startedAt: runtime.container.started_at ?? null,
          endedAt: runtime.container.ended_at ?? null,
          exitCode: runtime.container.exit_code ?? null,
        }
      : undefined,
    diagnostics: runtime.diagnostics,
  };
}

function toReplacementSummary(record?: ExecutionRecord | null): RunSessionSummary | null {
  return record ? toRunSessionSummary(record) : null;
}

function toReplacementDetails(
  replacement?: RunReplacementDetails | null
): RunSessionDetail['replacement'] {
  if (!replacement) {
    return undefined;
  }

  return {
    restartReason: replacement.restart_reason ?? null,
    replacesExecution: toReplacementSummary(replacement.replaces_execution),
    replacedByExecutions: (replacement.replaced_by_executions ?? []).map(toRunSessionSummary),
  };
}

export function toRunSessionDetail(detail: {
  execution: ExecutionRecord;
  state: RunSessionDetail['state'];
  runtime?: RunRuntimeDetails;
  replacement?: RunReplacementDetails;
}): RunSessionDetail {
  return {
    summary: toRunSessionSummary(detail.execution),
    state: detail.state,
    runtime: toRuntimeDetails(detail.runtime),
    replacement: toReplacementDetails(detail.replacement),
    events: [],
    artifacts: [],
  };
}

export function toTask(task: TaskDefinition): Task {
  return {
    id: task.id,
    name: task.name,
    description: task.description,
    instructions: task.instructions ?? null,
    expectedOutput: task.expected_output ?? null,
    agentId: task.agent_id ?? null,
    toolIds: task.tool_ids ?? [],
    dependsOnTaskIds: task.depends_on_task_ids ?? [],
    humanApprovalRequired: task.human_approval_required ?? false,
  };
}
