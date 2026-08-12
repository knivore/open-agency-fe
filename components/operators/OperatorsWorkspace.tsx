'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  CirclePause,
  CirclePlay,
  Plus,
  RadioTower,
  RefreshCw,
  Search,
  ShieldAlert,
  WifiOff,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import ConfirmActionDialog from '@/components/app-shell/ConfirmActionDialog';
import PageHeader from '@/components/app-shell/PageHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/library/shadcn/alert';
import { Button } from '@/components/library/shadcn/button';
import { Input } from '@/components/library/shadcn/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/library/shadcn/table';
import { operatorsApi } from '@/lib/api/backend/operators';
import { queryKeys } from '@/lib/react-query/queryKeys';
import type { OperatorReadModel } from '@/types/operators';
import {
  DecisionBadge,
  OperatorMetric,
  OperatorQueryState,
  OperatorStatusBadge,
} from './OperatorPrimitives';
import { formatOperatorTime, formatRelativeTime, operatorBudget } from './operatorPresentation';
import { useOnlineStatus, useOperatorWorkspace } from './useOperatorWorkspace';

const POLL_INTERVAL = 15_000;

export default function OperatorsWorkspace() {
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const { workspaceId, selectWorkspace } = useOperatorWorkspace();
  const [workspaceDraft, setWorkspaceDraft] = useState(workspaceId);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fleetQuery = useQuery({
    queryKey: queryKeys.backendOperators(workspaceId),
    queryFn: () => operatorsApi.listOperators(workspaceId),
    enabled: Boolean(workspaceId),
    refetchInterval: online ? POLL_INTERVAL : false,
  });
  const summaryQuery = useQuery({
    queryKey: queryKeys.backendOperatorSummary(workspaceId),
    queryFn: () => operatorsApi.getSummary(workspaceId),
    enabled: Boolean(workspaceId),
    refetchInterval: online ? POLL_INTERVAL : false,
  });

  const visibleOperators = useMemo(() => {
    const items = fleetQuery.data?.items ?? [];
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter(({ operator }) =>
      [operator.name, operator.purpose, operator.description, operator.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [fleetQuery.data?.items, search]);

  const effectiveSelectedId = visibleOperators.some(({ operator }) => operator.id === selectedId)
    ? selectedId
    : (visibleOperators[0]?.operator.id ?? null);
  const selected =
    visibleOperators.find(({ operator }) => operator.id === effectiveSelectedId) ?? null;
  const selectedOperatorId = selected?.operator.id ?? '';
  const selectedEvaluations = useQuery({
    queryKey: queryKeys.backendOperatorResource(workspaceId, selectedOperatorId, 'evaluations'),
    queryFn: () => operatorsApi.listEvaluations(workspaceId, selectedOperatorId, 5),
    enabled: Boolean(workspaceId && selectedOperatorId),
    refetchInterval: online ? POLL_INTERVAL : false,
  });
  const selectedCapabilities = useQuery({
    queryKey: queryKeys.backendOperatorResource(workspaceId, selectedOperatorId, 'capabilities'),
    queryFn: () => operatorsApi.listCapabilities(workspaceId, selectedOperatorId),
    enabled: Boolean(workspaceId && selectedOperatorId),
    refetchInterval: online ? POLL_INTERVAL : false,
  });
  const selectedGoals = useQuery({
    queryKey: queryKeys.backendOperatorResource(workspaceId, selectedOperatorId, 'goals'),
    queryFn: () => operatorsApi.listGoals(workspaceId, selectedOperatorId),
    enabled: Boolean(workspaceId && selectedOperatorId),
    refetchInterval: online ? POLL_INTERVAL : false,
  });
  const selectedNotifications = useQuery({
    queryKey: queryKeys.backendOperatorResource(workspaceId, selectedOperatorId, 'notifications'),
    queryFn: () => operatorsApi.listNotifications(workspaceId, selectedOperatorId, 10),
    enabled: Boolean(workspaceId && selectedOperatorId),
    refetchInterval: online ? POLL_INTERVAL : false,
  });

  const invalidateFleet = async (operatorId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.backendOperators(workspaceId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.backendOperatorSummary(workspaceId) }),
      operatorId
        ? queryClient.invalidateQueries({
            queryKey: queryKeys.backendOperator(workspaceId, operatorId),
          })
        : Promise.resolve(),
    ]);
  };
  const lifecycleMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'pause' | 'resume' | 'wake' }) => {
      if (action === 'pause') return operatorsApi.pause(workspaceId, id);
      if (action === 'resume') return operatorsApi.resume(workspaceId, id);
      return operatorsApi.wake(workspaceId, id, 'Manual wake from the Operators fleet workspace.');
    },
    onSuccess: async (_, input) => {
      toast.success(
        input.action === 'wake' ? 'Wake signal accepted.' : `Operator ${input.action}d.`
      );
      await invalidateFleet(input.id);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Operator action failed.'),
  });
  const emergencyMutation = useMutation({
    mutationFn: () =>
      operatorsApi.emergencyStop(
        workspaceId,
        'Workspace emergency stop requested from the Operators fleet workspace.'
      ),
    onSuccess: async (result) => {
      toast.success(
        result.complete
          ? `Emergency stop completed for ${result.stopped_operator_ids.length} operator(s).`
          : 'Emergency stop completed with failures. Review the fleet state.'
      );
      await invalidateFleet();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Emergency stop failed.'),
  });

  const createHref = workspaceId
    ? `/operators/create?workspace=${encodeURIComponent(workspaceId)}`
    : '/operators/create';
  const lastRefresh = Math.max(fleetQuery.dataUpdatedAt, summaryQuery.dataUpdatedAt);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Control plane"
        icon={RadioTower}
        tone="operator"
        title="Operators"
        description="Persistent agents that monitor work, use approved capabilities, and dispatch controlled jobs."
        actions={
          <>
            <ConfirmActionDialog
              trigger={
                <Button variant="outline" disabled={!workspaceId || emergencyMutation.isPending}>
                  <ShieldAlert className="size-4" /> Emergency stop
                </Button>
              }
              title="Stop every Operator in this workspace?"
              description="This stops non-archived Operators and cancels their active evaluations and unresolved signals. It does not delete definitions, evidence, or audit history."
              confirmLabel="Stop all operators"
              pendingLabel="Stopping operators"
              destructive
              pending={emergencyMutation.isPending}
              onConfirm={() => emergencyMutation.mutate()}
            />
            <Button asChild variant="brand" disabled={!workspaceId}>
              <Link href={createHref} aria-disabled={!workspaceId}>
                <Plus className="size-4" /> Create operator
              </Link>
            </Button>
          </>
        }
      />

      {!workspaceId ? (
        <section className="mx-auto max-w-2xl border-y border-(--agency-shell-border) py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-(--agency-page-tone)">
            Workspace context required
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">
            Choose the Operator workspace
          </h2>
          <p className="mt-2 text-sm leading-6 text-(--agency-shell-muted)">
            Open Agency does not infer workspace authority. Enter the workspace identifier whose
            Operators you are authorized to supervise.
          </p>
          <form
            className="mt-5 flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              selectWorkspace(workspaceDraft);
            }}
          >
            <Input
              value={workspaceDraft}
              onChange={(event) => setWorkspaceDraft(event.target.value)}
              placeholder="Workspace ID"
              aria-label="Workspace ID"
            />
            <Button type="submit" disabled={!workspaceDraft.trim()}>
              Open workspace
            </Button>
          </form>
        </section>
      ) : (
        <>
          {!online ? (
            <Alert className="border-amber-300/60 bg-amber-50/70 text-amber-950 dark:border-amber-300/20 dark:bg-amber-400/10 dark:text-amber-100">
              <WifiOff className="size-4" />
              <AlertTitle>Offline — showing the latest durable ledger</AlertTitle>
              <AlertDescription>
                Operator controls are unavailable until connectivity returns. Last refreshed{' '}
                {formatRelativeTime(lastRefresh ? new Date(lastRefresh).toISOString() : null)}.
              </AlertDescription>
            </Alert>
          ) : null}

          <section className="grid divide-y border-y border-(--agency-shell-border) sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5">
            <OperatorMetric
              label="Fleet"
              value={summaryQuery.data?.total ?? '—'}
              detail="Configured operators"
            />
            <OperatorMetric
              label="Active"
              value={summaryQuery.data?.active ?? '—'}
              detail="Currently available"
            />
            <OperatorMetric
              label="Waiting"
              value={summaryQuery.data?.waiting ?? '—'}
              detail="Input or approval"
            />
            <OperatorMetric
              label="Attention"
              value={summaryQuery.data?.attention ?? '—'}
              detail="Degraded or stopped"
            />
            <OperatorMetric
              label="Next wake"
              value={
                summaryQuery.data?.next_evaluation_at
                  ? formatRelativeTime(summaryQuery.data.next_evaluation_at)
                  : 'None'
              }
              detail={formatOperatorTime(summaryQuery.data?.next_evaluation_at)}
            />
          </section>

          <div className="flex flex-col gap-3 border-b border-(--agency-shell-border) pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-(--agency-shell-muted)" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter operators by name, purpose, or state"
                className="pl-9"
                aria-label="Filter operators"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-(--agency-shell-muted)">
              {fleetQuery.isFetching ? <RefreshCw className="size-3.5 animate-spin" /> : null}
              {fleetQuery.isFetching
                ? 'Refreshing durable state'
                : `Updated ${formatRelativeTime(lastRefresh ? new Date(lastRefresh).toISOString() : null)}`}
            </div>
          </div>

          {fleetQuery.isLoading ? (
            <OperatorQueryState
              kind="loading"
              title="Loading Operators"
              description="Reading the workspace Operator ledger and current lifecycle states."
            />
          ) : fleetQuery.isError ? (
            <OperatorQueryState
              kind="error"
              title="Operators could not be loaded"
              description={
                fleetQuery.error instanceof Error
                  ? fleetQuery.error.message
                  : 'The workspace ledger is unavailable.'
              }
              action={
                <Button variant="outline" onClick={() => void fleetQuery.refetch()}>
                  Retry
                </Button>
              }
            />
          ) : visibleOperators.length === 0 ? (
            <OperatorQueryState
              kind="empty"
              title={search ? 'No Operators match this filter' : 'No Operators yet'}
              description={
                search
                  ? 'Change the filter to inspect another Operator.'
                  : 'Create a draft, review its authority, and validate it in shadow mode before activation.'
              }
              action={
                !search ? (
                  <Button asChild>
                    <Link href={createHref}>Create operator</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_370px]">
              <OperatorFleetTable
                items={visibleOperators}
                selectedId={effectiveSelectedId}
                onSelect={setSelectedId}
              />
              {selected ? (
                <OperatorInspector
                  item={selected}
                  workspaceId={workspaceId}
                  latestEvaluation={selectedEvaluations.data?.items[0]}
                  capabilityUnavailable={
                    selectedCapabilities.data?.items.filter((capability) => !capability.available)
                      .length
                  }
                  capabilityCount={selectedCapabilities.data?.count}
                  activeGoal={selectedGoals.data?.items.find(
                    (goal) => !['completed', 'cancelled', 'failed'].includes(goal.status)
                  )}
                  failedNotifications={
                    selectedNotifications.data?.items.filter(
                      (receipt) => receipt.status === 'failed'
                    ).length
                  }
                  offline={!online}
                  pending={lifecycleMutation.isPending}
                  onAction={(action) =>
                    lifecycleMutation.mutate({ id: selected.operator.id, action })
                  }
                />
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OperatorFleetTable({
  items,
  selectedId,
  onSelect,
}: {
  items: OperatorReadModel[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="border-y border-(--agency-shell-border)">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Operator</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Next wake</TableHead>
            <TableHead className="hidden lg:table-cell">Last evaluation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(({ operator }) => (
            <TableRow
              key={operator.id}
              data-state={selectedId === operator.id ? 'selected' : undefined}
              className="cursor-pointer"
              onClick={() => onSelect(operator.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onSelect(operator.id);
              }}
              tabIndex={0}
              aria-selected={selectedId === operator.id}
            >
              <TableCell>
                <p className="font-semibold text-(--agency-shell-text)">{operator.name}</p>
                <p className="mt-1 max-w-xl line-clamp-2 text-xs leading-5 text-(--agency-shell-muted)">
                  {operator.purpose}
                </p>
              </TableCell>
              <TableCell>
                <OperatorStatusBadge status={operator.status} />
              </TableCell>
              <TableCell className="hidden text-sm md:table-cell">
                {formatRelativeTime(operator.next_evaluation_at)}
              </TableCell>
              <TableCell className="hidden text-sm lg:table-cell">
                {formatRelativeTime(operator.last_evaluated_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function OperatorInspector({
  item,
  workspaceId,
  latestEvaluation,
  capabilityUnavailable,
  capabilityCount,
  activeGoal,
  failedNotifications,
  offline,
  pending,
  onAction,
}: {
  item: OperatorReadModel;
  workspaceId: string;
  latestEvaluation?: {
    decision?: { decision?: string; rationale_summary?: string } | null;
    created_at: string;
  };
  capabilityUnavailable?: number;
  capabilityCount?: number;
  activeGoal?: { objective: string; status: string };
  failedNotifications?: number;
  offline: boolean;
  pending: boolean;
  onAction: (action: 'pause' | 'resume' | 'wake') => void;
}) {
  const { operator, active_standing_order: order } = item;
  const budget = operatorBudget(operator);
  const isPaused = operator.status === 'paused';
  const detailHref = `/operators/${operator.id}?workspace=${encodeURIComponent(workspaceId)}`;
  return (
    <aside className="sticky top-24 border-y border-(--agency-shell-border) xl:border-l xl:pl-6">
      <div className="py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-(--agency-page-tone)">
              Selected operator
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">{operator.name}</h2>
          </div>
          <OperatorStatusBadge status={operator.status} />
        </div>
        <p className="mt-3 text-sm leading-6 text-(--agency-shell-muted)">{operator.purpose}</p>
      </div>

      <dl className="divide-y border-y border-(--agency-shell-border)">
        <InspectorValue label="Next wake" value={formatOperatorTime(operator.next_evaluation_at)} />
        <InspectorValue
          label="Last evaluation"
          value={
            latestEvaluation
              ? formatOperatorTime(latestEvaluation.created_at)
              : 'No evaluation recorded'
          }
        />
        <InspectorValue
          label="Latest decision"
          value={<DecisionBadge decision={latestEvaluation?.decision?.decision} />}
          detail={latestEvaluation?.decision?.rationale_summary}
        />
        <InspectorValue
          label="Active goal"
          value={activeGoal?.objective ?? 'No active goal'}
          detail={activeGoal?.status}
        />
        <InspectorValue
          label="Capability health"
          value={
            capabilityCount === undefined
              ? 'Checking'
              : capabilityUnavailable
                ? `${capabilityUnavailable} unavailable`
                : `${capabilityCount} available`
          }
          danger={Boolean(capabilityUnavailable)}
        />
        <InspectorValue
          label="Delivery receipts"
          value={failedNotifications ? `${failedNotifications} failed` : 'No delivery failures'}
          danger={Boolean(failedNotifications)}
        />
        <InspectorValue
          label="Configured budget"
          value={`${budget.maxActions || '—'} actions · $${budget.maxCost.toFixed(2)}`}
          detail="Limits shown; consumption is not inferred."
        />
      </dl>

      <section className="py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-(--agency-shell-muted)">
          Standing order
        </p>
        <p className="mt-2 line-clamp-5 text-sm leading-6">
          {order?.instructions ?? 'No active standing order.'}
        </p>
      </section>

      <div className="flex flex-wrap gap-2 border-t border-(--agency-shell-border) pt-5">
        <Button
          size="sm"
          variant="outline"
          disabled={
            offline || pending || ['stopped', 'archived', 'draft'].includes(operator.status)
          }
          onClick={() => onAction(isPaused ? 'resume' : 'pause')}
        >
          {isPaused ? <CirclePlay className="size-4" /> : <CirclePause className="size-4" />}
          {isPaused ? 'Resume' : 'Pause'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={
            offline ||
            pending ||
            !['active', 'sleeping', 'waiting_for_input', 'waiting_for_approval'].includes(
              operator.status
            )
          }
          onClick={() => onAction('wake')}
        >
          <Zap className="size-4" /> Wake now
        </Button>
        <Button size="sm" asChild className="ml-auto">
          <Link href={detailHref}>
            Supervise <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
      {operator.status === 'degraded' ? (
        <div className="mt-4 flex gap-2 text-xs leading-5 text-rose-700 dark:text-rose-200">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> This Operator requires attention
          before normal operation can continue.
        </div>
      ) : null}
    </aside>
  );
}

function InspectorValue({
  label,
  value,
  detail,
  danger = false,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="py-3">
      <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-(--agency-shell-muted)">
        {label}
      </dt>
      <dd
        className={`mt-1 text-sm font-medium ${danger ? 'text-rose-700 dark:text-rose-200' : 'text-(--agency-shell-text)'}`}
      >
        {value}
      </dd>
      {detail ? (
        <p className="mt-1 text-xs leading-5 text-(--agency-shell-muted)">{detail}</p>
      ) : null}
    </div>
  );
}
