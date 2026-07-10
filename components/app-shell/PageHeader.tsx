import type { ComponentType, ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface PageHeaderProps {
  actions?: ReactNode;
  className?: string;
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
    | 'persona'
    | 'profile'
    | 'run'
    | 'workflow';
  title: ReactNode;
}

export default function PageHeader({
  actions,
  className,
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
        'agency-page-header relative flex flex-col gap-5 border-b pb-6 lg:flex-row lg:items-center lg:justify-between',
        'border-(--agency-header-border)',
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-4">
        {Icon ? (
          <span className="agency-page-header-icon mt-0.5 hidden size-11 shrink-0 items-center justify-center rounded-xl border sm:flex">
            <Icon className="size-5 stroke-[1.75]" />
          </span>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-(--agency-page-tone)">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-[1.75rem] font-semibold tracking-[-0.035em] text-(--agency-shell-text) sm:text-[2rem]">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-(--agency-shell-muted)">
              {description}
            </p>
          ) : null}
          {meta ? <div className="mt-3 flex flex-wrap gap-2">{meta}</div> : null}
        </div>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div>
      ) : null}
    </div>
  );
}
