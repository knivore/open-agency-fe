'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import type {
  ExecutionEventRecord,
  RunLogEntry,
  RunSessionSummary,
  RunViewMode,
  WorkflowDefinition,
} from '@/lib/api/backend/types';
import { agentsApi, workflowsApi } from '@/lib/api/backend';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { Badge } from '@/components/library/shadcn/badge';
import { Button } from '@/components/library/shadcn/button';
import { Input } from '@/components/library/shadcn/input';
import { ActivitySquare, List, RefreshCw } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/library/shadcn/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/library/shadcn/tabs';
import {
  RunsEmptyCard,
  RunsErrorAlert,
  RunsLoadingCard,
} from '@/components/runs/components/RunsState';
import RunSessionsTable from '@/components/runs/components/RunSessionsTable';
import { useRunsModule } from '@/components/runs/context';
import { useRunsWorkspace } from '@/components/runs/hooks/useRunsWorkspace';
import ObservatoryRuntimeSurface, {
  type ObservatoryRuntimeAgentSource,
  type ObservatoryRuntimePreviewMode,
  type ObservatoryRuntimeRunContext,
} from '@/modules/observatory/app/ObservatoryRuntimeSurface';
import {
  DEFAULT_OBSERVATORY_RUNS_AGENT_VISIBILITY_MODE,
  readObservatoryAgentVisibilityMode,
  type ObservatoryAgentVisibilityMode,
} from '@/modules/observatory/runtime/agentVisibility';

type RunsVisibleViewMode = RunViewMode | 'observatory';

const OBSERVATORY_WORKING_RUN_STATUSES = new Set([
  'created',
  'queued',
  'running',
  'waiting_for_approval',
  'paused',
  'cancelling',
]);

export default function RunsWorkspace() {
  const { api, queryKeys: runsQueryKeys } = useRunsModule();
  const workflowsQuery = useQuery({
    queryKey: queryKeys.backendWorkflowList(),
    queryFn: () => workflowsApi.listWorkflows(),
    staleTime: 60_000,
  });
  const allWorkflowDefinitions = useMemo(
    () => workflowsQuery.data?.items ?? [],
    [workflowsQuery.data]
  );
  const workflowNamesById = useMemo(
    () => new Map(allWorkflowDefinitions.map((workflow) => [workflow.id, workflow.name])),
    [allWorkflowDefinitions]
  );
  const {
    runsQuery,
    runs,
    filteredRuns,
    activeCount,
    waitingCount,
    failedCount,
    runtimeCount,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    viewMode,
    setViewMode,
    statusFilters,
  } = useRunsWorkspace({ workflowNamesById });
  const [visibleViewMode, setVisibleViewMode] = useState<RunsVisibleViewMode>(viewMode);
  const [observatoryHasMounted, setObservatoryHasMounted] = useState(false);
  const [observatoryAgentVisibilityMode, setObservatoryAgentVisibilityMode] =
    useState<ObservatoryAgentVisibilityMode>(DEFAULT_OBSERVATORY_RUNS_AGENT_VISIBILITY_MODE);
  const observatoryEnabled = observatoryHasMounted && runsQuery.isSuccess;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setObservatoryAgentVisibilityMode(readObservatoryAgentVisibilityMode());
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);
  const agentsQuery = useQuery({
    queryKey: queryKeys.backendAgents(),
    queryFn: () => agentsApi.listAgentCatalog(),
  });
  const observatoryWorkingRuns = useMemo(
    () => runs.filter((run) => OBSERVATORY_WORKING_RUN_STATUSES.has(run.status)).slice(0, 8),
    [runs]
  );
  const observatoryActiveRuns = useMemo(
    () => (observatoryEnabled ? observatoryWorkingRuns : []),
    [observatoryEnabled, observatoryWorkingRuns]
  );
  const observatoryRuntimePreviewMode: ObservatoryRuntimePreviewMode = 'live';
  const observatoryRuntimeRuns = observatoryActiveRuns;
  const observatoryEventQueries = useQueries({
    queries: observatoryRuntimeRuns.map((run) => ({
      queryKey: runsQueryKeys.runEvents(run.id),
      queryFn: () => api.logs.listRunEvents(run.id),
      enabled: observatoryEnabled,
      staleTime: 10_000,
      refetchInterval: 10_000,
      refetchOnWindowFocus: false,
    })),
  });
  const observatoryLogQueries = useQueries({
    queries: observatoryRuntimeRuns.map((run) => ({
      queryKey: runsQueryKeys.runLogs(run.id),
      queryFn: () => api.runSessions.getRunLogs(run.id, 500),
      enabled: observatoryEnabled,
      staleTime: 15_000,
      refetchInterval: 15_000,
      refetchOnWindowFocus: false,
    })),
  });
  const observatoryWorkflowMap = useMemo(() => {
    return new Map(allWorkflowDefinitions.map((workflow) => [workflow.id, workflow]));
  }, [allWorkflowDefinitions]);
  const activeWorkflowIds = useMemo(
    () =>
      new Set(
        observatoryWorkingRuns
          .map((run) => run.workflowId)
          .filter((value): value is string => Boolean(value))
      ),
    [observatoryWorkingRuns]
  );
  const activeWorkflowDefinitions = useMemo(
    () => allWorkflowDefinitions.filter((workflow) => activeWorkflowIds.has(workflow.id)),
    [activeWorkflowIds, allWorkflowDefinitions]
  );
  const executedWorkflowIds = useMemo(
    () =>
      new Set(runs.map((run) => run.workflowId).filter((value): value is string => Boolean(value))),
    [runs]
  );
  const executedWorkflowDefinitions = useMemo(
    () => allWorkflowDefinitions.filter((workflow) => executedWorkflowIds.has(workflow.id)),
    [allWorkflowDefinitions, executedWorkflowIds]
  );
  const activeWorkflowAgents = useMemo(
    () => createWorkflowAgentSources(activeWorkflowDefinitions),
    [activeWorkflowDefinitions]
  );
  const workflowAgents = useMemo(
    () => createWorkflowAgentSources(allWorkflowDefinitions),
    [allWorkflowDefinitions]
  );
  const executedWorkflowAgents = useMemo(
    () => createWorkflowAgentSources(executedWorkflowDefinitions),
    [executedWorkflowDefinitions]
  );
  const allObservatoryAgents = useMemo(
    () => mergeObservatoryRuntimeAgents(agentsQuery.data ?? [], allWorkflowDefinitions),
    [agentsQuery.data, allWorkflowDefinitions]
  );
  const observatoryAgents = useMemo(() => {
    switch (observatoryAgentVisibilityMode) {
      case 'all':
        return allObservatoryAgents;
      case 'executedWorkflow':
        return executedWorkflowAgents;
      case 'workflow':
        return workflowAgents;
      case 'activeWorkflow':
      default:
        return activeWorkflowAgents.length > 0
          ? activeWorkflowAgents
          : workflowAgents.length > 0
            ? workflowAgents
            : allObservatoryAgents;
    }
  }, [
    activeWorkflowAgents,
    allObservatoryAgents,
    executedWorkflowAgents,
    observatoryAgentVisibilityMode,
    workflowAgents,
  ]);
  const observatoryAgentCounts = {
    activeWorkflow: activeWorkflowAgents.length,
    all: allObservatoryAgents.length,
    executedWorkflow: executedWorkflowAgents.length,
    workflow: workflowAgents.length,
  };
  const observatoryRuntimeContext = useMemo(
    () =>
      createObservatoryRuntimeContext(
        observatoryRuntimeRuns,
        observatoryWorkflowMap,
        observatoryEventQueries,
        observatoryLogQueries
      ),
    [observatoryEventQueries, observatoryLogQueries, observatoryRuntimeRuns, observatoryWorkflowMap]
  );
  const observatoryAgentControls = (
    <ObservatoryAgentVisibilityControls
      counts={observatoryAgentCounts}
      mode={observatoryAgentVisibilityMode}
      onModeChange={setObservatoryAgentVisibilityMode}
    />
  );

  const handleViewModeChange = (nextViewMode: string) => {
    const nextVisibleViewMode = nextViewMode as RunsVisibleViewMode;
    setVisibleViewMode(nextVisibleViewMode);

    if (nextVisibleViewMode === 'observatory') {
      setObservatoryHasMounted(true);
    }

    if (nextVisibleViewMode === 'list') {
      setViewMode(nextVisibleViewMode);
    }
  };

  if (runsQuery.isLoading) {
    return (
      <div className="space-y-6">
        <RunsLoadingCard
          title="Runs"
          description="Loading execution runs from the transformed backend."
        />
        {observatoryAgentControls}
      </div>
    );
  }

  if (runsQuery.isError) {
    return (
      <div className="space-y-6">
        <RunsErrorAlert
          title="Failed to load runs"
          message={runsQuery.error.message}
          onRetry={() => runsQuery.refetch()}
        />
        {observatoryAgentControls}
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="space-y-6">
        <RunsEmptyCard
          title="No runs found"
          description="The canonical executions route returned no runs."
          actionLabel="Refresh"
          onAction={() => runsQuery.refetch()}
        />
        {observatoryAgentControls}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Runs</h1>
          <p className="text-sm text-neutral-500">
            Live operations, coordination, and execution records
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline">{runs.length} total</Badge>
            <Badge variant="outline">{activeCount} active</Badge>
            {statusFilter !== 'all' ? (
              <Badge variant="secondary">Filtered: {statusFilter}</Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={visibleViewMode} onValueChange={handleViewModeChange}>
            <TabsList>
              <TabsTrigger value="list" className="gap-2">
                <List className="h-4 w-4" />
                List
              </TabsTrigger>
              <TabsTrigger value="observatory" className="gap-2">
                <ActivitySquare className="h-4 w-4" />
                Observatory
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            type="button"
            variant="outline"
            onClick={() => runsQuery.refetch()}
            disabled={runsQuery.isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${runsQuery.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search workflow name, runtime, status, or error"
          className="md:max-w-md"
        />
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => (
            <Button
              key={filter}
              type="button"
              variant={statusFilter === filter ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(filter)}
            >
              {filter === 'all' ? 'All statuses' : filter}
            </Button>
          ))}
        </div>
      </div>
      {observatoryAgentControls}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active</CardTitle>
            <CardDescription>Runs that still need supervision.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-neutral-900">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Waiting</CardTitle>
            <CardDescription>Runs blocked on approval or input.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-neutral-900">{waitingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Failed</CardTitle>
            <CardDescription>Runs that need debugging.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-neutral-900">{failedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Runtime Adapters</CardTitle>
            <CardDescription>Distinct runtimes in current result set.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-neutral-900">{runtimeCount}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={visibleViewMode} onValueChange={handleViewModeChange}>
        <TabsContent value="list" className="mt-0">
          {filteredRuns.length === 0 ? (
            <RunsEmptyCard
              title="No matching runs"
              description="Adjust the current search or status filter to see more execution records."
              actionLabel="Clear filters"
              onAction={() => {
                setSearch('');
                setStatusFilter('all');
              }}
            />
          ) : (
            <RunSessionsTable runs={filteredRuns} workflowNamesById={workflowNamesById} />
          )}
        </TabsContent>
        <TabsContent value="observatory" className="mt-0" forceMount>
          {observatoryHasMounted ? (
            <ObservatoryRuntimeSurface
              agents={observatoryAgents}
              layoutSource="repo"
              mode="viewer"
              runtimeObjectOverlays={false}
              runtimeContext={observatoryRuntimeContext}
              runtimePreviewMode={observatoryRuntimePreviewMode}
              runs={observatoryRuntimeRuns}
              useLayoutAgentsWhenEmpty={false}
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ObservatoryAgentVisibilityControls({
  counts,
  mode,
  onModeChange,
}: {
  counts: Record<ObservatoryAgentVisibilityMode, number>;
  mode: ObservatoryAgentVisibilityMode;
  onModeChange: (mode: ObservatoryAgentVisibilityMode) => void;
}) {
  const options: Array<{ label: string; mode: ObservatoryAgentVisibilityMode }> = [
    { label: 'Active workflow agents', mode: 'activeWorkflow' },
    { label: 'All workflow agents', mode: 'workflow' },
    { label: 'Executed workflow agents', mode: 'executedWorkflow' },
    { label: 'All agents', mode: 'all' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-white px-3 py-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Observatory agents
      </span>
      {options.map((option) => (
        <Button
          key={option.mode}
          type="button"
          variant={mode === option.mode ? 'default' : 'outline'}
          size="sm"
          onClick={() => onModeChange(option.mode)}
        >
          {option.label}
          <Badge className="ml-2" variant={mode === option.mode ? 'secondary' : 'outline'}>
            {counts[option.mode]}
          </Badge>
        </Button>
      ))}
    </div>
  );
}

function mergeObservatoryRuntimeAgents(
  catalogAgents: ObservatoryRuntimeAgentSource[],
  workflows: WorkflowDefinition[]
): ObservatoryRuntimeAgentSource[] {
  const agents = new Map<string, ObservatoryRuntimeAgentSource>();

  catalogAgents.forEach((agent) => {
    agents.set(agent.id, {
      assignedWorkflows: agent.assignedWorkflows,
      description: agent.description ?? null,
      id: agent.id,
      name: agent.name,
      role: agent.role ?? null,
    });
  });

  workflows.forEach((workflow) => {
    createWorkflowAgentSources([workflow]).forEach((agent) => {
      const existing = agents.get(agent.id);
      agents.set(agent.id, {
        assignedWorkflows: mergeAgentWorkflowAssignments(
          existing?.assignedWorkflows,
          agent.assignedWorkflows
        ),
        description: agent.description ?? existing?.description ?? null,
        id: agent.id,
        name: agent.name || existing?.name || agent.id,
        role: agent.role ?? existing?.role ?? null,
      });
    });
  });

  return Array.from(agents.values());
}

function createWorkflowAgentSources(
  workflows: WorkflowDefinition[]
): ObservatoryRuntimeAgentSource[] {
  const agents = new Map<string, ObservatoryRuntimeAgentSource>();

  workflows.forEach((workflow) => {
    workflow.agent_definitions?.forEach((agent) => {
      const existing = agents.get(agent.id);
      agents.set(agent.id, {
        assignedWorkflows: mergeAgentWorkflowAssignments(existing?.assignedWorkflows, [
          { id: workflow.id, name: workflow.name },
        ]),
        description: agent.description ?? existing?.description ?? null,
        id: agent.id,
        name: agent.name || existing?.name || agent.id,
        role: agent.role ?? existing?.role ?? null,
      });
    });
  });

  return Array.from(agents.values());
}

function mergeAgentWorkflowAssignments(
  left: ObservatoryRuntimeAgentSource['assignedWorkflows'],
  right: ObservatoryRuntimeAgentSource['assignedWorkflows']
) {
  const assignments = new Map<string, { id: string; name?: string | null }>();

  left?.forEach((workflow) => assignments.set(workflow.id, workflow));
  right?.forEach((workflow) => assignments.set(workflow.id, workflow));

  return assignments.size > 0 ? Array.from(assignments.values()) : undefined;
}

function createObservatoryRuntimeContext(
  runs: RunSessionSummary[],
  workflows: Map<string, WorkflowDefinition>,
  eventQueries: Array<{ data?: { items?: ExecutionEventRecord[] } }>,
  logQueries: Array<{ data?: RunLogEntry }>
): ObservatoryRuntimeRunContext[] {
  return runs.map((run, index) => {
    const workflow = run.workflowId ? (workflows.get(run.workflowId) ?? null) : null;
    const events = eventQueries[index]?.data?.items ?? [];
    const logs = splitLogPreview(logQueries[index]?.data?.logs);

    return {
      events: events
        .sort((left, right) => left.sequence - right.sequence)
        .map((event) => ({
          agentId: event.agent_id ?? null,
          eventType: event.event_type,
          message: summarizeObservatoryEvent(event),
          sequence: event.sequence,
          taskId: event.task_id ?? null,
          timestamp: event.timestamp ?? null,
        })),
      logs,
      run,
      workflow,
    };
  });
}

function summarizeObservatoryEvent(event: ExecutionEventRecord) {
  const payload = event.payload ?? {};
  const toolId =
    typeof payload.tool_id === 'string'
      ? payload.tool_id
      : typeof payload.tool_name === 'string'
        ? payload.tool_name
        : null;
  const taskName = typeof payload.task_name === 'string' ? payload.task_name : null;
  const parts = [event.event_type, taskName, toolId, event.actor].filter(Boolean);

  return parts.join(' · ');
}

function splitLogPreview(logs: string | undefined) {
  if (!logs) {
    return [];
  }

  return logs
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-500);
}
