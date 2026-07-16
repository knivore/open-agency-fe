'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { workflowsApi } from '@/lib/api/backend/workflows';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { Button } from '@/components/library/shadcn/button';
import ConfirmActionDialog from '@/components/app-shell/ConfirmActionDialog';

interface WorkflowDeleteActionProps {
  workflowId: string;
  workflowName: string;
  redirectTo?: string;
  variant?: 'outline' | 'destructive';
  size?: 'default' | 'sm';
  label?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode | null;
}

export default function WorkflowDeleteAction({
  workflowId,
  workflowName,
  redirectTo,
  variant = 'outline',
  size = 'sm',
  label = 'Delete',
  open,
  onOpenChange,
  trigger,
}: WorkflowDeleteActionProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => workflowsApi.deleteWorkflow(workflowId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowList() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflow(workflowId) }),
      ]);

      if (redirectTo) {
        router.push(redirectTo);
      }
    },
  });

  const handleDelete = async () => {
    await toast.promise(deleteMutation.mutateAsync(), {
      loading: `Deleting ${workflowName}...`,
      success: 'Workflow deleted.',
      error: (error) => (error instanceof Error ? error.message : 'Failed to delete workflow.'),
      position: 'top-right',
    });
  };
  const resolvedTrigger =
    trigger === null
      ? null
      : (trigger ?? (
          <Button type="button" variant={variant} size={size}>
            {label}
          </Button>
        ));

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={onOpenChange}
      trigger={resolvedTrigger}
      title="Delete workflow?"
      description={`This permanently removes ${workflowName} from the canonical workflow catalog. This action cannot be undone.`}
      cancelLabel="Keep workflow"
      confirmLabel="Delete workflow"
      pendingLabel="Deleting workflow..."
      pending={deleteMutation.isPending}
      destructive
      onConfirm={handleDelete}
    />
  );
}
