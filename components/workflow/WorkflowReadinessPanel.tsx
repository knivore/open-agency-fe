import { AlertTriangle, CheckCircle2, CircleDotDashed } from 'lucide-react';
import { Badge } from '@/components/library/shadcn/badge';
import type { TaskDefinition, WorkflowDefinition } from '@/types/workflows';

export type WorkflowReadinessCheckStatus = 'attention' | 'blocked' | 'ready';

export interface WorkflowReadinessCheck {
  id: string;
  label: string;
  description: string;
  href: '#workflow-graph' | '#workflow-metadata' | '#workflow-readiness';
  status: WorkflowReadinessCheckStatus;
}

export interface WorkflowReadinessAssessment {
  status: WorkflowReadinessCheckStatus;
  label: 'Blocked' | 'Needs attention' | 'Ready to run';
  description: string;
  blockerCount: number;
  attentionCount: number;
  checks: WorkflowReadinessCheck[];
}

interface AssessWorkflowReadinessInput {
  workflow: WorkflowDefinition;
  visibleTaskDefinitions: TaskDefinition[];
  effectiveEntrypointTaskId: string;
  isEditing: boolean;
  hasUnsavedChanges: boolean;
  draftValidationIssues: string[];
  backendValidationErrors: string[];
  backendValidationWarnings: string[];
}

function check(
  id: string,
  label: string,
  description: string,
  href: WorkflowReadinessCheck['href'],
  status: WorkflowReadinessCheckStatus
): WorkflowReadinessCheck {
  return { id, label, description, href, status };
}

export function assessWorkflowReadiness({
  workflow,
  visibleTaskDefinitions,
  effectiveEntrypointTaskId,
  isEditing,
  hasUnsavedChanges,
  draftValidationIssues,
  backendValidationErrors,
  backendValidationWarnings,
}: AssessWorkflowReadinessInput): WorkflowReadinessAssessment {
  const agents = workflow.agent_definitions ?? [];
  const agentIds = new Set(agents.map((agent) => agent.id));
  const unassignedTasks = visibleTaskDefinitions.filter((task) => !task.agent_id);
  const missingAgentTasks = visibleTaskDefinitions.filter(
    (task) => task.agent_id && !agentIds.has(task.agent_id)
  );
  const hasEntrypoint = visibleTaskDefinitions.some(
    (task) => task.id === effectiveEntrypointTaskId
  );
  const defaultRuntime = workflow.default_runtime_adapter_id?.trim();
  const allowedRuntimeAdapters = workflow.allowed_runtime_adapter_ids ?? [];
  const runtimeAllowed = Boolean(
    defaultRuntime &&
    (allowedRuntimeAdapters.length === 0 || allowedRuntimeAdapters.includes(defaultRuntime))
  );
  const validationIssueCount = draftValidationIssues.length + backendValidationErrors.length;
  const checks: WorkflowReadinessCheck[] = [
    workflow.name.trim() && workflow.description?.trim()
      ? check(
          'purpose',
          'Purpose',
          'The workflow has a clear name and description.',
          '#workflow-metadata',
          'ready'
        )
      : workflow.name.trim()
        ? check(
            'purpose',
            'Purpose',
            'Add a short description so operators and the Assistant understand the intended result.',
            '#workflow-metadata',
            'attention'
          )
        : check(
            'purpose',
            'Purpose',
            'Add a workflow name before saving or running.',
            '#workflow-metadata',
            'blocked'
          ),
    visibleTaskDefinitions.length === 0
      ? check(
          'execution-path',
          'Execution path',
          'Add at least one task to define what the workflow should do.',
          '#workflow-graph',
          'blocked'
        )
      : hasEntrypoint
        ? check(
            'execution-path',
            'Execution path',
            `${visibleTaskDefinitions.length} task${visibleTaskDefinitions.length === 1 ? '' : 's'} with a valid entrypoint.`,
            '#workflow-graph',
            'ready'
          )
        : check(
            'execution-path',
            'Execution path',
            'Choose an entrypoint that matches an existing task.',
            '#workflow-metadata',
            'blocked'
          ),
    agents.length === 0
      ? check(
          'agents',
          'Agent coverage',
          'Add an agent and assign it to the workflow tasks.',
          '#workflow-graph',
          'blocked'
        )
      : unassignedTasks.length > 0 || missingAgentTasks.length > 0
        ? check(
            'agents',
            'Agent coverage',
            `${unassignedTasks.length} unassigned and ${missingAgentTasks.length} invalid agent reference${missingAgentTasks.length === 1 ? '' : 's'}.`,
            '#workflow-graph',
            'blocked'
          )
        : check(
            'agents',
            'Agent coverage',
            `Every task is assigned to one of ${agents.length} workflow agent${agents.length === 1 ? '' : 's'}.`,
            '#workflow-graph',
            'ready'
          ),
    !defaultRuntime
      ? check(
          'runtime',
          'Runtime',
          'Choose a default runtime adapter before running.',
          '#workflow-metadata',
          'blocked'
        )
      : runtimeAllowed
        ? check(
            'runtime',
            'Runtime',
            `${defaultRuntime} is available as the default runtime adapter.`,
            '#workflow-metadata',
            'ready'
          )
        : check(
            'runtime',
            'Runtime',
            `${defaultRuntime} is not included in the allowed runtime adapters.`,
            '#workflow-metadata',
            'blocked'
          ),
    validationIssueCount > 0
      ? check(
          'validation',
          'Validation',
          `${validationIssueCount} blocking validation issue${validationIssueCount === 1 ? '' : 's'} must be fixed.`,
          '#workflow-readiness',
          'blocked'
        )
      : backendValidationWarnings.length > 0
        ? check(
            'validation',
            'Validation',
            `${backendValidationWarnings.length} backend warning${backendValidationWarnings.length === 1 ? '' : 's'} should be reviewed.`,
            '#workflow-readiness',
            'attention'
          )
        : check(
            'validation',
            'Validation',
            'No blocking local or backend validation issues are visible.',
            '#workflow-readiness',
            'ready'
          ),
    isEditing && hasUnsavedChanges
      ? check(
          'draft',
          'Saved state',
          'Autosave is still applying the latest draft changes.',
          '#workflow-metadata',
          'attention'
        )
      : check(
          'draft',
          'Saved state',
          isEditing ? 'The current draft is saved.' : 'The saved workflow definition is active.',
          '#workflow-metadata',
          'ready'
        ),
  ];

  const blockerCount = checks.filter((item) => item.status === 'blocked').length;
  const attentionCount = checks.filter((item) => item.status === 'attention').length;
  if (blockerCount > 0) {
    return {
      status: 'blocked',
      label: 'Blocked',
      description: `${blockerCount} required item${blockerCount === 1 ? '' : 's'} must be fixed before this workflow is ready.`,
      blockerCount,
      attentionCount,
      checks,
    };
  }
  if (attentionCount > 0) {
    return {
      status: 'attention',
      label: 'Needs attention',
      description: `${attentionCount} non-blocking item${attentionCount === 1 ? '' : 's'} should be reviewed before running.`,
      blockerCount,
      attentionCount,
      checks,
    };
  }
  return {
    status: 'ready',
    label: 'Ready to run',
    description: 'Purpose, execution path, agents, runtime, validation, and saved state are ready.',
    blockerCount,
    attentionCount,
    checks,
  };
}

const readinessTone = {
  attention: {
    badge:
      'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-300/25 dark:bg-amber-400/10 dark:text-amber-100',
    panel: 'border-amber-200 bg-amber-50/55 dark:border-amber-300/20 dark:bg-amber-400/8',
    icon: AlertTriangle,
    iconClass: 'text-amber-700 dark:text-amber-200',
  },
  blocked: {
    badge:
      'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-300/25 dark:bg-rose-400/10 dark:text-rose-100',
    panel: 'border-rose-200 bg-rose-50/55 dark:border-rose-300/20 dark:bg-rose-400/8',
    icon: AlertTriangle,
    iconClass: 'text-rose-700 dark:text-rose-200',
  },
  ready: {
    badge:
      'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-300/25 dark:bg-emerald-400/10 dark:text-emerald-100',
    panel: 'border-emerald-200 bg-emerald-50/55 dark:border-emerald-300/20 dark:bg-emerald-400/8',
    icon: CheckCircle2,
    iconClass: 'text-emerald-700 dark:text-emerald-200',
  },
} satisfies Record<WorkflowReadinessCheckStatus, Record<string, unknown>>;

export default function WorkflowReadinessPanel({
  assessment,
}: {
  assessment: WorkflowReadinessAssessment;
}) {
  const tone = readinessTone[assessment.status];
  const StatusIcon = tone.icon;

  return (
    <section
      id="workflow-readiness"
      className={`rounded-xl border px-4 py-3 ${tone.panel}`}
      aria-labelledby="workflow-readiness-title"
      aria-live="polite"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-current/15 bg-white/70 dark:bg-slate-950/50">
            <StatusIcon className={`size-4.5 ${tone.iconClass}`} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="workflow-readiness-title"
                className="font-semibold text-neutral-950 dark:text-slate-100"
              >
                Run readiness
              </h2>
              <Badge variant="outline" className={tone.badge}>
                {assessment.label}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-neutral-600 dark:text-slate-300">
              {assessment.description}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2 text-xs text-neutral-600 dark:text-slate-300">
          <span className="rounded-full border border-current/10 bg-white/65 px-2.5 py-1 dark:bg-slate-950/45">
            {assessment.checks.filter((item) => item.status === 'ready').length} ready
          </span>
          {assessment.blockerCount > 0 ? (
            <span className="rounded-full border border-rose-300/60 bg-white/65 px-2.5 py-1 text-rose-700 dark:bg-slate-950/45 dark:text-rose-200">
              {assessment.blockerCount} blocked
            </span>
          ) : null}
        </div>
      </div>

      <details className="group mt-3" {...(assessment.blockerCount > 0 ? { open: true } : {})}>
        <summary className="cursor-pointer list-none text-sm font-medium text-neutral-700 outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-slate-200 [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2 rounded-md px-1 py-1 group-open:text-neutral-950 dark:group-open:text-white">
            <CircleDotDashed className="size-4" aria-hidden="true" />
            Review {assessment.checks.length} readiness checks
          </span>
        </summary>
        <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {assessment.checks.map((item) => {
            const ItemIcon =
              item.status === 'ready'
                ? CheckCircle2
                : item.status === 'blocked'
                  ? AlertTriangle
                  : CircleDotDashed;
            return (
              <a
                key={item.id}
                href={item.href}
                className="rounded-lg border border-black/8 bg-white/75 p-3 text-left outline-none transition hover:border-primary-300 hover:bg-white focus-visible:ring-2 focus-visible:ring-ring dark:border-white/10 dark:bg-slate-950/55 dark:hover:border-cyan-300/25"
              >
                <div className="flex items-center gap-2">
                  <ItemIcon
                    className={`size-4 ${readinessTone[item.status].iconClass}`}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-semibold text-neutral-900 dark:text-slate-100">
                    {item.label}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-5 text-neutral-600 dark:text-slate-400">
                  {item.description}
                </p>
              </a>
            );
          })}
        </div>
      </details>
    </section>
  );
}
