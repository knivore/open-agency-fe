import type { AgentDefinition } from '@/types/agents';
import type { TaskDefinition, WorkflowDefinition } from '@/types/workflows';

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function uniqueStrings(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function agentToolIds(agent: AgentDefinition): string[] {
  return uniqueStrings([...stringArray(agent.tool_ids), ...stringArray(agent.toolIds)]);
}

function taskToolIds(task: TaskDefinition): string[] {
  return uniqueStrings(stringArray(task.tool_ids));
}

export function workflowAssignedToolIds(workflow: WorkflowDefinition): string[] {
  return uniqueStrings([
    ...(workflow.agent_definitions ?? []).flatMap(agentToolIds),
    ...(workflow.task_definitions ?? []).flatMap(taskToolIds),
  ]);
}

export function workflowToolBindingCount(workflow: WorkflowDefinition): number {
  const toolIdsByActor = new Map<string, Set<string>>();

  for (const agent of workflow.agent_definitions ?? []) {
    toolIdsByActor.set(`agent:${agent.id}`, new Set(agentToolIds(agent)));
  }

  for (const task of workflow.task_definitions ?? []) {
    const actorKey = task.agent_id ? `agent:${task.agent_id}` : `task:${task.id}`;
    const currentToolIds = toolIdsByActor.get(actorKey) ?? new Set<string>();

    // Task tool IDs are execution requirements. The backend may also mirror them onto the
    // assigned agent, so merge per actor/tool pair to keep list summaries from double-counting.
    for (const toolId of taskToolIds(task)) {
      currentToolIds.add(toolId);
    }
    toolIdsByActor.set(actorKey, currentToolIds);
  }

  return Array.from(toolIdsByActor.values()).reduce((total, toolIds) => total + toolIds.size, 0);
}
