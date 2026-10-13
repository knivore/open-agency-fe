import { AlertTriangle, CheckCircle2, CircleDotDashed } from 'lucide-react';
import { Badge } from '@/components/library/shadcn/badge';

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

/** Presentation only; validation and run eligibility belong to the workflow editor. */
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
