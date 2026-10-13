'use client';

import { Button } from '@/components/library/shadcn/button';
import { useWorkflowRunLauncher } from '@/lib/workflows/useWorkflowRunLauncher';
import { toast } from 'sonner';

interface WorkflowRunActionButtonProps {
  workflowId: string;
  label: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  redirectTo?: (runId: string) => string;
}

export default function WorkflowRunActionButton({
  workflowId,
  label,
  size = 'sm',
  variant = 'outline',
  redirectTo,
}: WorkflowRunActionButtonProps) {
  const { workflowQuery, runtimeAdaptersQuery, preferredRuntimeAdapterId, launchMutation, launchWorkflow } =
    useWorkflowRunLauncher({
      workflowId,
      redirectTo: (runId) => (redirectTo ? redirectTo(runId) : `/runs/${runId}`),
    });
  const actionLabel = preferredRuntimeAdapterId ? `${label} (${preferredRuntimeAdapterId})` : label;

  const handleRun = () => {
    if (launchMutation.isPending) return;
    void toast.promise(launchWorkflow(undefined), {
      loading: 'Starting workflow...',
      success: 'Workflow run started.',
      error: (error) => (error instanceof Error ? error.message : 'Failed to start workflow.'),
      position: 'top-right',
    });
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={launchMutation.isPending || workflowQuery.isError || runtimeAdaptersQuery.isError}
      onClick={handleRun}
    >
      {launchMutation.isPending ? 'Starting...' : actionLabel}
    </Button>
  );
}
