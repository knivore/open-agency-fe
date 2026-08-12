'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  ArrowLeft,
  BellRing,
  CirclePause,
  CirclePlay,
  Clock3,
  ExternalLink,
  Goal,
  History,
  LoaderCircle,
  OctagonX,
  Play,
  RadioTower,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  WifiOff,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import ConfirmActionDialog from '@/components/app-shell/ConfirmActionDialog';
import PageHeader from '@/components/app-shell/PageHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/library/shadcn/alert';
import { Badge } from '@/components/library/shadcn/badge';
import { Button } from '@/components/library/shadcn/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/library/shadcn/tabs';
import { Textarea } from '@/components/library/shadcn/textarea';
import { operatorsApi } from '@/lib/api/backend/operators';
import { queryKeys } from '@/lib/react-query/queryKeys';
import type {
  OperatorCapabilityHealth,
  OperatorEvaluation,
  OperatorGoalPortfolioItem,
  OperatorNotificationReceipt,
  OperatorReadModel,
  OperatorSignal,
  OperatorSimulation,
  OperatorTrigger,
} from '@/types/operators';
import {
  DecisionBadge,
  OperatorMetric,
  OperatorQueryState,
  OperatorStatusBadge,
} from './OperatorPrimitives';
import {
  formatOperatorTime,
  formatRelativeTime,
  humanizeIdentifier,
  operatorBudget,
} from './operatorPresentation';
import { useOnlineStatus, useOperatorWorkspace } from './useOperatorWorkspace';

const POLL_INTERVAL = 10_000;

export default function OperatorDetailWorkspace({ operatorId }: { operatorId: string }) {
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const { workspaceId, selectWorkspace } = useOperatorWorkspace();
  const [workspaceDraft, setWorkspaceDraft] = useState(workspaceId);
  const [simulationSignal, setSimulationSignal] = useState(
    'Review a representative signal and explain the bounded action you would take.'
  );
  const [simulationResult, setSimulationResult] = useState<OperatorSimulation | null>(null);

  const refetchInterval: number | false = online ? POLL_INTERVAL : false;
  const sharedQuery = { enabled: Boolean(workspaceId), refetchInterval };
  const operatorQuery = useQuery({
    queryKey: queryKeys.backendOperator(workspaceId, operatorId),
    queryFn: () => operatorsApi.getOperator(workspaceId, operatorId),
    ...sharedQuery,
  });
  const signalsQuery = useQuery({
    queryKey: queryKeys.backendOperatorResource(workspaceId, operatorId, 'signals'),
    queryFn: () => operatorsApi.listSignals(workspaceId, operatorId),
    ...sharedQuery,
  });
  const evaluationsQuery = useQuery({
    queryKey: queryKeys.backendOperatorResource(workspaceId, operatorId, 'evaluations'),
    queryFn: () => operatorsApi.listEvaluations(workspaceId, operatorId),
    ...sharedQuery,
  });
  const goalsQuery = useQuery({
    queryKey: queryKeys.backendOperatorResource(workspaceId, operatorId, 'goals'),
    queryFn: () => operatorsApi.listGoals(workspaceId, operatorId),
    ...sharedQuery,
  });
  const capabilitiesQuery = useQuery({
    queryKey: queryKeys.backendOperatorResource(workspaceId, operatorId, 'capabilities'),
    queryFn: () => operatorsApi.listCapabilities(workspaceId, operatorId),
    ...sharedQuery,
  });
  const notificationsQuery = useQuery({
    queryKey: queryKeys.backendOperatorResource(workspaceId, operatorId, 'notifications'),
    queryFn: () => operatorsApi.listNotifications(workspaceId, operatorId),
    ...sharedQuery,
  });
  const commitmentsQuery = useQuery({
    queryKey: queryKeys.backendOperatorResource(workspaceId, operatorId, 'commitments'),
    queryFn: () => operatorsApi.listCommitments(workspaceId, operatorId),
    ...sharedQuery,
  });
  const triggersQuery = useQuery({
    queryKey: queryKeys.backendOperatorResource(workspaceId, operatorId, 'triggers'),
    queryFn: () => operatorsApi.listTriggers(workspaceId, operatorId),
    ...sharedQuery,
  });

  const invalidateAll = async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.backendOperator(workspaceId, operatorId),
    });
    await queryClient.invalidateQueries({ queryKey: queryKeys.backendOperators(workspaceId) });
  };
  const lifecycleMutation = useMutation({
    mutationFn: async (action: 'activate' | 'pause' | 'resume' | 'stop' | 'wake') => {
      if (action === 'activate') return operatorsApi.activate(workspaceId, operatorId);
      if (action === 'pause') return operatorsApi.pause(workspaceId, operatorId);
      if (action === 'resume') return operatorsApi.resume(workspaceId, operatorId);
      if (action === 'stop') return operatorsApi.stop(workspaceId, operatorId);
      return operatorsApi.wake(workspaceId, operatorId, 'Manual wake from Operator supervision.');
    },
    onSuccess: async (_, action) => {
      toast.success(action === 'wake' ? 'Wake signal accepted.' : `Operator ${action}d.`);
      await invalidateAll();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Operator action failed.'),
  });
  const simulationMutation = useMutation({
    mutationFn: () =>
      operatorsApi.simulate(workspaceId, operatorId, { payload_summary: simulationSignal }),
    onSuccess: (result) => {
      setSimulationResult(result);
      toast.success('Dry simulation completed without dispatching an action.');
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Dry simulation failed.'),
  });

  if (!workspaceId) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={RadioTower}
          tone="operator"
          eyebrow="Operator supervision"
          title="Workspace required"
          description="Enter the workspace that owns this Operator. Open Agency does not infer cross-workspace authority."
        />
        <form
          className="mx-auto flex max-w-xl flex-col gap-3 border-y border-(--agency-shell-border) py-10 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            selectWorkspace(workspaceDraft);
          }}
        >
          <input
            className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-(--agency-input-bg) px-3 text-sm"
            value={workspaceDraft}
            onChange={(event) => setWorkspaceDraft(event.target.value)}
            placeholder="Workspace ID"
            aria-label="Workspace ID"
          />
          <Button type="submit" disabled={!workspaceDraft.trim()}>
            Open operator
          </Button>
        </form>
      </div>
    );
  }

  if (operatorQuery.isLoading) {
    return (
      <OperatorQueryState
        kind="loading"
        title="Loading Operator"
        description="Reading the durable definition and supervision ledger."
      />
    );
  }
  if (operatorQuery.isError || !operatorQuery.data) {
    return (
      <OperatorQueryState
        kind="error"
        title="Operator could not be loaded"
        description={
          operatorQuery.error instanceof Error
            ? operatorQuery.error.message
            : 'This Operator is unavailable.'
        }
        action={
          <Button variant="outline" onClick={() => void operatorQuery.refetch()}>
            Retry
          </Button>
        }
      />
    );
  }

  const readModel = operatorQuery.data;
  const operator = readModel.operator;
  const latestEvaluation = evaluationsQuery.data?.items[0];
  const budget = operatorBudget(operator);
  const lastRefresh = Math.max(operatorQuery.dataUpdatedAt, evaluationsQuery.dataUpdatedAt);
  const pending = lifecycleMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-3 mb-2 text-(--agency-shell-muted)"
        >
          <Link href={`/operators?workspace=${encodeURIComponent(workspaceId)}`}>
            <ArrowLeft className="size-4" /> Operators
          </Link>
        </Button>
        <PageHeader
          eyebrow="Operator supervision"
          icon={RadioTower}
          tone="operator"
          title={operator.name}
          description={operator.purpose}
          meta={
            <>
              <OperatorStatusBadge status={operator.status} />
              <Badge variant="outline">{operator.evaluation_adapter_id}</Badge>
            </>
          }
          actions={
            <>
              {operator.status === 'draft' ? (
                <Button
                  variant="brand"
                  disabled={pending || !online}
                  onClick={() => lifecycleMutation.mutate('activate')}
                >
                  <CirclePlay className="size-4" /> Activate
                </Button>
              ) : null}
              {operator.status === 'paused' ? (
                <Button
                  variant="outline"
                  disabled={pending || !online}
                  onClick={() => lifecycleMutation.mutate('resume')}
                >
                  <CirclePlay className="size-4" /> Resume
                </Button>
              ) : [
                  'active',
                  'sleeping',
                  'waiting_for_input',
                  'waiting_for_approval',
                  'degraded',
                ].includes(operator.status) ? (
                <Button
                  variant="outline"
                  disabled={pending || !online}
                  onClick={() => lifecycleMutation.mutate('pause')}
                >
                  <CirclePause className="size-4" /> Pause
                </Button>
              ) : null}
              <Button
                variant="outline"
                disabled={
                  pending ||
                  !online ||
                  !['active', 'sleeping', 'waiting_for_input', 'waiting_for_approval'].includes(
                    operator.status
                  )
                }
                onClick={() => lifecycleMutation.mutate('wake')}
              >
                <Zap className="size-4" /> Wake now
              </Button>
              <ConfirmActionDialog
                trigger={
                  <Button
                    variant="outline"
                    disabled={
                      pending || !online || ['stopped', 'archived'].includes(operator.status)
                    }
                  >
                    <OctagonX className="size-4" /> Stop
                  </Button>
                }
                title={`Stop ${operator.name}?`}
                description="This cancels active evaluation lanes and unresolved signals. The Operator definition, evidence, and audit history remain available."
                confirmLabel="Stop operator"
                pendingLabel="Stopping operator"
                pending={pending}
                destructive
                onConfirm={() => lifecycleMutation.mutate('stop')}
              />
            </>
          }
        />
      </div>

      {!online ? (
        <Alert className="border-amber-300/60 bg-amber-50/70 dark:border-amber-300/20 dark:bg-amber-400/10">
          <WifiOff className="size-4" />
          <AlertTitle>Offline — controls are disabled</AlertTitle>
          <AlertDescription>
            The most recent durable ledger remains visible. Reconnection will refresh evaluations,
            delivery receipts, and lifecycle state.
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="grid divide-y border-y border-(--agency-shell-border) sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5">
        <OperatorMetric
          label="Lifecycle"
          value={operator.status.replaceAll('_', ' ')}
          detail={`Updated ${formatRelativeTime(operator.updated_at)}`}
        />
        <OperatorMetric
          label="Next wake"
          value={formatRelativeTime(operator.next_evaluation_at)}
          detail={formatOperatorTime(operator.next_evaluation_at)}
        />
        <OperatorMetric
          label="Latest decision"
          value={<DecisionBadge decision={latestEvaluation?.decision?.decision} />}
          detail={
            latestEvaluation ? formatRelativeTime(latestEvaluation.created_at) : 'No evaluation'
          }
        />
        <OperatorMetric
          label="Actions"
          value={latestEvaluation?.action_count ?? '—'}
          detail={`Configured max ${budget.maxActions || '—'}`}
        />
        <OperatorMetric
          label="Refresh"
          value={operatorQuery.isFetching ? 'Syncing' : 'Current'}
          detail={formatRelativeTime(lastRefresh ? new Date(lastRefresh).toISOString() : null)}
        />
      </section>

      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="h-auto w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="goals">Goals & runs</TabsTrigger>
          <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section>
              <SectionHeading
                icon={History}
                title="Decision lineage"
                description="Every wake is connected to its signal, rationale, approvals, executions, and durable evidence. No-action decisions remain first-class records."
              />
              <DecisionLineage
                evaluations={evaluationsQuery.data?.items ?? []}
                signals={signalsQuery.data?.items ?? []}
                workspaceId={workspaceId}
              />
            </section>
            <SupervisionRail
              readModel={readModel}
              goals={goalsQuery.data?.items ?? []}
              capabilities={capabilitiesQuery.data?.items ?? []}
              notifications={notificationsQuery.data?.items ?? []}
              commitments={commitmentsQuery.data?.items ?? []}
              triggers={triggersQuery.data?.items ?? []}
              workspaceId={workspaceId}
            />
          </div>
        </TabsContent>
        <TabsContent value="activity">
          <SectionHeading
            icon={Activity}
            title="Signals and evaluations"
            description="The durable wake-up ledger, including inputs that resolved without an action."
          />
          <DecisionLineage
            evaluations={evaluationsQuery.data?.items ?? []}
            signals={signalsQuery.data?.items ?? []}
            workspaceId={workspaceId}
          />
        </TabsContent>
        <TabsContent value="goals">
          <SectionHeading
            icon={Goal}
            title="Goal portfolio"
            description="Goals currently supervised by this Operator. Executions remain owned by Open Agency’s run ledger."
          />
          <GoalList items={goalsQuery.data?.items ?? []} />
        </TabsContent>
        <TabsContent value="capabilities">
          <SectionHeading
            icon={ShieldCheck}
            title="Granted capabilities"
            description="Only explicitly bound, currently available Open Agency resources can be selected during evaluation."
          />
          <CapabilityList items={capabilitiesQuery.data?.items ?? []} />
        </TabsContent>
        <TabsContent value="delivery">
          <SectionHeading
            icon={BellRing}
            title="Delivery receipts"
            description="Durable notification state, retries, suppressions, and approval-gated delivery."
          />
          <NotificationList items={notificationsQuery.data?.items ?? []} />
        </TabsContent>
        <TabsContent value="configuration">
          <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="space-y-6">
              <SectionHeading
                icon={SlidersHorizontal}
                title="Boundaries and runtime facts"
                description="Canonical Open Agency policy. Adapter names appear only where the Operator definition or a resource grant binds them."
              />
              <Configuration readModel={readModel} />
              <TriggerConfiguration items={triggersQuery.data?.items ?? []} />
              <section className="border-t border-(--agency-shell-border) pt-6">
                <SectionHeading
                  icon={Sparkles}
                  title="Dry simulation"
                  description="Evaluate a sample signal through the real policy and adapter path. The authoritative result always performs no action and persists no signal or evaluation."
                />
                <Textarea
                  value={simulationSignal}
                  onChange={(event) => setSimulationSignal(event.target.value)}
                  rows={4}
                  className="mt-4"
                />
                <Button
                  className="mt-3"
                  variant="outline"
                  disabled={!online || !simulationSignal.trim() || simulationMutation.isPending}
                  onClick={() => simulationMutation.mutate()}
                >
                  {simulationMutation.isPending ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Play className="size-4" />
                  )}
                  Run dry simulation
                </Button>
                {simulationResult ? <SimulationResult result={simulationResult} /> : null}
              </section>
            </section>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Activity;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-(--agency-shell-border) text-(--agency-page-tone)">
        <Icon className="size-4" />
      </span>
      <div>
        <h2 className="text-lg font-semibold tracking-[-0.025em]">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-(--agency-shell-muted)">
          {description}
        </p>
      </div>
    </div>
  );
}

function DecisionLineage({
  evaluations,
  signals,
  workspaceId,
}: {
  evaluations: OperatorEvaluation[];
  signals: OperatorSignal[];
  workspaceId: string;
}) {
  const signalById = useMemo(
    () => new Map(signals.map((signal) => [signal.id, signal])),
    [signals]
  );
  if (!evaluations.length)
    return (
      <OperatorQueryState
        kind="empty"
        title="No evaluations yet"
        description="The first scheduled, event-driven, or manual wake will create a durable decision record."
      />
    );
  return (
    <ol className="relative mt-6 space-y-0 border-l border-(--agency-shell-border) pl-6">
      {evaluations.map((evaluation) => {
        const linkedSignals = evaluation.signal_ids
          .map((id) => signalById.get(id))
          .filter((signal): signal is OperatorSignal => Boolean(signal));
        return (
          <li
            key={evaluation.id}
            className="relative border-b border-(--agency-shell-border) pb-7 pt-1 first:pt-0 last:border-b-0"
          >
            <span className="absolute -left-[1.8rem] top-1.5 size-3 rounded-full border-2 border-background bg-(--agency-page-tone)" />
            <div className="flex flex-wrap items-center gap-2">
              <DecisionBadge decision={evaluation.decision?.decision} />
              <Badge variant="outline">{evaluation.status}</Badge>
              {evaluation.shadow_mode ? <Badge variant="outline">shadow</Badge> : null}
              <span className="ml-auto text-xs text-(--agency-shell-muted)">
                {formatOperatorTime(evaluation.created_at)}
              </span>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <LineageBlock label="Wake signal">
                {linkedSignals.length ? (
                  linkedSignals.map((signal) => (
                    <div key={signal.id}>
                      <p className="font-medium">
                        {signal.payload_summary || humanizeIdentifier(signal.signal_type)}
                      </p>
                      <p className="mt-1 text-xs text-(--agency-shell-muted)">
                        {signal.source} · {formatOperatorTime(signal.received_at)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p>Signal record unavailable for this evaluation.</p>
                )}
              </LineageBlock>
              <LineageBlock label="Decision rationale">
                <p>
                  {evaluation.decision?.rationale_summary ??
                    evaluation.failure_category ??
                    'No rationale recorded.'}
                </p>
              </LineageBlock>
              <LineageBlock label="Approvals">
                {evaluation.approval_request_ids.length ? (
                  evaluation.approval_request_ids.map((id) => (
                    <Link
                      key={id}
                      href={`/assistant?workspace=${encodeURIComponent(workspaceId)}&approval=${encodeURIComponent(id)}`}
                      className="block text-primary hover:underline"
                    >
                      Approval {id.slice(0, 12)} <ExternalLink className="inline size-3" />
                    </Link>
                  ))
                ) : (
                  <p>No approval requested.</p>
                )}
              </LineageBlock>
              <LineageBlock label="Executions and evidence">
                {evaluation.created_execution_ids.length ? (
                  evaluation.created_execution_ids.map((id) => (
                    <Link
                      key={id}
                      href={`/runs/${id}`}
                      className="block text-primary hover:underline"
                    >
                      Run {id.slice(0, 12)} <ExternalLink className="inline size-3" />
                    </Link>
                  ))
                ) : (
                  <p>No execution dispatched.</p>
                )}
                <p className="mt-1 text-xs text-(--agency-shell-muted)">
                  {evaluation.action_count} action(s) · {evaluation.iteration_count} iteration(s) ·
                  ${Number(evaluation.estimated_cost).toFixed(4)}
                </p>
              </LineageBlock>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function LineageBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-(--agency-shell-muted)">
        {label}
      </p>
      <div className="text-sm leading-6 text-(--agency-shell-text)">{children}</div>
    </div>
  );
}

function SupervisionRail({
  readModel,
  goals,
  capabilities,
  notifications,
  commitments,
  triggers,
  workspaceId,
}: {
  readModel: OperatorReadModel;
  goals: OperatorGoalPortfolioItem[];
  capabilities: OperatorCapabilityHealth[];
  notifications: OperatorNotificationReceipt[];
  commitments: Record<string, unknown>[];
  triggers: OperatorTrigger[];
  workspaceId: string;
}) {
  const order = readModel.active_standing_order;
  const activeGoals = goals.filter(
    (goal) => !['completed', 'cancelled', 'failed'].includes(goal.status)
  );
  const unavailable = capabilities.filter((item) => !item.available);
  const deliveryFailures = notifications.filter((item) => item.status === 'failed');
  const nextTrigger = triggers
    .filter((item) => item.enabled && item.next_fire_at)
    .sort((left, right) => String(left.next_fire_at).localeCompare(String(right.next_fire_at)))[0];
  return (
    <aside className="sticky top-24 divide-y border-y border-(--agency-shell-border) xl:border-l xl:pl-6">
      <RailSection title="Standing order">
        <p>{order?.instructions ?? 'No active standing order.'}</p>
        {order?.prohibited_actions?.length ? (
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-(--agency-shell-muted)">
            {order.prohibited_actions.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        ) : null}
      </RailSection>
      <RailSection title="Goals and waits">
        <p>{activeGoals.length ? `${activeGoals.length} active goal(s)` : 'No active goals'}</p>
        <p className="mt-1 text-xs text-(--agency-shell-muted)">
          {commitments.length ? `${commitments.length} open commitment(s)` : 'No open commitments'}
        </p>
      </RailSection>
      <RailSection title="Approvals and input">
        <p>
          {readModel.operator.status === 'waiting_for_approval'
            ? 'Operator is waiting for approval.'
            : readModel.operator.status === 'waiting_for_input'
              ? 'Operator is waiting for input.'
              : 'No lifecycle-level wait.'}
        </p>
        {['waiting_for_approval', 'waiting_for_input'].includes(readModel.operator.status) ? (
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link
              href={`/assistant?workspace=${encodeURIComponent(workspaceId)}&operator=${encodeURIComponent(readModel.operator.id)}`}
            >
              Open exact request <ExternalLink className="size-3" />
            </Link>
          </Button>
        ) : null}
      </RailSection>
      <RailSection title="Triggers and active hours">
        <p>
          {nextTrigger
            ? `${humanizeIdentifier(nextTrigger.trigger_type)} · ${formatOperatorTime(nextTrigger.next_fire_at)}`
            : 'No next trigger scheduled'}
        </p>
        <p className="mt-1 text-xs text-(--agency-shell-muted)">
          {nextTrigger?.active_hours
            ? `${nextTrigger.active_hours.start}–${nextTrigger.active_hours.end} ${nextTrigger.timezone}`
            : 'No active-hours window'}
          {nextTrigger?.cooldown_seconds ? ` · ${nextTrigger.cooldown_seconds}s cooldown` : ''}
        </p>
      </RailSection>
      <RailSection title="Capability health">
        <p className={unavailable.length ? 'text-rose-700 dark:text-rose-200' : ''}>
          {unavailable.length
            ? `${unavailable.length} unavailable of ${capabilities.length}`
            : `${capabilities.length} available`}
        </p>
      </RailSection>
      <RailSection title="Delivery">
        <p className={deliveryFailures.length ? 'text-rose-700 dark:text-rose-200' : ''}>
          {deliveryFailures.length
            ? `${deliveryFailures.length} failed receipt(s)`
            : 'No failed receipts'}
        </p>
      </RailSection>
    </aside>
  );
}

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-4">
      <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-(--agency-shell-muted)">
        {title}
      </h3>
      <div className="mt-2 text-sm leading-6">{children}</div>
    </section>
  );
}

function GoalList({ items }: { items: OperatorGoalPortfolioItem[] }) {
  if (!items.length)
    return (
      <OperatorQueryState
        kind="empty"
        title="No goals"
        description="This Operator has not created or adopted a goal."
      />
    );
  return (
    <div className="mt-6 divide-y border-y border-(--agency-shell-border)">
      {items.map((goal) => (
        <div key={goal.id} className="flex items-start gap-4 py-4">
          <Goal className="mt-1 size-4 text-(--agency-page-tone)" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{goal.objective}</p>
            <p className="mt-1 text-xs text-(--agency-shell-muted)">
              {humanizeIdentifier(goal.status)} · priority {goal.priority ?? 'not set'}
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/goals/${goal.id}`}>
              View <ExternalLink className="size-3" />
            </Link>
          </Button>
        </div>
      ))}
    </div>
  );
}

function CapabilityList({ items }: { items: OperatorCapabilityHealth[] }) {
  if (!items.length)
    return (
      <OperatorQueryState
        kind="empty"
        title="No capabilities granted"
        description="The Operator cannot select workflows, tools, connectors, or adapters until a resource is explicitly bound."
      />
    );
  return (
    <div className="mt-6 divide-y border-y border-(--agency-shell-border)">
      {items.map((item) => (
        <div key={item.binding_id} className="flex items-center gap-4 py-4">
          <span
            className={`size-2 rounded-full ${item.available ? 'bg-emerald-500' : 'bg-rose-500'}`}
          />
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {humanizeIdentifier(item.resource_type)} · {item.resource_id}
            </p>
            <p className="mt-1 text-xs text-(--agency-shell-muted)">
              {item.role}
              {item.reason ? ` · ${item.reason}` : ''}
            </p>
          </div>
          <Badge variant={item.available ? 'successful' : 'failed'}>
            {item.available ? 'Available' : 'Unavailable'}
          </Badge>
        </div>
      ))}
    </div>
  );
}

function NotificationList({ items }: { items: OperatorNotificationReceipt[] }) {
  if (!items.length)
    return (
      <OperatorQueryState
        kind="empty"
        title="No delivery receipts"
        description="Notifications, suppressions, and approval-gated delivery attempts will appear here."
      />
    );
  return (
    <div className="mt-6 divide-y border-y border-(--agency-shell-border)">
      {items.map((item) => (
        <div key={item.id} className="py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                item.status === 'failed'
                  ? 'failed'
                  : item.status === 'delivered'
                    ? 'successful'
                    : 'outline'
              }
            >
              {humanizeIdentifier(item.status)}
            </Badge>
            <Badge variant="outline">{humanizeIdentifier(item.delivery_class)}</Badge>
            <span className="ml-auto text-xs text-(--agency-shell-muted)">
              {formatOperatorTime(item.created_at)}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6">{item.content_summary}</p>
          {item.failure_summary ? (
            <p className="mt-1 text-xs text-rose-700 dark:text-rose-200">{item.failure_summary}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function Configuration({ readModel }: { readModel: OperatorReadModel }) {
  const { operator, resource_bindings: bindings } = readModel;
  const runtimeBindings = bindings.filter((binding) =>
    ['runtime_adapter', 'isolation_provider', 'execution_host', 'runtime_profile'].includes(
      binding.resource_type
    )
  );
  return (
    <div className="mt-6 divide-y border-y border-(--agency-shell-border)">
      <ConfigRow label="Evaluation harness" value={operator.evaluation_adapter_id} />
      <ConfigRow label="Workflow runtime adapter" value={operator.default_runtime_adapter_id} />
      <ConfigRow label="Isolation provider" value={operator.default_isolation_provider_id} />
      <ConfigRow
        label="Runtime profile"
        value={operator.default_runtime_profile_id ?? 'Not bound'}
      />
      <ConfigRow
        label="Model profile"
        value={operator.default_model_profile_id ?? 'Router policy'}
      />
      <ConfigRow
        label="Data residency"
        value={operator.execution_placement_policy.data_residency}
      />
      <ConfigRow
        label="Granted runtime resources"
        value={
          runtimeBindings.length
            ? runtimeBindings
                .map((binding) => `${binding.resource_type}: ${binding.resource_id}`)
                .join(', ')
            : 'No optional adapter resources bound'
        }
      />
      <ConfigRow label="Approval policy" value={<CodeValue value={operator.approval_policy} />} />
      <ConfigRow label="Budget policy" value={<CodeValue value={operator.budget_policy} />} />
      <ConfigRow
        label="Delivery and quiet hours"
        value={
          Object.keys(operator.delivery_policy).length ? (
            <CodeValue value={operator.delivery_policy} />
          ) : (
            'External delivery disabled; no quiet-hours override configured'
          )
        }
      />
    </div>
  );
}

function TriggerConfiguration({ items }: { items: OperatorTrigger[] }) {
  return (
    <section className="border-t border-(--agency-shell-border) pt-6">
      <SectionHeading
        icon={Clock3}
        title="Triggers and cadence"
        description="Heartbeat, exact schedules, active hours, cooldown, and next-fire state remain owned by Open Agency’s trigger ledger."
      />
      {items.length ? (
        <div className="mt-4 divide-y border-y border-(--agency-shell-border)">
          {items.map((trigger) => (
            <div key={trigger.id} className="grid gap-2 py-4 sm:grid-cols-[180px_minmax(0,1fr)]">
              <div>
                <Badge variant={trigger.enabled ? 'successful' : 'outline'}>
                  {trigger.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
                <p className="mt-2 text-sm font-medium">
                  {humanizeIdentifier(trigger.trigger_type)}
                </p>
              </div>
              <div className="text-sm leading-6">
                <p>Next: {formatOperatorTime(trigger.next_fire_at)}</p>
                <p className="text-(--agency-shell-muted)">
                  {trigger.interval_seconds
                    ? `Every ${trigger.interval_seconds} seconds`
                    : (trigger.schedule ?? 'Event-driven')}{' '}
                  · {trigger.timezone}
                </p>
                <p className="text-(--agency-shell-muted)">
                  {trigger.active_hours
                    ? `Active ${trigger.active_hours.start}–${trigger.active_hours.end}`
                    : 'No active-hours window'}{' '}
                  · {trigger.cooldown_seconds}s cooldown
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <OperatorQueryState
          kind="empty"
          title="No triggers configured"
          description="This Operator can still be awakened manually, but it has no scheduled or event-driven cadence."
        />
      )}
    </section>
  );
}

function ConfigRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-2 py-4 sm:grid-cols-[210px_minmax(0,1fr)]">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-(--agency-shell-muted)">
        {label}
      </p>
      <div className="min-w-0 break-words text-sm">{value}</div>
    </div>
  );
}
function CodeValue({ value }: { value: unknown }) {
  return (
    <code className="whitespace-pre-wrap break-words text-xs leading-5">
      {JSON.stringify(value, null, 2)}
    </code>
  );
}

function SimulationResult({ result }: { result: OperatorSimulation }) {
  return (
    <div className="mt-5 border-y border-(--agency-shell-border) py-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="successful">Simulation complete</Badge>
        <Badge variant="outline">No action performed</Badge>
        <Badge variant="outline">Not persisted</Badge>
      </div>
      <h3 className="mt-4 font-semibold">Shadow mode comparison</h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <LineageBlock label="Candidate decision">
          <DecisionBadge decision={result.candidate_decision.decision} />
          <p className="mt-2">{result.candidate_decision.rationale_summary}</p>
        </LineageBlock>
        <LineageBlock label="Authoritative result">
          <p className="font-medium">No action</p>
          <p className="mt-2">{result.authoritative_result.reason}</p>
        </LineageBlock>
      </div>
    </div>
  );
}
