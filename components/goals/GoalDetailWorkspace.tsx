'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  CirclePause,
  CirclePlay,
  Clock3,
  ExternalLink,
  ShieldAlert,
  Target,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import ConfirmActionDialog from '@/components/app-shell/ConfirmActionDialog';
import PageHeader from '@/components/app-shell/PageHeader';
import { Badge } from '@/components/library/shadcn/badge';
import { Button } from '@/components/library/shadcn/button';
import { Input } from '@/components/library/shadcn/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/library/shadcn/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/library/shadcn/tabs';
import { Textarea } from '@/components/library/shadcn/textarea';
import { goalsApi } from '@/lib/api/backend/goals';
import { runsApi } from '@/lib/api/backend/runs';
import { runSessionsApi } from '@/lib/api/backend/runSessions';
import { queryKeys } from '@/lib/react-query/queryKeys';
import type { JsonObject } from '@/types/api';
import type { GoalAutonomyMode } from '@/types/goals';
import type { ExecutionApprovalRequest, ExecutionWaitRecord } from '@/types/runtime';

const TERMINAL_GOALS = new Set(['completed', 'failed', 'cancelled', 'abandoned']);
const TERMINAL_RUNS = new Set(['completed', 'failed', 'cancelled']);

function formatDate(value?: unknown) {
  return typeof value === 'string' && value ? new Date(value).toLocaleString() : '—';
}

function text(value: unknown, fallback = '—') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function json(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export default function GoalDetailWorkspace({ goalId }: { goalId: string }) {
  const queryClient = useQueryClient();
  const detailQuery = useQuery({
    queryKey: queryKeys.backendGoalOperatorDetail(goalId),
    queryFn: () => goalsApi.getOperatorDetail(goalId),
    refetchInterval: 10_000,
  });
  const detail = detailQuery.data;
  const goal = detail?.goal;
  const [ownerDraft, setOwnerDraft] = useState('');
  const [criteriaDraft, setCriteriaDraft] = useState('');

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.backendGoalOperatorDetail(goalId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.backendGoalOperatorView({}) }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.backendGoalOperatorView({ active_only: true }),
      }),
    ]);
  };
  const actionMutation = useMutation({
    mutationFn: (payload: Parameters<typeof goalsApi.applyOperatorAction>[1]) =>
      goalsApi.applyOperatorAction(goalId, payload),
    onSuccess: async (_, payload) => {
      toast.success(`Goal ${payload.action.replace(/_/g, ' ')} completed.`);
      await invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Goal action failed.'),
  });
  const evaluationMutation = useMutation({
    mutationFn: () => goalsApi.evaluateGoal(goalId),
    onSuccess: async () => {
      toast.success('Goal evaluation refreshed.');
      await invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Evaluation failed.'),
  });

  if (detailQuery.isLoading)
    return (
      <State title="Loading goal" detail="Reading plan, runs, evidence, and supervision history." />
    );
  if (detailQuery.isError || !detail || !goal) {
    return (
      <State
        title="Goal could not be loaded"
        detail={
          detailQuery.error instanceof Error
            ? detailQuery.error.message
            : 'The durable goal is unavailable.'
        }
      />
    );
  }

  const actions = detail.operator_actions ?? {};
  const plan = detail.current_plan ?? {};
  const executions = Object.values(detail.executions ?? {});
  const artifactCount = Object.values(detail.artifacts ?? {}).reduce(
    (count, items) => count + items.length,
    0
  );
  const autonomy = String(
    goal.constraints?.autonomy ?? detail.autonomy ?? 'guarded'
  ) as GoalAutonomyMode;
  const criteriaText =
    criteriaDraft ||
    goal.success_criteria.map((item) => text(item.description, json(item))).join('\n');
  const ownerText = ownerDraft || goal.owner_actor || '';
  const terminal = TERMINAL_GOALS.has(goal.status);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Durable goal"
        icon={Target}
        tone="operator"
        title={goal.objective}
        description={`Goal ${goal.id}`}
        actions={
          <Button asChild variant="outline">
            <Link href="/goals">
              <ArrowLeft className="size-4" /> All goals
            </Link>
          </Button>
        }
      />

      <section className="grid divide-y border-y border-(--agency-shell-border) sm:grid-cols-3 sm:divide-x sm:divide-y-0 xl:grid-cols-6">
        <Metric label="Status" value={detail.status_label} />
        <Metric label="Priority" value={goal.priority} />
        <Metric label="Autonomy" value={autonomy} />
        <Metric label="Active runs" value={detail.active_execution_count} />
        <Metric label="Evidence" value={goal.evidence.length + artifactCount} />
        <Metric label="Deadline" value={formatDate(goal.deadline_at)} />
      </section>

      <div className="flex flex-wrap gap-2 border-b border-(--agency-shell-border) pb-5">
        {actions.pause ? (
          <Button
            variant="outline"
            disabled={actionMutation.isPending}
            onClick={() =>
              actionMutation.mutate({ action: 'pause', reason: 'Paused from goal supervision.' })
            }
          >
            <CirclePause className="size-4" /> Pause
          </Button>
        ) : null}
        {actions.resume ? (
          <Button
            variant="outline"
            disabled={actionMutation.isPending}
            onClick={() =>
              actionMutation.mutate({ action: 'resume', reason: 'Resumed from goal supervision.' })
            }
          >
            <CirclePlay className="size-4" /> Resume
          </Button>
        ) : null}
        {actions.cancel ? (
          <ConfirmActionDialog
            trigger={
              <Button variant="outline" disabled={actionMutation.isPending}>
                Cancel goal
              </Button>
            }
            title={
              goal.priority === 'high'
                ? 'Cancel this high-priority goal?'
                : 'Cancel this durable goal?'
            }
            description="Cancellation stops future supervision while preserving runs, evidence, waits, and the audit timeline. Active runs are controlled separately below."
            confirmLabel="Cancel goal"
            destructive
            pending={actionMutation.isPending}
            onConfirm={() =>
              actionMutation.mutate({
                action: 'cancel',
                reason: 'Cancelled from goal supervision.',
              })
            }
          />
        ) : null}
        <Button
          variant="outline"
          disabled={evaluationMutation.isPending}
          onClick={() => evaluationMutation.mutate()}
        >
          <CheckCircle2 className="size-4" /> Evaluate evidence
        </Button>
      </div>

      {detail.blocked ? (
        <section className="border-y border-rose-300 bg-rose-50/60 px-4 py-4 text-rose-950 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-100">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5" />
            <div>
              <h2 className="font-semibold">Goal needs attention</h2>
              <p className="mt-1 text-sm">
                {typeof detail.blocked_reason === 'string'
                  ? detail.blocked_reason
                  : json(detail.blocked_reason)}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <Tabs defaultValue="work">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="work">Plan and runs</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="supervision">Supervision</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="settings">Controls</TabsTrigger>
        </TabsList>

        <TabsContent value="work" className="space-y-7 pt-4">
          <Section title="Current plan" detail={`Version ${detail.active_plan_version ?? '—'}`}>
            {Object.keys(plan).length ? (
              <JsonBlock value={plan} />
            ) : (
              <Empty text="No active plan is recorded." />
            )}
          </Section>
          <Section title="Linked runs" detail={`${executions.length} attempt(s) under this goal`}>
            {executions.length ? (
              <div className="divide-y border-y border-(--agency-shell-border)">
                {executions.map((execution) => (
                  <GoalRunControl
                    key={text(execution.id)}
                    execution={execution}
                    highPriority={goal.priority === 'high'}
                    onChanged={() => void invalidate()}
                  />
                ))}
              </div>
            ) : (
              <Empty text="No workflow execution has been linked yet." />
            )}
          </Section>
        </TabsContent>

        <TabsContent value="evidence" className="space-y-7 pt-4">
          <Section
            title="Success criteria"
            detail={`${goal.success_criteria.length} criterion/criteria`}
          >
            <RecordList items={goal.success_criteria} empty="No success criteria recorded." />
          </Section>
          <Section
            title="Evidence"
            detail={`${detail.evidence.length} goal record(s), ${artifactCount} run artifact(s)`}
          >
            <RecordList items={detail.evidence} empty="No goal evidence has been attached." />
            {Object.entries(detail.artifacts).map(([executionId, artifacts]) => (
              <div key={executionId} className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-(--agency-shell-muted)">
                  Run {executionId}
                </p>
                <RecordList items={artifacts} empty="" />
              </div>
            ))}
          </Section>
          <Section title="Evaluation" detail={text(detail.evaluation?.status, 'Not evaluated')}>
            {detail.evaluation ? (
              <JsonBlock value={detail.evaluation} />
            ) : (
              <Empty text="Evaluate the evidence to record sufficiency and missing proof." />
            )}
          </Section>
        </TabsContent>

        <TabsContent value="supervision" className="space-y-7 pt-4">
          <Section title="Pending approvals" detail={`${detail.approvals.length} recorded`}>
            <RecordList items={detail.approvals} empty="No supervisor approval requests." />
          </Section>
          <Section
            title="Supervisor findings"
            detail={`${detail.supervisor.findings.length} recorded`}
          >
            <RecordList items={detail.supervisor.findings} empty="No supervisor findings." />
          </Section>
          <Section
            title="Automatic and operator actions"
            detail={`${detail.supervisor.supervisor_actions.length + detail.supervisor.operator_actions.length} recorded`}
          >
            <RecordList
              items={[
                ...detail.supervisor.supervisor_actions,
                ...detail.supervisor.operator_actions,
              ]}
              empty="No actions recorded."
            />
          </Section>
          <Section title="Memory scope" detail="Curated goal context">
            <JsonBlock value={detail.memory} />
          </Section>
        </TabsContent>

        <TabsContent value="timeline" className="pt-4">
          <Section title="Audit timeline" detail={`${detail.timeline.length} recent record(s)`}>
            {detail.timeline.length ? (
              <ol className="border-l border-(--agency-shell-border) pl-6">
                {detail.timeline.map((item, index) => (
                  <li
                    key={`${text(item.timestamp)}-${index}`}
                    className="relative border-b border-(--agency-shell-border) py-4 last:border-b-0"
                  >
                    <span className="absolute -left-[1.78rem] top-5 size-3 rounded-full border-2 border-background bg-(--agency-page-tone)" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{text(item.type, 'event')}</Badge>
                      <span className="text-xs text-(--agency-shell-muted)">
                        {formatDate(item.timestamp)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm">
                      {text(item.summary, text(item.event, 'Recorded event'))}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty text="No timeline events recorded." />
            )}
          </Section>
        </TabsContent>

        <TabsContent value="settings" className="space-y-7 pt-4">
          <Section title="Autonomy" detail="Changes apply to future supervisor decisions.">
            <Select
              value={autonomy}
              disabled={terminal || actionMutation.isPending}
              onValueChange={(value) =>
                actionMutation.mutate({
                  action: 'adjust_autonomy',
                  autonomy: value as GoalAutonomyMode,
                })
              }
            >
              <SelectTrigger className="max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['off', 'advisory', 'guarded', 'high_autonomy'].map((value) => (
                  <SelectItem key={value} value={value}>
                    {value.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Section>
          <Section title="Owner" detail="Reassign responsibility without changing goal history.">
            <div className="flex max-w-xl flex-col gap-2 sm:flex-row">
              <Input
                value={ownerText}
                onChange={(event) => setOwnerDraft(event.target.value)}
                placeholder="Owner actor"
                disabled={terminal}
              />
              <Button
                variant="outline"
                disabled={terminal || !ownerText.trim() || actionMutation.isPending}
                onClick={() =>
                  actionMutation.mutate({ action: 'reassign', owner_actor: ownerText.trim() })
                }
              >
                Reassign
              </Button>
            </div>
          </Section>
          <Section
            title="Success criteria"
            detail="One line becomes one explicit completion criterion."
          >
            <Textarea
              value={criteriaText}
              onChange={(event) => setCriteriaDraft(event.target.value)}
              rows={6}
              disabled={terminal}
            />
            <Button
              className="mt-3"
              variant="outline"
              disabled={terminal || actionMutation.isPending || !criteriaText.trim()}
              onClick={() =>
                actionMutation.mutate({
                  action: 'update_success_criteria',
                  success_criteria: criteriaText
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((description, index) => ({
                      id: `criterion-${index + 1}`,
                      type: 'operator_defined',
                      description,
                    })),
                })
              }
            >
              Save criteria
            </Button>
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GoalRunControl({
  execution,
  highPriority,
  onChanged,
}: {
  execution: JsonObject;
  highPriority: boolean;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const runId = text(execution.id, '');
  const status = text(execution.status, 'unknown');
  const [input, setInput] = useState('');
  const waitsQuery = useQuery({
    queryKey: queryKeys.backendRunWaits(runId),
    queryFn: () => runSessionsApi.listRunWaits(runId),
    enabled: Boolean(runId),
    refetchInterval: 10_000,
  });
  const approvalsQuery = useQuery({
    queryKey: queryKeys.backendRunApprovals(runId),
    queryFn: () => runSessionsApi.listRunApprovals(runId),
    enabled: Boolean(runId),
    refetchInterval: 10_000,
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.backendRunWaits(runId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.backendRunApprovals(runId) }),
    ]);
    onChanged();
  };
  const actionMutation = useMutation({
    mutationFn: (action: 'pause' | 'resume' | 'cancel') =>
      action === 'pause'
        ? runsApi.pauseRun(runId)
        : action === 'resume'
          ? runsApi.resumeRun(runId)
          : runsApi.cancelRun(runId),
    onSuccess: async (_, action) => {
      toast.success(`Run ${action}d.`);
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Run action failed.'),
  });
  const waitMutation = useMutation({
    // A stable key lets an operator safely retry after a lost response without
    // creating a competing durable-wait claim.
    mutationFn: ({
      wait,
      payload,
    }: {
      wait: ExecutionWaitRecord;
      payload: Record<string, unknown>;
    }) => runsApi.resolveRunWait(runId, wait.id, payload, `goal-view:${runId}:${wait.id}`),
    onSuccess: async () => {
      setInput('');
      toast.success('Wait resolved and run queued to resume.');
      await refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Wait resolution failed.'),
  });
  const approvalMutation = useMutation({
    mutationFn: ({
      approval,
      action,
    }: {
      approval: ExecutionApprovalRequest;
      action: 'approve' | 'reject';
    }) =>
      action === 'approve'
        ? runsApi.approveRun(runId, approval.tool_id ?? '', 'Decision from goal supervision.')
        : runsApi.rejectRun(runId, approval.tool_id ?? '', 'Decision from goal supervision.'),
    onSuccess: async (_, inputValue) => {
      toast.success(`Tool call ${inputValue.action}d.`);
      await refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Approval decision failed.'),
  });
  const wait = waitsQuery.data?.items[0] ?? null;
  const pendingApprovals = (approvalsQuery.data?.items ?? []).filter(
    (item) => item.status === 'pending' && item.tool_id
  );
  const terminal = TERMINAL_RUNS.has(status);
  const canPause =
    !terminal &&
    ![
      'paused',
      'waiting_for_input',
      'waiting_for_approval',
      'waiting_for_event',
      'sleeping',
    ].includes(status);

  return (
    <article className="py-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{status.replace(/_/g, ' ')}</Badge>
            <Badge variant="outline">{text(execution.runtime_adapter_id, 'runtime unknown')}</Badge>
          </div>
          <p className="mt-2 font-medium">Run {runId}</p>
          <p className="mt-1 text-xs text-(--agency-shell-muted)">
            Workflow {text(execution.workflow_id)} · updated {formatDate(execution.updated_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canPause ? (
            <Button
              size="sm"
              variant="outline"
              disabled={actionMutation.isPending}
              onClick={() => actionMutation.mutate('pause')}
            >
              <CirclePause className="size-4" /> Pause
            </Button>
          ) : null}
          {status === 'paused' && !wait ? (
            <Button
              size="sm"
              variant="outline"
              disabled={actionMutation.isPending}
              onClick={() => actionMutation.mutate('resume')}
            >
              <CirclePlay className="size-4" /> Resume
            </Button>
          ) : null}
          {!terminal ? (
            <ConfirmActionDialog
              trigger={
                <Button size="sm" variant="outline" disabled={actionMutation.isPending}>
                  Cancel run
                </Button>
              }
              title={highPriority ? 'Cancel this high-priority run?' : 'Cancel this run?'}
              description={
                wait
                  ? 'This discards the unresolved durable wait and cancels future continuation. The checkpoint and audit history remain.'
                  : 'This cooperatively stops active compute and removes pending wakeups.'
              }
              confirmLabel="Cancel run"
              destructive
              pending={actionMutation.isPending}
              onConfirm={() => actionMutation.mutate('cancel')}
            />
          ) : null}
          <Button asChild size="sm">
            <Link href={`/runs/${runId}`}>
              Full run <ExternalLink className="size-3" />
            </Link>
          </Button>
        </div>
      </div>

      {wait ? (
        <div className="mt-4 border-l-2 border-amber-400 pl-4">
          <div className="flex flex-wrap items-center gap-2">
            <Clock3 className="size-4 text-amber-600" />
            <p className="font-medium">Waiting for {wait.kind}</p>
            <span className="text-xs text-(--agency-shell-muted)">
              {wait.correlation_key
                ? `Correlation ${wait.correlation_key}`
                : wait.wake_at
                  ? `Wake ${formatDate(wait.wake_at)}`
                  : `Deadline ${formatDate(wait.deadline_at)}`}
            </span>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <JsonBlock value={wait.request_payload ?? {}} />
            <JsonBlock value={{ checkpoint: wait.checkpoint ?? {}, policy: wait.policy ?? {} }} />
          </div>
          {wait.kind === 'input' ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Provide requested input"
              />
              <Button
                disabled={!input.trim() || waitMutation.isPending}
                onClick={() =>
                  waitMutation.mutate({
                    wait,
                    payload: { response: input.trim(), source: 'goal_view' },
                  })
                }
              >
                Submit and resume
              </Button>
            </div>
          ) : null}
          {wait.kind === 'event' || wait.kind === 'sleep' ? (
            <Button
              className="mt-3"
              variant="outline"
              disabled={waitMutation.isPending}
              onClick={() =>
                waitMutation.mutate({ wait, payload: { wake_now: true, source: 'goal_view' } })
              }
            >
              Wake now
            </Button>
          ) : null}
        </div>
      ) : null}

      {pendingApprovals.length ? (
        <div className="mt-4 space-y-3">
          {pendingApprovals.map((approval) => (
            <div
              key={approval.id}
              className="flex flex-col gap-3 border-l-2 border-violet-400 pl-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">Approval for {approval.tool_id}</p>
                <p className="text-xs text-(--agency-shell-muted)">
                  {json(approval.request_payload)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={approvalMutation.isPending}
                  onClick={() => approvalMutation.mutate({ approval, action: 'approve' })}
                >
                  <CheckCircle2 className="size-4" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={approvalMutation.isPending}
                  onClick={() => approvalMutation.mutate({ approval, action: 'reject' })}
                >
                  <XCircle className="size-4" /> Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="px-4 py-4">
      <p className="text-xs uppercase tracking-[0.1em] text-(--agency-shell-muted)">{label}</p>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
}
function Section({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-(--agency-shell-border) pb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-xs text-(--agency-shell-muted)">{detail}</p>
      </div>
      <div className="pt-4">{children}</div>
    </section>
  );
}
function Empty({ text: value }: { text: string }) {
  return <p className="py-6 text-sm text-(--agency-shell-muted)">{value}</p>;
}
function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-neutral-950 p-4 text-xs leading-5 text-neutral-100">
      {json(value)}
    </pre>
  );
}
function RecordList({ items, empty }: { items: JsonObject[]; empty: string }) {
  if (!items.length) return empty ? <Empty text={empty} /> : null;
  return (
    <div className="divide-y border-y border-(--agency-shell-border)">
      {items.map((item, index) => (
        <div key={text(item.id, String(index))} className="py-4">
          <p className="text-sm font-medium">
            {text(
              item.description,
              text(item.summary, text(item.name, text(item.kind, `Record ${index + 1}`)))
            )}
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-(--agency-shell-muted)">
              Inspect record
            </summary>
            <div className="mt-2">
              <JsonBlock value={item} />
            </div>
          </details>
        </div>
      ))}
    </div>
  );
}
function State({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="border-y border-(--agency-shell-border) py-12 text-center">
      <Target className="mx-auto size-6 text-(--agency-page-tone)" />
      <h1 className="mt-3 font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-(--agency-shell-muted)">{detail}</p>
    </section>
  );
}
