import type { WorkflowAgentFormData, WorkflowTaskFormData } from '@/types/workflows';
import { useState, useRef } from 'react';
import useDeleteTask from '@/hooks/useDeleteTask';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { toast } from 'sonner';

import TaskForm from '@/components/workflows/builder/tasks/taskForm';
import { TaskSummary } from '@/components/workflows/builder/tasks/card/taskSummary';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../../library/shadcn/dialog';
import { Button } from '../../../../library/shadcn/button';
import { Wand2, X, Trash2 } from 'lucide-react';
import AlertDialog from '../../../../dialog/AlertDialog';
import { appApiClient } from '@/lib/api';
import type { TaskFormMethodsRef } from '@/components/workflows/builder/tasks/taskForm/taskFormData';

export default function TaskCard({ task, agents, allTasks, workflowId }: {
  task: WorkflowTaskFormData,
  agents: WorkflowAgentFormData[],
  allTasks: WorkflowTaskFormData[],
  workflowId: string,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdvance, setIsAdvance] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [showAIVersion, setShowAIVersion] = useState(false);
  const [originalValues, setOriginalValues] = useState<Partial<WorkflowTaskFormData>>({});
  const [rewrittenValues, setRewrittenValues] = useState<Partial<WorkflowTaskFormData>>({});
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const formMethodsRef = useRef<TaskFormMethodsRef | null>(null);

  const { handleDelete, isDisabled } = useDeleteTask({
    taskId: task.id!,
    workflowId,
    onSuccess: () => {
      setIsOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.workflowDetail(workflowId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.workflowInputs(workflowId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflow(workflowId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowList() });
    },
    onError: (error) => {
      console.error('Failed to delete task:', error);
    },
  });

  // Handle dialog open/close
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);

    if (open) {
      setShowAIVersion(false);
      setRewrittenValues({});
      setOriginalValues({});
      setSelectedField(null);
      setIsRewriting(false);
      return;
    }

    setShowAIVersion(false);
    setRewrittenValues({});
    setOriginalValues({});
    setSelectedField(null);
    setIsRewriting(false);

    if (formMethodsRef.current?.reset) {
      formMethodsRef.current.reset();
    }
  };

  // Handle form submission success
  const handleMutateCallback = () => {
    setIsOpen(false);

  };

  // Handle form submission error
  const handleErrorCallback = () => {
    toast.error('Failed to update task. Please try again.');
  };

  // Helper function to apply values to form
  const applyValuesToForm = (values: Partial<WorkflowTaskFormData>, isDirty: boolean) => {
    if (!formMethodsRef.current?.setValue) return;

    if (values.name !== undefined) {
      formMethodsRef.current.setValue('name', values.name, { shouldDirty: isDirty });
    }
    if (values.description !== undefined) {
      formMethodsRef.current.setValue('description', values.description, { shouldDirty: isDirty });
    }
    if (values.expected_output !== undefined) {
      formMethodsRef.current.setValue('expected_output', values.expected_output, { shouldDirty: isDirty });
    }
  };

  // Handle toggle change
  const handleToggleChange = (checked: boolean) => {
    setShowAIVersion(checked);

    // Apply the appropriate values based on the toggle state
    const valuesToSet = checked ? rewrittenValues : originalValues;
    const shouldDirty = checked && Object.keys(rewrittenValues).length > 0;

    applyValuesToForm(valuesToSet, shouldDirty);
  };

  // Handle rewrite with AI
  const handleRewriteWithAI = async () => {
    // Check if fields are empty
    const currentValues = (formMethodsRef.current?.getValues() || {}) as Partial<WorkflowTaskFormData>;
    const isNameEmpty = !currentValues.name || currentValues.name.trim() === '';
    const isDescriptionEmpty = !currentValues.description || currentValues.description.trim() === '';
    const isExpectedOutputEmpty = !currentValues.expected_output || currentValues.expected_output.trim() === '';

    if (isNameEmpty || isDescriptionEmpty || isExpectedOutputEmpty) {
      toast.error('Please fill in all required fields before using AI rewrite');
      return;
    }

    setIsRewriting(true);
    setRewrittenValues({}); // Clear previous rewritten values

    try {
      // Store original values
      setOriginalValues({
        name: currentValues.name || task.name || '',
        description: currentValues.description || task.description || '',
        expected_output: currentValues.expected_output || task.expected_output || '',
      });

      const { data } = await appApiClient.post<{ data: Partial<WorkflowTaskFormData> }>('/api/tasks/rewrite', {
        task: {
          name: currentValues.name || task.name || '',
          description: currentValues.description || task.description || '',
          expected_output: currentValues.expected_output || task.expected_output || '',
        },
      });

      // Store rewritten values
      setRewrittenValues(data);

      // Set the toggle to show AI version and apply the rewritten values
      setShowAIVersion(true);
      applyValuesToForm(data, true);

      toast.success('Task rewritten with AI successfully!');
    } catch (error) {
      console.error('Error rewriting task:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to rewrite task with AI');
    } finally {
      setIsRewriting(false);
    }
  };

  // Handle individual field rewrite
  const handleRewriteField = async (field: 'name' | 'description' | 'expected_output') => {
    const currentValues = (formMethodsRef.current?.getValues() || {}) as Partial<WorkflowTaskFormData>;

    // Check if the field exists and has non-empty content
    if (!currentValues[field] || currentValues[field].toString().trim() === '') {
      toast.error(`Please fill in the ${field.replace('_', ' ')} field before rewriting`);
      return;
    }

    const valueToRewrite = currentValues[field] || task[field];
    setSelectedField(field);
    setIsRewriting(true);

    // Store original value for this specific field if not already stored
    if (originalValues[field] === undefined) {
      setOriginalValues(prev => ({ ...prev, [field]: valueToRewrite }));
    }

    try {
      const { data } = await appApiClient.post<{ data: Partial<WorkflowTaskFormData> }>('/api/tasks/rewrite', {
        task: { ...currentValues },
        field,
      });

      if (data[field]) {
        const newRewrittenValue = data[field];
        formMethodsRef.current?.setValue(field, newRewrittenValue, { shouldDirty: true });
        // Update rewrittenValues state and show toggle
        setRewrittenValues(prev => ({ ...prev, [field]: newRewrittenValue }));
        setShowAIVersion(true);
        toast.success(`Task ${field} rewritten with AI successfully!`);
      }

    } catch (error) {
      console.error(`Error rewriting task ${field}:`, error);
      toast.error(error instanceof Error ? error.message : `Failed to rewrite task ${field} with AI`);
    } finally {
      setIsRewriting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <TaskSummary name={task.name} description={task.description} />
      </DialogTrigger>
      <DialogContent
        className={`${isAdvance ? 'max-w-[60vw] w-[60vw]' : ''}
          flex flex-col max-h-[90vh] overflow-hidden`}
        hideCloseButton
      >
        <div className="absolute right-4 top-4 flex flex-row items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="gap-1 h-10"
            onClick={handleRewriteWithAI}
            disabled={isRewriting}
          >
            <Wand2 className="h-4 w-4" />
            {isRewriting ? '...' : 'Rewrite with AI'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-fit h-10"
            onClick={() => setIsAdvance(!isAdvance)}
          >
            {isAdvance ? 'Simple' : 'Advance'}
          </Button>

          <AlertDialog
            trigger={
              <Button variant="ghost" size="icon" disabled={isDisabled}>
                <Trash2 className="h-4 w-4" />
              </Button>
            }
            title="Delete Task"
            description="Are you sure you want to delete this task? This action cannot be undone."
            confirmText="Delete"
            cancelText="Cancel"
            variant="destructive"
            onConfirm={handleDelete}
          />

          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {Object.keys(rewrittenValues).length > 0 && (
          <div className="absolute right-4 top-16 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Original</span>
            <div className="relative inline-block w-11 h-5">
              <input
                type="checkbox"
                checked={showAIVersion}
                onChange={(e) => handleToggleChange(e.target.checked)}
                className="peer appearance-none w-11 h-5 bg-slate-100 rounded-full checked:bg-slate-800 cursor-pointer transition-colors duration-300"
              />
              <span className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform duration-300 peer-checked:translate-x-6"></span>
            </div>
            <span className="text-sm text-muted-foreground">Rewritten</span>
          </div>
        )}

        <DialogHeader className="flex-shrink-0 mt-8">
          <DialogTitle>Task Details</DialogTitle>
          <DialogDescription>
            Update your workflow task details here
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          <TaskForm
            mode="edit"
            workflowId={workflowId}
            task={task}
            agents={agents}
            allTasks={allTasks}
            onMutateCallback={handleMutateCallback}
            onErrorCallback={handleErrorCallback}
            isAdvance={isAdvance}
            formMethodsRef={formMethodsRef}
            onRewriteField={handleRewriteField}
            isRewriting={isRewriting}
            selectedField={selectedField}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
