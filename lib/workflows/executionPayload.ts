import type { JsonObject } from '@/types/api';
import type { AgentDefinition } from '@/types/agents';
import type {
  ExecutionHost,
  WorkflowAgentLlmOverride,
  WorkflowAgentRuntimeConfig,
  WorkflowDefinition,
} from '@/types/workflows';

const EXECUTION_HOSTS = new Set(['local', 'docker']);

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function sortTaskDefinitions(workflow: WorkflowDefinition, taskOrder?: string[] | null) {
  return [...(workflow.task_definitions ?? [])].sort((left, right) => {
    if (!taskOrder || taskOrder.length === 0) return 0;
    const leftIndex = taskOrder.indexOf(left.id);
    const rightIndex = taskOrder.indexOf(right.id);
    const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
    const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
    return normalizedLeft - normalizedRight;
  });
}

function normalizeLlmOverride(value: WorkflowAgentLlmOverride | null | undefined) {
  if (!value || !value.model.trim()) {
    return null;
  }

  return {
    provider: value.provider,
    model: value.model.trim(),
    base_url: value.base_url?.trim() || null,
    api_key: value.api_key?.trim() || null,
  };
}

function firstNonBlank(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

export function normalizeWorkflowAgentDefinition(agent: AgentDefinition): AgentDefinition {
  const name = firstNonBlank(agent.name, agent.id) ?? 'Workflow agent';
  const instructions =
    firstNonBlank(
      agent.instructions,
      agent.description,
      agent.objective,
      agent.system_prompt,
      agent.role
    ) ?? `Complete assigned workflow tasks as ${name}.`;
  const systemPromptRole =
    firstNonBlank(agent.system_prompt) === instructions ? null : firstNonBlank(agent.system_prompt);
  const role = firstNonBlank(agent.role, systemPromptRole, name) ?? name;
  const description = firstNonBlank(agent.description, agent.instructions, agent.objective);
  const systemPrompt = firstNonBlank(agent.system_prompt, role);

  return {
    ...agent,
    name,
    description,
    instructions,
    system_prompt: systemPrompt,
    role,
  };
}

export function normalizeExecutionHost(value: unknown): ExecutionHost | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return EXECUTION_HOSTS.has(normalized) ? (normalized as ExecutionHost) : null;
}

export function resolveWorkflowExecutionHost(
  workflow: WorkflowDefinition | null | undefined
): ExecutionHost {
  const runtimeExecution =
    workflow?.metadata?.runtime_execution &&
    typeof workflow.metadata.runtime_execution === 'object' &&
    !Array.isArray(workflow.metadata.runtime_execution)
      ? workflow.metadata.runtime_execution
      : null;
  return (
    normalizeExecutionHost(runtimeExecution?.execution_host) ??
    normalizeExecutionHost(runtimeExecution?.executionHost) ??
    normalizeExecutionHost(workflow?.metadata?.execution_host) ??
    normalizeExecutionHost(workflow?.metadata?.executionHost) ??
    'local'
  );
}

function applyAgentRuntimeConfig(
  agent: AgentDefinition,
  agentConfigs?: Record<string, WorkflowAgentRuntimeConfig> | null
): AgentDefinition {
  if (!agentConfigs || !agent.id) {
    return agent;
  }

  const runtimeConfig = agentConfigs[agent.id];
  if (!runtimeConfig) {
    return agent;
  }

  const llmOverride = normalizeLlmOverride(runtimeConfig.llm_override);
  const runtimeConfigMetadata = JSON.parse(
    JSON.stringify({
      tool_configs: runtimeConfig.tool_configs,
      model_profile_id: runtimeConfig.model_profile_id ?? null,
      llm_override: llmOverride,
    })
  ) as JsonObject;

  return {
    ...agent,
    model_profile_id: runtimeConfig.model_profile_id ?? agent.model_profile_id ?? null,
    metadata: {
      ...(agent.metadata ?? {}),
      runtime_config: runtimeConfigMetadata,
    },
  };
}

export function extractWorkflowInputs(workflow: WorkflowDefinition): string[] {
  const metadataInputs = asStringArray(workflow.metadata?.inputs);
  if (metadataInputs.length > 0) {
    return metadataInputs;
  }

  const schemaInputs = (workflow.task_definitions ?? []).flatMap((task) => {
    const inputSchema = task.input_schema;
    if (!inputSchema || typeof inputSchema !== 'object' || Array.isArray(inputSchema)) {
      return [];
    }

    const properties = 'properties' in inputSchema ? inputSchema.properties : undefined;
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
      return [];
    }

    return Object.keys(properties);
  });

  return Array.from(new Set(schemaInputs));
}

export function buildExecutionWorkflowDefinition(
  workflow: WorkflowDefinition,
  options?: {
    taskOrder?: string[] | null;
    agentConfigs?: Record<string, WorkflowAgentRuntimeConfig> | null;
    runtimeAdapterId?: string | null;
    executionHost?: ExecutionHost | null;
  }
): WorkflowDefinition {
  const executionWorkflow = { ...workflow };
  delete executionWorkflow.monitoring;
  delete executionWorkflow.runtime_governance;
  const taskDefinitions = sortTaskDefinitions(workflow, options?.taskOrder);
  const agentDefinitions = (workflow.agent_definitions ?? []).map((agent) =>
    normalizeWorkflowAgentDefinition(applyAgentRuntimeConfig(agent, options?.agentConfigs))
  );
  const runtimeExecutionMetadata = JSON.parse(
    JSON.stringify({
      task_order: options?.taskOrder ?? [],
      agent_configs: options?.agentConfigs ?? {},
      execution_host: options?.executionHost ?? resolveWorkflowExecutionHost(workflow),
    })
  ) as JsonObject;

  return {
    ...executionWorkflow,
    task_definitions: taskDefinitions,
    agent_definitions: agentDefinitions,
    default_runtime_adapter_id:
      options?.runtimeAdapterId ?? workflow.default_runtime_adapter_id ?? null,
    metadata: {
      ...(workflow.metadata ?? {}),
      execution_host: options?.executionHost ?? resolveWorkflowExecutionHost(workflow),
      runtime_execution: runtimeExecutionMetadata,
    },
  };
}

export function serializeExecutionResult(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (value == null) {
    return undefined;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
