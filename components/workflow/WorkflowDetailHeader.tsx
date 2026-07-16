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
  DropdownMenuGroup,
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
import ConfirmActionDialog from '@/components/app-shell/ConfirmActionDialog';
import WorkflowDeleteAction from '@/components/workflow/WorkflowDeleteAction';
import { cn } from '@/lib/utils';

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
  const [isCancelEditDialogOpen, setIsCancelEditDialogOpen] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const description = workflowDescription || 'No backend workflow description configured.';

  return (
    <>
      <PageHeader
        className="lg:items-start"
        compact
        eyebrow="Workflow"
        icon={Workflow}
        tone="workflow"
        title={workflowName}
        description={
          <div className="flex max-w-3xl flex-col items-start gap-1">
            <span className={cn(!isDescriptionExpanded && 'line-clamp-2')}>{description}</span>
            {description.length > 180 ? (
              <button
                type="button"
                className="rounded-sm font-medium text-(--agency-page-tone) underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-expanded={isDescriptionExpanded}
                onClick={() => setIsDescriptionExpanded((current) => !current)}
              >
                {isDescriptionExpanded ? 'Show less' : 'More details'}
              </button>
            ) : null}
          </div>
        }
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
                        if (hasUnsavedChanges) {
                          setIsCancelEditDialogOpen(true);
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
              variant="brand"
              onClick={onExecute}
              disabled={isExecuting || isEditing}
              className="min-w-0 px-3 sm:min-w-37 sm:px-4"
            >
              <Play data-icon="inline-start" />
              {isEditing ? 'Run after saving' : isExecuting ? 'Starting...' : 'Run Workflow'}
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
                <DropdownMenuGroup>
                  <DropdownMenuItem onSelect={onRefresh}>
                    <RefreshCw />
                    Refresh workflow
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={onExportWorkflow}>
                    <Download />
                    Export workflow
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                    onSelect={() => setIsDeleteDialogOpen(true)}
                  >
                    <Trash2 />
                    Delete workflow
                  </DropdownMenuItem>
                </DropdownMenuGroup>
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
      <ConfirmActionDialog
        trigger={null}
        open={isCancelEditDialogOpen}
        onOpenChange={setIsCancelEditDialogOpen}
        title="Discard unsaved workflow changes?"
        description="This closes edit mode and removes changes that have not been saved to the backend."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        destructive
        onConfirm={onCancelEditing}
      />
    </>
  );
}
