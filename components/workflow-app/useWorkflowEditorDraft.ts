'use client';

import { useEffect, useState } from 'react';
import { extractWorkflowInputs, resolveWorkflowExecutionHost } from '@/lib/workflows/executionPayload';
import { preferredWorkflowRuntimeAdapterId } from '@/lib/workflows/runtimeAdapterSelection';
import { rebuildWorkflowGraph } from '@/lib/workflows/workflowDefinitionMutations';
import type { AgentDefinition } from '@/types/agents';
import type { JsonObject } from '@/types/api';
import type { ExecutionHost, TaskDefinition, WorkflowDefinition } from '@/types/workflows';
import type { XYPosition } from 'reactflow';

export interface WorkflowEdgeDraftMetadata {
  edgeType: string;
  condition: string;
  metadataJson: string;
}

type EdgeMetadataValidationMap = Record<string, string>;
type EdgeConditionValidationMap = Record<string, string>;

function getTaskEdgeKey(sourceTaskId: string, targetTaskId: string) {
  return `${sourceTaskId}->${targetTaskId}`;
}

function createDraftAgentDefinition(index: number): AgentDefinition {
  return {
    id: `agent-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
    name: `Agent ${index + 1}`,
    description: '',
    instructions: '',
    system_prompt: '',
    role: '',
    backstory: '',
    model_profile_id: null,
    tool_ids: [],
    handoff_agent_ids: [],
    metadata: {
      created_from: 'workflow-detail-workspace',
    },
  };
}

function copyCatalogAgentDefinition(agent: AgentDefinition): AgentDefinition {
  return {
    ...agent,
    tool_ids: [...(agent.tool_ids ?? agent.toolIds ?? [])],
    handoff_agent_ids: [...(agent.handoff_agent_ids ?? agent.handoffAgentIds ?? [])],
    metadata: {
      ...(agent.metadata ?? {}),
      added_from_agent_catalog: true,
    },
  };
}

function createDraftTaskDefinition(index: number): TaskDefinition {
  return {
    id: `task-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
    name: `Task ${index + 1}`,
    description: '',
    instructions: '',
    expected_output: '',
    agent_id: null,
    tool_ids: [],
    depends_on_task_ids: [],
    human_approval_required: false,
  };
}

function getEntrypointTaskId(
  entrypoint: string | undefined,
  tasks: TaskDefinition[],
  workflowNodes?: Array<{ id: string; task_id?: string | null }>
) {
  if (!entrypoint) {
    return '';
  }

  if (tasks.some((task) => task.id === entrypoint)) {
    return entrypoint;
  }

  const matchingNode = workflowNodes?.find((node) => node.id === entrypoint);
  if (matchingNode?.task_id && tasks.some((task) => task.id === matchingNode.task_id)) {
    return matchingNode.task_id;
  }

  return '';
}

export function labelForEntrypointTask(taskId: string | undefined, tasks: TaskDefinition[]) {
  if (!taskId) {
    return 'Not set';
  }

  return tasks.find((task) => task.id === taskId)?.name || taskId;
}

function validateWorkflowDraft(
  workflowName: string,
  workflowDescription: string,
  agents: AgentDefinition[],
  tasks: TaskDefinition[],
  entrypointTaskId: string,
  defaultRuntimeAdapterId: string,
  allowedRuntimeAdapterIds: string[],
  edgeMetadataByTaskPair: Record<string, WorkflowEdgeDraftMetadata>
) {
  const issues: string[] = [];
  const taskIds = new Set(tasks.map((task) => task.id));
  const taskNameById = new Map(tasks.map((task) => [task.id, task.name?.trim() || task.id]));

  if (!workflowName.trim()) {
    issues.push('Workflow name is required.');
  }

  if (!workflowDescription.trim()) {
    issues.push('Workflow description is required.');
  }

  for (const agent of agents) {
    if (!agent.name?.trim()) {
      issues.push('Each agent must have a name.');
      break;
    }
  }

  for (const task of tasks) {
    if (!task.name?.trim()) {
      issues.push('Each task must have a name.');
      break;
    }
  }

  for (const task of tasks) {
    if (!task.description?.trim()) {
      issues.push(`Task "${task.name || task.id}" must have a description.`);
      break;
    }
  }

  for (const task of tasks) {
    for (const dependencyId of task.depends_on_task_ids ?? []) {
      if (!taskIds.has(dependencyId)) {
        issues.push(`Task "${task.name}" depends on a missing task.`);
      }
    }
  }

  if (defaultRuntimeAdapterId && !allowedRuntimeAdapterIds.includes(defaultRuntimeAdapterId)) {
    issues.push('The default runtime adapter must also be allowed for this workflow.');
  }

  if (entrypointTaskId && !taskIds.has(entrypointTaskId)) {
    issues.push('The selected entrypoint task no longer exists.');
  }

  const visitState = new Map<string, 'visiting' | 'visited'>();
  const hasCycleFrom = (taskId: string): boolean => {
    const state = visitState.get(taskId);
    if (state === 'visiting') {
      return true;
    }
    if (state === 'visited') {
      return false;
    }

    visitState.set(taskId, 'visiting');
    const task = tasks.find((candidate) => candidate.id === taskId);
    for (const dependencyId of task?.depends_on_task_ids ?? []) {
      if (taskIds.has(dependencyId) && hasCycleFrom(dependencyId)) {
        return true;
      }
    }
    visitState.set(taskId, 'visited');
    return false;
  };

  if (tasks.some((task) => hasCycleFrom(task.id))) {
    issues.push('Task dependencies contain a cycle. Workflow execution requires an acyclic task graph.');
  }

  for (const [edgeKey, error] of Object.entries(getInvalidEdgeConditionByTaskPair(edgeMetadataByTaskPair, tasks))) {
    const [sourceTaskId, targetTaskId] = edgeKey.split('->');
    const sourceTaskName = taskNameById.get(sourceTaskId) || sourceTaskId;
    const targetTaskName = taskNameById.get(targetTaskId) || targetTaskId;
    issues.push(`Edge condition for "${sourceTaskName}" -> "${targetTaskName}" ${error}`);
  }

  for (const [edgeKey, error] of Object.entries(getInvalidEdgeMetadataByTaskPair(edgeMetadataByTaskPair, tasks))) {
    const [sourceTaskId, targetTaskId] = edgeKey.split('->');
    const sourceTaskName = taskNameById.get(sourceTaskId) || sourceTaskId;
    const targetTaskName = taskNameById.get(targetTaskId) || targetTaskId;
    issues.push(`Edge metadata for "${sourceTaskName}" -> "${targetTaskName}" ${error}`);
  }

  return issues;
}

function taskDependsOn(
  tasks: TaskDefinition[],
  startTaskId: string,
  targetTaskId: string,
  visited = new Set<string>()
): boolean {
  if (startTaskId === targetTaskId) {
    return true;
  }

  if (visited.has(startTaskId)) {
    return false;
  }
  visited.add(startTaskId);

  const task = tasks.find((candidate) => candidate.id === startTaskId);
  for (const dependencyId of task?.depends_on_task_ids ?? []) {
    if (dependencyId === targetTaskId || taskDependsOn(tasks, dependencyId, targetTaskId, visited)) {
      return true;
    }
  }

  return false;
}

export function dependencyWouldCreateCycle(tasks: TaskDefinition[], taskId: string, dependencyId: string) {
  if (taskId === dependencyId) {
    return true;
  }

  return taskDependsOn(tasks, dependencyId, taskId);
}

function stableSerialize(value: unknown) {
  return JSON.stringify(value);
}

export function resolveRestartActiveExecutions(workflow: WorkflowDefinition | undefined) {
  if (typeof workflow?.metadata?.restart_active_executions === 'boolean') {
    return workflow.metadata.restart_active_executions;
  }

  if (typeof workflow?.metadata?.restartActiveExecutions === 'boolean') {
    return workflow.metadata.restartActiveExecutions;
  }

  return typeof workflow?.restart_active_executions === 'boolean'
    ? workflow.restart_active_executions
    : false;
}

function reconcileAllowedRuntimeAdapterIds(
  allowedRuntimeAdapterIds: string[] | undefined,
  defaultRuntimeAdapterId: string | null | undefined
) {
  const nextAllowedRuntimeAdapterIds = Array.from(new Set(allowedRuntimeAdapterIds ?? []));
  const normalizedDefaultRuntimeAdapterId = defaultRuntimeAdapterId?.trim();

  if (
    normalizedDefaultRuntimeAdapterId &&
    !nextAllowedRuntimeAdapterIds.includes(normalizedDefaultRuntimeAdapterId)
  ) {
    nextAllowedRuntimeAdapterIds.push(normalizedDefaultRuntimeAdapterId);
  }

  return nextAllowedRuntimeAdapterIds;
}

export function hasValidationIssue(issues: string[], pattern: RegExp) {
  return issues.some((issue) => pattern.test(issue));
}

function moveItemInList<T>(items: T[], fromIndex: number, toIndex: number) {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

const graphNodeBaseX = 80;
const graphNodeBaseY = 60;
const graphNodeColumnGap = 420;
const graphNodeRowGap = 420;
const legacyGraphNodeColumnGap = 280;
const legacyGraphNodeRowGap = 180;
const graphNodeOverlapWidth = 260;
const graphNodeOverlapHeight = 340;

function defaultGraphNodePosition(index: number): XYPosition {
  return {
    x: graphNodeBaseX + (index % 3) * graphNodeColumnGap,
    y: graphNodeBaseY + Math.floor(index / 3) * graphNodeRowGap,
  };
}

function legacyGraphNodePosition(index: number): XYPosition {
  return {
    x: graphNodeBaseX + (index % 3) * legacyGraphNodeColumnGap,
    y: graphNodeBaseY + Math.floor(index / 3) * legacyGraphNodeRowGap,
  };
}

function graphNodePositionMatches(position: XYPosition, expected: XYPosition) {
  return position.x === expected.x && position.y === expected.y;
}

function computeDependencyAwareGraphNodePositions(tasks: TaskDefinition[]) {
  const taskIds = new Set(tasks.map((task) => task.id));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const taskIndexById = new Map(tasks.map((task, index) => [task.id, index]));
  const layerByTaskId = new Map<string, number>();
  const visitingTaskIds = new Set<string>();

  const resolveLayer = (taskId: string): number => {
    const existingLayer = layerByTaskId.get(taskId);
    if (typeof existingLayer === 'number') {
      return existingLayer;
    }

    if (visitingTaskIds.has(taskId)) {
      return 0;
    }

    visitingTaskIds.add(taskId);
    const task = taskById.get(taskId);
    const dependencyLayers = (task?.depends_on_task_ids ?? [])
      .filter((dependencyId) => taskIds.has(dependencyId))
      .map((dependencyId) => resolveLayer(dependencyId));
    visitingTaskIds.delete(taskId);

    const layer = dependencyLayers.length > 0 ? Math.max(...dependencyLayers) + 1 : 0;
    layerByTaskId.set(taskId, layer);
    return layer;
  };

  tasks.forEach((task) => resolveLayer(task.id));

  const taskIdsByLayer = new Map<number, string[]>();
  tasks.forEach((task) => {
    const layer = layerByTaskId.get(task.id) ?? 0;
    taskIdsByLayer.set(layer, [...(taskIdsByLayer.get(layer) ?? []), task.id]);
  });

  const positions: Record<string, XYPosition> = {};
  taskIdsByLayer.forEach((layerTaskIds, layer) => {
    layerTaskIds
      .sort(
        (leftTaskId, rightTaskId) =>
          (taskIndexById.get(leftTaskId) ?? 0) - (taskIndexById.get(rightTaskId) ?? 0)
      )
      .forEach((taskId, rowIndex) => {
        positions[taskId] = {
          x: graphNodeBaseX + layer * graphNodeColumnGap,
          y: graphNodeBaseY + rowIndex * graphNodeRowGap,
        };
      });
  });

  return positions;
}

function positionsUseLegacyCompactGrid(
  tasks: TaskDefinition[],
  positions: Record<string, XYPosition>
) {
  return tasks.every((task, index) => {
    const position = positions[task.id];
    return position ? graphNodePositionMatches(position, legacyGraphNodePosition(index)) : false;
  });
}

function positionsHaveLikelyNodeOverlap(
  tasks: TaskDefinition[],
  positions: Record<string, XYPosition>
) {
  for (let leftIndex = 0; leftIndex < tasks.length; leftIndex += 1) {
    const leftPosition = positions[tasks[leftIndex].id];
    if (!leftPosition) {
      continue;
    }

    for (let rightIndex = leftIndex + 1; rightIndex < tasks.length; rightIndex += 1) {
      const rightPosition = positions[tasks[rightIndex].id];
      if (!rightPosition) {
        continue;
      }

      const horizontallyOverlaps =
        Math.abs(leftPosition.x - rightPosition.x) < graphNodeOverlapWidth;
      const verticallyOverlaps =
        Math.abs(leftPosition.y - rightPosition.y) < graphNodeOverlapHeight;
      if (horizontallyOverlaps && verticallyOverlaps) {
        return true;
      }
    }
  }

  return false;
}

function normalizeGraphNodePositions(
  tasks: TaskDefinition[],
  positions: Record<string, XYPosition>
) {
  if (
    tasks.length > 1 &&
    (positionsUseLegacyCompactGrid(tasks, positions) ||
      positionsHaveLikelyNodeOverlap(tasks, positions))
  ) {
    return computeDependencyAwareGraphNodePositions(tasks);
  }

  return positions;
}

function isGraphNodePosition(value: unknown): value is XYPosition {
  const candidate = value as Record<string, unknown> | null;
  return (
    candidate !== null &&
    typeof candidate === 'object' &&
    !Array.isArray(candidate) &&
    'x' in candidate &&
    'y' in candidate &&
    typeof candidate.x === 'number' &&
    typeof candidate.y === 'number'
  );
}

export function extractGraphNodePositions(
  workflow: {
    nodes?: Array<{ task_id?: string | null; metadata?: Record<string, unknown> }>;
    task_definitions?: TaskDefinition[];
  } | null | undefined
) {
  const positions: Record<string, XYPosition> = {};
  const tasks = workflow?.task_definitions ?? [];
  const nodeByTaskId = new Map(
    (workflow?.nodes ?? [])
      .filter((node): node is { task_id: string; metadata?: Record<string, unknown> } => typeof node.task_id === 'string')
      .map((node) => [node.task_id, node])
  );

  tasks.forEach((task, index) => {
    const position = nodeByTaskId.get(task.id)?.metadata?.position;
    if (isGraphNodePosition(position)) {
      positions[task.id] = { x: position.x, y: position.y };
      return;
    }

    positions[task.id] = defaultGraphNodePosition(index);
  });

  return normalizeGraphNodePositions(tasks, positions);
}

export function applyGraphNodePositions<
  T extends { nodes?: Array<{ task_id?: string | null; metadata?: Record<string, unknown> }> },
>(workflow: T, positions: Record<string, XYPosition>) {
  return {
    ...workflow,
    nodes: (workflow.nodes ?? []).map((node) => ({
      ...node,
      metadata: {
        ...(node.metadata ?? {}),
        ...(node.task_id && positions[node.task_id] ? { position: positions[node.task_id] } : {}),
      },
    })),
  };
}

function extractEdgeDraftMetadata(workflow: WorkflowDefinition | undefined) {
  const nodeToTaskId = new Map(
    (workflow?.nodes ?? [])
      .filter((node) => typeof node.id === 'string' && typeof node.task_id === 'string')
      .map((node) => [node.id, node.task_id as string])
  );

  return (workflow?.edges ?? []).reduce<Record<string, WorkflowEdgeDraftMetadata>>((accumulator, edge) => {
    const sourceTaskId = nodeToTaskId.get(edge.source_node_id);
    const targetTaskId = nodeToTaskId.get(edge.target_node_id);
    if (!sourceTaskId || !targetTaskId) {
      return accumulator;
    }

    accumulator[getTaskEdgeKey(sourceTaskId, targetTaskId)] = {
      edgeType: edge.edge_type || 'default',
      condition: edge.condition || '',
      metadataJson: edge.metadata ? JSON.stringify(edge.metadata, null, 2) : '',
    };
    return accumulator;
  }, {});
}

function applyEdgeDraftMetadata(workflow: WorkflowDefinition, edgeMetadata: Record<string, WorkflowEdgeDraftMetadata>) {
  const nodeToTaskId = new Map(
    (workflow.nodes ?? [])
      .filter((node) => typeof node.id === 'string' && typeof node.task_id === 'string')
      .map((node) => [node.id, node.task_id as string])
  );

  return {
    ...workflow,
    edges: (workflow.edges ?? []).map((edge) => {
      const sourceTaskId = nodeToTaskId.get(edge.source_node_id);
      const targetTaskId = nodeToTaskId.get(edge.target_node_id);
      if (!sourceTaskId || !targetTaskId) {
        return edge;
      }

      const metadata = edgeMetadata[getTaskEdgeKey(sourceTaskId, targetTaskId)];
      return {
        ...edge,
        edge_type: metadata?.edgeType || edge.edge_type || 'default',
        condition: metadata?.condition || null,
        metadata:
          metadata?.metadataJson && metadata.metadataJson.trim().length > 0
            ? parseEdgeMetadataJson(metadata.metadataJson).metadata
            : edge.metadata ?? {},
      };
    }),
  };
}

function parseEdgeMetadataJson(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return { metadata: {} as JsonObject, error: null as string | null };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { metadata: parsed as JsonObject, error: null as string | null };
    }
    return { metadata: {} as JsonObject, error: 'must be a JSON object, not an array or primitive.' };
  } catch {
    return { metadata: {} as JsonObject, error: 'must be valid JSON.' };
  }
}

function getInvalidEdgeMetadataByTaskPair(
  edgeMetadataByTaskPair: Record<string, WorkflowEdgeDraftMetadata>,
  tasks: TaskDefinition[]
) {
  const taskIds = new Set(tasks.map((task) => task.id));

  return Object.entries(edgeMetadataByTaskPair).reduce<EdgeMetadataValidationMap>((accumulator, [edgeKey, metadata]) => {
    const [sourceTaskId, targetTaskId] = edgeKey.split('->');
    if (!taskIds.has(sourceTaskId) || !taskIds.has(targetTaskId)) {
      return accumulator;
    }

    const validation = parseEdgeMetadataJson(metadata.metadataJson);
    if (validation.error) {
      accumulator[edgeKey] = validation.error;
    }

    return accumulator;
  }, {});
}

function getInvalidEdgeConditionByTaskPair(
  edgeMetadataByTaskPair: Record<string, WorkflowEdgeDraftMetadata>,
  tasks: TaskDefinition[]
) {
  const taskIds = new Set(tasks.map((task) => task.id));

  return Object.entries(edgeMetadataByTaskPair).reduce<EdgeConditionValidationMap>((accumulator, [edgeKey, metadata]) => {
    const [sourceTaskId, targetTaskId] = edgeKey.split('->');
    if (!taskIds.has(sourceTaskId) || !taskIds.has(targetTaskId)) {
      return accumulator;
    }

    if (metadata.edgeType === 'conditional' && !metadata.condition.trim()) {
      accumulator[edgeKey] = 'is required when edge type is conditional.';
    }

    return accumulator;
  }, {});
}

export function useWorkflowEditorDraft({
  workflow,
  workflowId,
}: {
  workflow: WorkflowDefinition | undefined;
  workflowId: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [entrypoint, setEntrypoint] = useState('');
  const [executionHost, setExecutionHost] = useState<ExecutionHost>('local');
  const [restartActiveExecutions, setRestartActiveExecutions] = useState(false);
  const [defaultRuntimeAdapterId, setDefaultRuntimeAdapterId] = useState('');
  const [allowedRuntimeAdapterIds, setAllowedRuntimeAdapterIds] = useState<string[]>([]);
  const [agentDefinitions, setAgentDefinitions] = useState<AgentDefinition[]>([]);
  const [taskDefinitions, setTaskDefinitions] = useState<TaskDefinition[]>([]);
  const [graphNodePositions, setGraphNodePositions] = useState<Record<string, XYPosition>>({});
  const [edgeMetadataByTaskPair, setEdgeMetadataByTaskPair] = useState<Record<string, WorkflowEdgeDraftMetadata>>({});

  const visibleAgentDefinitions = isEditing ? agentDefinitions : workflow?.agent_definitions ?? [];
  const visibleTaskDefinitions = isEditing ? taskDefinitions : workflow?.task_definitions ?? [];
  const currentGraphNodePositions = isEditing ? graphNodePositions : extractGraphNodePositions(workflow);
  const effectiveEntrypointTaskId = isEditing
    ? entrypoint
    : getEntrypointTaskId(workflow?.entrypoint, workflow?.task_definitions ?? [], workflow?.nodes);
  const invalidEdgeConditionByTaskPair = isEditing
    ? getInvalidEdgeConditionByTaskPair(edgeMetadataByTaskPair, visibleTaskDefinitions)
    : {};
  const invalidEdgeMetadataByTaskPair = isEditing
    ? getInvalidEdgeMetadataByTaskPair(edgeMetadataByTaskPair, visibleTaskDefinitions)
    : {};
  const draftValidationIssues = isEditing
    ? validateWorkflowDraft(
        name,
        description,
        visibleAgentDefinitions,
        visibleTaskDefinitions,
        entrypoint,
        defaultRuntimeAdapterId,
        allowedRuntimeAdapterIds,
        edgeMetadataByTaskPair
      )
    : [];
  const workflowPreview = workflow
    ? isEditing
      ? applyGraphNodePositions(
          applyEdgeDraftMetadata(
            rebuildWorkflowGraph({
              ...workflow,
              id: workflowId,
              name: name.trim() || workflow.name,
              description: description.trim() || workflow.description || null,
              entrypoint: entrypoint.trim() || undefined,
              default_runtime_adapter_id: defaultRuntimeAdapterId.trim() || null,
              allowed_runtime_adapter_ids: allowedRuntimeAdapterIds,
              agent_definitions: visibleAgentDefinitions,
              task_definitions: visibleTaskDefinitions,
              metadata: {
                ...(workflow.metadata ?? {}),
                execution_host: executionHost,
                restart_active_executions: restartActiveExecutions,
              },
            }),
            edgeMetadataByTaskPair
          ),
          graphNodePositions
        )
      : applyGraphNodePositions(workflow, currentGraphNodePositions)
    : null;
  const workflowInputs = workflowPreview ? extractWorkflowInputs(workflowPreview) : [];
  const workflowKickoffInputs = workflowInputs.reduce(
    (accumulator, key) => ({ ...accumulator, [key]: '' }),
    {} as Record<string, string>
  );
  const hasUnsavedChanges =
    Boolean(workflow) &&
    isEditing &&
    stableSerialize({
      name,
      description,
      entrypoint,
      executionHost,
      defaultRuntimeAdapterId,
      allowedRuntimeAdapterIds,
      restartActiveExecutions,
      agentDefinitions,
      taskDefinitions,
      graphNodePositions,
      edgeMetadataByTaskPair,
    }) !==
      stableSerialize({
        name: workflow?.name ?? '',
        description: workflow?.description ?? '',
        entrypoint: getEntrypointTaskId(workflow?.entrypoint, workflow?.task_definitions ?? [], workflow?.nodes),
        executionHost: resolveWorkflowExecutionHost(workflow),
        defaultRuntimeAdapterId: workflow?.default_runtime_adapter_id ?? '',
        allowedRuntimeAdapterIds: workflow?.allowed_runtime_adapter_ids ?? [],
        restartActiveExecutions: resolveRestartActiveExecutions(workflow),
        agentDefinitions: workflow?.agent_definitions ?? [],
        taskDefinitions: workflow?.task_definitions ?? [],
        graphNodePositions: extractGraphNodePositions(workflow),
        edgeMetadataByTaskPair: extractEdgeDraftMetadata(workflow),
      });
  const workflowNameInvalid = hasValidationIssue(draftValidationIssues, /workflow name/i);
  const workflowDescriptionInvalid = hasValidationIssue(draftValidationIssues, /workflow description/i);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const resetEditingDraft = () => {
    if (!workflow) {
      return;
    }

    setName(workflow.name ?? '');
    setDescription(workflow.description ?? '');
    setEntrypoint(getEntrypointTaskId(workflow.entrypoint, workflow.task_definitions ?? [], workflow.nodes));
    setExecutionHost(resolveWorkflowExecutionHost(workflow));
    setRestartActiveExecutions(resolveRestartActiveExecutions(workflow));
    const nextAllowedRuntimeAdapterIds = reconcileAllowedRuntimeAdapterIds(
      workflow.allowed_runtime_adapter_ids,
      workflow.default_runtime_adapter_id
    );
    setDefaultRuntimeAdapterId(
      preferredWorkflowRuntimeAdapterId(nextAllowedRuntimeAdapterIds, workflow.default_runtime_adapter_id)
    );
    setAllowedRuntimeAdapterIds(nextAllowedRuntimeAdapterIds);
    setAgentDefinitions(workflow.agent_definitions ?? []);
    setTaskDefinitions(workflow.task_definitions ?? []);
    setGraphNodePositions(extractGraphNodePositions(workflow));
    setEdgeMetadataByTaskPair(extractEdgeDraftMetadata(workflow));
  };

  const startEditing = () => {
    resetEditingDraft();
    setIsEditing(true);
  };

  const stopEditing = () => {
    resetEditingDraft();
    setIsEditing(false);
  };

  const addAgentDefinition = () => {
    setAgentDefinitions((current) => [...current, createDraftAgentDefinition(current.length)]);
  };

  const addExistingAgentDefinition = (agent: AgentDefinition) => {
    setAgentDefinitions((current) => {
      if (current.some((candidate) => candidate.id === agent.id)) {
        return current;
      }

      return [...current, copyCatalogAgentDefinition(agent)];
    });
  };

  const updateAgentDefinition = (agentIndex: number, updates: Partial<AgentDefinition>) => {
    setAgentDefinitions((current) =>
      current.map((candidate, candidateIndex) => (candidateIndex === agentIndex ? { ...candidate, ...updates } : candidate))
    );
  };

  const removeAgentDefinition = (agentId: string) => {
    setAgentDefinitions((current) =>
      current
        .filter((agent) => agent.id !== agentId)
        .map((agent) => ({
          ...agent,
          handoff_agent_ids: (agent.handoff_agent_ids ?? []).filter((candidateId) => candidateId !== agentId),
        }))
    );
    setTaskDefinitions((current) =>
      current.map((task) => ({
        ...task,
        agent_id: task.agent_id === agentId ? null : task.agent_id,
      }))
    );
  };

  const addTaskDefinition = () => {
    setTaskDefinitions((current) => {
      const nextTask = createDraftTaskDefinition(current.length);
      setGraphNodePositions((currentPositions) => ({
        ...currentPositions,
        [nextTask.id]: defaultGraphNodePosition(current.length),
      }));
      return [...current, nextTask];
    });
  };

  const updateTaskDefinition = (taskIndex: number, updates: Partial<TaskDefinition>) => {
    setTaskDefinitions((current) =>
      current.map((candidate, candidateIndex) => (candidateIndex === taskIndex ? { ...candidate, ...updates } : candidate))
    );
  };

  const removeTaskDefinition = (taskId: string) => {
    if (entrypoint === taskId) {
      setEntrypoint('');
    }
    setGraphNodePositions((current) => {
      const next = { ...current };
      delete next[taskId];
      return next;
    });
    setTaskDefinitions((current) =>
      current
        .filter((task) => task.id !== taskId)
        .map((task) => ({
          ...task,
          depends_on_task_ids: (task.depends_on_task_ids ?? []).filter((candidateId) => candidateId !== taskId),
        }))
    );
    setEdgeMetadataByTaskPair((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => !key.startsWith(`${taskId}->`) && !key.endsWith(`->${taskId}`))
      )
    );
  };

  const moveTaskDefinition = (fromIndex: number, toIndex: number) => {
    setTaskDefinitions((current) => moveItemInList(current, fromIndex, toIndex));
  };

  const connectTaskDependency = (sourceTaskId: string, targetTaskId: string) => {
    if (
      sourceTaskId === targetTaskId ||
      dependencyWouldCreateCycle(visibleTaskDefinitions, targetTaskId, sourceTaskId)
    ) {
      return false;
    }

    setTaskDefinitions((current) =>
      current.map((task) =>
        task.id === targetTaskId
          ? {
              ...task,
              depends_on_task_ids: Array.from(new Set([...(task.depends_on_task_ids ?? []), sourceTaskId])),
            }
          : task
      )
    );
    setEdgeMetadataByTaskPair((current) => ({
      ...current,
      [getTaskEdgeKey(sourceTaskId, targetTaskId)]: current[getTaskEdgeKey(sourceTaskId, targetTaskId)] ?? {
        edgeType: 'default',
        condition: '',
        metadataJson: '',
      },
    }));
    return true;
  };

  const disconnectTaskDependency = (sourceTaskId: string, targetTaskId: string) => {
    setTaskDefinitions((current) =>
      current.map((task) =>
        task.id === targetTaskId
          ? {
              ...task,
              depends_on_task_ids: (task.depends_on_task_ids ?? []).filter((dependencyId) => dependencyId !== sourceTaskId),
            }
          : task
      )
    );
    setEdgeMetadataByTaskPair((current) => {
      const next = { ...current };
      delete next[getTaskEdgeKey(sourceTaskId, targetTaskId)];
      return next;
    });
  };

  const updateEdgeMetadata = (
    sourceTaskId: string,
    targetTaskId: string,
    updates: Partial<WorkflowEdgeDraftMetadata>
  ) => {
    const key = getTaskEdgeKey(sourceTaskId, targetTaskId);
    setEdgeMetadataByTaskPair((current) => ({
      ...current,
      [key]: {
        edgeType: current[key]?.edgeType || 'default',
        condition: current[key]?.condition || '',
        metadataJson: current[key]?.metadataJson || '',
        ...updates,
      },
    }));
  };

  const selectDefaultRuntimeAdapter = (nextValue: string) => {
    setDefaultRuntimeAdapterId(nextValue);
    if (nextValue) {
      setAllowedRuntimeAdapterIds((current) => (current.includes(nextValue) ? current : [...current, nextValue]));
    }
  };

  const toggleAllowedRuntimeAdapter = (adapterId: string, checked: boolean) => {
    setAllowedRuntimeAdapterIds((current) => {
      const nextAllowedRuntimeAdapterIds = checked
        ? Array.from(new Set([...current, adapterId]))
        : current.filter((item) => item !== adapterId);
      setDefaultRuntimeAdapterId(
        preferredWorkflowRuntimeAdapterId(nextAllowedRuntimeAdapterIds, defaultRuntimeAdapterId)
      );
      return nextAllowedRuntimeAdapterIds;
    });
  };

  return {
    state: {
      agentDefinitions,
      allowedRuntimeAdapterIds,
      defaultRuntimeAdapterId,
      description,
      edgeMetadataByTaskPair,
      entrypoint,
      executionHost,
      graphNodePositions,
      isEditing,
      name,
      restartActiveExecutions,
      taskDefinitions,
    },
    derived: {
      currentGraphNodePositions,
      draftValidationIssues,
      effectiveEntrypointTaskId,
      hasUnsavedChanges,
      invalidEdgeConditionByTaskPair,
      invalidEdgeMetadataByTaskPair,
      visibleAgentDefinitions,
      visibleTaskDefinitions,
      workflowDescriptionInvalid,
      workflowInputs,
      workflowKickoffInputs,
      workflowNameInvalid,
      workflowPreview,
    },
    actions: {
      addAgentDefinition,
      addExistingAgentDefinition,
      addTaskDefinition,
      connectTaskDependency,
      disconnectTaskDependency,
      moveTaskDefinition,
      removeAgentDefinition,
      removeTaskDefinition,
      resetEditingDraft,
      selectDefaultRuntimeAdapter,
      setDescription,
      setEntrypoint,
      setExecutionHost,
      setGraphNodePositions,
      setIsEditing,
      setName,
      setRestartActiveExecutions,
      setTaskDefinitions,
      startEditing,
      stopEditing,
      toggleAllowedRuntimeAdapter,
      updateAgentDefinition,
      updateEdgeMetadata,
      updateTaskDefinition,
    },
  };
}
