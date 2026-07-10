'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { RunSessionSummary } from '@/types/runtime';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/library/shadcn/card';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/library/shadcn/table';
import { Button } from '@/components/library/shadcn/button';
import RunSessionRow from '@/components/runs/components/RunSessionRow';

const RUNS_PER_PAGE = 10;

export default function RunSessionsTable({
  runs,
  workflowNamesById,
}: {
  runs: RunSessionSummary[];
  workflowNamesById?: ReadonlyMap<string, string>;
}) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(runs.length / RUNS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const pageStartIndex = (currentPage - 1) * RUNS_PER_PAGE;
  const pageEndIndex = Math.min(pageStartIndex + RUNS_PER_PAGE, runs.length);
  const paginatedRuns = useMemo(
    () => runs.slice(pageStartIndex, pageEndIndex),
    [pageEndIndex, pageStartIndex, runs]
  );
  const pageNumbers = useMemo(
    () => buildVisiblePageNumbers(currentPage, pageCount),
    [currentPage, pageCount]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Execution Runs</CardTitle>
        <CardDescription>
          Select a run to inspect its full execution detail, logs, events, timeline, and artifacts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Workflow</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="hidden text-center md:table-cell">Started</TableHead>
              <TableHead className="hidden text-center md:table-cell">Completed</TableHead>
              <TableHead className="hidden text-center lg:table-cell">Container</TableHead>
              <TableHead>Error</TableHead>
              <TableHead className="text-right">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRuns.map((run) => (
              <RunSessionRow
                key={run.id}
                execution={run}
                workflowName={run.workflowId ? workflowNamesById?.get(run.workflowId) : undefined}
              />
            ))}
          </TableBody>
        </Table>
        {runs.length > RUNS_PER_PAGE ? (
          <div className="mt-4 flex flex-col gap-3 border-t pt-4 text-sm text-neutral-600 md:flex-row md:items-center md:justify-between">
            <p>
              Showing {pageStartIndex + 1}-{pageEndIndex} of {runs.length} runs
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {pageNumbers.map((pageNumber) => (
                  <Button
                    key={pageNumber}
                    type="button"
                    variant={pageNumber === currentPage ? 'default' : 'outline'}
                    size="sm"
                    className="h-9 min-w-9 px-3"
                    aria-current={pageNumber === currentPage ? 'page' : undefined}
                    onClick={() => setPage(pageNumber)}
                  >
                    {pageNumber}
                  </Button>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                disabled={currentPage === pageCount}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function buildVisiblePageNumbers(currentPage: number, pageCount: number) {
  const visibleCount = Math.min(5, pageCount);
  const halfWindow = Math.floor(visibleCount / 2);
  const start = Math.min(Math.max(1, currentPage - halfWindow), pageCount - visibleCount + 1);

  return Array.from({ length: visibleCount }, (_, index) => start + index);
}
