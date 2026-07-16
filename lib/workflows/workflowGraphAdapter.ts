import { createGraphDefinition } from '@/modules/react-flow-graph/definition';
import { createGraphEdgeId } from '@/modules/react-flow-graph/ids';
import {
  graphBuiltInToolbarActionIds,
  type GraphBuiltInToolbarActionId,
} from '@/modules/react-flow-graph/GraphCanvas';
import type {
  GraphDocument,
  GraphEdge,
  GraphEdgeTypeDescriptor,
  GraphJsonObject,
  GraphNode,
  GraphNodeTypeDescriptor,
  GraphPosition,
  GraphRuntimeEvent,
  GraphToolbarAction,
  GraphValidationIssue,
} from '@/modules/react-flow-graph/types';
import {
  type AgenticTaskTemplateId,
  createCapabilityStarterTaskDraft,
  createAgenticTaskTemplateDraft,
  workflowTaskStarterTemplate,
} from '@/lib/workflows/capabilityTaskTemplates';
import { normalizeWorkflowAgentGuardrails } from '@/lib/workflows/agentGuardrails';
import {
  normalizeWorkflowTaskInputSources,
  workflowTaskInputSourcesFromMetadata,
  workflowTaskMetadataWithInputSources,
} from '@/lib/workflows/taskInputSources';
import {
  normalizeWorkflowTaskRuntimeOverrides,
  workflowTaskRuntimeOverridePatch,
  workflowTaskRuntimeOverridesFromTask,
} from '@/lib/workflows/taskRuntimeOverrides';
import type { ExecutionEventRecord, WorkflowRun } from '@/types/runtime';
import type { AgentDefinition, BehaviorTuningProfile } from '@/types/agents';
import type { ToolDefinition } from '@/types/tools';
import {
  workflowArtifactDefinitionsFor,
  workflowArtifactDefinitionsMetadataKey,
  workflowMemoryDefinitionsFor,
  type TaskDefinition,
  type WorkflowArtifactDefinition,
  type WorkflowCapabilityTag,
  type WorkflowDefinition,
  type WorkflowEdgeDefinition,
  type WorkflowMemoryDefinition,
  type WorkflowMonitoringEventsResponse,
  type WorkflowNodeDefinition,
} from '@/types/workflows';

export const workflowGraphNodeTypes = {
  agent: 'workflow.agent',
  task: 'workflow.task',
  tool: 'workflow.tool',
  memory: 'workflow.memory',
  artifact: 'workflow.artifact',
  approval: 'workflow.approval',
  router: 'workflow.router',
} as const;

export const workflowGraphEdgeTypes = {
  dependency: 'workflow.dependency',
  dataFlow: 'workflow.data-flow',
  condition: 'workflow.condition',
  assignment: 'workflow.assignment',
  tool: 'workflow.tool',
  memory: 'workflow.memory',
  approval: 'workflow.approval-gate',
  handoff: 'workflow.handoff',
} as const;

export type WorkflowGraphNodeType =
  (typeof workflowGraphNodeTypes)[keyof typeof workflowGraphNodeTypes];

export type WorkflowGraphEdgeType =
  (typeof workflowGraphEdgeTypes)[keyof typeof workflowGraphEdgeTypes];

export interface WorkflowGraphAdapterOptions {
  includeAgents?: boolean;
  includeTools?: boolean;
  includeMemories?: boolean;
  toolDefinitions?: ToolDefinition[];
  modelProfiles?: Pick<BehaviorTuningProfile, 'id' | 'name'>[];
}

export interface WorkflowGraphValidationIssue extends GraphValidationIssue {
  workflowPath?: string;
  workflowReference?: {
    kind: 'agent' | 'task' | 'tool' | 'memory' | 'artifact' | 'edge' | 'workflow';
    id?: string;
  };
}

export interface WorkflowGraphConnectionResult {
  document: GraphDocument;
  issues: WorkflowGraphValidationIssue[];
}

export interface WorkflowResourceValidationOptions {
  toolDefinitions?: ToolDefinition[];
}

const defaultNodeGapX = 680;
const defaultNodeGapY = 320;
const defaultApprovalNodeOffsetX = 620;
const defaultApprovalNodeOffsetY = 12;
const workflowGraphPositionMetadataKey = 'workflow_graph_position';
const workflowGraphApprovalPositionMetadataKey = 'workflow_graph_approval_position';
const workflowGraphToolNodesMetadataKey = 'workflow_graph_tool_nodes';
const workflowToolsAggregateNodeId = workflowGraphNodeId(workflowGraphNodeTypes.tool, '__tools__');
export const workflowGraphToolListSelectionId = '__workflow_tool_list__';

interface WorkflowGraphToolNodeRecord {
  id: string;
  toolIds: string[];
  toolNames?: string[];
  agentId?: string | null;
  position?: GraphPosition;
}

export const workflowGraphActionIds = {
  edit: 'workflow.edit',
  arrange: 'workflow.arrange',
  resetLayout: 'workflow.resetLayout',
  addTask: 'workflow.addTask',
  addTaskTemplate: 'workflow.addTaskTemplate',
  addAgent: 'workflow.addAgent',
  addTool: 'workflow.addTool',
  addMemory: 'workflow.addMemory',
  addArtifact: 'workflow.addArtifact',
  validate: 'workflow.validate',
  save: 'workflow.save',
  run: 'workflow.run',
} as const;

function workflowGraphNodeId(type: WorkflowGraphNodeType, id: string) {
  return `${type.replace(/\./g, '-')}-${id}`;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function graphJsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function graphRecordString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function graphRecordBoolean(record: Record<string, unknown>, key: string) {
  return record[key] === true;
}

function createWorkflowGraphEntityId(prefix: string) {
  const randomId =
    globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 12) ??
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  return `${prefix}-${randomId}`;
}

function workflowGraphNodeData(value: GraphJsonObject): GraphJsonObject {
  return value;
}

function workflowAgentGuardrailsForGraph(value: unknown): GraphJsonObject[] {
  return normalizeWorkflowAgentGuardrails(value).map((guardrail) => ({
    id: guardrail.id,
    name: guardrail.name,
    description: guardrail.description ?? null,
    mode: guardrail.mode ?? 'policy',
    config: toGraphJsonObject(guardrail.config),
  }));
}

function graphPositionFromValue(value: unknown): GraphPosition | undefined {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as { x?: unknown }).x === 'number' &&
    typeof (value as { y?: unknown }).y === 'number'
  ) {
    return {
      x: (value as { x: number }).x,
      y: (value as { y: number }).y,
    };
  }

  return undefined;
}

function graphPositionFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }

  const entries = metadata as Record<string, unknown>;
  return (
    graphPositionFromValue(entries[workflowGraphPositionMetadataKey]) ??
    graphPositionFromValue(entries.workflowGraphPosition)
  );
}

function approvalGraphPositionFromTaskMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }

  const entries = metadata as Record<string, unknown>;
  return graphPositionFromValue(entries[workflowGraphApprovalPositionMetadataKey]);
}

function workflowGraphToolNodeRecordsFor(
  workflow: WorkflowDefinition,
  tools: ToolDefinition[]
): WorkflowGraphToolNodeRecord[] {
  const metadata = toGraphJsonObject(workflow.metadata);
  const storedRecords = metadata[workflowGraphToolNodesMetadataKey];
  const toolById = new Map(tools.map((tool) => [tool.id, tool]));
  const currentAssignmentRecords = workflowGraphToolNodeRecordsFromCurrentAssignments(
    workflow,
    toolById
  );

  if (Array.isArray(storedRecords)) {
    const records = storedRecords.flatMap((record): WorkflowGraphToolNodeRecord[] => {
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        return [];
      }

      const candidate = record as Record<string, unknown>;
      if (typeof candidate.id !== 'string') {
        return [];
      }

      return [
        {
          id: candidate.id,
          toolIds: Array.isArray(candidate.toolIds)
            ? candidate.toolIds.filter((toolId): toolId is string => typeof toolId === 'string')
            : [],
          toolNames: Array.isArray(candidate.toolNames)
            ? candidate.toolNames.filter(
                (toolName): toolName is string => typeof toolName === 'string'
              )
            : undefined,
          agentId: typeof candidate.agentId === 'string' ? candidate.agentId : null,
          position: graphPositionFromValue(candidate.position),
        },
      ];
    });

    // An explicit empty array means the operator removed every tool node. Do not fall back to
    // legacy agent/tool-derived records, or the deleted unlinked tool node reappears after save.
    if (records.length === 0 && currentAssignmentRecords.length === 0) {
      return records;
    }

    return reconcileStoredToolNodeRecordsWithCurrentAssignments(records, currentAssignmentRecords);
  }

  if (currentAssignmentRecords.length > 0) {
    return currentAssignmentRecords;
  }

  const workflowToolIds = (workflow.tool_definitions ?? []).map((tool) => tool.id);
  return workflowToolIds.length > 0
    ? [{ id: 'tools', toolIds: workflowToolIds, position: { x: -defaultNodeGapX, y: 80 } }]
    : [];
}

function workflowGraphToolNodeRecordsFromCurrentAssignments(
  workflow: WorkflowDefinition,
  toolById: Map<string, ToolDefinition>
): WorkflowGraphToolNodeRecord[] {
  const taskToolIdsByAgentId = new Map<string, string[]>();
  for (const task of workflow.task_definitions ?? []) {
    if (!task.agent_id || !task.tool_ids?.length) {
      continue;
    }

    taskToolIdsByAgentId.set(
      task.agent_id,
      uniqueStrings([...(taskToolIdsByAgentId.get(task.agent_id) ?? []), ...task.tool_ids])
    );
  }

  return (workflow.agent_definitions ?? []).flatMap((agent, index) => {
    const toolIds = uniqueStrings([
      ...(agent.tool_ids ?? agent.toolIds ?? []),
      ...(taskToolIdsByAgentId.get(agent.id) ?? []),
    ]);
    if (toolIds.length === 0) {
      return [];
    }

    const firstToolWithPosition = toolIds
      .map((toolId) => toolById.get(toolId))
      .find((tool) => graphPositionFromMetadata(toGraphJsonObject(tool?.metadata)));

    return [
      {
        id: `tools-${agent.id}`,
        toolIds,
        agentId: agent.id,
        position: graphPositionFromMetadata(toGraphJsonObject(firstToolWithPosition?.metadata)) ?? {
          x: -defaultNodeGapX,
          y: 80 + index * defaultNodeGapY,
        },
      },
    ];
  });
}

function reconcileStoredToolNodeRecordsWithCurrentAssignments(
  storedRecords: WorkflowGraphToolNodeRecord[],
  currentAssignmentRecords: WorkflowGraphToolNodeRecord[]
): WorkflowGraphToolNodeRecord[] {
  if (currentAssignmentRecords.length === 0) {
    return storedRecords;
  }

  const nextRecords = [...storedRecords];
  const recordIndexByAgentId = new Map(
    nextRecords
      .map((record, index) => [record.agentId, index] as const)
      .filter((entry): entry is [string, number] => typeof entry[0] === 'string')
  );

  for (const currentRecord of currentAssignmentRecords) {
    if (!currentRecord.agentId) {
      nextRecords.push(currentRecord);
      continue;
    }

    const existingIndex = recordIndexByAgentId.get(currentRecord.agentId);
    if (existingIndex === undefined) {
      nextRecords.push(currentRecord);
      recordIndexByAgentId.set(currentRecord.agentId, nextRecords.length - 1);
      continue;
    }

    const existingRecord = nextRecords[existingIndex];
    const toolIdsChanged =
      existingRecord.toolIds.length !== currentRecord.toolIds.length ||
      existingRecord.toolIds.some((toolId, index) => toolId !== currentRecord.toolIds[index]);
    // Graph metadata preserves layout, but persisted workflow task/agent assignments are the
    // source of truth for which tools should appear after backend-driven revisions.
    nextRecords[existingIndex] = {
      ...existingRecord,
      toolIds: currentRecord.toolIds,
      toolNames: toolIdsChanged ? undefined : existingRecord.toolNames,
    };
  }

  return nextRecords;
}

function workflowMetadataWithToolNodeRecords(
  metadata: unknown,
  records: WorkflowGraphToolNodeRecord[]
): GraphJsonObject | undefined {
  const nextMetadata = toGraphJsonObject(metadata);

  nextMetadata[workflowGraphToolNodesMetadataKey] = records.map((record) => ({
    id: record.id,
    toolIds: record.toolIds,
    ...(record.toolNames?.length ? { toolNames: record.toolNames } : {}),
    agentId: record.agentId ?? null,
    ...(record.position
      ? {
          position: {
            x: record.position.x,
            y: record.position.y,
          },
        }
      : {}),
  }));

  return Object.keys(nextMetadata).length > 0 ? nextMetadata : undefined;
}

function workflowMetadataWithArtifactDefinitions(
  metadata: unknown,
  artifacts: WorkflowArtifactDefinition[]
): GraphJsonObject | undefined {
  const nextMetadata = toGraphJsonObject(metadata);

  if (artifacts.length > 0) {
    nextMetadata[workflowArtifactDefinitionsMetadataKey] = artifacts.map((artifact) => ({
      id: artifact.id,
      name: artifact.name,
      description: artifact.description ?? null,
      artifact_type: artifact.artifact_type ?? null,
      media_type: artifact.media_type ?? null,
      producer_task_id: artifact.producer_task_id ?? null,
      metadata: toGraphJsonObject(artifact.metadata),
    }));
  } else {
    delete nextMetadata[workflowArtifactDefinitionsMetadataKey];
  }

  return Object.keys(nextMetadata).length > 0 ? nextMetadata : undefined;
}

function metadataWithGraphPosition(
  metadata: unknown,
  position: GraphPosition | undefined
): GraphJsonObject | undefined {
  const safeMetadata = toGraphJsonObject(metadata);

  if (!position) {
    return Object.keys(safeMetadata).length > 0 ? safeMetadata : undefined;
  }

  return {
    ...safeMetadata,
    [workflowGraphPositionMetadataKey]: {
      x: position.x,
      y: position.y,
    },
  };
}

function toolDefinitionWithBackendSecurityDefaults(tool: ToolDefinition): ToolDefinition {
  if (tool.tool_type !== 'shell_command') {
    return tool;
  }

  return {
    ...tool,
    security: {
      ...(tool.security ?? {}),
      allow_shell: true,
      sandbox_required: true,
      requires_approval: true,
    },
  };
}

function metadataWithApprovalGraphPosition(
  metadata: unknown,
  position: GraphPosition | undefined
): GraphJsonObject | undefined {
  const safeMetadata = toGraphJsonObject(metadata);

  if (!position) {
    delete safeMetadata[workflowGraphApprovalPositionMetadataKey];
    return Object.keys(safeMetadata).length > 0 ? safeMetadata : undefined;
  }

  return {
    ...safeMetadata,
    [workflowGraphApprovalPositionMetadataKey]: {
      x: position.x,
      y: position.y,
    },
  };
}

function toGraphJsonObject(value: unknown): GraphJsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce<GraphJsonObject>((metadata, [key, entry]) => {
    if (entry === undefined) {
      return metadata;
    }

    if (entry === null || ['string', 'number', 'boolean'].includes(typeof entry)) {
      metadata[key] = entry;
      return metadata;
    }

    if (Array.isArray(entry)) {
      metadata[key] = entry.filter((item) => item !== undefined) as GraphJsonObject[string];
      return metadata;
    }

    metadata[key] = toGraphJsonObject(entry);
    return metadata;
  }, {});
}

function workflowRuntimeStatus(status: string | null | undefined) {
  if (!status) {
    return undefined;
  }

  const normalizedStatus = status.toLowerCase();

  if (
    ['completed', 'succeeded', 'success'].includes(normalizedStatus) ||
    normalizedStatus.endsWith('.completed') ||
    normalizedStatus.endsWith('.succeeded') ||
    normalizedStatus.endsWith('.success')
  ) {
    return 'succeeded';
  }

  if (
    ['failed', 'error', 'cancelled', 'canceled'].includes(normalizedStatus) ||
    normalizedStatus.endsWith('.failed') ||
    normalizedStatus.endsWith('.error') ||
    normalizedStatus.endsWith('.cancelled') ||
    normalizedStatus.endsWith('.canceled')
  ) {
    return 'failed';
  }

  if (
    ['skipped', 'skip'].includes(normalizedStatus) ||
    normalizedStatus.endsWith('.skipped') ||
    normalizedStatus.endsWith('.skip')
  ) {
    return 'skipped';
  }

  if (
    ['pending', 'queued'].includes(normalizedStatus) ||
    normalizedStatus.endsWith('.created') ||
    normalizedStatus.endsWith('.scheduled') ||
    normalizedStatus.endsWith('.pending') ||
    normalizedStatus.endsWith('.queued')
  ) {
    return 'queued';
  }

  if (
    normalizedStatus === 'waiting_for_approval' ||
    normalizedStatus.endsWith('.waiting_for_approval') ||
    normalizedStatus.endsWith('.waiting')
  ) {
    return 'waiting';
  }

  if (
    ['running', 'started', 'start'].includes(normalizedStatus) ||
    normalizedStatus.includes('.message.') ||
    normalizedStatus.endsWith('.requested') ||
    normalizedStatus.endsWith('.running') ||
    normalizedStatus.endsWith('.started') ||
    normalizedStatus.endsWith('.start')
  ) {
    return 'running';
  }

  return status;
}

function workflowRuntimeEdgeStatus(status: string | undefined) {
  if (!status) {
    return undefined;
  }

  if (status === 'running' || status === 'queued') {
    return 'transmitting';
  }

  if (status === 'waiting' || status === 'blocked') {
    return 'blocked';
  }

  if (status === 'succeeded' || status === 'completed') {
    return 'completed';
  }

  if (status === 'failed') {
    return 'failed';
  }

  if (status === 'skipped') {
    return 'inactive';
  }

  return undefined;
}

function workflowRuntimeEventIsToolActivity(event: GraphRuntimeEvent) {
  const normalizedType = event.type.replace(/_/g, '.').toLowerCase();
  return normalizedType.startsWith('tool.call.') || normalizedType.startsWith('tool.');
}

function workflowRuntimeEventIsMemoryActivity(event: GraphRuntimeEvent) {
  const normalizedType = event.type.replace(/_/g, '.').toLowerCase();
  return (
    normalizedType.startsWith('memory.') ||
    normalizedType.startsWith('context.') ||
    graphRuntimeEventMemoryIds(event).length > 0
  );
}

function graphJsonString(value: unknown, key: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const entry = (value as Record<string, unknown>)[key];
  return typeof entry === 'string' ? entry : null;
}

function graphJsonStringArray(value: unknown, key: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  const entry = (value as Record<string, unknown>)[key];
  if (typeof entry === 'string') {
    return [entry];
  }

  if (Array.isArray(entry)) {
    return entry.filter((item): item is string => typeof item === 'string');
  }

  return [];
}

function graphRuntimeEventString(event: GraphRuntimeEvent, key: string) {
  return graphJsonString(event.payload, key) ?? graphJsonString(event.metadata, key);
}

function graphRuntimeEventStringArray(event: GraphRuntimeEvent, key: string) {
  const payloadValues = graphJsonStringArray(event.payload, key);
  const metadataValues = graphJsonStringArray(event.metadata, key);
  return uniqueStrings([...payloadValues, ...metadataValues]);
}

function graphRuntimeEventToolId(event: GraphRuntimeEvent) {
  const evidence = graphJsonObject(event.payload, 'evidence');
  return (
    graphRuntimeEventString(event, 'tool_id') ??
    graphRuntimeEventString(event, 'toolId') ??
    graphRuntimeEventString(event, 'tool') ??
    graphJsonString(evidence, 'tool_id') ??
    graphJsonString(evidence, 'toolId') ??
    graphJsonString(evidence, 'tool')
  );
}

function graphRuntimeEventMemoryIds(event: GraphRuntimeEvent) {
  const evidence = graphJsonObject(event.payload, 'evidence');
  return uniqueStrings([
    ...(graphRuntimeEventString(event, 'memory_id')
      ? [graphRuntimeEventString(event, 'memory_id') as string]
      : []),
    ...(graphRuntimeEventString(event, 'memoryId')
      ? [graphRuntimeEventString(event, 'memoryId') as string]
      : []),
    ...graphRuntimeEventStringArray(event, 'memory_ids'),
    ...graphRuntimeEventStringArray(event, 'memoryIds'),
    ...(graphJsonString(evidence, 'memory_id')
      ? [graphJsonString(evidence, 'memory_id') as string]
      : []),
    ...(graphJsonString(evidence, 'memoryId')
      ? [graphJsonString(evidence, 'memoryId') as string]
      : []),
    ...graphJsonStringArray(evidence, 'memory_ids'),
    ...graphJsonStringArray(evidence, 'memoryIds'),
  ]);
}

function graphJsonObject(value: unknown, key: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const entry = (value as Record<string, unknown>)[key];
  return entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : null;
}

function executionEventRuntimeReference(event: ExecutionEventRecord) {
  const evidence = graphJsonObject(event.payload, 'evidence');
  const agentId =
    event.agent_id ??
    graphJsonString(event.payload, 'agent_id') ??
    graphJsonString(event.payload, 'agentId') ??
    graphJsonString(evidence, 'agent_id') ??
    graphJsonString(evidence, 'agentId') ??
    graphJsonString(event.metadata, 'agent_id') ??
    graphJsonString(event.metadata, 'agentId');
  const taskId =
    event.task_id ??
    graphJsonString(event.payload, 'task_id') ??
    graphJsonString(event.payload, 'taskId') ??
    graphJsonString(evidence, 'task_id') ??
    graphJsonString(evidence, 'taskId') ??
    graphJsonString(event.metadata, 'task_id') ??
    graphJsonString(event.metadata, 'taskId');
  const currentNodeId =
    graphJsonString(event.payload, 'currentNodeId') ??
    graphJsonString(event.payload, 'current_node_id') ??
    graphJsonString(evidence, 'currentNodeId') ??
    graphJsonString(evidence, 'current_node_id') ??
    graphJsonString(event.metadata, 'currentNodeId') ??
    graphJsonString(event.metadata, 'current_node_id');

  return {
    task_id: taskId,
    agent_id: agentId,
    currentNodeId,
  };
}

function graphEdgeIdFromRuntimeReference(
  event: ExecutionEventRecord,
  workflow: WorkflowDefinition | undefined
) {
  if (!workflow) {
    return undefined;
  }

  const explicitEdgeId =
    graphJsonString(event.payload, 'edgeId') ??
    graphJsonString(event.payload, 'edge_id') ??
    graphJsonString(event.payload, 'handoffId') ??
    graphJsonString(event.payload, 'handoff_id') ??
    graphJsonString(event.metadata, 'edgeId') ??
    graphJsonString(event.metadata, 'edge_id');
  const explicitWorkflowEdge = explicitEdgeId
    ? workflow.edges?.find((edge) => edge.id === explicitEdgeId)
    : undefined;
  if (explicitWorkflowEdge) {
    const sourceTaskId = workflowTaskIdForNodeId(workflow, explicitWorkflowEdge.source_node_id);
    const targetTaskId = workflowTaskIdForNodeId(workflow, explicitWorkflowEdge.target_node_id);

    return sourceTaskId && targetTaskId
      ? graphTaskFlowEdgeId(workflow, sourceTaskId, targetTaskId)
      : undefined;
  }

  const sourceTaskId =
    graphJsonString(event.payload, 'sourceTaskId') ??
    graphJsonString(event.payload, 'source_task_id') ??
    graphJsonString(event.metadata, 'sourceTaskId') ??
    graphJsonString(event.metadata, 'source_task_id');
  const targetTaskId =
    graphJsonString(event.payload, 'targetTaskId') ??
    graphJsonString(event.payload, 'target_task_id') ??
    graphJsonString(event.metadata, 'targetTaskId') ??
    graphJsonString(event.metadata, 'target_task_id') ??
    event.task_id ??
    null;

  if (!sourceTaskId || !targetTaskId || sourceTaskId === targetTaskId) {
    return undefined;
  }

  return graphTaskFlowEdgeId(workflow, sourceTaskId, targetTaskId);
}

function graphNodeIdFromRuntimeReference(reference: {
  task_id?: string | null;
  agent_id?: string | null;
  currentNodeId?: string | null;
}) {
  if (reference.task_id) {
    return workflowGraphNodeId(workflowGraphNodeTypes.task, reference.task_id);
  }

  if (reference.agent_id) {
    return workflowGraphNodeId(workflowGraphNodeTypes.agent, reference.agent_id);
  }

  if (reference.currentNodeId?.startsWith('node-')) {
    return workflowGraphNodeId(
      workflowGraphNodeTypes.task,
      reference.currentNodeId.slice('node-'.length)
    );
  }

  return reference.currentNodeId ?? undefined;
}

function graphAssignmentEdgeId(agentId: string, taskId: string) {
  return createGraphEdgeId({
    source: workflowGraphNodeId(workflowGraphNodeTypes.agent, agentId),
    target: workflowGraphNodeId(workflowGraphNodeTypes.task, taskId),
    type: workflowGraphEdgeTypes.assignment,
  });
}

function graphToolAccessEdgeId(
  workflow: WorkflowDefinition,
  agentId: string | null | undefined,
  toolId: string | null | undefined
) {
  if (!agentId) {
    return undefined;
  }

  const workflowTools = workflow.tool_definitions ?? [];
  const records = workflowGraphToolNodeRecordsFor(workflow, workflowTools);
  const matchingRecords = records.filter((record) => {
    if (record.agentId !== agentId) {
      return false;
    }

    return toolId ? record.toolIds.includes(toolId) : true;
  });
  const record = matchingRecords[0] ?? null;

  if (!record) {
    return undefined;
  }

  return createGraphEdgeId({
    source: workflowGraphNodeId(workflowGraphNodeTypes.tool, record.id),
    target: workflowGraphNodeId(workflowGraphNodeTypes.agent, agentId),
    type: workflowGraphEdgeTypes.tool,
  });
}

function graphTaskFlowEdgeId(
  workflow: WorkflowDefinition,
  sourceTaskId: string,
  targetTaskId: string
) {
  const existingEdge = edgeMetadataForTaskPair(workflow, sourceTaskId, targetTaskId);
  const graphEdgeType = graphEdgeTypeForWorkflowEdge(existingEdge);
  if (
    existingEdge &&
    graphEdgeType !== workflowGraphEdgeTypes.dependency &&
    graphEdgeType !== workflowGraphEdgeTypes.handoff
  ) {
    return createGraphEdgeId({
      source: workflowGraphNodeId(workflowGraphNodeTypes.task, sourceTaskId),
      target: workflowGraphNodeId(workflowGraphNodeTypes.router, existingEdge.id),
      type: graphEdgeType,
    });
  }

  return createGraphEdgeId({
    source: workflowGraphNodeId(workflowGraphNodeTypes.task, sourceTaskId),
    target: workflowGraphNodeId(workflowGraphNodeTypes.task, targetTaskId),
    type: graphEdgeType,
  });
}

function taskFromRuntimeReference(
  workflow: WorkflowDefinition | undefined,
  reference: {
    task_id?: string | null;
    currentNodeId?: string | null;
  }
) {
  if (!workflow) {
    return undefined;
  }

  if (reference.task_id) {
    return workflow.task_definitions?.find((task) => task.id === reference.task_id);
  }

  if (!reference.currentNodeId) {
    return undefined;
  }

  const workflowNode = workflow.nodes?.find((node) => node.id === reference.currentNodeId);
  if (workflowNode?.task_id) {
    return workflow.task_definitions?.find((task) => task.id === workflowNode.task_id);
  }

  const taskId = reference.currentNodeId.startsWith('node-')
    ? reference.currentNodeId.slice('node-'.length)
    : reference.currentNodeId;

  return workflow.task_definitions?.find((task) => task.id === taskId);
}

function relatedWorkflowRuntimeEvents(
  event: GraphRuntimeEvent,
  workflow: WorkflowDefinition | undefined,
  reference: {
    task_id?: string | null;
    currentNodeId?: string | null;
  }
) {
  const task = taskFromRuntimeReference(workflow, reference);
  const events: GraphRuntimeEvent[] = [];

  if (!task) {
    return events;
  }

  const edgeStatus = workflowRuntimeEdgeStatus(event.status);
  const isToolActivity = workflowRuntimeEventIsToolActivity(event);
  const toolId = graphRuntimeEventToolId(event);
  const memoryIds = graphRuntimeEventMemoryIds(event).filter((memoryId) =>
    (task.memory_ids ?? []).includes(memoryId)
  );

  if (task.agent_id) {
    events.push({
      ...event,
      id: `${event.id}-agent-${task.agent_id}`,
      type: event.type.replace(/^run\./, 'agent.'),
      nodeId: workflowGraphNodeId(workflowGraphNodeTypes.agent, task.agent_id),
      edgeId: undefined,
      metadata: {
        ...(event.metadata ?? {}),
        source: 'workflowRuntimeProjection',
        projectedFromEventId: event.id,
        projectedRole: 'assignedAgent',
      },
    });

    if (edgeStatus) {
      events.push({
        ...event,
        id: `${event.id}-assignment-edge-${task.agent_id}-${task.id}`,
        type: event.type.replace(/^run\./, 'assignment.'),
        nodeId: undefined,
        edgeId: graphAssignmentEdgeId(task.agent_id, task.id),
        status: edgeStatus,
        metadata: {
          ...(event.metadata ?? {}),
          source: 'workflowRuntimeProjection',
          projectedFromEventId: event.id,
          projectedRole: 'assignmentEdge',
        },
      });
    }

    if (edgeStatus && workflow && isToolActivity) {
      const toolEdgeId = graphToolAccessEdgeId(workflow, task.agent_id, toolId);
      if (toolEdgeId) {
        events.push({
          ...event,
          id: `${event.id}-tool-edge-${task.agent_id}-${toolId ?? 'active'}`,
          type: event.type.replace(/^run\./, 'tool.'),
          nodeId: undefined,
          edgeId: toolEdgeId,
          status: edgeStatus,
          metadata: {
            ...(event.metadata ?? {}),
            source: 'workflowRuntimeProjection',
            projectedFromEventId: event.id,
            projectedRole: 'toolEdge',
            toolId: toolId ?? null,
          },
        });
      }
    }
  }

  if (edgeStatus && workflow && !isToolActivity) {
    for (const dependencyTaskId of task.depends_on_task_ids ?? []) {
      if (dependencyTaskId === task.id) {
        continue;
      }

      events.push({
        ...event,
        id: `${event.id}-dependency-edge-${dependencyTaskId}-${task.id}`,
        type: event.type.replace(/^run\./, 'dependency.'),
        nodeId: undefined,
        edgeId: graphTaskFlowEdgeId(workflow, dependencyTaskId, task.id),
        status: edgeStatus,
        metadata: {
          ...(event.metadata ?? {}),
          source: 'workflowRuntimeProjection',
          projectedFromEventId: event.id,
          projectedRole: 'dependencyEdge',
          sourceTaskId: dependencyTaskId,
          targetTaskId: task.id,
        },
      });
    }

    if (event.status === 'succeeded' || event.status === 'completed') {
      for (const dependentTask of workflow.task_definitions ?? []) {
        if (!(dependentTask.depends_on_task_ids ?? []).includes(task.id)) {
          continue;
        }

        if (dependentTask.id === task.id) {
          continue;
        }

        events.push({
          ...event,
          id: `${event.id}-downstream-edge-${task.id}-${dependentTask.id}`,
          type: event.type.replace(/^run\./, 'dependency.'),
          nodeId: undefined,
          edgeId: graphTaskFlowEdgeId(workflow, task.id, dependentTask.id),
          status: 'transmitting',
          metadata: {
            ...(event.metadata ?? {}),
            source: 'workflowRuntimeProjection',
            projectedFromEventId: event.id,
            projectedRole: 'downstreamEdge',
            sourceTaskId: task.id,
            targetTaskId: dependentTask.id,
          },
        });
      }
    }
  }

  if (event.status === 'waiting' && task.human_approval_required) {
    events.push({
      ...event,
      id: `${event.id}-approval-${task.id}`,
      type: event.type.replace(/^run\./, 'approval.'),
      nodeId: workflowGraphNodeId(workflowGraphNodeTypes.approval, task.id),
      edgeId: undefined,
      metadata: {
        ...(event.metadata ?? {}),
        source: 'workflowRuntimeProjection',
        projectedFromEventId: event.id,
        projectedRole: 'approvalGate',
      },
    });
  }

  if (edgeStatus && workflow && workflowRuntimeEventIsMemoryActivity(event)) {
    for (const memoryId of memoryIds) {
      events.push({
        ...event,
        id: `${event.id}-memory-edge-${memoryId}-${task.id}`,
        type: event.type.replace(/^run\./, 'memory.'),
        nodeId: undefined,
        edgeId: createGraphEdgeId({
          source: workflowGraphNodeId(workflowGraphNodeTypes.memory, memoryId),
          target: workflowGraphNodeId(workflowGraphNodeTypes.task, task.id),
          type: workflowGraphEdgeTypes.memory,
        }),
        status: edgeStatus,
        metadata: {
          ...(event.metadata ?? {}),
          source: 'workflowRuntimeProjection',
          projectedFromEventId: event.id,
          projectedRole: 'memoryEdge',
          memoryId,
          taskId: task.id,
        },
      });
    }
  }

  return events;
}

function positionForTask(task: TaskDefinition, workflow: WorkflowDefinition, index: number) {
  const node = workflow.nodes?.find((candidate) => candidate.task_id === task.id);
  const position = node?.metadata?.position;
  if (
    position &&
    typeof position === 'object' &&
    !Array.isArray(position) &&
    typeof position.x === 'number' &&
    typeof position.y === 'number'
  ) {
    return { x: position.x, y: position.y };
  }

  return {
    x: defaultNodeGapX,
    y: 80 + index * defaultNodeGapY,
  };
}

function createAgentNode(
  agent: AgentDefinition,
  index: number,
  modelProfileNameById = new Map<string, string>()
): GraphNode {
  const modelProfileName = agent.model_profile_id
    ? modelProfileNameById.get(agent.model_profile_id)
    : null;
  const metadataPersonaSlug = agent.metadata?.persona_slug;
  const generatedFromPersonaFactory = agent.metadata?.generated_from_persona_factory === true;
  const personaSlug =
    typeof metadataPersonaSlug === 'string' && metadataPersonaSlug.trim()
      ? metadataPersonaSlug.trim()
      : generatedFromPersonaFactory
        ? agent.name
        : null;
  const metadataPersonaVersionId = agent.metadata?.persona_version_id;
  const personaVersionId =
    typeof metadataPersonaVersionId === 'string' && metadataPersonaVersionId.trim()
      ? metadataPersonaVersionId.trim()
      : null;

  return {
    id: workflowGraphNodeId(workflowGraphNodeTypes.agent, agent.id),
    type: workflowGraphNodeTypes.agent,
    label: agent.name || agent.id,
    description: agent.description ?? undefined,
    position: graphPositionFromMetadata(agent.metadata) ?? {
      x: 0,
      y: 80 + index * defaultNodeGapY,
    },
    data: workflowGraphNodeData({
      agentId: agent.id,
      instructions: agent.instructions ?? null,
      systemPrompt: agent.system_prompt ?? null,
      backstory: agent.backstory ?? null,
      role: agent.role ?? null,
      modelProfileId: agent.model_profile_id ?? null,
      modelProfileName: modelProfileName ?? null,
      toolIds: agent.tool_ids ?? agent.toolIds ?? [],
      memoryIds: agent.memory_ids ?? agent.memoryIds ?? [],
      handoffAgentIds: agent.handoff_agent_ids ?? agent.handoffAgentIds ?? [],
      guardrails: workflowAgentGuardrailsForGraph(agent.guardrails),
      personaSlug,
      personaVersionStatus: personaSlug ? 'current' : null,
      personaVersionId,
    }),
    metadata: {
      source: 'workflowGraphAdapter',
    },
  };
}

function taskDependencySummary(task: TaskDefinition, workflow: WorkflowDefinition) {
  const dependencyIds = (task.depends_on_task_ids ?? []).filter(
    (dependencyId) => dependencyId !== task.id
  );
  const dependencyMetadata = dependencyIds
    .map((dependencyId) => edgeMetadataForTaskPair(workflow, dependencyId, task.id))
    .filter((edge): edge is WorkflowEdgeDefinition => Boolean(edge));
  const routeCount = (edgeType: string) =>
    dependencyMetadata.filter((edge) => edge.edge_type === edgeType).length;
  const conditionalCount = dependencyMetadata.filter(
    (edge) => edge.edge_type === 'conditional' || Boolean(edge.condition)
  ).length;
  const downstreamCount = (workflow.task_definitions ?? []).filter((candidate) =>
    (candidate.depends_on_task_ids ?? []).includes(task.id)
  ).length;

  return {
    dependencyCount: dependencyIds.length,
    conditionalDependencyCount: conditionalCount,
    successDependencyCount: routeCount('success'),
    failureDependencyCount: routeCount('failure'),
    downstreamCount,
  };
}

function createTaskNode(
  task: TaskDefinition,
  workflow: WorkflowDefinition,
  index: number
): GraphNode {
  const dependencySummary = taskDependencySummary(task, workflow);
  const assignedAgent = task.agent_id
    ? (workflow.agent_definitions ?? []).find((agent) => agent.id === task.agent_id)
    : undefined;
  const taskMetadata = toGraphJsonObject(task.metadata);
  const taskRuntimeOverrides = toGraphJsonObject(workflowTaskRuntimeOverridesFromTask(task));

  return {
    id: workflowGraphNodeId(workflowGraphNodeTypes.task, task.id),
    type: workflowGraphNodeTypes.task,
    label: task.name || task.id,
    description: task.description || undefined,
    position: positionForTask(task, workflow, index),
    data: workflowGraphNodeData({
      taskId: task.id,
      agentId: task.agent_id ?? null,
      agentName: assignedAgent?.name ?? null,
      expectedOutput: task.expected_output ?? null,
      instructions: task.instructions ?? null,
      toolIds: task.tool_ids ?? [],
      memoryIds: task.memory_ids ?? [],
      taskTemplateId:
        typeof taskMetadata.task_template_id === 'string' ? taskMetadata.task_template_id : null,
      taskTemplateLabel:
        typeof taskMetadata.task_template_label === 'string'
          ? taskMetadata.task_template_label
          : null,
      taskInputSources: workflowTaskInputSourcesFromMetadata(taskMetadata),
      taskRuntimeOverrides,
      humanApprovalRequired: Boolean(task.human_approval_required),
      ...dependencySummary,
    }),
    metadata: {
      source: 'workflowGraphAdapter',
    },
  };
}

export function createWorkflowGraphDraftAgentDefinition(index: number): AgentDefinition {
  return {
    id: createWorkflowGraphEntityId('agent'),
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
    guardrails: [],
    metadata: {
      created_from: 'workflow-graph-editor',
    },
  };
}

export function createWorkflowGraphDraftTaskDefinition(
  index: number,
  workflowCapabilityTags: WorkflowCapabilityTag[] = [],
  templateId?: AgenticTaskTemplateId
): TaskDefinition {
  return {
    id: createWorkflowGraphEntityId('task'),
    name: `Task ${index + 1}`,
    description: '',
    instructions: '',
    expected_output: '',
    agent_id: null,
    tool_ids: [],
    memory_ids: [],
    depends_on_task_ids: [],
    human_approval_required: false,
    ...createCapabilityStarterTaskDraft(workflowCapabilityTags, index),
    ...(templateId ? createAgenticTaskTemplateDraft(templateId, index) : {}),
  };
}

export function createWorkflowGraphDraftToolDefinition(index: number): ToolDefinition {
  const id = createWorkflowGraphEntityId('tool');

  return {
    id,
    name: `tool.${index + 1}`,
    display_name: `Tool ${index + 1}`,
    description: '',
    tool_type: 'workflow',
    input_schema: {},
    output_schema: {},
    implementation: {},
    metadata: {
      created_from: 'workflow-graph-editor',
    },
  };
}

export function createWorkflowGraphDraftMemoryDefinition(index: number): WorkflowMemoryDefinition {
  const id = createWorkflowGraphEntityId('memory');

  return {
    id,
    name: `Memory ${index + 1}`,
    description: '',
    memory_type: 'workflow',
    scope: 'workflow',
    metadata: {
      created_from: 'workflow-graph-editor',
    },
  };
}

export function createWorkflowGraphDraftArtifactDefinition(
  index: number
): WorkflowArtifactDefinition {
  const id = createWorkflowGraphEntityId('artifact');

  return {
    id,
    name: `Artifact ${index + 1}`,
    description: '',
    artifact_type: 'output',
    media_type: null,
    producer_task_id: null,
    metadata: {
      created_from: 'workflow-graph-editor',
    },
  };
}

function createApprovalNode(
  task: TaskDefinition,
  workflow: WorkflowDefinition,
  index: number
): GraphNode {
  const taskPosition = positionForTask(task, workflow, index);

  return {
    id: workflowGraphNodeId(workflowGraphNodeTypes.approval, task.id),
    type: workflowGraphNodeTypes.approval,
    label: 'Approval required',
    description: `Human approval gate for ${task.name || task.id}.`,
    // Approval is a derived task gate, so its freeform layout belongs to task metadata.
    position: approvalGraphPositionFromTaskMetadata(task.metadata) ?? {
      x: taskPosition.x + defaultApprovalNodeOffsetX,
      y: taskPosition.y + defaultApprovalNodeOffsetY,
    },
    data: workflowGraphNodeData({
      taskId: task.id,
      taskName: task.name || task.id,
      approvalRequired: true,
    }),
    metadata: {
      source: 'workflowGraphAdapter',
      derivedFrom: workflowGraphNodeId(workflowGraphNodeTypes.task, task.id),
    },
  };
}

function toolDefinitionRequiresApproval(tool: ToolDefinition) {
  const security = graphJsonRecord(tool.security);
  return (
    security.requires_approval === true ||
    security.approval_required === true ||
    security.requiresApproval === true ||
    security.require_approval === true
  );
}

function graphRecordsFirstString(records: Record<string, unknown>[], keys: string[]) {
  for (const record of records) {
    for (const key of keys) {
      const value = graphRecordString(record, key);
      if (value) {
        return value;
      }
    }
  }

  return null;
}

function toolDefinitionConnectorProvider(tool: ToolDefinition) {
  const implementation = graphJsonRecord(tool.implementation);
  const frameworkHints = graphJsonRecord(tool.framework_hints);
  const implementationConfig = graphJsonRecord(implementation.config);
  const frameworkConfig = graphJsonRecord(frameworkHints.config);

  return (
    graphRecordString(implementation, 'provider') ??
    graphRecordString(implementation, 'provider_key') ??
    graphRecordString(implementation, 'connector') ??
    graphRecordString(implementation, 'connector_provider') ??
    graphRecordString(implementationConfig, 'provider') ??
    graphRecordString(implementationConfig, 'provider_key') ??
    graphRecordString(frameworkHints, 'provider') ??
    graphRecordString(frameworkHints, 'provider_key') ??
    graphRecordString(frameworkHints, 'connector') ??
    graphRecordString(frameworkConfig, 'provider') ??
    graphRecordString(frameworkConfig, 'provider_key')
  );
}

function toolDefinitionHealthCue(tool: ToolDefinition) {
  const toolRecord = graphJsonRecord(tool);
  const security = graphJsonRecord(tool.security);
  const implementation = graphJsonRecord(tool.implementation);
  const implementationConfig = graphJsonRecord(implementation.config);
  const frameworkHints = graphJsonRecord(tool.framework_hints);
  const frameworkConfig = graphJsonRecord(frameworkHints.config);
  const health =
    graphRecordsFirstString(
      [toolRecord, security, implementation, implementationConfig, frameworkHints, frameworkConfig],
      ['health_status', 'connector_health_status', 'tool_health_status']
    ) ??
    (graphRecordBoolean(security, 'healthy') ||
    graphRecordBoolean(implementation, 'healthy') ||
    graphRecordBoolean(implementationConfig, 'healthy')
      ? 'healthy'
      : null);

  return health ? `Health: ${health.replace(/_/g, ' ')}` : null;
}

function toolDefinitionCredentialCue(tool: ToolDefinition) {
  const implementation = graphJsonRecord(tool.implementation);
  const frameworkHints = graphJsonRecord(tool.framework_hints);
  const security = graphJsonRecord(tool.security);

  const configuredCredential =
    graphRecordString(implementation, 'credential_id') ??
    graphRecordString(implementation, 'credentialId') ??
    graphRecordString(frameworkHints, 'credential_id') ??
    graphRecordString(frameworkHints, 'credentialId');
  if (configuredCredential) {
    return 'Credential configured';
  }

  if (
    security.requires_credentials === true ||
    security.requiresCredentials === true ||
    security.requires_auth === true ||
    security.requiresAuth === true ||
    tool.tags?.includes('connector')
  ) {
    return 'Credential needed';
  }

  return null;
}

function toolDefinitionAuthCue(tool: ToolDefinition) {
  const security = graphJsonRecord(tool.security);
  const implementation = graphJsonRecord(tool.implementation);
  const frameworkHints = graphJsonRecord(tool.framework_hints);
  const implementationConfig = graphJsonRecord(implementation.config);
  const frameworkConfig = graphJsonRecord(frameworkHints.config);
  const authStatus = graphRecordsFirstString(
    [security, implementation, implementationConfig, frameworkHints, frameworkConfig],
    ['auth_status', 'authentication_status', 'credential_status']
  );

  if (authStatus) {
    return `Auth: ${authStatus.replace(/_/g, ' ')}`;
  }

  if (
    graphRecordBoolean(security, 'requires_credentials') ||
    graphRecordBoolean(security, 'requiresCredentials') ||
    graphRecordBoolean(security, 'requires_auth') ||
    graphRecordBoolean(security, 'requiresAuth') ||
    graphJsonStringArray(security, 'credential_references').length > 0 ||
    graphJsonStringArray(security, 'secret_references').length > 0
  ) {
    return 'Auth: required';
  }

  return null;
}

function toolDefinitionPermissionCues(tool: ToolDefinition) {
  const security = graphJsonRecord(tool.security);
  const permissions = [
    graphRecordBoolean(security, 'dangerous') ? 'dangerous' : null,
    graphRecordBoolean(security, 'allow_shell') || graphRecordBoolean(security, 'allowShell')
      ? 'shell'
      : null,
    graphRecordBoolean(security, 'allow_browser') || graphRecordBoolean(security, 'allowBrowser')
      ? 'browser'
      : null,
    graphRecordBoolean(security, 'allow_filesystem') ||
    graphRecordBoolean(security, 'allowFilesystem')
      ? 'filesystem'
      : null,
    graphRecordBoolean(security, 'allow_network') || graphRecordBoolean(security, 'allowNetwork')
      ? 'network'
      : null,
    graphRecordBoolean(security, 'sandbox_required') || graphRecordBoolean(security, 'sandbox')
      ? 'sandboxed'
      : null,
    graphRecordBoolean(security, 'read_only') || graphRecordBoolean(security, 'readOnly')
      ? 'read only'
      : null,
    graphRecordBoolean(security, 'read_only_sql') || graphRecordBoolean(security, 'readOnlySql')
      ? 'read-only SQL'
      : null,
  ].filter((permission): permission is string => Boolean(permission));

  const scopedCounts = [
    graphJsonStringArray(security, 'allowlisted_domains').length +
      graphJsonStringArray(security, 'allowed_domains').length,
    graphJsonStringArray(security, 'allowed_paths').length,
    graphJsonStringArray(security, 'allowlisted_mcp_servers').length,
  ].reduce((total, count) => total + count, 0);
  const visiblePermissions = uniqueStrings(permissions).slice(0, 3);
  const cues: string[] = [];

  if (visiblePermissions.length > 0) {
    cues.push(`Permissions: ${visiblePermissions.join(', ')}`);
  }

  if (scopedCounts > 0) {
    cues.push(`Scoped access: ${scopedCounts}`);
  }

  return cues;
}

function toolDefinitionSourceCue(tool: ToolDefinition) {
  const toolType = tool.tool_type?.trim();
  if (tool.tags?.includes('mcp') || toolType === 'mcp') {
    return 'MCP tool';
  }

  if (tool.tags?.includes('connector')) {
    return 'Connector tool';
  }

  if (toolType === 'native' || toolType === 'local') {
    return 'Local runtime tool';
  }

  if (toolType === 'workflow') {
    return 'Workflow tool';
  }

  return toolType ? `${toolType.replace(/_/g, ' ')} tool` : null;
}

function toolDefinitionCues(tool: ToolDefinition) {
  const provider = toolDefinitionConnectorProvider(tool);
  return [
    toolDefinitionSourceCue(tool),
    provider ? `Provider: ${provider}` : null,
    toolDefinitionHealthCue(tool),
    toolDefinitionCredentialCue(tool),
    toolDefinitionAuthCue(tool),
    toolDefinitionRequiresApproval(tool) ? 'Approval required' : null,
    ...toolDefinitionPermissionCues(tool),
  ].filter((cue): cue is string => Boolean(cue));
}

function createToolListNode(
  record: WorkflowGraphToolNodeRecord,
  toolById: Map<string, ToolDefinition>,
  workflowToolById: Map<string, ToolDefinition>,
  index: number
): GraphNode {
  const toolIds = uniqueStrings(record.toolIds);
  const workflowOwnedTools = toolIds
    .map((toolId) => workflowToolById.get(toolId))
    .filter(Boolean) as ToolDefinition[];
  const storedToolNames = record.toolNames ?? [];
  const toolNames = toolIds.map((toolId, index) => {
    const tool = toolById.get(toolId);
    const resolvedToolName = tool?.display_name || tool?.name || toolId;
    const storedToolName = storedToolNames[index]?.trim();
    if (storedToolName && (storedToolName !== 'Tools' || resolvedToolName === toolId)) {
      return storedToolName;
    }

    return resolvedToolName;
  });
  const sampleNames = toolNames.slice(0, 4);
  const toolCues = uniqueStrings(
    toolIds.flatMap((toolId) => {
      const tool = toolById.get(toolId);
      return tool ? toolDefinitionCues(tool) : [];
    })
  );

  return {
    id: workflowGraphNodeId(workflowGraphNodeTypes.tool, record.id),
    type: workflowGraphNodeTypes.tool,
    label: 'Tools',
    description:
      sampleNames.length > 0
        ? sampleNames.join(', ') + (toolNames.length > sampleNames.length ? '...' : '')
        : undefined,
    position: record.position ?? {
      x: -defaultNodeGapX,
      y: 80 + index * defaultNodeGapY,
    },
    data: workflowGraphNodeData({
      toolNodeId: record.id,
      ...(record.agentId ? { agentId: record.agentId } : {}),
      toolIds,
      toolNames,
      toolCount: toolIds.length,
      toolCues,
      workflowOwned: workflowOwnedTools.length > 0,
      workflowOwnedToolIds: workflowOwnedTools.map((tool) => tool.id),
      workflowOwnedToolDefinitions: workflowOwnedTools.map((tool) => toGraphJsonObject(tool)),
    }),
    metadata: {
      source: 'workflowGraphAdapter',
      toolNodeId: record.id,
    },
  };
}

function createMemoryNode(memory: WorkflowMemoryDefinition, index: number): GraphNode {
  return {
    id: workflowGraphNodeId(workflowGraphNodeTypes.memory, memory.id),
    type: workflowGraphNodeTypes.memory,
    label: memory.name || memory.id,
    description: memory.description ?? undefined,
    position: graphPositionFromMetadata(memory.metadata) ?? {
      x: -defaultNodeGapX * 2,
      y: 80 + index * defaultNodeGapY,
    },
    data: workflowGraphNodeData({
      memoryId: memory.id,
      memoryType: memory.memory_type ?? null,
      scope: memory.scope ?? null,
      catalogRefType:
        typeof memory.metadata?.catalog_ref_type === 'string'
          ? memory.metadata.catalog_ref_type
          : null,
      catalogRefId:
        typeof memory.metadata?.catalog_ref_id === 'string' ? memory.metadata.catalog_ref_id : null,
      catalogMemoryType:
        typeof memory.metadata?.catalog_memory_type === 'string'
          ? memory.metadata.catalog_memory_type
          : null,
      catalogMode:
        typeof memory.metadata?.catalog_mode === 'string' ? memory.metadata.catalog_mode : null,
      catalogSensitive:
        typeof memory.metadata?.catalog_sensitive === 'boolean'
          ? memory.metadata.catalog_sensitive
          : null,
      catalogEmbedded:
        typeof memory.metadata?.catalog_embedded === 'boolean'
          ? memory.metadata.catalog_embedded
          : null,
      workflowOwned: true,
    }),
    metadata: {
      source: 'workflowGraphAdapter',
    },
  };
}

function createArtifactNode(artifact: WorkflowArtifactDefinition, index: number): GraphNode {
  return {
    id: workflowGraphNodeId(workflowGraphNodeTypes.artifact, artifact.id),
    type: workflowGraphNodeTypes.artifact,
    label: artifact.name || artifact.id,
    description: artifact.description ?? undefined,
    position: graphPositionFromMetadata(artifact.metadata) ?? {
      x: defaultNodeGapX * 2,
      y: 80 + index * defaultNodeGapY,
    },
    data: workflowGraphNodeData({
      artifactId: artifact.id,
      artifactType: artifact.artifact_type ?? null,
      mediaType: artifact.media_type ?? null,
      producerTaskId: artifact.producer_task_id ?? null,
      workflowOwned: true,
    }),
    metadata: {
      source: 'workflowGraphAdapter',
    },
  };
}

function workflowNodeTaskId(nodeId: string) {
  return nodeId.startsWith('node-') ? nodeId.slice('node-'.length) : nodeId;
}

function workflowTaskIdForNodeId(workflow: WorkflowDefinition, nodeId: string | null | undefined) {
  if (!nodeId) {
    return null;
  }

  return (
    workflow.nodes?.find((node) => node.id === nodeId)?.task_id ??
    // Some generated definitions persist edges directly as node-${taskId}; keep that convention
    // as a fallback while allowing backend-owned workflow node ids to remain canonical.
    workflowNodeTaskId(nodeId)
  );
}

function routerPositionForEdge(
  edge: WorkflowEdgeDefinition,
  workflow: WorkflowDefinition,
  index: number
) {
  const sourceTaskId = workflowTaskIdForNodeId(workflow, edge.source_node_id);
  const targetTaskId = workflowTaskIdForNodeId(workflow, edge.target_node_id);
  const sourceTask = workflow.task_definitions?.find((task) => task.id === sourceTaskId);
  const targetTask = workflow.task_definitions?.find((task) => task.id === targetTaskId);

  if (sourceTask && targetTask) {
    const sourceIndex =
      workflow.task_definitions?.findIndex((task) => task.id === sourceTaskId) ?? 0;
    const targetIndex =
      workflow.task_definitions?.findIndex((task) => task.id === targetTaskId) ?? 0;
    const sourcePosition = positionForTask(sourceTask, workflow, sourceIndex);
    const targetPosition = positionForTask(targetTask, workflow, targetIndex);

    return {
      x: (sourcePosition.x + targetPosition.x) / 2,
      y: (sourcePosition.y + targetPosition.y) / 2,
    };
  }

  return {
    x: defaultNodeGapX * 1.5,
    y: 80 + index * defaultNodeGapY,
  };
}

function createRouterNode(
  edge: WorkflowEdgeDefinition,
  workflow: WorkflowDefinition,
  index: number
): GraphNode {
  const sourceTaskId = workflowTaskIdForNodeId(workflow, edge.source_node_id);
  const targetTaskId = workflowTaskIdForNodeId(workflow, edge.target_node_id);

  return {
    id: workflowGraphNodeId(workflowGraphNodeTypes.router, edge.id),
    type: workflowGraphNodeTypes.router,
    label: edge.condition ? `Route: ${edge.condition}` : `${edge.edge_type ?? 'Route'} Router`,
    description: 'Workflow route or branch condition.',
    position: routerPositionForEdge(edge, workflow, index),
    data: workflowGraphNodeData({
      edgeId: edge.id,
      sourceTaskId,
      targetTaskId,
      edgeType: edge.edge_type ?? 'default',
      condition: edge.condition ?? null,
    }),
    metadata: {
      source: 'workflowGraphAdapter',
      derivedFrom: edge.id,
    },
  };
}

function edgeMetadataForTaskPair(
  workflow: WorkflowDefinition,
  sourceTaskId: string,
  targetTaskId: string
) {
  const sourceNodeId = `node-${sourceTaskId}`;
  const targetNodeId = `node-${targetTaskId}`;
  return workflow.edges?.find(
    (edge) =>
      (edge.source_node_id === sourceNodeId ||
        workflowTaskIdForNodeId(workflow, edge.source_node_id) === sourceTaskId) &&
      (edge.target_node_id === targetNodeId ||
        workflowTaskIdForNodeId(workflow, edge.target_node_id) === targetTaskId)
  );
}

function graphEdgeTypeForWorkflowEdge(
  edge: WorkflowEdgeDefinition | undefined
): WorkflowGraphEdgeType {
  if (!edge) {
    return workflowGraphEdgeTypes.dependency;
  }

  if (edge.edge_type === 'handoff') {
    return workflowGraphEdgeTypes.handoff;
  }

  if (edge.condition || edge.edge_type === 'conditional') {
    return workflowGraphEdgeTypes.condition;
  }

  if (edge.edge_type && edge.edge_type !== 'default') {
    return workflowGraphEdgeTypes.dataFlow;
  }

  return workflowGraphEdgeTypes.dependency;
}

function workflowGraphEdgeStyle(type: WorkflowGraphEdgeType) {
  if (type === workflowGraphEdgeTypes.assignment) {
    return {
      color: '#059669',
      className: 'graph-workflow-edge-assignment',
    };
  }

  if (type === workflowGraphEdgeTypes.condition) {
    return {
      color: '#7c3aed',
      className: 'graph-workflow-edge-condition',
    };
  }

  if (type === workflowGraphEdgeTypes.dataFlow) {
    return {
      color: '#0284c7',
      className: 'graph-workflow-edge-data-flow',
    };
  }

  if (type === workflowGraphEdgeTypes.tool) {
    return {
      color: '#d97706',
      className: 'graph-workflow-edge-tool',
    };
  }

  if (type === workflowGraphEdgeTypes.memory) {
    return {
      color: '#0891b2',
      className: 'graph-workflow-edge-memory',
    };
  }

  if (type === workflowGraphEdgeTypes.approval) {
    return {
      color: '#2563eb',
      className: 'graph-workflow-edge-approval',
    };
  }

  if (type === workflowGraphEdgeTypes.handoff) {
    return {
      color: '#4f46e5',
      className: 'graph-workflow-edge-handoff',
    };
  }

  return {
    color: '#64748b',
    className: 'graph-workflow-edge-dependency',
  };
}

function workflowGraphTaskFlowEdgeStyle(
  edgeType: string | null | undefined,
  graphEdgeType: WorkflowGraphEdgeType
) {
  if (edgeType === 'success') {
    return {
      ...workflowGraphEdgeStyle(graphEdgeType),
      color: '#059669',
      className: 'graph-workflow-edge-assignment',
    };
  }

  if (edgeType === 'failure') {
    return {
      ...workflowGraphEdgeStyle(graphEdgeType),
      color: '#dc2626',
      className: 'graph-workflow-edge-failure',
    };
  }

  return workflowGraphEdgeStyle(graphEdgeType);
}

function workflowEdgeTypesForTaskFlow() {
  return new Set<string>([
    workflowGraphEdgeTypes.dependency,
    workflowGraphEdgeTypes.dataFlow,
    workflowGraphEdgeTypes.condition,
    workflowGraphEdgeTypes.handoff,
  ]);
}

function workflowGraphEdgeTypeForRouteData(
  edgeType: string | null | undefined,
  condition: string | null | undefined
): WorkflowGraphEdgeType {
  if (edgeType === 'handoff') {
    return workflowGraphEdgeTypes.handoff;
  }

  if (condition || edgeType === 'conditional') {
    return workflowGraphEdgeTypes.condition;
  }

  if (edgeType && edgeType !== 'default') {
    return workflowGraphEdgeTypes.dataFlow;
  }

  return workflowGraphEdgeTypes.dependency;
}

export function normalizeWorkflowGraphEdgeTypes(document: GraphDocument): GraphDocument {
  const nodeById = new Map(document.nodes.map((node) => [node.id, node]));
  let changed = false;

  const edges = document.edges.map((edge) => {
    if (edge.type !== 'default') {
      return edge;
    }

    const sourceKind = workflowGraphNodeKind(nodeById.get(edge.source));
    const targetKind = workflowGraphNodeKind(nodeById.get(edge.target));

    if (sourceKind === 'task' && targetKind === 'task') {
      changed = true;
      return {
        ...edge,
        type: workflowGraphEdgeTypes.dependency,
        data: {
          ...(edge.data ?? {}),
          edgeType: 'default',
        },
      };
    }

    if (sourceKind === 'agent' && targetKind === 'task') {
      changed = true;
      return {
        ...edge,
        type: workflowGraphEdgeTypes.assignment,
      };
    }

    if (sourceKind === 'tool' && targetKind === 'agent') {
      changed = true;
      return {
        ...edge,
        type: workflowGraphEdgeTypes.tool,
      };
    }

    if (sourceKind === 'memory' && (targetKind === 'agent' || targetKind === 'task')) {
      changed = true;
      return {
        ...edge,
        type: workflowGraphEdgeTypes.memory,
      };
    }

    return edge;
  });

  return changed ? { ...document, edges } : document;
}

function taskNodeByWorkflowTaskId(nodes: GraphNode[]) {
  return new Map(
    nodes
      .filter((node) => node.type === workflowGraphNodeTypes.task)
      .map((node) => [workflowTaskIdFromNode(node), node] as const)
      .filter((entry): entry is [string, GraphNode] => Boolean(entry[0]))
  );
}

function normalizeWorkflowGraphRouterEdges(document: GraphDocument): GraphDocument {
  const taskFlowEdgeTypes = workflowEdgeTypesForTaskFlow();
  const nodeById = new Map(document.nodes.map((node) => [node.id, node]));
  const taskNodeByTaskId = taskNodeByWorkflowTaskId(document.nodes);
  const repairedEdges: GraphEdge[] = [];
  const repairedRouterIds = new Set<string>();

  for (const routerNode of document.nodes.filter(
    (node) => node.type === workflowGraphNodeTypes.router
  )) {
    const incomingRouteEdges = document.edges.filter(
      (edge) =>
        taskFlowEdgeTypes.has(edge.type) &&
        edge.target === routerNode.id &&
        workflowGraphNodeKind(nodeById.get(edge.source)) === 'task'
    );
    const outgoingRouteEdges = document.edges.filter(
      (edge) =>
        taskFlowEdgeTypes.has(edge.type) &&
        edge.source === routerNode.id &&
        workflowGraphNodeKind(nodeById.get(edge.target)) === 'task'
    );

    if (incomingRouteEdges.length === 1 && outgoingRouteEdges.length === 1) {
      continue;
    }

    const sourceTaskId =
      getNodeDataString(routerNode, 'sourceTaskId') ??
      getGraphEdgeDataString(incomingRouteEdges[0], 'sourceTaskId');
    const targetTaskId =
      getNodeDataString(routerNode, 'targetTaskId') ??
      getGraphEdgeDataString(outgoingRouteEdges[0], 'targetTaskId');
    const sourceNode = sourceTaskId ? taskNodeByTaskId.get(sourceTaskId) : undefined;
    const targetNode = targetTaskId ? taskNodeByTaskId.get(targetTaskId) : undefined;

    if (
      !sourceTaskId ||
      !targetTaskId ||
      sourceTaskId === targetTaskId ||
      !sourceNode ||
      !targetNode
    ) {
      continue;
    }

    const edgeType = getNodeDataString(routerNode, 'edgeType') ?? 'default';
    const condition = getNodeDataString(routerNode, 'condition');
    const graphEdgeType = workflowGraphEdgeTypeForRouteData(edgeType, condition);
    const routerEdgeId = getNodeDataString(routerNode, 'edgeId') ?? routerNode.id;
    const routeData = workflowGraphNodeData({
      sourceTaskId,
      targetTaskId,
      routerEdgeId,
      edgeType,
      ...(condition ? { condition } : {}),
    });

    repairedRouterIds.add(routerNode.id);
    repairedEdges.push(
      {
        id: createGraphEdgeId({
          source: sourceNode.id,
          target: routerNode.id,
          type: graphEdgeType,
        }),
        source: sourceNode.id,
        target: routerNode.id,
        type: graphEdgeType,
        label: condition ?? undefined,
        style: workflowGraphTaskFlowEdgeStyle(edgeType, graphEdgeType),
        data: routeData,
        metadata: toGraphJsonObject(incomingRouteEdges[0]?.metadata),
      },
      {
        id: createGraphEdgeId({
          source: routerNode.id,
          target: targetNode.id,
          type: workflowGraphEdgeTypes.dependency,
        }),
        source: routerNode.id,
        target: targetNode.id,
        type: workflowGraphEdgeTypes.dependency,
        style: workflowGraphEdgeStyle(workflowGraphEdgeTypes.dependency),
        data: routeData,
        metadata: {
          source: 'workflowGraphAdapter',
          routedBy: routerEdgeId,
        },
      }
    );
  }

  if (repairedRouterIds.size === 0) {
    return document;
  }

  // Router nodes persist as a single workflow edge. When AI/tool edits leave fan-in, fan-out,
  // or orphaned route edges, rebuild the pair from router metadata so save conversion is stable.
  return {
    ...document,
    edges: [
      ...document.edges.filter(
        (edge) => !repairedRouterIds.has(edge.source) && !repairedRouterIds.has(edge.target)
      ),
      ...repairedEdges,
    ],
  };
}

export function normalizeWorkflowGraphForPersistence(graph: GraphDocument): GraphDocument {
  return normalizeWorkflowGraphRouterEdges(normalizeWorkflowGraphEdgeTypes(graph));
}

function createDependencyEdges(workflow: WorkflowDefinition): GraphEdge[] {
  return (workflow.task_definitions ?? []).flatMap((task) =>
    (task.depends_on_task_ids ?? []).flatMap((dependencyId): GraphEdge[] => {
      if (dependencyId === task.id) {
        return [];
      }

      const existingEdge = edgeMetadataForTaskPair(workflow, dependencyId, task.id);
      const graphEdgeType = graphEdgeTypeForWorkflowEdge(existingEdge);
      const source = workflowGraphNodeId(workflowGraphNodeTypes.task, dependencyId);
      const target = workflowGraphNodeId(workflowGraphNodeTypes.task, task.id);
      if (
        existingEdge &&
        graphEdgeType !== workflowGraphEdgeTypes.dependency &&
        graphEdgeType !== workflowGraphEdgeTypes.handoff
      ) {
        const router = workflowGraphNodeId(workflowGraphNodeTypes.router, existingEdge.id);
        const routeData = workflowGraphNodeData({
          sourceTaskId: dependencyId,
          targetTaskId: task.id,
          routerEdgeId: existingEdge.id,
          edgeType: existingEdge.edge_type ?? 'default',
        });

        return [
          {
            id: createGraphEdgeId({
              source,
              target: router,
              type: graphEdgeType,
            }),
            source,
            target: router,
            type: graphEdgeType,
            label: existingEdge.condition ?? undefined,
            style: workflowGraphTaskFlowEdgeStyle(existingEdge.edge_type, graphEdgeType),
            data: routeData,
            metadata: toGraphJsonObject(existingEdge.metadata),
          },
          {
            id: createGraphEdgeId({
              source: router,
              target,
              type: workflowGraphEdgeTypes.dependency,
            }),
            source: router,
            target,
            type: workflowGraphEdgeTypes.dependency,
            style: workflowGraphEdgeStyle(workflowGraphEdgeTypes.dependency),
            data: routeData,
            metadata: {
              source: 'workflowGraphAdapter',
              routedBy: existingEdge.id,
            },
          },
        ];
      }

      return [
        {
          id: createGraphEdgeId({
            source,
            target,
            type: graphEdgeType,
          }),
          source,
          target,
          type: graphEdgeType,
          label: existingEdge?.condition ?? undefined,
          style: workflowGraphTaskFlowEdgeStyle(existingEdge?.edge_type, graphEdgeType),
          data: workflowGraphNodeData({
            sourceTaskId: dependencyId,
            targetTaskId: task.id,
            edgeType: existingEdge?.edge_type ?? 'default',
          }),
          metadata: toGraphJsonObject(existingEdge?.metadata),
        },
      ];
    })
  );
}

function createAssignmentEdges(workflow: WorkflowDefinition): GraphEdge[] {
  return (workflow.task_definitions ?? [])
    .filter((task) => task.agent_id)
    .map((task) => ({
      id: createGraphEdgeId({
        source: workflowGraphNodeId(workflowGraphNodeTypes.agent, task.agent_id as string),
        target: workflowGraphNodeId(workflowGraphNodeTypes.task, task.id),
        type: workflowGraphEdgeTypes.assignment,
      }),
      source: workflowGraphNodeId(workflowGraphNodeTypes.agent, task.agent_id as string),
      target: workflowGraphNodeId(workflowGraphNodeTypes.task, task.id),
      type: workflowGraphEdgeTypes.assignment,
      style: workflowGraphEdgeStyle(workflowGraphEdgeTypes.assignment),
      data: workflowGraphNodeData({
        agentId: task.agent_id as string,
        taskId: task.id,
      }),
      metadata: {
        source: 'workflowGraphAdapter',
      },
    }));
}

function createToolEdges(records: WorkflowGraphToolNodeRecord[]): GraphEdge[] {
  return records.flatMap((record) => {
    const toolIds = uniqueStrings(record.toolIds);
    if (!record.agentId) {
      return [];
    }

    const source = workflowGraphNodeId(workflowGraphNodeTypes.tool, record.id);
    const target = workflowGraphNodeId(workflowGraphNodeTypes.agent, record.agentId);

    return [
      {
        id: createGraphEdgeId({
          source,
          target,
          type: workflowGraphEdgeTypes.tool,
        }),
        source,
        target,
        type: workflowGraphEdgeTypes.tool,
        style: workflowGraphEdgeStyle(workflowGraphEdgeTypes.tool),
        data: workflowGraphNodeData({
          toolIds,
          toolCount: toolIds.length,
          ...(toolIds.length === 1 ? { toolId: toolIds[0] } : {}),
          agentId: record.agentId,
          toolNodeId: record.id,
        }),
        metadata: {
          source: 'workflowGraphAdapter',
        },
      },
    ];
  });
}

function createMemoryEdges(workflow: WorkflowDefinition): GraphEdge[] {
  const agentEdges = (workflow.agent_definitions ?? []).flatMap((agent) =>
    (agent.memory_ids ?? agent.memoryIds ?? []).map((memoryId) => ({
      id: createGraphEdgeId({
        source: workflowGraphNodeId(workflowGraphNodeTypes.memory, memoryId),
        target: workflowGraphNodeId(workflowGraphNodeTypes.agent, agent.id),
        type: workflowGraphEdgeTypes.memory,
      }),
      source: workflowGraphNodeId(workflowGraphNodeTypes.memory, memoryId),
      target: workflowGraphNodeId(workflowGraphNodeTypes.agent, agent.id),
      type: workflowGraphEdgeTypes.memory,
      style: workflowGraphEdgeStyle(workflowGraphEdgeTypes.memory),
      data: workflowGraphNodeData({
        memoryId,
        agentId: agent.id,
        targetKind: 'agent',
        access: 'read_write',
      }),
      metadata: {
        source: 'workflowGraphAdapter',
        access: 'read_write',
      },
    }))
  );
  const taskEdges = (workflow.task_definitions ?? []).flatMap((task) =>
    (task.memory_ids ?? []).map((memoryId) => ({
      id: createGraphEdgeId({
        source: workflowGraphNodeId(workflowGraphNodeTypes.memory, memoryId),
        target: workflowGraphNodeId(workflowGraphNodeTypes.task, task.id),
        type: workflowGraphEdgeTypes.memory,
      }),
      source: workflowGraphNodeId(workflowGraphNodeTypes.memory, memoryId),
      target: workflowGraphNodeId(workflowGraphNodeTypes.task, task.id),
      type: workflowGraphEdgeTypes.memory,
      style: workflowGraphEdgeStyle(workflowGraphEdgeTypes.memory),
      data: workflowGraphNodeData({
        memoryId,
        taskId: task.id,
        targetKind: 'task',
        access: 'read_write',
      }),
      metadata: {
        source: 'workflowGraphAdapter',
        access: 'read_write',
      },
    }))
  );

  return [...agentEdges, ...taskEdges];
}

function createArtifactEdges(
  workflow: WorkflowDefinition,
  artifacts: WorkflowArtifactDefinition[]
) {
  const taskIds = new Set((workflow.task_definitions ?? []).map((task) => task.id));

  return artifacts.flatMap((artifact) => {
    if (!artifact.producer_task_id || !taskIds.has(artifact.producer_task_id)) {
      return [];
    }

    return [
      {
        id: createGraphEdgeId({
          source: workflowGraphNodeId(workflowGraphNodeTypes.task, artifact.producer_task_id),
          target: workflowGraphNodeId(workflowGraphNodeTypes.artifact, artifact.id),
          type: workflowGraphEdgeTypes.dataFlow,
        }),
        source: workflowGraphNodeId(workflowGraphNodeTypes.task, artifact.producer_task_id),
        target: workflowGraphNodeId(workflowGraphNodeTypes.artifact, artifact.id),
        type: workflowGraphEdgeTypes.dataFlow,
        label: 'produces',
        data: workflowGraphNodeData({
          sourceTaskId: artifact.producer_task_id,
          artifactId: artifact.id,
          edgeType: 'artifact',
        }),
        metadata: {
          source: 'workflowGraphAdapter',
          access: 'write',
        },
      },
    ];
  });
}

function createApprovalEdges(tasks: TaskDefinition[]): GraphEdge[] {
  return tasks
    .filter((task) => task.human_approval_required)
    .map((task) => {
      const source = workflowGraphNodeId(workflowGraphNodeTypes.task, task.id);
      const target = workflowGraphNodeId(workflowGraphNodeTypes.approval, task.id);

      return {
        id: createGraphEdgeId({
          source,
          target,
          type: workflowGraphEdgeTypes.approval,
        }),
        source,
        target,
        type: workflowGraphEdgeTypes.approval,
        label: 'Requires approval',
        data: workflowGraphNodeData({
          taskId: task.id,
          taskName: task.name || task.id,
          edgeType: 'approval',
        }),
        style: workflowGraphEdgeStyle(workflowGraphEdgeTypes.approval),
        metadata: {
          source: 'workflowGraphAdapter',
          derived: true,
        },
      };
    });
}

function applyWorkflowGraphMinimumSpacing(document: GraphDocument): GraphDocument {
  const nodeById = new Map(document.nodes.map((node) => [node.id, node]));
  const directionalEdgeTypes = new Set<string>([
    workflowGraphEdgeTypes.assignment,
    workflowGraphEdgeTypes.approval,
    workflowGraphEdgeTypes.dependency,
    workflowGraphEdgeTypes.dataFlow,
    workflowGraphEdgeTypes.condition,
    workflowGraphEdgeTypes.handoff,
  ]);
  const nextPositionByNodeId = new Map(
    document.nodes.map((node) => [node.id, node.position ?? { x: 0, y: 0 }])
  );

  for (let pass = 0; pass < document.nodes.length; pass += 1) {
    let changed = false;

    for (const edge of document.edges) {
      if (!directionalEdgeTypes.has(edge.type)) {
        continue;
      }

      const sourceNode = nodeById.get(edge.source);
      const targetNode = nodeById.get(edge.target);

      if (!sourceNode || !targetNode) {
        continue;
      }

      const routeEdgeInvolvesRouter =
        sourceNode.type === workflowGraphNodeTypes.router ||
        targetNode.type === workflowGraphNodeTypes.router;

      if (routeEdgeInvolvesRouter) {
        continue;
      }

      const sourcePosition = nextPositionByNodeId.get(sourceNode.id) ?? { x: 0, y: 0 };
      const targetPosition = nextPositionByNodeId.get(targetNode.id) ?? { x: 0, y: 0 };
      const horizontalGap = targetPosition.x - sourcePosition.x;
      const minimumGap =
        edge.type === workflowGraphEdgeTypes.approval
          ? defaultApprovalNodeOffsetX
          : defaultNodeGapX;

      if (horizontalGap >= 0 && horizontalGap < minimumGap) {
        nextPositionByNodeId.set(targetNode.id, {
          ...targetPosition,
          x: sourcePosition.x + minimumGap,
        });
        changed = true;
      }
    }

    if (!changed) {
      break;
    }
  }

  const nodesByColumn = new Map<number, GraphNode[]>();
  for (const node of document.nodes) {
    if (node.type === workflowGraphNodeTypes.router) {
      continue;
    }

    const position = nextPositionByNodeId.get(node.id) ?? node.position;
    if (!position) {
      continue;
    }

    const columnKey = Math.round(position.x);
    nodesByColumn.set(columnKey, [...(nodesByColumn.get(columnKey) ?? []), node]);
  }

  for (const columnNodes of nodesByColumn.values()) {
    const orderedNodes = [...columnNodes].sort((a, b) => {
      const aPosition = nextPositionByNodeId.get(a.id) ?? a.position ?? { x: 0, y: 0 };
      const bPosition = nextPositionByNodeId.get(b.id) ?? b.position ?? { x: 0, y: 0 };
      return aPosition.y - bPosition.y;
    });
    let previousY: number | null = null;

    for (const node of orderedNodes) {
      const position = nextPositionByNodeId.get(node.id) ?? node.position ?? { x: 0, y: 0 };
      const nextY: number =
        previousY === null ? position.y : Math.max(position.y, previousY + defaultNodeGapY);

      // Persisted graph coordinates can be hand-authored or legacy compact layouts. Keep the
      // column intent, but prevent hover targets and labels from visually stacking.
      nextPositionByNodeId.set(node.id, {
        ...position,
        y: nextY,
      });
      previousY = nextY;
    }
  }

  for (const routerNode of document.nodes.filter(
    (node) => node.type === workflowGraphNodeTypes.router
  )) {
    const incomingRouteEdge = document.edges.find((edge) => edge.target === routerNode.id);
    const outgoingRouteEdge = document.edges.find((edge) => edge.source === routerNode.id);
    const sourceNode = incomingRouteEdge ? nodeById.get(incomingRouteEdge.source) : undefined;
    const targetNode = outgoingRouteEdge ? nodeById.get(outgoingRouteEdge.target) : undefined;

    if (
      sourceNode?.type !== workflowGraphNodeTypes.task ||
      targetNode?.type !== workflowGraphNodeTypes.task
    ) {
      continue;
    }

    const sourcePosition = nextPositionByNodeId.get(sourceNode.id) ?? sourceNode.position;
    const targetPosition = nextPositionByNodeId.get(targetNode.id) ?? targetNode.position;

    if (!sourcePosition || !targetPosition) {
      continue;
    }

    const sameColumn = Math.abs(sourcePosition.x - targetPosition.x) < 1;
    nextPositionByNodeId.set(routerNode.id, {
      x: sameColumn
        ? sourcePosition.x + defaultNodeGapX / 2
        : (sourcePosition.x + targetPosition.x) / 2,
      y: (sourcePosition.y + targetPosition.y) / 2,
    });
  }

  return {
    ...document,
    nodes: document.nodes.map((node) => ({
      ...node,
      position: nextPositionByNodeId.get(node.id) ?? node.position,
    })),
  };
}

function getNodeDataString(node: GraphNode | undefined, key: string) {
  const value = node?.data?.[key];
  return typeof value === 'string' ? value : null;
}

function getNodeDataBoolean(node: GraphNode | undefined, key: string) {
  const value = node?.data?.[key];
  return typeof value === 'boolean' ? value : null;
}

function getNodeDataJsonObject(node: GraphNode | undefined, key: string): GraphJsonObject {
  const value = node?.data?.[key];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as GraphJsonObject)
    : {};
}

function getNodeDataJsonArray(node: GraphNode | undefined, key: string) {
  const value = node?.data?.[key];
  return Array.isArray(value) ? value : [];
}

function nodeMemoryCatalogMetadata(node: GraphNode, baseMetadata: unknown): GraphJsonObject {
  const metadata = toGraphJsonObject(baseMetadata);
  const catalogRefType = getNodeDataString(node, 'catalogRefType');
  const catalogRefId = getNodeDataString(node, 'catalogRefId');
  const catalogMemoryType = getNodeDataString(node, 'catalogMemoryType');
  const catalogMode = getNodeDataString(node, 'catalogMode');
  const catalogSensitive = getNodeDataBoolean(node, 'catalogSensitive');
  const catalogEmbedded = getNodeDataBoolean(node, 'catalogEmbedded');

  if (catalogRefType) {
    metadata.catalog_ref_type = catalogRefType;
  }
  if (catalogRefId) {
    metadata.catalog_ref_id = catalogRefId;
  }
  if (catalogMemoryType) {
    metadata.catalog_memory_type = catalogMemoryType;
  }
  if (catalogMode) {
    metadata.catalog_mode = catalogMode;
  }
  if (catalogSensitive !== null) {
    metadata.catalog_sensitive = catalogSensitive;
  }
  if (catalogEmbedded !== null) {
    metadata.catalog_embedded = catalogEmbedded;
  }

  return metadata;
}

function getNodeDataStringArray(node: GraphNode | undefined, key: string) {
  const value = node?.data?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function nodeDataHasKey(node: GraphNode | undefined, key: string) {
  return Boolean(node?.data && Object.prototype.hasOwnProperty.call(node.data, key));
}

function workflowTaskIdFromNode(node: GraphNode | undefined) {
  return getNodeDataString(node, 'taskId');
}

function workflowAgentIdFromNode(node: GraphNode | undefined) {
  return getNodeDataString(node, 'agentId');
}

function workflowToolIdFromNode(node: GraphNode | undefined) {
  return getNodeDataString(node, 'toolId');
}

function workflowToolNodeIdFromNode(node: GraphNode | undefined) {
  return getNodeDataString(node, 'toolNodeId') ?? node?.metadata?.toolNodeId?.toString() ?? null;
}

function workflowToolNodeRecordIdFromNode(node: GraphNode | undefined) {
  const toolNodeId = workflowToolNodeIdFromNode(node);
  if (toolNodeId || !node) {
    return toolNodeId;
  }

  const prefix = `${workflowGraphNodeTypes.tool.replace(/\./g, '-')}-`;
  return node.id.startsWith(prefix) ? node.id.slice(prefix.length) : null;
}

function workflowToolIdsFromNode(node: GraphNode | undefined) {
  return uniqueStrings([
    ...getNodeDataStringArray(node, 'toolIds'),
    ...(workflowToolIdFromNode(node) ? [workflowToolIdFromNode(node) as string] : []),
  ]);
}

function getGraphEdgeDataString(edge: GraphEdge | undefined, key: string) {
  const value = edge?.data?.[key];
  return typeof value === 'string' ? value : null;
}

function getGraphEdgeDataStringArray(edge: GraphEdge | undefined, key: string) {
  const value = edge?.data?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function workflowToolIdsFromEdge(edge: GraphEdge, sourceNode: GraphNode | undefined) {
  const nodeToolIds = workflowToolIdsFromNode(sourceNode);
  if (nodeToolIds.length > 0) {
    return nodeToolIds;
  }

  const edgeToolIds = uniqueStrings([
    ...getGraphEdgeDataStringArray(edge, 'toolIds'),
    ...(getGraphEdgeDataString(edge, 'toolId')
      ? [getGraphEdgeDataString(edge, 'toolId') as string]
      : []),
  ]);

  return edgeToolIds;
}

interface WorkflowGraphRouteEdgeRecord {
  sourceTaskId: string;
  targetTaskId: string;
  edgeType: string;
  condition: string | null;
  metadata: GraphJsonObject;
}

function taskPairKey(sourceTaskId: string, targetTaskId: string) {
  return `${sourceTaskId}->${targetTaskId}`;
}

function workflowOwnedToolDefinitionsFromNode(node: GraphNode | undefined) {
  const value = node?.data?.workflowOwnedToolDefinitions as unknown;
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((tool) => {
    if (!tool || typeof tool !== 'object' || Array.isArray(tool)) {
      return [];
    }

    const candidate = tool as Partial<ToolDefinition>;
    if (
      typeof candidate.id === 'string' &&
      typeof candidate.name === 'string' &&
      typeof candidate.description === 'string'
    ) {
      return [candidate as ToolDefinition];
    }

    return [];
  });
}

function workflowMemoryIdFromNode(node: GraphNode | undefined) {
  return getNodeDataString(node, 'memoryId');
}

function workflowArtifactIdFromNode(node: GraphNode | undefined) {
  return getNodeDataString(node, 'artifactId');
}

function workflowGraphNodeKind(node: GraphNode | undefined) {
  if (!node) {
    return null;
  }

  if (node.type === workflowGraphNodeTypes.task) {
    return 'task';
  }

  if (node.type === workflowGraphNodeTypes.agent) {
    return 'agent';
  }

  if (node.type === workflowGraphNodeTypes.tool) {
    return 'tool';
  }

  if (node.type === workflowGraphNodeTypes.memory) {
    return 'memory';
  }

  if (node.type === workflowGraphNodeTypes.artifact) {
    return 'artifact';
  }

  if (node.type === workflowGraphNodeTypes.approval) {
    return 'approval';
  }

  return null;
}

function workflowTaskIdFromEntrypoint(
  entrypoint: string | undefined,
  workflow: WorkflowDefinition
) {
  if (!entrypoint) {
    return null;
  }

  if ((workflow.task_definitions ?? []).some((task) => task.id === entrypoint)) {
    return entrypoint;
  }

  const matchingNode = workflow.nodes?.find((node) => node.id === entrypoint);
  if (matchingNode?.task_id) {
    return matchingNode.task_id;
  }

  return entrypoint.startsWith('node-') ? entrypoint.slice('node-'.length) : entrypoint;
}

function createTaskDefinitionFromGraphNode(
  node: GraphNode,
  index: number,
  assignedAgentId: string | null,
  dependencyIds: string[]
): TaskDefinition | null {
  const taskId = workflowTaskIdFromNode(node);

  if (!taskId) {
    return null;
  }

  const metadataWithTemplate = {
    ...(getNodeDataString(node, 'taskTemplateId')
      ? { task_template_id: getNodeDataString(node, 'taskTemplateId') }
      : {}),
    ...(getNodeDataString(node, 'taskTemplateLabel')
      ? { task_template_label: getNodeDataString(node, 'taskTemplateLabel') }
      : {}),
  };
  const metadataWithInputSources = workflowTaskMetadataWithInputSources(
    metadataWithTemplate,
    normalizeWorkflowTaskInputSources(getNodeDataStringArray(node, 'taskInputSources'))
  );

  const runtimeOverridePatch = workflowTaskRuntimeOverridePatch(
    metadataWithInputSources,
    normalizeWorkflowTaskRuntimeOverrides(getNodeDataJsonObject(node, 'taskRuntimeOverrides'))
  );

  return {
    id: taskId,
    name: node.label || `Task ${index + 1}`,
    description: node.description ?? '',
    instructions: getNodeDataString(node, 'instructions') ?? '',
    expected_output: getNodeDataString(node, 'expectedOutput') ?? '',
    agent_id: assignedAgentId ?? getNodeDataString(node, 'agentId'),
    tool_ids: getNodeDataStringArray(node, 'toolIds'),
    memory_ids: getNodeDataStringArray(node, 'memoryIds'),
    depends_on_task_ids: dependencyIds,
    human_approval_required: getNodeDataBoolean(node, 'humanApprovalRequired') ?? false,
    timeout_seconds: runtimeOverridePatch.timeout_seconds,
    max_retries: runtimeOverridePatch.max_retries,
    model_profile_id: runtimeOverridePatch.model_profile_id,
    max_tokens: runtimeOverridePatch.max_tokens,
    approval_policy: runtimeOverridePatch.approval_policy,
    metadata: runtimeOverridePatch.metadata,
  };
}

function createAgentDefinitionFromGraphNode(
  node: GraphNode,
  index: number
): AgentDefinition | null {
  const agentId = workflowAgentIdFromNode(node);

  if (!agentId) {
    return null;
  }

  return {
    id: agentId,
    name: node.label || `Agent ${index + 1}`,
    description: node.description ?? '',
    instructions: getNodeDataString(node, 'instructions') ?? '',
    system_prompt: getNodeDataString(node, 'systemPrompt') ?? '',
    role: getNodeDataString(node, 'role') ?? '',
    backstory: getNodeDataString(node, 'backstory') ?? '',
    model_profile_id: getNodeDataString(node, 'modelProfileId'),
    tool_ids: getNodeDataStringArray(node, 'toolIds'),
    memory_ids: getNodeDataStringArray(node, 'memoryIds'),
    handoff_agent_ids: getNodeDataStringArray(node, 'handoffAgentIds'),
    guardrails: normalizeWorkflowAgentGuardrails(getNodeDataJsonArray(node, 'guardrails')),
    metadata: metadataWithGraphPosition(
      {
        created_from: 'workflow-graph-editor',
      },
      node.position
    ),
  };
}

function workflowReferenceForNode(
  node: GraphNode | undefined
): WorkflowGraphValidationIssue['workflowReference'] {
  if (!node) {
    return undefined;
  }

  const taskId = workflowTaskIdFromNode(node);
  if (taskId) {
    return { kind: 'task', id: taskId };
  }

  const agentId = workflowAgentIdFromNode(node);
  if (agentId) {
    return { kind: 'agent', id: agentId };
  }

  const toolId = workflowToolIdFromNode(node);
  if (toolId) {
    return { kind: 'tool', id: toolId };
  }

  const toolIds = workflowToolIdsFromNode(node);
  if (toolIds.length === 1) {
    return { kind: 'tool', id: toolIds[0] };
  }

  const memoryId = workflowMemoryIdFromNode(node);
  if (memoryId) {
    return { kind: 'memory', id: memoryId };
  }

  const artifactId = workflowArtifactIdFromNode(node);
  if (artifactId) {
    return { kind: 'artifact', id: artifactId };
  }

  return { kind: 'workflow', id: node.id };
}

function workflowPathForReference(reference: WorkflowGraphValidationIssue['workflowReference']) {
  if (!reference) {
    return undefined;
  }

  if (reference.kind === 'task') {
    return `task_definitions[id=${reference.id}]`;
  }

  if (reference.kind === 'agent') {
    return `agent_definitions[id=${reference.id}]`;
  }

  if (reference.kind === 'tool') {
    return `tool_definitions[id=${reference.id}]`;
  }

  if (reference.kind === 'memory') {
    return `memory_definitions[id=${reference.id}]`;
  }

  if (reference.kind === 'artifact') {
    return `metadata.${workflowArtifactDefinitionsMetadataKey}[id=${reference.id}]`;
  }

  if (reference.kind === 'edge') {
    return `edges[id=${reference.id}]`;
  }

  return reference.id ? `nodes[id=${reference.id}]` : undefined;
}

export const workflowGraphNodeDescriptors: Record<WorkflowGraphNodeType, GraphNodeTypeDescriptor> =
  {
    [workflowGraphNodeTypes.agent]: {
      type: workflowGraphNodeTypes.agent,
      label: 'Agent',
      description: 'Workflow agent definition.',
      defaultPorts: [{ id: 'assigned-tasks', direction: 'output' }],
    },
    [workflowGraphNodeTypes.task]: {
      type: workflowGraphNodeTypes.task,
      label: 'Task',
      description: 'Workflow task definition.',
      defaultPorts: [
        { id: 'depends-on', direction: 'input' },
        { id: 'required-by', direction: 'output' },
      ],
    },
    [workflowGraphNodeTypes.tool]: {
      type: workflowGraphNodeTypes.tool,
      label: 'Tools',
      description: 'Workflow tool list.',
      defaultPorts: [{ id: 'available-to', direction: 'output' }],
    },
    [workflowGraphNodeTypes.memory]: {
      type: workflowGraphNodeTypes.memory,
      label: 'Memory',
      description: 'Workflow memory context or source.',
      defaultPorts: [{ id: 'available-to', direction: 'output' }],
    },
    [workflowGraphNodeTypes.artifact]: {
      type: workflowGraphNodeTypes.artifact,
      label: 'Artifact',
      description: 'Durable workflow output expected from a task.',
      defaultPorts: [{ id: 'produced-by', direction: 'input' }],
    },
    [workflowGraphNodeTypes.approval]: {
      type: workflowGraphNodeTypes.approval,
      label: 'Approval',
      description: 'Human approval gate derived from workflow task requirements.',
      // Approval gates are derived from task metadata; the single input port makes the owning
      // task relationship visible without turning the gate into an editable branching step.
      defaultPorts: [{ id: 'required-by-task', direction: 'input' }],
    },
    [workflowGraphNodeTypes.router]: {
      type: workflowGraphNodeTypes.router,
      label: 'Router',
      description: 'Workflow branching or route condition.',
      defaultPorts: [
        { id: 'input', direction: 'input' },
        { id: 'route', direction: 'output' },
      ],
    },
  };

export const workflowGraphEdgeDescriptors: Record<WorkflowGraphEdgeType, GraphEdgeTypeDescriptor> =
  {
    [workflowGraphEdgeTypes.dependency]: {
      type: workflowGraphEdgeTypes.dependency,
      label: 'Dependency',
      description: 'Task dependency edge.',
    },
    [workflowGraphEdgeTypes.dataFlow]: {
      type: workflowGraphEdgeTypes.dataFlow,
      label: 'Data flow',
      description: 'Task-to-task data movement edge.',
    },
    [workflowGraphEdgeTypes.condition]: {
      type: workflowGraphEdgeTypes.condition,
      label: 'Condition',
      description: 'Conditional task route edge.',
    },
    [workflowGraphEdgeTypes.assignment]: {
      type: workflowGraphEdgeTypes.assignment,
      label: 'Assignment',
      description: 'Agent assignment edge.',
    },
    [workflowGraphEdgeTypes.tool]: {
      type: workflowGraphEdgeTypes.tool,
      label: 'Tool access',
      description: 'Tool available to agent edge.',
    },
    [workflowGraphEdgeTypes.memory]: {
      type: workflowGraphEdgeTypes.memory,
      label: 'Memory access',
      description: 'Memory available to agent or task edge.',
    },
    [workflowGraphEdgeTypes.approval]: {
      type: workflowGraphEdgeTypes.approval,
      label: 'Requires approval',
      description: 'Derived relationship from an approval-required task to its approval node.',
    },
    [workflowGraphEdgeTypes.handoff]: {
      type: workflowGraphEdgeTypes.handoff,
      label: 'Handoff',
      description: 'Agent handoff edge.',
    },
  };

const defaultWorkflowGraphToolbarActions: GraphToolbarAction[] = [
  {
    id: workflowGraphActionIds.addTask,
    label: 'Add Task',
    description: 'Add a workflow task node.',
  },
  {
    id: workflowGraphActionIds.addAgent,
    label: 'Add Agent',
    description: 'Add a workflow agent node.',
  },
  {
    id: workflowGraphActionIds.addTool,
    label: 'Add Tool',
    description: 'Add a tool to the workflow tool list.',
  },
  {
    id: workflowGraphActionIds.addMemory,
    label: 'Add Memory',
    description: 'Add a workflow memory node.',
  },
  {
    id: workflowGraphActionIds.addArtifact,
    label: 'Add Artifact',
    description: 'Add a durable workflow output node.',
  },
  {
    id: workflowGraphActionIds.validate,
    label: 'Validate Workflow',
    description: 'Validate the workflow graph.',
  },
];

export const workflowGraphToolbarActions = defaultWorkflowGraphToolbarActions;

export function workflowGraphToolbarActionsForCapabilities(
  workflowCapabilityTags: WorkflowCapabilityTag[]
): GraphToolbarAction[] {
  const taskTemplate = workflowTaskStarterTemplate(workflowCapabilityTags, 0);
  if (!taskTemplate) {
    return defaultWorkflowGraphToolbarActions;
  }

  return defaultWorkflowGraphToolbarActions.map((action) =>
    action.id === workflowGraphActionIds.addTask
      ? {
          ...action,
          description: taskTemplate.addTaskDescription,
        }
      : action
  );
}

export const workflowGraphBuiltInToolbarActions: GraphBuiltInToolbarActionId[] = [
  graphBuiltInToolbarActionIds.autoLayout,
  graphBuiltInToolbarActionIds.fitView,
  graphBuiltInToolbarActionIds.focusSelection,
  graphBuiltInToolbarActionIds.undo,
  graphBuiltInToolbarActionIds.redo,
];

export const workflowGraphDefinition = createGraphDefinition({
  nodeTypes: workflowGraphNodeDescriptors,
  edgeTypes: workflowGraphEdgeDescriptors,
  toolbarActions: workflowGraphToolbarActions,
});

function nextPositionForGraphNodeType(
  graph: GraphDocument,
  nodeType: WorkflowGraphNodeType,
  x: number
) {
  const typeNodes = graph.nodes.filter((node) => node.type === nodeType);
  const maxY = typeNodes.reduce(
    (currentMax, node, index) =>
      Math.max(currentMax, node.position?.y ?? 80 + index * defaultNodeGapY),
    80 - defaultNodeGapY
  );

  return {
    x,
    y: maxY + defaultNodeGapY,
  };
}

function nextPositionInGraphLane(graph: GraphDocument, x: number) {
  const laneNodes = graph.nodes.filter((node) => Math.abs((node.position?.x ?? 0) - x) < 1);
  const maxY = laneNodes.reduce(
    (currentMax, node, index) =>
      Math.max(currentMax, node.position?.y ?? 80 + index * defaultNodeGapY),
    80 - defaultNodeGapY
  );

  return {
    x,
    y: maxY + defaultNodeGapY,
  };
}

export function addWorkflowTaskNodeToGraphDocument(
  graph: GraphDocument,
  workflowCapabilityTags: WorkflowCapabilityTag[] = []
): GraphDocument {
  const taskIndex = graph.nodes.filter((node) => node.type === workflowGraphNodeTypes.task).length;
  const task = createWorkflowGraphDraftTaskDefinition(taskIndex, workflowCapabilityTags);
  const taskNode = createTaskNode(
    task,
    {
      id: graph.id ?? 'workflow',
      name: graph.title ?? 'Workflow',
      task_definitions: [task],
      nodes: [
        {
          id: `node-${task.id}`,
          name: task.name,
          node_type: 'task',
          task_id: task.id,
          metadata: {
            position: nextPositionForGraphNodeType(
              graph,
              workflowGraphNodeTypes.task,
              defaultNodeGapX
            ),
          },
        },
      ],
    },
    taskIndex
  );

  return {
    ...graph,
    nodes: [...graph.nodes, taskNode],
  };
}

export function addWorkflowTaskTemplateNodeToGraphDocument(
  graph: GraphDocument,
  templateId: AgenticTaskTemplateId
): GraphDocument {
  const taskIndex = graph.nodes.filter((node) => node.type === workflowGraphNodeTypes.task).length;
  const task = createWorkflowGraphDraftTaskDefinition(taskIndex, [], templateId);
  const taskNode = createTaskNode(
    task,
    {
      id: graph.id ?? 'workflow',
      name: graph.title ?? 'Workflow',
      task_definitions: [task],
      nodes: [
        {
          id: `node-${task.id}`,
          name: task.name,
          node_type: 'task',
          task_id: task.id,
          metadata: {
            position: nextPositionForGraphNodeType(
              graph,
              workflowGraphNodeTypes.task,
              defaultNodeGapX
            ),
          },
        },
      ],
    },
    taskIndex
  );

  return {
    ...graph,
    nodes: [...graph.nodes, taskNode],
  };
}

export function addWorkflowAgentNodeToGraphDocument(graph: GraphDocument): GraphDocument {
  const agentIndex = graph.nodes.filter(
    (node) => node.type === workflowGraphNodeTypes.agent
  ).length;
  const agent = createWorkflowGraphDraftAgentDefinition(agentIndex);

  return {
    ...graph,
    nodes: [
      ...graph.nodes,
      {
        ...createAgentNode(agent, agentIndex),
        position: nextPositionForGraphNodeType(graph, workflowGraphNodeTypes.agent, 0),
      },
    ],
  };
}

export function addWorkflowToolNodeToGraphDocument(graph: GraphDocument): GraphDocument {
  const toolIndex = graph.nodes.filter((node) => node.type === workflowGraphNodeTypes.tool).length;
  const toolNodeId = createWorkflowGraphEntityId('tools');
  const toolNode = createToolListNode(
    { id: toolNodeId, toolIds: [] },
    new Map(),
    new Map(),
    toolIndex
  );

  return {
    ...graph,
    nodes: [
      ...graph.nodes,
      {
        ...toolNode,
        position: nextPositionForGraphNodeType(
          graph,
          workflowGraphNodeTypes.tool,
          -defaultNodeGapX
        ),
      },
    ],
  };
}

export function addWorkflowMemoryNodeToGraphDocument(graph: GraphDocument): GraphDocument {
  const memoryIndex = graph.nodes.filter(
    (node) => node.type === workflowGraphNodeTypes.memory
  ).length;
  const memory = createWorkflowGraphDraftMemoryDefinition(memoryIndex);

  return {
    ...graph,
    nodes: [
      ...graph.nodes,
      {
        ...createMemoryNode(memory, memoryIndex),
        position: nextPositionInGraphLane(graph, 0),
      },
    ],
  };
}

export function addWorkflowArtifactNodeToGraphDocument(graph: GraphDocument): GraphDocument {
  const artifactIndex = graph.nodes.filter(
    (node) => node.type === workflowGraphNodeTypes.artifact
  ).length;
  const artifact = createWorkflowGraphDraftArtifactDefinition(artifactIndex);

  return {
    ...graph,
    nodes: [
      ...graph.nodes,
      {
        ...createArtifactNode(artifact, artifactIndex),
        position: nextPositionForGraphNodeType(
          graph,
          workflowGraphNodeTypes.artifact,
          defaultNodeGapX * 2
        ),
      },
    ],
  };
}

function workflowGraphConnectionIssue(
  edge: GraphEdge,
  code: string,
  message: string
): WorkflowGraphValidationIssue {
  return {
    id: `${code}-${edge.id}`,
    severity: 'warning',
    code,
    message,
    target: 'edge',
    targetId: edge.id,
    workflowReference: {
      kind: 'edge',
      id: edge.id,
    },
    workflowPath: `edges[id=${edge.id}]`,
  };
}

function replaceNodeData(document: GraphDocument, nodeId: string, data: GraphJsonObject) {
  return document.nodes.map((node) =>
    node.id === nodeId
      ? {
          ...node,
          data: {
            ...(node.data ?? {}),
            ...data,
          },
        }
      : node
  );
}

function normalizedConnectionNodes(
  graph: GraphDocument,
  edge: GraphEdge,
  sourceKind: ReturnType<typeof workflowGraphNodeKind>,
  targetKind: ReturnType<typeof workflowGraphNodeKind>
) {
  if (
    (sourceKind === 'task' && targetKind === 'agent') ||
    (sourceKind === 'agent' && targetKind === 'tool') ||
    (sourceKind === 'agent' && targetKind === 'memory') ||
    (sourceKind === 'task' && targetKind === 'memory')
  ) {
    return {
      edge: {
        ...edge,
        source: edge.target,
        target: edge.source,
        sourceHandle: edge.targetHandle,
        targetHandle: edge.sourceHandle,
      },
      sourceNode: graph.nodes.find((node) => node.id === edge.target),
      targetNode: graph.nodes.find((node) => node.id === edge.source),
      sourceKind: targetKind,
      targetKind: sourceKind,
    };
  }

  return {
    edge,
    sourceNode: graph.nodes.find((node) => node.id === edge.source),
    targetNode: graph.nodes.find((node) => node.id === edge.target),
    sourceKind,
    targetKind,
  };
}

export function applyWorkflowGraphConnection(
  graph: GraphDocument,
  edge: GraphEdge
): WorkflowGraphConnectionResult {
  const initialSourceNode = graph.nodes.find((node) => node.id === edge.source);
  const initialTargetNode = graph.nodes.find((node) => node.id === edge.target);
  const normalizedConnection = normalizedConnectionNodes(
    graph,
    edge,
    workflowGraphNodeKind(initialSourceNode),
    workflowGraphNodeKind(initialTargetNode)
  );
  const sourceNode = normalizedConnection.sourceNode;
  const targetNode = normalizedConnection.targetNode;
  const sourceKind = normalizedConnection.sourceKind;
  const targetKind = normalizedConnection.targetKind;
  const normalizedEdge = normalizedConnection.edge;
  const taskFlowEdgeTypes = workflowEdgeTypesForTaskFlow();

  if (sourceKind === 'task' && targetKind === 'task') {
    const sourceTaskId = workflowTaskIdFromNode(sourceNode);
    const targetTaskId = workflowTaskIdFromNode(targetNode);

    if (sourceTaskId && targetTaskId && sourceTaskId === targetTaskId) {
      return {
        document: graph,
        issues: [
          workflowGraphConnectionIssue(
            edge,
            'workflow.selfDependency',
            'A task cannot depend on itself.'
          ),
        ],
      };
    }

    const duplicateEdge = graph.edges.find(
      (candidate) =>
        candidate.id !== normalizedEdge.id &&
        candidate.source === normalizedEdge.source &&
        candidate.target === normalizedEdge.target &&
        taskFlowEdgeTypes.has(candidate.type)
    );
    const duplicateRouteNode = graph.nodes.find(
      (candidate) =>
        candidate.type === workflowGraphNodeTypes.router &&
        getNodeDataString(candidate, 'sourceTaskId') === sourceTaskId &&
        getNodeDataString(candidate, 'targetTaskId') === targetTaskId
    );

    if (duplicateEdge || duplicateRouteNode) {
      return {
        document: graph,
        issues: [
          workflowGraphConnectionIssue(
            edge,
            'workflow.duplicateDependency',
            'A dependency already exists between these tasks.'
          ),
        ],
      };
    }

    const nextEdge: GraphEdge = {
      ...normalizedEdge,
      id: createGraphEdgeId({
        source: normalizedEdge.source,
        target: normalizedEdge.target,
        sourceHandle: normalizedEdge.sourceHandle,
        targetHandle: normalizedEdge.targetHandle,
        type: workflowGraphEdgeTypes.dependency,
      }),
      type: workflowGraphEdgeTypes.dependency,
      style: workflowGraphEdgeStyle(workflowGraphEdgeTypes.dependency),
      data: workflowGraphNodeData({
        ...(edge.data ?? {}),
        sourceTaskId,
        targetTaskId,
        edgeType: 'default',
      }),
    };

    return {
      document: {
        ...graph,
        edges: [...graph.edges, nextEdge],
      },
      issues: [],
    };
  }

  if (sourceKind === 'agent' && targetKind === 'task') {
    const sourceAgentId = workflowAgentIdFromNode(sourceNode);
    const targetTaskId = workflowTaskIdFromNode(targetNode);
    const nextEdge: GraphEdge = {
      ...normalizedEdge,
      id: createGraphEdgeId({
        source: normalizedEdge.source,
        target: normalizedEdge.target,
        sourceHandle: normalizedEdge.sourceHandle,
        targetHandle: normalizedEdge.targetHandle,
        type: workflowGraphEdgeTypes.assignment,
      }),
      type: workflowGraphEdgeTypes.assignment,
      style: workflowGraphEdgeStyle(workflowGraphEdgeTypes.assignment),
      data: workflowGraphNodeData({
        agentId: sourceAgentId,
        taskId: targetTaskId,
      }),
    };

    return {
      document: {
        ...graph,
        nodes: replaceNodeData(graph, normalizedEdge.target, { agentId: sourceAgentId }),
        edges: [
          ...graph.edges.filter(
            (candidate) =>
              candidate.type !== workflowGraphEdgeTypes.assignment ||
              candidate.target !== normalizedEdge.target
          ),
          nextEdge,
        ],
      },
      issues: [],
    };
  }

  if (sourceKind === 'tool' && targetKind === 'agent') {
    const sourceToolIds = workflowToolIdsFromNode(sourceNode);
    const targetAgentId = workflowAgentIdFromNode(targetNode);

    if (!targetAgentId) {
      return {
        document: graph,
        issues: [
          workflowGraphConnectionIssue(
            edge,
            'workflow.invalidToolAccess',
            'Tool access requires a valid tool node and agent node.'
          ),
        ],
      };
    }

    const nextEdge: GraphEdge = {
      ...normalizedEdge,
      id: createGraphEdgeId({
        source: normalizedEdge.source,
        target: normalizedEdge.target,
        sourceHandle: normalizedEdge.sourceHandle,
        targetHandle: normalizedEdge.targetHandle,
        type: workflowGraphEdgeTypes.tool,
      }),
      type: workflowGraphEdgeTypes.tool,
      style: workflowGraphEdgeStyle(workflowGraphEdgeTypes.tool),
      data: workflowGraphNodeData({
        toolIds: sourceToolIds,
        toolCount: sourceToolIds.length,
        ...(sourceToolIds.length === 1 ? { toolId: sourceToolIds[0] } : {}),
        agentId: targetAgentId,
        toolNodeId: workflowToolNodeIdFromNode(sourceNode),
      }),
    };

    return {
      document: {
        ...graph,
        edges: [
          ...graph.edges.filter(
            (candidate) =>
              candidate.id !== normalizedEdge.id &&
              (candidate.type !== workflowGraphEdgeTypes.tool ||
                candidate.source !== normalizedEdge.source)
          ),
          nextEdge,
        ],
      },
      issues: [],
    };
  }

  if (sourceKind === 'memory' && (targetKind === 'agent' || targetKind === 'task')) {
    const sourceMemoryId = workflowMemoryIdFromNode(sourceNode);
    const targetAgentId = workflowAgentIdFromNode(targetNode);
    const targetTaskId = workflowTaskIdFromNode(targetNode);

    if (!sourceMemoryId || (!targetAgentId && !targetTaskId)) {
      return {
        document: graph,
        issues: [
          workflowGraphConnectionIssue(
            edge,
            'workflow.invalidMemoryAccess',
            'Memory access requires a valid memory node and agent or task node.'
          ),
        ],
      };
    }

    const duplicateEdge = graph.edges.find(
      (candidate) =>
        candidate.id !== normalizedEdge.id &&
        candidate.source === normalizedEdge.source &&
        candidate.target === normalizedEdge.target &&
        candidate.type === workflowGraphEdgeTypes.memory
    );

    if (duplicateEdge) {
      return {
        document: graph,
        issues: [
          workflowGraphConnectionIssue(
            edge,
            'workflow.duplicateMemoryAccess',
            'This memory is already linked to this node.'
          ),
        ],
      };
    }

    const nextEdge: GraphEdge = {
      ...normalizedEdge,
      id: createGraphEdgeId({
        source: normalizedEdge.source,
        target: normalizedEdge.target,
        sourceHandle: normalizedEdge.sourceHandle,
        targetHandle: normalizedEdge.targetHandle,
        type: workflowGraphEdgeTypes.memory,
      }),
      type: workflowGraphEdgeTypes.memory,
      style: workflowGraphEdgeStyle(workflowGraphEdgeTypes.memory),
      data: workflowGraphNodeData({
        memoryId: sourceMemoryId,
        agentId: targetAgentId,
        taskId: targetTaskId,
        targetKind,
        access: 'read_write',
      }),
      metadata: {
        ...(normalizedEdge.metadata ?? {}),
        access: 'read_write',
      },
    };

    return {
      document: {
        ...graph,
        edges: [...graph.edges, nextEdge],
      },
      issues: [],
    };
  }

  if (sourceKind === 'task' && targetKind === 'artifact') {
    const sourceTaskId = workflowTaskIdFromNode(sourceNode);
    const targetArtifactId = workflowArtifactIdFromNode(targetNode);

    if (!sourceTaskId || !targetArtifactId) {
      return {
        document: graph,
        issues: [
          workflowGraphConnectionIssue(
            edge,
            'workflow.invalidArtifactProducer',
            'Artifact outputs require a valid task node and artifact node.'
          ),
        ],
      };
    }

    const duplicateEdge = graph.edges.find(
      (candidate) =>
        candidate.id !== normalizedEdge.id &&
        candidate.target === normalizedEdge.target &&
        candidate.type === workflowGraphEdgeTypes.dataFlow
    );

    if (duplicateEdge) {
      return {
        document: graph,
        issues: [
          workflowGraphConnectionIssue(
            edge,
            'workflow.duplicateArtifactProducer',
            'This artifact already has a producing task.'
          ),
        ],
      };
    }

    const nextEdge: GraphEdge = {
      ...normalizedEdge,
      id: createGraphEdgeId({
        source: normalizedEdge.source,
        target: normalizedEdge.target,
        sourceHandle: normalizedEdge.sourceHandle,
        targetHandle: normalizedEdge.targetHandle,
        type: workflowGraphEdgeTypes.dataFlow,
      }),
      type: workflowGraphEdgeTypes.dataFlow,
      label: 'produces',
      style: workflowGraphEdgeStyle(workflowGraphEdgeTypes.dataFlow),
      data: workflowGraphNodeData({
        sourceTaskId,
        artifactId: targetArtifactId,
        edgeType: 'artifact',
      }),
      metadata: {
        ...(normalizedEdge.metadata ?? {}),
        access: 'write',
      },
    };

    return {
      document: {
        ...graph,
        nodes: replaceNodeData(graph, normalizedEdge.target, { producerTaskId: sourceTaskId }),
        edges: [...graph.edges, nextEdge],
      },
      issues: [],
    };
  }

  return {
    document: graph,
    issues: [
      workflowGraphConnectionIssue(
        edge,
        'workflow.unsupportedConnection',
        'This connection is not supported. Connect agent to task, task to task, tool to agent, memory to agent/task, or task to artifact.'
      ),
    ],
  };
}

export function workflowDefinitionToGraphDocument(
  workflow: WorkflowDefinition,
  options: WorkflowGraphAdapterOptions = {}
): GraphDocument {
  const includeAgents = options.includeAgents ?? true;
  const includeTools = options.includeTools ?? true;
  const includeMemories = options.includeMemories ?? true;
  const agents = includeAgents ? (workflow.agent_definitions ?? []) : [];
  const tasks = workflow.task_definitions ?? [];
  const workflowTools = workflow.tool_definitions ?? [];
  const workflowToolById = new Map(workflowTools.map((tool) => [tool.id, tool]));
  const workflowToolIds = new Set(workflowTools.map((tool) => tool.id));
  const externalTools = (options.toolDefinitions ?? []).filter(
    (tool) => !workflowToolIds.has(tool.id)
  );
  const tools = includeTools ? [...workflowTools, ...externalTools] : [];
  const displayTools = includeTools
    ? [...workflowTools, ...(options.toolDefinitions ?? [])]
    : workflowTools;
  const toolById = new Map(displayTools.map((tool) => [tool.id, tool]));
  const toolNodeRecords = includeTools ? workflowGraphToolNodeRecordsFor(workflow, tools) : [];
  const memories = includeMemories ? workflowMemoryDefinitionsFor(workflow) : [];
  const artifacts = workflowArtifactDefinitionsFor(workflow);
  const approvalTasks = tasks.filter((task) => task.human_approval_required);
  const routerEdges = (workflow.edges ?? []).filter(
    (edge) =>
      workflowTaskIdForNodeId(workflow, edge.source_node_id) !==
        workflowTaskIdForNodeId(workflow, edge.target_node_id) &&
      (edge.condition || (edge.edge_type && edge.edge_type !== 'default'))
  );
  const toolNodes = toolNodeRecords.map((record, index) =>
    createToolListNode(record, toolById, workflowToolById, index)
  );
  const modelProfileNameById = new Map(
    (options.modelProfiles ?? []).map((profile) => [profile.id, profile.name])
  );

  return normalizeWorkflowGraphForPersistence(
    applyWorkflowGraphMinimumSpacing(
      workflowGraphDefinition.createDocument({
        id: workflow.id,
        title: workflow.name,
        description: workflow.description ?? undefined,
        nodes: [
          ...agents.map((agent, index) => createAgentNode(agent, index, modelProfileNameById)),
          ...tasks.map((task, index) => createTaskNode(task, workflow, index)),
          ...toolNodes,
          ...memories.map(createMemoryNode),
          ...artifacts.map(createArtifactNode),
          ...approvalTasks.map((task, index) => createApprovalNode(task, workflow, index)),
          ...routerEdges.map((edge, index) => createRouterNode(edge, workflow, index)),
        ],
        edges: [
          ...createDependencyEdges(workflow),
          ...(includeAgents ? createAssignmentEdges(workflow) : []),
          ...(includeTools ? createToolEdges(toolNodeRecords) : []),
          ...(includeMemories ? createMemoryEdges(workflow) : []),
          ...createArtifactEdges(workflow, artifacts),
          ...createApprovalEdges(approvalTasks),
        ],
        metadata: {
          source: 'workflowDefinition',
          workflowId: workflow.id,
          includeAgents,
          includeTools,
          includeMemories,
          entrypoint: workflow.entrypoint ?? null,
        },
      })
    )
  );
}

function graphIssueForWorkflowDraftIssue(
  graph: GraphDocument,
  workflow: WorkflowDefinition,
  message: string,
  index: number
): WorkflowGraphValidationIssue {
  const taskMatch = message.match(/Task "([^"]+)"/);
  const agentNameIssue = /Each agent must have a name/i.test(message);
  const taskNameIssue = /Each task must have a name/i.test(message);
  const edgeMatch = message.match(/Edge (?:condition|metadata) for "([^"]+)" -> "([^"]+)"/);

  const targetTask = taskMatch
    ? (workflow.task_definitions ?? []).find(
        (task) => task.name === taskMatch[1] || task.id === taskMatch[1]
      )
    : taskNameIssue
      ? (workflow.task_definitions ?? []).find((task) => !task.name?.trim())
      : undefined;
  const targetAgent = agentNameIssue
    ? (workflow.agent_definitions ?? []).find((agent) => !agent.name?.trim())
    : undefined;
  const sourceTask = edgeMatch
    ? (workflow.task_definitions ?? []).find(
        (task) => task.name === edgeMatch[1] || task.id === edgeMatch[1]
      )
    : undefined;
  const targetEdgeTask = edgeMatch
    ? (workflow.task_definitions ?? []).find(
        (task) => task.name === edgeMatch[2] || task.id === edgeMatch[2]
      )
    : undefined;
  const targetEdge =
    sourceTask && targetEdgeTask
      ? (graph.edges.find(
          (edge) =>
            getGraphEdgeDataString(edge, 'sourceTaskId') === sourceTask.id &&
            getGraphEdgeDataString(edge, 'targetTaskId') === targetEdgeTask.id
        ) ??
        graph.edges.find((edge) => {
          const sourceNode = graph.nodes.find((node) => node.id === edge.source);
          const targetNode = graph.nodes.find((node) => node.id === edge.target);
          return (
            workflowTaskIdFromNode(sourceNode) === sourceTask.id &&
            workflowTaskIdFromNode(targetNode) === targetEdgeTask.id
          );
        }))
      : undefined;
  const targetNode = targetTask
    ? graph.nodes.find((node) => workflowTaskIdFromNode(node) === targetTask.id)
    : targetAgent
      ? graph.nodes.find((node) => workflowAgentIdFromNode(node) === targetAgent.id)
      : undefined;

  return {
    id: `workflow-draft-${index}`,
    severity: 'error',
    code: 'workflow.draftValidation',
    message,
    target: targetEdge ? 'edge' : targetNode ? 'node' : 'document',
    targetId: targetEdge?.id ?? targetNode?.id,
    workflowReference: targetTask
      ? { kind: 'task', id: targetTask.id }
      : targetAgent
        ? { kind: 'agent', id: targetAgent.id }
        : targetEdge
          ? { kind: 'edge', id: targetEdge.id }
          : { kind: 'workflow', id: workflow.id },
    workflowPath: targetTask
      ? `task_definitions[id=${targetTask.id}]`
      : targetAgent
        ? `agent_definitions[id=${targetAgent.id}]`
        : targetEdge
          ? `edges[id=${targetEdge.id}]`
          : `workflows[id=${workflow.id}]`,
  };
}

export function workflowDraftIssuesToGraphValidationIssues(
  graph: GraphDocument,
  workflow: WorkflowDefinition,
  draftIssues: string[]
): WorkflowGraphValidationIssue[] {
  return draftIssues.map((issue, index) =>
    graphIssueForWorkflowDraftIssue(graph, workflow, issue, index)
  );
}

export function graphDocumentToWorkflowDefinition(
  graph: GraphDocument,
  workflow: WorkflowDefinition
): WorkflowDefinition {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const taskNodeByTaskId = new Map(
    graph.nodes
      .filter((node) => node.type === workflowGraphNodeTypes.task)
      .map((node) => [workflowTaskIdFromNode(node), node])
      .filter((entry): entry is [string, GraphNode] => Boolean(entry[0]))
  );
  const agentNodeByAgentId = new Map(
    graph.nodes
      .filter((node) => node.type === workflowGraphNodeTypes.agent)
      .map((node) => [workflowAgentIdFromNode(node), node])
      .filter((entry): entry is [string, GraphNode] => Boolean(entry[0]))
  );
  const toolNodeByToolId = new Map(
    graph.nodes
      .filter((node) => node.type === workflowGraphNodeTypes.tool)
      .flatMap((node) => workflowToolIdsFromNode(node).map((toolId) => [toolId, node] as const))
      .filter((entry): entry is [string, GraphNode] => Boolean(entry[0]))
  );
  const memoryNodeByMemoryId = new Map(
    graph.nodes
      .filter((node) => node.type === workflowGraphNodeTypes.memory)
      .map((node) => [workflowMemoryIdFromNode(node), node])
      .filter((entry): entry is [string, GraphNode] => Boolean(entry[0]))
  );
  const artifactNodeByArtifactId = new Map(
    graph.nodes
      .filter((node) => node.type === workflowGraphNodeTypes.artifact)
      .map((node) => [workflowArtifactIdFromNode(node), node])
      .filter((entry): entry is [string, GraphNode] => Boolean(entry[0]))
  );
  const approvalNodeByTaskId = new Map(
    graph.nodes
      .filter((node) => node.type === workflowGraphNodeTypes.approval)
      .map((node) => [workflowTaskIdFromNode(node), node])
      .filter((entry): entry is [string, GraphNode] => Boolean(entry[0]))
  );

  const assignedAgentByTaskId = new Map<string, string>();
  const dependencyIdsByTaskId = new Map<string, string[]>();
  const toolIdsByAgentId = new Map<string, string[]>();
  const agentIdByToolNodeId = new Map<string, string>();
  const memoryIdsByAgentId = new Map<string, string[]>();
  const memoryIdsByTaskId = new Map<string, string[]>();
  const producerTaskIdByArtifactId = new Map<string, string>();
  const taskFlowEdgeTypes = workflowEdgeTypesForTaskFlow();

  for (const edge of graph.edges) {
    if (edge.type === workflowGraphEdgeTypes.assignment) {
      const sourceAgentId = workflowAgentIdFromNode(nodeById.get(edge.source));
      const targetTaskId = workflowTaskIdFromNode(nodeById.get(edge.target));
      if (sourceAgentId && targetTaskId) {
        assignedAgentByTaskId.set(targetTaskId, sourceAgentId);
      }
    }

    if (taskFlowEdgeTypes.has(edge.type)) {
      const sourceTaskId = workflowTaskIdFromNode(nodeById.get(edge.source));
      const targetTaskId = workflowTaskIdFromNode(nodeById.get(edge.target));
      const targetArtifactId = workflowArtifactIdFromNode(nodeById.get(edge.target));
      if (sourceTaskId && targetArtifactId) {
        producerTaskIdByArtifactId.set(targetArtifactId, sourceTaskId);
      }

      if (sourceTaskId && targetTaskId) {
        dependencyIdsByTaskId.set(
          targetTaskId,
          uniqueStrings([...(dependencyIdsByTaskId.get(targetTaskId) ?? []), sourceTaskId])
        );
      }
    }

    if (edge.type === workflowGraphEdgeTypes.tool) {
      const sourceNode = nodeById.get(edge.source);
      const sourceToolIds = workflowToolIdsFromEdge(edge, sourceNode);
      const targetAgentId = workflowAgentIdFromNode(nodeById.get(edge.target));
      if (sourceToolIds.length > 0 && targetAgentId) {
        const currentToolIds = toolIdsByAgentId.get(targetAgentId) ?? [];
        toolIdsByAgentId.set(targetAgentId, uniqueStrings([...currentToolIds, ...sourceToolIds]));
      }

      const sourceToolNodeId = workflowToolNodeRecordIdFromNode(sourceNode);
      if (sourceToolNodeId && targetAgentId) {
        agentIdByToolNodeId.set(sourceToolNodeId, targetAgentId);
      }
    }

    if (edge.type === workflowGraphEdgeTypes.memory) {
      const sourceMemoryId = workflowMemoryIdFromNode(nodeById.get(edge.source));
      const targetAgentId = workflowAgentIdFromNode(nodeById.get(edge.target));
      const targetTaskId = workflowTaskIdFromNode(nodeById.get(edge.target));

      if (sourceMemoryId && targetAgentId) {
        const currentMemoryIds = memoryIdsByAgentId.get(targetAgentId) ?? [];
        if (!currentMemoryIds.includes(sourceMemoryId)) {
          memoryIdsByAgentId.set(targetAgentId, [...currentMemoryIds, sourceMemoryId]);
        }
      }

      if (sourceMemoryId && targetTaskId) {
        const currentMemoryIds = memoryIdsByTaskId.get(targetTaskId) ?? [];
        if (!currentMemoryIds.includes(sourceMemoryId)) {
          memoryIdsByTaskId.set(targetTaskId, [...currentMemoryIds, sourceMemoryId]);
        }
      }
    }
  }

  const routeEdgeRecords: WorkflowGraphRouteEdgeRecord[] = graph.nodes
    .filter((node) => node.type === workflowGraphNodeTypes.router)
    .flatMap((routerNode) => {
      const incomingRouteEdge = graph.edges.find(
        (edge) =>
          taskFlowEdgeTypes.has(edge.type) &&
          edge.target === routerNode.id &&
          Boolean(workflowTaskIdFromNode(nodeById.get(edge.source)))
      );
      const outgoingRouteEdge = graph.edges.find(
        (edge) =>
          taskFlowEdgeTypes.has(edge.type) &&
          edge.source === routerNode.id &&
          Boolean(workflowTaskIdFromNode(nodeById.get(edge.target)))
      );
      const sourceTaskId = workflowTaskIdFromNode(nodeById.get(incomingRouteEdge?.source ?? ''));
      const targetTaskId = workflowTaskIdFromNode(nodeById.get(outgoingRouteEdge?.target ?? ''));

      if (!sourceTaskId || !targetTaskId || sourceTaskId === targetTaskId) {
        return [];
      }

      dependencyIdsByTaskId.set(
        targetTaskId,
        uniqueStrings([...(dependencyIdsByTaskId.get(targetTaskId) ?? []), sourceTaskId])
      );

      return [
        {
          sourceTaskId,
          targetTaskId,
          edgeType:
            getGraphEdgeDataString(incomingRouteEdge, 'edgeType') ??
            getNodeDataString(routerNode, 'edgeType') ??
            (incomingRouteEdge?.type === workflowGraphEdgeTypes.condition
              ? 'conditional'
              : 'default'),
          condition:
            incomingRouteEdge?.label ??
            getNodeDataString(routerNode, 'condition') ??
            (incomingRouteEdge?.type === workflowGraphEdgeTypes.condition ? '' : null),
          metadata: toGraphJsonObject(incomingRouteEdge?.metadata),
        },
      ];
    });
  const routeEdgePairKeys = new Set(
    routeEdgeRecords.map((record) => taskPairKey(record.sourceTaskId, record.targetTaskId))
  );

  const existingTaskIds = new Set((workflow.task_definitions ?? []).map((task) => task.id));
  const existingAgentIds = new Set((workflow.agent_definitions ?? []).map((agent) => agent.id));
  const existingWorkflowToolById = new Map(
    (workflow.tool_definitions ?? []).map((tool) => [tool.id, tool])
  );
  const graphWorkflowOwnedToolById = new Map(
    graph.nodes
      .filter((node) => node.type === workflowGraphNodeTypes.tool)
      .flatMap((node) => workflowOwnedToolDefinitionsFromNode(node))
      .map((tool) => [tool.id, tool])
  );
  const graphIncludesAgents = graph.metadata?.includeAgents !== false;
  const graphIncludesTools = graph.metadata?.includeTools !== false;
  const graphIncludesMemories = graph.metadata?.includeMemories !== false;
  const graphAgentIds = new Set(agentNodeByAgentId.keys());

  const taskDefinitions: TaskDefinition[] = (workflow.task_definitions ?? [])
    .filter((task) => taskNodeByTaskId.has(task.id))
    .map((task) => {
      const node = taskNodeByTaskId.get(task.id);
      const nodeAgentId = nodeDataHasKey(node, 'agentId')
        ? getNodeDataString(node, 'agentId')
        : (task.agent_id ?? null);
      const assignedAgentId = assignedAgentByTaskId.has(task.id)
        ? (assignedAgentByTaskId.get(task.id) ?? null)
        : nodeAgentId;

      const taskRuntimeOverrides = nodeDataHasKey(node, 'taskRuntimeOverrides')
        ? normalizeWorkflowTaskRuntimeOverrides(getNodeDataJsonObject(node, 'taskRuntimeOverrides'))
        : workflowTaskRuntimeOverridesFromTask(task);
      const taskRuntimeOverridePatch = workflowTaskRuntimeOverridePatch(
        nodeDataHasKey(node, 'taskInputSources')
          ? workflowTaskMetadataWithInputSources(
              task.metadata,
              normalizeWorkflowTaskInputSources(getNodeDataStringArray(node, 'taskInputSources'))
            )
          : task.metadata,
        taskRuntimeOverrides
      );

      return {
        ...task,
        name: node?.label ?? task.name,
        description: node?.description ?? task.description,
        instructions: nodeDataHasKey(node, 'instructions')
          ? (getNodeDataString(node, 'instructions') ?? '')
          : task.instructions,
        expected_output: nodeDataHasKey(node, 'expectedOutput')
          ? (getNodeDataString(node, 'expectedOutput') ?? '')
          : task.expected_output,
        agent_id:
          graphIncludesAgents && assignedAgentId && !graphAgentIds.has(assignedAgentId)
            ? null
            : assignedAgentId,
        tool_ids: nodeDataHasKey(node, 'toolIds')
          ? getNodeDataStringArray(node, 'toolIds')
          : task.tool_ids,
        memory_ids: graphIncludesMemories
          ? (memoryIdsByTaskId.get(task.id) ?? [])
          : nodeDataHasKey(node, 'memoryIds')
            ? getNodeDataStringArray(node, 'memoryIds')
            : task.memory_ids,
        depends_on_task_ids: dependencyIdsByTaskId.get(task.id) ?? [],
        human_approval_required: nodeDataHasKey(node, 'humanApprovalRequired')
          ? (getNodeDataBoolean(node, 'humanApprovalRequired') ?? false)
          : task.human_approval_required,
        timeout_seconds: taskRuntimeOverridePatch.timeout_seconds,
        max_retries: taskRuntimeOverridePatch.max_retries,
        model_profile_id: taskRuntimeOverridePatch.model_profile_id,
        max_tokens: taskRuntimeOverridePatch.max_tokens,
        approval_policy: taskRuntimeOverridePatch.approval_policy,
        metadata: metadataWithApprovalGraphPosition(
          taskRuntimeOverridePatch.metadata,
          approvalNodeByTaskId.get(task.id)?.position
        ),
      };
    });

  for (const [taskId, node] of taskNodeByTaskId) {
    if (existingTaskIds.has(taskId)) {
      continue;
    }

    const taskDefinition = createTaskDefinitionFromGraphNode(
      node,
      taskDefinitions.length,
      assignedAgentByTaskId.get(taskId) ?? null,
      dependencyIdsByTaskId.get(taskId) ?? []
    );

    if (taskDefinition) {
      taskDefinitions.push({
        ...taskDefinition,
        memory_ids: graphIncludesMemories
          ? (memoryIdsByTaskId.get(taskDefinition.id) ?? [])
          : taskDefinition.memory_ids,
      });
    }
  }

  const agentDefinitions: AgentDefinition[] = (workflow.agent_definitions ?? [])
    .filter((agent) => !graphIncludesAgents || agentNodeByAgentId.has(agent.id))
    .map((agent) => {
      const node = agentNodeByAgentId.get(agent.id);
      return {
        ...agent,
        name: node?.label ?? agent.name,
        description: node?.description ?? agent.description,
        instructions: nodeDataHasKey(node, 'instructions')
          ? (getNodeDataString(node, 'instructions') ?? '')
          : agent.instructions,
        system_prompt: nodeDataHasKey(node, 'systemPrompt')
          ? (getNodeDataString(node, 'systemPrompt') ?? '')
          : agent.system_prompt,
        role: nodeDataHasKey(node, 'role') ? (getNodeDataString(node, 'role') ?? '') : agent.role,
        backstory: nodeDataHasKey(node, 'backstory')
          ? (getNodeDataString(node, 'backstory') ?? '')
          : agent.backstory,
        model_profile_id: nodeDataHasKey(node, 'modelProfileId')
          ? getNodeDataString(node, 'modelProfileId')
          : agent.model_profile_id,
        tool_ids: graphIncludesTools
          ? (toolIdsByAgentId.get(agent.id) ?? [])
          : nodeDataHasKey(node, 'toolIds')
            ? getNodeDataStringArray(node, 'toolIds')
            : (agent.tool_ids ?? agent.toolIds),
        memory_ids: graphIncludesMemories
          ? (memoryIdsByAgentId.get(agent.id) ?? [])
          : nodeDataHasKey(node, 'memoryIds')
            ? getNodeDataStringArray(node, 'memoryIds')
            : (agent.memory_ids ?? agent.memoryIds),
        handoff_agent_ids: nodeDataHasKey(node, 'handoffAgentIds')
          ? getNodeDataStringArray(node, 'handoffAgentIds')
          : (agent.handoff_agent_ids ?? agent.handoffAgentIds),
        guardrails: nodeDataHasKey(node, 'guardrails')
          ? normalizeWorkflowAgentGuardrails(getNodeDataJsonArray(node, 'guardrails'))
          : normalizeWorkflowAgentGuardrails(agent.guardrails),
        metadata: metadataWithGraphPosition(agent.metadata, node?.position),
      };
    });

  for (const [agentId, node] of agentNodeByAgentId) {
    if (existingAgentIds.has(agentId)) {
      continue;
    }

    const agentDefinition = createAgentDefinitionFromGraphNode(node, agentDefinitions.length);

    if (agentDefinition) {
      agentDefinitions.push({
        ...agentDefinition,
        tool_ids: graphIncludesTools
          ? (toolIdsByAgentId.get(agentDefinition.id) ?? [])
          : agentDefinition.tool_ids,
        memory_ids: graphIncludesMemories
          ? (memoryIdsByAgentId.get(agentDefinition.id) ?? [])
          : agentDefinition.memory_ids,
      });
    }
  }

  const toolDefinitions: ToolDefinition[] = graphIncludesTools
    ? Array.from(toolNodeByToolId.entries()).flatMap(([toolId, node], index) => {
        const existingTool = existingWorkflowToolById.get(toolId);
        const graphOwnedTool = graphWorkflowOwnedToolById.get(toolId);
        const baseTool =
          existingTool ?? graphOwnedTool ?? createWorkflowGraphDraftToolDefinition(index);
        const aggregateToolNode =
          node.id === workflowToolsAggregateNodeId ||
          Boolean(workflowToolNodeRecordIdFromNode(node)) ||
          workflowToolIdsFromNode(node).length > 1;
        const workflowOwned =
          existingTool ||
          graphOwnedTool ||
          getNodeDataStringArray(node, 'workflowOwnedToolIds').includes(toolId) ||
          node.data?.workflowOwned === true ||
          node.metadata?.created_from === 'workflow-graph-editor';

        if (!workflowOwned) {
          return [];
        }

        return [
          toolDefinitionWithBackendSecurityDefaults({
            ...baseTool,
            id: toolId,
            name: aggregateToolNode ? baseTool.name : node.label || existingTool?.name || toolId,
            display_name: aggregateToolNode
              ? baseTool.display_name
              : node.label || existingTool?.display_name || existingTool?.name || toolId,
            description: aggregateToolNode
              ? baseTool.description
              : (node.description ?? existingTool?.description ?? ''),
            tool_type: aggregateToolNode
              ? baseTool.tool_type
              : (getNodeDataString(node, 'toolType') ?? existingTool?.tool_type ?? 'workflow'),
            metadata: metadataWithGraphPosition(
              toGraphJsonObject(baseTool.metadata),
              node.position
            ),
          }),
        ];
      })
    : (workflow.tool_definitions ?? []);
  const existingMemoryById = new Map(
    workflowMemoryDefinitionsFor(workflow).map((memory) => [memory.id, memory])
  );
  const memoryDefinitions: WorkflowMemoryDefinition[] = graphIncludesMemories
    ? Array.from(memoryNodeByMemoryId.entries()).map(([memoryId, node], index) => {
        const existingMemory = existingMemoryById.get(memoryId);
        const baseMemory = existingMemory ?? createWorkflowGraphDraftMemoryDefinition(index);

        return {
          ...baseMemory,
          id: memoryId,
          name: node.label || existingMemory?.name || `Memory ${index + 1}`,
          description: node.description ?? existingMemory?.description ?? '',
          memory_type:
            getNodeDataString(node, 'memoryType') ?? existingMemory?.memory_type ?? 'workflow',
          scope: getNodeDataString(node, 'scope') ?? existingMemory?.scope ?? 'workflow',
          metadata: metadataWithGraphPosition(
            nodeMemoryCatalogMetadata(node, baseMemory.metadata),
            node.position
          ),
        };
      })
    : workflowMemoryDefinitionsFor(workflow);
  const existingArtifactById = new Map(
    workflowArtifactDefinitionsFor(workflow).map((artifact) => [artifact.id, artifact])
  );
  const artifactDefinitions: WorkflowArtifactDefinition[] = Array.from(
    artifactNodeByArtifactId.entries()
  ).map(([artifactId, node], index) => {
    const existingArtifact = existingArtifactById.get(artifactId);
    const baseArtifact = existingArtifact ?? createWorkflowGraphDraftArtifactDefinition(index);

    return {
      ...baseArtifact,
      id: artifactId,
      name: node.label || existingArtifact?.name || `Artifact ${index + 1}`,
      description: node.description ?? existingArtifact?.description ?? '',
      artifact_type:
        getNodeDataString(node, 'artifactType') ?? existingArtifact?.artifact_type ?? 'output',
      media_type: getNodeDataString(node, 'mediaType') ?? existingArtifact?.media_type ?? null,
      producer_task_id:
        producerTaskIdByArtifactId.get(artifactId) ??
        getNodeDataString(node, 'producerTaskId') ??
        existingArtifact?.producer_task_id ??
        null,
      metadata: metadataWithGraphPosition(toGraphJsonObject(baseArtifact.metadata), node.position),
    };
  });

  const retainedAgentIds = new Set(agentDefinitions.map((agent) => agent.id));
  const finalTaskDefinitions = graphIncludesAgents
    ? taskDefinitions.map((task) => ({
        ...task,
        agent_id: task.agent_id && retainedAgentIds.has(task.agent_id) ? task.agent_id : null,
      }))
    : taskDefinitions;
  const finalTaskIds = new Set(finalTaskDefinitions.map((task) => task.id));
  const entrypointTaskId = workflowTaskIdFromEntrypoint(workflow.entrypoint, workflow);
  const entrypoint =
    entrypointTaskId && finalTaskIds.has(entrypointTaskId) ? workflow.entrypoint : undefined;

  const existingWorkflowNodeByTaskId = new Map(
    (workflow.nodes ?? [])
      .filter((node) => typeof node.task_id === 'string')
      .map((node) => [node.task_id as string, node])
  );

  const nodes: WorkflowNodeDefinition[] = finalTaskDefinitions.map((task) => {
    const graphNode = taskNodeByTaskId.get(task.id);
    const existingNode = existingWorkflowNodeByTaskId.get(task.id);
    const position = graphNode?.position
      ? { x: graphNode.position.x, y: graphNode.position.y }
      : undefined;

    return {
      id: existingNode?.id ?? `node-${task.id}`,
      name: task.name,
      node_type: existingNode?.node_type ?? 'task',
      task_id: task.id,
      agent_id: task.agent_id ?? null,
      metadata: {
        ...(existingNode?.metadata ?? {}),
        generated_by: 'workflow-graph-adapter',
        ...(position ? { position } : {}),
      },
    };
  });
  const nodeIdByTaskId = new Map(nodes.map((node) => [node.task_id as string, node.id]));
  const directTaskEdges: WorkflowEdgeDefinition[] = graph.edges
    .filter((edge) => taskFlowEdgeTypes.has(edge.type))
    .flatMap((edge) => {
      const sourceTaskId = workflowTaskIdFromNode(nodeById.get(edge.source));
      const targetTaskId = workflowTaskIdFromNode(nodeById.get(edge.target));
      if (
        !sourceTaskId ||
        !targetTaskId ||
        sourceTaskId === targetTaskId ||
        routeEdgePairKeys.has(taskPairKey(sourceTaskId, targetTaskId))
      ) {
        return [];
      }

      return [
        {
          id: `edge-${nodeIdByTaskId.get(sourceTaskId)}-${nodeIdByTaskId.get(targetTaskId)}`,
          source_node_id: nodeIdByTaskId.get(sourceTaskId) ?? `node-${sourceTaskId}`,
          target_node_id: nodeIdByTaskId.get(targetTaskId) ?? `node-${targetTaskId}`,
          edge_type:
            edge.type === workflowGraphEdgeTypes.condition
              ? 'conditional'
              : typeof edge.data?.edgeType === 'string'
                ? edge.data.edgeType
                : 'default',
          condition: edge.label ?? null,
          metadata: toGraphJsonObject(edge.metadata),
        },
      ];
    });
  const routeWorkflowEdges: WorkflowEdgeDefinition[] = routeEdgeRecords.flatMap((record) => {
    const sourceNodeId = nodeIdByTaskId.get(record.sourceTaskId);
    const targetNodeId = nodeIdByTaskId.get(record.targetTaskId);

    if (!sourceNodeId || !targetNodeId) {
      return [];
    }

    return [
      {
        id: `edge-${sourceNodeId}-${targetNodeId}`,
        source_node_id: sourceNodeId,
        target_node_id: targetNodeId,
        edge_type: record.edgeType,
        condition: record.condition,
        metadata: record.metadata,
      },
    ];
  });
  const edges: WorkflowEdgeDefinition[] = [...directTaskEdges, ...routeWorkflowEdges];
  const graphToolNodeRecords: WorkflowGraphToolNodeRecord[] = graphIncludesTools
    ? graph.nodes
        .filter((node) => node.type === workflowGraphNodeTypes.tool)
        .flatMap((node) => {
          const id = workflowToolNodeRecordIdFromNode(node);
          if (!id) {
            return [];
          }

          return [
            {
              id,
              toolIds: workflowToolIdsFromNode(node),
              toolNames: getNodeDataStringArray(node, 'toolNames'),
              agentId: agentIdByToolNodeId.get(id) ?? null,
              position: node.position,
            },
          ];
        })
    : workflowGraphToolNodeRecordsFor(workflow, workflow.tool_definitions ?? []);

  const metadataWithToolNodes = workflowMetadataWithToolNodeRecords(
    workflow.metadata,
    graphToolNodeRecords
  );

  return {
    ...workflow,
    entrypoint,
    agent_definitions: agentDefinitions,
    task_definitions: finalTaskDefinitions,
    tool_definitions: toolDefinitions,
    memory_definitions: memoryDefinitions,
    metadata: workflowMetadataWithArtifactDefinitions(metadataWithToolNodes, artifactDefinitions),
    nodes,
    edges,
  };
}

function workflowGraphConversionIssue(
  code: string,
  message: string,
  target: 'node' | 'edge' | 'document',
  options: {
    targetId?: string;
    path?: string;
    workflowReference?: WorkflowGraphValidationIssue['workflowReference'];
  } = {}
): WorkflowGraphValidationIssue {
  return {
    id: `${code}-${options.targetId ?? target}`,
    severity: 'error',
    code,
    message,
    target,
    targetId: options.targetId,
    path: options.path,
    workflowReference: options.workflowReference,
    workflowPath: workflowPathForReference(options.workflowReference),
  };
}

export function validateWorkflowGraphConversionSafety(
  graph: GraphDocument
): WorkflowGraphValidationIssue[] {
  const issues: WorkflowGraphValidationIssue[] = [];
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const taskNodeIds = new Set(
    graph.nodes
      .filter((node) => node.type === workflowGraphNodeTypes.task)
      .map((node) => workflowTaskIdFromNode(node))
      .filter((taskId): taskId is string => Boolean(taskId))
  );
  const taskFlowEdgeTypes = workflowEdgeTypesForTaskFlow();

  graph.nodes.forEach((node, index) => {
    if (!Object.values(workflowGraphNodeTypes).includes(node.type as WorkflowGraphNodeType)) {
      return;
    }

    if (node.type === workflowGraphNodeTypes.task && !workflowTaskIdFromNode(node)) {
      issues.push(
        workflowGraphConversionIssue(
          'workflow.conversionTaskMissingId',
          `Task node "${node.label || node.id}" is missing a task id and cannot be saved to the workflow definition.`,
          'node',
          {
            targetId: node.id,
            path: `nodes.${index}.data.taskId`,
            workflowReference: workflowReferenceForNode(node),
          }
        )
      );
    }

    if (node.type === workflowGraphNodeTypes.agent && !workflowAgentIdFromNode(node)) {
      issues.push(
        workflowGraphConversionIssue(
          'workflow.conversionAgentMissingId',
          `Agent node "${node.label || node.id}" is missing an agent id and cannot be saved to the workflow definition.`,
          'node',
          {
            targetId: node.id,
            path: `nodes.${index}.data.agentId`,
            workflowReference: workflowReferenceForNode(node),
          }
        )
      );
    }

    if (node.type === workflowGraphNodeTypes.memory && !workflowMemoryIdFromNode(node)) {
      issues.push(
        workflowGraphConversionIssue(
          'workflow.conversionMemoryMissingId',
          `Memory node "${node.label || node.id}" is missing a memory id and cannot be saved to the workflow definition.`,
          'node',
          {
            targetId: node.id,
            path: `nodes.${index}.data.memoryId`,
            workflowReference: workflowReferenceForNode(node),
          }
        )
      );
    }

    if (node.type === workflowGraphNodeTypes.artifact && !workflowArtifactIdFromNode(node)) {
      issues.push(
        workflowGraphConversionIssue(
          'workflow.conversionArtifactMissingId',
          `Artifact node "${node.label || node.id}" is missing an artifact id and cannot be saved to the workflow definition.`,
          'node',
          {
            targetId: node.id,
            path: `nodes.${index}.data.artifactId`,
            workflowReference: workflowReferenceForNode(node),
          }
        )
      );
    }

    if (node.type === workflowGraphNodeTypes.approval) {
      const taskId = workflowTaskIdFromNode(node);
      if (!taskId || !taskNodeIds.has(taskId)) {
        issues.push(
          workflowGraphConversionIssue(
            'workflow.conversionApprovalMissingTask',
            `Approval node "${node.label || node.id}" must be tied to an existing task before it can be saved.`,
            'node',
            {
              targetId: node.id,
              path: `nodes.${index}.data.taskId`,
              workflowReference: workflowReferenceForNode(node),
            }
          )
        );
      }
    }

    if (node.type === workflowGraphNodeTypes.router) {
      const incomingRouteEdges = graph.edges.filter(
        (edge) =>
          taskFlowEdgeTypes.has(edge.type) &&
          edge.target === node.id &&
          workflowTaskIdFromNode(nodeById.get(edge.source))
      );
      const outgoingRouteEdges = graph.edges.filter(
        (edge) =>
          taskFlowEdgeTypes.has(edge.type) &&
          edge.source === node.id &&
          workflowTaskIdFromNode(nodeById.get(edge.target))
      );

      if (incomingRouteEdges.length !== 1 || outgoingRouteEdges.length !== 1) {
        issues.push(
          workflowGraphConversionIssue(
            'workflow.conversionRouterIncomplete',
            `Router node "${node.label || node.id}" must have exactly one incoming task route and one outgoing task route before it can be saved.`,
            'node',
            {
              targetId: node.id,
              path: `nodes.${index}`,
              workflowReference: workflowReferenceForNode(node),
            }
          )
        );
      }
    }
  });

  graph.edges.forEach((edge, index) => {
    if (!taskFlowEdgeTypes.has(edge.type)) {
      return;
    }

    const sourceKind = workflowGraphNodeKind(nodeById.get(edge.source));
    const targetKind = workflowGraphNodeKind(nodeById.get(edge.target));
    const isPersistableTaskFlow =
      (sourceKind === 'task' && targetKind === 'task') ||
      (sourceKind === 'task' &&
        targetKind === 'artifact' &&
        edge.type === workflowGraphEdgeTypes.dataFlow) ||
      (sourceKind === 'task' &&
        nodeById.get(edge.target)?.type === workflowGraphNodeTypes.router) ||
      (nodeById.get(edge.source)?.type === workflowGraphNodeTypes.router && targetKind === 'task');

    if (!isPersistableTaskFlow) {
      issues.push(
        workflowGraphConversionIssue(
          'workflow.conversionUnsupportedTaskFlow',
          `Edge "${edge.label || edge.id}" uses a task-flow edge type between nodes that cannot be saved as workflow task flow.`,
          'edge',
          {
            targetId: edge.id,
            path: `edges.${index}`,
            workflowReference: { kind: 'edge', id: edge.id },
          }
        )
      );
    }
  });

  return issues;
}

export function validateWorkflowGraphDocument(
  graph: GraphDocument
): WorkflowGraphValidationIssue[] {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const baseIssues = workflowGraphDefinition.validate(graph).map((issue) => {
    let workflowReference: WorkflowGraphValidationIssue['workflowReference'];

    if (issue.target === 'node') {
      workflowReference = workflowReferenceForNode(nodeById.get(issue.targetId ?? ''));
    } else if (issue.target === 'edge') {
      workflowReference = { kind: 'edge', id: issue.targetId };
    } else {
      workflowReference = { kind: 'workflow', id: graph.id };
    }

    return {
      ...issue,
      workflowReference,
      workflowPath: workflowPathForReference(workflowReference),
    };
  });
  const edgeIssues = graph.edges.flatMap((edge) => {
    const sourceKind = workflowGraphNodeKind(nodeById.get(edge.source));
    const targetKind = workflowGraphNodeKind(nodeById.get(edge.target));

    if (
      edge.type === workflowGraphEdgeTypes.tool &&
      !(sourceKind === 'tool' && targetKind === 'agent')
    ) {
      return [
        workflowGraphConnectionIssue(
          edge,
          'workflow.invalidToolAccess',
          'Tool access edges can only connect a tool node to an agent node.'
        ),
      ];
    }

    if (
      edge.type === workflowGraphEdgeTypes.tool &&
      graph.edges.some(
        (candidate) =>
          candidate.id !== edge.id &&
          candidate.type === workflowGraphEdgeTypes.tool &&
          candidate.source === edge.source
      )
    ) {
      return [
        workflowGraphConnectionIssue(
          edge,
          'workflow.duplicateToolNodeAgent',
          'A tool node can only connect to one agent.'
        ),
      ];
    }

    if (
      (sourceKind === 'tool' || targetKind === 'tool') &&
      edge.type !== workflowGraphEdgeTypes.tool
    ) {
      return [
        workflowGraphConnectionIssue(
          edge,
          'workflow.unsupportedToolConnection',
          'Tool nodes can only connect to agent nodes with a tool access edge.'
        ),
      ];
    }

    if (
      edge.type === workflowGraphEdgeTypes.memory &&
      !(sourceKind === 'memory' && (targetKind === 'agent' || targetKind === 'task'))
    ) {
      return [
        workflowGraphConnectionIssue(
          edge,
          'workflow.invalidMemoryAccess',
          'Memory access edges can only connect a memory node to an agent or task node.'
        ),
      ];
    }

    if (
      (sourceKind === 'memory' || targetKind === 'memory') &&
      edge.type !== workflowGraphEdgeTypes.memory
    ) {
      return [
        workflowGraphConnectionIssue(
          edge,
          'workflow.unsupportedMemoryConnection',
          'Memory nodes can only connect to agent or task nodes with a memory access edge.'
        ),
      ];
    }

    if (edge.type === workflowGraphEdgeTypes.approval) {
      const sourceTaskId = workflowTaskIdFromNode(nodeById.get(edge.source));
      const targetTaskId = workflowTaskIdFromNode(nodeById.get(edge.target));
      if (!(sourceKind === 'task' && targetKind === 'approval' && sourceTaskId === targetTaskId)) {
        return [
          workflowGraphConnectionIssue(
            edge,
            'workflow.invalidApprovalGate',
            'Approval gate edges can only connect a task node to its derived approval node.'
          ),
        ];
      }
    }

    if (
      (sourceKind === 'approval' || targetKind === 'approval') &&
      edge.type !== workflowGraphEdgeTypes.approval
    ) {
      return [
        workflowGraphConnectionIssue(
          edge,
          'workflow.unsupportedApprovalConnection',
          'Approval nodes are derived from task approval settings and only connect to their owning task.'
        ),
      ];
    }

    if (
      edge.type === workflowGraphEdgeTypes.dataFlow &&
      (sourceKind === 'artifact' || targetKind === 'artifact') &&
      !(sourceKind === 'task' && targetKind === 'artifact')
    ) {
      return [
        workflowGraphConnectionIssue(
          edge,
          'workflow.invalidArtifactProducer',
          'Artifact data-flow edges can only connect a task node to an artifact node.'
        ),
      ];
    }

    if (
      (sourceKind === 'artifact' || targetKind === 'artifact') &&
      edge.type !== workflowGraphEdgeTypes.dataFlow
    ) {
      return [
        workflowGraphConnectionIssue(
          edge,
          'workflow.unsupportedArtifactConnection',
          'Artifact nodes can only connect from task nodes with a data-flow edge.'
        ),
      ];
    }

    return [];
  });

  return [...baseIssues, ...edgeIssues];
}

function workflowResourceIssue(
  id: string,
  code: string,
  message: string,
  workflowReference: WorkflowGraphValidationIssue['workflowReference'],
  targetId?: string
): WorkflowGraphValidationIssue {
  return {
    id,
    severity: 'warning',
    code,
    message,
    target: targetId ? 'node' : 'document',
    targetId,
    workflowReference,
    workflowPath: workflowPathForReference(workflowReference),
  };
}

export function validateWorkflowResourceReferences(
  workflow: WorkflowDefinition,
  graph: GraphDocument = workflowDefinitionToGraphDocument(workflow),
  options: WorkflowResourceValidationOptions = {}
): WorkflowGraphValidationIssue[] {
  const issues: WorkflowGraphValidationIssue[] = [];
  const agentIds = new Set((workflow.agent_definitions ?? []).map((agent) => agent.id));
  const taskIds = new Set((workflow.task_definitions ?? []).map((task) => task.id));
  const workflowToolIds = new Set((workflow.tool_definitions ?? []).map((tool) => tool.id));
  const availableToolIds = new Set([
    ...workflowToolIds,
    ...(options.toolDefinitions ?? []).map((tool) => tool.id),
  ]);
  const memoryIds = new Set(workflowMemoryDefinitionsFor(workflow).map((memory) => memory.id));
  const taskNodeByTaskId = new Map(
    graph.nodes
      .filter((node) => node.type === workflowGraphNodeTypes.task)
      .map((node) => [workflowTaskIdFromNode(node), node])
      .filter((entry): entry is [string, GraphNode] => Boolean(entry[0]))
  );
  const agentNodeByAgentId = new Map(
    graph.nodes
      .filter((node) => node.type === workflowGraphNodeTypes.agent)
      .map((node) => [workflowAgentIdFromNode(node), node])
      .filter((entry): entry is [string, GraphNode] => Boolean(entry[0]))
  );

  for (const task of workflow.task_definitions ?? []) {
    const taskLabel = task.name?.trim() || task.id;
    const taskNode = taskNodeByTaskId.get(task.id);
    const taskReference = { kind: 'task' as const, id: task.id };

    if (!task.agent_id) {
      issues.push(
        workflowResourceIssue(
          `workflow-resource-task-${task.id}-missing-agent`,
          'workflow.taskUnassignedAgent',
          `Task "${taskLabel}" has no assigned agent.`,
          taskReference,
          taskNode?.id
        )
      );
    } else if (!agentIds.has(task.agent_id)) {
      issues.push(
        workflowResourceIssue(
          `workflow-resource-task-${task.id}-unknown-agent-${task.agent_id}`,
          'workflow.taskMissingAssignedAgent',
          `Task "${taskLabel}" is assigned to missing agent "${task.agent_id}".`,
          taskReference,
          taskNode?.id
        )
      );
    }

    for (const toolId of task.tool_ids ?? []) {
      if (!availableToolIds.has(toolId)) {
        issues.push(
          workflowResourceIssue(
            `workflow-resource-task-${task.id}-missing-tool-${toolId}`,
            'workflow.taskMissingTool',
            `Task "${taskLabel}" references missing tool "${toolId}".`,
            taskReference,
            taskNode?.id
          )
        );
      }
    }

    for (const memoryId of task.memory_ids ?? []) {
      if (!memoryIds.has(memoryId)) {
        issues.push(
          workflowResourceIssue(
            `workflow-resource-task-${task.id}-missing-memory-${memoryId}`,
            'workflow.taskMissingMemory',
            `Task "${taskLabel}" references missing memory "${memoryId}".`,
            taskReference,
            taskNode?.id
          )
        );
      }
    }

    for (const dependencyId of task.depends_on_task_ids ?? []) {
      if (!taskIds.has(dependencyId)) {
        issues.push(
          workflowResourceIssue(
            `workflow-resource-task-${task.id}-missing-dependency-${dependencyId}`,
            'workflow.taskMissingDependency',
            `Task "${taskLabel}" depends on missing task "${dependencyId}".`,
            taskReference,
            taskNode?.id
          )
        );
      }
    }

    const dependencyIds = uniqueStrings(task.depends_on_task_ids ?? []).filter(
      (dependencyId) => dependencyId !== task.id && taskIds.has(dependencyId)
    );
    if (dependencyIds.length > 1) {
      const dependencyClarificationStates = dependencyIds.map((dependencyId) => {
        const edge = edgeMetadataForTaskPair(workflow, dependencyId, task.id);
        const metadata = edge?.metadata ?? {};
        return Boolean(
          (edge?.edge_type && edge.edge_type !== 'default') ||
          edge?.condition?.trim() ||
          Object.keys(metadata).length > 0
        );
      });
      const hasClarifiedDependency = dependencyClarificationStates.some(Boolean);
      const hasUnqualifiedDependency = dependencyClarificationStates.some(
        (isClarified) => !isClarified
      );

      if (hasClarifiedDependency && hasUnqualifiedDependency) {
        issues.push(
          workflowResourceIssue(
            `workflow-resource-task-${task.id}-ambiguous-dependencies`,
            'workflow.taskAmbiguousDependencies',
            `Task "${taskLabel}" mixes conditional and unqualified upstream dependencies; add metadata to clarify readiness.`,
            taskReference,
            taskNode?.id
          )
        );
      }
    }
  }

  for (const agent of workflow.agent_definitions ?? []) {
    const agentLabel = agent.name?.trim() || agent.id;
    const agentNode = agentNodeByAgentId.get(agent.id);
    const agentReference = { kind: 'agent' as const, id: agent.id };

    for (const toolId of agent.tool_ids ?? agent.toolIds ?? []) {
      if (!availableToolIds.has(toolId)) {
        issues.push(
          workflowResourceIssue(
            `workflow-resource-agent-${agent.id}-missing-tool-${toolId}`,
            'workflow.agentMissingTool',
            `Agent "${agentLabel}" references missing tool "${toolId}".`,
            agentReference,
            agentNode?.id
          )
        );
      }
    }

    for (const memoryId of agent.memory_ids ?? agent.memoryIds ?? []) {
      if (!memoryIds.has(memoryId)) {
        issues.push(
          workflowResourceIssue(
            `workflow-resource-agent-${agent.id}-missing-memory-${memoryId}`,
            'workflow.agentMissingMemory',
            `Agent "${agentLabel}" references missing memory "${memoryId}".`,
            agentReference,
            agentNode?.id
          )
        );
      }
    }

    for (const handoffAgentId of agent.handoff_agent_ids ?? agent.handoffAgentIds ?? []) {
      if (!agentIds.has(handoffAgentId)) {
        issues.push(
          workflowResourceIssue(
            `workflow-resource-agent-${agent.id}-missing-handoff-${handoffAgentId}`,
            'workflow.agentMissingHandoffTarget',
            `Agent "${agentLabel}" can hand off to missing agent "${handoffAgentId}".`,
            agentReference,
            agentNode?.id
          )
        );
      }
    }
  }

  return issues;
}

export function validateWorkflowRuntimeWarnings(
  workflow: WorkflowDefinition,
  runtimeEvents: GraphRuntimeEvent[] = []
): WorkflowGraphValidationIssue[] {
  const issues: WorkflowGraphValidationIssue[] = [];
  const blockedStatuses = new Set(['waiting', 'blocked']);

  for (const task of workflow.task_definitions ?? []) {
    if (!task.human_approval_required) {
      continue;
    }

    const taskLabel = task.name?.trim() || task.id;
    const taskNodeId = workflowGraphNodeId(workflowGraphNodeTypes.task, task.id);
    const approvalNodeId = workflowGraphNodeId(workflowGraphNodeTypes.approval, task.id);
    const blockingEvent = runtimeEvents.find((event) => {
      if (!event.status || !blockedStatuses.has(event.status)) {
        return false;
      }

      return (
        event.nodeId === approvalNodeId ||
        (event.nodeId === taskNodeId &&
          (event.type.includes('waiting_for_approval') || event.type.startsWith('approval.')))
      );
    });

    if (!blockingEvent) {
      continue;
    }

    const taskReference = { kind: 'task' as const, id: task.id };
    issues.push(
      workflowResourceIssue(
        `workflow-runtime-task-${task.id}-blocked-approval-${blockingEvent.id}`,
        'workflow.taskBlockedApproval',
        `Task "${taskLabel}" is blocked waiting for human approval.`,
        taskReference,
        approvalNodeId
      )
    );
  }

  return issues;
}

export function workflowExecutionEventToGraphRuntimeEvent(
  event: ExecutionEventRecord,
  workflow?: WorkflowDefinition
): GraphRuntimeEvent {
  const runtimeReference = executionEventRuntimeReference(event);
  const eventStatus = workflowRuntimeStatus(
    typeof event.payload?.status === 'string' ? event.payload.status : event.event_type
  );

  return {
    id: event.id,
    type: event.event_type,
    timestamp: event.timestamp ?? new Date(0).toISOString(),
    graphId: event.workflow_id ?? undefined,
    nodeId: graphNodeIdFromRuntimeReference(runtimeReference),
    edgeId: graphEdgeIdFromRuntimeReference(event, workflow),
    status: eventStatus,
    payload: toGraphJsonObject(event.payload),
    metadata: {
      source: 'workflowExecutionEvent',
      executionId: event.execution_id,
      sequence: event.sequence,
      actorType: event.actor_type ?? null,
      actor: event.actor ?? null,
      taskId: runtimeReference.task_id ?? null,
      agentId: runtimeReference.agent_id ?? null,
      metrics: toGraphJsonObject(event.metrics),
      ...toGraphJsonObject(event.metadata),
    },
  };
}

export function workflowRunToGraphRuntimeEvent(run: WorkflowRun): GraphRuntimeEvent {
  return {
    id: `run-${run.id}-${run.updatedAt ?? run.completedAt ?? run.startedAt ?? run.createdAt ?? run.status}`,
    type: `run.${run.status}`,
    timestamp:
      run.updatedAt ??
      run.completedAt ??
      run.startedAt ??
      run.createdAt ??
      new Date(0).toISOString(),
    graphId: run.workflowId ?? undefined,
    nodeId: graphNodeIdFromRuntimeReference({ currentNodeId: run.currentNodeId }),
    status: workflowRuntimeStatus(run.status),
    payload: toGraphJsonObject({
      runId: run.id,
      runtimeAdapterId: run.runtimeAdapterId ?? null,
      triggerType: run.triggerType ?? null,
      error: run.error ?? null,
      output: run.outputPayload ?? null,
    }),
    metadata: {
      source: 'workflowRun',
      runId: run.id,
      workerId: run.workerId ?? null,
      createdAt: run.createdAt ?? null,
      startedAt: run.startedAt ?? null,
      completedAt: run.completedAt ?? null,
      updatedAt: run.updatedAt ?? null,
      ...toGraphJsonObject(run.metadata),
    },
  };
}

export function workflowRunToGraphRuntimeEvents(
  run: WorkflowRun,
  workflow?: WorkflowDefinition
): GraphRuntimeEvent[] {
  const event = workflowRunToGraphRuntimeEvent(run);
  return [
    event,
    ...relatedWorkflowRuntimeEvents(event, workflow, { currentNodeId: run.currentNodeId }),
  ];
}

export function workflowMonitoringEventsToGraphRuntimeEvents(
  events: WorkflowMonitoringEventsResponse | null | undefined,
  workflow?: WorkflowDefinition
) {
  if (!events) {
    return [];
  }

  return [
    ...events.findings,
    ...events.proposals,
    ...events.evaluations,
    ...events.comparisons,
    ...(events.steering_requests ?? []),
    ...(events.steering_applied ?? []),
  ].flatMap((event) => {
    const graphEvent = workflowExecutionEventToGraphRuntimeEvent(event, workflow);
    const runtimeReference = executionEventRuntimeReference(event);
    return [
      graphEvent,
      ...relatedWorkflowRuntimeEvents(graphEvent, workflow, {
        task_id: runtimeReference.task_id,
        currentNodeId: runtimeReference.currentNodeId,
      }),
    ];
  });
}

export function workflowExecutionEventsToGraphRuntimeEvents(
  events: ExecutionEventRecord[] | null | undefined,
  workflow?: WorkflowDefinition
) {
  return (events ?? []).flatMap((event) => {
    const graphEvent = workflowExecutionEventToGraphRuntimeEvent(event, workflow);
    const runtimeReference = executionEventRuntimeReference(event);
    return [
      graphEvent,
      ...relatedWorkflowRuntimeEvents(graphEvent, workflow, {
        task_id: runtimeReference.task_id,
        currentNodeId: runtimeReference.currentNodeId,
      }),
    ];
  });
}

export function workflowActivityToGraphRuntimeEvents(params: {
  runs?: WorkflowRun[];
  executionEvents?: ExecutionEventRecord[];
  monitoringEvents?: WorkflowMonitoringEventsResponse | null;
  workflow?: WorkflowDefinition;
}) {
  const events = [
    ...(params.runs ?? []).flatMap((run) => workflowRunToGraphRuntimeEvents(run, params.workflow)),
    ...workflowExecutionEventsToGraphRuntimeEvents(params.executionEvents, params.workflow),
    ...workflowMonitoringEventsToGraphRuntimeEvents(params.monitoringEvents, params.workflow),
  ].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  const seenIds = new Set<string>();

  return events.filter((event) => {
    if (seenIds.has(event.id)) {
      return false;
    }

    seenIds.add(event.id);
    return true;
  });
}
