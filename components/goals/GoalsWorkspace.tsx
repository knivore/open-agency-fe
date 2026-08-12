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
  Search,
  Target,
} from 'lucide-react';
import { toast } from 'sonner';
import ConfirmActionDialog from '@/components/app-shell/ConfirmActionDialog';
import PageHeader from '@/components/app-shell/PageHeader';
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

export default function GoalsWorkspace() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [objective, setObjective] = useState('');
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
    return (goalsQuery.data?.items ?? []).filter(
      (item) =>
        !query ||
        [item.goal.objective, item.goal.id, item.goal.status, item.goal.owner_actor]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [goalsQuery.data?.items, search]);
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

      <section className="grid divide-y border-y border-(--agency-shell-border) sm:grid-cols-5 sm:divide-x sm:divide-y-0">
        <Metric label="Goals" value={goalsQuery.data?.count ?? '—'} />
        <Metric label="Blocked" value={summary?.blocked_count ?? '—'} />
        <Metric label="Stale" value={summary?.stale_count ?? '—'} />
        <Metric label="Approvals" value={summary?.pending_approval_count ?? '—'} />
        <Metric label="Automatic actions" value={summary?.automatic_action_count ?? '—'} />
      </section>

      <form
        className="grid gap-2 border-b border-(--agency-shell-border) pb-5 sm:grid-cols-[minmax(0,1fr)_auto]"
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

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-(--agency-shell-muted)" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Filter goals"
          className="pl-9"
          aria-label="Filter goals"
        />
      </div>

      {goalsQuery.isLoading ? (
        <State title="Loading goals" detail="Reading durable goal and supervision state." />
      ) : goalsQuery.isError ? (
        <State
          title="Goals could not be loaded"
          detail={
            goalsQuery.error instanceof Error
              ? goalsQuery.error.message
              : 'The goal service is unavailable.'
          }
        />
      ) : items.length === 0 ? (
        <State
          title="No goals found"
          detail={
            search
              ? 'Change the filter to inspect another objective.'
              : 'Create a durable objective to begin supervised work.'
          }
        />
      ) : (
        <div className="divide-y border-y border-(--agency-shell-border)">
          {items.map((item) => {
            const goal = item.goal;
            const pending =
              actionMutation.isPending && actionMutation.variables?.summary.goal.id === goal.id;
            return (
              <article
                key={goal.id}
                className="grid gap-4 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={statusVariant(goal.status)}>{item.status_label}</Badge>
                    <Badge variant="outline">{goal.priority}</Badge>
                    <Badge variant="outline">{item.autonomy}</Badge>
                    {item.blocked ? <Badge variant="failed">Blocked</Badge> : null}
                    {item.stale ? <Badge variant="failed">Stale</Badge> : null}
                  </div>
                  <h2 className="mt-3 text-lg font-semibold tracking-[-0.02em]">
                    {goal.objective}
                  </h2>
                  <p className="mt-2 text-sm text-(--agency-shell-muted)">
                    {item.active_execution_count} active /{' '}
                    {item.linked_execution_count ?? goal.execution_ids.length} linked runs
                    {' · '}deadline {formatDate(goal.deadline_at)}
                  </p>
                  {item.blocked_reason ? (
                    <p className="mt-2 flex items-start gap-2 text-sm text-rose-700 dark:text-rose-200">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                      {typeof item.blocked_reason === 'string'
                        ? item.blocked_reason
                        : JSON.stringify(item.blocked_reason)}
                    </p>
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
                      onConfirm={() => actionMutation.mutate({ summary: item, action: 'cancel' })}
                    />
                  ) : null}
                  <Button asChild>
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
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="px-4 py-4">
      <p className="text-xs uppercase tracking-[0.1em] text-(--agency-shell-muted)">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function State({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="border-y border-(--agency-shell-border) py-10 text-center">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-(--agency-shell-muted)">{detail}</p>
    </section>
  );
}
