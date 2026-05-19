import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
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
} from '../library/shadcn/alert-dialog';
import { Button } from '../library/shadcn/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { deleteWorkflow } from '@/app/api/utils/workflows';
import { useRouter } from 'next/navigation';
import { localUser } from '@/lib/identity/localUser';

export default function WorkflowDelete({ workflowId }: { workflowId: string }) {
  const queryClient = useQueryClient();
  const userId = localUser.id;
  const router = useRouter();

  const deleteWorkflowMutation = useMutation({
    mutationFn: () => deleteWorkflow(workflowId),
    onSuccess: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.workflowsOwnedByUser(userId) });
      }, 300);
      router.back();
    },
  });

  const handleDelete = async () => {
    toast.promise(deleteWorkflowMutation.mutateAsync(), {
      loading: 'Deleting workflow...',
      success: () => 'Workflow deleted successfully!',
      error: (err) => {
        console.error(err);
        return 'Failed to delete workflow, please try again.';
      },
      position: 'top-right',
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          className="p-2 rounded-full bg-white text-gray-800 border border-primary-500 inline-flex items-center gap-1.5 hover:bg-primary-50"
          variant="outline"
        >
          <Trash2 className="h-5 w-5 text-primary-600" />
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete your workflow and all associated agents and tasks.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Let me think</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
