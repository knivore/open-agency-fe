import type { WorkflowEditorFormData } from '@/types/workflows';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { Badge } from '../library/shadcn/badge';
import { Button } from '../library/shadcn/button';
import { createWorkflow, editWorkflow } from '@/app/api/utils/workflows';
import { Label } from '../library/shadcn/label';
import MultiTypeInput from '../react-hook-form/multiTypeInput';
import TextArea from '../react-hook-form/textArea';

interface WorkflowFormProps {
  mode: 'create' | 'edit';
  workflow?: WorkflowEditorFormData;
  workflowInputs?: string[];
  onMutateCallback?: () => void;
  onSuccessCallback?: (...args: unknown[]) => void;
  onErrorCallback?: () => void;
}

export default function WorkflowForm({
  mode,
  workflow,
  workflowInputs = [],
  onMutateCallback = () => {},
  onSuccessCallback = () => {},
  onErrorCallback = () => {},
}: WorkflowFormProps) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { isDirty, errors },
    reset,
  } = useForm<WorkflowEditorFormData>({
    defaultValues:
      mode === 'edit'
        ? { ...workflow }
        : {
            name: '',
            description: '',
            process: 'sequential',
            inputs: [],
          },
  });

  useEffect(() => {
    if (mode === 'edit' && workflow) {
      reset(workflow);
    }
  }, [workflow, reset, mode]);

  const editWorkflowMutation = useMutation({
    mutationFn: (data: WorkflowEditorFormData) => editWorkflow(data.id!, data),
    onMutate: onMutateCallback,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflowDetail(workflow?.id!) });
      toast.success('Workflow updated successfully!', { position: 'top-right' });
      onSuccessCallback();
    },
    onError: (error) => {
      toast.error(`Failed to update workflow: ${error}`, { position: 'top-right' });
      onErrorCallback();
    },
  });

  const createWorkflowMutation = useMutation({
    mutationFn: createWorkflow,
    onMutate: onMutateCallback,
    onSuccess: (response) => {
      toast.success('Workflow created successfully!', { position: 'top-right' });
      onSuccessCallback(response.data.id);
    },
    onError: (error) => {
      toast.error(`Failed to create workflow: ${error}`, { position: 'top-right' });
      onErrorCallback();
    },
  });

  const onSubmit = (data: WorkflowEditorFormData) => {
    if (mode === 'edit') {
      toast.promise(editWorkflowMutation.mutateAsync(data), {
        loading: 'Updating workflow...',
        success: () => 'Workflow updated successfully!',
        position: 'top-right',
      });
      return;
    }

    toast.promise(createWorkflowMutation.mutateAsync(data), {
      loading: 'Creating workflow...',
      success: () => 'Workflow created successfully!',
      position: 'top-right',
    });
  };

  const isLoading = mode === 'edit' ? editWorkflowMutation.isPending : createWorkflowMutation.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
      <div className="flex-grow overflow-auto space-y-4">
        <MultiTypeInput
          name="name"
          label="Workflow Name"
          register={register}
          error={errors.name}
          validation={{ required: 'Workflow name is required' }}
          className="w-full max-w-full"
        />
        <TextArea
          name="description"
          label="Description"
          register={register}
          error={errors.description}
          validation={{ required: 'Description is required' }}
          className="w-full max-w-full resize-none"
          rows={10}
        />
        <WorkflowInputs workflowInputs={workflowInputs} />
      </div>

      <Button
        type="submit"
        className="my-3 select-none w-full"
        disabled={mode === 'edit' ? !isDirty || isLoading : isLoading}
      >
        {isLoading
          ? `${mode === 'edit' ? 'Updating' : 'Creating'}...`
          : `${mode === 'edit' ? 'Update' : 'Create'} Workflow`}
      </Button>
    </form>
  );
}

const WorkflowInputs = ({ workflowInputs }: { workflowInputs: string[] }) => {
  if (workflowInputs.length === 0) return null;
  return (
    <div className="space-y-1">
      <Label>Kickoff Inputs</Label>
      <div className="flex flex-wrap gap-2">
        {workflowInputs.map((input) => (
          <Badge key={input} variant="outline" className="select-none hover:bg-neutral-200">
            {input}
          </Badge>
        ))}
      </div>
    </div>
  );
};
