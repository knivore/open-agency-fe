import type { ComponentType, ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface PageHeaderProps {
  actions?: ReactNode;
  className?: string;
  compact?: boolean;
  description?: ReactNode;
  eyebrow?: string;
  icon?: ComponentType<{ className?: string }>;
  meta?: ReactNode;
  tone?:
    | 'agent'
    | 'assistant'
    | 'graph'
    | 'help'
    | 'integration'
    | 'memory'
    | 'model'
    | 'monitor'
    | 'operator'
    | 'persona'
    | 'profile'
    | 'run'
    | 'workflow';
  title: ReactNode;
}

export default function PageHeader({
  actions,
  className,
  compact = false,
  description,
  eyebrow,
  icon: Icon,
  meta,
  tone = 'workflow',
  title,
}: PageHeaderProps) {
  return (
    <div
      data-tone={tone}
      className={cn(
        'agency-page-header relative flex flex-col border-b lg:flex-row lg:items-center lg:justify-between',
        compact ? 'gap-3 pb-4' : 'gap-5 pb-6',
        'border-(--agency-header-border)',
        className
      )}
    >
      <div
        className={cn('flex min-w-0 items-start', compact ? 'gap-3 sm:gap-4' : 'gap-4 sm:gap-5')}
      >
        {Icon ? (
          <span
            className={cn(
              'agency-page-header-icon mt-0.5 hidden shrink-0 items-center justify-center rounded-xl border sm:flex',
              compact ? 'size-11' : 'size-13'
            )}
          >
            <Icon className="size-[1.35rem] stroke-[1.75]" />
          </span>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-(--agency-page-tone)">
              {eyebrow}
            </p>
          ) : null}
          <h1
            className={cn(
              'font-semibold leading-tight tracking-[-0.04em] text-(--agency-shell-text)',
              compact ? 'text-[1.75rem] sm:text-[2.15rem]' : 'text-[1.85rem] sm:text-[2.5rem]'
            )}
          >
            {title}
          </h1>
          {description ? (
            <div
              className={cn(
                'max-w-3xl text-(--agency-shell-muted)',
                compact
                  ? 'mt-1 text-sm leading-5 sm:text-[0.95rem]'
                  : 'mt-1.5 text-[0.95rem] leading-6 sm:text-base'
              )}
            >
              {description}
            </div>
          ) : null}
          {meta ? <div className="mt-3 flex flex-wrap gap-2">{meta}</div> : null}
        </div>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2.5 lg:justify-end">{actions}</div>
      ) : null}
    </div>
  );
}
