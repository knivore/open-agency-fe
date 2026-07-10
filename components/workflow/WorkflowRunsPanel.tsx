'use client';

import Link from 'next/link';
import type { WorkflowRun } from '@/types/runtime';
import { Badge } from '../library/shadcn/badge';
import { Button } from '../library/shadcn/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../library/shadcn/card';
import { ErrorAlert } from '@/components/agent-app/StatePanels';

interface WorkflowRunsPanelProps {
  workflowId: string;
  isLoading: boolean;
  errorMessage?: string;
  runs?: WorkflowRun[];
  onRetry: () => void;
}

export default function WorkflowRunsPanel({
  workflowId,
  isLoading,
  errorMessage,
  runs,
  onRetry,
}: WorkflowRunsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow Runs</CardTitle>
        <CardDescription>
          Canonical executions returned by `/workflows/{workflowId}/executions`.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-neutral-500">Loading runs...</p>
        ) : errorMessage ? (
          <ErrorAlert
            title="Failed to load workflow runs"
            message={errorMessage}
            onRetry={onRetry}
          />
        ) : (runs ?? []).length === 0 ? (
          <p className="text-sm text-neutral-500">
            No runs have been created for this workflow yet.
          </p>
        ) : (
          runs?.map((run) => (
            <div
              key={run.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 p-4"
            >
              <div>
                <p className="font-medium text-neutral-900">{run.id}</p>
                <p className="mt-1 text-sm text-neutral-500">
                  {run.createdAt
                    ? new Date(run.createdAt).toLocaleString('en-SG', {
                        timeZone: 'Asia/Singapore',
                      })
                    : 'No creation time'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{run.status}</Badge>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/runs/${run.id}?workflowId=${workflowId}&tab=runs`}>Open</Link>
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
