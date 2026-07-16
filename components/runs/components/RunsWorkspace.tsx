'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import type {
  ExecutionEventRecord,
  RunLogEntry,
  RunSessionSummary,
  RunViewMode,
} from '@/types/runtime';
import type { WorkflowDefinition } from '@/types/workflows';
import { agentsApi } from '@/lib/api/backend/agents';
import { workflowsApi } from '@/lib/api/backend/workflows';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { Badge } from '@/components/library/shadcn/badge';
import { Button } from '@/components/library/shadcn/button';
import { Input } from '@/components/library/shadcn/input';
import {
  type LucideIcon,
  ActivitySquare,
  CircleAlert,
  Clock3,
  Cpu,
  List,
  PlayCircle,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/library/shadcn/tabs';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/library/shadcn/select';
import PageHeader from '@/components/app-shell/PageHeader';
import { useRegisterAssistantPageContext } from '@/components/assistant/AssistantPageContext';
import {
  RunsEmptyCard,
  RunsErrorAlert,
  RunsLoadingCard,
} from '@/components/runs/components/RunsState';
import RunSessionsTable from '@/components/runs/components/RunSessionsTable';
import RunsSavedViews from '@/components/runs/components/RunsSavedViews';
import { useRunsModule } from '@/components/runs/context';
import { type RunsStatusFilter, useRunsWorkspace } from '@/components/runs/hooks/useRunsWorkspace';
import { formatRunStatus } from '@/lib/runs/runPresentation';
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

function RunHealthMetric({
  description,
  icon: Icon,
  label,
  tone,
  value,
  onSelect,
  selected = false,
}: {
  description: string;
  icon: LucideIcon;
  label: string;
  tone: 'active' | 'failed' | 'runtime' | 'waiting';
  value: number;
  onSelect?: () => void;
  selected?: boolean;
}) {
  const content = (
    <>
      <span className="agency-run-metric-icon flex size-9 shrink-0 items-center justify-center rounded-lg border">
        <Icon className="size-[1.05rem] stroke-[1.75]" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <p className="text-xl font-semibold tracking-[-0.03em] text-(--agency-shell-text)">
            {value}
          </p>
          <p className="text-sm font-semibold text-(--agency-shell-text)">{label}</p>
        </div>
        <p className="truncate text-xs text-(--agency-shell-muted)" title={description}>
          {description}
        </p>
      </div>
    </>
  );
  const className =
    'agency-run-metric relative flex min-w-0 items-center gap-3 overflow-hidden rounded-lg border px-3 py-3 text-left sm:px-4';

  if (onSelect) {
    return (
      <button
        type="button"
        className={className}
        data-tone={tone}
        data-selected={selected ? 'true' : undefined}
        aria-pressed={selected}
        onClick={onSelect}
        title={`Filter runs: ${label}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={className} data-tone={tone}>
      {content}
    </div>
  );
}

const OBSERVATORY_WORKING_RUN_STATUSES = new Set([
  'created',
  'queued',
  'running',
  'waiting_for_input',
  'waiting_for_approval',
  'waiting_for_event',
  'sleeping',
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
    queryKey: queryKeys.backendAgentCatalog(),
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
  const focusedRun = filteredRuns[0] ?? runs[0] ?? null;
  const focusedRunId = focusedRun?.id ?? null;
  const focusedWorkflowId = focusedRun?.workflowId ?? null;
  const focusedWorkflowName = focusedWorkflowId
    ? (workflowNamesById.get(focusedWorkflowId) ?? focusedWorkflowId)
    : null;
  const hasActiveFilters = search.trim().length > 0 || statusFilter !== 'all';
  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    runs.forEach((run) => counts.set(run.status, (counts.get(run.status) ?? 0) + 1));
    counts.set('active', activeCount);
    counts.set('waiting', waitingCount);
    return counts;
  }, [activeCount, runs, waitingCount]);
  const assistantPageContext = useMemo(() => {
    return {
      surface: 'runs.list' as const,
      title: 'Runs',
      description: 'Execution runs, statuses, approvals, and runtime observability.',
      entities: [
        focusedRun
          ? {
              type: 'run',
              id: focusedRun.id,
              name: focusedWorkflowName ? `${focusedWorkflowName} run` : `Run ${focusedRun.id}`,
            }
          : null,
        focusedWorkflowId
          ? {
              type: 'workflow',
              id: focusedWorkflowId,
              name: focusedWorkflowName,
            }
          : null,
      ].filter(Boolean) as Array<{ type: string; id: string; name?: string | null }>,
      selection: {
        runId: focusedRun?.id ?? null,
        workflowId: focusedWorkflowId,
        mode: visibleViewMode,
      },
      summary: {
        totalRuns: runs.length,
        filteredRuns: filteredRuns.length,
        activeCount,
        waitingCount,
        failedCount,
        runtimeCount,
        statusFilter,
        search,
        observatoryAgentVisibilityMode,
      },
      allowedActions: [
        ...(focusedRunId ? ['run.inspect'] : []),
        ...(focusedWorkflowId ? ['workflow.inspect', 'workflow.run'] : []),
      ],
    };
  }, [
    activeCount,
    failedCount,
    filteredRuns.length,
    focusedRun,
    focusedRunId,
    focusedWorkflowId,
    focusedWorkflowName,
    observatoryAgentVisibilityMode,
    runtimeCount,
    runs.length,
    search,
    statusFilter,
    visibleViewMode,
    waitingCount,
  ]);
  useRegisterAssistantPageContext(assistantPageContext);

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
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={ActivitySquare}
          tone="run"
          title="Runs"
          description="Follow live execution, approvals, failures, and completed workflow runs."
          actions={
            <>
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
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${runsQuery.isFetching ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>
            </>
          }
        />
        <Tabs value={visibleViewMode} onValueChange={handleViewModeChange}>
          <TabsContent value="list" className="mt-0">
            <RunsEmptyCard
              title="No runs found"
              description="The canonical executions route returned no runs."
              actionLabel="Refresh"
              onAction={() => runsQuery.refetch()}
            />
          </TabsContent>
          <TabsContent value="observatory" className="mt-0">
            {observatoryHasMounted ? (
              <div className="space-y-4">
                {observatoryAgentControls}
                <ObservatoryRuntimeSurface
                  agents={observatoryAgents}
                  layoutSource="repo"
                  mode="viewer"
                  runtimeObjectOverlays={false}
                  runtimeContext={observatoryRuntimeContext}
                  runtimePreviewMode={observatoryRuntimePreviewMode}
                  runs={observatoryRuntimeRuns}
                  useLayoutAgentsWhenEmpty
                />
              </div>
            ) : null}
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ActivitySquare}
        tone="run"
        title="Runs"
        description="Follow live execution, approvals, failures, and completed workflow runs."
        meta={
          <>
            <Badge variant="outline">{runs.length} total</Badge>
            <Badge variant="outline">{activeCount} active</Badge>
            {statusFilter !== 'all' ? (
              <Badge variant="secondary">Filtered: {formatRunStatus(statusFilter)}</Badge>
            ) : null}
          </>
        }
        actions={
          <>
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
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Run health summary">
        <RunHealthMetric
          label="Active"
          description="Still executing or queued"
          value={activeCount}
          icon={PlayCircle}
          tone="active"
          selected={statusFilter === 'active'}
          onSelect={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
        />
        <RunHealthMetric
          label="Waiting"
          description="Needs approval or input"
          value={waitingCount}
          icon={Clock3}
          tone="waiting"
          selected={statusFilter === 'waiting'}
          onSelect={() => setStatusFilter(statusFilter === 'waiting' ? 'all' : 'waiting')}
        />
        <RunHealthMetric
          label="Failed"
          description="Needs investigation"
          value={failedCount}
          icon={CircleAlert}
          tone="failed"
          selected={statusFilter === 'failed'}
          onSelect={() => setStatusFilter(statusFilter === 'failed' ? 'all' : 'failed')}
        />
        <RunHealthMetric
          label="Runtimes"
          description="Distinct adapters in use"
          value={runtimeCount}
          icon={Cpu}
          tone="runtime"
        />
      </div>

      <Tabs value={visibleViewMode} onValueChange={handleViewModeChange}>
        <TabsContent value="list" className="mt-0">
          <div className="space-y-4">
            <section
              aria-label="Filter execution runs"
              className="rounded-xl border border-(--agency-shell-border) bg-(--agency-shell-panel) p-3 shadow-[0_1px_2px_rgba(15,23,42,0.025)]"
            >
              <div className="grid gap-3 lg:grid-cols-[minmax(18rem,1fr)_15rem_auto] lg:items-end">
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-(--agency-shell-text)">
                    Search runs
                  </span>
                  <span className="relative block">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-(--agency-shell-muted)"
                      aria-hidden="true"
                    />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Workflow, run ID, runtime, or error"
                      className="pl-9"
                    />
                  </span>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-(--agency-shell-text)">Status</span>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value as RunsStatusFilter)}
                  >
                    <SelectTrigger aria-label="Filter runs by status">
                      <SlidersHorizontal className="mr-2 size-4 text-(--agency-shell-muted)" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {statusFilters.map((filter) => (
                          <SelectItem key={filter} value={filter}>
                            {filter === 'all'
                              ? `All statuses (${runs.length})`
                              : `${formatRunStatus(filter)} (${statusCounts.get(filter) ?? 0})`}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </label>
                <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 lg:justify-end">
                  <span className="text-sm text-(--agency-shell-muted)" aria-live="polite">
                    {filteredRuns.length} {filteredRuns.length === 1 ? 'run' : 'runs'}
                  </span>
                  <RunsSavedViews
                    search={search}
                    status={statusFilter}
                    onApply={(view) => {
                      setSearch(view.search);
                      setStatusFilter(view.status);
                    }}
                  />
                  {hasActiveFilters ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearch('');
                        setStatusFilter('all');
                      }}
                    >
                      <X data-icon="inline-start" className="size-4" aria-hidden="true" />
                      Clear
                    </Button>
                  ) : null}
                </div>
              </div>
            </section>
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
          </div>
        </TabsContent>
        <TabsContent value="observatory" className="mt-0">
          {observatoryHasMounted ? (
            <div className="space-y-4">
              {observatoryAgentControls}
              <ObservatoryRuntimeSurface
                agents={observatoryAgents}
                layoutSource="repo"
                mode="viewer"
                runtimeObjectOverlays={false}
                runtimeContext={observatoryRuntimeContext}
                runtimePreviewMode={observatoryRuntimePreviewMode}
                runs={observatoryRuntimeRuns}
                useLayoutAgentsWhenEmpty
              />
            </div>
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
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary-100 bg-white/90 px-3 py-2 dark:border-white/10 dark:bg-white/5">
      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400">
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
