'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/library/shadcn/button';
import { cn } from '@/lib/utils';

export interface WorkspaceMetric {
  label: string;
  value: ReactNode;
  description?: string;
  selected?: boolean;
  onSelect?: () => void;
}

/** State meanings and counts stay with the caller; this is a shared summary surface. */
export default function WorkspaceMetrics({
  items,
  label = 'Workspace summary',
}: {
  items: readonly WorkspaceMetric[];
  label?: string;
}) {
  return (
    <section
      aria-label={label}
      className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:flex"
    >
      {items.map((item, index) => {
        const fillLastRow = items.length % 2 === 1 && index === items.length - 1;
        const content = (
          <>
            <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
            <span className="text-xl font-semibold tracking-tight">{item.value}</span>
            {item.description ? (
              <span className="text-xs font-normal text-muted-foreground">{item.description}</span>
            ) : null}
          </>
        );
        return item.onSelect ? (
          <Button
            key={item.label}
            type="button"
            variant="ghost"
            aria-label={`Filter: ${item.label}`}
            aria-pressed={Boolean(item.selected)}
            onClick={item.onSelect}
            className={cn(
              'h-auto min-w-0 flex-1 flex-col items-start gap-1 rounded-none bg-card px-4 py-3 text-left',
              fillLastRow && 'col-span-2 sm:col-span-1',
              item.selected && 'bg-accent text-accent-foreground'
            )}
          >
            {content}
          </Button>
        ) : (
          <div key={item.label} className={cn('flex min-w-0 flex-1 flex-col gap-1 bg-card px-4 py-3', fillLastRow && 'col-span-2 sm:col-span-1')}>
            {content}
          </div>
        );
      })}
    </section>
  );
}
