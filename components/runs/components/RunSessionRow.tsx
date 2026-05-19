'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { Ban, Eye, Loader, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { RunSessionSummary } from '@/types/runtime';
import { TableCell, TableRow } from '@/components/library/shadcn/table';
import { Badge } from '@/components/library/shadcn/badge';
import { Button } from '@/components/library/shadcn/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/library/shadcn/tooltip';
import { useRunsModule } from '@/components/runs/context';

const SUCCESS_STATUSES = new Set(['completed']);

function formatTimestamp(value?: string | null) {
  return value ? new Date(value).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' }) : '—';
}

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
  const { api } = useRunsModule();
  const router = useRouter();
  const [rating, setRating] = useState<string | null>(null);
  const startTime = formatTimestamp(execution.startedAt);
  const endTime = formatTimestamp(execution.completedAt);
  const containerLabel = execution.container?.containerName || execution.container?.containerId || '—';
  const [loading, setLoading] = useState(false);
  const detailHref = buildRunDetailHref(execution);
  const workflowLabel = workflowName || (execution.workflowId ? 'Unnamed workflow' : '—');

  const openRunDetail = () => {
    router.push(detailHref);
  };

  const handleDownload = async () => {
    if (!SUCCESS_STATUSES.has(execution.status)) {
      alert('Run is not completed yet.');
      return;
    }
    setLoading(true);
    try {
      await api.executionActions.downloadResult(execution.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Download is currently unavailable.';
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  async function rateResult(currentExecution: RunSessionSummary, nextRating: 'positive' | 'negative') {
    if (!SUCCESS_STATUSES.has(currentExecution.status)) {
      alert('Run is not completed yet.');
      return;
    }
    setRating(nextRating);
    try {
      await api.executionActions.rateResult(currentExecution.id, nextRating);
    } catch (error) {
      console.error('Error updating rating:', error);
    }
  }

  return (
    <TableRow
      className="cursor-pointer"
      onClick={(event) => {
        if (!isInteractiveTarget(event.target)) {
          openRunDetail();
        }
      }}
    >
      <TableCell className="font-medium">
        {execution.workflowId ? (
          <Link href={`/workflows/${execution.workflowId}`} className="hover:text-primary hover:underline">
            {workflowLabel}
          </Link>
        ) : '—'}
      </TableCell>
      <TableCell className="text-center">
        <Badge
          variant={SUCCESS_STATUSES.has(execution.status) ? 'successful' : execution.status === 'failed' ? 'failed' : 'outline'}
          className="mx-auto flex max-w-[100px] items-center justify-center capitalize"
        >
          {execution.status}
        </Badge>
      </TableCell>
      <TableCell className="hidden text-center md:table-cell">{startTime}</TableCell>
      <TableCell className="hidden text-center md:table-cell">{endTime}</TableCell>
      <TableCell className="hidden text-center lg:table-cell">
        <div className="flex flex-col items-center gap-1">
          <span className="max-w-[180px] truncate text-xs text-neutral-700">{containerLabel}</span>
          <Badge variant="outline" className="capitalize">
            {execution.container?.status || 'n/a'}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="max-w-[280px] truncate text-sm text-neutral-500">{execution.error || '—'}</TableCell>
      <TableCell className="text-right">
        <Button asChild type="button" size="sm" variant="outline" className="gap-2">
          <Link href={detailHref} aria-label={`View run details for ${workflowLabel}`}>
            <Eye className="h-4 w-4" />
            Details
          </Link>
        </Button>
      </TableCell>
      <TableCell className="hidden">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Download results"
                variant="ghost"
                onClick={!SUCCESS_STATUSES.has(execution.status) || loading ? undefined : handleDownload}
                className={!SUCCESS_STATUSES.has(execution.status) ? 'cursor-not-allowed opacity-20' : ''}
              >
                {loading ? <Loader className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Download is not wired on canonical routes yet</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
      <TableCell className="hidden">
        <TooltipProvider>
          <div className="flex justify-center space-x-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="Rate positively"
                  variant="ghost"
                  onClick={() => !SUCCESS_STATUSES.has(execution.status) ? {} : void rateResult(execution, 'positive')}
                  className={`flex h-8 w-8 items-center justify-center rounded border border-transparent p-1 hover:border-muted hover:bg-muted/20 ${!SUCCESS_STATUSES.has(execution.status) ? 'cursor-not-allowed opacity-20' : ''}`}
                >
                  <ThumbsUp className={`h-4 w-4 ${rating === 'positive' ? 'text-green-500' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Rate Positively</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="Rate negatively"
                  variant="ghost"
                  onClick={() => !SUCCESS_STATUSES.has(execution.status) ? {} : void rateResult(execution, 'negative')}
                  className={`flex h-8 w-8 items-center justify-center rounded border border-transparent p-1 hover:border-muted hover:bg-muted/20 ${!SUCCESS_STATUSES.has(execution.status) ? 'cursor-not-allowed opacity-20' : ''}`}
                >
                  <ThumbsDown className={`h-4 w-4 ${rating === 'negative' ? 'text-red-500' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Rate Negatively</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </TableCell>
    </TableRow>
  );
}
