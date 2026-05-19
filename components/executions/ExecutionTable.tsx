'use client';

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '../library/shadcn/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../library/shadcn/card';
import { ExecutionRecord } from '@/components/executions/ExecutionRecord';
import type { RunSessionSummary } from '@/types/runtime';

export function ExecutionTable({ executions }: { executions: RunSessionSummary[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Execution Runs</CardTitle>
        <CardDescription>
          View canonical execution records from the transformed backend.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Run ID</TableHead>
              <TableHead className="hidden lg:table-cell">Workflow</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="hidden text-center md:table-cell">Created</TableHead>
              <TableHead className="hidden text-center md:table-cell">Started</TableHead>
              <TableHead className="hidden text-center md:table-cell">Completed</TableHead>
              <TableHead className="hidden text-center lg:table-cell">Container</TableHead>
              <TableHead className="hidden text-center xl:table-cell">Heartbeat</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {executions.map((execution) => (
              <ExecutionRecord key={execution.id} execution={execution} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
