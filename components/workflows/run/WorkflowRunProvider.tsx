'use client';

import { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import useWorkflowKickoff from '@/hooks/useWorkflowKickoff';
import type { UseWorkflowKickoffReturn } from '@/hooks/useWorkflowKickoff';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { getWorkflowDetail } from '@/app/api/utils/workflows';
import type { WorkflowExecutionStartPayload, WorkflowWorkspaceDetail } from '@/types/workflows';

interface WorkflowRunContextType extends UseWorkflowKickoffReturn {
  workflowId: string;
  isControlsOpen: boolean;
  setIsControlsOpen: (value: boolean) => void;
  inputs: Record<string, string>;
  taskOrder?: string[];
  setInputs: (value: Record<string, string>) => void;
  setTaskOrder: (value: string[]) => void;
  areAgentsConfigured: boolean; // ADDED
  setAreAgentsConfigured: (value: boolean) => void; // ADDED
  agentConfigs: WorkflowExecutionStartPayload['agentConfigs'] | null;
  setAgentConfigs: (value: WorkflowExecutionStartPayload['agentConfigs'] | null) => void;
}

export const WorkflowRunContext = createContext<WorkflowRunContextType | undefined>(undefined);

export function WorkflowRunProvider({
  children,
  workflowId,
}: {
  children: ReactNode;
  workflowId: string;
}) {
  const [isControlsOpen, setIsControlsOpen] = useState(true);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [taskOrder, setTaskOrder] = useState<string[]>([]);
  const [areAgentsConfigured, setAreAgentsConfigured] = useState(false);
  const [agentConfigs, setAgentConfigs] = useState<WorkflowExecutionStartPayload['agentConfigs'] | null>(null);

  const { data } = useQuery<WorkflowWorkspaceDetail>({
    queryKey: queryKeys.workflowDetail(workflowId),
    queryFn: () => getWorkflowDetail(workflowId),
  });

  const workflowTaskOrder = useMemo(
    () => data?.workflow.task_definitions?.map((task) => task.id ?? '') ?? [],
    [data?.workflow.task_definitions]
  );

  const effectiveTaskOrder = taskOrder.length > 0 ? taskOrder : workflowTaskOrder;

  const kickoffControls = useWorkflowKickoff({
    workflowId,
    inputs,
    taskOrder: effectiveTaskOrder,
    enableDetailedLogs: true,
    agentConfigs,
    onSuccess: () => console.log('Workflow kicked off successfully!'),
    onError: (err) => console.error('Failed to kick off workflow:', err),
  });

  return (
    <WorkflowRunContext.Provider
      value={{
        workflowId,
        agentConfigs,
        setAgentConfigs,
        isControlsOpen,
        setIsControlsOpen,
        inputs,
        setInputs,
        taskOrder: effectiveTaskOrder,
        setTaskOrder,
        areAgentsConfigured,
        setAreAgentsConfigured,
        ...kickoffControls,
      }}
    >
      {children}
    </WorkflowRunContext.Provider>
  );
}

export function useWorkflowRunContext() {
  const context = useContext(WorkflowRunContext);
  if (context === undefined) {
    throw new Error('useWorkflowRunContext must be used within a WorkflowRunProvider');
  }
  return context;
}
