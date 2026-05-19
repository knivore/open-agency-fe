'use client';

import { Badge } from '@/components/library/shadcn/badge';
import { Button } from '@/components/library/shadcn/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/library/shadcn/card';
import { Checkbox } from '@/components/library/shadcn/checkbox';
import { Label } from '@/components/library/shadcn/label';
import type { WorkflowSharedMemoryOperatorPayload } from '@/types/workflows';

interface WorkflowSharedMemoryControlsProps {
  sharedMemory?: WorkflowSharedMemoryOperatorPayload | null;
  isLoading: boolean;
  isSaving: boolean;
  onEnabledChange: (checked: boolean, applyToAgents: boolean) => void;
  onRefresh: () => void;
}

export default function WorkflowSharedMemoryControls({
  sharedMemory,
  isLoading,
  isSaving,
  onEnabledChange,
  onRefresh,
}: WorkflowSharedMemoryControlsProps) {
  const enabled = sharedMemory?.enabled === true;
  const enabledAgentCount = sharedMemory?.agent_states?.filter((agent) => agent.enabled).length ?? 0;
  const agentCount = sharedMemory?.agent_states?.length ?? 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle className="text-base">Shared Memory</CardTitle>
            <CardDescription>Durable memory available to native agents in this workflow.</CardDescription>
          </div>
          <Badge variant={enabled ? 'default' : 'outline'}>{enabled ? 'On' : 'Off'}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2">
          <Checkbox
            id="workflow-shared-memory-enabled"
            checked={enabled}
            disabled={isSaving}
            onCheckedChange={(value) => onEnabledChange(value === true, true)}
          />
          <div className="space-y-1">
            <Label htmlFor="workflow-shared-memory-enabled">Share workflow memory</Label>
            <p className="text-xs text-neutral-500">
              {agentCount > 0
                ? `${enabledAgentCount}/${agentCount} embedded agents have memory enabled.`
                : 'No embedded agents are configured yet.'}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-neutral-900">Shared memory settings</div>
            <Button type="button" variant="outline" size="sm" disabled={isLoading} onClick={onRefresh}>
              Refresh
            </Button>
          </div>
          {isLoading ? (
            <div className="rounded-md border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-500">
              Loading shared memory settings...
            </div>
          ) : (
            <div className="rounded-md border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-500">
              Memory records are runtime-owned. This panel only controls whether the workflow and its embedded agents can use them.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
