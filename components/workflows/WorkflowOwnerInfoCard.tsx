import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../library/shadcn/dropdown-menu';
import type { User } from '@/types/users';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { appApiClient } from '@/lib/api';
import { queryKeys } from '@/lib/react-query/queryKeys';

export default function WorkflowOwnerInfoCard({
  owner,
  creator,
  workflowId,
  onCloseDialog,
}: {
  owner: User;
  creator: User;
  workflowId: string;
  onCloseDialog: () => void;
}) {
  const queryClient = useQueryClient();
  const isCreator = owner.id === creator.id;

  const removeOwnerMutation = useMutation({
    mutationFn: async () => {
      await appApiClient.delete(`/api/workflows/${workflowId}/owners`, {
        body: { userId: owner.id },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflowOwners', workflowId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.workflowDetail(workflowId) });
      toast.success('Access updated successfully!', { position: 'top-right' });
      onCloseDialog();
    },
    onError: (error: any) => {
      toast.error(`Error removing access: ${error.message}`, { position: 'top-right' });
    },
  });

  return (
    <div className="flex items-center justify-between py-2 px-1 hover:bg-gray-50 rounded-md group">
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium">{owner.name}</span>
          <span className="text-xs text-gray-500">{owner.email}</span>
        </div>
      </div>
      {isCreator ? (
        <span className="text-xs text-gray-400 font-medium">Creator</span>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 rounded-full hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="h-4 w-4 text-gray-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => removeOwnerMutation.mutate()}>
              Remove access
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
