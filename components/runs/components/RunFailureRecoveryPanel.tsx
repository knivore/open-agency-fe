import Link from 'next/link';
import { BotMessageSquare, CircleAlert, ExternalLink, RotateCcw } from 'lucide-react';
import { Button } from '@/components/library/shadcn/button';
import { Badge } from '@/components/library/shadcn/badge';
import { requestAssistantOpen } from '@/lib/assistant/events';
import { diagnoseRunFailure } from '@/components/runs/lib/runRecovery';
import type { ExecutionEventRecord } from '@/types/runtime';

export default function RunFailureRecoveryPanel({
  events,
  onInspectTimeline,
  runError,
  workflowId,
}: {
  events: ExecutionEventRecord[];
  onInspectTimeline?: () => void;
  runError?: string | null;
  workflowId?: string | null;
}) {
  const diagnosis = diagnoseRunFailure({ events, runError, workflowId });

  return (
    <section
      className="rounded-xl border border-rose-200 bg-rose-50/55 p-4 dark:border-rose-300/20 dark:bg-rose-400/8"
      aria-labelledby="run-recovery-title"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg border border-rose-200 bg-white/75 text-rose-700 dark:border-rose-300/20 dark:bg-slate-950/50 dark:text-rose-200">
              <CircleAlert className="size-4.5" aria-hidden="true" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="run-recovery-title"
                  className="font-semibold text-neutral-950 dark:text-slate-100"
                >
                  Recovery guidance
                </h2>
                <Badge variant="outline" className="capitalize">
                  {diagnosis.category === 'unknown' ? 'General failure' : diagnosis.category}
                </Badge>
              </div>
              <p className="mt-0.5 text-sm font-medium text-rose-900 dark:text-rose-100">
                {diagnosis.title}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="rounded-lg border border-black/8 bg-white/75 p-3 dark:border-white/10 dark:bg-slate-950/55">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500 dark:text-slate-400">
                First actionable error
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-800 dark:text-slate-200">
                {diagnosis.evidence}
              </p>
              {diagnosis.evidenceEventType ? (
                <p className="mt-2 font-mono text-[0.68rem] text-neutral-500 dark:text-slate-400">
                  {diagnosis.evidenceEventType}
                </p>
              ) : null}
            </div>
            <div className="rounded-lg border border-black/8 bg-white/75 p-3 dark:border-white/10 dark:bg-slate-950/55">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500 dark:text-slate-400">
                Likely cause
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-800 dark:text-slate-200">
                {diagnosis.likelyCause}
              </p>
            </div>
            <div className="rounded-lg border border-black/8 bg-white/75 p-3 dark:border-white/10 dark:bg-slate-950/55">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500 dark:text-slate-400">
                Safest next step
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-800 dark:text-slate-200">
                {diagnosis.safestNextStep}
              </p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 xl:max-w-52 xl:flex-col">
          {diagnosis.primaryAction.href === '#run-timeline' && onInspectTimeline ? (
            <Button
              type="button"
              variant="outline"
              className="justify-start"
              onClick={onInspectTimeline}
            >
              <ExternalLink className="mr-2 size-4" aria-hidden="true" />
              {diagnosis.primaryAction.label}
            </Button>
          ) : (
            <Button asChild type="button" variant="outline" className="justify-start">
              <Link href={diagnosis.primaryAction.href}>
                <ExternalLink className="mr-2 size-4" aria-hidden="true" />
                {diagnosis.primaryAction.label}
              </Link>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="justify-start"
            onClick={requestAssistantOpen}
          >
            <BotMessageSquare className="mr-2 size-4" aria-hidden="true" />
            Ask Assistant
          </Button>
          <Button asChild type="button" variant="outline" className="justify-start">
            <a href="#run-rerun-configuration">
              <RotateCcw className="mr-2 size-4" aria-hidden="true" />
              Review rerun
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
