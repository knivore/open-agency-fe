'use client';

import { useState } from 'react';
import { Download, MoreVertical, Play, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmActionDialog from '@/components/app-shell/ConfirmActionDialog';
import { Button } from '@/components/library/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/library/shadcn/dropdown-menu';
import WorkflowDeleteAction from '@/components/workflow/WorkflowDeleteAction';
import { downloadWorkflowExportPackage } from '@/lib/workflows/workflowExport';
import { useWorkflowRunLauncher } from '@/lib/workflows/useWorkflowRunLauncher';
import type { BehaviorTuningProfile } from '@/types/agents';
import type { RuntimeAdapterDefinition } from '@/types/runtime';
import type { ToolDefinition } from '@/types/tools';
import type { WorkflowDefinition } from '@/types/workflows';

export default function WorkflowListActions({
  workflow,
  runtimeAdapters,
  behaviorProfiles = [],
  tools = [],
}: {
  workflow: WorkflowDefinition;
  runtimeAdapters: RuntimeAdapterDefinition[];
  behaviorProfiles?: BehaviorTuningProfile[];
  tools?: ToolDefinition[];
}) {
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { preferredRuntimeAdapterId, launchMutation, launchWorkflow } = useWorkflowRunLauncher({
    workflowId: workflow.id,
    workflow,
    runtimeAdapters,
    redirectTo: (runId) => `/runs/${runId}`,
  });

  const runWorkflow = async () => {
    await toast.promise(launchWorkflow(undefined), {
      loading: 'Starting workflow…',
      success: 'Workflow run started.',
      error: (error) => (error instanceof Error ? error.message : 'Failed to start workflow.'),
      position: 'top-right',
    });
  };

  const exportWorkflow = () => {
    const downloaded = downloadWorkflowExportPackage(workflow, {
      availableModelProfiles: behaviorProfiles,
      availableTools: tools,
    });
    if (downloaded) {
      toast.success('Workflow export downloaded.', { position: 'top-right' });
    }
  };

  return (
    <div className="flex items-center md:justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${workflow.name}`}
            title={`Actions for ${workflow.name}`}
            className="size-9 text-(--agency-shell-muted) hover:text-(--agency-shell-text)"
          >
            <MoreVertical className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48 rounded-lg p-1.5">
          <DropdownMenuItem onSelect={() => setRunDialogOpen(true)}>
            <Play aria-hidden="true" />
            Quick run
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={exportWorkflow}>
            <Download aria-hidden="true" />
            Export workflow
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            onSelect={() => setDeleteDialogOpen(true)}
          >
            <Trash2 aria-hidden="true" />
            Delete workflow
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmActionDialog
        trigger={null}
        open={runDialogOpen}
        onOpenChange={setRunDialogOpen}
        title={`Run ${workflow.name}?`}
        description={`This starts the workflow${
          preferredRuntimeAdapterId ? ` with ${preferredRuntimeAdapterId}` : ''
        }. It may call external services, use provider credits, or produce side effects.`}
        confirmLabel="Start run"
        pendingLabel="Starting…"
        pending={launchMutation.isPending}
        onConfirm={runWorkflow}
      />
      <WorkflowDeleteAction
        workflowId={workflow.id}
        workflowName={workflow.name}
        trigger={null}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />
    </div>
  );
}
