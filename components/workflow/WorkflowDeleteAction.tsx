'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { workflowsApi } from '@/lib/api/backend';
import { queryKeys } from '@/lib/react-query/queryKeys';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/library/shadcn/alert-dialog';
import { Button } from '@/components/library/shadcn/button';

interface WorkflowDeleteActionProps {
  workflowId: string;
  workflowName: string;
  redirectTo?: string;
  variant?: 'outline' | 'destructive';
  size?: 'default' | 'sm';
  label?: string;
}

export default function WorkflowDeleteAction({
  workflowId,
  workflowName,
  redirectTo,
  variant = 'outline',
  size = 'sm',
  label = 'Delete',
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

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant={variant} size={size}>
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete workflow</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove <span className="font-medium text-foreground">{workflowName}</span> from the canonical
            workflow catalog.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleteMutation.isPending}
            onClick={handleDelete}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
