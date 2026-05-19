'use client';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { useQuery } from '@tanstack/react-query';
import { getWorkflowInputs, getWorkflowPreview } from '@/app/api/utils/workflows';

import WorkflowRunControlsPanel from './WorkflowRunControlsPanel';
import WorkflowRunNavbarActions from './WorkflowRunNavbarActions';
import FullPageSpinner from '../../../spinner/fullPageSpinner';
import { useWorkflowRunContext } from '../WorkflowRunProvider';
import { useEffect } from 'react';

export default function WorkflowRunNavbar() {
  const { workflowId, setInputs } = useWorkflowRunContext();
  const { data: workflow, isLoading: workflowPreviewLoading } = useQuery({
    queryKey: queryKeys.workflowPreview(workflowId),
    queryFn: () => getWorkflowPreview(workflowId),
  });
  const { data: workflowInputs, isLoading: workflowInputsLoading } = useQuery<string[]>({
    queryKey: queryKeys.workflowInputs(workflowId),
    queryFn: () => getWorkflowInputs(workflowId),
  });

  useEffect(() => {
    if (workflowInputs) {
      const workflowKickoffInputs = workflowInputs.reduce(
        (acc, key) => ({
          ...acc,
          [key]: '',
        }),
        {} as Record<string, string>,
      );
      setInputs(workflowKickoffInputs);
    }
  }, [workflowInputs, setInputs]);

  const isLoading = workflowPreviewLoading || workflowInputsLoading;
  if (isLoading) return <FullPageSpinner />;

  return (
    <div className="relative">
      <div
        className="sticky top-0 w-full h-14 flex items-center z-50 bg-gradient-to-b from-primary-50 via-primary-50 to-transparent shadow-md">
        <p className="text-center text-sm w-full">{workflow?.name}</p>
        <div className="absolute inset-y-0 right-0 px-4 flex justify-end items-center">
          <WorkflowRunNavbarActions />
        </div>
      </div>
      <WorkflowRunControlsPanel />
    </div>
  );
}
