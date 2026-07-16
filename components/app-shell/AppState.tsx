import type { ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Inbox,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  WifiOff,
} from 'lucide-react';
import { Button } from '@/components/library/shadcn/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/library/shadcn/card';

export type AppStateVariant =
  | 'empty'
  | 'error'
  | 'loading'
  | 'offline'
  | 'partial'
  | 'permission'
  | 'success';

interface AppStateProps {
  variant: AppStateVariant;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryAction?: ReactNode;
  children?: ReactNode;
  compact?: boolean;
}

interface AppInlineStateProps {
  variant: AppStateVariant;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

const statePresentation = {
  empty: {
    icon: Inbox,
    iconClass: 'text-slate-600 dark:text-slate-300',
    surfaceClass: 'border-dashed border-slate-300 dark:border-slate-500/30',
  },
  error: {
    icon: AlertTriangle,
    iconClass: 'text-rose-700 dark:text-rose-200',
    surfaceClass: 'border-rose-200 bg-rose-50/55 dark:border-rose-300/20 dark:bg-rose-400/8',
  },
  loading: {
    icon: LoaderCircle,
    iconClass: 'animate-spin text-sky-700 dark:text-cyan-200',
    surfaceClass: 'border-sky-200 bg-sky-50/35 dark:border-cyan-300/15 dark:bg-cyan-400/5',
  },
  offline: {
    icon: WifiOff,
    iconClass: 'text-amber-700 dark:text-amber-200',
    surfaceClass: 'border-amber-200 bg-amber-50/55 dark:border-amber-300/20 dark:bg-amber-400/8',
  },
  partial: {
    icon: AlertTriangle,
    iconClass: 'text-amber-700 dark:text-amber-200',
    surfaceClass: 'border-amber-200 bg-amber-50/45 dark:border-amber-300/20 dark:bg-amber-400/7',
  },
  permission: {
    icon: ShieldAlert,
    iconClass: 'text-violet-700 dark:text-violet-200',
    surfaceClass:
      'border-violet-200 bg-violet-50/55 dark:border-violet-300/20 dark:bg-violet-400/8',
  },
  success: {
    icon: CheckCircle2,
    iconClass: 'text-emerald-700 dark:text-emerald-200',
    surfaceClass:
      'border-emerald-200 bg-emerald-50/55 dark:border-emerald-300/20 dark:bg-emerald-400/8',
  },
} satisfies Record<AppStateVariant, Record<string, unknown>>;

function defaultActionLabel(variant: AppStateVariant) {
  if (variant === 'error' || variant === 'offline' || variant === 'partial') {
    return 'Try again';
  }
  return undefined;
}

export default function AppState({
  variant,
  title,
  description,
  actionLabel,
  onAction,
  secondaryAction,
  children,
  compact = false,
}: AppStateProps) {
  const presentation = statePresentation[variant];
  const StateIcon = presentation.icon;
  const resolvedActionLabel = actionLabel ?? defaultActionLabel(variant);
  const liveRole = variant === 'error' ? 'alert' : variant === 'loading' ? 'status' : undefined;

  return (
    <Card
      className={presentation.surfaceClass}
      data-app-state={variant}
      role={liveRole}
      aria-live={variant === 'loading' ? 'polite' : undefined}
    >
      <CardHeader className={compact ? 'pb-2' : undefined}>
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-current/10 bg-white/70 dark:bg-slate-950/50">
            <StateIcon className={`size-4.5 ${presentation.iconClass}`} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <CardTitle className={compact ? 'text-base' : 'text-lg'}>{title}</CardTitle>
            <p className="mt-1 text-sm leading-6 text-(--agency-shell-muted)">{description}</p>
          </div>
        </div>
      </CardHeader>
      {children || (resolvedActionLabel && onAction) || secondaryAction ? (
        <CardContent
          className={`flex flex-col gap-3 ${compact ? 'pt-0' : ''} sm:flex-row sm:items-center sm:justify-between`}
        >
          <div className="min-w-0 flex-1 text-sm text-(--agency-shell-muted)">{children}</div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {resolvedActionLabel && onAction ? (
              <Button type="button" variant="outline" onClick={onAction}>
                <RefreshCw className="mr-2 size-4" aria-hidden="true" />
                {resolvedActionLabel}
              </Button>
            ) : null}
            {secondaryAction}
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}

export function AppInlineState({
  variant,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}: AppInlineStateProps) {
  const presentation = statePresentation[variant];
  const StateIcon = presentation.icon;
  const resolvedActionLabel = actionLabel ?? defaultActionLabel(variant);
  const liveRole = variant === 'error' ? 'alert' : variant === 'loading' ? 'status' : undefined;

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border px-3 py-3 sm:flex-row sm:items-center ${presentation.surfaceClass} ${className}`}
      data-app-inline-state={variant}
      role={liveRole}
      aria-live={variant === 'loading' ? 'polite' : undefined}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-current/10 bg-white/70 dark:bg-slate-950/50">
        <StateIcon className={`size-4 ${presentation.iconClass}`} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-(--agency-shell-text)">{title}</p>
        {description ? (
          <p className="mt-0.5 text-xs leading-5 text-(--agency-shell-muted)">{description}</p>
        ) : null}
      </div>
      {resolvedActionLabel && onAction ? (
        <Button type="button" variant="outline" size="sm" onClick={onAction}>
          <RefreshCw className="mr-2 size-3.5" aria-hidden="true" />
          {resolvedActionLabel}
        </Button>
      ) : null}
    </div>
  );
}
