'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, CircleAlert, FileCheck2 } from 'lucide-react';
import type { RunSessionSummary } from '@/types/runtime';
import { TableCell, TableRow } from '@/components/library/shadcn/table';
import { Button } from '@/components/library/shadcn/button';
import RunStatusBadge from '@/components/runs/components/RunStatusBadge';
import {
  describeRunEvidence,
  formatRunDuration,
  formatRunListDateTime,
} from '@/lib/runs/runPresentation';
import { cn } from '@/lib/utils';

function buildRunDetailHref(execution: RunSessionSummary) {
  const href = `/runs/${encodeURIComponent(execution.id)}`;
  if (!execution.workflowId) {
    return href;
  }

  const params = new URLSearchParams({
    workflowId: execution.workflowId,
    tab: 'runs',
  });
  return `${href}?${params.toString()}`;
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element
    ? Boolean(target.closest('a, button, input, select, textarea, [role="button"]'))
    : false;
}

export default function RunSessionRow({
  execution,
  workflowName,
}: {
  execution: RunSessionSummary;
  workflowName?: string;
}) {
  const router = useRouter();
  const detailHref = buildRunDetailHref(execution);
  const workflowLabel = workflowName || (execution.workflowId ? 'Unnamed workflow' : 'Ad hoc run');
  const evidence = describeRunEvidence(execution);
  const hasFailureEvidence = execution.status === 'failed' && Boolean(execution.error?.trim());

  return (
    <TableRow
      className="group cursor-pointer align-top focus-within:bg-(--agency-row-hover)"
      onClick={(event) => {
        if (!isInteractiveTarget(event.target)) {
          router.push(detailHref);
        }
      }}
    >
      <TableCell className="min-w-0 py-4 sm:min-w-48">
        <div className="flex min-w-0 flex-col gap-1.5">
          {execution.workflowId ? (
            <Link
              href={`/workflows/${execution.workflowId}`}
              className="line-clamp-2 font-semibold text-(--agency-shell-text) underline-offset-4 hover:text-primary hover:underline"
            >
              {workflowLabel}
            </Link>
          ) : (
            <span className="font-semibold text-(--agency-shell-text)">{workflowLabel}</span>
          )}
          <div className="flex min-w-0 items-center gap-2 text-xs text-(--agency-shell-muted)">
            <span className="truncate font-mono" title={execution.id}>
              {execution.id}
            </span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">{execution.runtimeAdapterId || 'Unknown runtime'}</span>
          </div>
          <div className="flex flex-col gap-1.5 lg:hidden">
            <div className="flex flex-wrap items-center gap-2 sm:hidden">
              <RunStatusBadge status={execution.status} />
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-(--agency-shell-muted) md:hidden">
              <time dateTime={execution.startedAt || execution.createdAt || undefined}>
                {formatRunListDateTime(execution.startedAt || execution.createdAt)}
              </time>
              <span aria-hidden="true">·</span>
              <span>{formatRunDuration(execution)} duration</span>
            </div>
            <div
              className={cn(
                'flex items-start gap-1.5 text-xs leading-5',
                hasFailureEvidence
                  ? 'text-rose-700 dark:text-rose-200'
                  : 'text-(--agency-shell-muted)'
              )}
            >
              {hasFailureEvidence ? (
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <FileCheck2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              )}
              <span className="line-clamp-2" title={evidence}>
                {evidence}
              </span>
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden min-w-32 py-4 sm:table-cell">
        <RunStatusBadge status={execution.status} />
      </TableCell>
      <TableCell className="hidden min-w-32 py-4 md:table-cell">
        <time
          dateTime={execution.startedAt || execution.createdAt || undefined}
          className="font-medium text-(--agency-shell-text)"
        >
          {formatRunListDateTime(execution.startedAt || execution.createdAt)}
        </time>
        <p className="mt-1 text-xs text-(--agency-shell-muted)">
          {formatRunDuration(execution)} duration
        </p>
      </TableCell>
      <TableCell className="hidden min-w-56 max-w-md py-4 lg:table-cell">
        <div
          className={cn(
            'flex items-start gap-2 text-sm leading-5',
            hasFailureEvidence ? 'text-rose-700 dark:text-rose-200' : 'text-(--agency-shell-muted)'
          )}
        >
          {hasFailureEvidence ? (
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          ) : (
            <FileCheck2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          )}
          <span className="line-clamp-2" title={evidence}>
            {evidence}
          </span>
        </div>
      </TableCell>
      <TableCell className="w-px py-4 text-right">
        <Button
          asChild
          type="button"
          size="sm"
          variant="ghost"
          className="gap-1.5 text-(--agency-shell-muted) group-hover:text-(--agency-shell-text)"
        >
          <Link href={detailHref} aria-label={`View run details for ${workflowLabel}`}>
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}
