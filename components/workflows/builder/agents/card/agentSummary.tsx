import { forwardRef } from 'react';
import type { WorkflowAgentFormData } from '@/types/workflows';

interface AgentSummaryProps {
  agent: WorkflowAgentFormData;
  className?: string;
}

export const AgentSummary = forwardRef<HTMLDivElement, AgentSummaryProps>(
  ({ agent, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className="flex flex-col justify-start w-full p-4 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200"
        {...props}
      >
        <p className="font-semibold overflow-hidden text-ellipsis break-words line-clamp-3 whitespace-break-spaces">{agent.name}
          <span className="text-caption-1  pl-1">({agent.role})</span>
        </p>
        <p className="text-caption-1 text-gray-500 overflow-hidden text-ellipsis break-words line-clamp-3 whitespace-break-spaces">{agent.instructions}</p>
      </div>
    );
  },
);

AgentSummary.displayName = 'AgentSummary';
