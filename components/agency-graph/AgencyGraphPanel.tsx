'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Compass,
  ExternalLink,
  Filter,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { executionsApi } from '@/lib/api/backend/executions';
import { workflowsApi } from '@/lib/api/backend/workflows';
import { graphReadApi } from '@/lib/api/backend/graphRead';
import { buildGraphDeltaStreamUrl } from '@/lib/api/backend/graphStream';
import { observabilityApi } from '@/lib/api/backend/observability';
import { queryKeys } from '@/lib/react-query/queryKeys';
import type { AuthUser } from '@/types/auth';
import type { WorkflowDefinition } from '@/types/workflows';
import { agencyGraphReadToSigmaGraph } from '@/lib/agency-graph/adapters';
import {
  executionEventsToSigmaGraph,
  recentExecutionsToSigmaGraph,
  workflowExecutionsToSigmaGraph,
} from '@/lib/agency-graph/executionFallbackGraph';
import { isAgencyGraphRealtimeEnabled } from '@/lib/agency-graph/config';
import { useAgencyGraphRealtimeDocument } from '@/lib/agency-graph/realtime';
import type { ExecutionEventRecord, ExecutionRecord } from '@/types/runtime';
import ForceGraph3DCanvas from '@/modules/sigma-graph/ForceGraph3DCanvas';
import SigmaGraphCanvas from '@/modules/sigma-graph/SigmaGraphCanvas';
import { applySigmaGraphFilters } from '@/modules/sigma-graph/filters';
import type {
  SigmaGraphDocument,
  SigmaGraphEdge,
  SigmaGraphFilter,
  SigmaGraphJsonObject,
  SigmaGraphJsonValue,
  SigmaGraphNode,
  SigmaGraphSelection,
} from '@/modules/sigma-graph/types';
import { Badge } from '@/components/library/shadcn/badge';
import { Button } from '@/components/library/shadcn/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/library/shadcn/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/library/shadcn/tooltip';

export interface AgencyGraphRootOption {
  id: string;
  label: string;
}

export interface AgencyGraphPanelProps {
  graphStatus?: Record<string, unknown>;
  graphStatusError?: unknown;
  isGraphStatusLoading?: boolean;
  isRootOptionsLoading?: boolean;
  memoryId?: string;
  onRefreshRoots?: () => void | Promise<unknown>;
  rootOptions?: AgencyGraphRootOption[];
  user?: AuthUser;
}

type AgencyGraphRootType =
  | 'all'
  | 'memory'
  | 'run'
  | 'workflow'
  | 'agent'
  | 'entity'
  | 'document'
  | 'error';
type AgencyGraphManualRootType = 'agent' | 'entity' | 'document' | 'error';
type AgencyGraphRunStatusFilter = 'all' | 'failed' | 'completed' | 'running' | 'cancelled';
type AgencyGraphColorMode = 'obsidian' | 'category' | 'status' | 'cluster';
type AgencyGraphViewMode = 'global' | 'connected' | 'neighborhood';
type AgencyGraphCanvasTheme = 'dark' | 'light';
type AgencyGraphRenderMode = '2d' | '3d';

const agencyGraphNeighborhoodLimit = 250;
const agencyGraphPerformanceBudget = {
  cacheMs: 30_000,
  defaultMaxEdges: 500,
  defaultMaxNodes: 250,
  executionListFetchLimit: 200,
  maxDepth: 2,
  maxEventNodesPerRun: 120,
  maxLabelLength: 80,
  maxRecentRunsPerFallback: 40,
  maxWorkflowRunsPerFallback: 24,
  selectedExpansionLimit: 120,
  rootCacheMs: 60_000,
};
const agencyGraphRootTypeOptions: { label: string; value: AgencyGraphRootType }[] = [
  { label: 'All', value: 'all' },
  { label: 'Memory', value: 'memory' },
  { label: 'Run', value: 'run' },
  { label: 'Workflow', value: 'workflow' },
  { label: 'Agent', value: 'agent' },
  { label: 'Entity', value: 'entity' },
  { label: 'Document', value: 'document' },
  { label: 'Error', value: 'error' },
];
const agencyGraphPrimaryRootTypeOptions = agencyGraphRootTypeOptions.filter((option) =>
  ['all', 'memory', 'run', 'workflow'].includes(option.value)
);
const agencyGraphManualRootTypeOptions = agencyGraphRootTypeOptions.filter((option) =>
  ['agent', 'entity', 'document', 'error'].includes(option.value)
);

interface AgencyGraphNodeRelationship {
  records: {
    direction: 'From' | 'To';
    id: string;
    label: string;
  }[];
  type: string;
}

interface AgencyGraphCondensedEventGroup {
  count: number;
  examples: string[];
  label: string;
  latest?: string;
  statuses: string[];
}

interface AgencyGraphPerformanceBudget {
  cacheMs: number;
  defaultMaxEdges: number;
  defaultMaxNodes: number;
  executionListFetchLimit: number;
  maxDepth: number;
  maxEventNodesPerRun: number;
  maxLabelLength: number;
  maxRecentRunsPerFallback: number;
  maxWorkflowRunsPerFallback: number;
  selectedExpansionLimit: number;
  rootCacheMs: number;
}

export default function AgencyGraphPanel({
  graphStatus,
  graphStatusError,
  isGraphStatusLoading = false,
  isRootOptionsLoading = false,
  memoryId,
  onRefreshRoots,
  rootOptions = [],
  user,
}: AgencyGraphPanelProps) {
  const graphSurfaceRef = useRef<HTMLElement | null>(null);
  const hasAutoSelectedRunFallbackRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rootType, setRootType] = useState<AgencyGraphRootType>('all');
  const [internalMemoryId, setInternalMemoryId] = useState('');
  const [internalRunId, setInternalRunId] = useState('');
  const [internalWorkflowId, setInternalWorkflowId] = useState('');
  const [manualRootIds, setManualRootIds] = useState<Record<AgencyGraphManualRootType, string>>({
    agent: '',
    document: '',
    entity: '',
    error: '',
  });
  const [selection, setSelection] = useState<SigmaGraphSelection>({ nodeIds: [], edgeIds: [] });
  const [runStatusFilter, setRunStatusFilter] = useState<AgencyGraphRunStatusFilter>('all');
  const [selectedNodeStatus, setSelectedNodeStatus] = useState('all');
  const [selectedNodeSeverity, setSelectedNodeSeverity] = useState('all');
  const [selectedRelationshipType, setSelectedRelationshipType] = useState('all');
  const [graphColorMode] = useState<AgencyGraphColorMode>('category');
  const [graphViewMode, setGraphViewMode] = useState<AgencyGraphViewMode>('global');
  const [graphCanvasTheme] = useState<AgencyGraphCanvasTheme>('dark');
  const [graphRenderMode, setGraphRenderMode] = useState<AgencyGraphRenderMode>('2d');
  const [graphAutoRotate, setGraphAutoRotate] = useState(true);
  const [graphResetViewToken, setGraphResetViewToken] = useState(0);
  const [graphRotationAngle, setGraphRotationAngle] = useState(0);
  const [autoFocusSelection] = useState(true);
  const [graphSearchQuery, setGraphSearchQuery] = useState('');
  const [rootSearchQuery, setRootSearchQuery] = useState('');
  const rotateGraph = (deltaDegrees: number) => {
    setGraphRotationAngle((current) => current + (deltaDegrees * Math.PI) / 180);
  };
  const resolvedMemoryId = memoryId || internalMemoryId || rootOptions[0]?.id || '';
  const graphUnavailable = graphStatus?.available === false || graphStatus?.enabled === false;

  const executionsQuery = useQuery({
    queryKey: queryKeys.backendExecutions(),
    queryFn: () =>
      executionsApi.listExecutions(user, null, {
        // The operational graph needs a wider recent-run window than list pages usually show.
        limit: agencyGraphPerformanceBudget.executionListFetchLimit,
      }),
    enabled: Boolean(user),
    gcTime: agencyGraphPerformanceBudget.rootCacheMs * 5,
    retry: false,
    staleTime: agencyGraphPerformanceBudget.rootCacheMs,
  });
  const workflowsQuery = useQuery({
    queryKey: queryKeys.backendWorkflowList(),
    queryFn: () => workflowsApi.listWorkflows(user),
    enabled: Boolean(user),
    gcTime: agencyGraphPerformanceBudget.rootCacheMs * 5,
    retry: false,
    staleTime: agencyGraphPerformanceBudget.rootCacheMs,
  });
  const executionOptions = useMemo(
    () => sortExecutionsForGraph(executionsQuery.data?.items || []),
    [executionsQuery.data]
  );
  const filteredExecutionOptions = useMemo(
    () =>
      runStatusFilter === 'all'
        ? executionOptions
        : executionOptions.filter((execution) => execution.status === runStatusFilter),
    [executionOptions, runStatusFilter]
  );
  const workflowLookup = useMemo(
    () => workflowLookupFromDefinitions(workflowsQuery.data?.items || []),
    [workflowsQuery.data]
  );
  const workflowOptions = useMemo(
    () => workflowOptionsFromExecutions(executionOptions, workflowLookup),
    [executionOptions, workflowLookup]
  );
  const filteredMemoryRootOptions = useMemo(
    () => filterRootOptions(rootOptions, rootSearchQuery),
    [rootOptions, rootSearchQuery]
  );
  const filteredRunRootOptions = useMemo(
    () =>
      filteredExecutionOptions.filter((execution) =>
        rootSearchMatches(rootSearchQuery, execution.id, runOptionLabel(execution, workflowLookup))
      ),
    [filteredExecutionOptions, rootSearchQuery, workflowLookup]
  );
  const filteredWorkflowRootOptions = useMemo(
    () => filterRootOptions(workflowOptions, rootSearchQuery),
    [rootSearchQuery, workflowOptions]
  );
  const fallbackRun = executionOptions.find((execution) => execution.status === 'failed');
  const selectedRunStillVisible = filteredExecutionOptions.some(
    (execution) => execution.id === internalRunId
  );
  const resolvedRunId =
    (selectedRunStillVisible ? internalRunId : '') ||
    filteredExecutionOptions.find((execution) => execution.status === 'failed')?.id ||
    filteredExecutionOptions[0]?.id ||
    '';
  const resolvedWorkflowId = internalWorkflowId || workflowOptions[0]?.id || '';
  const selectedExecution = executionOptions.find((execution) => execution.id === resolvedRunId);
  const workflowExecutionsForFallback = useMemo(
    () =>
      selectWorkflowExecutionsForGraphCoverage(
        executionOptions.filter((execution) => execution.workflow_id === resolvedWorkflowId),
        agencyGraphPerformanceBudget.maxWorkflowRunsPerFallback
      ),
    [executionOptions, resolvedWorkflowId]
  );
  const recentExecutionsForFallback = useMemo(
    () =>
      selectRecentExecutionsForGraphCoverage(
        executionOptions,
        agencyGraphPerformanceBudget.maxRecentRunsPerFallback
      ),
    [executionOptions]
  );
  const supportsRunFallback = rootType === 'all' || rootType === 'run';
  const resolvedManualRootId = isManualRootType(rootType) ? manualRootIds[rootType].trim() : '';
  const resolvedRootId =
    rootType === 'all'
      ? resolvedMemoryId || resolvedRunId
      : rootType === 'workflow'
        ? resolvedWorkflowId
        : rootType === 'run'
          ? resolvedRunId
          : rootType === 'memory'
            ? resolvedMemoryId
            : resolvedManualRootId;
  const selectedRootLabel = selectedAgencyGraphRootLabel({
    execution: selectedExecution,
    manualRootId: resolvedManualRootId,
    memoryId: resolvedMemoryId,
    rootOptions,
    rootType,
    workflowId: resolvedWorkflowId,
    workflowOptions,
  });

  const graphQuery = useQuery({
    queryKey: queryKeys.backendGraphRoot(rootType, resolvedRootId),
    queryFn: () => {
      const includeOperationalCoverage =
        rootType === 'all' || rootType === 'workflow' || rootType === 'run';
      const params = {
        depth: agencyGraphPerformanceBudget.maxDepth,
        limit: agencyGraphNeighborhoodLimit,
        ...(includeOperationalCoverage
          ? {
              includeOperationalCoverage,
              incidentLimit: 12,
              recentRunLimit: agencyGraphPerformanceBudget.maxRecentRunsPerFallback,
              workflowRunLimit: agencyGraphPerformanceBudget.maxWorkflowRunsPerFallback,
            }
          : {}),
      };
      if (rootType === 'all') {
        return graphReadApi.getMemoryNeighborhood(resolvedMemoryId, params, user);
      }
      if (rootType === 'workflow') {
        return graphReadApi.getWorkflowNeighborhood(resolvedWorkflowId, params, user);
      }
      if (rootType === 'run') {
        return graphReadApi.getRunNeighborhood(resolvedRunId, params, user);
      }
      if (rootType === 'agent') {
        return graphReadApi.getAgentNeighborhood(resolvedManualRootId, params, user);
      }
      if (rootType === 'entity') {
        return graphReadApi.getEntityNeighborhood(resolvedManualRootId, params, user);
      }
      if (rootType === 'document') {
        return graphReadApi.getNodeNeighborhood(
          resolvedManualRootId,
          { ...params, labels: 'Document' },
          user
        );
      }
      if (rootType === 'error') {
        return graphReadApi.getNodeNeighborhood(
          resolvedManualRootId,
          { ...params, labels: 'Error' },
          user
        );
      }
      return graphReadApi.getMemoryNeighborhood(resolvedMemoryId, params, user);
    },
    enabled:
      Boolean(rootType === 'all' ? resolvedMemoryId : resolvedRootId) &&
      Boolean(user) &&
      !graphUnavailable,
    gcTime: agencyGraphPerformanceBudget.cacheMs * 10,
    retry: false,
    staleTime: agencyGraphPerformanceBudget.cacheMs,
  });
  const projectedDocument = useMemo(
    () => (graphQuery.data ? agencyGraphReadToSigmaGraph(graphQuery.data) : null),
    [graphQuery.data]
  );
  const hasProjectedGraph = Boolean(projectedDocument?.nodes.length);
  const eventFallbackExecution = selectedExecution;
  const runEventsQuery = useQuery({
    queryKey: queryKeys.backendRunEvents(eventFallbackExecution?.id || ''),
    queryFn: () => executionsApi.listExecutionEvents(eventFallbackExecution!.id, 0, [], user),
    enabled:
      supportsRunFallback &&
      Boolean(eventFallbackExecution?.id) &&
      Boolean(user) &&
      (rootType === 'all' ||
        graphUnavailable ||
        graphQuery.isError ||
        (graphQuery.isSuccess && !hasProjectedGraph)),
    gcTime: agencyGraphPerformanceBudget.cacheMs * 10,
    retry: false,
    staleTime: agencyGraphPerformanceBudget.cacheMs,
  });
  const runTimelineQuery = useQuery({
    queryKey: queryKeys.backendRunTimeline(eventFallbackExecution?.id || ''),
    queryFn: () => observabilityApi.getExecutionTimeline(eventFallbackExecution!.id),
    enabled:
      supportsRunFallback &&
      Boolean(eventFallbackExecution?.id) &&
      Boolean(user) &&
      (rootType === 'all' ||
        graphUnavailable ||
        graphQuery.isError ||
        (graphQuery.isSuccess && !hasProjectedGraph)),
    gcTime: agencyGraphPerformanceBudget.cacheMs * 10,
    retry: false,
    staleTime: agencyGraphPerformanceBudget.cacheMs,
  });
  const fallbackEvents = useMemo(
    () =>
      runTimelineQuery.data?.events && runTimelineQuery.data.events.length > 0
        ? runTimelineQuery.data.events
        : runEventsQuery.data?.items || [],
    [runEventsQuery.data, runTimelineQuery.data]
  );
  const fallbackEventsForGraph = useMemo(
    () =>
      limitExecutionEventsForGraph(
        fallbackEvents,
        agencyGraphPerformanceBudget.maxEventNodesPerRun
      ),
    [fallbackEvents]
  );
  const eventFallbackTruncated = fallbackEventsForGraph.length < fallbackEvents.length;
  const fallbackExecution = runTimelineQuery.data?.execution || eventFallbackExecution;

  const runFallbackDocument = useMemo(() => {
    if (!fallbackExecution || fallbackEventsForGraph.length === 0) {
      return null;
    }
    const document = executionEventsToSigmaGraph(fallbackExecution, fallbackEventsForGraph);
    return {
      ...document,
      metadata: {
        ...(document.metadata || {}),
        event_limit: agencyGraphPerformanceBudget.maxEventNodesPerRun,
        event_truncated: eventFallbackTruncated,
        original_event_count: fallbackEvents.length,
      },
    };
  }, [eventFallbackTruncated, fallbackEvents.length, fallbackEventsForGraph, fallbackExecution]);
  const workflowFallbackDocument = useMemo(() => {
    if (
      rootType !== 'workflow' ||
      !resolvedWorkflowId ||
      workflowExecutionsForFallback.length === 0
    ) {
      return null;
    }
    const document = workflowExecutionsToSigmaGraph(
      resolvedWorkflowId,
      workflowExecutionsForFallback
    );
    return {
      ...document,
      metadata: {
        ...(document.metadata || {}),
        run_budget: agencyGraphPerformanceBudget.maxWorkflowRunsPerFallback,
        run_truncated:
          executionOptions.filter((execution) => execution.workflow_id === resolvedWorkflowId)
            .length > workflowExecutionsForFallback.length,
      },
    };
  }, [executionOptions, resolvedWorkflowId, rootType, workflowExecutionsForFallback]);
  const recentRunsFallbackDocument = useMemo(() => {
    if (rootType !== 'all' || recentExecutionsForFallback.length === 0) {
      return null;
    }
    const document = recentExecutionsToSigmaGraph(recentExecutionsForFallback);
    return {
      ...document,
      metadata: {
        ...(document.metadata || {}),
        run_budget: agencyGraphPerformanceBudget.maxRecentRunsPerFallback,
        run_truncated: executionOptions.length > recentExecutionsForFallback.length,
      },
    };
  }, [executionOptions.length, recentExecutionsForFallback, rootType]);
  const hasRunFallbackGraph = Boolean(supportsRunFallback && runFallbackDocument?.nodes.length);
  const hasWorkflowFallbackGraph = Boolean(workflowFallbackDocument?.nodes.length);
  const hasRecentRunsFallbackGraph = Boolean(recentRunsFallbackDocument?.nodes.length);
  const hasGraphData =
    hasProjectedGraph ||
    hasRunFallbackGraph ||
    hasWorkflowFallbackGraph ||
    hasRecentRunsFallbackGraph;
  const placeholderDocument = useMemo(() => {
    if (graphQuery.isLoading) {
      return createPlaceholderAgencyGraphDocument(`Loading ${rootType} graph`);
    }
    if (supportsRunFallback && runEventsQuery.isLoading) {
      return createPlaceholderAgencyGraphDocument('Loading run events');
    }
    if (supportsRunFallback && runEventsQuery.isError) {
      return createPlaceholderAgencyGraphDocument('Run events unavailable');
    }
    if (graphQuery.isError) {
      return createPlaceholderAgencyGraphDocument('Graph unavailable');
    }
    if (graphStatus?.enabled === false) {
      return createPlaceholderAgencyGraphDocument('Graph backend disabled');
    }
    if (graphStatus?.available === false) {
      return createPlaceholderAgencyGraphDocument('Graph backend unavailable');
    }
    return createPlaceholderAgencyGraphDocument(`${rootTypeLabel(rootType)} graph`);
  }, [
    graphQuery.isError,
    graphQuery.isLoading,
    graphStatus?.available,
    graphStatus?.enabled,
    rootType,
    runEventsQuery.isError,
    runEventsQuery.isLoading,
    supportsRunFallback,
  ]);
  const baseSourceDocument = useMemo(
    () =>
      rootType === 'all'
        ? mergeAgencyGraphDocuments(
            mergeAgencyGraphDocuments(projectedDocument, recentRunsFallbackDocument),
            runFallbackDocument
          ) || placeholderDocument
        : rootType === 'workflow'
          ? mergeAgencyGraphDocuments(projectedDocument, workflowFallbackDocument) ||
            projectedDocument ||
            workflowFallbackDocument ||
            placeholderDocument
          : hasRunFallbackGraph
            ? runFallbackDocument!
            : hasProjectedGraph
              ? projectedDocument!
              : placeholderDocument,
    [
      placeholderDocument,
      projectedDocument,
      hasProjectedGraph,
      recentRunsFallbackDocument,
      hasRunFallbackGraph,
      rootType,
      runFallbackDocument,
      workflowFallbackDocument,
    ]
  );
  const selectedNodeId = selection.nodeIds[0] || '';
  const selectedBaseNode = baseSourceDocument.nodes.find((node) => node.id === selectedNodeId);
  const shouldExpandSelectedNode =
    hasProjectedGraph &&
    Boolean(selectedBaseNode?.id) &&
    selectedBaseNode?.metadata?.projection_mode !== 'execution-events-fallback';
  const selectedNodeExpansionQuery = useQuery({
    queryKey: queryKeys.backendGraphNodeExpansion(selectedNodeId),
    queryFn: () =>
      graphReadApi.expandNode(
        selectedNodeId,
        {
          depth: 1,
          limit: agencyGraphPerformanceBudget.selectedExpansionLimit,
        },
        user
      ),
    enabled: Boolean(user) && !graphUnavailable && shouldExpandSelectedNode,
    gcTime: agencyGraphPerformanceBudget.cacheMs * 10,
    retry: false,
    staleTime: agencyGraphPerformanceBudget.cacheMs,
  });
  const selectedExpansionDocument = useMemo(
    () =>
      selectedNodeExpansionQuery.data
        ? agencyGraphReadToSigmaGraph(selectedNodeExpansionQuery.data)
        : null,
    [selectedNodeExpansionQuery.data]
  );
  const expandedSourceDocument = useMemo(
    () =>
      mergeAgencyGraphDocuments(baseSourceDocument, selectedExpansionDocument) ||
      baseSourceDocument,
    [baseSourceDocument, selectedExpansionDocument]
  );
  const realtimeStreamUrl = useMemo(() => {
    if (!isAgencyGraphRealtimeEnabled() || !hasProjectedGraph || graphUnavailable) {
      return null;
    }
    if (rootType === 'run' && resolvedRunId) {
      return buildGraphDeltaStreamUrl({ executionId: resolvedRunId, limit: 50, pollSeconds: 2 });
    }
    if (rootType === 'workflow' && resolvedWorkflowId) {
      return buildGraphDeltaStreamUrl({
        limit: 50,
        pollSeconds: 2,
        workflowId: resolvedWorkflowId,
      });
    }
    return buildGraphDeltaStreamUrl({ limit: 50, pollSeconds: 2 });
  }, [graphUnavailable, hasProjectedGraph, resolvedRunId, resolvedWorkflowId, rootType]);
  const realtimeGraph = useAgencyGraphRealtimeDocument({
    snapshotDocument: expandedSourceDocument,
    enabled: Boolean(realtimeStreamUrl),
    streamUrl: realtimeStreamUrl,
  });
  const sourceDocument = realtimeGraph.document || expandedSourceDocument;
  const budgetedSourceDocument = useMemo(
    () => applyAgencyGraphPerformanceBudget(sourceDocument, agencyGraphPerformanceBudget),
    [sourceDocument]
  );
  const displayDocument = useMemo(
    () => applyAgencyGraphDisplayLabels(budgetedSourceDocument, executionOptions, workflowLookup),
    [budgetedSourceDocument, executionOptions, workflowLookup]
  );
  const graphBudgetSummary = useMemo(
    () => graphBudgetSummaryForDocument(displayDocument),
    [displayDocument]
  );
  const visibleDisplayDocument = useMemo(
    () => applyCondensedEventVisibility(displayDocument),
    [displayDocument]
  );

  const nodeStatusOptions = useMemo(() => {
    const statuses = visibleDisplayDocument.nodes
      .map((node) => stringValue(node.data?.status)?.toLowerCase())
      .filter((status): status is string => Boolean(status));
    return [...new Set(statuses)].sort((left, right) => left.localeCompare(right));
  }, [visibleDisplayDocument]);
  const activeNodeStatus =
    selectedNodeStatus === 'all' || nodeStatusOptions.includes(selectedNodeStatus)
      ? selectedNodeStatus
      : 'all';
  const nodeSeverityOptions = useMemo(() => {
    const severities = visibleDisplayDocument.nodes
      .map((node) => nodeSeverityValue(node))
      .filter((severity): severity is string => Boolean(severity));
    return [...new Set(severities)].sort((left, right) => left.localeCompare(right));
  }, [visibleDisplayDocument]);
  const activeNodeSeverity =
    selectedNodeSeverity === 'all' || nodeSeverityOptions.includes(selectedNodeSeverity)
      ? selectedNodeSeverity
      : 'all';
  const relationshipTypeOptions = useMemo(
    () =>
      [...new Set(visibleDisplayDocument.edges.map((edge) => edge.type))]
        .filter(Boolean)
        .sort((left, right) =>
          relationshipTypeLabel(left).localeCompare(relationshipTypeLabel(right))
        ),
    [visibleDisplayDocument]
  );
  const activeRelationshipType =
    selectedRelationshipType === 'all' || relationshipTypeOptions.includes(selectedRelationshipType)
      ? selectedRelationshipType
      : 'all';
  const activeAdvancedFilterCount = [
    activeNodeStatus !== 'all',
    activeNodeSeverity !== 'all',
    activeRelationshipType !== 'all',
  ].filter(Boolean).length;
  const relationshipTypeNodeIds = useMemo(
    () => nodeIdsForRelationshipType(visibleDisplayDocument.edges, activeRelationshipType),
    [activeRelationshipType, visibleDisplayDocument.edges]
  );
  const connectedNodeIds = useMemo(() => {
    const nodeIds = new Set<string>();
    visibleDisplayDocument.edges.forEach((edge) => {
      nodeIds.add(edge.source);
      nodeIds.add(edge.target);
    });
    return nodeIds;
  }, [visibleDisplayDocument.edges]);
  const selectedNeighborhoodNodeIds = useMemo(() => {
    const nodeIds = new Set<string>(selection.nodeIds);
    const edgeIds = new Set<string>(selection.edgeIds);
    visibleDisplayDocument.edges.forEach((edge) => {
      if (edgeIds.has(edge.id) || nodeIds.has(edge.source) || nodeIds.has(edge.target)) {
        nodeIds.add(edge.source);
        nodeIds.add(edge.target);
      }
    });
    return nodeIds;
  }, [selection.edgeIds, selection.nodeIds, visibleDisplayDocument.edges]);
  const hasSelection = selection.nodeIds.length > 0 || selection.edgeIds.length > 0;
  const effectiveGraphViewMode =
    autoFocusSelection && hasSelection && graphViewMode === 'global'
      ? 'neighborhood'
      : graphViewMode;
  const activeFilterSummaryCount = [
    activeAdvancedFilterCount > 0,
    graphSearchQuery.trim().length > 0,
  ].filter(Boolean).length;
  const filteredDocument = useMemo(() => {
    const filters: SigmaGraphFilter[] = [];
    if (hasGraphData && effectiveGraphViewMode === 'connected') {
      filters.push({
        id: 'agency-graph-view-connected',
        predicate: {
          node: (node) => connectedNodeIds.has(node.id),
        },
      });
    }
    if (
      hasGraphData &&
      effectiveGraphViewMode === 'neighborhood' &&
      selectedNeighborhoodNodeIds.size > 0
    ) {
      filters.push({
        id: 'agency-graph-view-neighborhood',
        predicate: {
          edge: (edge) =>
            selectedNeighborhoodNodeIds.has(edge.source) &&
            selectedNeighborhoodNodeIds.has(edge.target),
          node: (node) => selectedNeighborhoodNodeIds.has(node.id),
        },
      });
    }
    if (hasGraphData && activeNodeStatus !== 'all') {
      filters.push({
        id: 'agency-graph-node-status',
        predicate: {
          node: (node) => stringValue(node.data?.status)?.toLowerCase() === activeNodeStatus,
        },
      });
    }
    if (hasGraphData && activeNodeSeverity !== 'all') {
      filters.push({
        id: 'agency-graph-node-severity',
        predicate: {
          node: (node) => nodeSeverityValue(node) === activeNodeSeverity,
        },
      });
    }
    if (hasGraphData && activeRelationshipType !== 'all') {
      filters.push({
        id: 'agency-graph-relationship-type',
        predicate: {
          edge: (edge) => edge.type === activeRelationshipType,
          node: (node) => relationshipTypeNodeIds.has(node.id),
        },
      });
    }
    const cleanSearchQuery = graphSearchQuery.trim().toLowerCase();
    if (hasGraphData && cleanSearchQuery) {
      filters.push({
        id: 'agency-graph-search',
        predicate: {
          edge: (edge) =>
            [edge.id, edge.label, edge.type, edge.source, edge.target].some((value) =>
              String(value || '')
                .toLowerCase()
                .includes(cleanSearchQuery)
            ),
          node: (node) =>
            [
              node.id,
              node.label,
              node.type,
              stringValue(node.data?.name),
              stringValue(node.data?.summary),
              stringValue(node.data?.status),
            ].some((value) =>
              String(value || '')
                .toLowerCase()
                .includes(cleanSearchQuery)
            ),
        },
      });
    }
    return applySigmaGraphFilters(visibleDisplayDocument, filters);
  }, [
    activeNodeSeverity,
    activeNodeStatus,
    activeRelationshipType,
    effectiveGraphViewMode,
    connectedNodeIds,
    graphSearchQuery,
    hasGraphData,
    relationshipTypeNodeIds,
    selectedNeighborhoodNodeIds,
    visibleDisplayDocument,
  ]);
  const displayVisualDocument = useMemo(
    () => applyAgencyGraphVisualEncoding(filteredDocument, { colorMode: graphColorMode }),
    [filteredDocument, graphColorMode]
  );
  const displayTimelineDocument = displayVisualDocument;
  const visualLegend = useMemo(
    () => agencyGraphVisualLegend(displayTimelineDocument),
    [displayTimelineDocument]
  );
  const coverageSummary = useMemo(
    () =>
      agencyGraphCoverageSummary({
        document: displayTimelineDocument,
        recentExecutions: recentExecutionsForFallback,
        rootType,
        selectedExecution,
        workflowExecutions: workflowExecutionsForFallback,
      }),
    [
      displayTimelineDocument,
      recentExecutionsForFallback,
      rootType,
      selectedExecution,
      workflowExecutionsForFallback,
    ]
  );
  const selectedNode = displayTimelineDocument.nodes.find((node) =>
    selection.nodeIds.includes(node.id)
  );
  const selectedEdge = displayTimelineDocument.edges.find((edge) =>
    selection.edgeIds.includes(edge.id)
  );
  const nodeLookup = useMemo(() => {
    const lookup = new Map<string, SigmaGraphNode>();
    for (const node of displayTimelineDocument.nodes) {
      lookup.set(node.id, node);
    }
    return lookup;
  }, [displayTimelineDocument]);
  const selectedNodeRelationships = useMemo(
    () =>
      selectedNode ? relationshipsForNode(selectedNode, filteredDocument.edges, nodeLookup) : [],
    [filteredDocument.edges, nodeLookup, selectedNode]
  );
  const selectedNodeCondensedEvents = useMemo(
    () => (selectedNode ? condensedEventsForNode(selectedNode, displayDocument) : []),
    [displayDocument, selectedNode]
  );
  const selectedEventDetails = useMemo(
    () => (selectedNode ? eventDetailsForSelectedNode(selectedNode, fallbackEvents) : undefined),
    [fallbackEvents, selectedNode]
  );
  const sigmaSettings = useMemo(
    () => ({
      defaultEdgeColor: graphCanvasTheme === 'light' ? '#94a3b8' : '#52525b',
      labelRenderedSizeThreshold: hasGraphData ? 13 : 0,
    }),
    [graphCanvasTheme, hasGraphData]
  );
  const graphFilterLabelClass =
    graphCanvasTheme === 'light' ? 'text-neutral-600' : 'text-slate-300';
  const graphFilterFieldClass =
    graphCanvasTheme === 'light'
      ? 'h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-900'
      : 'h-9 rounded-md border border-white/10 bg-slate-950/85 px-3 text-sm text-slate-100 placeholder:text-slate-500';
  const graphThemeChrome =
    graphCanvasTheme === 'light'
      ? {
          frame:
            'border-slate-300/80 bg-[linear-gradient(180deg,rgba(241,245,249,0.98),rgba(226,236,248,0.96))]',
          toolbar:
            'border-sky-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(244,248,253,0.92))] text-slate-700 shadow-[0_18px_45px_rgba(148,163,184,0.22)]',
          toolbarButton:
            'text-slate-700 hover:bg-linear-to-r hover:from-sky-50 hover:to-indigo-50 hover:text-slate-900',
          legend:
            'border-sky-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(244,248,253,0.9))] text-slate-800 shadow-[0_18px_45px_rgba(148,163,184,0.2)]',
          legendTitle: 'text-slate-900',
          legendSection: 'text-slate-600',
          legendChip:
            'border-sky-100/90 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(240,247,255,0.95))]',
          legendText: 'text-slate-800',
          legendCount: 'text-slate-500',
          filterPopover:
            'border-sky-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,248,253,0.96))] text-slate-900 shadow-[0_24px_60px_rgba(148,163,184,0.24)]',
          filterCount: 'text-xs font-semibold uppercase tracking-[0.18em] text-slate-500',
          inspector:
            'border-sky-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(244,248,253,0.92))] text-slate-900 shadow-[0_18px_45px_rgba(148,163,184,0.2)]',
        }
      : {
          frame:
            'border-[rgba(94,234,212,0.12)] bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_28%),linear-gradient(180deg,#070b13,#090d15)] shadow-[inset_0_1px_0_rgba(148,163,184,0.06)]',
          toolbar:
            'border-white/10 bg-[linear-gradient(180deg,rgba(13,24,39,0.96),rgba(10,18,31,0.92))] text-slate-200 shadow-[0_24px_54px_rgba(0,0,0,0.34)]',
          toolbarButton: 'text-slate-300 hover:bg-white/8 hover:text-white',
          legend:
            'border-[rgba(94,234,212,0.12)] bg-[linear-gradient(180deg,rgba(6,12,24,0.94),rgba(4,9,18,0.92))] text-slate-100 shadow-[0_18px_42px_rgba(0,0,0,0.36)]',
          legendTitle: 'text-slate-50',
          legendSection: 'text-slate-300',
          legendChip: 'border-white/10 bg-white/4',
          legendText: 'text-slate-100',
          legendCount: 'text-slate-400',
          filterPopover:
            'border-white/10 bg-[linear-gradient(180deg,rgba(7,14,28,0.98),rgba(4,9,18,0.96))] text-slate-100 shadow-[0_24px_60px_rgba(0,0,0,0.44)]',
          filterCount: 'text-xs font-semibold uppercase tracking-[0.18em] text-slate-400',
          inspector:
            'border-[rgba(94,234,212,0.12)] bg-[linear-gradient(180deg,rgba(6,12,24,0.94),rgba(4,9,18,0.92))] text-slate-100 shadow-[0_18px_42px_rgba(0,0,0,0.38)]',
        };
  const emptyState = agencyGraphEmptyState({
    graphStatus,
    graphStatusError,
    graphQueryError: graphQuery.error,
    hasGraphData,
    isGraphStatusLoading,
    isRootOptionsLoading,
    resolvedRootId,
    rootOptions,
    rootType,
    runStatusFilter,
    runEventsError: runEventsQuery.error,
    selectedExecution: eventFallbackExecution,
    totalRunCount: executionOptions.length,
  });
  const statusIndicator = agencyGraphStatusIndicator({
    graphStatus,
    graphStatusError,
    hasGraphData,
    isGraphStatusLoading,
    runEventsError: runEventsQuery.error,
    supportsRunFallback,
  });

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === graphSurfaceRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  useEffect(() => {
    if (
      hasAutoSelectedRunFallbackRef.current ||
      rootType === 'all' ||
      memoryId ||
      hasProjectedGraph ||
      (!graphUnavailable && rootOptions.length > 0) ||
      !fallbackRun
    ) {
      return;
    }
    hasAutoSelectedRunFallbackRef.current = true;
    setRootType('run');
    setRunStatusFilter('failed');
    setInternalRunId(fallbackRun.id);
    setSelection({ nodeIds: [], edgeIds: [] });
  }, [fallbackRun, graphUnavailable, hasProjectedGraph, memoryId, rootOptions.length, rootType]);
  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await graphSurfaceRef.current?.requestFullscreen();
  };
  const refreshGraph = async () => {
    if (supportsRunFallback && resolvedRootId) {
      await executionsQuery.refetch();
      await graphQuery.refetch();
      if (shouldExpandSelectedNode) {
        await selectedNodeExpansionQuery.refetch();
      }
      if (eventFallbackExecution?.id) {
        await runTimelineQuery.refetch();
        await runEventsQuery.refetch();
      }
      return;
    }
    if (resolvedMemoryId) {
      await graphQuery.refetch();
      if (shouldExpandSelectedNode) {
        await selectedNodeExpansionQuery.refetch();
      }
      return;
    }
    if (resolvedRootId) {
      await graphQuery.refetch();
      if (shouldExpandSelectedNode) {
        await selectedNodeExpansionQuery.refetch();
      }
      return;
    }
    await onRefreshRoots?.();
  };
  const isCurrentGraphFetching = supportsRunFallback
    ? graphQuery.isFetching ||
      runEventsQuery.isFetching ||
      runTimelineQuery.isFetching ||
      executionsQuery.isFetching ||
      selectedNodeExpansionQuery.isFetching
    : graphQuery.isFetching || selectedNodeExpansionQuery.isFetching;

  return (
    <section
      ref={graphSurfaceRef}
      className={`relative flex flex-1 flex-col overflow-hidden rounded-lg border ${
        graphThemeChrome.frame
      } ${isFullscreen ? 'h-screen min-h-screen' : 'h-[calc(100vh-22rem)] min-h-130'}`}
    >
      <TooltipProvider delayDuration={150}>
        <div
          className={`absolute right-4 top-4 z-20 flex items-center gap-1 rounded-xl p-1 backdrop-blur ${graphThemeChrome.toolbar}`}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Agency graph status"
                className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${graphThemeChrome.toolbarButton}`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${statusIndicator.className}`} />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="space-y-1">
                <p className="font-medium">{statusIndicator.label}</p>
                <p>{statusIndicator.description}</p>
                <p>Source: {String(graphStatus?.source || 'unknown')}</p>
                <p>
                  Memory roots: {rootOptions.length}
                  {executionOptions.length > 0 ? `, runs: ${executionOptions.length}` : ''}
                </p>
                <p>Selected root: {selectedRootLabel}</p>
                {realtimeStreamUrl ? (
                  <p>
                    Live updates: {agencyGraphRealtimeStatusLabel(realtimeGraph.realtimeStatus)}
                  </p>
                ) : null}
                {selectedNodeExpansionQuery.isFetching ? <p>Expanding selected node...</p> : null}
                {graphBudgetSummary.isTruncated ? <p>{graphBudgetSummary.description}</p> : null}
                {coverageSummary.expectedRuns > 0 ? (
                  <p>
                    Run coverage: {coverageSummary.renderedRuns}/{coverageSummary.expectedRuns}
                  </p>
                ) : null}
                {coverageSummary.renderedIssues > 0 ? (
                  <p>Issues shown: {coverageSummary.renderedIssues}</p>
                ) : null}
              </div>
            </TooltipContent>
          </Tooltip>

          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Open agency graph filters"
                    className={graphThemeChrome.toolbarButton}
                  >
                    <Filter className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Open graph filters</TooltipContent>
            </Tooltip>
            <PopoverContent
              align="end"
              className={`w-90 overflow-hidden p-0 ${graphThemeChrome.filterPopover}`}
            >
              <div className="max-h-[min(70vh,calc(100vh-6rem))] overflow-y-auto p-4">
                <div className="space-y-4">
                  {hasGraphData ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={graphThemeChrome.filterCount}>
                        {displayTimelineDocument.nodes.length} nodes /{' '}
                        {displayTimelineDocument.edges.length} edges
                      </span>
                      {graphBudgetSummary.isTruncated ? (
                        <Badge variant="secondary">{graphBudgetSummary.label}</Badge>
                      ) : null}
                      {graphQuery.isFetching && graphQuery.data ? (
                        <Badge variant="outline">Refreshing cached graph</Badge>
                      ) : null}
                      {realtimeStreamUrl ? (
                        <Badge variant="outline">
                          {agencyGraphRealtimeStatusLabel(realtimeGraph.realtimeStatus)}
                        </Badge>
                      ) : null}
                      {activeFilterSummaryCount > 0 ? (
                        <Badge variant="secondary">
                          {activeFilterSummaryCount} active{' '}
                          {activeFilterSummaryCount === 1 ? 'filter' : 'filters'}
                        </Badge>
                      ) : null}
                    </div>
                  ) : null}
                  {!hasGraphData ? (
                    <div
                      className={`space-y-1 text-sm ${
                        graphCanvasTheme === 'light' ? 'text-neutral-600' : 'text-slate-300'
                      }`}
                    >
                      <p
                        className={`font-medium ${
                          graphCanvasTheme === 'light' ? 'text-neutral-900' : 'text-slate-50'
                        }`}
                      >
                        {emptyState.title}
                      </p>
                      <p>{emptyState.description}</p>
                    </div>
                  ) : null}
                  <div className="grid gap-3">
                    <div className="space-y-3">
                      <label className="sr-only">
                        Agency graph root type
                        <select
                          aria-label="Agency graph root type"
                          value={rootType}
                          onChange={(event) => {
                            setRootSearchQuery('');
                            setRootType(event.target.value as AgencyGraphRootType);
                            setSelection({ nodeIds: [], edgeIds: [] });
                          }}
                        >
                          {agencyGraphRootTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div
                        aria-label="Agency graph root type segmented control"
                        className="grid grid-cols-4 gap-1"
                        role="group"
                      >
                        {agencyGraphPrimaryRootTypeOptions.map((option) => {
                          const active = option.value === rootType;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              aria-pressed={active}
                              className={`h-9 rounded-md border px-2 text-xs font-medium ${
                                active
                                  ? graphCanvasTheme === 'light'
                                    ? 'border-neutral-900 bg-neutral-900 text-white'
                                    : 'border-(--agency-agent) bg-(--agency-agent) text-white'
                                  : graphCanvasTheme === 'light'
                                    ? 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                                    : 'border-white/10 bg-slate-950/80 text-slate-300 hover:bg-white/8 hover:text-white'
                              }`}
                              onClick={() => {
                                setRootSearchQuery('');
                                setRootType(option.value);
                                setSelection({ nodeIds: [], edgeIds: [] });
                              }}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                      <label
                        className={`flex min-w-65 flex-col gap-1 text-xs font-medium ${graphFilterLabelClass}`}
                      >
                        Direct ID
                        <select
                          aria-label="Agency graph direct root type"
                          className={graphFilterFieldClass}
                          value={isManualRootType(rootType) ? rootType : ''}
                          onChange={(event) => {
                            const nextValue = event.target.value as AgencyGraphManualRootType | '';
                            if (!nextValue) {
                              return;
                            }
                            setRootSearchQuery('');
                            setRootType(nextValue);
                            setSelection({ nodeIds: [], edgeIds: [] });
                          }}
                        >
                          <option value="">Agent, entity, document, error</option>
                          {agencyGraphManualRootTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {rootType === 'memory' || rootType === 'run' || rootType === 'workflow' ? (
                      <label
                        className={`flex min-w-65 flex-col gap-1 text-xs font-medium ${graphFilterLabelClass}`}
                      >
                        Search roots
                        <input
                          aria-label="Agency graph root search"
                          className={graphFilterFieldClass}
                          placeholder={`Find ${rootTypeLabel(rootType).toLowerCase()} roots`}
                          value={rootSearchQuery}
                          onChange={(event) => setRootSearchQuery(event.target.value)}
                        />
                      </label>
                    ) : null}
                    {isManualRootType(rootType) ? (
                      <label
                        className={`flex min-w-65 flex-col gap-1 text-xs font-medium ${graphFilterLabelClass}`}
                      >
                        Root {rootTypeLabel(rootType)}
                        <input
                          aria-label={`Agency graph root ${rootType}`}
                          className={graphFilterFieldClass}
                          placeholder={`${rootType}:...`}
                          value={manualRootIds[rootType]}
                          onChange={(event) => {
                            setManualRootIds((current) => ({
                              ...current,
                              [rootType]: event.target.value,
                            }));
                            setSelection({ nodeIds: [], edgeIds: [] });
                          }}
                        />
                      </label>
                    ) : null}
                    {rootType === 'memory' && rootOptions.length > 0 && !memoryId ? (
                      <label
                        className={`flex min-w-65 flex-col gap-1 text-xs font-medium ${graphFilterLabelClass}`}
                      >
                        Root memory
                        <select
                          aria-label="Agency graph root memory"
                          className={graphFilterFieldClass}
                          value={resolvedMemoryId}
                          onChange={(event) => {
                            setInternalMemoryId(event.target.value);
                            setSelection({ nodeIds: [], edgeIds: [] });
                          }}
                        >
                          {filteredMemoryRootOptions.length === 0 ? (
                            <option value={resolvedMemoryId}>No memory roots match</option>
                          ) : (
                            filteredMemoryRootOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                              </option>
                            ))
                          )}
                        </select>
                      </label>
                    ) : null}
                    {rootType === 'run' ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label
                          className={`flex min-w-0 flex-col gap-1 text-xs font-medium ${graphFilterLabelClass}`}
                        >
                          Run status
                          <select
                            aria-label="Agency graph run status filter"
                            className={graphFilterFieldClass}
                            value={runStatusFilter}
                            onChange={(event) => {
                              setRunStatusFilter(event.target.value as AgencyGraphRunStatusFilter);
                              setInternalRunId('');
                              setSelection({ nodeIds: [], edgeIds: [] });
                            }}
                          >
                            <option value="all">All statuses</option>
                            <option value="failed">Failed</option>
                            <option value="completed">Completed</option>
                            <option value="running">Running</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </label>
                        <label
                          className={`flex min-w-0 flex-col gap-1 text-xs font-medium ${graphFilterLabelClass}`}
                        >
                          Root run
                          <select
                            aria-label="Agency graph root run"
                            className={graphFilterFieldClass}
                            disabled={filteredRunRootOptions.length === 0}
                            value={resolvedRunId}
                            onChange={(event) => {
                              setInternalRunId(event.target.value);
                              setSelection({ nodeIds: [], edgeIds: [] });
                            }}
                          >
                            {filteredRunRootOptions.length === 0 ? (
                              <option value="">No runs match this status</option>
                            ) : (
                              filteredRunRootOptions.map((execution) => (
                                <option key={execution.id} value={execution.id}>
                                  {runOptionLabel(execution, workflowLookup)}
                                </option>
                              ))
                            )}
                          </select>
                        </label>
                      </div>
                    ) : null}
                    {rootType === 'workflow' ? (
                      <label
                        className={`flex min-w-65 flex-col gap-1 text-xs font-medium ${graphFilterLabelClass}`}
                      >
                        Root workflow
                        <select
                          aria-label="Agency graph root workflow"
                          className={graphFilterFieldClass}
                          disabled={filteredWorkflowRootOptions.length === 0}
                          value={resolvedWorkflowId}
                          onChange={(event) => {
                            setInternalWorkflowId(event.target.value);
                            setSelection({ nodeIds: [], edgeIds: [] });
                          }}
                        >
                          {filteredWorkflowRootOptions.length === 0 ? (
                            <option value="">No workflows available</option>
                          ) : (
                            filteredWorkflowRootOptions.map((workflow) => (
                              <option key={workflow.id} value={workflow.id}>
                                {workflow.label}
                              </option>
                            ))
                          )}
                        </select>
                      </label>
                    ) : null}
                    {hasGraphData ? (
                      <>
                        <label
                          className={`flex min-w-65 flex-col gap-1 text-xs font-medium ${graphFilterLabelClass}`}
                        >
                          Search graph
                          <input
                            aria-label="Agency graph search"
                            className={graphFilterFieldClass}
                            placeholder="Find visible nodes or edges"
                            value={graphSearchQuery}
                            onChange={(event) => {
                              setGraphSearchQuery(event.target.value);
                              setSelection({ nodeIds: [], edgeIds: [] });
                            }}
                          />
                        </label>
                        {nodeStatusOptions.length > 0 ? (
                          <label
                            className={`flex min-w-65 flex-col gap-1 text-xs font-medium ${graphFilterLabelClass}`}
                          >
                            Status
                            <select
                              aria-label="Agency graph node status filter"
                              className={`${graphFilterFieldClass} w-full`}
                              value={activeNodeStatus}
                              onChange={(event) => {
                                setSelectedNodeStatus(event.target.value);
                                setSelection({ nodeIds: [], edgeIds: [] });
                              }}
                            >
                              <option value="all">All statuses</option>
                              {nodeStatusOptions.map((status) => (
                                <option key={status} value={status}>
                                  {statusLabel(status)}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                        {nodeSeverityOptions.length > 0 ? (
                          <label
                            className={`flex min-w-65 flex-col gap-1 text-xs font-medium ${graphFilterLabelClass}`}
                          >
                            Severity
                            <select
                              aria-label="Agency graph node severity filter"
                              className={`${graphFilterFieldClass} w-full`}
                              value={activeNodeSeverity}
                              onChange={(event) => {
                                setSelectedNodeSeverity(event.target.value);
                                setSelection({ nodeIds: [], edgeIds: [] });
                              }}
                            >
                              <option value="all">All severities</option>
                              {nodeSeverityOptions.map((severity) => (
                                <option key={severity} value={severity}>
                                  {statusLabel(severity)}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                        {relationshipTypeOptions.length > 0 ? (
                          <label
                            className={`flex min-w-65 flex-col gap-1 text-xs font-medium ${graphFilterLabelClass}`}
                          >
                            Relationship
                            <select
                              aria-label="Agency graph relationship type filter"
                              className={`${graphFilterFieldClass} w-full`}
                              value={activeRelationshipType}
                              onChange={(event) => {
                                setSelectedRelationshipType(event.target.value);
                                setSelection({ nodeIds: [], edgeIds: [] });
                              }}
                            >
                              <option value="all">All relationships</option>
                              {relationshipTypeOptions.map((relationshipType) => (
                                <option key={relationshipType} value={relationshipType}>
                                  {relationshipTypeLabel(relationshipType)}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={
                            !hasSelection &&
                            activeNodeStatus === 'all' &&
                            activeNodeSeverity === 'all' &&
                            activeRelationshipType === 'all' &&
                            !graphSearchQuery.trim()
                          }
                          onClick={() => {
                            setSelection({ nodeIds: [], edgeIds: [] });
                            setSelectedNodeStatus('all');
                            setSelectedNodeSeverity('all');
                            setSelectedRelationshipType('all');
                            setGraphRotationAngle(0);
                            setGraphSearchQuery('');
                          }}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Clear filters
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <div
            className={`flex items-center rounded-full border px-1 py-1 ${
              graphCanvasTheme === 'dark'
                ? 'border-white/12 bg-black/45'
                : 'border-sky-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(244,248,253,0.92))]'
            }`}
          >
            {[
              {
                label: 'Overview',
                value: 'global',
                description: 'Show the whole current graph.',
              },
              {
                label: 'Links',
                value: 'connected',
                description: 'Emphasize only connected nodes and relationships.',
              },
              {
                label: 'Focus',
                value: 'neighborhood',
                description: 'Focus on the neighborhood around the selected node.',
              },
            ].map((option) => {
              const active = graphViewMode === option.value;
              return (
                <Tooltip key={option.value}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Agency graph view ${option.label}`}
                      aria-pressed={active}
                      className={`h-8 rounded-full px-3 text-xs font-semibold ${
                        active
                          ? graphCanvasTheme === 'dark'
                            ? 'bg-white text-slate-950 hover:bg-white/90'
                            : 'bg-[linear-gradient(135deg,#0f172a,#1d4ed8)] text-white shadow-[0_10px_24px_rgba(29,78,216,0.2)] hover:brightness-105'
                          : graphThemeChrome.toolbarButton
                      }`}
                      onClick={() => {
                        setGraphViewMode(option.value as AgencyGraphViewMode);
                        setSelection({ nodeIds: [], edgeIds: [] });
                      }}
                    >
                      {option.label}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{option.description}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          <div
            className={`flex items-center rounded-full border px-1 py-1 ${
              graphCanvasTheme === 'dark'
                ? 'border-white/12 bg-black/45'
                : 'border-sky-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(244,248,253,0.92))]'
            }`}
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Switch agency graph to 2D"
              className={`h-8 rounded-full px-3 text-xs font-semibold ${
                graphRenderMode === '2d'
                  ? graphCanvasTheme === 'dark'
                    ? 'bg-white text-slate-950 hover:bg-white/90'
                    : 'bg-[linear-gradient(135deg,#0f172a,#1d4ed8)] text-white shadow-[0_10px_24px_rgba(29,78,216,0.2)] hover:brightness-105'
                  : graphThemeChrome.toolbarButton
              }`}
              onClick={() => setGraphRenderMode('2d')}
            >
              2D
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Switch agency graph to 3D"
              className={`h-8 rounded-full px-3 text-xs font-semibold ${
                graphRenderMode === '3d'
                  ? graphCanvasTheme === 'dark'
                    ? 'bg-white text-slate-950 hover:bg-white/90'
                    : 'bg-[linear-gradient(135deg,#0f172a,#1d4ed8)] text-white shadow-[0_10px_24px_rgba(29,78,216,0.2)] hover:brightness-105'
                  : graphThemeChrome.toolbarButton
              }`}
              onClick={() => setGraphRenderMode('3d')}
            >
              3D
            </Button>
          </div>
          {graphRenderMode === '2d' ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Rotate agency graph counterclockwise"
                    className={graphThemeChrome.toolbarButton}
                    onClick={() => rotateGraph(-12)}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Rotate left</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Rotate agency graph clockwise"
                    className={graphThemeChrome.toolbarButton}
                    onClick={() => rotateGraph(12)}
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Rotate right</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={
                      graphAutoRotate
                        ? 'Pause agency graph orbit rotation'
                        : 'Resume agency graph orbit rotation'
                    }
                    className={graphThemeChrome.toolbarButton}
                    onClick={() => setGraphAutoRotate((current) => !current)}
                  >
                    {graphAutoRotate ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {graphAutoRotate ? 'Pause orbit motion' : 'Resume orbit motion'}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Reset 3D agency graph view"
                    className={graphThemeChrome.toolbarButton}
                    onClick={() => setGraphResetViewToken((current) => current + 1)}
                  >
                    <Compass className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset 3D view</TooltipContent>
              </Tooltip>
            </>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Refresh agency graph"
                disabled={isCurrentGraphFetching || (!resolvedRootId && !onRefreshRoots)}
                onClick={() => void refreshGraph()}
                className={graphThemeChrome.toolbarButton}
              >
                <RefreshCw className={`h-4 w-4 ${isCurrentGraphFetching ? 'animate-spin' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh graph</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={isFullscreen ? 'Exit fullscreen agency graph' : 'Expand agency graph'}
                onClick={() => void toggleFullscreen()}
                className={graphThemeChrome.toolbarButton}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isFullscreen ? 'Exit fullscreen' : 'Expand to fullscreen'}
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {graphRenderMode === '2d' ? (
        <SigmaGraphCanvas
          animate
          appearance="constellation"
          theme={graphCanvasTheme}
          rotationAngle={graphRotationAngle}
          document={displayTimelineDocument}
          className="min-h-0 flex-1"
          selection={selection}
          settings={sigmaSettings}
          onSelectionChange={setSelection}
        />
      ) : (
        <ForceGraph3DCanvas
          autoRotate={graphAutoRotate}
          theme={graphCanvasTheme}
          document={displayTimelineDocument}
          className="min-h-0 flex-1"
          resetViewToken={graphResetViewToken}
          selection={selection}
          onSelectionChange={setSelection}
        />
      )}

      {hasGraphData ? (
        <div
          className={`absolute bottom-4 left-4 z-10 w-80 max-w-[calc(100%-2rem)] overflow-hidden rounded-2xl backdrop-blur ${graphThemeChrome.legend}`}
        >
          <div className="h-px bg-linear-to-r from-sky-300/70 via-violet-300/45 to-amber-200/60" />
          <div className="p-3">
            <AgencyGraphVisualLegend legend={visualLegend} theme={graphCanvasTheme} />
          </div>
        </div>
      ) : null}

      {hasGraphData && hasSelection ? (
        <div
          className={`absolute bottom-4 right-4 z-10 flex max-h-[calc(100%-6rem)] w-80 max-w-[calc(100%-2rem)] overflow-hidden rounded-2xl backdrop-blur ${graphThemeChrome.inspector}`}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-sky-300/70 via-violet-300/45 to-amber-200/60" />
          <AgencyGraphSelectionInspector
            condensedEvents={selectedNodeCondensedEvents}
            edge={selectedEdge}
            node={selectedNode}
            relationships={selectedNodeRelationships}
            selectedEventDetails={selectedEventDetails}
            sourceNode={selectedEdge ? nodeLookup.get(selectedEdge.source) : undefined}
            targetNode={selectedEdge ? nodeLookup.get(selectedEdge.target) : undefined}
            theme={graphCanvasTheme}
          />
        </div>
      ) : null}
    </section>
  );
}

interface AgencyGraphSelectionInspectorProps {
  condensedEvents?: AgencyGraphCondensedEventGroup[];
  node?: SigmaGraphNode;
  edge?: SigmaGraphEdge;
  relationships?: AgencyGraphNodeRelationship[];
  selectedEventDetails?: SigmaGraphJsonObject;
  sourceNode?: SigmaGraphNode;
  targetNode?: SigmaGraphNode;
  theme: AgencyGraphCanvasTheme;
}

interface AgencyGraphLegendItem {
  color: string;
  count: number;
  label: string;
  style?: string;
}

interface AgencyGraphVisualLegendData {
  edgeTones: AgencyGraphLegendItem[];
  nodeTypes: AgencyGraphLegendItem[];
  statuses: AgencyGraphLegendItem[];
}

function AgencyGraphVisualLegend({
  legend,
  theme,
}: {
  legend: AgencyGraphVisualLegendData;
  theme: AgencyGraphCanvasTheme;
}) {
  return (
    <aside aria-label="Agency graph visual legend" className="space-y-3 text-xs">
      <p className={`font-medium ${theme === 'light' ? 'text-slate-900' : 'text-slate-50'}`}>
        Legend
      </p>
      <div className="space-y-2">
        <LegendSection items={legend.nodeTypes} title="Types" theme={theme} />
        <LegendSection items={legend.statuses} title="Status" theme={theme} />
        <LegendSection items={legend.edgeTones} title="Lines" line theme={theme} />
      </div>
    </aside>
  );
}

function LegendSection({
  items,
  line = false,
  theme,
  title,
}: {
  items: AgencyGraphLegendItem[];
  line?: boolean;
  theme: AgencyGraphCanvasTheme;
  title: string;
}) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div>
      <p className={`mb-1 font-medium ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
        {title}
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {items.map((item) => (
          <div
            key={`${title}:${item.label}`}
            className={`flex min-w-0 items-center gap-1.5 rounded-full px-2 py-1 ${
              theme === 'light'
                ? 'border border-sky-100/90 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(240,247,255,0.95))]'
                : 'border border-white/10 bg-white/5'
            }`}
          >
            {line ? (
              <span
                aria-hidden="true"
                className="inline-block w-5 border-t-2"
                style={{
                  borderColor: item.color,
                  borderStyle:
                    item.style === 'dotted'
                      ? 'dotted'
                      : item.style === 'dashed'
                        ? 'dashed'
                        : 'solid',
                }}
              />
            ) : (
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 shrink-0 rounded-full ring-1 ${
                  theme === 'light' ? 'ring-sky-200/90' : 'ring-black/35'
                }`}
                style={{ backgroundColor: item.color }}
              />
            )}
            <span className={`truncate ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
              {item.label}{' '}
              <span className={theme === 'light' ? 'text-slate-500' : 'text-slate-400'}>
                {item.count}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgencyGraphSelectionInspector({
  condensedEvents = [],
  node,
  edge,
  relationships = [],
  selectedEventDetails,
  sourceNode,
  targetNode,
  theme,
}: AgencyGraphSelectionInspectorProps) {
  const sourceRecord = node ? sourceRecordForNode(node) : undefined;
  const actionLinks = node ? inspectorActionLinksForNode(node) : [];
  const timestampRows = node ? timestampRowsForNode(node) : [];
  const healthWarnings = node ? healthWarningsForNode(node) : [];
  const costRows = node ? costRowsForNode(node) : [];
  const incidentDetails = node ? incidentDetailsForNode(node) : undefined;
  const chrome =
    theme === 'light'
      ? {
          badge:
            'border-sky-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(240,247,255,0.92))] text-slate-600',
          card: 'border-sky-100/90 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(240,247,255,0.95))]',
          cardText: 'text-slate-700',
          cardTitle: 'text-slate-900',
          rootText: 'text-slate-700',
          subtitle: 'text-slate-500',
          title: 'text-slate-900',
          warning: 'border-amber-200/80 bg-amber-50/95 text-amber-950',
        }
      : {
          badge: 'border-white/10 bg-white/5 text-slate-400',
          card: 'border-white/10 bg-white/6',
          cardText: 'text-slate-300',
          cardTitle: 'text-slate-100',
          rootText: 'text-slate-300',
          subtitle: 'text-slate-400',
          title: 'text-slate-50',
          warning: 'border-amber-200 bg-amber-50 text-amber-950',
        };

  return (
    <aside
      className="max-h-full overflow-y-auto overscroll-contain rounded-2xl p-4"
      aria-label="Agency graph selection inspector"
    >
      <div className="flex items-center justify-between gap-3">
        <p className={`text-sm font-medium ${chrome.title}`}>Inspector</p>
        <span
          className={`rounded-full border px-2 py-1 text-[11px] font-medium uppercase tracking-[0.14em] ${chrome.badge}`}
        >
          Focus
        </span>
      </div>
      {node ? (
        <div className={`mt-3 space-y-3 text-sm ${chrome.rootText}`}>
          <div className="space-y-1">
            <p className={`font-medium ${chrome.title}`}>{node.label}</p>
            <p className={`text-xs ${chrome.subtitle}`}>{nodeSubtitle(node)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{agencyGraphNodeCategory(node.type)}</Badge>
            {agencyGraphNodeCategory(node.type) !== node.type ? (
              <Badge variant="secondary">{node.type}</Badge>
            ) : null}
            {statusBadgeValue(node) ? (
              <Badge variant="secondary">{statusBadgeValue(node)}</Badge>
            ) : null}
          </div>
          {sourceRecord ? (
            <div className={`rounded-xl border p-3 text-xs shadow-sm ${chrome.card}`}>
              <p className={`font-medium ${chrome.cardTitle}`}>{sourceRecord.label}</p>
              <p className={`mt-1 wrap-break-word ${chrome.cardText}`}>{sourceRecord.value}</p>
            </div>
          ) : null}
          {timestampRows.length > 0 ? (
            <dl
              className={`grid grid-cols-2 gap-2 rounded-xl border p-3 text-xs shadow-sm ${chrome.card}`}
            >
              {timestampRows.map((row) => (
                <div key={row.label}>
                  <dt className={`font-medium ${chrome.cardTitle}`}>{row.label}</dt>
                  <dd className={`mt-1 ${chrome.cardText}`}>{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {healthWarnings.length > 0 ? (
            <div className={`rounded-md border p-3 text-xs ${chrome.warning}`}>
              <p className="font-medium">Health warnings</p>
              <ul className="mt-2 space-y-1">
                {healthWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {incidentDetails ? (
            <div className={`rounded-xl border p-3 text-xs shadow-sm ${chrome.card}`}>
              <p className={`font-medium ${chrome.cardTitle}`}>Incident cluster</p>
              <dl className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <dt className={`font-medium ${chrome.cardTitle}`}>Failures</dt>
                  <dd className={`mt-1 ${chrome.cardText}`}>{incidentDetails.failureCount}</dd>
                </div>
                <div>
                  <dt className={`font-medium ${chrome.cardTitle}`}>Affected runs</dt>
                  <dd className={`mt-1 ${chrome.cardText}`}>{incidentDetails.runCount}</dd>
                </div>
                {incidentDetails.firstSeen ? (
                  <div>
                    <dt className={`font-medium ${chrome.cardTitle}`}>First seen</dt>
                    <dd className={`mt-1 ${chrome.cardText}`}>{incidentDetails.firstSeen}</dd>
                  </div>
                ) : null}
                {incidentDetails.lastSeen ? (
                  <div>
                    <dt className={`font-medium ${chrome.cardTitle}`}>Last seen</dt>
                    <dd className={`mt-1 ${chrome.cardText}`}>{incidentDetails.lastSeen}</dd>
                  </div>
                ) : null}
              </dl>
              {incidentDetails.exampleError ? (
                <div className="mt-3">
                  <p className={`font-medium ${chrome.cardTitle}`}>Example error</p>
                  <p className={`mt-1 wrap-break-word ${chrome.cardText}`}>
                    {incidentDetails.exampleError}
                  </p>
                </div>
              ) : null}
              {incidentDetails.signature ? (
                <div className="mt-3">
                  <p className={`font-medium ${chrome.cardTitle}`}>Signature</p>
                  <p className={`mt-1 wrap-break-word ${chrome.cardText}`}>
                    {incidentDetails.signature}
                  </p>
                </div>
              ) : null}
              {incidentDetails.runIds.length > 0 ? (
                <div className="mt-3">
                  <p className={`font-medium ${chrome.cardTitle}`}>Runs</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {incidentDetails.runIds.slice(0, 6).map((runId) => (
                      <span
                        key={runId}
                        className={`rounded-full border px-2 py-1 ${
                          theme === 'light'
                            ? 'border-sky-100/80 bg-white/70 text-slate-700'
                            : 'border-white/10 bg-white/5 text-slate-200'
                        }`}
                      >
                        {runId}
                      </span>
                    ))}
                  </div>
                  {incidentDetails.runIds.length > 6 ? (
                    <p className={`mt-2 ${chrome.cardText}`}>
                      +{incidentDetails.runIds.length - 6} more runs
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {costRows.length > 0 ? (
            <dl
              className={`grid grid-cols-2 gap-2 rounded-xl border p-3 text-xs shadow-sm ${chrome.card}`}
            >
              <div className={`col-span-2 font-medium ${chrome.cardTitle}`}>Cost and tokens</div>
              {costRows.map((row) => (
                <div key={row.label}>
                  <dt className={`font-medium ${chrome.cardTitle}`}>{row.label}</dt>
                  <dd className={`mt-1 ${chrome.cardText}`}>{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {condensedEvents.length > 0 ? (
            <div className={`rounded-xl border p-3 text-xs shadow-sm ${chrome.card}`}>
              <p className={`font-medium ${chrome.cardTitle}`}>Condensed events</p>
              <div className="mt-2 space-y-3">
                {condensedEvents.slice(0, 6).map((group) => (
                  <div key={group.label} className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`font-medium ${chrome.cardTitle}`}>{group.label}</p>
                      <span className={`shrink-0 ${chrome.subtitle}`}>{group.count}</span>
                    </div>
                    <p className={chrome.cardText}>
                      {[group.latest, group.statuses.join(', ')].filter(Boolean).join(' - ')}
                    </p>
                    {group.examples.length > 0 ? (
                      <p className={chrome.cardText}>{group.examples.join(', ')}</p>
                    ) : null}
                  </div>
                ))}
              </div>
              {condensedEvents.length > 6 ? (
                <p className={`mt-2 ${chrome.cardText}`}>
                  +{condensedEvents.length - 6} more groups
                </p>
              ) : null}
            </div>
          ) : null}
          {relationships.length > 0 ? (
            <div className={`rounded-xl border p-3 text-xs shadow-sm ${chrome.card}`}>
              <p className={`font-medium ${chrome.cardTitle}`}>Related records</p>
              <div className="mt-2 space-y-3">
                {relationships.map((group) => (
                  <div key={group.type} className="space-y-1">
                    <p className={`font-medium ${chrome.cardTitle}`}>{group.type}</p>
                    <ul className="space-y-1">
                      {group.records.slice(0, 4).map((record) => (
                        <li key={record.id} className={chrome.cardText}>
                          <span className={`font-medium ${chrome.cardTitle}`}>
                            {record.direction}
                          </span>{' '}
                          {record.label}
                        </li>
                      ))}
                    </ul>
                    {group.records.length > 4 ? (
                      <p className={chrome.cardText}>+{group.records.length - 4} more</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {selectedEventDetails ? (
            <div className={`rounded-xl border p-3 text-xs shadow-sm ${chrome.card}`}>
              <p className={`font-medium ${chrome.cardTitle}`}>Selected event details</p>
              <PropertyList properties={selectedEventDetails} theme={theme} />
            </div>
          ) : null}
          {actionLinks.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {actionLinks.map((action) => (
                <Link
                  key={action.href}
                  className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-xs font-medium transition-colors ${
                    theme === 'light'
                      ? 'border-sky-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(240,247,255,0.95))] text-slate-800 hover:bg-[linear-gradient(180deg,rgba(240,249,255,1),rgba(224,231,255,0.95))]'
                      : 'border-white/10 bg-white/4 text-slate-100 hover:bg-white/10'
                  }`}
                  href={action.href}
                >
                  {action.label}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ))}
            </div>
          ) : null}
          <PropertyList properties={node.data || {}} theme={theme} />
        </div>
      ) : edge ? (
        <div className={`mt-3 space-y-3 text-sm ${chrome.rootText}`}>
          <div className="space-y-1">
            <p className={`font-medium ${chrome.title}`}>{edge.label || edge.type}</p>
            <p className={`text-xs ${chrome.subtitle}`}>{edge.type}</p>
          </div>
          <Badge variant="outline">{edge.type}</Badge>
          <div className={`space-y-1 rounded-xl border p-3 text-xs shadow-sm ${chrome.card}`}>
            <p>
              <span className={`font-medium ${chrome.cardTitle}`}>Source:</span>{' '}
              {sourceNode?.label || edge.source}
            </p>
            <p>
              <span className={`font-medium ${chrome.cardTitle}`}>Target:</span>{' '}
              {targetNode?.label || edge.target}
            </p>
          </div>
          <PropertyList properties={edge.data || {}} theme={theme} />
        </div>
      ) : (
        <p className={`mt-3 text-sm ${chrome.subtitle}`}>Select a node or edge to inspect it.</p>
      )}
    </aside>
  );
}

function nodeSubtitle(node: SigmaGraphNode) {
  const status = statusLabel(stringValue(node.data?.status));
  const time = formatDateTime(node.startedAt || node.endedAt);
  return [agencyGraphNodeCategory(node.type), status !== 'Unknown' ? status : undefined, time]
    .filter(Boolean)
    .join(' - ');
}

function statusBadgeValue(node: SigmaGraphNode) {
  const status = statusLabel(stringValue(node.data?.status));
  return status !== 'Unknown' ? status : undefined;
}

function incidentDetailsForNode(node: SigmaGraphNode) {
  if (node.type !== 'IncidentCluster') {
    return undefined;
  }
  const data = node.data || {};
  const runIds = Array.isArray(data.run_ids)
    ? data.run_ids.filter((value): value is string => typeof value === 'string' && Boolean(value))
    : [];
  return {
    exampleError: stringValue(data.example_error),
    failureCount: formatNumber(numberValue(data.failure_count) || runIds.length),
    firstSeen: formatDateTime(stringValue(data.first_seen_at)),
    lastSeen: formatDateTime(stringValue(data.last_seen_at)),
    runCount: formatNumber(runIds.length),
    runIds,
    signature: stringValue(data.incident_signature),
  };
}

function sourceRecordForNode(node: SigmaGraphNode) {
  const sourceRecord = sourceRecordIdsForNode(node);
  if (sourceRecord.executionId) {
    return { label: 'Source run', value: sourceRecord.executionId };
  }
  if (sourceRecord.workflowId) {
    return { label: 'Source workflow', value: sourceRecord.workflowId };
  }
  if (sourceRecord.memoryId) {
    return { label: 'Source memory', value: sourceRecord.memoryId };
  }
  if (sourceRecord.agentId) {
    return { label: 'Source agent', value: sourceRecord.agentId };
  }
  if (sourceRecord.documentId) {
    return { label: 'Source document', value: sourceRecord.documentId };
  }
  return undefined;
}

function inspectorActionLinksForNode(node: SigmaGraphNode) {
  const sourceRecord = sourceRecordIdsForNode(node);
  const actions: { href: string; label: string }[] = [];
  if (sourceRecord.executionId) {
    const params = new URLSearchParams();
    if (sourceRecord.workflowId) {
      params.set('workflowId', sourceRecord.workflowId);
    }
    params.set('tab', 'runs');
    actions.push({
      href: `/runs/${encodeURIComponent(sourceRecord.executionId)}?${params.toString()}`,
      label: 'Open run',
    });
  }
  if (sourceRecord.workflowId) {
    actions.push({
      href: `/workflows/${encodeURIComponent(sourceRecord.workflowId)}`,
      label: 'Open workflow',
    });
  }
  if (sourceRecord.memoryId) {
    actions.push({
      href: '/operations/memory',
      label: 'Open memories',
    });
  }
  if (sourceRecord.agentId) {
    actions.push({
      href: '/agents',
      label: 'Open agents',
    });
  }
  return actions;
}

function sourceRecordIdsForNode(node: SigmaGraphNode) {
  const data = node.data || {};
  const sourceRecordId = stringValue(node.metadata?.source_record_id);
  const executionId =
    stringValue(data.execution_id) ||
    stringValue(data.executionId) ||
    (node.type === 'Run' || node.type === 'WorkflowRun'
      ? sourceRecordId || node.id.replace(/^run:/, '')
      : undefined);
  const workflowId =
    stringValue(data.workflow_id) ||
    stringValue(data.workflowId) ||
    (node.type === 'Workflow' ? sourceRecordId || node.id.replace(/^workflow:/, '') : undefined);
  const memoryId =
    stringValue(data.memory_id) ||
    stringValue(data.memoryId) ||
    stringValue(data.source_memory_id) ||
    (node.type === 'Memory' ? sourceRecordId || node.id.replace(/^memory:/, '') : undefined);
  const agentId =
    stringValue(data.agent_id) ||
    stringValue(data.agentId) ||
    (node.type === 'Agent' ? sourceRecordId || node.id.replace(/^agent:/, '') : undefined);
  const documentId =
    stringValue(data.document_id) ||
    stringValue(data.documentId) ||
    (node.type === 'Document' ? sourceRecordId || node.id.replace(/^document:/, '') : undefined);
  return { agentId, documentId, executionId, memoryId, workflowId };
}

function mergeAgencyGraphDocuments(
  first?: SigmaGraphDocument | null,
  second?: SigmaGraphDocument | null
): SigmaGraphDocument | null {
  const documents = [first, second].filter((document): document is SigmaGraphDocument =>
    Boolean(document?.nodes.length)
  );
  if (documents.length === 0) {
    return null;
  }
  const nodes = new Map<string, SigmaGraphNode>();
  const edges = new Map<string, SigmaGraphEdge>();
  const metadata = documents.reduce(
    (combined, document) => ({
      ...combined,
      original_edge_count:
        (numberValue(combined.original_edge_count) || 0) +
        (numberValue(document.metadata?.original_edge_count) || document.edges.length),
      original_event_count:
        (numberValue(combined.original_event_count) || 0) +
        (numberValue(document.metadata?.original_event_count) || 0),
      original_node_count:
        (numberValue(combined.original_node_count) || 0) +
        (numberValue(document.metadata?.original_node_count) || document.nodes.length),
      truncated: Boolean(combined.truncated) || Boolean(document.metadata?.truncated),
      event_truncated:
        Boolean(combined.event_truncated) || Boolean(document.metadata?.event_truncated),
      performance_truncated:
        Boolean(combined.performance_truncated) ||
        Boolean(document.metadata?.performance_truncated),
    }),
    {} as SigmaGraphJsonObject
  );
  const projectedSourceKeys = new Set<string>();
  for (const node of first?.nodes || []) {
    const key = agencyGraphNodeSourceKey(node);
    if (key) {
      projectedSourceKeys.add(key);
    }
  }
  for (const document of documents) {
    for (const node of document.nodes) {
      const sourceKey = agencyGraphNodeSourceKey(node);
      if (document === second && sourceKey && projectedSourceKeys.has(sourceKey)) {
        continue;
      }
      nodes.set(node.id, node);
    }
    for (const edge of document.edges) {
      edges.set(edge.id, edge);
    }
  }
  return {
    schemaVersion: 'sigma.graph.document.v1',
    id: 'agency-graph-all-roots',
    title: 'All Agency graph roots',
    nodes: [...nodes.values()],
    edges: [...edges.values()].filter((edge) => nodes.has(edge.source) && nodes.has(edge.target)),
    metadata: {
      ...metadata,
      projection_mode: 'combined-roots',
      root_type: 'all',
      source_count: documents.length,
    },
  };
}

function agencyGraphNodeSourceKey(node: SigmaGraphNode) {
  const sourceRecordId =
    stringValue(node.metadata?.source_record_id) ||
    stringValue(node.data?.source_record_id) ||
    stringValue(node.data?.id) ||
    node.id.replace(/^(run|workflow|memory|agent|entity|document|error):/, '');
  return sourceRecordId ? `${agencyGraphNodeCategory(node.type)}:${sourceRecordId}` : undefined;
}

function applyCondensedEventVisibility(document: SigmaGraphDocument): SigmaGraphDocument {
  const nodes = document.nodes.filter((node) => !isCondensedEventNode(node));
  const visibleNodeIds = new Set(nodes.map((node) => node.id));
  return {
    ...document,
    nodes,
    edges: document.edges.filter(
      (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    ),
    metadata: {
      ...(document.metadata || {}),
      condensed_event_count: document.nodes.length - nodes.length,
    },
  };
}

function applyAgencyGraphPerformanceBudget(
  document: SigmaGraphDocument,
  budget: AgencyGraphPerformanceBudget
): SigmaGraphDocument {
  const originalNodeCount = document.nodes.length;
  const originalEdgeCount = document.edges.length;
  const indexedNodes = document.nodes.map((node, index) => ({ index, node }));
  const keptNodeEntries =
    indexedNodes.length > budget.defaultMaxNodes
      ? [...indexedNodes]
          .sort(
            (left, right) =>
              nodeBudgetPriority(right.node) - nodeBudgetPriority(left.node) ||
              left.index - right.index
          )
          .slice(0, budget.defaultMaxNodes)
          .sort((left, right) => left.index - right.index)
      : indexedNodes;
  const visibleNodeIds = new Set(keptNodeEntries.map((entry) => entry.node.id));
  const candidateEdges = document.edges
    .map((edge, index) => ({ edge, index }))
    .filter(
      (entry) => visibleNodeIds.has(entry.edge.source) && visibleNodeIds.has(entry.edge.target)
    );
  const keptEdgeEntries =
    candidateEdges.length > budget.defaultMaxEdges
      ? [...candidateEdges]
          .sort(
            (left, right) =>
              edgeBudgetPriority(right.edge) - edgeBudgetPriority(left.edge) ||
              left.index - right.index
          )
          .slice(0, budget.defaultMaxEdges)
          .sort((left, right) => left.index - right.index)
      : candidateEdges;
  const nodeTruncated = keptNodeEntries.length < originalNodeCount;
  const edgeTruncated = keptEdgeEntries.length < originalEdgeCount;

  return {
    ...document,
    nodes: keptNodeEntries.map(({ node }) => ({
      ...node,
      label: truncateGraphLabel(node.label, budget.maxLabelLength),
    })),
    edges: keptEdgeEntries.map(({ edge }) => ({
      ...edge,
      label: edge.label ? truncateGraphLabel(edge.label, budget.maxLabelLength) : edge.label,
    })),
    metadata: {
      ...(document.metadata || {}),
      edge_budget: budget.defaultMaxEdges,
      event_budget: budget.maxEventNodesPerRun,
      label_budget: budget.maxLabelLength,
      node_budget: budget.defaultMaxNodes,
      original_edge_count: originalEdgeCount,
      original_node_count: originalNodeCount,
      performance_truncated:
        Boolean(document.metadata?.truncated) ||
        Boolean(document.metadata?.event_truncated) ||
        nodeTruncated ||
        edgeTruncated,
      rendered_edge_count: keptEdgeEntries.length,
      rendered_node_count: keptNodeEntries.length,
    },
  };
}

function graphBudgetSummaryForDocument(document: SigmaGraphDocument) {
  const originalNodes =
    numberValue(document.metadata?.original_node_count) || document.nodes.length;
  const originalEdges =
    numberValue(document.metadata?.original_edge_count) || document.edges.length;
  const isTruncated =
    Boolean(document.metadata?.truncated) ||
    Boolean(document.metadata?.event_truncated) ||
    Boolean(document.metadata?.performance_truncated) ||
    document.nodes.length < originalNodes ||
    document.edges.length < originalEdges;
  return {
    description: `Showing ${formatNumber(document.nodes.length)} of ${formatNumber(
      originalNodes
    )} nodes and ${formatNumber(document.edges.length)} of ${formatNumber(originalEdges)} edges.`,
    isTruncated,
    label: `Truncated to ${formatNumber(document.nodes.length)} nodes`,
  };
}

function agencyGraphCoverageSummary({
  document,
  recentExecutions,
  rootType,
  selectedExecution,
  workflowExecutions,
}: {
  document: SigmaGraphDocument;
  recentExecutions: ExecutionRecord[];
  rootType: AgencyGraphRootType;
  selectedExecution?: ExecutionRecord;
  workflowExecutions: ExecutionRecord[];
}) {
  const expectedExecutions =
    rootType === 'all'
      ? recentExecutions
      : rootType === 'workflow'
        ? workflowExecutions
        : rootType === 'run' && selectedExecution
          ? [selectedExecution]
          : [];
  const expectedExecutionIds = new Set(expectedExecutions.map((execution) => execution.id));
  // Coverage badges should answer whether the expected execution records survived projection,
  // filtering, and budgets. Counting arbitrary Run nodes can be inflated by unrelated backend
  // neighborhoods, so match by canonical fallback IDs and backend source identifiers instead.
  const renderedExecutionIds = new Set(
    document.nodes
      .filter((node) => node.type === 'Run' || node.type === 'WorkflowRun')
      .flatMap((node) => executionIdsForRunNode(node))
      .filter((id) => expectedExecutionIds.has(id))
  );
  const renderedWorkflows = document.nodes.filter((node) => node.type === 'Workflow').length;
  const renderedIssues = document.nodes.filter(
    (node) => agencyGraphNodeCategory(node.type) === 'Issue'
  ).length;

  return {
    expectedRuns: expectedExecutions.length,
    renderedIssues,
    renderedRuns: renderedExecutionIds.size,
    renderedWorkflows,
  };
}

function executionIdsForRunNode(node: SigmaGraphNode) {
  const ids = new Set<string>();
  const nodeId = node.id.startsWith('run:') ? node.id.slice('run:'.length) : node.id;
  if (nodeId) {
    ids.add(nodeId);
  }
  const dataId = stringValue(node.data?.id);
  if (dataId) {
    ids.add(dataId);
  }
  const sourceRecordId = stringValue(node.metadata?.source_record_id);
  if (sourceRecordId) {
    ids.add(sourceRecordId);
  }
  return [...ids];
}

function nodeBudgetPriority(node: SigmaGraphNode) {
  const status = stringValue(node.data?.status)?.toLowerCase();
  const severity = nodeSeverityValue(node);
  let score = 0;
  if (node.metadata?.agencyGraphRoot === true || node.data?.root === true) {
    score += 100;
  }
  if (['failed', 'error', 'cancelled'].includes(status || '')) {
    score += 80;
  }
  if (['critical', 'error', 'warning'].includes(severity || '')) {
    score += 60;
  }
  if (node.type === 'Error' || node.type === 'Finding' || node.type === 'IncidentCluster') {
    score += 60;
  }
  if (
    node.type === 'Run' ||
    node.type === 'WorkflowRun' ||
    node.type === 'Workflow' ||
    node.type === 'WorkflowHealth' ||
    node.type === 'WorkflowRunWindow' ||
    node.type === 'RunStatusBucket'
  ) {
    score += 45;
  }
  if (node.type === 'StepRun' || node.type === 'Task' || node.type === 'Agent') {
    score += 24;
  }
  if (agencyGraphNodeCategory(node.type) !== 'Event') {
    score += 30;
  }
  score += numberValue(node.size) || 0;
  return score;
}

function edgeBudgetPriority(edge: SigmaGraphEdge) {
  if (['FAILED_WITH', 'HAS_STEP_RUN', 'SOURCE_EXECUTION', 'SOURCE_DOCUMENT'].includes(edge.type)) {
    return 50;
  }
  if (['STARTED', 'TRIGGERED', 'PARTICIPATED_IN'].includes(edge.type)) {
    return 30;
  }
  return numberValue(edge.size) || 0;
}

function limitExecutionEventsForGraph(events: ExecutionEventRecord[], limit: number) {
  if (events.length <= limit) {
    return events;
  }
  const orderedEvents = [...events].sort(
    (left, right) =>
      (numberValue(left.sequence) || 0) - (numberValue(right.sequence) || 0) ||
      timestampValue(left.timestamp) - timestampValue(right.timestamp)
  );
  const selected = new Map<string, ExecutionEventRecord>();
  const addEvent = (event: ExecutionEventRecord | undefined) => {
    if (event && selected.size < limit) {
      selected.set(event.id, event);
    }
  };
  for (const event of orderedEvents) {
    const status = stringValue(event.status)?.toLowerCase();
    const eventType = event.event_type.toLowerCase();
    if (status === 'failed' || status === 'error' || eventType.includes('error')) {
      addEvent(event);
    }
  }
  const edgeSampleSize = Math.max(1, Math.floor(limit * 0.25));
  for (const event of orderedEvents.slice(0, edgeSampleSize)) {
    addEvent(event);
  }
  for (const event of orderedEvents.slice(-edgeSampleSize)) {
    addEvent(event);
  }
  const step = Math.max(1, Math.floor(orderedEvents.length / limit));
  for (let index = 0; selected.size < limit && index < orderedEvents.length; index += step) {
    addEvent(orderedEvents[index]);
  }
  for (const event of orderedEvents) {
    if (selected.size >= limit) {
      break;
    }
    addEvent(event);
  }
  return [...selected.values()].sort(
    (left, right) =>
      (numberValue(left.sequence) || 0) - (numberValue(right.sequence) || 0) ||
      timestampValue(left.timestamp) - timestampValue(right.timestamp)
  );
}

function truncateGraphLabel(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 3))}...` : value;
}

function agencyGraphVisualLegend(document: SigmaGraphDocument): AgencyGraphVisualLegendData {
  const nodeTypeCounts = new Map<string, { color: string; count: number; label: string }>();
  const statusCounts = new Map<string, { color: string; count: number; label: string }>();
  const edgeToneCounts = new Map<
    string,
    { color: string; count: number; label: string; style: string }
  >();

  for (const node of document.nodes) {
    const category = agencyGraphNodeCategory(node.type);
    const typeColor =
      stringValue(node.metadata?.agencyGraphTypeColor) || agencyGraphNodeCategoryColor(category);
    const typeEntry = nodeTypeCounts.get(category) || {
      color: typeColor,
      count: 0,
      label: category,
    };
    typeEntry.count += 1;
    nodeTypeCounts.set(category, typeEntry);

    const status = stringValue(node.data?.status);
    const statusColor = stringValue(node.metadata?.agencyGraphStatusRingColor);
    if (status && statusColor) {
      const statusLabelText = statusLabel(status);
      const statusEntry = statusCounts.get(statusLabelText) || {
        color: statusColor,
        count: 0,
        label: statusLabelText,
      };
      statusEntry.count += 1;
      statusCounts.set(statusLabelText, statusEntry);
    }
  }

  for (const edge of document.edges) {
    const tone = stringValue(edge.metadata?.agencyGraphEdgeTone) || 'default';
    const style = stringValue(edge.metadata?.agencyGraphEdgeStyle) || 'solid';
    const entry = edgeToneCounts.get(tone) || {
      color: edge.color || '#64748b',
      count: 0,
      label: humanizeIdentifier(tone) || 'Default',
      style,
    };
    entry.count += 1;
    edgeToneCounts.set(tone, entry);
  }

  return {
    edgeTones: topLegendItems(edgeToneCounts, 4),
    nodeTypes: topLegendItems(nodeTypeCounts, 8),
    statuses: topLegendItems(statusCounts, 4),
  };
}

function topLegendItems(
  items: Map<string, { color: string; count: number; label: string; style?: string }>,
  limit: number
): AgencyGraphLegendItem[] {
  return [...items.values()]
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, limit);
}

function timestampRowsForNode(node: SigmaGraphNode) {
  return [
    {
      label: 'Started',
      value: formatDateTime(node.startedAt || stringValue(node.data?.started_at)),
    },
    { label: 'Ended', value: formatDateTime(node.endedAt || stringValue(node.data?.ended_at)) },
    { label: 'Created', value: formatDateTime(stringValue(node.data?.created_at)) },
    { label: 'Last seen', value: formatDateTime(stringValue(node.data?.last_seen_at)) },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value));
}

function relationshipsForNode(
  node: SigmaGraphNode,
  edges: SigmaGraphEdge[],
  nodeLookup: Map<string, SigmaGraphNode>
): AgencyGraphNodeRelationship[] {
  const groups = new Map<string, AgencyGraphNodeRelationship['records']>();
  for (const edge of edges) {
    if (edge.source !== node.id && edge.target !== node.id) {
      continue;
    }
    const otherNodeId = edge.source === node.id ? edge.target : edge.source;
    const otherNode = nodeLookup.get(otherNodeId);
    const direction = edge.source === node.id ? 'To' : 'From';
    const records = groups.get(edge.type) || [];
    records.push({
      direction,
      id: edge.id,
      label: otherNode
        ? `${otherNode.label} (${agencyGraphNodeCategory(otherNode.type)})`
        : otherNodeId,
    });
    groups.set(edge.type, records);
  }
  return [...groups.entries()]
    .map(([type, records]) => ({ records, type }))
    .sort((left, right) => left.type.localeCompare(right.type));
}

function condensedEventsForNode(
  node: SigmaGraphNode,
  document: SigmaGraphDocument
): AgencyGraphCondensedEventGroup[] {
  const eventNodeIds = new Set(
    document.nodes.filter((candidate) => isCondensedEventNode(candidate)).map((event) => event.id)
  );
  if (eventNodeIds.size === 0) {
    return [];
  }

  const runNodeIds = new Set<string>();
  const matchedEventIds = new Set<string>();
  if (node.type === 'Run' || node.type === 'WorkflowRun') {
    runNodeIds.add(node.id);
  }

  for (const edge of document.edges) {
    if (edge.source === node.id && eventNodeIds.has(edge.target)) {
      matchedEventIds.add(edge.target);
    }
    if (edge.target === node.id && eventNodeIds.has(edge.source)) {
      matchedEventIds.add(edge.source);
    }
    if (
      edge.source === node.id &&
      ['STARTED', 'TRIGGERED', 'PARTICIPATED_IN', 'OCCURRED_IN'].includes(edge.type)
    ) {
      runNodeIds.add(edge.target);
    }
    if (
      edge.target === node.id &&
      ['CREATED_CONTAINER', 'USED_RUNTIME', 'PRODUCED_ARTIFACT', 'OCCURRED_IN'].includes(edge.type)
    ) {
      runNodeIds.add(edge.source);
    }
  }

  for (const edge of document.edges) {
    if (
      edge.type === 'EMITTED_EVENT' &&
      runNodeIds.has(edge.source) &&
      eventNodeIds.has(edge.target)
    ) {
      matchedEventIds.add(edge.target);
    }
  }

  const nodeReferences = graphNodeReferenceValues(node);
  const groups = new Map<
    string,
    {
      count: number;
      examples: string[];
      latestTimestamp: number;
      statuses: Set<string>;
    }
  >();
  for (const event of document.nodes) {
    if (!eventNodeIds.has(event.id)) {
      continue;
    }
    if (!matchedEventIds.has(event.id) && !eventReferencesNode(event, node, nodeReferences)) {
      continue;
    }
    const label =
      stringValue(event.data?.event_type) || event.clusterId || event.label || event.type;
    const entry = groups.get(label) || {
      count: 0,
      examples: [],
      latestTimestamp: 0,
      statuses: new Set<string>(),
    };
    entry.count += 1;
    const status = statusBadgeValue(event);
    if (status) {
      entry.statuses.add(status);
    }
    const timestamp = timestampValue(
      event.startedAt || event.endedAt || stringValue(event.data?.timestamp)
    );
    entry.latestTimestamp = Math.max(entry.latestTimestamp, timestamp);
    if (entry.examples.length < 3) {
      const sequence = numberValue(event.data?.sequence);
      entry.examples.push(sequence !== undefined ? `#${sequence}` : event.label);
    }
    groups.set(label, entry);
  }

  return [...groups.entries()]
    .map(([label, group]) => ({
      count: group.count,
      examples: group.examples,
      label: humanizeIdentifier(label) || label,
      latest:
        group.latestTimestamp > 0
          ? formatDateTime(new Date(group.latestTimestamp).toISOString())
          : undefined,
      statuses: [...group.statuses].sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function eventDetailsForSelectedNode(
  node: SigmaGraphNode,
  events: ExecutionEventRecord[]
): SigmaGraphJsonObject | undefined {
  if (agencyGraphNodeCategory(node.type) !== 'Event') {
    return undefined;
  }
  const eventId =
    stringValue(node.data?.id) ||
    stringValue(node.metadata?.source_record_id) ||
    node.id.replace(/^execution-event:/, '');
  const event = events.find((candidate) => candidate.id === eventId);
  if (!event) {
    return undefined;
  }
  return compactInspectorObject({
    payload: event.payload,
    metrics: event.metrics,
  });
}

function graphNodeReferenceValues(node: SigmaGraphNode) {
  const values = new Set<string>([node.id]);
  for (const value of [
    node.metadata?.source_record_id,
    node.data?.id,
    node.data?.agent_id,
    node.data?.agentId,
    node.data?.task_id,
    node.data?.taskId,
    node.data?.tool_call_id,
    node.data?.toolCallId,
    node.data?.model_request_id,
    node.data?.modelRequestId,
  ]) {
    const string = stringValue(value);
    if (string) {
      values.add(string);
    }
  }
  return values;
}

function eventReferencesNode(
  event: SigmaGraphNode,
  node: SigmaGraphNode,
  nodeReferences: Set<string>
) {
  if (node.type === 'RuntimeContainer') {
    return stringValue(event.data?.event_type)?.startsWith('container.') || false;
  }
  for (const value of [
    event.data?.agent_id,
    event.data?.agentId,
    event.data?.task_id,
    event.data?.taskId,
    event.data?.tool_call_id,
    event.data?.toolCallId,
    event.data?.model_request_id,
    event.data?.modelRequestId,
  ]) {
    const string = stringValue(value);
    if (string && nodeReferences.has(string)) {
      return true;
    }
  }
  return false;
}

function applyAgencyGraphVisualEncoding(
  document: SigmaGraphDocument,
  options: { colorMode: AgencyGraphColorMode }
): SigmaGraphDocument {
  const edgeCountByNodeId = new Map<string, number>();
  const eventCountByNodeId = new Map<string, number>();
  for (const edge of document.edges) {
    edgeCountByNodeId.set(edge.source, (edgeCountByNodeId.get(edge.source) || 0) + 1);
    edgeCountByNodeId.set(edge.target, (edgeCountByNodeId.get(edge.target) || 0) + 1);
    if (edge.type === 'EMITTED_EVENT') {
      eventCountByNodeId.set(edge.source, (eventCountByNodeId.get(edge.source) || 0) + 1);
    }
  }

  return {
    ...document,
    edges: document.edges.map((edge) => applyAgencyGraphEdgeVisualEncoding(edge, options)),
    nodes: document.nodes.map((node) =>
      applyAgencyGraphNodeVisualEncoding({
        edgeCount: edgeCountByNodeId.get(node.id) || 0,
        eventCount: eventCountByNodeId.get(node.id) || 0,
        node,
        options,
      })
    ),
  };
}

function applyAgencyGraphNodeVisualEncoding({
  edgeCount,
  eventCount,
  node,
  options,
}: {
  edgeCount: number;
  eventCount: number;
  node: SigmaGraphNode;
  options: { colorMode: AgencyGraphColorMode };
}): SigmaGraphNode {
  const category = agencyGraphNodeCategory(node.type);
  const typeColor = agencyGraphNodeCategoryColor(category);
  const clusterColor = agencyGraphClusterColor(node);
  const warningColor = agencyGraphWarningColor(node);
  const costColor = agencyGraphCostColor(node);
  const statusRingColor = agencyGraphStatusRingColor(node);
  const statusColor = statusRingColor || warningColor || typeColor;
  const baseSize = agencyGraphNodeBaseSize(node.type, node.size);
  const relationshipBoost = Math.min(edgeCount * 0.55, 4);
  const eventBoost = Math.min(eventCount * 0.25, 5);
  const costBoost = costColor ? 2 : 0;
  const warningBoost = warningColor ? 1.5 : 0;
  const activeNodeColor =
    options.colorMode === 'obsidian'
      ? '#d4d4d8'
      : options.colorMode === 'status'
        ? statusColor
        : options.colorMode === 'cluster'
          ? clusterColor
          : warningColor || costColor || node.color || typeColor;
  return {
    ...node,
    color: activeNodeColor,
    size: Math.max(
      node.size || 1,
      baseSize + relationshipBoost + eventBoost + costBoost + warningBoost
    ),
    metadata: {
      ...(node.metadata || {}),
      agencyGraphCostIntensity: costColor ? agencyGraphCostIntensity(node) : 0,
      agencyGraphNodeCategory: category,
      agencyGraphRawNodeType: node.type,
      agencyGraphClusterColor: clusterColor,
      agencyGraphStatusRingColor: statusRingColor || '',
      agencyGraphTypeColor: typeColor,
      agencyGraphVisualEncoding: true,
      agencyGraphWarningColor: warningColor || '',
    },
  };
}

function applyAgencyGraphEdgeVisualEncoding(
  edge: SigmaGraphEdge,
  options: { colorMode: AgencyGraphColorMode }
): SigmaGraphEdge {
  const edgeStyle = agencyGraphEdgeStyle(edge.type);
  return {
    ...edge,
    color: options.colorMode === 'obsidian' ? '#52525b' : edge.color || edgeStyle.color,
    size: Math.max(edge.size || 1, edgeStyle.size),
    metadata: {
      ...(edge.metadata || {}),
      agencyGraphEdgeStyle: edgeStyle.style,
      agencyGraphEdgeTone: edgeStyle.tone,
      agencyGraphVisualEncoding: true,
    },
  };
}

function agencyGraphNodeCategory(type: string) {
  const categoryByType: Record<string, string> = {
    Agent: 'Agent',
    ApprovalRequest: 'Issue',
    Artifact: 'Tooling',
    Constraint: 'Knowledge',
    ContainerEvent: 'Event',
    ContextPack: 'Knowledge',
    Conversation: 'Knowledge',
    Credential: 'Tooling',
    Decision: 'Knowledge',
    Document: 'Knowledge',
    DocumentChunk: 'Knowledge',
    Entity: 'Knowledge',
    Error: 'Issue',
    ExecutionEvent: 'Event',
    Finding: 'Issue',
    IncidentCluster: 'Issue',
    Integration: 'Tooling',
    Memory: 'Knowledge',
    Message: 'Knowledge',
    Model: 'Tooling',
    ModelProvider: 'Tooling',
    ModelRequest: 'Tooling',
    OpenQuestion: 'Knowledge',
    Run: 'Run',
    RunStatusBucket: 'Run',
    RuntimeContainer: 'Tooling',
    RuntimeRevision: 'Tooling',
    Schedule: 'Workflow',
    StepRun: 'Run',
    Task: 'Run',
    Tool: 'Tooling',
    ToolCall: 'Tooling',
    User: 'Agent',
    Workflow: 'Workflow',
    WorkflowHealth: 'Workflow',
    WorkflowRun: 'Run',
    WorkflowRunWindow: 'Run',
    WorkflowVersion: 'Workflow',
  };
  return categoryByType[type] || 'Other';
}

function isCondensedEventNode(node: SigmaGraphNode) {
  return agencyGraphNodeCategory(node.type) === 'Event';
}

function agencyGraphNodeCategoryColor(category: string) {
  const palette: Record<string, string> = {
    Agent: '#0f766e',
    Event: '#64748b',
    Issue: '#dc2626',
    Knowledge: '#2563eb',
    Other: '#64748b',
    Run: '#16a34a',
    Tooling: '#9333ea',
    Workflow: '#ca8a04',
  };
  return palette[category] || palette.Other;
}

function agencyGraphClusterColor(node: SigmaGraphNode) {
  const clusterKey =
    node.clusterId ||
    stringValue(node.metadata?.source_record_id) ||
    stringValue(node.metadata?.agencyGraphNodeCategory) ||
    node.type;
  const palette = ['#f59e0b', '#38bdf8', '#34d399', '#fb7185', '#c084fc', '#f97316', '#2dd4bf'];
  const index =
    Math.abs(
      [...String(clusterKey)].reduce((total, character) => total + character.charCodeAt(0), 0)
    ) % palette.length;
  return palette[index];
}

function agencyGraphNodeBaseSize(type: string, currentSize?: number) {
  const baseByType: Record<string, number> = {
    Agent: 11,
    Artifact: 8,
    ContainerEvent: 7,
    Document: 10,
    Entity: 10,
    Error: 12,
    ExecutionEvent: 7,
    IncidentCluster: 15,
    Memory: 11,
    ModelRequest: 8,
    Run: 13,
    RunStatusBucket: 12,
    RuntimeContainer: 9,
    Schedule: 9,
    Task: 9,
    ToolCall: 8,
    Workflow: 13,
    WorkflowHealth: 14,
    WorkflowRun: 13,
    WorkflowRunWindow: 11,
  };
  return Math.max(currentSize || 1, baseByType[type] || 8);
}

function agencyGraphStatusRingColor(node: SigmaGraphNode) {
  const status = stringValue(node.data?.status)?.toLowerCase();
  const severity = stringValue(node.data?.severity)?.toLowerCase();
  if (status === 'failed' || status === 'error' || severity === 'critical') {
    return '#dc2626';
  }
  if (
    status === 'running' ||
    status === 'pending' ||
    status === 'unavailable' ||
    severity === 'warning'
  ) {
    return '#f59e0b';
  }
  if (status === 'completed' || status === 'success' || status === 'active') {
    return '#16a34a';
  }
  if (status === 'cancelled' || status === 'canceled' || status === 'inactive') {
    return '#64748b';
  }
  return undefined;
}

function agencyGraphWarningColor(node: SigmaGraphNode) {
  const status = stringValue(node.data?.status)?.toLowerCase();
  const severity = stringValue(node.data?.severity)?.toLowerCase();
  if (
    node.type === 'Error' ||
    status === 'failed' ||
    status === 'error' ||
    severity === 'critical'
  ) {
    return '#dc2626';
  }
  if (
    status === 'unavailable' ||
    severity === 'warning' ||
    node.data?.missing_embedding === true ||
    node.data?.stale === true
  ) {
    return '#f59e0b';
  }
  if (node.data?.deleted === true || status === 'deleted') {
    return '#64748b';
  }
  return undefined;
}

function agencyGraphCostIntensity(node: SigmaGraphNode) {
  const cost =
    numberValue(node.data?.cost_estimate) ||
    numberValue(node.data?.costEstimate) ||
    numberValue(node.data?.estimated_cost_usd) ||
    0;
  const tokens = numberValue(node.data?.token_count) || numberValue(node.data?.tokenCount) || 0;
  if (cost >= 5 || tokens >= 100000) {
    return 3;
  }
  if (cost >= 1 || tokens >= 25000) {
    return 2;
  }
  if (cost > 0 || tokens >= 5000) {
    return 1;
  }
  return 0;
}

function agencyGraphCostColor(node: SigmaGraphNode) {
  const intensity = agencyGraphCostIntensity(node);
  if (intensity >= 3) {
    return '#be123c';
  }
  if (intensity === 2) {
    return '#ea580c';
  }
  if (intensity === 1) {
    return '#ca8a04';
  }
  return undefined;
}

function agencyGraphEdgeStyle(type: string) {
  if (
    [
      'CREATED_MEMORY',
      'DERIVED_FROM',
      'SOURCE_CONVERSATION',
      'SOURCE_DOCUMENT',
      'SOURCE_EXECUTION',
      'SUPERSEDES',
    ].includes(type)
  ) {
    return { color: '#4f46e5', size: 2, style: 'dashed', tone: 'lineage' };
  }
  if (
    [
      'CREATED_CONTAINER',
      'EMITTED_EVENT',
      'FOLLOWED_BY',
      'HAS_HEALTH',
      'HAS_STATUS_BUCKET',
      'HAS_TIME_WINDOW',
      'HAS_STEP_RUN',
      'OCCURRED_IN',
      'PARENT_OF',
      'STARTED',
      'TRIGGERED',
      'USED_RUNTIME',
    ].includes(type)
  ) {
    return { color: '#0f766e', size: 1.6, style: 'solid', tone: 'operational' };
  }
  if (['FAILED_WITH', 'HAS_INCIDENT'].includes(type)) {
    return { color: '#dc2626', size: 2.5, style: 'solid', tone: 'warning' };
  }
  if (['USED_MODEL', 'USED_PROVIDER'].includes(type)) {
    return { color: '#ea580c', size: 2, style: 'solid', tone: 'cost' };
  }
  if (['HAS_APPROVAL', 'USES_INTEGRATION', 'AVAILABLE_TO'].includes(type)) {
    return { color: '#be123c', size: 2, style: 'dotted', tone: 'governance' };
  }
  if (
    ['CONSTRAINS', 'HAS_CHUNK', 'MENTIONS', 'RAISED_QUESTION', 'SUPPORTS_DECISION'].includes(type)
  ) {
    return { color: '#0891b2', size: 1.5, style: 'solid', tone: 'knowledge' };
  }
  return { color: '#64748b', size: 1, style: 'solid', tone: 'default' };
}

function healthWarningsForNode(node: SigmaGraphNode) {
  const data = node.data || {};
  const warnings: string[] = [];
  const status = stringValue(data.status)?.toLowerCase();
  const severity = stringValue(data.severity)?.toLowerCase();
  const error = stringValue(data.error) || stringValue(data.error_message);

  if (node.type === 'Error') {
    warnings.push('Error node');
  }
  if (status && ['cancelled', 'error', 'failed', 'unavailable'].includes(status)) {
    warnings.push(`Status: ${statusLabel(status)}`);
  }
  if (severity && ['critical', 'error', 'high', 'warning'].includes(severity)) {
    warnings.push(`Severity: ${statusLabel(severity)}`);
  }
  if (data.stale === true) {
    warnings.push('Stale context');
  }
  if (data.missing_embedding === true || data.missingEmbedding === true) {
    warnings.push('Missing embedding');
  }
  if (data.sensitive === true || data.contains_sensitive_data === true) {
    warnings.push('Sensitive data');
  }
  if (data.deleted === true) {
    warnings.push('Deleted or soft-deleted record');
  }
  if (data.projection_available === false || data.projectionAvailable === false) {
    warnings.push('Projection unavailable');
  }
  if (error) {
    warnings.push(error.length > 120 ? `${error.slice(0, 117)}...` : error);
  }

  return [...new Set(warnings)];
}

function costRowsForNode(node: SigmaGraphNode) {
  const data = node.data || {};
  return [
    { label: 'Cost', value: formatCurrency(numberValue(data.cost_estimate ?? data.costEstimate)) },
    { label: 'Cost USD', value: formatCurrency(numberValue(data.cost_usd ?? data.costUsd)) },
    { label: 'Tokens', value: formatNumber(numberValue(data.token_count ?? data.tokenCount)) },
    {
      label: 'Input tokens',
      value: formatNumber(numberValue(data.input_tokens ?? data.inputTokens)),
    },
    {
      label: 'Output tokens',
      value: formatNumber(numberValue(data.output_tokens ?? data.outputTokens)),
    },
    {
      label: 'Total tokens',
      value: formatNumber(numberValue(data.total_tokens ?? data.totalTokens)),
    },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value));
}

function createPlaceholderAgencyGraphDocument(label: string): SigmaGraphDocument {
  return {
    schemaVersion: 'sigma.graph.document.v1',
    id: 'memory-graph-placeholder',
    title: label,
    nodes: [
      {
        id: 'memory-graph-placeholder-node',
        type: 'AgencyGraph',
        label,
        size: 14,
        color: '#3b82f6',
        position: { x: 0, y: 0 },
        data: {
          state: 'placeholder',
        },
      },
    ],
    edges: [],
    metadata: {
      placeholder: true,
    },
  };
}

function sortExecutionsForGraph(executions: ExecutionRecord[]) {
  return [...executions].sort((left, right) => {
    if (left.status === 'failed' && right.status !== 'failed') {
      return -1;
    }
    if (right.status === 'failed' && left.status !== 'failed') {
      return 1;
    }
    return (
      timestampValue(right.created_at || right.started_at || right.updated_at) -
      timestampValue(left.created_at || left.started_at || left.updated_at)
    );
  });
}

function selectRecentExecutionsForGraphCoverage(executions: ExecutionRecord[], limit: number) {
  return selectExecutionsForCoverage(executions, limit, { preserveWorkflowDiversity: true });
}

function selectWorkflowExecutionsForGraphCoverage(executions: ExecutionRecord[], limit: number) {
  return selectExecutionsForCoverage(executions, limit, { preserveWorkflowDiversity: false });
}

function selectExecutionsForCoverage(
  executions: ExecutionRecord[],
  limit: number,
  options: { preserveWorkflowDiversity: boolean }
) {
  if (limit <= 0) {
    return [];
  }
  const recentExecutions = [...executions].sort(compareExecutionRecency);
  if (recentExecutions.length <= limit) {
    return recentExecutions;
  }

  const selected = new Map<string, ExecutionRecord>();
  const addExecution = (execution: ExecutionRecord) => {
    if (selected.size < limit) {
      selected.set(execution.id, execution);
    }
  };

  if (options.preserveWorkflowDiversity) {
    const seenWorkflowIds = new Set<string>();
    for (const execution of recentExecutions) {
      if (!execution.workflow_id || seenWorkflowIds.has(execution.workflow_id)) {
        continue;
      }
      addExecution(execution);
      seenWorkflowIds.add(execution.workflow_id);
      if (selected.size >= limit) {
        break;
      }
    }
  } else {
    const recentBaselineLimit = Math.max(1, Math.ceil(limit * 0.25));
    for (const execution of recentExecutions.slice(0, recentBaselineLimit)) {
      addExecution(execution);
    }
  }

  // Failed or errored runs are often the only breadcrumbs for incidents, so keep them before
  // filling the rest of the budget with routine successful executions.
  for (const execution of recentExecutions) {
    if (selected.size >= limit) {
      break;
    }
    if (isOperationallyImportantExecution(execution)) {
      addExecution(execution);
    }
  }

  for (const execution of recentExecutions) {
    if (selected.size >= limit) {
      break;
    }
    addExecution(execution);
  }

  return [...selected.values()].sort(compareExecutionRecency);
}

function compareExecutionRecency(left: ExecutionRecord, right: ExecutionRecord) {
  return executionTimestampValue(right) - executionTimestampValue(left);
}

function executionTimestampValue(execution: ExecutionRecord) {
  return timestampValue(
    execution.created_at || execution.started_at || execution.updated_at || execution.completed_at
  );
}

function isOperationallyImportantExecution(execution: ExecutionRecord) {
  const status = execution.status?.toLowerCase();
  return Boolean(execution.error) || status === 'failed' || status === 'error';
}

function workflowLookupFromDefinitions(workflows: WorkflowDefinition[]) {
  return new Map(
    workflows.map((workflow) => [
      workflow.id,
      {
        id: workflow.id,
        name: workflow.name?.trim() || humanizeIdentifier(workflow.id) || 'Workflow',
      },
    ])
  );
}

function workflowOptionsFromExecutions(
  executions: ExecutionRecord[],
  workflowLookup: Map<string, { id: string; name: string }>
) {
  const seen = new Set<string>();
  return executions.flatMap((execution) => {
    if (!execution.workflow_id || seen.has(execution.workflow_id)) {
      return [];
    }
    seen.add(execution.workflow_id);
    const status = statusLabel(execution.status);
    const createdAt = formatDateTime(execution.created_at);
    const workflowName =
      workflowLookup.get(execution.workflow_id)?.name ||
      humanizeIdentifier(execution.workflow_id) ||
      'Workflow';
    return [
      {
        id: execution.workflow_id,
        label: `${workflowName} - latest ${status}${createdAt ? ` - ${createdAt}` : ''}`,
      },
    ];
  });
}

function isManualRootType(rootType: AgencyGraphRootType): rootType is AgencyGraphManualRootType {
  return (
    rootType === 'agent' || rootType === 'entity' || rootType === 'document' || rootType === 'error'
  );
}

function selectedAgencyGraphRootLabel({
  execution,
  manualRootId,
  memoryId,
  rootOptions,
  rootType,
  workflowId,
  workflowOptions,
}: {
  execution?: ExecutionRecord;
  manualRootId: string;
  memoryId: string;
  rootOptions: AgencyGraphRootOption[];
  rootType: AgencyGraphRootType;
  workflowId: string;
  workflowOptions: { id: string; label: string }[];
}) {
  if (rootType === 'all') {
    return 'All root types';
  }
  if (rootType === 'run') {
    if (execution) {
      return runOptionLabel(execution, new Map());
    }
    return 'No run selected';
  }
  if (rootType === 'workflow') {
    return (
      workflowOptions.find((workflow) => workflow.id === workflowId)?.label ||
      'No workflow selected'
    );
  }
  if (isManualRootType(rootType)) {
    return manualRootId
      ? humanizeIdentifier(manualRootId) || `${rootTypeLabel(rootType)} root`
      : `No ${rootTypeLabel(rootType).toLowerCase()} selected`;
  }
  return rootOptions.find((option) => option.id === memoryId)?.label || 'No memory selected';
}

function rootTypeLabel(rootType: AgencyGraphRootType) {
  if (rootType === 'all') {
    return 'All';
  }
  if (rootType === 'run') {
    return 'Run';
  }
  if (rootType === 'workflow') {
    return 'Workflow';
  }
  if (rootType === 'agent') {
    return 'Agent';
  }
  if (rootType === 'entity') {
    return 'Entity';
  }
  if (rootType === 'document') {
    return 'Document';
  }
  if (rootType === 'error') {
    return 'Error';
  }
  return 'Memory';
}

function filterRootOptions<T extends { id: string; label: string }>(options: T[], query: string) {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) {
    return options;
  }
  return options.filter((option) => rootSearchMatches(cleanQuery, option.id, option.label));
}

function rootSearchMatches(query: string, id: string, label?: string) {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) {
    return true;
  }
  return [id, label].some((value) =>
    String(value || '')
      .toLowerCase()
      .includes(cleanQuery)
  );
}

function relationshipTypeLabel(type: string) {
  return humanizeIdentifier(type) || type;
}

function nodeIdsForRelationshipType(edges: SigmaGraphEdge[], relationshipType: string) {
  if (relationshipType === 'all') {
    return new Set<string>();
  }
  const nodeIds = new Set<string>();
  for (const edge of edges) {
    if (edge.type !== relationshipType) {
      continue;
    }
    nodeIds.add(edge.source);
    nodeIds.add(edge.target);
  }
  return nodeIds;
}

function nodeSeverityValue(node: SigmaGraphNode) {
  const severity = stringValue(node.data?.severity)?.toLowerCase();
  if (severity) {
    return severity;
  }
  const status = stringValue(node.data?.status)?.toLowerCase();
  if (status === 'failed' || status === 'error') {
    return 'error';
  }
  if (node.data?.missing_embedding === true || node.data?.stale === true) {
    return 'warning';
  }
  return undefined;
}

function runOptionLabel(
  execution: ExecutionRecord,
  workflowLookup: Map<string, { id: string; name: string }>
) {
  const createdAt = formatDateTime(execution.created_at);
  const status = statusLabel(execution.status);
  const workflow = execution.workflow_id
    ? workflowLookup.get(execution.workflow_id)?.name || humanizeIdentifier(execution.workflow_id)
    : undefined;
  const trigger = triggerLabel(execution);
  return [status ? `${status} run` : 'Run', workflow, trigger, createdAt]
    .filter(Boolean)
    .join(' - ');
}

function applyAgencyGraphDisplayLabels(
  document: SigmaGraphDocument,
  executions: ExecutionRecord[],
  workflowLookup: Map<string, { id: string; name: string }>
): SigmaGraphDocument {
  const executionLookup = new Map(executions.map((execution) => [execution.id, execution]));
  return {
    ...document,
    nodes: document.nodes.map((node) => ({
      ...node,
      label: displayLabelForNode(node, executionLookup, workflowLookup),
    })),
  };
}

function displayLabelForNode(
  node: SigmaGraphNode,
  executionLookup: Map<string, ExecutionRecord>,
  workflowLookup: Map<string, { id: string; name: string }>
) {
  if (node.type === 'WorkflowRun' || node.type === 'Run') {
    const execution =
      executionLookup.get(node.id) || executionLookup.get(String(node.data?.id || ''));
    if (execution) {
      return runOptionLabel(execution, workflowLookup);
    }
  }
  if (node.type === 'Workflow') {
    return workflowLookup.get(node.id)?.name || nonIdLabel(node.label, node.id) || 'Workflow';
  }
  if (node.type === 'StepRun') {
    const taskId = stringValue(node.data?.task_id) || stringValue(node.data?.taskId);
    const status = statusLabel(stringValue(node.data?.status));
    return [humanizeIdentifier(taskId) || nonIdLabel(node.label, node.id) || 'Step', status]
      .filter(Boolean)
      .join(' - ');
  }
  if (node.type === 'Agent') {
    const agentId = stringValue(node.data?.agent_id) || stringValue(node.data?.agentId) || node.id;
    return nonIdLabel(node.label, node.id) || humanizeIdentifier(agentId) || 'Agent';
  }
  if (node.type === 'Task') {
    const taskId = stringValue(node.data?.task_id) || stringValue(node.data?.taskId) || node.id;
    return nonIdLabel(node.label, node.id) || humanizeIdentifier(taskId) || 'Task';
  }
  return nonIdLabel(node.label, node.id) || humanizeIdentifier(node.id) || node.type;
}

function nonIdLabel(label: string | undefined, id: string) {
  if (!label || label === id || label.includes(id.slice(0, 8))) {
    return undefined;
  }
  return label;
}

function statusLabel(status?: string | null) {
  return status ? humanizeIdentifier(status) || status : 'Unknown';
}

function agencyGraphRealtimeStatusLabel(status: string) {
  if (status === 'open') {
    return 'Live';
  }
  if (status === 'connecting') {
    return 'Connecting live updates';
  }
  if (status === 'error') {
    return 'Live updates offline';
  }
  return 'Live updates closed';
}

function triggerLabel(execution: ExecutionRecord) {
  const scheduleId =
    execution.trigger_payload && typeof execution.trigger_payload === 'object'
      ? stringValue(execution.trigger_payload.schedule_id)
      : undefined;
  if (scheduleId) {
    return 'Scheduled';
  }
  return execution.trigger_type ? humanizeIdentifier(execution.trigger_type) : undefined;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function humanizeIdentifier(value?: string | null) {
  if (!value) {
    return undefined;
  }
  const normalized = value
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '')
    .replace(/[0-9a-f]{24,}/gi, '')
    .replace(/\b(workflow|execution|run|node|task|agent|edge|memory|document)\b/gi, '')
    .replace(/[_:./-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) {
    return undefined;
  }
  return normalized
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function compactInspectorObject(value: Record<string, unknown>): SigmaGraphJsonObject | undefined {
  const entries = Object.entries(value).filter(
    ([, item]) => item !== undefined && item !== null && item !== ''
  );
  if (entries.length === 0) {
    return undefined;
  }
  return Object.fromEntries(entries.map(([key, item]) => [key, inspectorJsonValue(item)]));
}

function inspectorJsonValue(value: unknown): SigmaGraphJsonValue {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
    return value as SigmaGraphJsonValue;
  }
  if (Array.isArray(value)) {
    return value.map(inspectorJsonValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        inspectorJsonValue(item),
      ])
    ) as SigmaGraphJsonObject;
  }
  return String(value);
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function formatNumber(value?: number) {
  return value === undefined ? undefined : new Intl.NumberFormat().format(value);
}

function formatCurrency(value?: number) {
  return value === undefined
    ? undefined
    : new Intl.NumberFormat(undefined, {
        currency: 'USD',
        maximumFractionDigits: 4,
        style: 'currency',
      }).format(value);
}

function timestampValue(value?: string | null) {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function agencyGraphEmptyState({
  graphStatus,
  graphStatusError,
  graphQueryError,
  hasGraphData,
  isGraphStatusLoading,
  isRootOptionsLoading,
  resolvedRootId,
  rootOptions,
  rootType,
  runEventsError,
  runStatusFilter,
  selectedExecution,
  totalRunCount,
}: {
  graphStatus?: Record<string, unknown>;
  graphStatusError?: unknown;
  graphQueryError: unknown;
  hasGraphData: boolean;
  isGraphStatusLoading: boolean;
  isRootOptionsLoading: boolean;
  resolvedRootId: string;
  rootOptions: AgencyGraphRootOption[];
  rootType: AgencyGraphRootType;
  runStatusFilter: AgencyGraphRunStatusFilter;
  runEventsError: unknown;
  selectedExecution?: ExecutionRecord;
  totalRunCount: number;
}) {
  if (hasGraphData) {
    return {
      title: 'Graph loaded',
      description: 'The selected graph has projected data.',
    };
  }
  if (isGraphStatusLoading) {
    return {
      title: 'Checking graph backend',
      description: 'The page is checking whether the graph projection backend is available.',
    };
  }
  if (
    (rootType === 'memory' || rootType === 'all') &&
    isRootOptionsLoading &&
    totalRunCount === 0
  ) {
    return {
      title: 'Loading memory roots',
      description: 'The page is loading active memories that can be used as graph roots.',
    };
  }
  if (graphStatusError) {
    return {
      title: 'Graph status unavailable',
      description:
        graphStatusError instanceof Error
          ? graphStatusError.message
          : 'The graph status endpoint did not return a usable response.',
    };
  }
  if (
    (rootType === 'memory' || rootType === 'all') &&
    rootOptions.length === 0 &&
    totalRunCount === 0
  ) {
    return {
      title: 'No active memories found',
      description:
        'The agency graph starts from active memories, but this user currently has no active memory roots.',
    };
  }
  if (isManualRootType(rootType) && !resolvedRootId) {
    const label = rootTypeLabel(rootType);
    return {
      title: `No ${label} root selected`,
      description: `Enter ${articleFor(label)} ${label} graph node id to load its Neo4j neighborhood.`,
    };
  }
  if (graphStatus?.enabled === false) {
    return {
      title: 'Graph backend disabled',
      description:
        'The backend reports that graph read is disabled. Run-event fallback can still show recent execution activity.',
    };
  }
  if (graphStatus?.available === false) {
    return {
      title: 'Graph backend unavailable',
      description:
        'The backend reports that Neo4j graph read is unavailable. Switch to Run roots to inspect execution events while projection is offline.',
    };
  }
  if (rootType === 'run' && runEventsError) {
    return {
      title: 'Run events unavailable',
      description:
        runEventsError instanceof Error
          ? runEventsError.message
          : 'The selected run events could not be loaded.',
    };
  }
  if (rootType === 'run' && !selectedExecution) {
    if (totalRunCount > 0 && runStatusFilter !== 'all') {
      return {
        title: 'No runs match this status',
        description: `There are execution records available, but none match the ${statusLabel(
          runStatusFilter
        )} filter.`,
      };
    }
    return {
      title: 'No runs found',
      description: 'There are no execution records available for event-derived graph fallback.',
    };
  }
  if (rootType === 'memory' && graphQueryError) {
    return {
      title: 'Graph request failed',
      description:
        graphQueryError instanceof Error
          ? graphQueryError.message
          : 'The graph read API did not return a memory projection.',
    };
  }
  if (graphQueryError) {
    return {
      title: 'Graph request failed',
      description:
        graphQueryError instanceof Error
          ? graphQueryError.message
          : `The graph read API did not return a ${rootTypeLabel(rootType)} projection.`,
    };
  }
  return {
    title: 'Graph returned zero nodes',
    description:
      rootType === 'run'
        ? 'The selected run loaded successfully, but no event-derived nodes were generated.'
        : `The selected ${rootTypeLabel(
            rootType
          ).toLowerCase()} loaded successfully, but the graph projection returned no nodes.`,
  };
}

function agencyGraphStatusIndicator({
  graphStatus,
  graphStatusError,
  hasGraphData,
  isGraphStatusLoading,
  runEventsError,
  supportsRunFallback,
}: {
  graphStatus?: Record<string, unknown>;
  graphStatusError?: unknown;
  hasGraphData: boolean;
  isGraphStatusLoading: boolean;
  runEventsError: unknown;
  supportsRunFallback: boolean;
}) {
  if (isGraphStatusLoading) {
    return {
      className: 'bg-sky-500',
      label: 'Checking graph status',
      description: 'The page is checking the graph backend.',
    };
  }
  if (graphStatusError) {
    return {
      className: 'bg-amber-500',
      label: 'Graph status unavailable',
      description:
        graphStatusError instanceof Error
          ? graphStatusError.message
          : 'The graph status endpoint did not return a usable response.',
    };
  }
  if (supportsRunFallback && runEventsError) {
    return {
      className: 'bg-amber-500',
      label: 'Run events unavailable',
      description:
        runEventsError instanceof Error
          ? runEventsError.message
          : 'The selected run events could not be loaded.',
    };
  }
  if (graphStatus?.enabled === false) {
    return {
      className: 'bg-red-500',
      label: 'Graph backend disabled',
      description: 'Neo4j graph read is disabled. Run-event fallback can still be used.',
    };
  }
  if (graphStatus?.available === false) {
    return {
      className: 'bg-amber-500',
      label: 'Graph backend unavailable',
      description: 'Neo4j graph read is unavailable. Run-event fallback can still be used.',
    };
  }
  if (hasGraphData) {
    return {
      className: 'bg-emerald-500',
      label: 'Graph data loaded',
      description: 'The selected graph has nodes available.',
    };
  }
  return {
    className: 'bg-neutral-400',
    label: 'Graph has no projected data',
    description: 'Open filters to choose a memory or run root.',
  };
}

function articleFor(value: string) {
  return /^[aeiou]/i.test(value) ? 'an' : 'a';
}

function PropertyList({
  properties,
  theme,
}: {
  properties: SigmaGraphJsonObject;
  theme: AgencyGraphCanvasTheme;
}) {
  const entries = Object.entries(properties).filter(
    ([, value]) => value !== null && value !== undefined
  );

  if (entries.length === 0) {
    return (
      <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
        No projected properties.
      </p>
    );
  }

  return (
    <dl
      className={`space-y-2 border-t pt-3 text-xs ${
        theme === 'light' ? 'border-sky-100/90' : 'border-white/10'
      }`}
    >
      {entries.slice(0, 8).map(([key, value]) => (
        <div
          key={key}
          className={`space-y-1 rounded-lg border px-3 py-2 ${
            theme === 'light'
              ? 'border-sky-100/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(240,247,255,0.92))]'
              : 'border-white/8 bg-white/[0.035]'
          }`}
        >
          <dt className={`font-medium ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
            {key}
          </dt>
          <dd
            className={`wrap-break-word ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}
          >
            {formatPropertyValue(value)}
          </dd>
        </div>
      ))}
      {entries.length > 8 ? (
        <p className={theme === 'light' ? 'text-slate-500' : 'text-slate-400'}>
          +{entries.length - 8} more properties
        </p>
      ) : null}
    </dl>
  );
}

function formatPropertyValue(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}
