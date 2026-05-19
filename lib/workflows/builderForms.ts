import type { AgentDefinition } from '@/types/agents';
import type { ToolDefinition } from '@/types/tools';
import { toolDisplayName } from '@/lib/tools/displayName';
import { toolDefinitionToWorkflowToolOption, workflowToolOptionToAgentToolConfig } from '@/lib/workflows/toolOptions';
import type {
  TaskDefinition,
  WorkflowAgentFormData,
  WorkflowAgentToolConfig,
  WorkflowTaskFormData,
} from '@/types/workflows';

function normalizeInstructions(agent: AgentDefinition) {
  return agent.instructions ?? agent.objective ?? agent.description ?? '';
}

export function toolDefinitionToAgentToolConfig(tool: ToolDefinition): WorkflowAgentToolConfig {
  return workflowToolOptionToAgentToolConfig(toolDefinitionToWorkflowToolOption(tool));
}

export function agentDefinitionToFormData(
  agent: AgentDefinition,
  toolDefinitions: ToolDefinition[] = []
): WorkflowAgentFormData {
  const toolsById = new Map(toolDefinitions.map((tool) => [tool.id, tool]));

  return {
    id: agent.id,
    name: agent.name,
    role: agent.role ?? agent.name,
    instructions: normalizeInstructions(agent),
    backstory: agent.backstory ?? '',
    temperature: null,
    model_profile_id: agent.model_profile_id ?? null,
    llm_override: null,
    tool_ids: [...(agent.tool_ids ?? [])],
    handoff_agent_ids: [...(agent.handoff_agent_ids ?? [])],
    tool_configs: (agent.tool_ids ?? []).map((toolId) =>
      toolDefinitionToAgentToolConfig(
        toolsById.get(toolId) ?? {
          id: toolId,
          name: toolId,
          display_name: toolDisplayName({ name: toolId, display_name: null } as ToolDefinition),
          description: '',
        }
      )
    ),
  };
}

export function taskDefinitionToFormData(task: TaskDefinition): WorkflowTaskFormData {
  return {
    id: task.id,
    name: task.name,
    description: task.description,
    expected_output: task.expected_output ?? '',
    agent_id: task.agent_id ?? null,
    depends_on_task_ids: [...(task.depends_on_task_ids ?? [])],
    human_approval_required: task.human_approval_required ?? false,
    includeTask: true,
  };
}

export function agentFormToRewritePayload(agent: WorkflowAgentFormData) {
  return {
    name: agent.name,
    role: agent.role,
    instructions: agent.instructions,
    backstory: agent.backstory,
  };
}

export function rewriteAgentResponseToFormData(
  data: Partial<Record<'name' | 'role' | 'backstory' | 'instructions', string>>
): Partial<WorkflowAgentFormData> {
  return {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.role !== undefined ? { role: data.role } : {}),
    ...(data.instructions !== undefined ? { instructions: data.instructions } : {}),
    ...(data.backstory !== undefined ? { backstory: data.backstory } : {}),
  };
}

export function taskFormToRewritePayload(task: WorkflowTaskFormData) {
  return {
    name: task.name,
    description: task.description,
    expected_output: task.expected_output,
  };
}

export function rewriteTaskResponseToFormData(
  data: Partial<Record<'name' | 'description' | 'expected_output', string>>
): Partial<WorkflowTaskFormData> {
  return {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.expected_output !== undefined ? { expected_output: data.expected_output } : {}),
  };
}
