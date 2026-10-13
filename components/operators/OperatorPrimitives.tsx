import type { ReactNode } from 'react';
import { CheckCircle2, Clock3 } from 'lucide-react';
import AppState from '@/components/app-shell/AppState';
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
  return (
    <AppState variant={kind} title={title} description={description} secondaryAction={action} />
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
