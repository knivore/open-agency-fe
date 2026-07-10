'use client';

import { useState } from 'react';
import {
  Download,
  MoreHorizontal,
  Pencil,
  Play,
  RefreshCw,
  Trash2,
  Workflow,
  X,
} from 'lucide-react';
import { Button } from '../library/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../library/shadcn/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../library/shadcn/tooltip';
import PageHeader from '@/components/app-shell/PageHeader';
import WorkflowDeleteAction from '@/components/workflow/WorkflowDeleteAction';

interface WorkflowDetailHeaderProps {
  workflowId: string;
  workflowName: string;
  workflowDescription?: string | null;
  isEditing: boolean;
  hasUnsavedChanges: boolean;
  isExecuting: boolean;
  onRefresh: () => void;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onExecute: () => void;
  onExportWorkflow: () => void;
}

export default function WorkflowDetailHeader({
  workflowId,
  workflowName,
  workflowDescription,
  isEditing,
  hasUnsavedChanges,
  isExecuting,
  onRefresh,
  onStartEditing,
  onCancelEditing,
  onExecute,
  onExportWorkflow,
}: WorkflowDetailHeaderProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  return (
    <PageHeader
      eyebrow="Workflow"
      icon={Workflow}
      tone="workflow"
      title={workflowName}
      description={workflowDescription || 'No backend workflow description configured.'}
      actions={
        <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
          <TooltipProvider delayDuration={100} skipDelayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={isEditing ? 'Cancel Edit' : 'Edit Workflow'}
                  onClick={() => {
                    if (isEditing) {
                      if (
                        hasUnsavedChanges &&
                        !window.confirm('Discard unsaved workflow changes?')
                      ) {
                        return;
                      }
                      onCancelEditing();
                      return;
                    }

                    onStartEditing();
                  }}
                >
                  {isEditing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {isEditing ? 'Cancel Edit' : 'Edit Workflow'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            type="button"
            onClick={onExecute}
            disabled={isExecuting || isEditing}
            className="min-w-37"
          >
            <Play className="mr-2 h-4 w-4" />
            {isEditing ? 'Save To Run' : isExecuting ? 'Starting...' : 'Run Workflow'}
          </Button>

          <DropdownMenu>
            <TooltipProvider delayDuration={100} skipDelayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="More workflow actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">More workflow actions</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={onRefresh}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onExportWorkflow}>
                <Download className="h-4 w-4" />
                Export Workflow
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                onSelect={() => setIsDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete Workflow
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <WorkflowDeleteAction
            workflowId={workflowId}
            workflowName={workflowName}
            redirectTo="/workflows"
            label="Delete Workflow"
            open={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
            trigger={null}
          />
        </div>
      }
    />
  );
}
