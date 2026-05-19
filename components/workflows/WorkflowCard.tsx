import type { WorkflowDefinition } from '@/types/workflows';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { toolDisplayName } from '@/lib/tools/displayName';
import { localUser } from '@/lib/identity/localUser';

interface WorkflowCardProps {
  workflow: WorkflowDefinition;
  onDelete: (workflowId: string) => Promise<void>;
}

export default function WorkflowCard({ workflow, onDelete }: WorkflowCardProps) {
  const userId = localUser.id;
  const queryClient = useQueryClient();
  const [isHovered, setIsHovered] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);

  const deleteWorkflowMutation = useMutation({
    mutationFn: onDelete,
    onMutate: () => {
      setIsHovered(false);
    },
    onSuccess: () => {
      setTimeout(() => {
        setIsDeleted(true);
        queryClient.invalidateQueries({ queryKey: queryKeys.workflowsOwnedByUser(userId) });
      }, 300);
    },
  });

  const isDisabled = deleteWorkflowMutation.isPending || deleteWorkflowMutation.isSuccess;

  const handleMouseEnter = () => {
    if (!isDisabled) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isDisabled) {
      setIsHovered(false);
    }
  };

  if (isDeleted) {
    return null;
  }

  return (
    <Link
      href={`/workflows/${workflow.id}/view`}
      className={`block ${isDisabled ? 'pointer-events-none' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={`agency-card relative h-28 rounded-xl
          border p-6 transition-all duration-300 ease-in-out
          ${isDisabled ? 'opacity-40 cursor-not-allowed transform scale-95' : 'cursor-pointer shadow-[0_2px_10px_rgba(0,0,0,0.08)]'}
          ${isHovered && !isDisabled ? 'border-primary-300 shadow-[0_12px_28px_rgba(6,53,94,0.14)] -translate-y-1' : ''}`}
      >
        <div className="flex items-start justify-between h-full">
          <div className="flex items-start space-x-4 flex-1 min-w-0">
            <div className="agency-gradient flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg shadow-inner">
              <span className="text-lg font-medium text-white">
                {workflow.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0 flex flex-col">
              <h3 className="font-semibold text-gray-900 text-lg truncate mb-1">{workflow.name}</h3>
              <p className="text-gray-500 line-clamp-2 text-sm flex-grow">
                {workflow.description || 'No description available'}
              </p>
            </div>
            <div className="flex-0 flex-col w-1/2 pr-4">
              <p className="text-gray-500 line-clamp-3 text-sm flex-grow">
                <b>Tool used:</b>{' '}
                {Array.from(
                  new Set(
                    (workflow.agent_definitions ?? []).flatMap((agent) =>
                      (agent.tool_ids ?? []).map((toolId) => {
                        const tool = workflow.tool_definitions?.find(
                          (candidate) => candidate.id === toolId
                        );
                        return tool ? toolDisplayName(tool) : toolId;
                      })
                    )
                  )
                ).join(' • ')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
