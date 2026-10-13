'use client';

import AppState from '@/components/app-shell/AppState';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CirclePause, CirclePlay, Plus, Target } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmActionDialog from '@/components/app-shell/ConfirmActionDialog';
import PageHeader from '@/components/app-shell/PageHeader';
import WorkspaceToolbar from '@/components/app-shell/WorkspaceToolbar';
import WorkspaceMetrics from '@/components/app-shell/WorkspaceMetrics';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/library/shadcn/tabs';
import { Badge } from '@/components/library/shadcn/badge';
import { Button } from '@/components/library/shadcn/button';
import { Input } from '@/components/library/shadcn/input';
import { goalsApi } from '@/lib/api/backend/goals';
import { queryKeys } from '@/lib/react-query/queryKeys';
import type { GoalOperatorSummary } from '@/types/goals';

const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'abandoned']);

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : 'Not set';
}

function statusVariant(status: string) {
  if (status === 'completed') return 'successful' as const;
  if (status === 'failed' || status === 'cancelled') return 'failed' as const;
  return 'outline' as const;
}

function blockerLabel(reason: object): string {
  const fields = reason as Record<string, unknown>;
  for (const key of ['message', 'summary', 'reason', 'category', 'status']) {
    if (typeof fields[key] === 'string') return String(fields[key]).replaceAll('_', ' ');
  }
  return 'Review supervision details';
}

export default function GoalsWorkspace() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [objective, setObjective] = useState('');
  const [view, setView] = useState('active');
  const goalsQuery = useQuery({
    queryKey: queryKeys.backendGoalOperatorView({}),
    queryFn: () => goalsApi.getOperatorView(),
    refetchInterval: 15_000,
  });
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.backendGoalOperatorView({}) });
  const createMutation = useMutation({
    mutationFn: () =>
      goalsApi.createGoal({
        objective: objective.trim(),
        status: 'active',
        priority: 'normal',
        constraints: { autonomy: 'guarded' },
        success_criteria: [
          {
            type: 'operator_defined',
            description: 'Attach evidence that demonstrates the objective is complete.',
          },
        ],
        metadata: { source: 'goals_workspace' },
      }),
    onSuccess: async () => {
      setObjective('');
      toast.success('Goal created.');
      await invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Goal creation failed.'),
  });
  const actionMutation = useMutation({
    mutationFn: ({
      summary,
      action,
    }: {
      summary: GoalOperatorSummary;
      action: 'pause' | 'resume' | 'cancel';
    }) =>
      goalsApi.applyOperatorAction(summary.goal.id, {
        action,
        reason: `${action} requested from the Goals workspace.`,
      }),
    onSuccess: async (_, input) => {
      toast.success(`Goal ${input.action}d.`);
      await invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Goal action failed.'),
  });
  const items = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (goalsQuery.data?.items ?? []).filter((item) => {
      const terminal = TERMINAL.has(item.goal.status);
      const matchesView =
        view === 'all' ||
        (view === 'history'
          ? terminal
          : view === 'attention'
            ? !terminal && (item.blocked || item.stale || (item.pending_approval_count ?? 0) > 0 || item.goal.status === 'waiting_for_input')
            : !terminal);
      return (
        matchesView &&
        (!query ||
          [item.goal.objective, item.goal.id, item.goal.status, item.goal.owner_actor]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query)))
      );
    });
  }, [goalsQuery.data?.items, search, view]);
  const summary = goalsQuery.data?.summary;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Autonomous work"
        icon={Target}
        tone="operator"
        title="Goals"
        description="Durable objectives supervised across workflow attempts, waits, evidence, and approvals."
      />

      <WorkspaceMetrics
        items={[
          {
            label: 'Goals',
            value: goalsQuery.data?.count ?? '—',
            onSelect: () => setView('all'),
            selected: view === 'all',
          },
          {
            label: 'Active blockers',
            value: goalsQuery.data ? goalsQuery.data.items.filter(item => !TERMINAL.has(item.goal.status) && item.blocked).length : '—',
            onSelect: () => setView('attention'),
            selected: view === 'attention',
          },
          { label: 'Active stale', value: goalsQuery.data ? goalsQuery.data.items.filter(item => !TERMINAL.has(item.goal.status) && item.stale).length : '—' },
          { label: 'Approvals', value: summary?.pending_approval_count ?? '—' },
          { label: 'Recorded actions', value: summary?.automatic_action_count ?? '—' },
        ]}
      />

      <form
        className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          if (objective.trim().length > 3) createMutation.mutate();
        }}
      >
        <Input
          value={objective}
          onChange={(event) => setObjective(event.target.value)}
          placeholder="Create a durable goal"
          aria-label="Goal objective"
        />
        <Button type="submit" disabled={objective.trim().length < 4 || createMutation.isPending}>
          <Plus className="size-4" /> {createMutation.isPending ? 'Creating' : 'Create goal'}
        </Button>
      </form>

      <Tabs value={view} onValueChange={setView} activationMode="manual">
        <TabsList aria-label="Goal views" className="h-auto flex-wrap">
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="attention">Needs attention</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="all">All goals</TabsTrigger>
        </TabsList>
        <TabsContent value={view} className="flex flex-col gap-4 pt-3">
          <WorkspaceToolbar
            search={{ label: 'Filter goals', value: search, onChange: setSearch }}
            summary={`${items.length} goals in this view`}
            onReset={search ? () => setSearch('') : undefined}
          />

          {goalsQuery.isLoading ? (
            <AppState
              variant="loading"
              title="Loading goals"
              description="Reading durable goal and supervision state."
            />
          ) : goalsQuery.isError ? (
            <AppState
              variant="error"
              title="Goals could not be loaded"
              description={
                goalsQuery.error instanceof Error
                  ? goalsQuery.error.message
                  : 'The goal service is unavailable.'
              }
            />
          ) : items.length === 0 ? (
            <AppState
              variant="empty"
              title="No goals found"
              description={
                search
                  ? 'Change the filter to inspect another objective.'
                  : 'Create a durable objective to begin supervised work.'
              }
            />
          ) : (
            <div className="divide-y overflow-hidden rounded-xl border bg-card">
              {items.map((item) => {
                const goal = item.goal;
                const pending =
                  actionMutation.isPending && actionMutation.variables?.summary.goal.id === goal.id;
                return (
                  <article
                    key={goal.id}
                    className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={statusVariant(goal.status)}>{item.status_label.replaceAll('_', ' ')}</Badge>
                        <Badge variant="outline">{goal.priority}</Badge>
                        <Badge variant="outline">{item.autonomy}</Badge>
                        {item.blocked ? <Badge variant="failed">{TERMINAL.has(goal.status) ? 'Previously blocked' : 'Blocked'}</Badge> : null}
                        {item.stale ? <Badge variant="failed">Stale</Badge> : null}
                      </div>
                      <h2
                        title={goal.objective}
                        className="mt-3 line-clamp-2 text-base font-semibold leading-6 tracking-[-0.02em]"
                      >
                        {goal.objective}
                      </h2>
                      <p className="mt-2 text-sm text-(--agency-shell-muted)">
                        {item.active_execution_count} active /{' '}
                        {item.linked_execution_count ?? goal.execution_ids.length} linked runs
                        {' · '}deadline {formatDate(goal.deadline_at)}
                      </p>
                      {item.blocked_reason ? (
                        <div className="mt-2 flex min-w-0 items-start gap-2 text-sm text-rose-700 dark:text-rose-200">
                          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                          {typeof item.blocked_reason === 'string' ? (
                            item.blocked_reason
                          ) : (
                            <details className="min-w-0">
                              <summary className="cursor-pointer capitalize">
                                {blockerLabel(item.blocked_reason)}
                              </summary>
                              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg border bg-background p-3 text-xs">
                                {JSON.stringify(item.blocked_reason, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {goal.status === 'paused' ? (
                        <Button
                          variant="outline"
                          disabled={pending}
                          onClick={() => actionMutation.mutate({ summary: item, action: 'resume' })}
                        >
                          <CirclePlay className="size-4" /> Resume
                        </Button>
                      ) : !TERMINAL.has(goal.status) ? (
                        <Button
                          variant="outline"
                          disabled={pending}
                          onClick={() => actionMutation.mutate({ summary: item, action: 'pause' })}
                        >
                          <CirclePause className="size-4" /> Pause
                        </Button>
                      ) : null}
                      {!TERMINAL.has(goal.status) ? (
                        <ConfirmActionDialog
                          trigger={
                            <Button variant="outline" disabled={pending}>
                              Cancel
                            </Button>
                          }
                          title="Cancel this durable goal?"
                          description="This stops future supervision and preserves linked runs, evidence, and audit history. Active runs remain separately controllable."
                          confirmLabel="Cancel goal"
                          destructive
                          pending={pending}
                          onConfirm={() =>
                            actionMutation.mutate({ summary: item, action: 'cancel' })
                          }
                        />
                      ) : null}
                      <Button asChild variant="outline">
                        <Link href={`/goals/${goal.id}`}>
                          Inspect <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
