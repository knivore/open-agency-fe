import type { WorkflowAgentFormData, WorkflowTaskFormData } from '@/types/workflows';
import { addWorkflowTask, updateWorkflowTask } from '@/app/api/utils/workflows';
import { useForm, FormProvider } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { useEffect } from 'react';

import { Button } from '../../../../library/shadcn/button';
import BaseTaskFormFields from './baseTaskFormFields';
import ContextSelection from './context/contextSelection';
import { Separator } from '../../../../library/shadcn/separator';
import type { TaskFormMethodsRef } from './taskFormData';

interface TaskFormProps {
  mode: 'create' | 'edit';
  workflowId: string;
  task?: WorkflowTaskFormData;
  allTasks?: WorkflowTaskFormData[];
  agents: WorkflowAgentFormData[];
  isAdvance?: boolean;
  onMutateCallback?: () => void;
  onSuccessCallback?: (task?: WorkflowTaskFormData) => void;
  onErrorCallback?: () => void;
  formMethodsRef?: React.MutableRefObject<TaskFormMethodsRef | null>;
  onRewriteField?: (field: 'name' | 'description' | 'expected_output') => Promise<void>;
  isRewriting?: boolean;
  selectedField?: string | null;
}

export default function TaskForm({
  mode,
  workflowId,
  task,
  allTasks = [],
  agents,
  isAdvance,
  onMutateCallback = () => {},
  onSuccessCallback = () => {},
  onErrorCallback = () => {},
  formMethodsRef,
  onRewriteField,
  isRewriting,
  selectedField,
}: TaskFormProps) {
  const queryClient = useQueryClient();
  const methods = useForm<WorkflowTaskFormData>({
    defaultValues:
      mode === 'edit'
        ? task
        : {
            name: '',
            description: '',
            expected_output: '',
            depends_on_task_ids: [],
            human_approval_required: false,
            includeTask: true,
          },
  });

  // Store form methods in the ref if provided
  useEffect(() => {
    if (formMethodsRef) {
      formMethodsRef.current = methods;
    }
  }, [methods, formMethodsRef]);

  const editTaskMutation = useMutation({
    mutationFn: (data: WorkflowTaskFormData) => updateWorkflowTask(workflowId, data),
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: WorkflowTaskFormData) => addWorkflowTask(workflowId, data),
  });

  const onSubmit = (data: WorkflowTaskFormData) => {
    // Call mutation callback immediately (e.g., to close dialog)
    onMutateCallback();

    const mutation = mode === 'create' ? createTaskMutation : editTaskMutation;
    const actionText = mode === 'create' ? 'Creating' : 'Updating';

    // Use toast.promise with the appropriate mutation
    toast.promise(mutation.mutateAsync(data), {
      loading: `${actionText} task...`,
      success: (response) => {
        // Invalidate the workflow query to refetch fresh data in the background
        queryClient.invalidateQueries({ queryKey: queryKeys.workflowDetail(workflowId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.workflowInputs(workflowId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflow(workflowId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowList() });
        // Call success callback with the task data
        onSuccessCallback(response);
        return `Task ${mode === 'create' ? 'created' : 'updated'} successfully!`;
      },
      error: () => {
        onErrorCallback();
        return `Failed to ${mode === 'create' ? 'create' : 'update'} task, please try again.`;
      },
      position: 'top-right',
    });
  };

  const isPending = mode === 'create' ? createTaskMutation.isPending : editTaskMutation.isPending;

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(onSubmit)}
        className="grid grid-cols-12 gap-4 h-full px-1"
      >
        <div className="col-span-12 space-y-2">
          <BaseTaskFormFields
            agents={agents}
            isAdvance={isAdvance}
            onRewriteField={onRewriteField}
            isRewriting={isRewriting}
            selectedField={selectedField}
          />
          {isAdvance && (
            <>
              <Separator />
              <ContextSelection currentTaskId={task?.id || ''} allTasks={allTasks} />
            </>
          )}
        </div>

        <div className="col-span-12">
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending
              ? `${mode === 'create' ? 'Creating' : 'Updating'}...`
              : `${mode === 'create' ? 'Create' : 'Update'} Task`}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
