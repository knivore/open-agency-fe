import type { AgentDefinition } from '@/types/agents';
import type { WorkflowDefinition, WorkflowEdgeDefinition, WorkflowNodeDefinition, TaskDefinition } from '@/types/workflows';
import type { WorkflowBuilderTask, WorkflowBuilderAgent } from '@/types/workflowBuilderDrafts';

const DEFAULT_RUNTIME_ADAPTER_ID = 'native';

function makeId(prefix: string, value: string, index: number) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  return `${prefix}-${slug || index + 1}-${index + 1}`;
}

function toAgentDefinition(agent: WorkflowBuilderAgent, index: number): AgentDefinition {
  return {
    id: makeId('agent', agent.name, index),
    name: agent.name,
    role: agent.role,
    description: agent.instructions,
    instructions: agent.instructions,
    backstory: agent.backstory,
    tool_ids: (agent.agentTools ?? []).map((tool) => tool.id),
    handoff_agent_ids: [],
  };
}

function toTaskDefinition(task: WorkflowBuilderTask, agentId: string | null, index: number, previousTaskId?: string): TaskDefinition {
  return {
    id: makeId('task', task.name, index),
    name: task.name,
    description: task.description,
    expected_output: task.expected_output,
    agent_id: agentId,
    tool_ids: [],
    depends_on_task_ids: previousTaskId ? [previousTaskId] : [],
    human_approval_required: Boolean(task.human_input),
  };
}

export function buildWorkflowDraftFromBuilder(params: {
  workflowName: string;
  workflowDescription: string;
  tasks: WorkflowBuilderTask[];
  agents: WorkflowBuilderAgent[];
  runtimeAdapterId?: string | null;
}): WorkflowDefinition {
  const { workflowName, workflowDescription, tasks, agents, runtimeAdapterId = DEFAULT_RUNTIME_ADAPTER_ID } = params;

  const agentDefinitions = agents.map(toAgentDefinition);
  const taskDefinitions = tasks.map((task, index) =>
    toTaskDefinition(
      task,
      agentDefinitions[index]?.id ?? agentDefinitions[agentDefinitions.length - 1]?.id ?? null,
      index,
      index > 0 ? makeId('task', tasks[index - 1].name, index - 1) : undefined
    )
  );

  const nodes: WorkflowNodeDefinition[] = taskDefinitions.map((task, index) => ({
    id: makeId('node', task.name, index),
    name: task.name,
    node_type: 'task',
    task_id: task.id,
    agent_id: task.agent_id ?? null,
    metadata: {
      builder_source: 'agency-fe-local-fallback',
    },
  }));

  const edges: WorkflowEdgeDefinition[] = nodes.slice(1).map((node, index) => ({
    id: `edge-${nodes[index].id}-${node.id}`,
    source_node_id: nodes[index].id,
    target_node_id: node.id,
    edge_type: 'default',
  }));

  return {
    id: makeId('workflow', workflowName, 0),
    name: workflowName,
    description: workflowDescription,
    entrypoint: nodes[0]?.id ?? 'entrypoint-missing',
    nodes,
    edges,
    agent_definitions: agentDefinitions,
    task_definitions: taskDefinitions,
    tool_definitions: [],
    allowed_runtime_adapter_ids: runtimeAdapterId ? [runtimeAdapterId] : [],
    default_runtime_adapter_id: runtimeAdapterId,
    metadata: {
      builder_source: 'agency-fe-local-fallback',
      builder_mode: 'chat',
      inputs: [],
    },
    versioning: {
      version: '1.0.0',
      revision: 1,
      is_published: false,
      labels: ['draft', 'builder'],
    },
  };
}
