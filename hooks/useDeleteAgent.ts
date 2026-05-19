import { deleteWorkflowAgent } from '@/app/api/utils/workflows';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

type DeleteAgentProps = {
  agentId: string;
  workflowId: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

const useDeleteAgent = ({ agentId, workflowId, onSuccess, onError }: DeleteAgentProps) => {
  const deleteAgentMutation = useMutation({
    mutationFn: (agentId: string) => deleteWorkflowAgent(workflowId, agentId),
  });

  const isDisabled = deleteAgentMutation.isPending || deleteAgentMutation.isSuccess;

  const handleDelete = async () => {
    toast.promise(deleteAgentMutation.mutateAsync(agentId), {
      loading: `Deleting agent...`,
      success: (data) => {
        onSuccess?.();
        return `Agent deleted successfully!`;
      },
      error: (err) => {
        onError?.(err);
        return `Failed to delete agent, please try again.`;
      },
      position: 'top-right',
    });
  };

  return {
    handleDelete,
    isDisabled,
  };
};

export default useDeleteAgent;
