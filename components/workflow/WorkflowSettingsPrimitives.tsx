'use client';

import type { ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/library/shadcn/tooltip';
import { cn } from '@/lib/utils';

type WorkflowSectionTone = 'neutral' | 'emerald' | 'amber' | 'sky' | 'violet' | 'cyan' | 'red';

interface WorkflowFieldProps {
  label: string;
  help?: ReactNode;
  className?: string;
  children: ReactNode;
}

function WorkflowHelpTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Explain ${label}`}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-slate-200 dark:focus:ring-white/20"
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-72 text-xs normal-case leading-5">{children}</TooltipContent>
    </Tooltip>
  );
}

export function WorkflowFieldLabel({ label, help }: { label: string; help?: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium uppercase text-neutral-500 dark:text-slate-400">
      <span>{label}</span>
      {help ? <WorkflowHelpTooltip label={label}>{help}</WorkflowHelpTooltip> : null}
    </div>
  );
}

export function WorkflowSummaryField({ label, help, className, children }: WorkflowFieldProps) {
  return (
    <div
      className={cn(
        'flex min-h-24 flex-col rounded-md border border-neutral-200 bg-white/90 px-3 py-2.5 shadow-sm shadow-neutral-950/3 dark:border-white/10 dark:bg-slate-950/78 dark:shadow-none',
        className
      )}
    >
      <WorkflowFieldLabel label={label} help={help} />
      <div className="mt-2 flex min-h-10 flex-1 flex-col justify-center">{children}</div>
    </div>
  );
}

export function WorkflowReadOnlySummaryField({
  label,
  help,
  className,
  children,
}: WorkflowFieldProps) {
  return (
    <div
      className={cn(
        'flex min-h-24 flex-col rounded-md border border-neutral-200 bg-white/90 px-3 py-2.5 shadow-sm shadow-neutral-950/3 dark:border-white/10 dark:bg-slate-950/78 dark:shadow-none',
        className
      )}
    >
      <dt>
        <WorkflowFieldLabel label={label} help={help} />
      </dt>
      <dd className="mt-2 flex min-h-10 flex-1 flex-col justify-center font-medium text-neutral-900 dark:text-slate-100">
        {children}
      </dd>
    </div>
  );
}

export function WorkflowSettingsSection({
  title,
  description,
  tone = 'neutral',
  actions,
  className,
  children,
}: {
  title: string;
  description?: string;
  tone?: WorkflowSectionTone;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const toneClassName =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/8'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-500/8'
        : tone === 'sky'
          ? 'border-sky-200 bg-sky-50/50 dark:border-sky-500/20 dark:bg-sky-500/8'
          : tone === 'violet'
            ? 'border-violet-200 bg-violet-50/50 dark:border-violet-500/20 dark:bg-violet-500/8'
            : tone === 'cyan'
              ? 'border-cyan-200 bg-cyan-50/50 dark:border-cyan-500/20 dark:bg-cyan-500/8'
              : tone === 'red'
                ? 'border-red-200 bg-red-50/50 dark:border-red-500/20 dark:bg-red-500/8'
                : 'border-neutral-200 bg-neutral-50/60 dark:border-white/10 dark:bg-white/4';

  return (
    <section className={cn('rounded-lg border p-3 shadow-sm shadow-neutral-950/3 dark:shadow-none', toneClassName, className)}>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h4 className="text-sm font-semibold text-neutral-900 dark:text-slate-100">{title}</h4>
          {description ? (
            <p className="text-xs leading-5 text-neutral-500 dark:text-slate-400">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function WorkflowToneDot({ tone = 'neutral' }: { tone?: WorkflowSectionTone }) {
  const toneClassName =
    tone === 'emerald'
      ? 'bg-emerald-500 dark:bg-emerald-400'
      : tone === 'amber'
        ? 'bg-amber-500 dark:bg-amber-400'
        : tone === 'sky'
          ? 'bg-sky-500 dark:bg-sky-400'
          : tone === 'violet'
            ? 'bg-violet-500 dark:bg-violet-400'
            : tone === 'cyan'
              ? 'bg-cyan-500 dark:bg-cyan-400'
              : tone === 'red'
                ? 'bg-red-500 dark:bg-red-400'
                : 'bg-neutral-400 dark:bg-slate-500';

  return <span className={cn('h-2 w-2 shrink-0 rounded-full', toneClassName)} aria-hidden="true" />;
}

export function WorkflowStateValue({ children }: { children: ReactNode }) {
  return <div className="font-medium text-neutral-900 dark:text-slate-100">{children}</div>;
}

export function WorkflowBooleanState({
  enabled,
  enabledLabel = 'Enabled',
  disabledLabel = 'Disabled',
}: {
  enabled: boolean;
  enabledLabel?: string;
  disabledLabel?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 font-medium',
        enabled
          ? 'text-emerald-700 dark:text-emerald-300'
          : 'text-neutral-500 dark:text-slate-400'
      )}
    >
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          enabled ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-neutral-300 dark:bg-slate-600'
        )}
        aria-hidden="true"
      />
      {enabled ? enabledLabel : disabledLabel}
    </span>
  );
}
