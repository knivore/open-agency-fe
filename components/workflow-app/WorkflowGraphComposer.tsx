'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { UserRound } from 'lucide-react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
  type XYPosition,
  Handle,
  MarkerType,
  Position,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { AgentDefinition } from '@/types/agents';
import type { ToolDefinition } from '@/types/tools';
import type { TaskDefinition } from '@/types/workflows';
import { toolDisplayName } from '@/lib/tools/displayName';
import { Badge } from '../library/shadcn/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../library/shadcn/card';

type GraphTaskNodeData = {
  label: string;
  description: string;
  agentName: string;
  agentRole: string;
  agentToolNames: string[];
  agentAccentColor: string;
  isEntrypoint: boolean;
  isRoot: boolean;
  approvalRequired: boolean;
  isSelected: boolean;
};

type WorkflowGraphComposerProps = {
  tasks: TaskDefinition[];
  agents: AgentDefinition[];
  tools: ToolDefinition[];
  entrypointTaskId: string;
  selectedTaskId?: string | null;
  selectedEdgeId?: string | null;
  edgeConditions?: Record<string, string>;
  positions: Record<string, XYPosition>;
  editable: boolean;
  onPositionsChange?: (positions: Record<string, XYPosition>) => void;
  onConnectTasks?: (sourceTaskId: string, targetTaskId: string) => void;
  onDisconnectTasks?: (sourceTaskId: string, targetTaskId: string) => void;
  onSelectTask?: (taskId: string | null) => void;
  onSelectEdge?: (edgeId: string | null) => void;
};

function defaultPosition(index: number): XYPosition {
  return {
    x: 80 + (index % 3) * 420,
    y: 60 + Math.floor(index / 3) * 420,
  };
}

const agentAccentColors = ['#0284c7', '#16a34a', '#7c3aed', '#ea580c', '#0891b2', '#be123c'];
const unassignedAccentColor = '#737373';

const TaskNode = memo(function TaskNode({ data }: NodeProps<GraphTaskNodeData>) {
  return (
    <div
      className={`relative w-[240px] overflow-hidden rounded-xl border bg-white p-4 shadow-sm ${
        data.isSelected ? 'border-sky-500 ring-2 ring-sky-200' : 'border-neutral-200'
      }`}
    >
      <div
        className="absolute inset-x-0 top-0 h-1.5"
        style={{ backgroundColor: data.agentAccentColor }}
      />
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !bg-slate-700" />
      <div className="flex flex-wrap items-center gap-2">
        <p className="line-clamp-2 font-medium text-neutral-900">{data.label}</p>
        {data.isEntrypoint ? <Badge variant="secondary">Entrypoint</Badge> : null}
        {data.isRoot ? <Badge variant="outline">Root</Badge> : null}
        {data.approvalRequired ? <Badge variant="secondary">Approval</Badge> : null}
      </div>
      <p className="mt-2 line-clamp-3 text-sm text-neutral-500">
        {data.description || 'No task description configured.'}
      </p>
      <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
          <UserRound className="h-3.5 w-3.5" style={{ color: data.agentAccentColor }} />
          Agent
        </div>
        <p className="mt-1 text-sm font-medium text-neutral-900">{data.agentName}</p>
        {data.agentRole ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{data.agentRole}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-1">
          {data.agentToolNames.length > 0 ? (
            data.agentToolNames.slice(0, 3).map((toolName) => (
              <span
                key={toolName}
                className="rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-neutral-600"
              >
                {toolName}
              </span>
            ))
          ) : (
            <span className="text-xs text-neutral-400">No tools assigned</span>
          )}
          {data.agentToolNames.length > 3 ? (
            <span className="rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
              +{data.agentToolNames.length - 3}
            </span>
          ) : null}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-slate-700" />
    </div>
  );
});

const nodeTypes = {
  workflowTask: TaskNode,
};

export default function WorkflowGraphComposer({
  tasks,
  agents,
  tools,
  entrypointTaskId,
  selectedTaskId,
  selectedEdgeId,
  edgeConditions,
  positions,
  editable,
  onPositionsChange,
  onConnectTasks,
  onDisconnectTasks,
  onSelectTask,
  onSelectEdge,
}: WorkflowGraphComposerProps) {
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<
    GraphTaskNodeData,
    Edge
  > | null>(null);
  const previousSelectedTaskId = useRef<string | null>(null);
  const toolMap = useMemo(() => new Map(tools.map((tool) => [tool.id, tool])), [tools]);
  const agentVisuals = useMemo(() => {
    const agentById = new Map(
      agents.map((agent, index) => [
        agent.id,
        {
          agent,
          color: agentAccentColors[index % agentAccentColors.length],
        },
      ])
    );

    const taskCountsByAgentId = tasks.reduce<Record<string, number>>((accumulator, task) => {
      const agentKey = task.agent_id || '__unassigned__';
      accumulator[agentKey] = (accumulator[agentKey] ?? 0) + 1;
      return accumulator;
    }, {});

    const summaries = agents.map((agent, index) => ({
      id: agent.id,
      name: agent.name || agent.id,
      role: agent.role || agent.description || '',
      color: agentAccentColors[index % agentAccentColors.length],
      taskCount: taskCountsByAgentId[agent.id] ?? 0,
      toolNames: (agent.tool_ids ?? []).map((toolId) => {
        const tool = toolMap.get(toolId);
        return tool ? toolDisplayName(tool) : toolId;
      }),
    }));

    if (taskCountsByAgentId.__unassigned__) {
      summaries.push({
        id: '__unassigned__',
        name: 'Unassigned',
        role: '',
        color: unassignedAccentColor,
        taskCount: taskCountsByAgentId.__unassigned__,
        toolNames: [],
      });
    }

    return { agentById, summaries };
  }, [agents, tasks, toolMap]);

  const nodesFromTasks = useMemo<Node<GraphTaskNodeData>[]>(() => {
    return tasks.map((task, index) => ({
      id: task.id,
      type: 'workflowTask',
      position: positions[task.id] ?? defaultPosition(index),
      draggable: true,
      selected: selectedTaskId === task.id,
      data: {
        label: task.name || task.id,
        description: task.description || '',
        agentName: task.agent_id
          ? agentVisuals.agentById.get(task.agent_id)?.agent.name || task.agent_id
          : 'Unassigned',
        agentRole: task.agent_id
          ? agentVisuals.agentById.get(task.agent_id)?.agent.role ||
            agentVisuals.agentById.get(task.agent_id)?.agent.description ||
            ''
          : '',
        agentToolNames: task.agent_id
          ? (agentVisuals.agentById.get(task.agent_id)?.agent.tool_ids ?? []).map((toolId) => {
              const tool = toolMap.get(toolId);
              return tool ? toolDisplayName(tool) : toolId;
            })
          : [],
        agentAccentColor: task.agent_id
          ? agentVisuals.agentById.get(task.agent_id)?.color || unassignedAccentColor
          : unassignedAccentColor,
        isEntrypoint: entrypointTaskId === task.id,
        isRoot: (task.depends_on_task_ids ?? []).length === 0,
        approvalRequired: Boolean(task.human_approval_required),
        isSelected: selectedTaskId === task.id,
      },
    }));
  }, [
    agentVisuals.agentById,
    editable,
    entrypointTaskId,
    positions,
    selectedTaskId,
    tasks,
    toolMap,
  ]);

  const edgesFromTasks = useMemo<Edge[]>(() => {
    return tasks.flatMap((task) =>
      (task.depends_on_task_ids ?? []).map((dependencyId) => ({
        id: `${dependencyId}->${task.id}`,
        source: dependencyId,
        target: task.id,
        markerEnd: { type: MarkerType.ArrowClosed },
        animated: entrypointTaskId === dependencyId,
        selected: selectedEdgeId === `${dependencyId}->${task.id}`,
        style:
          selectedEdgeId === `${dependencyId}->${task.id}`
            ? { stroke: '#0ea5e9', strokeWidth: 2.5 }
            : undefined,
        label: edgeConditions?.[`${dependencyId}->${task.id}`] || undefined,
      }))
    );
  }, [edgeConditions, entrypointTaskId, selectedEdgeId, tasks]);

  const [nodes, setNodes, onNodesChange] = useNodesState(nodesFromTasks);
  const [edges, setEdges, onEdgesChange] = useEdgesState(edgesFromTasks);

  useEffect(() => {
    setNodes(nodesFromTasks);
  }, [nodesFromTasks, setNodes]);

  useEffect(() => {
    setEdges(edgesFromTasks);
  }, [edgesFromTasks, setEdges]);

  useEffect(() => {
    if (!selectedTaskId || !reactFlowInstance) {
      previousSelectedTaskId.current = selectedTaskId ?? null;
      return;
    }

    if (previousSelectedTaskId.current === selectedTaskId) {
      return;
    }

    const selectedNode = nodes.find((node) => node.id === selectedTaskId);
    if (!selectedNode) {
      return;
    }

    reactFlowInstance.setCenter(selectedNode.position.x + 110, selectedNode.position.y + 60, {
      zoom: Math.max(reactFlowInstance.getZoom(), 0.95),
      duration: 300,
    });
    previousSelectedTaskId.current = selectedTaskId;
  }, [nodes, reactFlowInstance, selectedTaskId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow Graph</CardTitle>
        <CardDescription>
          {editable
            ? 'Drag task nodes to organize the canvas. Connect nodes to create task dependencies.'
            : 'Task graph derived from the saved workflow definition.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {agentVisuals.summaries.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {agentVisuals.summaries.map((agent) => (
              <div
                key={agent.id}
                className="flex min-h-10 items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: agent.color }}
                />
                <div>
                  <p className="font-medium leading-tight text-neutral-900">{agent.name}</p>
                  <p className="text-xs leading-tight text-neutral-500">
                    {agent.taskCount} {agent.taskCount === 1 ? 'task' : 'tasks'} •{' '}
                    {agent.toolNames.length} {agent.toolNames.length === 1 ? 'tool' : 'tools'}
                  </p>
                  {agent.toolNames.length > 0 ? (
                    <p className="mt-1 max-w-64 truncate text-xs leading-tight text-neutral-400">
                      {agent.toolNames.join(', ')}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <div className="rounded-xl border border-neutral-200 bg-neutral-50">
          <div className="h-[620px] w-full">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onInit={setReactFlowInstance}
              onNodesChange={onNodesChange}
              onEdgesChange={editable ? onEdgesChange : undefined}
              onNodeDragStop={(_, __, currentNodes) => {
                if (!editable || !onPositionsChange) {
                  return;
                }

                const nextPositions = currentNodes.reduce<Record<string, XYPosition>>(
                  (accumulator, node) => {
                    accumulator[node.id] = node.position;
                    return accumulator;
                  },
                  {}
                );
                onPositionsChange(nextPositions);
              }}
              onConnect={(connection) => {
                if (!editable || !connection.source || !connection.target || !onConnectTasks) {
                  return;
                }

                setEdges((currentEdges) =>
                  addEdge(
                    {
                      ...connection,
                      id: `${connection.source}->${connection.target}`,
                      markerEnd: { type: MarkerType.ArrowClosed },
                    },
                    currentEdges
                  )
                );
                onConnectTasks(connection.source, connection.target);
              }}
              onEdgesDelete={(deletedEdges) => {
                if (!editable || !onDisconnectTasks) {
                  return;
                }

                deletedEdges.forEach((edge) => {
                  onDisconnectTasks(edge.source, edge.target);
                });
              }}
              deleteKeyCode={editable ? ['Backspace', 'Delete'] : null}
              fitView
              nodesConnectable={editable}
              nodesDraggable
              elementsSelectable
              onNodeClick={(_, node) => {
                onSelectEdge?.(null);
                onSelectTask?.(node.id);
              }}
              onEdgeClick={(_, edge) => {
                onSelectTask?.(null);
                onSelectEdge?.(edge.id);
              }}
              onPaneClick={() => {
                onSelectEdge?.(null);
                onSelectTask?.(null);
              }}
            >
              <Background gap={20} color="#d4d4d8" />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-neutral-500">
          <span>Dependencies flow left to right.</span>
          {editable ? <span>Delete an edge with Backspace or Delete.</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}
