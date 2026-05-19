import { deleteWorkflowTask } from '@/app/api/utils/workflows';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

type DeleteTaskProps = {
  taskId: string;
  workflowId: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

const useDeleteTask = ({ taskId, workflowId, onSuccess, onError }: DeleteTaskProps) => {
  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => deleteWorkflowTask(workflowId, taskId),
  });

  const isDisabled = deleteTaskMutation.isPending || deleteTaskMutation.isSuccess;

  const handleDelete = async () => {
    toast.promise(deleteTaskMutation.mutateAsync(taskId), {
      loading: `Deleting task...`,
      success: (data) => {
        onSuccess?.();
        return `Task deleted successfully!`;
      },
      error: (err) => {
        onError?.(err);
        return `Failed to delete task, please try again.`;
      },
      position: 'top-right',
    });
  };

  return {
    handleDelete,
    isDisabled,
  };
};

export default useDeleteTask;
