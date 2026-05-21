import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface PageHeaderProps {
  actions?: ReactNode;
  className?: string;
  description?: ReactNode;
  eyebrow?: string;
  meta?: ReactNode;
  title: ReactNode;
}

export default function PageHeader({
  actions,
  className,
  description,
  eyebrow,
  meta,
  title,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 border-b border-primary-100 pb-5 lg:flex-row lg:items-start lg:justify-between',
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary-600">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="agency-gradient-text text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm text-neutral-600">{description}</p>
        ) : null}
        {meta ? <div className="mt-3 flex flex-wrap gap-2">{meta}</div> : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div>
      ) : null}
    </div>
  );
}
