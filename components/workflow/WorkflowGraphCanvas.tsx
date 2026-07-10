'use client';

import { type MouseEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Database,
  FileText,
  GitBranch,
  Hammer,
  ListChecks,
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  Route,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { Handle, Position } from '@xyflow/react';
import GraphCanvas, {
  type GraphBuiltInToolbarActionId,
  graphBuiltInToolbarActionIds,
  type GraphEdgeLabelRendererProps,
  type GraphNodeRendererProps,
  type GraphRuntimeEventRendererProps,
} from '@/modules/react-flow-graph/GraphCanvas';
import type {
  GraphDocument,
  GraphEdge,
  GraphSelection,
  GraphNode,
  GraphRuntimeEvent,
  GraphToolbarAction,
} from '@/modules/react-flow-graph/types';
import {
  addWorkflowAgentNodeToGraphDocument,
  addWorkflowArtifactNodeToGraphDocument,
  addWorkflowMemoryNodeToGraphDocument,
  addWorkflowTaskNodeToGraphDocument,
  addWorkflowTaskTemplateNodeToGraphDocument,
  addWorkflowToolNodeToGraphDocument,
  applyWorkflowGraphConnection,
  graphDocumentToWorkflowDefinition,
  normalizeWorkflowGraphEdgeTypes,
  validateWorkflowGraphConversionSafety,
  validateWorkflowGraphDocument,
  validateWorkflowResourceReferences,
  validateWorkflowRuntimeWarnings,
  workflowDefinitionToGraphDocument,
  workflowDraftIssuesToGraphValidationIssues,
  workflowGraphActionIds,
  type WorkflowGraphAdapterOptions,
  workflowGraphBuiltInToolbarActions,
  workflowGraphEdgeTypes,
  workflowGraphNodeTypes,
  workflowGraphToolbarActionsForCapabilities,
  workflowGraphToolListSelectionId,
  type WorkflowGraphValidationIssue,
} from '@/lib/workflows/workflowGraphAdapter';
import { readWorkflowCapabilityTags } from '@/lib/workflows/capabilities';
import {
  agenticTaskTemplate,
  type AgenticTaskTemplateId,
} from '@/lib/workflows/capabilityTaskTemplates';
import { formatRunDateTime } from '@/lib/workflows/runFormatting';
import {
  type PersonaAgentVersionNotice,
  shortPersonaVersionId,
} from '@/lib/workflows/personaVersioning';
import type { WorkflowCapabilityTag, WorkflowDefinition } from '@/types/workflows';
import type { ToolDefinition } from '@/types/tools';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/library/shadcn/badge';
import WorkflowGraphInspector from '@/components/workflow/WorkflowGraphInspector';
import WorkflowGraphToolbar from '@/components/workflow/WorkflowGraphToolbar';
import { toast } from 'sonner';

const allRuntimeRunsValue = '__all-runtime-runs__';
const allRuntimeDirectionsValue = '__all-runtime-directions__';
const runtimeDirectionOrder = ['Input', 'Output', 'Error', 'Artifact', 'Flow', 'Status'];
const denseWorkflowEdgeLabelThreshold = 12;
const workflowGraphDensityStorageKeyPrefix = 'agency.workflowGraphDensity';

type WorkflowGraphDensity = 'clean' | 'detailed';

function workflowGraphDensityStorageKey(workflowId: string) {
  return `${workflowGraphDensityStorageKeyPrefix}:${workflowId || 'unknown'}`;
}

function readStoredWorkflowGraphDensity(workflowId: string): WorkflowGraphDensity {
  if (typeof window === 'undefined') {
    return 'clean';
  }

  const storedDensity = window.localStorage.getItem(workflowGraphDensityStorageKey(workflowId));
  return storedDensity === 'detailed' ? 'detailed' : 'clean';
}

function workflowGraphNodeTypeLabel(node: GraphNode) {
  if (node.type === workflowGraphNodeTypes.task) {
    return 'Task';
  }

  if (node.type === workflowGraphNodeTypes.agent) {
    return 'Agent';
  }

  if (node.type === workflowGraphNodeTypes.tool) {
    return 'Tool';
  }

  if (node.type === workflowGraphNodeTypes.memory) {
    return 'Memory';
  }

  if (node.type === workflowGraphNodeTypes.artifact) {
    return 'Artifact';
  }

  if (node.type === workflowGraphNodeTypes.approval) {
    return 'Approval';
  }

  return 'Node';
}

interface WorkflowGraphCanvasProps extends WorkflowGraphAdapterOptions {
  workflow: WorkflowDefinition;
  document?: GraphDocument;
  className?: string;
  readOnly?: boolean;
  showInspector?: boolean;
  onWorkflowChange?: (workflow: WorkflowDefinition) => void;
  onGraphChange?: (document: GraphDocument) => void;
  runtimeEvents?: GraphRuntimeEvent[];
  hideRuntimeRunFilter?: boolean;
  agentObservabilityMetrics?: ObservabilityAgentMetrics[];
  personaVersionNotices?: PersonaAgentVersionNotice[];
  workflowValidationIssues?: string[];
  memoryLinkCountsByTarget?: Record<string, number>;
  onValidationIssues?: (issues: WorkflowGraphValidationIssue[]) => void;
  onSelectTask?: (taskId: string | null) => void;
  onSelectApproval?: (taskId: string | null) => void;
  onSelectAgent?: (agentId: string | null) => void;
  onSelectTool?: (toolId: string | null, toolIds?: string[], toolNodeId?: string | null) => void;
  onSelectMemory?: (memoryId: string | null) => void;
  onSelectArtifact?: (artifactId: string | null) => void;
  onSelectEdge?: (edge: GraphEdge | null) => void;
  onStartEditing?: () => void;
  onSaveWorkflow?: () => void;
  onRunWorkflow?: () => void;
  saveWorkflowDisabled?: boolean;
  runWorkflowDisabled?: boolean;
  toolDefinitions?: ToolDefinition[];
  workflowCapabilityTags?: WorkflowCapabilityTag[];
  runtimeControls?: WorkflowGraphRuntimeControls;
}

interface WorkflowGraphRuntimeControls {
  runId?: string | null;
  status?: string | null;
  approvalToolId?: string | null;
  approvalLabel?: string | null;
  checkpointResumeTaskId?: string | null;
  canRequestSteering?: boolean;
  isPending?: boolean;
  onRequestSteering?: (target: WorkflowGraphSteeringTarget) => void;
  onResumeRun?: (runId: string) => void;
  onRetryTask?: (runId: string, taskId: string) => void;
  onResumeFromCheckpoint?: (runId: string) => void;
  onApproveTool?: (runId: string, toolId: string) => void;
  onRejectTool?: (runId: string, toolId: string) => void;
}

interface WorkflowGraphSteeringTarget {
  taskId?: string | null;
  agentId?: string | null;
}

interface WorkflowGraphNodeRuntimeControl {
  kind: 'resume' | 'retryTask' | 'checkpointResume' | 'nativeApproval';
  runId: string;
  status: string | null;
  label: string;
  taskId?: string | null;
  toolId?: string | null;
  toolLabel?: string | null;
}

interface ObservabilityAgentMetrics {
  agent_id: string;
  total_tokens?: number;
  context_health?: {
    latest?: Record<string, unknown> | null;
  };
}

function readDataString(node: GraphNode | undefined, key: string) {
  const value = node?.data?.[key];
  return typeof value === 'string' ? value : null;
}

function readDataNumber(node: GraphNode | undefined, key: string) {
  const value = node?.data?.[key];
  return typeof value === 'number' ? value : 0;
}

function readDataBoolean(node: GraphNode | undefined, key: string) {
  const value = node?.data?.[key];
  return typeof value === 'boolean' ? value : false;
}

function readDataStringArray(node: GraphNode | undefined, key: string) {
  const value = node?.data?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function readEdgeDataString(edge: GraphEdge | undefined, key: string) {
  const value = edge?.data?.[key];
  return typeof value === 'string' ? value : null;
}

function workflowMemoryLinkTargetKey(
  targetType: 'workflow' | 'agent' | 'task',
  targetId?: string | null
) {
  return `${targetType}:${targetId ?? ''}`;
}

function workflowMonitoringStringList(
  workflow: WorkflowDefinition | undefined,
  key: 'excluded_subagent_ids' | 'excluded_task_ids'
) {
  const value = workflow?.monitoring?.controls?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function workflowTaskAgentId(workflow: WorkflowDefinition | undefined, taskId: string | null) {
  if (!workflow || !taskId) {
    return null;
  }

  return workflow.task_definitions?.find((task) => task.id === taskId)?.agent_id ?? null;
}

function nodeMonitoringPolicy(node: GraphNode, workflow: WorkflowDefinition | undefined) {
  if (node.type !== workflowGraphNodeTypes.agent && node.type !== workflowGraphNodeTypes.task) {
    return null;
  }

  const monitoring = workflow?.monitoring;
  if (!monitoring) {
    return null;
  }

  if (!monitoring.enabled || !monitoring.controls?.enabled) {
    return { label: 'Monitoring off', state: 'off' };
  }

  const excludedAgentIds = workflowMonitoringStringList(workflow, 'excluded_subagent_ids');
  const excludedTaskIds = workflowMonitoringStringList(workflow, 'excluded_task_ids');
  const agentId = readDataString(node, 'agentId');
  const taskId = readDataString(node, 'taskId');
  const taskAgentId = workflowTaskAgentId(workflow, taskId);

  if (node.type === workflowGraphNodeTypes.agent) {
    if (monitoring.controls?.supervise_subagents === false) {
      return { label: 'Sub-agent supervision off', state: 'off' };
    }
    if (agentId && excludedAgentIds.includes(agentId)) {
      return { label: 'Excluded from supervision', state: 'excluded' };
    }
    return { label: 'Main-agent supervised', state: 'monitored' };
  }

  if (taskId && excludedTaskIds.includes(taskId)) {
    return { label: 'Task excluded', state: 'excluded' };
  }
  if (taskAgentId && excludedAgentIds.includes(taskAgentId)) {
    return { label: 'Assigned agent excluded', state: 'excluded' };
  }

  return { label: 'Main-agent supervised', state: 'monitored' };
}

function graphRuntimeEventMetadataString(event: GraphRuntimeEvent, key: string) {
  const value = event.metadata?.[key];
  return typeof value === 'string' ? value : null;
}

function graphRuntimeEventMetadataNumber(event: GraphRuntimeEvent, key: string) {
  const value = event.metadata?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function graphRuntimeEventPayloadString(event: GraphRuntimeEvent, key: string) {
  const value = event.payload?.[key];
  return typeof value === 'string' ? value : null;
}

function graphRuntimeEventPayloadNumber(event: GraphRuntimeEvent, key: string) {
  const value = event.payload?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function graphRuntimeEventMetricNumber(event: GraphRuntimeEvent, key: string) {
  const metrics = event.metadata?.metrics;
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) {
    return null;
  }

  const value = (metrics as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function graphRuntimeEventString(event: GraphRuntimeEvent, key: string) {
  return graphRuntimeEventMetadataString(event, key) ?? graphRuntimeEventPayloadString(event, key);
}

function graphRuntimeEventStringArray(event: GraphRuntimeEvent, key: string) {
  const values = [event.metadata?.[key], event.payload?.[key]];
  return values.flatMap((value) => {
    if (typeof value === 'string') {
      return [value];
    }

    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string');
    }

    return [];
  });
}

function graphRuntimeEventNumber(event: GraphRuntimeEvent, key: string) {
  return graphRuntimeEventMetadataNumber(event, key) ?? graphRuntimeEventPayloadNumber(event, key);
}

function latestGovernanceEvent(events: GraphRuntimeEvent[], eventType: string) {
  return [...events]
    .filter(
      (event) => event.type === eventType && event.metadata?.source === 'workflowExecutionEvent'
    )
    .sort((left, right) => {
      const leftSequence = graphRuntimeEventMetadataNumber(left, 'sequence') ?? 0;
      const rightSequence = graphRuntimeEventMetadataNumber(right, 'sequence') ?? 0;
      if (left.timestamp === right.timestamp) {
        return leftSequence - rightSequence;
      }
      return left.timestamp.localeCompare(right.timestamp);
    })
    .at(-1);
}

function compactTokenCount(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  }

  return value.toLocaleString();
}

function contextBadgeClassName(status: string | null) {
  if (status === 'critical' || status === 'overflow') {
    return 'border-red-300 bg-red-50 text-red-800';
  }

  if (status === 'warning') {
    return 'border-amber-300 bg-amber-50 text-amber-800';
  }

  if (status === 'normal') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }

  return 'border-neutral-200 bg-neutral-50 text-neutral-600';
}

function latestAgentContextStatus(metrics: ObservabilityAgentMetrics | undefined) {
  const latest = metrics?.context_health?.latest;
  return latest && typeof latest.status === 'string' ? latest.status : null;
}

function nodeGovernanceFromEvents(node: GraphNode, runtimeEvents: GraphRuntimeEvent[]) {
  const taskId = node.type === workflowGraphNodeTypes.task ? readDataString(node, 'taskId') : null;
  const agentId =
    node.type === workflowGraphNodeTypes.agent ? readDataString(node, 'agentId') : null;

  if (!taskId && !agentId) {
    return { tokens: null, contextStatus: null };
  }

  const matchingEvents = (runtimeEvents ?? []).filter((event) => {
    if (event.metadata?.source !== 'workflowExecutionEvent') {
      return false;
    }
    if (taskId) {
      return (
        event.nodeId === node.id || graphRuntimeEventMetadataString(event, 'taskId') === taskId
      );
    }
    return Boolean(agentId && event.nodeId === node.id);
  });
  const tokenEvents = matchingEvents.filter((event) => event.type === 'token.usage.recorded');
  const tokens = tokenEvents.reduce(
    (total, event) => total + (graphRuntimeEventMetricNumber(event, 'total_tokens') ?? 0),
    0
  );
  const latestHealth = latestGovernanceEvent(matchingEvents, 'context.health.recorded');
  const payloadStatus = latestHealth?.payload?.status;
  const contextStatus = typeof payloadStatus === 'string' ? payloadStatus : null;

  return {
    tokens: tokens > 0 ? tokens : null,
    contextStatus,
  };
}

function pendingSupervisorRequestCountForNode(node: GraphNode, events: GraphRuntimeEvent[]) {
  const agentId =
    node.type === workflowGraphNodeTypes.agent ? readDataString(node, 'agentId') : null;
  const taskId = node.type === workflowGraphNodeTypes.task ? readDataString(node, 'taskId') : null;

  return events.filter((event) => {
    if (event.type !== 'supervisor.steering.requested') {
      return false;
    }

    if (event.nodeId === node.id) {
      return true;
    }

    return (
      Boolean(agentId && graphRuntimeEventMetadataString(event, 'agentId') === agentId) ||
      Boolean(taskId && graphRuntimeEventMetadataString(event, 'taskId') === taskId)
    );
  }).length;
}

function appliedSupervisorSteeringCountForNode(node: GraphNode, events: GraphRuntimeEvent[]) {
  const agentId =
    node.type === workflowGraphNodeTypes.agent ? readDataString(node, 'agentId') : null;
  const taskId = node.type === workflowGraphNodeTypes.task ? readDataString(node, 'taskId') : null;

  return events.filter((event) => {
    if (event.type !== 'supervisor.steering.applied') {
      return false;
    }

    if (event.nodeId === node.id) {
      return true;
    }

    return (
      Boolean(agentId && graphRuntimeEventMetadataString(event, 'agentId') === agentId) ||
      Boolean(taskId && graphRuntimeEventMetadataString(event, 'taskId') === taskId)
    );
  }).length;
}

function workflowRelationshipHighlights(document: GraphDocument, selection: GraphSelection) {
  const selectedNodeIds = new Set(selection.nodeIds);
  const selectedEdgeIds = new Set(selection.edgeIds);
  const highlightedNodeIds = new Set<string>();
  const highlightedEdgeIds = new Set<string>();

  if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) {
    return { nodeIds: highlightedNodeIds, edgeIds: highlightedEdgeIds };
  }

  document.edges.forEach((edge) => {
    const edgeIsSelected = selectedEdgeIds.has(edge.id);
    const edgeTouchesSelectedNode =
      selectedNodeIds.has(edge.source) || selectedNodeIds.has(edge.target);

    if (!edgeIsSelected && !edgeTouchesSelectedNode) {
      return;
    }

    highlightedEdgeIds.add(edge.id);
    highlightedNodeIds.add(edge.source);
    highlightedNodeIds.add(edge.target);
  });

  selectedNodeIds.forEach((nodeId) => highlightedNodeIds.add(nodeId));

  const taskNodeByTaskId = new Map<string, GraphNode>();
  document.nodes.forEach((node) => {
    if (node.type !== workflowGraphNodeTypes.task) {
      return;
    }

    const taskId = readDataString(node, 'taskId');
    if (taskId) {
      taskNodeByTaskId.set(taskId, node);
    }
  });

  const selectedTaskNodeIds = new Set<string>();
  const selectedApprovalNodeIds = new Set<string>();

  document.nodes.forEach((node) => {
    if (!selectedNodeIds.has(node.id)) {
      return;
    }

    if (node.type === workflowGraphNodeTypes.task) {
      selectedTaskNodeIds.add(node.id);
    }

    if (node.type === workflowGraphNodeTypes.approval) {
      selectedApprovalNodeIds.add(node.id);
    }
  });

  document.edges.forEach((edge) => {
    if (!selectedEdgeIds.has(edge.id) || edge.type !== workflowGraphEdgeTypes.approval) {
      return;
    }

    highlightedEdgeIds.add(edge.id);
    highlightedNodeIds.add(edge.source);
    highlightedNodeIds.add(edge.target);
    if (
      document.nodes.find((node) => node.id === edge.source)?.type === workflowGraphNodeTypes.task
    ) {
      selectedTaskNodeIds.add(edge.source);
    }
    if (
      document.nodes.find((node) => node.id === edge.target)?.type === workflowGraphNodeTypes.task
    ) {
      selectedTaskNodeIds.add(edge.target);
    }
    if (
      document.nodes.find((node) => node.id === edge.source)?.type ===
      workflowGraphNodeTypes.approval
    ) {
      selectedApprovalNodeIds.add(edge.source);
    }
    if (
      document.nodes.find((node) => node.id === edge.target)?.type ===
      workflowGraphNodeTypes.approval
    ) {
      selectedApprovalNodeIds.add(edge.target);
    }
  });

  document.nodes.forEach((approvalNode) => {
    if (approvalNode.type !== workflowGraphNodeTypes.approval) {
      return;
    }

    const taskNodeId =
      typeof approvalNode.metadata?.derivedFrom === 'string'
        ? approvalNode.metadata.derivedFrom
        : null;
    const taskId = readDataString(approvalNode, 'taskId');
    const fallbackTaskNodeId = taskId ? taskNodeByTaskId.get(taskId)?.id : null;
    const linkedTaskNodeId = taskNodeId ?? fallbackTaskNodeId;
    const relationshipIsActive =
      selectedApprovalNodeIds.has(approvalNode.id) ||
      Boolean(linkedTaskNodeId && selectedTaskNodeIds.has(linkedTaskNodeId));

    if (!relationshipIsActive) {
      return;
    }

    highlightedNodeIds.add(approvalNode.id);
    if (linkedTaskNodeId) {
      highlightedNodeIds.add(linkedTaskNodeId);
    }

    document.edges.forEach((edge) => {
      if (edge.type !== workflowGraphEdgeTypes.approval) {
        return;
      }

      const edgeTaskId = readEdgeDataString(edge, 'taskId');
      const edgeMatchesApprovalNode =
        edge.source === approvalNode.id || edge.target === approvalNode.id;
      const edgeMatchesTaskNode =
        Boolean(
          linkedTaskNodeId && (edge.source === linkedTaskNodeId || edge.target === linkedTaskNodeId)
        ) || Boolean(taskId && edgeTaskId === taskId);

      if (edgeMatchesApprovalNode || edgeMatchesTaskNode) {
        highlightedEdgeIds.add(edge.id);
      }
    });
  });

  return { nodeIds: highlightedNodeIds, edgeIds: highlightedEdgeIds };
}

interface WorkflowRelationshipSummary {
  label: string;
  items: string[];
}

function formatRelationshipCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function workflowSelectedRelationshipSummary(
  document: GraphDocument,
  selection: GraphSelection
): WorkflowRelationshipSummary | null {
  const selectedNodeId = selection.nodeIds[0] ?? null;
  const selectedEdgeId = selection.edgeIds[0] ?? null;
  const selectedNode = selectedNodeId
    ? document.nodes.find((node) => node.id === selectedNodeId)
    : null;
  const selectedEdge = selectedEdgeId
    ? document.edges.find((edge) => edge.id === selectedEdgeId)
    : null;

  if (!selectedNode && !selectedEdge) {
    return null;
  }

  const selectedNodeIds = new Set(selection.nodeIds);
  const selectedEdgeIds = new Set(selection.edgeIds);
  const relatedEdges = document.edges.filter(
    (edge) =>
      selectedEdgeIds.has(edge.id) ||
      selectedNodeIds.has(edge.source) ||
      selectedNodeIds.has(edge.target)
  );
  const relatedNodeIds = new Set<string>();

  relatedEdges.forEach((edge) => {
    relatedNodeIds.add(edge.source);
    relatedNodeIds.add(edge.target);
  });
  selectedNodeIds.forEach((nodeId) => relatedNodeIds.add(nodeId));

  const relatedNodes = document.nodes.filter((node) => relatedNodeIds.has(node.id));
  const incoming = selectedNodeId
    ? relatedEdges.filter((edge) => edge.target === selectedNodeId).length
    : 0;
  const outgoing = selectedNodeId
    ? relatedEdges.filter((edge) => edge.source === selectedNodeId).length
    : 0;
  const agents = relatedNodes.filter((node) => node.type === workflowGraphNodeTypes.agent).length;
  const tools = relatedNodes.filter((node) => node.type === workflowGraphNodeTypes.tool).length;
  const memories = relatedNodes.filter(
    (node) => node.type === workflowGraphNodeTypes.memory
  ).length;
  const approvals = relatedNodes.filter(
    (node) => node.type === workflowGraphNodeTypes.approval
  ).length;
  const tasks = relatedNodes.filter((node) => node.type === workflowGraphNodeTypes.task).length;
  const items = [
    incoming > 0 ? formatRelationshipCount(incoming, 'upstream') : null,
    outgoing > 0 ? formatRelationshipCount(outgoing, 'downstream') : null,
    agents > 0 ? formatRelationshipCount(agents, 'agent') : null,
    tasks > 0 && selectedNode?.type !== workflowGraphNodeTypes.task
      ? formatRelationshipCount(tasks, 'task')
      : null,
    tools > 0 ? formatRelationshipCount(tools, 'tool') : null,
    memories > 0 ? formatRelationshipCount(memories, 'memory', 'memory links') : null,
    approvals > 0 ? formatRelationshipCount(approvals, 'approval') : null,
  ].filter((item): item is string => Boolean(item));

  return {
    label: selectedNode?.label ?? selectedEdge?.label ?? 'Selected relationship',
    items,
  };
}

function nodeTone(type: string) {
  if (type === workflowGraphNodeTypes.agent) {
    return {
      icon: <Bot className="h-4 w-4 text-cyan-700 dark:text-cyan-100" />,
      badge: 'Agent',
      accentClassName: 'bg-cyan-500',
      className:
        'border-cyan-300 bg-gradient-to-br from-cyan-50 via-sky-50 to-white shadow-cyan-950/5 dark:border-cyan-300/28 dark:bg-slate-900 dark:bg-none dark:shadow-cyan-950/28',
      badgeClassName:
        'border-cyan-300 bg-cyan-100 text-cyan-900 dark:border-cyan-300/30 dark:bg-cyan-400/10 dark:text-cyan-100',
    };
  }

  if (type === workflowGraphNodeTypes.tool) {
    return {
      icon: <Hammer className="h-4 w-4 text-violet-700 dark:text-violet-100" />,
      badge: 'Tools',
      accentClassName: 'bg-violet-500',
      className:
        'border-violet-300 bg-gradient-to-br from-violet-50 via-fuchsia-50 to-white shadow-violet-950/5 dark:border-violet-300/28 dark:bg-slate-900 dark:bg-none dark:shadow-violet-950/28',
      badgeClassName:
        'border-violet-300 bg-violet-100 text-violet-900 dark:border-violet-300/30 dark:bg-violet-400/10 dark:text-violet-100',
    };
  }

  if (type === workflowGraphNodeTypes.memory) {
    return {
      icon: <Database className="h-4 w-4 text-teal-700 dark:text-teal-200" />,
      badge: 'Memory',
      accentClassName: 'bg-teal-500',
      className: 'border-teal-200 bg-teal-50/70 dark:border-teal-400/25 dark:bg-teal-500/12',
      badgeClassName:
        'border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-400/30 dark:bg-teal-500/12 dark:text-teal-100',
    };
  }

  if (type === workflowGraphNodeTypes.artifact) {
    return {
      icon: <FileText className="h-4 w-4 text-cyan-700 dark:text-cyan-200" />,
      badge: 'Artifact',
      accentClassName: 'bg-cyan-500',
      className: 'border-cyan-200 bg-cyan-50/70 dark:border-cyan-400/25 dark:bg-cyan-500/12',
      badgeClassName:
        'border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-400/30 dark:bg-cyan-500/12 dark:text-cyan-100',
    };
  }

  if (type === workflowGraphNodeTypes.approval) {
    return {
      icon: <ShieldCheck className="h-4 w-4 text-blue-700 dark:text-blue-200" />,
      badge: 'Approval',
      accentClassName: 'bg-blue-500',
      className: 'border-blue-200 bg-blue-50/70 dark:border-blue-400/25 dark:bg-blue-500/12',
      badgeClassName:
        'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-400/30 dark:bg-blue-500/12 dark:text-blue-100',
    };
  }

  if (type === workflowGraphNodeTypes.router) {
    return {
      icon: <GitBranch className="h-4 w-4 text-indigo-700 dark:text-indigo-200" />,
      badge: 'Router',
      accentClassName: 'bg-indigo-500',
      className:
        'border-indigo-200 bg-indigo-50/70 dark:border-indigo-400/25 dark:bg-indigo-500/12',
      badgeClassName:
        'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-400/30 dark:bg-indigo-500/12 dark:text-indigo-100',
    };
  }

  return {
    icon: <ListChecks className="h-4 w-4 text-amber-700 dark:text-amber-100" />,
    badge: 'Task',
    accentClassName: 'bg-amber-500',
    className:
      'border-amber-300 bg-gradient-to-br from-amber-50 via-yellow-50 to-white shadow-amber-950/5 dark:border-amber-300/28 dark:bg-slate-900 dark:bg-none dark:shadow-amber-950/28',
    badgeClassName:
      'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-300/30 dark:bg-amber-400/10 dark:text-amber-100',
  };
}

function runtimeStatusClassName(status: string | undefined) {
  if (status === 'running') {
    return 'border-sky-400 bg-sky-50/90 ring-2 ring-sky-100 animate-pulse dark:border-sky-300 dark:bg-sky-500/16 dark:ring-sky-400/20';
  }

  if (status === 'queued') {
    return 'border-blue-300 bg-blue-50/90 ring-2 ring-blue-100 animate-pulse dark:border-blue-300 dark:bg-blue-500/16 dark:ring-blue-400/20';
  }

  if (status === 'waiting') {
    return 'border-amber-400 bg-amber-50/90 ring-2 ring-amber-100 animate-pulse dark:border-amber-300 dark:bg-amber-400/16 dark:ring-amber-300/20';
  }

  if (status === 'succeeded' || status === 'completed') {
    return 'border-emerald-300 bg-emerald-50/90 ring-2 ring-emerald-100 dark:border-emerald-300 dark:bg-emerald-500/16 dark:ring-emerald-400/20';
  }

  if (status === 'failed' || status === 'blocked') {
    return 'border-red-400 bg-red-50/90 ring-2 ring-red-100 dark:border-red-300 dark:bg-red-500/16 dark:ring-red-400/20';
  }

  if (status === 'skipped') {
    return 'border-neutral-300 bg-neutral-50/90 opacity-75 dark:border-slate-500 dark:bg-slate-500/10';
  }

  return null;
}

function summarizeRuntimePayloadValue(key: string, value: unknown) {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return `${key}: ${String(value)}`;
  }

  if (value && typeof value === 'object') {
    try {
      const serializedValue = JSON.stringify(value);
      return `${key}: ${
        serializedValue.length > 96 ? `${serializedValue.slice(0, 93)}...` : serializedValue
      }`;
    } catch {
      return `${key}: [object]`;
    }
  }

  return null;
}

function runtimePayloadDirection(event: GraphRuntimeEvent) {
  const payload = event.payload ?? {};

  if (payload.error !== undefined || event.status === 'failed') {
    return {
      label: 'Error',
      className: 'border-red-200 bg-red-50 text-red-700',
      dotClassName: 'bg-red-500',
    };
  }

  if (payload.output !== undefined || payload.result !== undefined) {
    return {
      label: 'Output',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      dotClassName: 'bg-emerald-500',
    };
  }

  if (payload.artifactId !== undefined || payload.artifact_id !== undefined) {
    return {
      label: 'Artifact',
      className: 'border-violet-200 bg-violet-50 text-violet-700',
      dotClassName: 'bg-violet-500',
    };
  }

  if (payload.input !== undefined || payload.data !== undefined) {
    return {
      label: 'Input',
      className: 'border-sky-200 bg-sky-50 text-sky-700',
      dotClassName: 'bg-sky-500',
    };
  }

  if (event.type.startsWith('assignment.') || event.edgeId) {
    return {
      label: 'Flow',
      className: 'border-blue-200 bg-blue-50 text-blue-700',
      dotClassName: 'bg-blue-500',
    };
  }

  return {
    label: 'Status',
    className: 'border-neutral-200 bg-neutral-50 text-neutral-600',
    dotClassName: 'bg-neutral-400',
  };
}

function runtimePayloadSummary(event: GraphRuntimeEvent) {
  const payload = event.payload ?? {};
  const preferredKeys = [
    'message',
    'summary',
    'error',
    'input',
    'output',
    'result',
    'data',
    'artifactId',
    'taskId',
    'agentId',
    'triggerType',
    'reason',
  ];
  const entry = preferredKeys
    .map((key) => [key, payload[key]] as const)
    .find(([, value]) => value !== undefined && value !== null);

  if (entry) {
    const [key, value] = entry;
    return summarizeRuntimePayloadValue(key, value);
  }

  const fallbackEntry = Object.entries(payload).find(
    ([, value]) => value !== undefined && value !== null
  );

  if (!fallbackEntry) {
    return null;
  }

  const [key, value] = fallbackEntry;
  if (key === 'runId') {
    return null;
  }

  return summarizeRuntimePayloadValue(key, value);
}

function runtimeRunId(event: GraphRuntimeEvent) {
  const payloadRunId = event.payload?.runId;
  const metadataRunId = event.metadata?.runId ?? event.metadata?.executionId;

  if (typeof payloadRunId === 'string') {
    return payloadRunId;
  }

  if (typeof metadataRunId === 'string') {
    return metadataRunId;
  }

  return null;
}

function runtimeEventSequence(event: GraphRuntimeEvent) {
  const sequence = event.metadata?.sequence;
  return typeof sequence === 'number' ? sequence : null;
}

function shortRuntimeRunId(runId: string) {
  return runId.length > 8 ? runId.slice(0, 8) : runId;
}

function runtimeEventStringMetadata(event: GraphRuntimeEvent, key: string) {
  const value = event.metadata?.[key];
  return typeof value === 'string' ? value : null;
}

function runtimeRunDateTime(event: GraphRuntimeEvent) {
  return (
    formatRunDateTime(runtimeEventStringMetadata(event, 'startedAt')) ??
    formatRunDateTime(runtimeEventStringMetadata(event, 'createdAt')) ??
    formatRunDateTime(event.timestamp)
  );
}

function runtimeEventSortTime(event: GraphRuntimeEvent) {
  const timestamp =
    runtimeEventStringMetadata(event, 'updatedAt') ??
    runtimeEventStringMetadata(event, 'completedAt') ??
    runtimeEventStringMetadata(event, 'startedAt') ??
    runtimeEventStringMetadata(event, 'createdAt') ??
    event.timestamp;
  const parsedTimestamp = Date.parse(timestamp);
  return Number.isNaN(parsedTimestamp) ? 0 : parsedTimestamp;
}

function runtimeEventIsProjection(event: GraphRuntimeEvent) {
  return event.metadata?.source === 'workflowRuntimeProjection';
}

function runtimeEventToolId(event: GraphRuntimeEvent) {
  const evidence = event.payload?.evidence;
  const evidenceTool =
    evidence && typeof evidence === 'object' && !Array.isArray(evidence)
      ? ((evidence as Record<string, unknown>).toolId ??
        (evidence as Record<string, unknown>).tool_id ??
        (evidence as Record<string, unknown>).tool)
      : null;

  return (
    graphRuntimeEventString(event, 'toolId') ??
    graphRuntimeEventString(event, 'tool_id') ??
    graphRuntimeEventString(event, 'tool') ??
    (typeof evidenceTool === 'string' ? evidenceTool : null)
  );
}

function runtimeEventMemoryIds(event: GraphRuntimeEvent) {
  const evidence = event.payload?.evidence;
  const evidenceRecord =
    evidence && typeof evidence === 'object' && !Array.isArray(evidence)
      ? (evidence as Record<string, unknown>)
      : null;
  const evidenceMemoryIds = [evidenceRecord?.memoryId, evidenceRecord?.memory_id].flatMap(
    (value) => {
      if (typeof value === 'string') {
        return [value];
      }

      return [];
    }
  );
  const evidenceMemoryIdArrays = [evidenceRecord?.memoryIds, evidenceRecord?.memory_ids].flatMap(
    (value) =>
      Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  );

  return Array.from(
    new Set([
      ...graphRuntimeEventStringArray(event, 'memoryId'),
      ...graphRuntimeEventStringArray(event, 'memory_id'),
      ...graphRuntimeEventStringArray(event, 'memoryIds'),
      ...graphRuntimeEventStringArray(event, 'memory_ids'),
      ...evidenceMemoryIds,
      ...evidenceMemoryIdArrays,
    ])
  );
}

function runtimeEventIsPendingApproval(event: GraphRuntimeEvent) {
  const normalizedStatus = event.status?.toLowerCase() ?? '';
  const normalizedType = event.type.replace(/_/g, '.').toLowerCase();

  return (
    (normalizedStatus === 'waiting' ||
      normalizedStatus === 'blocked' ||
      normalizedType.includes('approval')) &&
    normalizedType.includes('approval') &&
    !normalizedType.endsWith('.granted') &&
    !normalizedType.endsWith('.approved') &&
    !normalizedType.endsWith('.rejected') &&
    !normalizedType.endsWith('.resolved')
  );
}

function runtimeEventIsPaused(event: GraphRuntimeEvent) {
  const normalizedStatus = event.status?.toLowerCase() ?? '';
  const normalizedType = event.type.replace(/_/g, '.').toLowerCase();

  return normalizedStatus === 'paused' || normalizedType.endsWith('.paused');
}

function runtimeEventDirectlyMatchesNode(node: GraphNode, event: GraphRuntimeEvent) {
  if (event.nodeId === node.id) {
    return true;
  }

  const taskId = readDataString(node, 'taskId');
  return !!(
    taskId &&
    (graphRuntimeEventString(event, 'taskId') === taskId ||
      graphRuntimeEventString(event, 'task_id') === taskId)
  );
}

function workflowGraphRuntimeControlForNode(
  node: GraphNode,
  controls: WorkflowGraphRuntimeControls | undefined,
  runtimeEvents: GraphRuntimeEvent[]
): WorkflowGraphNodeRuntimeControl | null {
  const runId = controls?.runId ?? null;
  const status = controls?.status ?? null;
  if (!runId) {
    return null;
  }

  const runEvents = runtimeEvents.filter((event) => runtimeRunId(event) === runId);
  if (status === 'paused' && controls?.onResumeRun) {
    const pausedEvent = runEvents.find(
      (event) => runtimeEventIsPaused(event) && runtimeEventDirectlyMatchesNode(node, event)
    );

    if (pausedEvent) {
      return {
        kind: 'resume',
        runId,
        status,
        label: 'Resume paused run',
      };
    }
  }

  if (controls?.onRetryTask) {
    const pausePointEvent = runEvents.find(
      (event) =>
        !runtimeEventIsProjection(event) &&
        Boolean(runtimeEventPausePointLabel(event)) &&
        runtimeEventMatchesNode(node, event) &&
        Boolean(runtimeEventTaskId(event) ?? readDataString(node, 'taskId'))
    );
    const taskId = pausePointEvent
      ? (runtimeEventTaskId(pausePointEvent) ?? readDataString(node, 'taskId'))
      : null;
    const pausePointLabel = pausePointEvent ? runtimeEventPausePointLabel(pausePointEvent) : null;

    if (taskId && pausePointLabel) {
      return {
        kind: 'retryTask',
        runId,
        status,
        label: pausePointLabel,
        taskId,
      };
    }
  }

  if (status === 'failed' && controls?.onRetryTask && node.type === workflowGraphNodeTypes.task) {
    const taskId = readDataString(node, 'taskId');
    const failedEvent = runEvents.find(
      (event) => runtimeEventIsFailure(event) && runtimeEventDirectlyMatchesNode(node, event)
    );

    if (taskId && failedEvent) {
      return {
        kind: 'retryTask',
        runId,
        status,
        label: 'Retry failed task',
        taskId,
      };
    }
  }

  const checkpointResumeTaskId = controls?.checkpointResumeTaskId ?? null;
  if (
    checkpointResumeTaskId &&
    controls?.onResumeFromCheckpoint &&
    node.type === workflowGraphNodeTypes.task &&
    readDataString(node, 'taskId') === checkpointResumeTaskId
  ) {
    return {
      kind: 'checkpointResume',
      runId,
      status,
      label: 'Resume from checkpoint',
      taskId: checkpointResumeTaskId,
    };
  }

  const approvalToolId = controls?.approvalToolId ?? null;
  if (
    status === 'waiting_for_approval' &&
    approvalToolId &&
    (controls?.onApproveTool || controls?.onRejectTool)
  ) {
    const pendingApprovalEvents = runEvents.filter(runtimeEventIsPendingApproval);
    const nodeToolIds = readDataStringArray(node, 'toolIds');
    const matchesPendingApproval = pendingApprovalEvents.some((event) => {
      if (runtimeEventDirectlyMatchesNode(node, event)) {
        return true;
      }

      return (
        node.type === workflowGraphNodeTypes.tool &&
        (nodeToolIds.includes(approvalToolId) || runtimeEventToolId(event) === approvalToolId)
      );
    });

    if (matchesPendingApproval) {
      return {
        kind: 'nativeApproval',
        runId,
        status,
        label: `Approve or reject ${controls.approvalLabel ?? approvalToolId}`,
        toolId: approvalToolId,
        toolLabel: controls.approvalLabel ?? approvalToolId,
      };
    }
  }

  return null;
}

function runtimeEventMatchesNode(node: GraphNode, event: GraphRuntimeEvent) {
  if (event.nodeId === node.id) {
    return true;
  }

  const taskId = readDataString(node, 'taskId');
  if (
    taskId &&
    (graphRuntimeEventString(event, 'taskId') === taskId ||
      graphRuntimeEventString(event, 'task_id') === taskId)
  ) {
    return true;
  }

  const agentId = readDataString(node, 'agentId');
  if (
    agentId &&
    (graphRuntimeEventString(event, 'agentId') === agentId ||
      graphRuntimeEventString(event, 'agent_id') === agentId)
  ) {
    return true;
  }

  const toolId = runtimeEventToolId(event);
  if (toolId && readDataStringArray(node, 'toolIds').includes(toolId)) {
    return true;
  }

  const memoryId = readDataString(node, 'memoryId');
  if (
    memoryId &&
    (graphRuntimeEventString(event, 'memoryId') === memoryId ||
      graphRuntimeEventString(event, 'memory_id') === memoryId)
  ) {
    return true;
  }

  const artifactId = readDataString(node, 'artifactId');
  return !!(
    artifactId &&
    (graphRuntimeEventString(event, 'artifactId') === artifactId ||
      graphRuntimeEventString(event, 'artifact_id') === artifactId)
  );
}

function runtimeEventIsFailure(event: GraphRuntimeEvent) {
  const normalizedStatus = event.status?.toLowerCase() ?? '';
  const normalizedType = event.type.replace(/_/g, '.').toLowerCase();

  return (
    normalizedStatus === 'failed' ||
    normalizedStatus === 'error' ||
    normalizedType.endsWith('.failed') ||
    normalizedType.endsWith('.error') ||
    event.payload?.error !== undefined
  );
}

function runtimeEventIsToolCall(event: GraphRuntimeEvent) {
  const normalizedType = event.type.replace(/_/g, '.').toLowerCase();
  return normalizedType.startsWith('tool.') || Boolean(runtimeEventToolId(event));
}

function runtimeEventDiagnosticText(event: GraphRuntimeEvent) {
  const serializedPayload = event.payload ? JSON.stringify(event.payload) : '';
  const serializedMetadata = event.metadata ? JSON.stringify(event.metadata) : '';
  return [
    event.type,
    event.status,
    runtimePayloadSummary(event),
    serializedPayload,
    serializedMetadata,
  ]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ')
    .toLowerCase();
}

function runtimeEventIsMissingCredentialState(event: GraphRuntimeEvent) {
  if (!runtimeEventIsToolCall(event)) {
    return false;
  }

  const text = runtimeEventDiagnosticText(event);
  return (
    text.includes('missing credential') ||
    text.includes('no credential') ||
    text.includes('credential required') ||
    text.includes('credentials required') ||
    text.includes('missing api key') ||
    text.includes('api key required') ||
    text.includes('missing token') ||
    text.includes('oauth required')
  );
}

function runtimeEventIsBlockedToolState(event: GraphRuntimeEvent) {
  const normalizedStatus = event.status?.toLowerCase() ?? '';
  const normalizedType = event.type.replace(/_/g, '.').toLowerCase();
  const text = runtimeEventDiagnosticText(event);

  return (
    runtimeEventIsMissingCredentialState(event) ||
    text.includes('blocked tool') ||
    text.includes('tool blocked') ||
    (runtimeEventIsToolCall(event) &&
      (normalizedStatus === 'blocked' ||
        normalizedStatus === 'waiting' ||
        normalizedType.includes('.blocked') ||
        normalizedType.includes('.denied') ||
        normalizedType.includes('.rejected') ||
        text.includes('blocked') ||
        text.includes('forbidden') ||
        text.includes('unauthorized') ||
        text.includes('not authorized') ||
        text.includes('permission denied') ||
        text.includes('permission required') ||
        text.includes('auth required') ||
        text.includes('authentication required')))
  );
}

function runtimeEventIsMissingContextState(event: GraphRuntimeEvent) {
  const text = runtimeEventDiagnosticText(event);
  return (
    runtimeEventIsMissingMemoryState(event) ||
    runtimeEventIsMemoryAuthState(event) ||
    runtimeEventIsMemoryPermissionState(event) ||
    text.includes('missing context') ||
    text.includes('context not found') ||
    text.includes('no context') ||
    text.includes('context pack not found') ||
    text.includes('missing document') ||
    text.includes('document not found')
  );
}

function runtimeEventIsFailedGuardrailState(event: GraphRuntimeEvent) {
  const normalizedType = event.type.replace(/_/g, '.').toLowerCase();
  const text = runtimeEventDiagnosticText(event);
  return (
    normalizedType.includes('guardrail') ||
    text.includes('guardrail') ||
    text.includes('policy violation') ||
    text.includes('policy check failed') ||
    text.includes('safety check failed') ||
    text.includes('validation guard failed')
  );
}

function runtimeEventIsAgentStep(event: GraphRuntimeEvent) {
  const normalizedType = event.type.replace(/_/g, '.').toLowerCase();
  return normalizedType.startsWith('agent.step.') || normalizedType.startsWith('subagent.step.');
}

function runtimeEventPausePointLabel(event: GraphRuntimeEvent) {
  if (runtimeEventIsFailedGuardrailState(event)) {
    return 'Guardrail pause point: retry task';
  }

  if (runtimeEventIsBlockedToolState(event)) {
    return 'Blocked tool pause point: retry task';
  }

  if (runtimeEventIsMissingContextState(event)) {
    return 'Missing context pause point: retry task';
  }

  return null;
}

function runtimeEventIsMemoryContext(event: GraphRuntimeEvent) {
  const normalizedType = event.type.replace(/_/g, '.').toLowerCase();
  return (
    normalizedType.startsWith('memory.') ||
    normalizedType.startsWith('context.') ||
    runtimeEventMemoryIds(event).length > 0
  );
}

function runtimeEventIsStaleMemoryState(event: GraphRuntimeEvent) {
  if (!runtimeEventIsMemoryContext(event)) {
    return false;
  }

  const text = runtimeEventDiagnosticText(event);
  return (
    text.includes('stale memory') ||
    text.includes('stale context') ||
    text.includes('outdated memory') ||
    text.includes('outdated context') ||
    text.includes('expired memory') ||
    text.includes('expired context')
  );
}

function runtimeEventIsMissingMemoryState(event: GraphRuntimeEvent) {
  if (!runtimeEventIsMemoryContext(event)) {
    return false;
  }

  const text = runtimeEventDiagnosticText(event);
  return (
    text.includes('missing memory') ||
    text.includes('memory not found') ||
    text.includes('unknown memory') ||
    text.includes('no memory') ||
    text.includes('missing context') ||
    text.includes('context not found') ||
    text.includes('no context')
  );
}

function runtimeEventIsMemoryAuthState(event: GraphRuntimeEvent) {
  if (!runtimeEventIsMemoryContext(event)) {
    return false;
  }

  const text = runtimeEventDiagnosticText(event);
  return (
    text.includes('unauthorized') ||
    text.includes('auth required') ||
    text.includes('authentication required') ||
    text.includes('oauth required') ||
    text.includes('missing credential') ||
    text.includes('credential required') ||
    text.includes('token expired')
  );
}

function runtimeEventIsMemoryPermissionState(event: GraphRuntimeEvent) {
  if (!runtimeEventIsMemoryContext(event)) {
    return false;
  }

  const text = runtimeEventDiagnosticText(event);
  return (
    text.includes('permission denied') ||
    text.includes('permission required') ||
    text.includes('access denied') ||
    text.includes('forbidden') ||
    text.includes('not authorized') ||
    text.includes('insufficient permission') ||
    text.includes('insufficient scope')
  );
}

function runtimeEventTaskKey(event: GraphRuntimeEvent) {
  return (
    graphRuntimeEventString(event, 'taskId') ??
    graphRuntimeEventString(event, 'task_id') ??
    (event.nodeId?.startsWith(`${workflowGraphNodeTypes.task.replace(/\./g, '-')}-`)
      ? event.nodeId
      : null)
  );
}

function runtimeEventTaskId(event: GraphRuntimeEvent) {
  return graphRuntimeEventString(event, 'taskId') ?? graphRuntimeEventString(event, 'task_id');
}

function runtimeEventIsTaskCompletion(event: GraphRuntimeEvent) {
  const normalizedStatus = event.status?.toLowerCase() ?? '';
  const normalizedType = event.type.replace(/_/g, '.').toLowerCase();

  return (
    Boolean(runtimeEventTaskKey(event)) &&
    (normalizedStatus === 'succeeded' ||
      normalizedStatus === 'completed' ||
      normalizedType.endsWith('.succeeded') ||
      normalizedType.endsWith('.completed'))
  );
}

function runtimeEventDurationMs(event: GraphRuntimeEvent) {
  const durationKeys = [
    'durationMs',
    'duration_ms',
    'elapsedMs',
    'elapsed_ms',
    'latencyMs',
    'latency_ms',
    'runtimeMs',
    'runtime_ms',
  ];

  for (const key of durationKeys) {
    const duration =
      graphRuntimeEventNumber(event, key) ?? graphRuntimeEventMetricNumber(event, key);
    if (duration && duration > 0) {
      return duration;
    }
  }

  const durationSeconds =
    graphRuntimeEventNumber(event, 'durationSeconds') ??
    graphRuntimeEventNumber(event, 'duration_seconds') ??
    graphRuntimeEventMetricNumber(event, 'durationSeconds') ??
    graphRuntimeEventMetricNumber(event, 'duration_seconds');

  return durationSeconds && durationSeconds > 0 ? durationSeconds * 1000 : null;
}

function runtimeEventTokenCount(event: GraphRuntimeEvent) {
  const tokenKeys = [
    'totalTokens',
    'total_tokens',
    'tokenCount',
    'token_count',
    'tokens',
    'usedTokens',
    'used_tokens',
  ];

  for (const key of tokenKeys) {
    const tokenCount =
      graphRuntimeEventNumber(event, key) ?? graphRuntimeEventMetricNumber(event, key);
    if (typeof tokenCount === 'number' && tokenCount > 0) {
      return tokenCount;
    }
  }

  const inputTokens =
    graphRuntimeEventNumber(event, 'inputTokens') ??
    graphRuntimeEventNumber(event, 'input_tokens') ??
    graphRuntimeEventMetricNumber(event, 'inputTokens') ??
    graphRuntimeEventMetricNumber(event, 'input_tokens');
  const outputTokens =
    graphRuntimeEventNumber(event, 'outputTokens') ??
    graphRuntimeEventNumber(event, 'output_tokens') ??
    graphRuntimeEventMetricNumber(event, 'outputTokens') ??
    graphRuntimeEventMetricNumber(event, 'output_tokens');

  return inputTokens || outputTokens ? (inputTokens ?? 0) + (outputTokens ?? 0) : null;
}

function formatRuntimeDuration(durationMs: number) {
  if (durationMs < 1000) {
    return `${Math.round(durationMs)}ms`;
  }

  if (durationMs < 60_000) {
    return `${(durationMs / 1000).toFixed(durationMs < 10_000 ? 1 : 0)}s`;
  }

  return `${(durationMs / 60_000).toFixed(1)}m`;
}

interface WorkflowGraphRunSummary {
  completedTaskCount: number;
  failedTaskCount: number;
  outputCount: number;
  artifactCount: number;
  tokenLabel: string | null;
  durationLabel: string | null;
  followUpActions: string[];
}

function workflowGraphRunSummary(events: GraphRuntimeEvent[]): WorkflowGraphRunSummary | null {
  const realEvents = events.filter((event) => !runtimeEventIsProjection(event));
  if (realEvents.length === 0) {
    return null;
  }

  const failedTaskKeys = new Set(
    realEvents
      .filter((event) => runtimeEventIsFailure(event) && Boolean(runtimeEventTaskKey(event)))
      .map(runtimeEventTaskKey)
      .filter((taskKey): taskKey is string => Boolean(taskKey))
  );
  const completedTaskKeys = new Set(
    realEvents
      .filter(runtimeEventIsTaskCompletion)
      .map(runtimeEventTaskKey)
      .filter((taskKey): taskKey is string => Boolean(taskKey))
      .filter((taskKey) => !failedTaskKeys.has(taskKey))
  );
  const outputCount = realEvents.filter(
    (event) => runtimePayloadDirection(event).label === 'Output'
  ).length;
  const artifactCount = realEvents.filter(
    (event) => runtimePayloadDirection(event).label === 'Artifact'
  ).length;
  const waitingApprovalCount = realEvents.filter((event) => {
    const normalizedStatus = event.status?.toLowerCase() ?? '';
    const normalizedType = event.type.replace(/_/g, '.').toLowerCase();

    return (
      normalizedType.startsWith('approval.') &&
      (normalizedStatus === 'waiting' ||
        normalizedStatus === 'blocked' ||
        normalizedType.includes('waiting') ||
        normalizedType.includes('blocked'))
    );
  }).length;
  const tokenCounts = realEvents
    .map(runtimeEventTokenCount)
    .filter((tokenCount): tokenCount is number => typeof tokenCount === 'number' && tokenCount > 0);
  const explicitDurations = realEvents
    .map(runtimeEventDurationMs)
    .filter((duration): duration is number => typeof duration === 'number' && duration > 0);
  const eventTimes = realEvents
    .map(runtimeEventSortTime)
    .filter((time) => Number.isFinite(time) && time > 0);
  const elapsedDuration =
    eventTimes.length > 1 ? Math.max(...eventTimes) - Math.min(...eventTimes) : null;
  const durationMs =
    elapsedDuration && elapsedDuration > 0
      ? elapsedDuration
      : explicitDurations.length > 0
        ? Math.max(...explicitDurations)
        : null;

  return {
    completedTaskCount: completedTaskKeys.size,
    failedTaskCount: failedTaskKeys.size,
    outputCount,
    artifactCount,
    tokenLabel: compactTokenCount(tokenCounts.length > 0 ? Math.max(...tokenCounts) : null),
    durationLabel: durationMs ? formatRuntimeDuration(durationMs) : null,
    followUpActions: [
      failedTaskKeys.size > 0 ? 'Review failed tasks' : null,
      waitingApprovalCount > 0 ? 'Resolve approvals' : null,
      outputCount + artifactCount > 0 ? 'Review outputs' : null,
    ].filter((action): action is string => Boolean(action)),
  };
}

function nodeRuntimeEvidenceFromEvents(node: GraphNode, runtimeEvents: GraphRuntimeEvent[]) {
  const matchingEvents = runtimeEvents.filter(
    (event) => !runtimeEventIsProjection(event) && runtimeEventMatchesNode(node, event)
  );
  const failureEvents = matchingEvents.filter(runtimeEventIsFailure);
  const failureGroups = new Map<string, { summary: string; count: number }>();
  failureEvents.forEach((event) => {
    const summary = runtimePayloadSummary(event) ?? event.type;
    const normalizedSummary = summary.trim().toLowerCase();
    if (!normalizedSummary) {
      return;
    }

    const existingGroup = failureGroups.get(normalizedSummary);
    failureGroups.set(normalizedSummary, {
      summary: existingGroup?.summary ?? summary,
      count: (existingGroup?.count ?? 0) + 1,
    });
  });
  const repeatedFailureGroup =
    Array.from(failureGroups.values())
      .filter((group) => group.count > 1)
      .sort((left, right) => right.count - left.count || left.summary.localeCompare(right.summary))
      .at(0) ?? null;
  const stepEvents = matchingEvents.filter(runtimeEventIsAgentStep);
  const toolCallCount = matchingEvents.filter(runtimeEventIsToolCall).length;
  const toolStateEvents =
    node.type === workflowGraphNodeTypes.tool ? matchingEvents.filter(runtimeEventIsToolCall) : [];
  const blockedToolEvents = toolStateEvents.filter(runtimeEventIsBlockedToolState);
  const missingCredentialEvents = toolStateEvents.filter(runtimeEventIsMissingCredentialState);
  const memoryContextEvents =
    node.type === workflowGraphNodeTypes.memory
      ? matchingEvents.filter(runtimeEventIsMemoryContext)
      : [];
  const staleMemoryEvents = memoryContextEvents.filter(runtimeEventIsStaleMemoryState);
  const missingMemoryEvents = memoryContextEvents.filter(runtimeEventIsMissingMemoryState);
  const memoryAuthEvents = memoryContextEvents.filter(runtimeEventIsMemoryAuthState);
  const memoryPermissionEvents = memoryContextEvents.filter(runtimeEventIsMemoryPermissionState);
  const durations = matchingEvents
    .map(runtimeEventDurationMs)
    .filter((duration): duration is number => typeof duration === 'number' && duration > 0);
  const averageDuration =
    durations.length > 0
      ? durations.reduce((total, duration) => total + duration, 0) / durations.length
      : null;
  const latestFailure = [...failureEvents].sort(
    (left, right) => runtimeEventSortTime(left) - runtimeEventSortTime(right)
  )[failureEvents.length - 1];
  const latestStepEvent = [...stepEvents].sort(
    (left, right) => runtimeEventSortTime(left) - runtimeEventSortTime(right)
  )[stepEvents.length - 1];
  const latestMemoryContextEvent = [...memoryContextEvents].sort(
    (left, right) => runtimeEventSortTime(left) - runtimeEventSortTime(right)
  )[memoryContextEvents.length - 1];
  const latestStaleMemoryEvent = [...staleMemoryEvents].sort(
    (left, right) => runtimeEventSortTime(left) - runtimeEventSortTime(right)
  )[staleMemoryEvents.length - 1];
  const latestMissingMemoryEvent = [...missingMemoryEvents].sort(
    (left, right) => runtimeEventSortTime(left) - runtimeEventSortTime(right)
  )[missingMemoryEvents.length - 1];
  const latestMemoryAuthEvent = [...memoryAuthEvents].sort(
    (left, right) => runtimeEventSortTime(left) - runtimeEventSortTime(right)
  )[memoryAuthEvents.length - 1];
  const latestMemoryPermissionEvent = [...memoryPermissionEvents].sort(
    (left, right) => runtimeEventSortTime(left) - runtimeEventSortTime(right)
  )[memoryPermissionEvents.length - 1];
  const latestBlockedToolEvent = [...blockedToolEvents].sort(
    (left, right) => runtimeEventSortTime(left) - runtimeEventSortTime(right)
  )[blockedToolEvents.length - 1];
  const latestMissingCredentialEvent = [...missingCredentialEvents].sort(
    (left, right) => runtimeEventSortTime(left) - runtimeEventSortTime(right)
  )[missingCredentialEvents.length - 1];

  return {
    failureCount: failureEvents.length,
    failureClusterCount: failureGroups.size,
    repeatedFailureLabel: repeatedFailureGroup
      ? `${repeatedFailureGroup.count}x ${repeatedFailureGroup.summary}`
      : null,
    stepCount: stepEvents.length,
    toolCallCount,
    blockedToolCount: blockedToolEvents.length,
    missingCredentialCount: missingCredentialEvents.length,
    memoryContextCount: memoryContextEvents.length,
    staleMemoryCount: staleMemoryEvents.length,
    missingMemoryCount: missingMemoryEvents.length,
    memoryAuthCount: memoryAuthEvents.length,
    memoryPermissionCount: memoryPermissionEvents.length,
    averageDurationLabel: averageDuration ? formatRuntimeDuration(averageDuration) : null,
    latestFailureSummary: latestFailure ? runtimePayloadSummary(latestFailure) : null,
    latestStepSummary: latestStepEvent ? runtimePayloadSummary(latestStepEvent) : null,
    latestBlockedToolSummary: latestBlockedToolEvent
      ? runtimePayloadSummary(latestBlockedToolEvent)
      : null,
    latestMissingCredentialSummary: latestMissingCredentialEvent
      ? runtimePayloadSummary(latestMissingCredentialEvent)
      : null,
    latestMemoryContextSummary: latestMemoryContextEvent
      ? runtimePayloadSummary(latestMemoryContextEvent)
      : null,
    latestStaleMemorySummary: latestStaleMemoryEvent
      ? runtimePayloadSummary(latestStaleMemoryEvent)
      : null,
    latestMissingMemorySummary: latestMissingMemoryEvent
      ? runtimePayloadSummary(latestMissingMemoryEvent)
      : null,
    latestMemoryAuthSummary: latestMemoryAuthEvent
      ? runtimePayloadSummary(latestMemoryAuthEvent)
      : null,
    latestMemoryPermissionSummary: latestMemoryPermissionEvent
      ? runtimePayloadSummary(latestMemoryPermissionEvent)
      : null,
  };
}

function runtimeEventStatusClassName(status: string | undefined) {
  if (status === 'running' || status === 'transmitting' || status === 'queued') {
    return 'border-sky-200 bg-sky-50 text-sky-700';
  }

  if (status === 'waiting' || status === 'blocked') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (status === 'succeeded' || status === 'completed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (status === 'failed') {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-neutral-200 bg-neutral-50 text-neutral-600';
}

function graphRuntimeTargetLabel(event: GraphRuntimeEvent, document: GraphDocument) {
  const workflowLabel = document.title?.trim() || 'Workflow';

  if (event.nodeId) {
    const node = document.nodes.find((candidate) => candidate.id === event.nodeId);
    if (node) {
      return node.label;
    }
  }

  if (event.edgeId) {
    const edge = document.edges.find((candidate) => candidate.id === event.edgeId);
    if (edge) {
      const source = document.nodes.find((node) => node.id === edge.source);
      const target = document.nodes.find((node) => node.id === edge.target);
      if (source?.label && target?.label) {
        return `${source.label} -> ${target.label}`;
      }
    }
  }

  if (event.graphId && (!event.nodeId || event.graphId === document.id)) {
    return workflowLabel;
  }

  return event.nodeId ?? event.edgeId ?? workflowLabel;
}

function runtimeEventTypeLabel(event: GraphRuntimeEvent) {
  const [, action] = event.type.split('.');
  const normalizedAction = action ?? event.type;

  if (event.type.startsWith('task.')) {
    return `Task ${normalizedAction}`;
  }

  if (event.type.startsWith('agent.')) {
    return `Agent ${normalizedAction}`;
  }

  if (event.type.startsWith('assignment.')) {
    return `Assignment ${normalizedAction}`;
  }

  if (event.type.startsWith('dependency.')) {
    return `Dependency ${normalizedAction}`;
  }

  if (event.type.startsWith('approval.')) {
    return `Approval ${normalizedAction}`;
  }

  if (event.type.startsWith('run.')) {
    return `Run ${normalizedAction}`;
  }

  return event.type;
}

function stopHandleClickPropagation(event: MouseEvent<HTMLDivElement>) {
  event.stopPropagation();
}

function connectorColorForNode(type: string, direction: 'input' | 'output') {
  if (type === workflowGraphNodeTypes.agent) {
    return direction === 'input'
      ? 'var(--workflow-connector-agent-input)'
      : 'var(--workflow-connector-agent-output)';
  }

  if (type === workflowGraphNodeTypes.tool) {
    return direction === 'input'
      ? 'var(--workflow-connector-tool-input)'
      : 'var(--workflow-connector-tool-output)';
  }

  if (type === workflowGraphNodeTypes.memory) {
    return direction === 'input'
      ? 'var(--workflow-connector-memory-input)'
      : 'var(--workflow-connector-memory-output)';
  }

  if (type === workflowGraphNodeTypes.artifact) {
    return direction === 'input'
      ? 'var(--workflow-connector-task-input)'
      : 'var(--workflow-connector-task-output)';
  }

  if (type === workflowGraphNodeTypes.approval) {
    return direction === 'input'
      ? 'var(--workflow-connector-approval-input)'
      : 'var(--workflow-connector-approval-output)';
  }

  if (type === workflowGraphNodeTypes.task) {
    return direction === 'input'
      ? 'var(--workflow-connector-task-input)'
      : 'var(--workflow-connector-task-output)';
  }

  return direction === 'input'
    ? 'var(--workflow-connector-default-input)'
    : 'var(--workflow-connector-default-output)';
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function nodeFacts(node: GraphNode) {
  const toolCount = readDataStringArray(node, 'toolIds').length;
  const memoryCount = readDataStringArray(node, 'memoryIds').length;

  if (node.type === workflowGraphNodeTypes.agent) {
    const modelProfileId = readDataString(node, 'modelProfileId');
    const modelProfileName = readDataString(node, 'modelProfileName');
    const handoffCount = readDataStringArray(node, 'handoffAgentIds').length;
    const personaSlug = readDataString(node, 'personaSlug');
    const personaVersionStatus = readDataString(node, 'personaVersionStatus');
    const personaVersionId = readDataString(node, 'personaVersionId');
    return [
      personaSlug
        ? `Persona: @${personaSlug}${
            personaVersionStatus === 'outdated' ? ' has newer version' : ''
          }`
        : null,
      personaVersionId ? `Persona version: ${shortPersonaVersionId(personaVersionId)}` : null,
      modelProfileId ? `Model: ${modelProfileName || modelProfileId}` : 'No model selected',
      toolCount > 0 ? formatCount(toolCount, 'tool') : 'No tools',
      memoryCount > 0 ? formatCount(memoryCount, 'memory', 'memories') : 'No memories',
      handoffCount > 0 ? `${formatCount(handoffCount, 'handoff')} enabled` : null,
    ].filter((fact): fact is string => Boolean(fact));
  }

  if (node.type === workflowGraphNodeTypes.task) {
    const agentName = readDataString(node, 'agentName');
    const agentId = readDataString(node, 'agentId');
    const dependencyCount = readDataNumber(node, 'dependencyCount');
    const downstreamCount = readDataNumber(node, 'downstreamCount');
    const humanApprovalRequired = readDataBoolean(node, 'humanApprovalRequired');
    return [
      agentName ?? (agentId ? 'Agent assigned' : 'No agent assigned'),
      dependencyCount > 0 ? `${formatCount(dependencyCount, 'dependency', 'dependencies')}` : null,
      downstreamCount > 0 ? `${formatCount(downstreamCount, 'next task')}` : null,
      toolCount > 0 ? formatCount(toolCount, 'tool') : 'No tools',
      memoryCount > 0 ? formatCount(memoryCount, 'memory', 'memories') : 'No memories',
      humanApprovalRequired ? 'Needs approval' : null,
    ].filter((fact): fact is string => Boolean(fact));
  }

  if (node.type === workflowGraphNodeTypes.tool) {
    const explicitToolCount = readDataNumber(node, 'toolCount');
    const aggregateToolCount = explicitToolCount > 0 ? explicitToolCount : toolCount;
    const toolNames = readDataStringArray(node, 'toolNames');
    const toolIds = readDataStringArray(node, 'toolIds');
    const toolCues = readDataStringArray(node, 'toolCues');
    const displayToolNames = toolNames.length > 0 ? toolNames : toolIds;
    const visibleToolNames = displayToolNames.slice(0, 3);
    return [
      ...visibleToolNames,
      displayToolNames.length > visibleToolNames.length
        ? `+${displayToolNames.length - visibleToolNames.length} more`
        : null,
      ...toolCues.slice(0, 3),
      aggregateToolCount > 0 ? formatCount(aggregateToolCount, 'tool') : 'No tools',
    ].filter((fact): fact is string => Boolean(fact));
  }

  if (node.type === workflowGraphNodeTypes.memory) {
    const memoryType = readDataString(node, 'memoryType');
    const scope = readDataString(node, 'scope');
    const catalogRefType = readDataString(node, 'catalogRefType');
    const catalogMemoryType = readDataString(node, 'catalogMemoryType');
    const catalogMode = readDataString(node, 'catalogMode');
    const catalogSensitive = readDataBoolean(node, 'catalogSensitive');
    const catalogEmbedded = readDataBoolean(node, 'catalogEmbedded');
    const backendMemoryLinkCount = readDataNumber(node, 'backendMemoryLinkCount');
    return [
      memoryType ? `${memoryType} memory` : 'Workflow memory',
      scope ? `${scope} scope` : null,
      catalogRefType ? catalogRefType.replace(/_/g, ' ') : null,
      catalogMemoryType ? catalogMemoryType.replace(/_/g, ' ') : null,
      catalogMode ? catalogMode.replace(/_/g, ' ') : null,
      catalogSensitive ? 'Sensitive' : null,
      catalogEmbedded ? 'Embedded' : null,
      backendMemoryLinkCount > 0
        ? formatCount(backendMemoryLinkCount, 'backend link')
        : 'No backend links',
    ].filter((fact): fact is string => Boolean(fact));
  }

  if (node.type === workflowGraphNodeTypes.artifact) {
    const artifactType = readDataString(node, 'artifactType');
    const mediaType = readDataString(node, 'mediaType');
    const producerTaskName = readDataString(node, 'producerTaskName');
    const producerTaskId = readDataString(node, 'producerTaskId');
    return [
      artifactType ? `${artifactType} artifact` : 'Workflow artifact',
      mediaType || null,
      producerTaskName || producerTaskId
        ? `Produced by: ${producerTaskName || producerTaskId}`
        : 'No producer task',
    ].filter((fact): fact is string => Boolean(fact));
  }

  if (node.type === workflowGraphNodeTypes.router) {
    const edgeType = readDataString(node, 'edgeType');
    const condition = readDataString(node, 'condition');
    return [condition ? 'Conditional route' : edgeType ? `${edgeType} route` : 'Route'];
  }

  if (node.type === workflowGraphNodeTypes.approval) {
    const taskName = readDataString(node, 'taskName');
    const taskId = readDataString(node, 'taskId');
    return [
      taskName || taskId ? `For task: ${taskName || taskId}` : null,
      'Human approval gate',
      'Task-owned setting',
    ].filter((fact): fact is string => Boolean(fact));
  }

  return [];
}

function nodeToolSummary(node: GraphNode) {
  if (node.type !== workflowGraphNodeTypes.tool) {
    return null;
  }

  const toolNames = readDataStringArray(node, 'toolNames');
  const toolIds = readDataStringArray(node, 'toolIds');
  const displayToolNames = toolNames.length > 0 ? toolNames : toolIds;
  const visibleToolNames = displayToolNames.slice(0, 4);

  if (visibleToolNames.length === 0) {
    return null;
  }

  return `${visibleToolNames.join(', ')}${
    displayToolNames.length > visibleToolNames.length ? '...' : ''
  }`;
}

function WorkflowGraphNodeCard({
  node,
  selected,
  readOnly,
  runtimeEvent,
  runtimeEventIsCurrent = false,
  validationIssues,
  onRemove,
  runtimeControl,
  runtimeControls,
  relationshipHighlighted = false,
}: GraphNodeRendererProps & {
  runtimeControl?: WorkflowGraphNodeRuntimeControl | null;
  runtimeControls?: WorkflowGraphRuntimeControls;
  relationshipHighlighted?: boolean;
}) {
  const tone = nodeTone(node.type);
  const runtimeClassName = runtimeStatusClassName(node.status);
  const dependencyCount = readDataNumber(node, 'dependencyCount');
  const conditionalDependencyCount = readDataNumber(node, 'conditionalDependencyCount');
  const successDependencyCount = readDataNumber(node, 'successDependencyCount');
  const failureDependencyCount = readDataNumber(node, 'failureDependencyCount');
  const downstreamCount = readDataNumber(node, 'downstreamCount');
  const facts = nodeFacts(node);
  const toolSummary = nodeToolSummary(node);
  const hasValidationErrors = validationIssues.some((issue) => issue.severity === 'error');
  const hasValidationWarnings = validationIssues.some((issue) => issue.severity === 'warning');
  const shouldShowDescription = Boolean(node.description && node.description !== toolSummary);
  const showTypeBadge = node.label.trim().toLowerCase() !== tone.badge.trim().toLowerCase();
  const taskBadges =
    node.type === workflowGraphNodeTypes.task
      ? [
          dependencyCount > 0 ? `${dependencyCount} dep${dependencyCount === 1 ? '' : 's'}` : null,
          downstreamCount > 0 ? `${downstreamCount} next` : null,
          conditionalDependencyCount > 0 ? `${conditionalDependencyCount} conditional` : null,
          successDependencyCount > 0 ? `${successDependencyCount} success` : null,
          failureDependencyCount > 0 ? `${failureDependencyCount} failure` : null,
        ].filter((badge): badge is string => Boolean(badge))
      : [];
  const visibleFactLimit =
    node.type === workflowGraphNodeTypes.task
      ? 6
      : node.type === workflowGraphNodeTypes.tool
        ? 5
        : 3;
  const visibleFacts = facts.slice(0, visibleFactLimit);
  const hiddenFactCount = Math.max(0, facts.length - visibleFacts.length);
  const visibleTaskBadges = taskBadges.slice(0, 3);
  const hiddenTaskBadgeCount = Math.max(0, taskBadges.length - visibleTaskBadges.length);
  const monitoringPolicyLabel = readDataString(node, 'monitoringPolicyLabel');
  const monitoringPolicyState = readDataString(node, 'monitoringPolicyState');
  const pendingSupervisorRequestCount = readDataNumber(node, 'pendingSupervisorRequestCount');
  const appliedSupervisorSteeringCount = readDataNumber(node, 'appliedSupervisorSteeringCount');
  const governanceTokenLabel = readDataString(node, 'governanceTokenLabel');
  const governanceContextStatus = readDataString(node, 'governanceContextStatus');
  const runtimeFailureCount = readDataNumber(node, 'runtimeFailureCount');
  const runtimeFailureClusterCount = readDataNumber(node, 'runtimeFailureClusterCount');
  const runtimeRepeatedFailureLabel = readDataString(node, 'runtimeRepeatedFailureLabel');
  const runtimeStepCount = readDataNumber(node, 'runtimeStepCount');
  const runtimeToolCallCount = readDataNumber(node, 'runtimeToolCallCount');
  const runtimeBlockedToolCount = readDataNumber(node, 'runtimeBlockedToolCount');
  const runtimeMissingCredentialCount = readDataNumber(node, 'runtimeMissingCredentialCount');
  const runtimeMemoryContextCount = readDataNumber(node, 'runtimeMemoryContextCount');
  const runtimeStaleMemoryCount = readDataNumber(node, 'runtimeStaleMemoryCount');
  const runtimeMissingMemoryCount = readDataNumber(node, 'runtimeMissingMemoryCount');
  const runtimeMemoryAuthCount = readDataNumber(node, 'runtimeMemoryAuthCount');
  const runtimeMemoryPermissionCount = readDataNumber(node, 'runtimeMemoryPermissionCount');
  const runtimeAverageDurationLabel = readDataString(node, 'runtimeAverageDurationLabel');
  const runtimeLatestFailureSummary = readDataString(node, 'runtimeLatestFailureSummary');
  const runtimeLatestStepSummary = readDataString(node, 'runtimeLatestStepSummary');
  const runtimeLatestBlockedToolSummary = readDataString(node, 'runtimeLatestBlockedToolSummary');
  const runtimeLatestMissingCredentialSummary = readDataString(
    node,
    'runtimeLatestMissingCredentialSummary'
  );
  const runtimeLatestMemoryContextSummary = readDataString(
    node,
    'runtimeLatestMemoryContextSummary'
  );
  const runtimeLatestStaleMemorySummary = readDataString(node, 'runtimeLatestStaleMemorySummary');
  const runtimeLatestMissingMemorySummary = readDataString(
    node,
    'runtimeLatestMissingMemorySummary'
  );
  const runtimeLatestMemoryAuthSummary = readDataString(node, 'runtimeLatestMemoryAuthSummary');
  const runtimeLatestMemoryPermissionSummary = readDataString(
    node,
    'runtimeLatestMemoryPermissionSummary'
  );
  const approvalTaskLabel =
    node.type === workflowGraphNodeTypes.approval
      ? (readDataString(node, 'taskName') ?? readDataString(node, 'taskId'))
      : null;
  const humanApprovalRequired =
    node.type === workflowGraphNodeTypes.task
      ? readDataBoolean(node, 'humanApprovalRequired')
      : false;
  const approvalRelationshipCue =
    node.type === workflowGraphNodeTypes.approval && approvalTaskLabel
      ? {
          label: 'Approval for',
          value: approvalTaskLabel,
          className:
            'border-sky-200 bg-sky-50/90 text-sky-950 dark:border-sky-300/25 dark:bg-sky-400/10 dark:text-sky-100',
          iconClassName: 'text-sky-600 dark:text-sky-200',
        }
      : humanApprovalRequired
        ? {
            label: 'Approval gate',
            value: 'Required before downstream work',
            className:
              'border-amber-200 bg-amber-50/90 text-amber-950 dark:border-amber-300/25 dark:bg-amber-400/10 dark:text-amber-100',
            iconClassName: 'text-amber-600 dark:text-amber-200',
          }
        : null;
  const personaVersionStatus = readDataString(node, 'personaVersionStatus');
  const personaSlug = readDataString(node, 'personaSlug');
  const isRuntimeControlPending = Boolean(runtimeControls?.isPending);
  const runtimeControlTaskId = runtimeControl?.taskId ?? null;
  const runtimeControlToolId = runtimeControl?.toolId ?? null;
  const steeringTaskId =
    node.type === workflowGraphNodeTypes.task ? readDataString(node, 'taskId') : null;
  const steeringAgentId =
    node.type === workflowGraphNodeTypes.agent ? readDataString(node, 'agentId') : null;
  const canRequestSteering = Boolean(
    runtimeControls?.canRequestSteering &&
    runtimeControls.onRequestSteering &&
    (steeringTaskId || steeringAgentId)
  );
  const showInputConnector = true;
  const showOutputConnector = node.type !== workflowGraphNodeTypes.approval;
  const monitoringPolicyClassName =
    monitoringPolicyState === 'excluded'
      ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-300/30 dark:bg-amber-500/12 dark:text-amber-100'
      : monitoringPolicyState === 'off'
        ? 'border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-white/10 dark:bg-white/6 dark:text-slate-300'
        : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-300/30 dark:bg-emerald-500/12 dark:text-emerald-100';
  type HeaderBadge = { key: string; node: ReactNode };
  const headerBadgeItems: Array<HeaderBadge | null> = [
    showTypeBadge
      ? {
          key: 'type',
          node: (
            <Badge variant="outline" className={cn('shrink-0', tone.badgeClassName)}>
              {tone.badge}
            </Badge>
          ),
        }
      : null,
    node.status
      ? {
          key: 'status',
          node: (
            <Badge variant="outline" className="shrink-0 capitalize">
              {node.status}
            </Badge>
          ),
        }
      : null,
    personaSlug
      ? {
          key: 'persona',
          node: (
            <Badge
              variant="outline"
              className={cn(
                'shrink-0',
                personaVersionStatus === 'outdated'
                  ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-300/30 dark:bg-amber-500/12 dark:text-amber-100'
                  : 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-300/30 dark:bg-sky-500/12 dark:text-sky-100'
              )}
              title={
                personaVersionStatus === 'outdated'
                  ? 'This workflow agent is pinned to an older persona version.'
                  : 'This workflow agent was materialized from a persona.'
              }
            >
              @{personaSlug}
            </Badge>
          ),
        }
      : null,
    monitoringPolicyLabel
      ? {
          key: 'monitoring',
          node: (
            <Badge variant="outline" className={cn('shrink-0', monitoringPolicyClassName)}>
              {monitoringPolicyLabel}
            </Badge>
          ),
        }
      : null,
    pendingSupervisorRequestCount > 0
      ? {
          key: 'pending-steer',
          node: (
            <Badge
              variant="outline"
              className="shrink-0 border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-300/30 dark:bg-amber-500/12 dark:text-amber-100"
            >
              {pendingSupervisorRequestCount} steer
            </Badge>
          ),
        }
      : null,
    appliedSupervisorSteeringCount > 0
      ? {
          key: 'applied-steer',
          node: (
            <Badge
              variant="outline"
              className="shrink-0 border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-300/30 dark:bg-sky-500/12 dark:text-sky-100"
            >
              {appliedSupervisorSteeringCount} applied
            </Badge>
          ),
        }
      : null,
    governanceTokenLabel
      ? {
          key: 'tokens',
          node: (
            <Badge
              variant="outline"
              className="shrink-0 border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-300/30 dark:bg-blue-500/12 dark:text-blue-100"
              title="Observed token usage"
            >
              {governanceTokenLabel} tok
            </Badge>
          ),
        }
      : null,
    governanceContextStatus
      ? {
          key: 'context',
          node: (
            <Badge
              variant="outline"
              className={cn('shrink-0', contextBadgeClassName(governanceContextStatus))}
              title="Latest observed context health"
            >
              ctx {governanceContextStatus}
            </Badge>
          ),
        }
      : null,
    runtimeFailureCount > 0
      ? {
          key: 'runtime-failures',
          node: (
            <Badge
              variant="outline"
              className="shrink-0 border-red-300 bg-red-50 text-red-800 dark:border-red-300/30 dark:bg-red-500/12 dark:text-red-100"
              title="Runtime failures observed on this node"
            >
              {runtimeFailureCount} failure{runtimeFailureCount === 1 ? '' : 's'}
            </Badge>
          ),
        }
      : null,
    runtimeFailureClusterCount > 1
      ? {
          key: 'failure-groups',
          node: (
            <Badge
              variant="outline"
              className="shrink-0 border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-300/30 dark:bg-rose-500/12 dark:text-rose-100"
              title="Distinct runtime failure groups observed on this node"
            >
              {runtimeFailureClusterCount} failure groups
            </Badge>
          ),
        }
      : null,
    runtimeStepCount > 0
      ? {
          key: 'runtime-steps',
          node: (
            <Badge
              variant="outline"
              className="shrink-0 border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-300/30 dark:bg-violet-500/12 dark:text-violet-100"
              title="Agent execution steps observed for this node"
            >
              {runtimeStepCount} step{runtimeStepCount === 1 ? '' : 's'}
            </Badge>
          ),
        }
      : null,
    runtimeToolCallCount > 0
      ? {
          key: 'tool-calls',
          node: (
            <Badge
              variant="outline"
              className="shrink-0 border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-300/30 dark:bg-orange-500/12 dark:text-orange-100"
              title="Tool calls observed for this node"
            >
              {runtimeToolCallCount} tool call{runtimeToolCallCount === 1 ? '' : 's'}
            </Badge>
          ),
        }
      : null,
    runtimeBlockedToolCount > 0
      ? {
          key: 'blocked-tools',
          node: (
            <Badge
              variant="outline"
              className="shrink-0 border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-300/30 dark:bg-amber-500/12 dark:text-amber-100"
              title="Blocked tool activity observed for this node"
            >
              {runtimeBlockedToolCount} blocked
            </Badge>
          ),
        }
      : null,
    runtimeMissingCredentialCount > 0
      ? {
          key: 'missing-credentials',
          node: (
            <Badge
              variant="outline"
              className="shrink-0 border-red-300 bg-red-50 text-red-800 dark:border-red-300/30 dark:bg-red-500/12 dark:text-red-100"
              title="Tool activity blocked by missing credentials"
            >
              {runtimeMissingCredentialCount} credential
            </Badge>
          ),
        }
      : null,
    runtimeMemoryContextCount > 0
      ? {
          key: 'memory-context',
          node: (
            <Badge
              variant="outline"
              className="shrink-0 border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-300/30 dark:bg-cyan-500/12 dark:text-cyan-100"
              title="Runtime context retrieval observed for this memory"
            >
              {runtimeMemoryContextCount} context
            </Badge>
          ),
        }
      : null,
    runtimeStaleMemoryCount > 0
      ? {
          key: 'stale-memory',
          node: (
            <Badge
              variant="outline"
              className="shrink-0 border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-300/30 dark:bg-amber-500/12 dark:text-amber-100"
              title="Runtime stale memory warnings observed for this memory"
            >
              {runtimeStaleMemoryCount} stale
            </Badge>
          ),
        }
      : null,
    runtimeMissingMemoryCount > 0
      ? {
          key: 'missing-memory',
          node: (
            <Badge
              variant="outline"
              className="shrink-0 border-red-300 bg-red-50 text-red-800 dark:border-red-300/30 dark:bg-red-500/12 dark:text-red-100"
              title="Runtime missing memory warnings observed for this memory"
            >
              {runtimeMissingMemoryCount} missing
            </Badge>
          ),
        }
      : null,
    runtimeMemoryAuthCount > 0
      ? {
          key: 'memory-auth',
          node: (
            <Badge
              variant="outline"
              className="shrink-0 border-red-300 bg-red-50 text-red-800 dark:border-red-300/30 dark:bg-red-500/12 dark:text-red-100"
              title="Runtime memory authentication warnings observed for this memory"
            >
              {runtimeMemoryAuthCount} auth
            </Badge>
          ),
        }
      : null,
    runtimeMemoryPermissionCount > 0
      ? {
          key: 'memory-permission',
          node: (
            <Badge
              variant="outline"
              className="shrink-0 border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-300/30 dark:bg-rose-500/12 dark:text-rose-100"
              title="Runtime memory permission warnings observed for this memory"
            >
              {runtimeMemoryPermissionCount} permission
            </Badge>
          ),
        }
      : null,
    runtimeAverageDurationLabel
      ? {
          key: 'avg-duration',
          node: (
            <Badge
              variant="outline"
              className="shrink-0 border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-white/10 dark:bg-white/6 dark:text-slate-200"
              title="Average runtime duration observed for this node"
            >
              avg {runtimeAverageDurationLabel}
            </Badge>
          ),
        }
      : null,
  ];
  const headerBadges = headerBadgeItems.filter((badge): badge is HeaderBadge => Boolean(badge));
  const visibleHeaderBadges = headerBadges.slice(0, 3);
  const hiddenHeaderBadgeCount = Math.max(0, headerBadges.length - visibleHeaderBadges.length);

  return (
    <div
      className={cn(
        'workflow-graph-node-card relative min-w-[24rem] max-w-md cursor-grab select-none overflow-visible rounded-2xl border bg-white px-4 py-4 text-sm shadow-sm active:cursor-grabbing dark:bg-slate-950 dark:shadow-[0_22px_52px_rgba(2,8,23,0.58)]',
        selected
          ? 'border-neutral-900 ring-2 ring-neutral-200 dark:border-slate-100 dark:ring-slate-300/20'
          : hasValidationErrors
            ? 'border-red-300 bg-red-50/80 ring-2 ring-red-100 dark:border-red-300 dark:bg-red-500/14 dark:ring-red-400/20'
            : hasValidationWarnings
              ? 'border-amber-300 bg-amber-50/80 ring-2 ring-amber-100 dark:border-amber-300 dark:bg-amber-500/14 dark:ring-amber-400/20'
              : runtimeClassName
                ? runtimeClassName
                : tone.className,
        relationshipHighlighted &&
          !selected &&
          'ring-2 ring-blue-300/70 shadow-[0_20px_52px_rgba(37,99,235,0.22)] dark:ring-blue-300/35 dark:shadow-[0_24px_58px_rgba(37,99,235,0.18)]'
      )}
      data-relationship-highlighted={relationshipHighlighted ? 'approval' : undefined}
    >
      <div className={cn('absolute inset-y-0 left-0 w-1.5 rounded-l-xl', tone.accentClassName)} />
      {!readOnly && onRemove ? (
        <button
          type="button"
          aria-label={`Remove ${node.label}`}
          title={`Remove ${node.label}`}
          className="nodrag nopan absolute right-2 top-2 z-20 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/80 bg-white/95 text-neutral-500 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-white/10 dark:bg-slate-950 dark:text-slate-400 dark:hover:border-red-400/30 dark:hover:bg-red-500/10 dark:hover:text-red-200"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          onDoubleClick={(event) => {
            event.stopPropagation();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}
      {showInputConnector ? (
        <Handle
          type="target"
          position={Position.Left}
          title={
            node.type === workflowGraphNodeTypes.approval
              ? 'Approval required by the linked task'
              : 'Connect into this node'
          }
          className="workflow-node-connector workflow-node-connector-input h-5! w-5! rounded-full! border-2! border-white! opacity-100! shadow-md transition-transform hover:scale-125! dark:border-slate-950!"
          style={{
            left: -11,
            zIndex: 10,
            backgroundColor: connectorColorForNode(node.type, 'input'),
          }}
          onClick={stopHandleClickPropagation}
          onDoubleClick={stopHandleClickPropagation}
        />
      ) : null}
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/70 bg-white/90 shadow-sm dark:border-white/10 dark:bg-slate-900">
          {tone.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="grid min-w-0 gap-2 pr-9">
            <p className="min-w-0 truncate text-base font-semibold leading-6 text-neutral-900 dark:text-slate-100">
              {node.label}
            </p>
            <div className="flex max-w-full flex-wrap gap-1.5 overflow-hidden">
              {visibleHeaderBadges.map((badge) => (
                <span key={badge.key} className="min-w-0 max-w-full">
                  {badge.node}
                </span>
              ))}
              {hiddenHeaderBadgeCount > 0 ? (
                <Badge
                  variant="outline"
                  className="shrink-0 border-white/80 bg-white/85 text-neutral-600 dark:border-white/10 dark:bg-white/6 dark:text-slate-300"
                  title={`${hiddenHeaderBadgeCount} more node status signals`}
                >
                  +{hiddenHeaderBadgeCount} more
                </Badge>
              ) : null}
            </div>
          </div>
          {runtimeLatestFailureSummary ? (
            <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-red-800 dark:text-red-200">
              Latest failure: {runtimeLatestFailureSummary}
            </p>
          ) : null}
          {runtimeLatestStepSummary ? (
            <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-violet-800 dark:text-violet-200">
              Latest step: {runtimeLatestStepSummary}
            </p>
          ) : null}
          {approvalRelationshipCue ? (
            <div
              className={cn(
                'mt-2 flex items-start gap-2 rounded-xl border px-2.5 py-2 text-xs shadow-sm',
                approvalRelationshipCue.className
              )}
            >
              <ShieldCheck
                className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', approvalRelationshipCue.iconClassName)}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <div className="font-semibold uppercase tracking-[0.14em] opacity-75">
                  {approvalRelationshipCue.label}
                </div>
                <div className="line-clamp-2 font-semibold leading-5">
                  {approvalRelationshipCue.value}
                </div>
              </div>
            </div>
          ) : null}
          {runtimeRepeatedFailureLabel ? (
            <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-rose-800 dark:text-rose-200">
              Repeated failure: {runtimeRepeatedFailureLabel}
            </p>
          ) : null}
          {runtimeLatestMissingCredentialSummary ? (
            <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-red-800 dark:text-red-200">
              Missing credential: {runtimeLatestMissingCredentialSummary}
            </p>
          ) : null}
          {runtimeLatestBlockedToolSummary && !runtimeLatestMissingCredentialSummary ? (
            <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-amber-800 dark:text-amber-200">
              Blocked tool: {runtimeLatestBlockedToolSummary}
            </p>
          ) : null}
          {runtimeLatestMemoryContextSummary ? (
            <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-cyan-800 dark:text-cyan-200">
              Retrieved context: {runtimeLatestMemoryContextSummary}
            </p>
          ) : null}
          {runtimeLatestMissingMemorySummary ? (
            <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-red-800 dark:text-red-200">
              Missing memory: {runtimeLatestMissingMemorySummary}
            </p>
          ) : null}
          {runtimeLatestMemoryAuthSummary ? (
            <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-red-800 dark:text-red-200">
              Memory auth: {runtimeLatestMemoryAuthSummary}
            </p>
          ) : null}
          {runtimeLatestMemoryPermissionSummary ? (
            <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-rose-800 dark:text-rose-200">
              Memory permission: {runtimeLatestMemoryPermissionSummary}
            </p>
          ) : null}
          {runtimeLatestStaleMemorySummary ? (
            <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-amber-800 dark:text-amber-200">
              Stale memory: {runtimeLatestStaleMemorySummary}
            </p>
          ) : null}
          {toolSummary ? (
            <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-orange-800 dark:text-orange-200">
              {toolSummary}
            </p>
          ) : null}
          {shouldShowDescription ? (
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-600 dark:text-slate-300">
              {node.description}
            </p>
          ) : null}
          {facts.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {visibleFacts.map((fact) => (
                <span
                  key={fact}
                  className="rounded-full border border-white/80 bg-white/85 px-2 py-0.5 text-[11px] font-medium text-neutral-600 shadow-sm dark:border-white/10 dark:bg-white/6 dark:text-slate-300"
                >
                  {fact}
                </span>
              ))}
              {hiddenFactCount > 0 ? (
                <span className="rounded-full border border-white/80 bg-white/85 px-2 py-0.5 text-[11px] font-medium text-neutral-500 shadow-sm dark:border-white/10 dark:bg-white/6 dark:text-slate-400">
                  +{hiddenFactCount} more
                </span>
              ) : null}
            </div>
          ) : null}
          {taskBadges.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {visibleTaskBadges.map((badge) => (
                <Badge
                  key={badge}
                  variant="outline"
                  className="bg-white/80 text-[11px] dark:border-white/10 dark:bg-white/6 dark:text-slate-200"
                >
                  {badge}
                </Badge>
              ))}
              {hiddenTaskBadgeCount > 0 ? (
                <Badge
                  variant="outline"
                  className="bg-white/80 text-[11px] dark:border-white/10 dark:bg-white/6 dark:text-slate-400"
                >
                  +{hiddenTaskBadgeCount} more
                </Badge>
              ) : null}
            </div>
          ) : null}
          {canRequestSteering ? (
            <div className="nodrag nopan mt-2 flex">
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-sky-200 bg-white px-2.5 text-[11px] font-semibold text-sky-800 shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-300/30 dark:bg-slate-950/72 dark:text-sky-100 dark:hover:bg-sky-500/12"
                disabled={isRuntimeControlPending}
                title="Request main-agent steering for this graph node"
                aria-label={`Request main-agent steering for ${node.label}`}
                onClick={(event) => {
                  event.stopPropagation();
                  runtimeControls?.onRequestSteering?.({
                    taskId: steeringTaskId,
                    agentId: steeringAgentId,
                  });
                }}
                onDoubleClick={(event) => event.stopPropagation()}
              >
                <Route className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Steer</span>
              </button>
            </div>
          ) : null}
          {runtimeControl ? (
            <div className="nodrag nopan mt-2 rounded-md border border-amber-200 bg-amber-50/80 px-2 py-2 text-[11px] text-amber-900 shadow-sm dark:border-amber-300/30 dark:bg-amber-500/12 dark:text-amber-100">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate font-semibold">{runtimeControl.label}</span>
                {runtimeControl.kind === 'resume' ? (
                  <button
                    type="button"
                    className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 font-medium text-emerald-800 shadow-sm hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-300/30 dark:bg-slate-950/72 dark:text-emerald-100 dark:hover:bg-emerald-500/12"
                    disabled={isRuntimeControlPending}
                    title={`Resume run ${shortRuntimeRunId(runtimeControl.runId)}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      runtimeControls?.onResumeRun?.(runtimeControl.runId);
                    }}
                    onDoubleClick={(event) => event.stopPropagation()}
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>Resume</span>
                  </button>
                ) : null}
                {runtimeControl.kind === 'retryTask' && runtimeControlTaskId ? (
                  <button
                    type="button"
                    className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-amber-200 bg-white px-2 font-medium text-amber-800 shadow-sm hover:border-amber-300 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-300/30 dark:bg-slate-950/72 dark:text-amber-100 dark:hover:bg-amber-500/12"
                    disabled={isRuntimeControlPending}
                    title={`Retry failed task from run ${shortRuntimeRunId(runtimeControl.runId)}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      runtimeControls?.onRetryTask?.(runtimeControl.runId, runtimeControlTaskId);
                    }}
                    onDoubleClick={(event) => event.stopPropagation()}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Retry</span>
                  </button>
                ) : null}
                {runtimeControl.kind === 'checkpointResume' ? (
                  <button
                    type="button"
                    className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-cyan-200 bg-white px-2 font-medium text-cyan-800 shadow-sm hover:border-cyan-300 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-cyan-300/30 dark:bg-slate-950/72 dark:text-cyan-100 dark:hover:bg-cyan-500/12"
                    disabled={isRuntimeControlPending}
                    title={`Resume checkpoint from run ${shortRuntimeRunId(runtimeControl.runId)}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      runtimeControls?.onResumeFromCheckpoint?.(runtimeControl.runId);
                    }}
                    onDoubleClick={(event) => event.stopPropagation()}
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>Resume</span>
                  </button>
                ) : null}
              </div>
              {runtimeControl.kind === 'nativeApproval' && runtimeControlToolId ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {runtimeControls?.onApproveTool ? (
                    <button
                      type="button"
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-sky-200 bg-white px-2 font-medium text-sky-800 shadow-sm hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-300/30 dark:bg-slate-950/72 dark:text-sky-100 dark:hover:bg-sky-500/12"
                      disabled={isRuntimeControlPending}
                      title={`Approve ${runtimeControl.toolLabel ?? runtimeControlToolId}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        runtimeControls.onApproveTool?.(runtimeControl.runId, runtimeControlToolId);
                      }}
                      onDoubleClick={(event) => event.stopPropagation()}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Approve</span>
                    </button>
                  ) : null}
                  {runtimeControls?.onRejectTool ? (
                    <button
                      type="button"
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-red-200 bg-white px-2 font-medium text-red-800 shadow-sm hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-300/30 dark:bg-slate-950/72 dark:text-red-100 dark:hover:bg-red-500/12"
                      disabled={isRuntimeControlPending}
                      title={`Reject ${runtimeControl.toolLabel ?? runtimeControlToolId}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        runtimeControls.onRejectTool?.(runtimeControl.runId, runtimeControlToolId);
                      }}
                      onDoubleClick={(event) => event.stopPropagation()}
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Reject</span>
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {runtimeEvent ? (
            <div
              className={cn(
                'mt-2 rounded-md border px-2 py-1.5 text-[11px] leading-4 shadow-sm',
                runtimeEventIsCurrent
                  ? 'border-sky-300 bg-sky-50 text-sky-900 ring-2 ring-sky-100 dark:border-sky-300 dark:bg-sky-500/14 dark:text-sky-100 dark:ring-sky-300/20'
                  : 'border-white/80 bg-white/85 text-neutral-600 dark:border-white/10 dark:bg-white/6 dark:text-slate-300'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-semibold">
                  {runtimeEventTypeLabel(runtimeEvent)}
                </span>
                {runtimeEvent.status ? (
                  <span className="shrink-0 capitalize">{runtimeEvent.status}</span>
                ) : null}
              </div>
              {runtimePayloadSummary(runtimeEvent) ? (
                <div className="truncate">{runtimePayloadSummary(runtimeEvent)}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {showOutputConnector ? (
        <Handle
          type="source"
          position={Position.Right}
          title="Connect from this node"
          className="workflow-node-connector workflow-node-connector-output h-5! w-5! rounded-full! border-2! border-white! opacity-100! shadow-md transition-transform hover:scale-125! dark:border-slate-950!"
          style={{
            right: -11,
            zIndex: 10,
            backgroundColor: connectorColorForNode(node.type, 'output'),
          }}
          onClick={stopHandleClickPropagation}
          onDoubleClick={stopHandleClickPropagation}
        />
      ) : null}
    </div>
  );
}

function WorkflowGraphLegend() {
  return (
    <div className="workflow-graph-legend-scroll min-h-8 min-w-0 overflow-x-auto rounded-md border border-neutral-200 bg-neutral-50/80 px-2.5 py-2 text-[11px] shadow-inner dark:border-white/10 dark:bg-white/4 dark:text-slate-300">
      <div className="flex w-max items-center gap-3 whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border-2 border-white bg-emerald-500 shadow-sm" />
          Out
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border-2 border-white bg-sky-500 shadow-sm" />
          In
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-8 rounded-full bg-neutral-400" />
          Static link
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-8 rounded-full bg-emerald-600" />
          Assignment
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-8 rounded-full bg-blue-600 shadow-[0_0_0_3px_rgb(37_99_235/0.12)]" />
          Requires approval
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-8 rounded-full bg-violet-600" />
          Tool access
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-8 rounded-full bg-cyan-600" />
          Memory access
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-8 rounded-full bg-slate-500" />
          Dependency
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-8 rounded-full bg-sky-500 shadow-[0_0_0_3px_rgb(14_165_233/0.12)]" />
          Live transfer
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-8 border-t border-dashed border-amber-500" />
          Waiting
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-8 border-t border-dashed border-red-500" />
          Failed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-8 rounded-full bg-emerald-500" />
          Completed
        </span>
        <span className="inline-flex items-center gap-1.5 text-neutral-500 dark:text-slate-400">
          Edge pill opens details
        </span>
      </div>
    </div>
  );
}

function WorkflowGraphRunSummaryStrip({ summary }: { summary: WorkflowGraphRunSummary }) {
  type SummaryItem = {
    key: string;
    label: string;
    value: number | string;
    className: string;
  };
  const summaryItems: Array<SummaryItem | null> = [
    {
      key: 'completed',
      label: 'completed',
      value: summary.completedTaskCount,
      className:
        'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-300/30 dark:bg-emerald-500/12 dark:text-emerald-100',
    },
    {
      key: 'failed',
      label: 'failed',
      value: summary.failedTaskCount,
      className:
        'border-red-200 bg-red-50 text-red-800 dark:border-red-300/30 dark:bg-red-500/12 dark:text-red-100',
    },
    {
      key: 'outputs',
      label: summary.outputCount === 1 ? 'output' : 'outputs',
      value: summary.outputCount,
      className:
        'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-300/30 dark:bg-sky-500/12 dark:text-sky-100',
    },
    {
      key: 'artifacts',
      label: summary.artifactCount === 1 ? 'artifact' : 'artifacts',
      value: summary.artifactCount,
      className:
        'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-300/30 dark:bg-violet-500/12 dark:text-violet-100',
    },
    summary.tokenLabel
      ? {
          key: 'tokens',
          label: 'tok',
          value: summary.tokenLabel,
          className:
            'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-300/30 dark:bg-blue-500/12 dark:text-blue-100',
        }
      : null,
    summary.durationLabel
      ? {
          key: 'duration',
          label: '',
          value: summary.durationLabel,
          className:
            'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-white/10 dark:bg-white/6 dark:text-slate-200',
        }
      : null,
    {
      key: 'next',
      label: '',
      value:
        summary.followUpActions.length > 0
          ? `Next ${summary.followUpActions.join(', ')}`
          : 'Next No follow-up',
      className:
        'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-300/30 dark:bg-amber-500/12 dark:text-amber-100',
    },
  ];
  const items = summaryItems.filter((item): item is SummaryItem => item !== null);

  return (
    <div
      aria-label="Run summary"
      className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px]"
    >
      <span className="shrink-0 font-semibold uppercase tracking-[0.12em] text-neutral-500 dark:text-slate-400">
        Run summary
      </span>
      {items.map((item) => (
        <span
          key={item.key}
          className={cn(
            'inline-flex h-7 items-center rounded-full border px-2 font-medium',
            item.className
          )}
        >
          {item.value}
          {item.label ? ` ${item.label}` : null}
        </span>
      ))}
    </div>
  );
}

function WorkflowGraphRuntimeEvent({
  event,
  document,
  isCurrent = false,
  onClick,
}: GraphRuntimeEventRendererProps & { document: GraphDocument }) {
  const payloadSummary = runtimePayloadSummary(event);
  const payloadDirection = runtimePayloadDirection(event);
  const targetLabel = graphRuntimeTargetLabel(event, document);
  const sequence = runtimeEventSequence(event);
  const runId = runtimeRunId(event);
  const runDateTime = runtimeRunDateTime(event);
  const runHref =
    runId && event.type.startsWith('run.') && !runtimeEventIsProjection(event)
      ? `/runs/${encodeURIComponent(runId)}?workflowId=${encodeURIComponent(event.graphId ?? '')}&tab=runs`
      : null;

  return (
    <div
      className={cn(
        'rounded-md border bg-white px-2 py-1.5 text-xs shadow-sm dark:bg-slate-950/80 dark:shadow-none',
        isCurrent
          ? 'border-sky-200 bg-sky-50/80 ring-1 ring-sky-100 dark:border-sky-300 dark:bg-sky-500/14 dark:ring-sky-300/20'
          : 'border-neutral-200 dark:border-white/10'
      )}
    >
      <button
        type="button"
        aria-current={isCurrent ? 'step' : undefined}
        className="block w-full text-left hover:text-sky-700"
        onClick={() => onClick?.(event)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className={cn('h-2 w-2 shrink-0 rounded-full', payloadDirection.dotClassName)}
                aria-hidden="true"
              />
              <span className="truncate font-medium text-neutral-900 dark:text-slate-100">
                {runtimeEventTypeLabel(event)}
              </span>
            </div>
            <div className="mt-0.5 truncate text-[11px] text-neutral-500 dark:text-slate-400">
              {targetLabel}
            </div>
          </div>
          {event.status ? (
            <span
              className={cn(
                'shrink-0 rounded-full border px-2 py-0.5 text-[11px] capitalize',
                runtimeEventStatusClassName(event.status)
              )}
            >
              {event.status}
            </span>
          ) : null}
        </div>
        <div
          className={cn(
            'mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium',
            payloadDirection.className
          )}
        >
          {payloadDirection.label}
        </div>
        {sequence !== null || runId ? (
          <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-neutral-500 dark:text-slate-400">
            {sequence !== null ? <span>#{sequence}</span> : null}
            {runId ? <span>Run {runDateTime ?? shortRuntimeRunId(runId)}</span> : null}
          </div>
        ) : null}
        {payloadSummary ? (
          <div className="mt-1 truncate text-[11px] text-neutral-500 dark:text-slate-400">
            {payloadSummary}
          </div>
        ) : null}
      </button>
      {runHref ? (
        <a
          href={runHref}
          className="mt-1 inline-flex text-[11px] font-medium text-sky-700 hover:text-sky-900"
          onClick={(event) => event.stopPropagation()}
        >
          Open run
        </a>
      ) : null}
    </div>
  );
}

function workflowEdgeLabel(edge: GraphEdge) {
  const edgeType = typeof edge.data?.edgeType === 'string' ? edge.data.edgeType : null;
  const condition = typeof edge.label === 'string' ? edge.label.trim() : '';

  if (edge.type === workflowGraphEdgeTypes.assignment) {
    return 'Assignment';
  }

  if (edge.type === workflowGraphEdgeTypes.condition || edgeType === 'conditional') {
    return condition ? 'Conditional' : 'No condition';
  }

  if (edgeType === 'success') {
    return 'Success';
  }

  if (edgeType === 'failure') {
    return 'Failure';
  }

  if (edge.type === workflowGraphEdgeTypes.dataFlow) {
    return 'Data flow';
  }

  if (edge.type === workflowGraphEdgeTypes.tool) {
    return 'Tool access';
  }

  if (edge.type === workflowGraphEdgeTypes.memory) {
    return 'Memory access';
  }

  if (edge.type === workflowGraphEdgeTypes.approval) {
    return condition || 'Requires approval';
  }

  if (edge.type === workflowGraphEdgeTypes.handoff) {
    return 'Handoff';
  }

  return 'Dependency';
}

function workflowEdgeLabelClassName(edge: GraphEdge) {
  const edgeType = typeof edge.data?.edgeType === 'string' ? edge.data.edgeType : null;

  if (edge.type === workflowGraphEdgeTypes.assignment) {
    return 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:border-emerald-500';
  }

  if (edge.type === workflowGraphEdgeTypes.condition || edgeType === 'conditional') {
    return 'border-violet-300 bg-violet-50 text-violet-800 hover:border-violet-500';
  }

  if (edgeType === 'success') {
    return 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:border-emerald-500';
  }

  if (edgeType === 'failure') {
    return 'border-red-300 bg-red-50 text-red-800 hover:border-red-500';
  }

  if (edge.type === workflowGraphEdgeTypes.dataFlow) {
    return 'border-sky-300 bg-sky-50 text-sky-800 hover:border-sky-500';
  }

  if (edge.type === workflowGraphEdgeTypes.memory) {
    return 'border-cyan-300 bg-cyan-50 text-cyan-800 hover:border-cyan-500';
  }

  if (edge.type === workflowGraphEdgeTypes.approval) {
    return 'border-blue-300 bg-blue-50 text-blue-800 hover:border-blue-500 dark:border-blue-300/40 dark:bg-blue-500/12 dark:text-blue-100 dark:hover:border-blue-200/70';
  }

  return 'border-neutral-200 bg-white text-neutral-600 hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:bg-slate-950/78 dark:text-slate-300 dark:hover:border-sky-300/40 dark:hover:text-sky-200';
}

function compactWorkflowEdgeLabel(edge: GraphEdge) {
  const edgeType = typeof edge.data?.edgeType === 'string' ? edge.data.edgeType : null;

  if (edge.type === workflowGraphEdgeTypes.assignment) {
    return 'Agent';
  }

  if (edge.type === workflowGraphEdgeTypes.dataFlow) {
    return 'Data';
  }

  if (edge.type === workflowGraphEdgeTypes.tool) {
    return 'Tool';
  }

  if (edge.type === workflowGraphEdgeTypes.memory) {
    return 'Memory';
  }

  if (edge.type === workflowGraphEdgeTypes.approval) {
    return 'Approval';
  }

  if (edge.type === workflowGraphEdgeTypes.handoff) {
    return 'Handoff';
  }

  if (!edgeType || edgeType === 'dependency') {
    return 'Dep';
  }

  return null;
}

function workflowEdgeLabelPresentation({
  edge,
  edgeCount,
  density,
  selected,
  validationIssueCount,
}: {
  edge: GraphEdge;
  edgeCount: number;
  density: WorkflowGraphDensity;
  selected: boolean;
  validationIssueCount: number;
}) {
  const label = workflowEdgeLabel(edge);
  const edgeType = typeof edge.data?.edgeType === 'string' ? edge.data.edgeType : null;
  const isBranchingEdge =
    edge.type === workflowGraphEdgeTypes.condition ||
    edgeType === 'conditional' ||
    edgeType === 'success' ||
    edgeType === 'failure';
  const isApprovalEdge = edge.type === workflowGraphEdgeTypes.approval;

  // Dense canvases hide routine labels until the relationship is selected, but keep
  // approval, branching, and invalid edges visible because those states are operational cues.
  if (
    density === 'detailed' ||
    edgeCount < denseWorkflowEdgeLabelThreshold ||
    selected ||
    validationIssueCount > 0 ||
    isBranchingEdge ||
    isApprovalEdge
  ) {
    return { label, fullLabel: label, compact: false };
  }

  return { label: compactWorkflowEdgeLabel(edge), fullLabel: label, compact: true, hidden: true };
}

function WorkflowGraphDensityToggle({
  density,
  onDensityChange,
}: {
  density: WorkflowGraphDensity;
  onDensityChange: (density: WorkflowGraphDensity) => void;
}) {
  const options: Array<{ value: WorkflowGraphDensity; label: string; description: string }> = [
    {
      value: 'clean',
      label: 'Clean',
      description: 'Hide routine edge labels until selected.',
    },
    {
      value: 'detailed',
      label: 'Detailed',
      description: 'Show every connection label.',
    },
  ];

  return (
    <div
      className="inline-flex h-8 shrink-0 rounded-md border border-neutral-200 bg-white p-0.5 shadow-sm dark:border-white/10 dark:bg-slate-950/72 dark:shadow-none"
      aria-label="Graph detail level"
    >
      {options.map((option) => {
        const active = density === option.value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            title={option.description}
            className={cn(
              'inline-flex h-7 items-center rounded px-2 text-xs font-semibold transition-colors',
              active
                ? 'bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-100'
                : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-100'
            )}
            onClick={() => onDensityChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function WorkflowGraphJumpControl({
  nodes,
  selectedNodeId,
  onSelectedNodeChange,
  onJump,
}: {
  nodes: GraphNode[];
  selectedNodeId: string;
  onSelectedNodeChange: (nodeId: string) => void;
  onJump: (nodeId: string) => void;
}) {
  const disabled = nodes.length === 0;

  return (
    <div className="flex h-8 min-w-0 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 shadow-sm dark:border-white/10 dark:bg-slate-950/72 dark:shadow-none">
      <span className="hidden shrink-0 text-xs font-semibold text-neutral-500 dark:text-slate-400 sm:inline">
        Jump
      </span>
      <select
        aria-label="Jump to workflow graph node"
        value={selectedNodeId}
        disabled={disabled}
        className="h-6 min-w-0 max-w-48 rounded border-0 bg-transparent px-1 text-xs font-medium text-neutral-800 outline-none disabled:text-neutral-400 dark:text-slate-100 dark:disabled:text-slate-500"
        onChange={(event) => {
          const nodeId = event.target.value;
          onSelectedNodeChange(nodeId);

          if (nodeId) {
            onJump(nodeId);
          }
        }}
      >
        <option value="">Find node</option>
        {nodes.map((node) => (
          <option key={node.id} value={node.id}>
            {workflowGraphNodeTypeLabel(node)}: {node.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!selectedNodeId}
        className="inline-flex h-6 items-center rounded bg-neutral-900 px-2 text-[11px] font-semibold text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white dark:disabled:bg-white/10 dark:disabled:text-slate-500"
        onClick={() => onJump(selectedNodeId)}
      >
        Go
      </button>
    </div>
  );
}

function WorkflowGraphRuntimeControlsBar({
  controls,
}: {
  controls?: WorkflowGraphRuntimeControls;
}) {
  const runId = controls?.runId ?? null;
  const status = controls?.status ?? null;
  const approvalToolId = controls?.approvalToolId ?? null;
  const approvalLabel = controls?.approvalLabel ?? approvalToolId;
  const checkpointResumeTaskId = controls?.checkpointResumeTaskId ?? null;
  const isPending = Boolean(controls?.isPending);
  const canResume =
    Boolean(runId && controls?.onResumeRun) &&
    (status === 'paused' || status === 'waiting_for_approval');
  const canResumeFromCheckpoint = Boolean(
    runId && checkpointResumeTaskId && controls?.onResumeFromCheckpoint
  );
  const canApproveTool = Boolean(
    status === 'waiting_for_approval' && runId && approvalToolId && controls?.onApproveTool
  );
  const canRejectTool = Boolean(
    status === 'waiting_for_approval' && runId && approvalToolId && controls?.onRejectTool
  );

  if (!canResume && !canResumeFromCheckpoint && !canApproveTool && !canRejectTool) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {canResume && runId ? (
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-emerald-800 shadow-sm hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-300/30 dark:bg-emerald-500/12 dark:text-emerald-100"
          disabled={isPending}
          title={`Resume run ${shortRuntimeRunId(runId)}`}
          onClick={() => controls?.onResumeRun?.(runId)}
        >
          <Play className="h-4 w-4" />
          <span>Resume run</span>
        </button>
      ) : null}
      {canResumeFromCheckpoint && runId ? (
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-cyan-200 bg-cyan-50 px-2 text-cyan-800 shadow-sm hover:border-cyan-300 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-cyan-300/30 dark:bg-cyan-500/12 dark:text-cyan-100"
          disabled={isPending}
          title={`Resume run ${shortRuntimeRunId(runId)} from the latest checkpoint`}
          onClick={() => controls?.onResumeFromCheckpoint?.(runId)}
        >
          <Play className="h-4 w-4" />
          <span>Resume checkpoint</span>
        </button>
      ) : null}
      {canApproveTool && runId && approvalToolId ? (
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-2 text-sky-800 shadow-sm hover:border-sky-300 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-300/30 dark:bg-sky-500/12 dark:text-sky-100"
          disabled={isPending}
          title={`Approve ${approvalLabel ?? approvalToolId} for run ${shortRuntimeRunId(runId)}`}
          onClick={() => controls?.onApproveTool?.(runId, approvalToolId)}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Approve tool</span>
        </button>
      ) : null}
      {canRejectTool && runId && approvalToolId ? (
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 text-red-800 shadow-sm hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-300/30 dark:bg-red-500/12 dark:text-red-100"
          disabled={isPending}
          title={`Reject ${approvalLabel ?? approvalToolId} for run ${shortRuntimeRunId(runId)}`}
          onClick={() => controls?.onRejectTool?.(runId, approvalToolId)}
        >
          <X className="h-4 w-4" />
          <span>Reject tool</span>
        </button>
      ) : null}
    </div>
  );
}

function WorkflowRelationshipSummaryStrip({
  summary,
}: {
  summary: WorkflowRelationshipSummary | null;
}) {
  if (!summary) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50/80 px-2.5 py-2 text-[11px] text-sky-900 shadow-inner dark:border-sky-300/20 dark:bg-sky-500/10 dark:text-sky-100">
      <span className="max-w-56 truncate font-semibold">Selected: {summary.label}</span>
      {summary.items.length > 0 ? (
        summary.items.map((item) => (
          <span
            key={item}
            className="rounded-full border border-sky-200 bg-white/80 px-2 py-0.5 font-medium text-sky-800 dark:border-sky-300/20 dark:bg-slate-950/60 dark:text-sky-100"
          >
            {item}
          </span>
        ))
      ) : (
        <span className="text-sky-700/80 dark:text-sky-100/70">No connected relationships</span>
      )}
    </div>
  );
}

export default function WorkflowGraphCanvas({
  workflow,
  document,
  className,
  readOnly = false,
  showInspector = false,
  includeAgents = true,
  includeTools = false,
  includeMemories = false,
  onWorkflowChange,
  onGraphChange,
  runtimeEvents,
  hideRuntimeRunFilter = false,
  agentObservabilityMetrics,
  personaVersionNotices = [],
  workflowValidationIssues = [],
  memoryLinkCountsByTarget,
  onValidationIssues,
  onSelectTask,
  onSelectApproval,
  onSelectAgent,
  onSelectTool,
  onSelectMemory,
  onSelectArtifact,
  onSelectEdge,
  onStartEditing,
  onSaveWorkflow,
  onRunWorkflow,
  saveWorkflowDisabled = false,
  runWorkflowDisabled = false,
  toolDefinitions,
  workflowCapabilityTags,
  modelProfiles,
  runtimeControls,
}: WorkflowGraphCanvasProps) {
  const [isGraphExpanded, setIsGraphExpanded] = useState(false);
  const [graphDensityState, setGraphDensityState] = useState<{
    workflowId: string;
    density: WorkflowGraphDensity;
  }>(() => ({
    workflowId: workflow.id,
    density: readStoredWorkflowGraphDensity(workflow.id),
  }));
  const [graphJumpNodeId, setGraphJumpNodeId] = useState('');
  const [graphFocusNodeId, setGraphFocusNodeId] = useState<string | null>(null);
  const [graphFocusNodeRevision, setGraphFocusNodeRevision] = useState(0);
  const [isExecutionTimelineVisible, setIsExecutionTimelineVisible] = useState(false);
  const [selectedRuntimeRunId, setSelectedRuntimeRunId] = useState(allRuntimeRunsValue);
  const [hasUserSelectedRuntimeRun, setHasUserSelectedRuntimeRun] = useState(false);
  const [selectedRuntimeDirection, setSelectedRuntimeDirection] =
    useState(allRuntimeDirectionsValue);
  const [hideProjectedRuntimeEvents, setHideProjectedRuntimeEvents] = useState(false);
  const [graphSelection, setGraphSelection] = useState<GraphSelection>({
    nodeIds: [],
    edgeIds: [],
  });
  const graphDensityStorageKey = useMemo(
    () => workflowGraphDensityStorageKey(workflow.id),
    [workflow.id]
  );
  const graphDensity =
    graphDensityState.workflowId === workflow.id
      ? graphDensityState.density
      : readStoredWorkflowGraphDensity(workflow.id);
  const handleGraphDensityChange = useCallback(
    (density: WorkflowGraphDensity) => {
      setGraphDensityState({ workflowId: workflow.id, density });
    },
    [workflow.id]
  );
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(graphDensityStorageKey, graphDensity);
  }, [graphDensity, graphDensityStorageKey]);
  const effectiveWorkflowCapabilityTags = useMemo(
    () => workflowCapabilityTags ?? readWorkflowCapabilityTags(workflow.metadata),
    [workflow.metadata, workflowCapabilityTags]
  );
  const generatedDocumentSignature = JSON.stringify({
    effectiveWorkflowCapabilityTags,
    includeAgents,
    includeMemories,
    includeTools,
    modelProfiles,
    toolDefinitions,
    workflow,
  });
  const generatedDocument = useMemo(
    () =>
      workflowDefinitionToGraphDocument(workflow, {
        includeAgents,
        includeTools,
        includeMemories,
        toolDefinitions,
        modelProfiles,
      }),
    // The workflow graph inputs are JSON-like; use a content signature so parent re-renders
    // with equivalent arrays do not force React Flow to rebuild its node store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [generatedDocumentSignature]
  );
  const activeDocument = document ?? generatedDocument;
  const relationshipHighlights = useMemo(
    () => workflowRelationshipHighlights(activeDocument, graphSelection),
    [activeDocument, graphSelection]
  );
  const relationshipSummary = useMemo(
    () => workflowSelectedRelationshipSummary(activeDocument, graphSelection),
    [activeDocument, graphSelection]
  );
  const observabilityMetricsByAgentId = useMemo(
    () => new Map((agentObservabilityMetrics ?? []).map((metrics) => [metrics.agent_id, metrics])),
    [agentObservabilityMetrics]
  );
  const personaNoticeByAgentId = useMemo(
    () => new Map(personaVersionNotices.map((notice) => [notice.agentId, notice])),
    [personaVersionNotices]
  );
  const runtimeEventsSignature = JSON.stringify(runtimeEvents ?? []);
  const stableRuntimeEvents = useMemo(
    () => runtimeEvents ?? [],
    // Runtime events are JSON-like. Preserve the previous array identity when callers
    // rebuild equivalent event objects during query refreshes or parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runtimeEventsSignature]
  );
  const displayRuntimeEvents = isExecutionTimelineVisible ? stableRuntimeEvents : undefined;
  const displayDocument = useMemo(() => {
    return {
      ...activeDocument,
      nodes: activeDocument.nodes.map((node) => {
        const nextData = { ...(node.data ?? {}) };

        if (memoryLinkCountsByTarget && node.type === workflowGraphNodeTypes.memory) {
          const memoryId = readDataString(node, 'memoryId');
          const linkedTargetKeys = new Set<string>([workflowMemoryLinkTargetKey('workflow')]);
          activeDocument.edges.forEach((edge) => {
            if (
              edge.type !== workflowGraphEdgeTypes.memory ||
              readEdgeDataString(edge, 'memoryId') !== memoryId
            ) {
              return;
            }
            const agentId = readEdgeDataString(edge, 'agentId');
            const taskId = readEdgeDataString(edge, 'taskId');
            if (agentId) {
              linkedTargetKeys.add(workflowMemoryLinkTargetKey('agent', agentId));
            }
            if (taskId) {
              linkedTargetKeys.add(workflowMemoryLinkTargetKey('task', taskId));
            }
          });
          nextData.backendMemoryLinkCount = Array.from(linkedTargetKeys).reduce(
            (total, key) => total + (memoryLinkCountsByTarget[key] ?? 0),
            0
          );
        }

        const monitoringPolicy = nodeMonitoringPolicy(node, workflow);
        if (monitoringPolicy) {
          nextData.monitoringPolicyLabel = monitoringPolicy.label;
          nextData.monitoringPolicyState = monitoringPolicy.state;
        }

        if (node.type === workflowGraphNodeTypes.artifact) {
          const producerTaskId = readDataString(node, 'producerTaskId');
          const producerTask = producerTaskId
            ? workflow.task_definitions?.find((task) => task.id === producerTaskId)
            : null;
          if (producerTask) {
            nextData.producerTaskName = producerTask.name || producerTask.id;
          }
        }

        const pendingSupervisorRequestCount = pendingSupervisorRequestCountForNode(
          node,
          displayRuntimeEvents ?? []
        );
        if (pendingSupervisorRequestCount > 0) {
          nextData.pendingSupervisorRequestCount = pendingSupervisorRequestCount;
        }
        const appliedSupervisorSteeringCount = appliedSupervisorSteeringCountForNode(
          node,
          displayRuntimeEvents ?? []
        );
        if (appliedSupervisorSteeringCount > 0) {
          nextData.appliedSupervisorSteeringCount = appliedSupervisorSteeringCount;
        }

        const agentId = readDataString(node, 'agentId');
        const agentMetrics = agentId ? observabilityMetricsByAgentId.get(agentId) : undefined;
        const personaNotice = agentId ? personaNoticeByAgentId.get(agentId) : undefined;
        if (personaNotice) {
          nextData.personaSlug = personaNotice.personaSlug;
          nextData.personaVersionStatus = personaNotice.status;
          nextData.personaVersionId = personaNotice.workflowPersonaVersionId;
          nextData.currentPersonaVersionId = personaNotice.currentPersonaVersionId;
        }
        const eventGovernance = nodeGovernanceFromEvents(node, displayRuntimeEvents ?? []);
        const governanceTokens =
          eventGovernance.tokens ??
          (node.type === workflowGraphNodeTypes.agent ? agentMetrics?.total_tokens : null);
        const governanceContextStatus =
          eventGovernance.contextStatus ??
          (node.type === workflowGraphNodeTypes.agent
            ? latestAgentContextStatus(agentMetrics)
            : null);
        const governanceTokenLabel = compactTokenCount(governanceTokens);

        if (governanceTokenLabel) {
          nextData.governanceTokenLabel = governanceTokenLabel;
        }
        if (governanceContextStatus) {
          nextData.governanceContextStatus = governanceContextStatus;
        }

        const runtimeEvidence = nodeRuntimeEvidenceFromEvents(node, displayRuntimeEvents ?? []);
        if (runtimeEvidence.failureCount > 0) {
          nextData.runtimeFailureCount = runtimeEvidence.failureCount;
        }
        if (runtimeEvidence.failureClusterCount > 1) {
          nextData.runtimeFailureClusterCount = runtimeEvidence.failureClusterCount;
        }
        if (runtimeEvidence.repeatedFailureLabel) {
          nextData.runtimeRepeatedFailureLabel = runtimeEvidence.repeatedFailureLabel;
        }
        if (runtimeEvidence.stepCount > 0) {
          nextData.runtimeStepCount = runtimeEvidence.stepCount;
        }
        if (runtimeEvidence.toolCallCount > 0) {
          nextData.runtimeToolCallCount = runtimeEvidence.toolCallCount;
        }
        if (runtimeEvidence.blockedToolCount > 0) {
          nextData.runtimeBlockedToolCount = runtimeEvidence.blockedToolCount;
        }
        if (runtimeEvidence.missingCredentialCount > 0) {
          nextData.runtimeMissingCredentialCount = runtimeEvidence.missingCredentialCount;
        }
        if (runtimeEvidence.memoryContextCount > 0) {
          nextData.runtimeMemoryContextCount = runtimeEvidence.memoryContextCount;
        }
        if (runtimeEvidence.staleMemoryCount > 0) {
          nextData.runtimeStaleMemoryCount = runtimeEvidence.staleMemoryCount;
        }
        if (runtimeEvidence.missingMemoryCount > 0) {
          nextData.runtimeMissingMemoryCount = runtimeEvidence.missingMemoryCount;
        }
        if (runtimeEvidence.memoryAuthCount > 0) {
          nextData.runtimeMemoryAuthCount = runtimeEvidence.memoryAuthCount;
        }
        if (runtimeEvidence.memoryPermissionCount > 0) {
          nextData.runtimeMemoryPermissionCount = runtimeEvidence.memoryPermissionCount;
        }
        if (runtimeEvidence.averageDurationLabel) {
          nextData.runtimeAverageDurationLabel = runtimeEvidence.averageDurationLabel;
        }
        if (runtimeEvidence.latestFailureSummary) {
          nextData.runtimeLatestFailureSummary = runtimeEvidence.latestFailureSummary;
        }
        if (runtimeEvidence.latestStepSummary) {
          nextData.runtimeLatestStepSummary = runtimeEvidence.latestStepSummary;
        }
        if (runtimeEvidence.latestBlockedToolSummary) {
          nextData.runtimeLatestBlockedToolSummary = runtimeEvidence.latestBlockedToolSummary;
        }
        if (runtimeEvidence.latestMissingCredentialSummary) {
          nextData.runtimeLatestMissingCredentialSummary =
            runtimeEvidence.latestMissingCredentialSummary;
        }
        if (runtimeEvidence.latestMemoryContextSummary) {
          nextData.runtimeLatestMemoryContextSummary = runtimeEvidence.latestMemoryContextSummary;
        }
        if (runtimeEvidence.latestStaleMemorySummary) {
          nextData.runtimeLatestStaleMemorySummary = runtimeEvidence.latestStaleMemorySummary;
        }
        if (runtimeEvidence.latestMissingMemorySummary) {
          nextData.runtimeLatestMissingMemorySummary = runtimeEvidence.latestMissingMemorySummary;
        }
        if (runtimeEvidence.latestMemoryAuthSummary) {
          nextData.runtimeLatestMemoryAuthSummary = runtimeEvidence.latestMemoryAuthSummary;
        }
        if (runtimeEvidence.latestMemoryPermissionSummary) {
          nextData.runtimeLatestMemoryPermissionSummary =
            runtimeEvidence.latestMemoryPermissionSummary;
        }

        const runtimeControl = workflowGraphRuntimeControlForNode(
          node,
          runtimeControls,
          stableRuntimeEvents
        );
        const nodeCanRequestSteering =
          runtimeControls?.canRequestSteering &&
          ((node.type === workflowGraphNodeTypes.task && readDataString(node, 'taskId')) ||
            (node.type === workflowGraphNodeTypes.agent && readDataString(node, 'agentId')));
        if (nodeCanRequestSteering) {
          nextData.supervisorSteeringActionLabel = 'Steer';
        }
        if (runtimeControl) {
          nextData.runtimeNodeControlKind = runtimeControl.kind;
          nextData.runtimeNodeControlRunId = runtimeControl.runId;
          nextData.runtimeNodeControlLabel = runtimeControl.label;
          if (runtimeControl.taskId) {
            nextData.runtimeNodeControlTaskId = runtimeControl.taskId;
          }
          if (runtimeControl.toolId) {
            nextData.runtimeNodeControlToolId = runtimeControl.toolId;
          }
          if (runtimeControl.toolLabel) {
            nextData.runtimeNodeControlToolLabel = runtimeControl.toolLabel;
          }
        }

        return {
          ...node,
          data: nextData,
        };
      }),
      edges: activeDocument.edges.map((edge) => {
        if (!relationshipHighlights.edgeIds.has(edge.id)) {
          return edge;
        }

        return {
          ...edge,
          style: {
            ...(edge.style ?? {}),
            className: cn(edge.style?.className, 'graph-workflow-edge-related'),
          },
        };
      }),
    };
  }, [
    activeDocument,
    relationshipHighlights.edgeIds,
    displayRuntimeEvents,
    memoryLinkCountsByTarget,
    observabilityMetricsByAgentId,
    personaNoticeByAgentId,
    runtimeControls,
    stableRuntimeEvents,
    workflow,
  ]);
  const graphJumpNodes = useMemo(() => {
    const typeOrder = new Map<string, number>([
      [workflowGraphNodeTypes.task, 0],
      [workflowGraphNodeTypes.approval, 1],
      [workflowGraphNodeTypes.agent, 2],
      [workflowGraphNodeTypes.tool, 3],
      [workflowGraphNodeTypes.memory, 4],
      [workflowGraphNodeTypes.artifact, 5],
    ]);

    return [...displayDocument.nodes].sort((left, right) => {
      const leftTypeOrder = typeOrder.get(left.type) ?? 99;
      const rightTypeOrder = typeOrder.get(right.type) ?? 99;

      if (leftTypeOrder !== rightTypeOrder) {
        return leftTypeOrder - rightTypeOrder;
      }

      return left.label.localeCompare(right.label);
    });
  }, [displayDocument.nodes]);
  const selectedGraphJumpNodeId = graphJumpNodes.some((node) => node.id === graphJumpNodeId)
    ? graphJumpNodeId
    : '';
  const handleGraphNodeJump = useCallback((nodeId: string) => {
    if (!nodeId) {
      return;
    }

    setGraphFocusNodeId(nodeId);
    setGraphFocusNodeRevision((revision) => revision + 1);
  }, []);
  const runtimeRunOptions = useMemo(() => {
    const latestEventTimeByRunId = new Map<string, number>();
    stableRuntimeEvents.forEach((event) => {
      const runId = runtimeRunId(event);
      if (!runId) {
        return;
      }

      latestEventTimeByRunId.set(
        runId,
        Math.max(latestEventTimeByRunId.get(runId) ?? 0, runtimeEventSortTime(event))
      );
    });

    return Array.from(latestEventTimeByRunId.entries())
      .sort((left, right) => right[1] - left[1])
      .map(([runId]) => runId);
  }, [stableRuntimeEvents]);
  const latestRuntimeRunId = runtimeRunOptions[0] ?? null;
  const runtimeRunOptionLabels = useMemo(() => {
    const labels = new Map<string, string>();
    stableRuntimeEvents.forEach((event) => {
      const runId = runtimeRunId(event);
      if (!runId || labels.has(runId)) {
        return;
      }

      labels.set(runId, runtimeRunDateTime(event) ?? `Run ${shortRuntimeRunId(runId)}`);
    });
    return labels;
  }, [stableRuntimeEvents]);
  const runtimeDirectionOptions = useMemo(() => {
    const directionSet = new Set(
      stableRuntimeEvents.map((event) => runtimePayloadDirection(event).label)
    );
    const orderedDirections = runtimeDirectionOrder.filter((direction) =>
      directionSet.has(direction)
    );
    const customDirections = Array.from(directionSet).filter(
      (direction) => !runtimeDirectionOrder.includes(direction)
    );

    return [...orderedDirections, ...customDirections];
  }, [stableRuntimeEvents]);
  const selectedRuntimeRunStillExists =
    selectedRuntimeRunId === allRuntimeRunsValue ||
    runtimeRunOptions.includes(selectedRuntimeRunId);
  const selectedRuntimeDirectionStillExists =
    selectedRuntimeDirection === allRuntimeDirectionsValue ||
    runtimeDirectionOptions.includes(selectedRuntimeDirection);
  const effectiveSelectedRuntimeRunId = selectedRuntimeRunStillExists
    ? selectedRuntimeRunId
    : (latestRuntimeRunId ?? allRuntimeRunsValue);
  const effectiveSelectedRuntimeDirection = selectedRuntimeDirectionStillExists
    ? selectedRuntimeDirection
    : allRuntimeDirectionsValue;
  const runtimeSummaryRunId =
    effectiveSelectedRuntimeRunId !== allRuntimeRunsValue
      ? effectiveSelectedRuntimeRunId
      : latestRuntimeRunId;
  const runtimeSummaryEvents = useMemo(() => {
    if (!runtimeSummaryRunId) {
      return stableRuntimeEvents;
    }

    const events = stableRuntimeEvents.filter(
      (event) => runtimeRunId(event) === runtimeSummaryRunId
    );
    return events.length > 0 ? events : stableRuntimeEvents;
  }, [runtimeSummaryRunId, stableRuntimeEvents]);
  const runtimeSummary = useMemo(
    () => workflowGraphRunSummary(runtimeSummaryEvents),
    [runtimeSummaryEvents]
  );
  const visibleRuntimeEvents = useMemo(() => {
    let events = stableRuntimeEvents;

    if (effectiveSelectedRuntimeRunId !== allRuntimeRunsValue) {
      events = events.filter((event) => runtimeRunId(event) === effectiveSelectedRuntimeRunId);
    }

    if (effectiveSelectedRuntimeDirection !== allRuntimeDirectionsValue) {
      events = events.filter(
        (event) => runtimePayloadDirection(event).label === effectiveSelectedRuntimeDirection
      );
    }

    if (hideProjectedRuntimeEvents) {
      events = events.filter((event) => !runtimeEventIsProjection(event));
    }

    return events;
  }, [
    hideProjectedRuntimeEvents,
    effectiveSelectedRuntimeDirection,
    effectiveSelectedRuntimeRunId,
    stableRuntimeEvents,
  ]);
  const toggleGraphExpanded = () => setIsGraphExpanded((current) => !current);
  const runtimeEventCount = stableRuntimeEvents.length;
  const hasRuntimeTimeline = runtimeEventCount > 0;
  const graphRuntimeEvents = isExecutionTimelineVisible ? visibleRuntimeEvents : undefined;
  const handleTimelineVisibilityToggle = () => {
    if (
      !isExecutionTimelineVisible &&
      effectiveSelectedRuntimeRunId === allRuntimeRunsValue &&
      latestRuntimeRunId &&
      !hideRuntimeRunFilter &&
      !hasUserSelectedRuntimeRun
    ) {
      setSelectedRuntimeRunId(latestRuntimeRunId);
    }
    setIsExecutionTimelineVisible((current) => !current);
  };
  const visibleValidationIssues = useMemo(
    () => [
      ...validateWorkflowGraphDocument(displayDocument),
      ...validateWorkflowGraphConversionSafety(displayDocument),
      ...validateWorkflowResourceReferences(workflow, displayDocument, { toolDefinitions }),
      ...validateWorkflowRuntimeWarnings(workflow, runtimeEvents),
      ...workflowDraftIssuesToGraphValidationIssues(
        displayDocument,
        workflow,
        workflowValidationIssues
      ),
    ],
    [displayDocument, runtimeEvents, toolDefinitions, workflow, workflowValidationIssues]
  );
  const toolbarActions = useMemo(() => {
    const actions: GraphToolbarAction[] = [];

    if (readOnly && onStartEditing) {
      actions.push({
        id: workflowGraphActionIds.edit,
        label: 'Edit Graph',
        description: 'Enter workflow edit mode to add tasks, agents, and graph connections.',
      });
    }

    if (readOnly) {
      actions.push({
        id: workflowGraphActionIds.validate,
        label: 'Validate Workflow',
        description: 'Validate the workflow graph.',
      });
    } else {
      actions.push(
        ...workflowGraphToolbarActionsForCapabilities(effectiveWorkflowCapabilityTags).filter(
          (action) => {
            if (action.id === workflowGraphActionIds.addTool) {
              return includeTools;
            }

            if (action.id === workflowGraphActionIds.addMemory) {
              return includeMemories;
            }

            return true;
          }
        )
      );
    }

    if (onSaveWorkflow && !readOnly) {
      actions.push({
        id: workflowGraphActionIds.save,
        label: 'Save Workflow',
        description: 'Save workflow changes using the existing workflow save flow.',
        disabled: saveWorkflowDisabled,
      });
    }

    if (onRunWorkflow) {
      actions.push({
        id: workflowGraphActionIds.run,
        label: 'Run Workflow',
        description: 'Run the workflow using the existing workflow run flow.',
        disabled: runWorkflowDisabled,
      });
    }

    return actions;
  }, [
    onRunWorkflow,
    onSaveWorkflow,
    onStartEditing,
    includeMemories,
    includeTools,
    readOnly,
    runWorkflowDisabled,
    saveWorkflowDisabled,
    effectiveWorkflowCapabilityTags,
  ]);
  const builtInToolbarActions = useMemo<GraphBuiltInToolbarActionId[]>(
    () => (readOnly ? [graphBuiltInToolbarActionIds.fitView] : workflowGraphBuiltInToolbarActions),
    [readOnly]
  );
  const renderWorkflowNode = useCallback(
    (props: GraphNodeRendererProps) => (
      <WorkflowGraphNodeCard
        {...props}
        relationshipHighlighted={relationshipHighlights.nodeIds.has(props.node.id)}
        runtimeControl={workflowGraphRuntimeControlForNode(
          props.node,
          runtimeControls,
          stableRuntimeEvents
        )}
        runtimeControls={runtimeControls}
      />
    ),
    [relationshipHighlights.nodeIds, runtimeControls, stableRuntimeEvents]
  );
  const nodeRenderers = useMemo(
    () => ({
      [workflowGraphNodeTypes.agent]: renderWorkflowNode,
      [workflowGraphNodeTypes.task]: renderWorkflowNode,
      [workflowGraphNodeTypes.tool]: renderWorkflowNode,
      [workflowGraphNodeTypes.memory]: renderWorkflowNode,
      [workflowGraphNodeTypes.artifact]: renderWorkflowNode,
      [workflowGraphNodeTypes.approval]: renderWorkflowNode,
      [workflowGraphNodeTypes.router]: renderWorkflowNode,
    }),
    [renderWorkflowNode]
  );

  const handleGraphChange = useCallback(
    (nextDocument: GraphDocument) => {
      const normalizedDocument = normalizeWorkflowGraphEdgeTypes(nextDocument);
      const conversionIssues = validateWorkflowGraphConversionSafety(normalizedDocument);
      onGraphChange?.(normalizedDocument);
      if (conversionIssues.some((issue) => issue.severity === 'error')) {
        onValidationIssues?.(conversionIssues);
        return;
      }

      onWorkflowChange?.(graphDocumentToWorkflowDefinition(normalizedDocument, workflow));
    },
    [onGraphChange, onValidationIssues, onWorkflowChange, workflow]
  );

  const selectCreatedTaskOrArtifactNode = useCallback(
    (previousDocument: GraphDocument, nextDocument: GraphDocument) => {
      const previousNodeIds = new Set(previousDocument.nodes.map((node) => node.id));
      const createdNode = nextDocument.nodes.find((node) => !previousNodeIds.has(node.id));

      if (!createdNode) {
        return;
      }

      if (createdNode.type === workflowGraphNodeTypes.task) {
        const taskId = readDataString(createdNode, 'taskId');
        if (taskId) {
          onSelectTask?.(taskId);
        }
        return;
      }

      if (createdNode.type === workflowGraphNodeTypes.artifact) {
        const artifactId = readDataString(createdNode, 'artifactId');
        if (artifactId) {
          onSelectArtifact?.(artifactId);
        }
      }
    },
    [onSelectArtifact, onSelectTask]
  );

  const handleToolbarAction = useCallback(
    (action: GraphToolbarAction, nextDocument: GraphDocument) => {
      if (action.id === workflowGraphActionIds.edit) {
        onStartEditing?.();
      }

      if (action.id === workflowGraphActionIds.addTask && !readOnly) {
        const updatedDocument = addWorkflowTaskNodeToGraphDocument(
          nextDocument,
          effectiveWorkflowCapabilityTags
        );
        selectCreatedTaskOrArtifactNode(nextDocument, updatedDocument);
        return updatedDocument;
      }

      if (action.id.startsWith(`${workflowGraphActionIds.addTaskTemplate}.`) && !readOnly) {
        const templateId =
          typeof action.metadata?.templateId === 'string' ? action.metadata.templateId : null;
        if (templateId && agenticTaskTemplate(templateId as AgenticTaskTemplateId)) {
          const updatedDocument = addWorkflowTaskTemplateNodeToGraphDocument(
            nextDocument,
            templateId as AgenticTaskTemplateId
          );
          selectCreatedTaskOrArtifactNode(nextDocument, updatedDocument);
          return updatedDocument;
        }
      }

      if (action.id === workflowGraphActionIds.addAgent && !readOnly) {
        return addWorkflowAgentNodeToGraphDocument(nextDocument);
      }

      if (action.id === workflowGraphActionIds.addTool && !readOnly) {
        return addWorkflowToolNodeToGraphDocument(nextDocument);
      }

      if (action.id === workflowGraphActionIds.addMemory && !readOnly) {
        return addWorkflowMemoryNodeToGraphDocument(nextDocument);
      }

      if (action.id === workflowGraphActionIds.addArtifact && !readOnly) {
        const updatedDocument = addWorkflowArtifactNodeToGraphDocument(nextDocument);
        selectCreatedTaskOrArtifactNode(nextDocument, updatedDocument);
        return updatedDocument;
      }

      if (action.id === workflowGraphActionIds.validate) {
        onValidationIssues?.([
          ...validateWorkflowGraphDocument(nextDocument),
          ...validateWorkflowGraphConversionSafety(nextDocument),
        ]);
      }

      if (action.id === workflowGraphActionIds.save) {
        onSaveWorkflow?.();
      }

      if (action.id === workflowGraphActionIds.run) {
        onRunWorkflow?.();
      }

      return nextDocument;
    },
    [
      effectiveWorkflowCapabilityTags,
      onRunWorkflow,
      onSaveWorkflow,
      onStartEditing,
      onValidationIssues,
      readOnly,
      selectCreatedTaskOrArtifactNode,
    ]
  );

  const handleConnect = useCallback(
    (edge: GraphEdge, nextDocument: GraphDocument) => {
      const result = applyWorkflowGraphConnection(nextDocument, edge);
      if (result.issues.length > 0) {
        onValidationIssues?.(result.issues);
        return false;
      }

      const previousEdgeIds = new Set(nextDocument.edges.map((candidate) => candidate.id));
      const createdEdge =
        result.document.edges.find((candidate) => !previousEdgeIds.has(candidate.id)) ??
        result.document.edges.find(
          (candidate) => candidate.source === edge.source && candidate.target === edge.target
        );
      if (createdEdge) {
        toast.success(`${workflowEdgeLabel(createdEdge)} created.`, { position: 'top-right' });
      }

      return result.document;
    },
    [onValidationIssues]
  );

  const handleNodeOpen = useCallback(
    (node: GraphNode) => {
      const taskId = readDataString(node, 'taskId');
      const agentId = readDataString(node, 'agentId');
      const toolId = readDataString(node, 'toolId');
      const toolIds = readDataStringArray(node, 'toolIds');
      const memoryId = readDataString(node, 'memoryId');
      const artifactId = readDataString(node, 'artifactId');

      if (node.type === workflowGraphNodeTypes.approval && taskId) {
        onSelectAgent?.(null);
        onSelectEdge?.(null);
        onSelectTool?.(null);
        onSelectMemory?.(null);
        onSelectArtifact?.(null);
        onSelectApproval?.(taskId);
        return;
      }

      if (taskId) {
        onSelectEdge?.(null);
        onSelectTool?.(null);
        onSelectMemory?.(null);
        onSelectArtifact?.(null);
        onSelectTask?.(taskId);
        return;
      }

      if (agentId) {
        onSelectEdge?.(null);
        onSelectTool?.(null);
        onSelectMemory?.(null);
        onSelectArtifact?.(null);
        onSelectAgent?.(agentId);
        return;
      }

      if (node.type === workflowGraphNodeTypes.tool) {
        onSelectAgent?.(null);
        onSelectEdge?.(null);
        onSelectTask?.(null);
        onSelectMemory?.(null);
        onSelectArtifact?.(null);
        onSelectTool?.(toolId ?? workflowGraphToolListSelectionId, toolIds, node.id);
        return;
      }

      if (memoryId) {
        onSelectAgent?.(null);
        onSelectEdge?.(null);
        onSelectTask?.(null);
        onSelectTool?.(null);
        onSelectArtifact?.(null);
        onSelectMemory?.(memoryId);
        return;
      }

      if (artifactId) {
        onSelectAgent?.(null);
        onSelectEdge?.(null);
        onSelectTask?.(null);
        onSelectTool?.(null);
        onSelectMemory?.(null);
        onSelectArtifact?.(artifactId);
      }
    },
    [
      onSelectAgent,
      onSelectApproval,
      onSelectArtifact,
      onSelectEdge,
      onSelectMemory,
      onSelectTask,
      onSelectTool,
    ]
  );

  const handleNodeRemove = useCallback((node: GraphNode, nextDocument: GraphDocument) => {
    const nodeIdsToRemove = new Set<string>([node.id]);

    nextDocument.nodes.forEach((candidate) => {
      if (candidate.metadata?.derivedFrom === node.id) {
        nodeIdsToRemove.add(candidate.id);
      }
    });

    const approvalTaskNodeId =
      node.type === workflowGraphNodeTypes.approval &&
      typeof node.metadata?.derivedFrom === 'string'
        ? node.metadata.derivedFrom
        : null;

    return {
      ...nextDocument,
      nodes: nextDocument.nodes.flatMap((candidate) => {
        if (nodeIdsToRemove.has(candidate.id)) {
          return [];
        }

        if (approvalTaskNodeId && candidate.id === approvalTaskNodeId) {
          return [
            {
              ...candidate,
              data: {
                ...(candidate.data ?? {}),
                humanApprovalRequired: false,
              },
            },
          ];
        }

        return [candidate];
      }),
      edges: nextDocument.edges.filter(
        (edge) => !nodeIdsToRemove.has(edge.source) && !nodeIdsToRemove.has(edge.target)
      ),
    };
  }, []);

  const handleEdgeOpen = useCallback(
    (edge: GraphEdge) => {
      onSelectEdge?.(edge);
    },
    [onSelectEdge]
  );
  const handleSelectionChange = useCallback((selection: GraphSelection) => {
    setGraphSelection(selection);
  }, []);
  const getRuntimeEventRunHref = useCallback(
    (event: GraphRuntimeEvent) => {
      const runId = runtimeRunId(event);

      if (!runId) {
        return null;
      }

      const params = new URLSearchParams();
      const workflowId = event.graphId ?? workflow.id;

      if (workflowId) {
        params.set('workflowId', workflowId);
      }

      params.set('tab', 'runs');

      return `/runs/${encodeURIComponent(runId)}?${params.toString()}`;
    },
    [workflow.id]
  );
  const edgeLabelCount = displayDocument.edges.length;
  const renderEdgeLabel = useCallback(
    ({ edge, selected, validationIssues, onOpen }: GraphEdgeLabelRendererProps) => {
      const relationshipHighlighted = relationshipHighlights.edgeIds.has(edge.id);
      const labelPresentation = workflowEdgeLabelPresentation({
        edge,
        edgeCount: edgeLabelCount,
        density: graphDensity,
        selected: selected || relationshipHighlighted,
        validationIssueCount: validationIssues.length,
      });

      if (labelPresentation.hidden) {
        return null;
      }

      return (
        <button
          type="button"
          title={
            labelPresentation.compact
              ? `Open ${labelPresentation.fullLabel} connection settings`
              : 'Open connection settings'
          }
          aria-label={`Open ${labelPresentation.fullLabel} connection settings`}
          className={cn(
            'rounded-full border font-semibold shadow-sm',
            labelPresentation.compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
            selected || relationshipHighlighted
              ? 'border-neutral-900 bg-white text-neutral-900 ring-2 ring-neutral-200 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950 dark:ring-white/20'
              : validationIssues.length > 0
                ? 'border-red-300 bg-red-50 text-red-700'
                : workflowEdgeLabelClassName(edge)
          )}
          onClick={(event: MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            window.setTimeout(onOpen, 0);
          }}
          onDoubleClick={(event: MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            window.setTimeout(onOpen, 0);
          }}
        >
          {labelPresentation.label}
        </button>
      );
    },
    [relationshipHighlights.edgeIds, edgeLabelCount, graphDensity]
  );
  const renderRuntimeEvent = useCallback(
    (props: GraphRuntimeEventRendererProps) => (
      <WorkflowGraphRuntimeEvent {...props} document={displayDocument} />
    ),
    [displayDocument]
  );

  const canvasProps = {
    className: cn(
      isGraphExpanded
        ? 'min-h-0 w-full flex-1 overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-white/10 dark:bg-slate-950/90 dark:[&_.react-flow]:bg-slate-950/70 dark:[&_.react-flow__background]:opacity-70'
        : 'h-[34rem] min-h-96 w-full overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-white/10 dark:bg-slate-950/90 dark:[&_.react-flow]:bg-slate-950/70 dark:[&_.react-flow__background]:opacity-70 sm:h-[42rem] lg:h-170 lg:min-h-120',
      className
    ),
    readOnly,
    showControls: false,
    showMiniMap: displayDocument.nodes.length > 0,
    focusNodeId: graphFocusNodeId,
    focusNodeRevision: graphFocusNodeRevision,
    showInspector,
    emptyContent: (
      <div className="max-w-sm text-center">
        <div className="font-medium text-neutral-900">Start with a task or agent</div>
        <div className="mt-1 text-xs leading-5 text-neutral-500">
          Use Add Task or Add Agent in the graph toolbar to define the first unit of work.
        </div>
      </div>
    ),
    nodeRenderers,
    paletteItems: [],
    toolbarActions,
    builtInToolbarActions,
    validationIssues: visibleValidationIssues,
    runtimeEvents: graphRuntimeEvents,
    runtimeEventLimit: 8,
    runtimePanelPosition: 'top-left' as const,
    renderInspector: WorkflowGraphInspector,
    renderEdgeLabel,
    renderToolbar: WorkflowGraphToolbar,
    renderRuntimeEvent,
    getRuntimeEventRunHref,
    fitViewOptions: {
      padding: isGraphExpanded ? 0.12 : 0.18,
      maxZoom: 0.95,
    },
    layoutOptions: {
      columns: Math.max(1, Math.ceil(Math.sqrt(displayDocument.nodes.length || 1))),
      startX: 80,
      startY: 80,
      gapX: 720,
      gapY: 380,
    },
    onGraphChange: handleGraphChange,
    onSelectionChange: handleSelectionChange,
    onNodeOpen: handleNodeOpen,
    onEdgeOpen: handleEdgeOpen,
    onRemoveNode: handleNodeRemove,
    onConnect: handleConnect,
    onToolbarAction: handleToolbarAction,
  };

  return (
    <div
      className={cn(
        'relative',
        isGraphExpanded &&
          'fixed inset-4 z-50 flex flex-col rounded-lg border border-neutral-200 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-slate-950/96 dark:shadow-[0_24px_80px_rgba(2,8,23,0.78)]'
      )}
    >
      <div className="workflow-surface-graph mb-2 grid shrink-0 gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-xs shadow-sm dark:text-slate-300 lg:grid-cols-[minmax(170px,230px)_minmax(0,1fr)] lg:items-center">
        {hasRuntimeTimeline ? (
          <>
            <div className="min-w-0">
              <div className="truncate font-medium text-neutral-900 dark:text-slate-100">
                {isExecutionTimelineVisible ? 'Execution timeline' : 'Graph view'}
              </div>
              <div className="truncate text-neutral-500 dark:text-slate-400">
                {isExecutionTimelineVisible
                  ? `${visibleRuntimeEvents.length} shown from ${runtimeEventCount} events`
                  : `${runtimeEventCount} timeline event${runtimeEventCount === 1 ? '' : 's'} hidden`}
              </div>
            </div>
            {isExecutionTimelineVisible ? (
              <div className="grid min-w-0 gap-2 xl:grid-cols-[auto_minmax(0,1fr)] xl:items-center">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <label className="flex min-w-0 items-center gap-1.5 text-neutral-600 dark:text-slate-300">
                    <span className="shrink-0">Type</span>
                    <select
                      aria-label="Runtime event type filter"
                      value={effectiveSelectedRuntimeDirection}
                      className="h-8 max-w-40 rounded-md border border-neutral-200 bg-white px-2 text-xs text-neutral-800 shadow-sm dark:border-white/10 dark:bg-slate-950/72 dark:text-slate-100 dark:shadow-none"
                      onChange={(event) => setSelectedRuntimeDirection(event.target.value)}
                    >
                      <option value={allRuntimeDirectionsValue}>All types</option>
                      {runtimeDirectionOptions.map((direction) => (
                        <option key={direction} value={direction}>
                          {direction}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 text-neutral-600 shadow-sm dark:border-white/10 dark:bg-slate-950/72 dark:text-slate-300 dark:shadow-none">
                    <input
                      type="checkbox"
                      aria-label="Hide projected runtime events"
                      checked={hideProjectedRuntimeEvents}
                      className="h-3.5 w-3.5 cursor-pointer rounded border-neutral-300 text-sky-600"
                      onChange={(event) => setHideProjectedRuntimeEvents(event.target.checked)}
                    />
                    <span>Hide projections</span>
                  </label>
                  {hideRuntimeRunFilter ? null : (
                    <label className="flex min-w-0 items-center gap-1.5 text-neutral-600 dark:text-slate-300">
                      <span className="shrink-0">Run</span>
                      <select
                        aria-label="Runtime run filter"
                        value={effectiveSelectedRuntimeRunId}
                        className="h-8 max-w-65 rounded-md border border-neutral-200 bg-white px-2 text-xs text-neutral-800 shadow-sm dark:border-white/10 dark:bg-slate-950/72 dark:text-slate-100 dark:shadow-none"
                        onChange={(event) => {
                          setHasUserSelectedRuntimeRun(true);
                          setSelectedRuntimeRunId(event.target.value);
                        }}
                      >
                        <option value={allRuntimeRunsValue}>All runs</option>
                        {runtimeRunOptions.map((runId) => (
                          <option key={runId} value={runId}>
                            {runtimeRunOptionLabels.get(runId) ?? `Run ${shortRuntimeRunId(runId)}`}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                <div className="min-w-0 space-y-2">
                  {runtimeSummary ? (
                    <WorkflowGraphRunSummaryStrip summary={runtimeSummary} />
                  ) : null}
                  <WorkflowGraphLegend />
                  <WorkflowRelationshipSummaryStrip summary={relationshipSummary} />
                </div>
              </div>
            ) : (
              <div className="min-w-0 space-y-2">
                <WorkflowGraphLegend />
                <WorkflowRelationshipSummaryStrip summary={relationshipSummary} />
              </div>
            )}
            <div className="flex flex-wrap items-center justify-start gap-2 lg:col-span-2 lg:justify-end">
              <WorkflowGraphJumpControl
                nodes={graphJumpNodes}
                selectedNodeId={selectedGraphJumpNodeId}
                onSelectedNodeChange={setGraphJumpNodeId}
                onJump={handleGraphNodeJump}
              />
              <WorkflowGraphDensityToggle
                density={graphDensity}
                onDensityChange={handleGraphDensityChange}
              />
              <WorkflowGraphRuntimeControlsBar controls={runtimeControls} />
              <button
                type="button"
                aria-label={
                  isExecutionTimelineVisible
                    ? 'Hide graph execution timeline'
                    : 'Show graph execution timeline'
                }
                title={
                  isExecutionTimelineVisible
                    ? 'Hide graph execution timeline'
                    : 'Show graph execution timeline'
                }
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 text-neutral-600 shadow-sm hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:bg-slate-950/72 dark:text-slate-300 dark:shadow-none dark:hover:border-sky-300/40 dark:hover:text-sky-200"
                onClick={handleTimelineVisibilityToggle}
              >
                {isExecutionTimelineVisible ? (
                  <X className="h-4 w-4" />
                ) : (
                  <ListChecks className="h-4 w-4" />
                )}
                <span>{isExecutionTimelineVisible ? 'Hide timeline' : 'Show timeline'}</span>
              </button>
              <button
                type="button"
                aria-label={
                  isGraphExpanded ? 'Exit expanded workflow graph' : 'Expand workflow graph'
                }
                title={isGraphExpanded ? 'Exit expanded graph' : 'Expand graph'}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-600 shadow-sm hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:bg-slate-950/72 dark:text-slate-300 dark:shadow-none dark:hover:border-sky-300/40 dark:hover:text-sky-200"
                onClick={toggleGraphExpanded}
              >
                {isGraphExpanded ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="hidden lg:block" />
            <div className="min-w-0 space-y-2">
              <WorkflowGraphLegend />
              <WorkflowRelationshipSummaryStrip summary={relationshipSummary} />
            </div>
            <div className="flex flex-wrap items-center justify-start gap-2 lg:col-span-2 lg:justify-end">
              <WorkflowGraphJumpControl
                nodes={graphJumpNodes}
                selectedNodeId={selectedGraphJumpNodeId}
                onSelectedNodeChange={setGraphJumpNodeId}
                onJump={handleGraphNodeJump}
              />
              <WorkflowGraphDensityToggle
                density={graphDensity}
                onDensityChange={handleGraphDensityChange}
              />
              <WorkflowGraphRuntimeControlsBar controls={runtimeControls} />
              <button
                type="button"
                aria-label={
                  isGraphExpanded ? 'Exit expanded workflow graph' : 'Expand workflow graph'
                }
                title={isGraphExpanded ? 'Exit expanded graph' : 'Expand graph'}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-600 shadow-sm hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:bg-slate-950/72 dark:text-slate-300 dark:shadow-none dark:hover:border-sky-300/40 dark:hover:text-sky-200"
                onClick={toggleGraphExpanded}
              >
                {isGraphExpanded ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>
            </div>
          </>
        )}
      </div>
      <GraphCanvas document={displayDocument} {...canvasProps} />
    </div>
  );
}
