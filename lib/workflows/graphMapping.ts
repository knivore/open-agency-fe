import type { JsonObject } from '@/types/api';
import type { WorkflowDefinition, WorkflowEdgeDefinition, WorkflowNodeDefinition } from '@/types/workflows';
import { toolDisplayName } from '@/lib/tools/displayName';

export interface WorkflowGraphNodeData extends JsonObject {
  label: string;
  subtitle?: string;
}

export interface WorkflowGraphNode {
  id: string;
  type: string;
  data: WorkflowGraphNodeData;
}

export interface WorkflowGraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label?: string;
}

export interface WorkflowGraph {
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
}

function findNodeLabel(node: WorkflowNodeDefinition, workflow: WorkflowDefinition) {
  const agent = workflow.agent_definitions?.find((item) => item.id === node.agent_id);
  const task = workflow.task_definitions?.find((item) => item.id === node.task_id);
  const tool = workflow.tool_definitions?.find((item) => item.id === node.tool_id);
  return node.name || agent?.name || task?.name || (tool ? toolDisplayName(tool) : null) || node.id;
}

function findNodeSubtitle(node: WorkflowNodeDefinition, workflow: WorkflowDefinition) {
  const agent = workflow.agent_definitions?.find((item) => item.id === node.agent_id);
  const task = workflow.task_definitions?.find((item) => item.id === node.task_id);
  const tool = workflow.tool_definitions?.find((item) => item.id === node.tool_id);
  return agent?.role || task?.description || tool?.description || undefined;
}

function fallbackNodes(workflow: WorkflowDefinition): WorkflowNodeDefinition[] {
  const tasks =
    workflow.task_definitions?.map((task) => ({
      id: task.id,
      name: task.name,
      node_type: 'task',
      task_id: task.id,
      agent_id: task.agent_id ?? null,
      metadata: {},
    })) ?? [];

  if (tasks.length > 0) {
    return tasks;
  }

  return (
    workflow.agent_definitions?.map((agent) => ({
      id: agent.id,
      name: agent.name,
      node_type: 'agent',
      agent_id: agent.id,
      metadata: {},
    })) ?? []
  );
}

function fallbackEdges(nodes: WorkflowNodeDefinition[]): WorkflowEdgeDefinition[] {
  return nodes.slice(0, -1).map((node, index) => ({
    id: `${node.id}->${nodes[index + 1].id}`,
    source_node_id: node.id,
    target_node_id: nodes[index + 1].id,
    edge_type: 'default',
    metadata: {},
  }));
}

export function backendWorkflowToGraph(workflow: WorkflowDefinition): WorkflowGraph {
  const sourceNodes = workflow.nodes?.length ? workflow.nodes : fallbackNodes(workflow);
  const sourceEdges = workflow.edges?.length ? workflow.edges : fallbackEdges(sourceNodes);

  return {
    nodes: sourceNodes.map((node) => ({
      id: node.id,
      type: node.node_type,
      data: {
        label: findNodeLabel(node, workflow),
        subtitle: findNodeSubtitle(node, workflow),
      },
    })),
    edges: sourceEdges.map((edge) => ({
      id: edge.id,
      source: edge.source_node_id,
      target: edge.target_node_id,
      type: edge.edge_type || 'default',
      label: edge.condition || undefined,
    })),
  };
}

function inferEntrypoint(graph: WorkflowGraph, workflow: WorkflowDefinition) {
  if (workflow.entrypoint) {
    return workflow.entrypoint;
  }

  const targets = new Set(graph.edges.map((edge) => edge.target));
  return graph.nodes.find((node) => !targets.has(node.id))?.id ?? graph.nodes[0]?.id ?? '';
}

export function graphToBackendWorkflow(graph: WorkflowGraph, workflow: WorkflowDefinition): WorkflowDefinition {
  return {
    ...workflow,
    entrypoint: inferEntrypoint(graph, workflow),
    nodes: graph.nodes.map((node) => {
      const existing = workflow.nodes?.find((item) => item.id === node.id);
      return {
        id: node.id,
        name: node.data.label,
        node_type: node.type,
        agent_id: existing?.agent_id ?? null,
        task_id: existing?.task_id ?? null,
        tool_id: existing?.tool_id ?? null,
        config: existing?.config ?? {},
        metadata: existing?.metadata ?? {},
      };
    }),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      source_node_id: edge.source,
      target_node_id: edge.target,
      edge_type: edge.type,
      condition: edge.label ?? null,
      metadata: {},
    })),
  };
}
