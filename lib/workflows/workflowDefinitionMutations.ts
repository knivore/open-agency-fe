import type { AgentDefinition } from '@/types/agents';
import type {
  WorkflowAgentFormData,
  WorkflowDefinition,
  WorkflowEdgeDefinition,
  WorkflowNodeDefinition,
  WorkflowTaskFormData,
  TaskDefinition,
} from '@/types/workflows';
import type {
  WorkflowBuilderAgent,
  WorkflowBuilderBase,
  WorkflowBuilderTask,
} from '@/types/workflowBuilderDrafts';

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function makeScopedId(prefix: string, value: string, index: number) {
  return `${prefix}-${slugify(value) || index + 1}-${index + 1}`;
}

function randomId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function normalizeToolIds(agent: WorkflowBuilderAgent) {
  return (agent.agentTools ?? [])
    .map((tool) => tool.id)
    .filter((toolId): toolId is string => typeof toolId === 'string' && toolId.trim().length > 0);
}

export function workflowAgentFormToDefinition(agent: WorkflowAgentFormData, index = 0): AgentDefinition {
  return {
    id: agent.id ?? makeScopedId('agent', agent.name, index),
    name: agent.name,
    description: agent.instructions,
    instructions: agent.instructions,
    system_prompt: agent.role,
    role: agent.role,
    backstory: agent.backstory,
    model_profile_id: agent.model_profile_id ?? null,
    tool_ids: [...(agent.tool_ids ?? [])],
    handoff_agent_ids: [...(agent.handoff_agent_ids ?? [])],
    metadata: {
      migrated_from: 'agency-fe-workflow-agent-form',
    },
  };
}

export function builderAgentToDefinition(agent: WorkflowBuilderAgent, index = 0): AgentDefinition {
  return workflowAgentFormToDefinition(
    {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      instructions: agent.instructions,
      backstory: agent.backstory,
      temperature: agent.temperature ?? null,
      model_profile_id: agent.llm ?? null,
      tool_ids: normalizeToolIds(agent),
      handoff_agent_ids: agent.allow_delegation ? [] : [],
      tool_configs: agent.agentTools ?? [],
    },
    index
  );
}

export function workflowTaskFormToDefinition(task: WorkflowTaskFormData, index = 0): TaskDefinition {
  return {
    id: task.id ?? makeScopedId('task', task.name, index),
    name: task.name,
    description: task.description,
    instructions: task.description,
    expected_output: task.expected_output,
    agent_id: task.agent_id ?? null,
    tool_ids: [],
    depends_on_task_ids: (task.depends_on_task_ids ?? []).filter(
      (dependencyId): dependencyId is string =>
        typeof dependencyId === 'string' && dependencyId.trim().length > 0
    ),
    human_approval_required: Boolean(task.human_approval_required),
  };
}

export function builderTaskToDefinition(task: WorkflowBuilderTask, index = 0): TaskDefinition {
  return workflowTaskFormToDefinition(
    {
      id: task.id,
      name: task.name,
      description: task.description,
      expected_output: task.expected_output,
      agent_id: task.agentId ?? null,
      depends_on_task_ids: task.context ?? [],
      human_approval_required: Boolean(task.human_input),
      includeTask: task.includeTask,
    },
    index
  );
}

export function rebuildWorkflowGraph(workflow: WorkflowDefinition): WorkflowDefinition {
  const taskDefinitions = workflow.task_definitions ?? [];

  const nodes: WorkflowNodeDefinition[] = taskDefinitions.map((task) => ({
    id: `node-${task.id}`,
    name: task.name,
    node_type: 'task',
    task_id: task.id,
    agent_id: task.agent_id ?? null,
    metadata: {
      generated_by: 'workflow-mutation-adapter',
    },
  }));

  const nodeIdByTaskId = new Map(nodes.map((node) => [node.task_id ?? '', node.id]));
  const edges: WorkflowEdgeDefinition[] = [];

  for (const task of taskDefinitions) {
    const targetNodeId = nodeIdByTaskId.get(task.id);
    if (!targetNodeId) continue;

    for (const dependencyId of task.depends_on_task_ids ?? []) {
      const sourceNodeId = nodeIdByTaskId.get(dependencyId);
      if (!sourceNodeId) continue;
      edges.push({
        id: `edge-${sourceNodeId}-${targetNodeId}`,
        source_node_id: sourceNodeId,
        target_node_id: targetNodeId,
        edge_type: 'default',
      });
    }
  }

  const entrypoint =
    taskDefinitions.find((task) => (task.depends_on_task_ids ?? []).length === 0)?.id ??
    taskDefinitions[0]?.id ??
    workflow.entrypoint ??
    'entrypoint-unset';

  return {
    ...workflow,
    nodes,
    edges,
    entrypoint: nodeIdByTaskId.get(entrypoint) ?? `node-${entrypoint}`,
  };
}

export function workflowBuilderBaseToWorkflowDefinition(builderDraft: WorkflowBuilderBase, userId?: string | null): WorkflowDefinition {
  const agentDefinitions = (builderDraft.agents ?? []).map((agent, index) => builderAgentToDefinition(agent, index));
  const agentIdMap = new Map(agentDefinitions.map((agent) => [agent.name, agent.id]));
  const taskDefinitions = (builderDraft.tasks ?? []).map((task, index) => {
    const definition = builderTaskToDefinition(task, index);
    const fallbackAgentId =
      task.agentId ??
      (task.agent?.name ? agentIdMap.get(task.agent.name) : null) ??
      definition.agent_id ??
      null;

    return {
      ...definition,
      agent_id: fallbackAgentId,
    };
  });

  const workflow = rebuildWorkflowGraph({
    id: builderDraft.id ?? randomId('workflow'),
    name: builderDraft.name,
    description: builderDraft.description,
    task_definitions: taskDefinitions,
    agent_definitions: agentDefinitions,
    tool_definitions: [],
    allowed_runtime_adapter_ids: ['native'],
    default_runtime_adapter_id: 'native',
    versioning: {
      version: '1.0.0',
      revision: 1,
      is_published: false,
      labels: ['draft'],
    },
    metadata: {
      owner_ids: userId ? [userId] : builderDraft.owned_by ?? [],
      created_by: userId ?? builderDraft.created_by ?? null,
      inputs: builderDraft.inputs ?? [],
      process: builderDraft.process ?? 'sequential',
    },
  });

  return workflow;
}

export function cloneWorkflowDefinition(workflow: WorkflowDefinition, userId?: string | null): WorkflowDefinition {
  const agentIdMap = new Map<string, string>();
  const taskIdMap = new Map<string, string>();

  const clonedAgents = (workflow.agent_definitions ?? []).map((agent, index) => {
    const newId = randomId(`agent-${index + 1}`);
    agentIdMap.set(agent.id, newId);
    return {
      ...agent,
      id: newId,
    };
  });

  const clonedTasks = (workflow.task_definitions ?? []).map((task, index) => {
    const newId = randomId(`task-${index + 1}`);
    taskIdMap.set(task.id, newId);
    return {
      ...task,
      id: newId,
      agent_id: task.agent_id ? agentIdMap.get(task.agent_id) ?? null : null,
    };
  });

  const remappedTasks = clonedTasks.map((task, index) => ({
    ...task,
    depends_on_task_ids: ((workflow.task_definitions ?? [])[index]?.depends_on_task_ids ?? []).map(
      (dependencyId) => taskIdMap.get(dependencyId) ?? dependencyId
    ),
  }));

  return rebuildWorkflowGraph({
    ...workflow,
    id: randomId('workflow'),
    name: `[CLONE] ${workflow.name}`,
    agent_definitions: clonedAgents,
    task_definitions: remappedTasks,
    versioning: {
      version: '1.0.0',
      revision: 1,
      is_published: false,
      labels: ['draft', 'clone'],
    },
    metadata: {
      ...(workflow.metadata ?? {}),
      owner_ids: userId ? [userId] : workflow.metadata?.owner_ids,
      cloned_from_workflow_id: workflow.id,
    },
  });
}
