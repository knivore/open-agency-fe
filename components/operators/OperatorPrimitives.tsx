import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Clock3, LoaderCircle, RadioTower } from 'lucide-react';
import { Badge } from '@/components/library/shadcn/badge';
import { cn } from '@/lib/utils';
import type { OperatorStatus } from '@/types/operators';
import { operatorStatusLabel, operatorStatusTone } from './operatorPresentation';

const toneClass = {
  neutral: 'bg-slate-400',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-sky-500',
} as const;

export function OperatorStatusBadge({ status }: { status: OperatorStatus }) {
  const tone = operatorStatusTone[status];
  return (
    <Badge
      variant={tone === 'danger' ? 'failed' : tone === 'success' ? 'successful' : 'outline'}
      className="gap-1.5 font-medium"
    >
      <span className={cn('size-1.5 rounded-full', toneClass[tone])} aria-hidden="true" />
      {operatorStatusLabel[status]}
    </Badge>
  );
}

export function OperatorMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="min-w-0 px-4 py-3 sm:px-5">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-(--agency-shell-muted)">
        {label}
      </p>
      <div className="mt-1 text-xl font-semibold tracking-[-0.03em] text-(--agency-shell-text)">
        {value}
      </div>
      {detail ? <div className="mt-0.5 text-xs text-(--agency-shell-muted)">{detail}</div> : null}
    </div>
  );
}

export function OperatorQueryState({
  kind,
  title,
  description,
  action,
}: {
  kind: 'loading' | 'error' | 'empty';
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const Icon = kind === 'loading' ? LoaderCircle : kind === 'error' ? AlertCircle : RadioTower;
  return (
    <div className="flex min-h-56 flex-col items-center justify-center border-y border-(--agency-shell-border) px-6 py-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl border border-(--agency-shell-border) bg-(--agency-surface-muted) text-(--agency-page-tone)">
        <Icon className={cn('size-5', kind === 'loading' && 'animate-spin')} aria-hidden="true" />
      </span>
      <h2 className="mt-4 font-semibold text-(--agency-shell-text)">{title}</h2>
      <p className="mt-1 max-w-md text-sm leading-6 text-(--agency-shell-muted)">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function DecisionBadge({ decision }: { decision?: string | null }) {
  const noAction = !decision || decision === 'no_action';
  return (
    <Badge variant={noAction ? 'outline' : 'default'} className="gap-1.5 font-medium">
      {noAction ? <CheckCircle2 className="size-3" /> : <Clock3 className="size-3" />}
      {(decision ?? 'no_action').replaceAll('_', ' ')}
    </Badge>
  );
}
