'use client';

import { Play, RefreshCw } from 'lucide-react';
import { Button } from '../library/shadcn/button';
import { Checkbox } from '../library/shadcn/checkbox';
import { Label } from '../library/shadcn/label';
import PageHeader from '@/components/app-shell/PageHeader';
import WorkflowDeleteAction from '@/components/workflow/WorkflowDeleteAction';

interface WorkflowDetailHeaderProps {
  workflowId: string;
  workflowName: string;
  workflowDescription?: string | null;
  isEditing: boolean;
  isPublished: boolean;
  hasUnsavedChanges: boolean;
  isPublishing: boolean;
  isExecuting: boolean;
  restartActiveExecutions: boolean;
  onRefresh: () => void;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onPublish: () => void;
  onExecute: () => void;
  onRestartActiveExecutionsChange: (checked: boolean) => void;
}

export default function WorkflowDetailHeader({
  workflowId,
  workflowName,
  workflowDescription,
  isEditing,
  isPublished,
  hasUnsavedChanges,
  isPublishing,
  isExecuting,
  restartActiveExecutions,
  onRefresh,
  onStartEditing,
  onCancelEditing,
  onPublish,
  onExecute,
  onRestartActiveExecutionsChange,
}: WorkflowDetailHeaderProps) {
  const publishButtonLabel = (() => {
    if (isEditing) {
      return 'Save To Publish';
    }
    if (isPublishing) {
      return isPublished ? 'Unpublishing...' : 'Publishing...';
    }
    return isPublished ? 'Unpublish' : 'Publish';
  })();

  return (
    <PageHeader
      eyebrow="Workflow"
      title={workflowName}
      description={workflowDescription || 'No backend workflow description configured.'}
      actions={
        <>
          <Button type="button" variant="outline" onClick={onRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (isEditing) {
                if (hasUnsavedChanges && !window.confirm('Discard unsaved workflow changes?')) {
                  return;
                }
                onCancelEditing();
                return;
              }

              onStartEditing();
            }}
          >
            {isEditing ? 'Cancel Edit' : 'Edit Workflow'}
          </Button>
          <div className="flex min-h-10 items-center gap-2 rounded-md border border-neutral-200 px-3">
            <Checkbox
              id="restart-active-executions"
              checked={restartActiveExecutions}
              disabled={isPublishing || isEditing}
              onCheckedChange={(checked) => onRestartActiveExecutionsChange(checked === true)}
            />
            <Label htmlFor="restart-active-executions" className="text-sm text-neutral-700">
              Restart active runs
            </Label>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={onPublish}
            disabled={isPublishing || isEditing}
          >
            {publishButtonLabel}
          </Button>
          <Button type="button" onClick={onExecute} disabled={isExecuting || isEditing}>
            <Play className="mr-2 h-4 w-4" />
            {isEditing ? 'Save To Run' : isExecuting ? 'Starting...' : 'Run Workflow'}
          </Button>
          <WorkflowDeleteAction
            workflowId={workflowId}
            workflowName={workflowName}
            redirectTo="/workflows"
            variant="destructive"
            label="Delete Workflow"
          />
        </>
      }
    />
  );
}
