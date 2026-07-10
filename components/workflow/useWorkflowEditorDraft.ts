'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createCapabilityStarterTaskDraft } from '@/lib/workflows/capabilityTaskTemplates';
import { readWorkflowCapabilityTags } from '@/lib/workflows/capabilities';
import {
  extractWorkflowInputs,
  resolveWorkflowExecutionHost,
} from '@/lib/workflows/executionPayload';
import { preferredWorkflowRuntimeAdapterId } from '@/lib/workflows/runtimeAdapterSelection';
import { rebuildWorkflowGraph } from '@/lib/workflows/workflowDefinitionMutations';
import type { AgentDefinition } from '@/types/agents';
import type { JsonObject } from '@/types/api';
import type { ToolDefinition } from '@/types/tools';
import type {
  ExecutionHost,
  TaskDefinition,
  WorkflowDefinition,
  WorkflowMemoryDefinition,
  WorkflowNodeDefinition,
} from '@/types/workflows';
import { workflowMemoryDefinitionsFor } from '@/types/workflows';

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
    memory_ids: [],
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

function createDraftTaskDefinition(
  index: number,
  workflowCapabilityTags: string[] = []
): TaskDefinition {
  return {
    id: `task-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
    name: `Task ${index + 1}`,
    description: '',
    instructions: '',
    expected_output: '',
    agent_id: null,
    tool_ids: [],
    memory_ids: [],
    depends_on_task_ids: [],
    human_approval_required: false,
    ...createCapabilityStarterTaskDraft(
      workflowCapabilityTags.filter(
        (value): value is 'home-control' | 'vision' | 'voice' =>
          value === 'home-control' || value === 'vision' || value === 'voice'
      ),
      index
    ),
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
    issues.push(
      'Task dependencies contain a cycle. Workflow execution requires an acyclic task graph.'
    );
  }

  for (const [edgeKey, error] of Object.entries(
    getInvalidEdgeConditionByTaskPair(edgeMetadataByTaskPair, tasks)
  )) {
    const [sourceTaskId, targetTaskId] = edgeKey.split('->');
    const sourceTaskName = taskNameById.get(sourceTaskId) || sourceTaskId;
    const targetTaskName = taskNameById.get(targetTaskId) || targetTaskId;
    issues.push(`Edge condition for "${sourceTaskName}" -> "${targetTaskName}" ${error}`);
  }

  for (const [edgeKey, error] of Object.entries(
    getInvalidEdgeMetadataByTaskPair(edgeMetadataByTaskPair, tasks)
  )) {
    const [sourceTaskId, targetTaskId] = edgeKey.split('->');
    const sourceTaskName = taskNameById.get(sourceTaskId) || sourceTaskId;
    const targetTaskName = taskNameById.get(targetTaskId) || targetTaskId;
    issues.push(`Edge metadata for "${sourceTaskName}" -> "${targetTaskName}" ${error}`);
  }

  return issues;
}

function stableSerialize(value: unknown) {
  return JSON.stringify(value);
}

function comparableAgentDefinitions(agents: AgentDefinition[]) {
  return agents.map((agent) => {
    const comparableAgent = { ...agent } as Record<string, unknown>;
    delete comparableAgent.objective;
    delete comparableAgent.memory_ids;
    delete comparableAgent.memoryIds;
    return comparableAgent;
  });
}

function comparableTaskDefinitions(tasks: TaskDefinition[]) {
  return tasks.map((task) => {
    const comparableTask = { ...task } as Record<string, unknown>;
    delete comparableTask.memory_ids;
    delete comparableTask.memoryIds;
    return comparableTask;
  });
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

function extractEdgeDraftMetadata(workflow: WorkflowDefinition | undefined) {
  const nodeToTaskId = new Map(
    (workflow?.nodes ?? [])
      .filter((node) => typeof node.id === 'string' && typeof node.task_id === 'string')
      .map((node) => [node.id, node.task_id as string])
  );

  return (workflow?.edges ?? []).reduce<Record<string, WorkflowEdgeDraftMetadata>>(
    (accumulator, edge) => {
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
    },
    {}
  );
}

export function applyEdgeDraftMetadata(
  workflow: WorkflowDefinition,
  edgeMetadata: Record<string, WorkflowEdgeDraftMetadata>
) {
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
            : (edge.metadata ?? {}),
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
    return {
      metadata: {} as JsonObject,
      error: 'must be a JSON object, not an array or primitive.',
    };
  } catch {
    return { metadata: {} as JsonObject, error: 'must be valid JSON.' };
  }
}

function getInvalidEdgeMetadataByTaskPair(
  edgeMetadataByTaskPair: Record<string, WorkflowEdgeDraftMetadata>,
  tasks: TaskDefinition[]
) {
  const taskIds = new Set(tasks.map((task) => task.id));

  return Object.entries(edgeMetadataByTaskPair).reduce<EdgeMetadataValidationMap>(
    (accumulator, [edgeKey, metadata]) => {
      const [sourceTaskId, targetTaskId] = edgeKey.split('->');
      if (!taskIds.has(sourceTaskId) || !taskIds.has(targetTaskId)) {
        return accumulator;
      }

      const validation = parseEdgeMetadataJson(metadata.metadataJson);
      if (validation.error) {
        accumulator[edgeKey] = validation.error;
      }

      return accumulator;
    },
    {}
  );
}

function getInvalidEdgeConditionByTaskPair(
  edgeMetadataByTaskPair: Record<string, WorkflowEdgeDraftMetadata>,
  tasks: TaskDefinition[]
) {
  const taskIds = new Set(tasks.map((task) => task.id));

  return Object.entries(edgeMetadataByTaskPair).reduce<EdgeConditionValidationMap>(
    (accumulator, [edgeKey, metadata]) => {
      const [sourceTaskId, targetTaskId] = edgeKey.split('->');
      if (!taskIds.has(sourceTaskId) || !taskIds.has(targetTaskId)) {
        return accumulator;
      }

      if (metadata.edgeType === 'conditional' && !metadata.condition.trim()) {
        accumulator[edgeKey] = 'is required when edge type is conditional.';
      }

      return accumulator;
    },
    {}
  );
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
  const [workflowNodes, setWorkflowNodes] = useState<WorkflowNodeDefinition[]>([]);
  const [toolDefinitions, setToolDefinitions] = useState<ToolDefinition[]>([]);
  const [memoryDefinitions, setMemoryDefinitions] = useState<WorkflowMemoryDefinition[]>([]);
  const [workflowMetadata, setWorkflowMetadata] = useState<JsonObject>({});
  const workflowMetadataRef = useRef<JsonObject>({});
  const [edgeMetadataByTaskPair, setEdgeMetadataByTaskPair] = useState<
    Record<string, WorkflowEdgeDraftMetadata>
  >({});

  useEffect(() => {
    workflowMetadataRef.current = workflowMetadata;
  }, [workflowMetadata]);

  const visibleAgentDefinitions = useMemo(
    () => (isEditing ? agentDefinitions : (workflow?.agent_definitions ?? [])),
    [agentDefinitions, isEditing, workflow?.agent_definitions]
  );
  const visibleTaskDefinitions = useMemo(
    () => (isEditing ? taskDefinitions : (workflow?.task_definitions ?? [])),
    [isEditing, taskDefinitions, workflow?.task_definitions]
  );
  const effectiveEntrypointTaskId = isEditing
    ? entrypoint
    : getEntrypointTaskId(workflow?.entrypoint, workflow?.task_definitions ?? [], workflow?.nodes);
  const invalidEdgeConditionByTaskPair = useMemo(
    () =>
      isEditing
        ? getInvalidEdgeConditionByTaskPair(edgeMetadataByTaskPair, visibleTaskDefinitions)
        : {},
    [edgeMetadataByTaskPair, isEditing, visibleTaskDefinitions]
  );
  const invalidEdgeMetadataByTaskPair = useMemo(
    () =>
      isEditing
        ? getInvalidEdgeMetadataByTaskPair(edgeMetadataByTaskPair, visibleTaskDefinitions)
        : {},
    [edgeMetadataByTaskPair, isEditing, visibleTaskDefinitions]
  );
  const draftValidationIssues = useMemo(
    () =>
      isEditing
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
        : [],
    [
      allowedRuntimeAdapterIds,
      defaultRuntimeAdapterId,
      description,
      edgeMetadataByTaskPair,
      entrypoint,
      isEditing,
      name,
      visibleAgentDefinitions,
      visibleTaskDefinitions,
    ]
  );
  const workflowPreview = useMemo(() => {
    if (!workflow) {
      return null;
    }

    if (!isEditing) {
      return workflow;
    }

    return applyEdgeDraftMetadata(
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
        nodes: workflowNodes,
        tool_definitions: toolDefinitions,
        memory_definitions: memoryDefinitions,
        metadata: {
          ...workflowMetadata,
          execution_host: executionHost,
          restart_active_executions: restartActiveExecutions,
        },
      }),
      edgeMetadataByTaskPair
    );
  }, [
    allowedRuntimeAdapterIds,
    defaultRuntimeAdapterId,
    description,
    edgeMetadataByTaskPair,
    entrypoint,
    executionHost,
    isEditing,
    memoryDefinitions,
    name,
    restartActiveExecutions,
    toolDefinitions,
    visibleAgentDefinitions,
    visibleTaskDefinitions,
    workflow,
    workflowId,
    workflowMetadata,
    workflowNodes,
  ]);
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
      agentDefinitions: comparableAgentDefinitions(agentDefinitions),
      taskDefinitions: comparableTaskDefinitions(taskDefinitions),
      workflowNodes,
      toolDefinitions,
      memoryDefinitions,
      workflowMetadata,
      edgeMetadataByTaskPair,
    }) !==
      stableSerialize({
        name: workflow?.name ?? '',
        description: workflow?.description ?? '',
        entrypoint: getEntrypointTaskId(
          workflow?.entrypoint,
          workflow?.task_definitions ?? [],
          workflow?.nodes
        ),
        executionHost: resolveWorkflowExecutionHost(workflow),
        defaultRuntimeAdapterId: workflow?.default_runtime_adapter_id ?? '',
        allowedRuntimeAdapterIds: workflow?.allowed_runtime_adapter_ids ?? [],
        restartActiveExecutions: resolveRestartActiveExecutions(workflow),
        agentDefinitions: comparableAgentDefinitions(workflow?.agent_definitions ?? []),
        taskDefinitions: comparableTaskDefinitions(workflow?.task_definitions ?? []),
        workflowNodes: workflow?.nodes ?? [],
        toolDefinitions: workflow?.tool_definitions ?? [],
        memoryDefinitions: workflowMemoryDefinitionsFor(workflow),
        workflowMetadata: workflow?.metadata ?? {},
        edgeMetadataByTaskPair: extractEdgeDraftMetadata(workflow),
      });
  const workflowNameInvalid = hasValidationIssue(draftValidationIssues, /workflow name/i);
  const workflowDescriptionInvalid = hasValidationIssue(
    draftValidationIssues,
    /workflow description/i
  );

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
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
    setEntrypoint(
      getEntrypointTaskId(workflow.entrypoint, workflow.task_definitions ?? [], workflow.nodes)
    );
    setExecutionHost(resolveWorkflowExecutionHost(workflow));
    setRestartActiveExecutions(resolveRestartActiveExecutions(workflow));
    const nextAllowedRuntimeAdapterIds = reconcileAllowedRuntimeAdapterIds(
      workflow.allowed_runtime_adapter_ids,
      workflow.default_runtime_adapter_id
    );
    setDefaultRuntimeAdapterId(
      preferredWorkflowRuntimeAdapterId(
        nextAllowedRuntimeAdapterIds,
        workflow.default_runtime_adapter_id
      )
    );
    setAllowedRuntimeAdapterIds(nextAllowedRuntimeAdapterIds);
    setAgentDefinitions(workflow.agent_definitions ?? []);
    setTaskDefinitions(workflow.task_definitions ?? []);
    setWorkflowNodes(workflow.nodes ?? []);
    setToolDefinitions(workflow.tool_definitions ?? []);
    setMemoryDefinitions(workflowMemoryDefinitionsFor(workflow));
    workflowMetadataRef.current = workflow.metadata ?? {};
    setWorkflowMetadata(workflow.metadata ?? {});
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
      current.map((candidate, candidateIndex) =>
        candidateIndex === agentIndex ? { ...candidate, ...updates } : candidate
      )
    );
  };

  const removeAgentDefinition = (agentId: string) => {
    setAgentDefinitions((current) =>
      current
        .filter((agent) => agent.id !== agentId)
        .map((agent) => ({
          ...agent,
          handoff_agent_ids: (agent.handoff_agent_ids ?? []).filter(
            (candidateId) => candidateId !== agentId
          ),
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
      const nextTask = createDraftTaskDefinition(
        current.length,
        readWorkflowCapabilityTags(workflowMetadataRef.current)
      );
      return [...current, nextTask];
    });
  };

  const updateTaskDefinition = (taskIndex: number, updates: Partial<TaskDefinition>) => {
    setTaskDefinitions((current) =>
      current.map((candidate, candidateIndex) =>
        candidateIndex === taskIndex ? { ...candidate, ...updates } : candidate
      )
    );
  };

  const updateToolDefinition = (toolId: string, updates: Partial<ToolDefinition>) => {
    setToolDefinitions((current) =>
      current.map((candidate) =>
        candidate.id === toolId
          ? {
              ...candidate,
              ...updates,
            }
          : candidate
      )
    );
  };

  const upsertToolDefinition = (tool: ToolDefinition) => {
    setToolDefinitions((current) => {
      const existing = current.some((candidate) => candidate.id === tool.id);
      if (!existing) {
        return [...current, tool];
      }
      return current.map((candidate) => (candidate.id === tool.id ? tool : candidate));
    });
  };

  const removeTaskDefinition = (taskId: string) => {
    if (entrypoint === taskId) {
      setEntrypoint('');
    }
    setTaskDefinitions((current) =>
      current
        .filter((task) => task.id !== taskId)
        .map((task) => ({
          ...task,
          depends_on_task_ids: (task.depends_on_task_ids ?? []).filter(
            (candidateId) => candidateId !== taskId
          ),
        }))
    );
    setEdgeMetadataByTaskPair((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([key]) => !key.startsWith(`${taskId}->`) && !key.endsWith(`->${taskId}`)
        )
      )
    );
  };

  const moveTaskDefinition = (fromIndex: number, toIndex: number) => {
    setTaskDefinitions((current) => moveItemInList(current, fromIndex, toIndex));
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

  const applyWorkflowDefinition = (nextWorkflow: WorkflowDefinition) => {
    setName(nextWorkflow.name ?? '');
    setDescription(nextWorkflow.description ?? '');
    setEntrypoint(
      getEntrypointTaskId(
        nextWorkflow.entrypoint,
        nextWorkflow.task_definitions ?? [],
        nextWorkflow.nodes
      )
    );
    setExecutionHost(resolveWorkflowExecutionHost(nextWorkflow));
    setRestartActiveExecutions(resolveRestartActiveExecutions(nextWorkflow));
    const nextAllowedRuntimeAdapterIds = reconcileAllowedRuntimeAdapterIds(
      nextWorkflow.allowed_runtime_adapter_ids,
      nextWorkflow.default_runtime_adapter_id
    );
    setDefaultRuntimeAdapterId(
      preferredWorkflowRuntimeAdapterId(
        nextAllowedRuntimeAdapterIds,
        nextWorkflow.default_runtime_adapter_id
      )
    );
    setAllowedRuntimeAdapterIds(nextAllowedRuntimeAdapterIds);
    setAgentDefinitions(nextWorkflow.agent_definitions ?? []);
    setTaskDefinitions(nextWorkflow.task_definitions ?? []);
    setWorkflowNodes(nextWorkflow.nodes ?? []);
    setToolDefinitions(nextWorkflow.tool_definitions ?? []);
    setMemoryDefinitions(workflowMemoryDefinitionsFor(nextWorkflow));
    workflowMetadataRef.current = nextWorkflow.metadata ?? {};
    setWorkflowMetadata(nextWorkflow.metadata ?? {});
    setEdgeMetadataByTaskPair(extractEdgeDraftMetadata(nextWorkflow));
  };

  const selectDefaultRuntimeAdapter = (nextValue: string) => {
    setDefaultRuntimeAdapterId(nextValue);
    setAllowedRuntimeAdapterIds(nextValue ? [nextValue] : []);
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

  const replaceWorkflowMetadata = (nextMetadata: JsonObject) => {
    // Keep metadata edits on the same draft object so new authoring affordances
    // can extend workflow metadata without introducing parallel editor state.
    workflowMetadataRef.current = nextMetadata;
    setWorkflowMetadata(nextMetadata);
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
      isEditing,
      name,
      restartActiveExecutions,
      taskDefinitions,
      workflowNodes,
      toolDefinitions,
      memoryDefinitions,
      workflowMetadata,
    },
    derived: {
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
      applyWorkflowDefinition,
      moveTaskDefinition,
      removeAgentDefinition,
      removeTaskDefinition,
      resetEditingDraft,
      selectDefaultRuntimeAdapter,
      setDescription,
      setEntrypoint,
      setExecutionHost,
      setIsEditing,
      setName,
      setRestartActiveExecutions,
      setTaskDefinitions,
      startEditing,
      stopEditing,
      toggleAllowedRuntimeAdapter,
      replaceWorkflowMetadata,
      updateAgentDefinition,
      updateEdgeMetadata,
      updateTaskDefinition,
      updateToolDefinition,
      upsertToolDefinition,
    },
  };
}
