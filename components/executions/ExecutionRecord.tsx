import { TableCell, TableRow } from '../library/shadcn/table';
import { Badge } from '../library/shadcn/badge';
import { Button } from '../library/shadcn/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../library/shadcn/tooltip';
import { Ban, Loader, ThumbsDown, ThumbsUp } from 'lucide-react';
import React, { useState } from 'react';
import Link from 'next/link';
import { executionActionsAdapter } from '@/lib/api/backend';
import type { RunSessionSummary } from '@/types/runtime';

const SUCCESS_STATUSES = new Set(['completed']);

function formatTimestamp(value?: string | null) {
  return value ? new Date(value).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' }) : '—';
}

export function ExecutionRecord({ execution }: { execution: RunSessionSummary }) {
  const [rating, setRating] = useState<string | null>(null);
  const createdTime = formatTimestamp(execution.createdAt);
  const startTime = formatTimestamp(execution.startedAt);
  const endTime = formatTimestamp(execution.completedAt);
  const lastHeartbeat = formatTimestamp(execution.lastHeartbeatAt);
  const containerLabel = execution.container?.containerName || execution.container?.containerId || '—';

  const [loading, setLoading] = useState(false);
  const handleDownload = async () => {
    if (!SUCCESS_STATUSES.has(execution.status)) {
      alert('Run is not completed yet.');
      return;
    }

    setLoading(true);

    try {
      await executionActionsAdapter.downloadResult(execution.id);
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
      await executionActionsAdapter.rateResult(currentExecution.id, nextRating);
    } catch (error) {
      console.error('Error updating rating:', error);
    }
  }

  return (
    <TableRow>
      <TableCell className="font-medium">
        <Link href={`/runs/${execution.id}`} className="hover:text-primary hover:underline">
          {execution.id}
        </Link>
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        {execution.workflowId ? (
          <Link href={`/workflows/${execution.workflowId}`} className="hover:text-primary hover:underline">
            {execution.workflowId}
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
      <TableCell className="hidden text-center md:table-cell">
        {createdTime}
      </TableCell>
      <TableCell className="hidden text-center md:table-cell">
        {startTime}
      </TableCell>
      <TableCell className="hidden text-center md:table-cell">
        {endTime}
      </TableCell>
      <TableCell className="hidden text-center lg:table-cell">
        <div className="flex flex-col items-center gap-1">
          <span className="max-w-[180px] truncate text-xs text-neutral-700">{containerLabel}</span>
          <Badge variant="outline" className="capitalize">
            {execution.container?.status || 'n/a'}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="hidden text-center xl:table-cell">{lastHeartbeat}</TableCell>
      <TableCell className="max-w-[280px] truncate text-sm text-neutral-500">
        {execution.error || '—'}
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
