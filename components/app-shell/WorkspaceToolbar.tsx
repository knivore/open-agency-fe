'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/library/shadcn/button';
import { cn } from '@/lib/utils';
import WorkspaceSearch from './WorkspaceSearch';

/** Layout only: the feature owns filtering, selection, and saved-view state. */
export default function WorkspaceToolbar({
  label = 'Workspace filters',
  search,
  children,
  summary,
  actions,
  onReset,
  disabled = false,
  className,
}: {
  label?: string;
  search?: {
    label: string;
    placeholder?: string;
    value: string;
    onChange: (value: string) => void;
  };
  children?: ReactNode;
  summary?: ReactNode;
  actions?: ReactNode;
  onReset?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <section
      aria-label={label}
      className={cn('flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-3', className)}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {search ? (
          <WorkspaceSearch {...search} disabled={disabled} className="min-w-48 flex-1" />
        ) : null}
        {children}
        {onReset ? (
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onReset}>
            Clear filters
          </Button>
        ) : null}
        {actions}
      </div>
      {summary ? (
        <div className="text-xs text-muted-foreground" role="status">
          {summary}
        </div>
      ) : null}
    </section>
  );
}
