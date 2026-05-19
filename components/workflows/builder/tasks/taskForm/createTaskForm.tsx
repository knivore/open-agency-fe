import type { WorkflowAgentFormData, WorkflowTaskFormData } from '@/types/workflows';
import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { appApiClient } from '@/lib/api';

import TaskForm from '@/components/workflows/builder/tasks/taskForm';
import { Button } from '../../../../library/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../../library/shadcn/dialog';
import { Wand2, X } from 'lucide-react';
import type { TaskFormMethodsRef } from './taskFormData';

export default function CreateTaskForm({
  workflowId,
  agents,
  allTasks = []
}: {
  workflowId: string;
  agents: WorkflowAgentFormData[];
  allTasks?: WorkflowTaskFormData[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdvance, setIsAdvance] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [showAIVersion, setShowAIVersion] = useState(false);
  const [originalValues, setOriginalValues] = useState<Partial<WorkflowTaskFormData>>({});
  const [rewrittenValues, setRewrittenValues] = useState<Partial<WorkflowTaskFormData>>({});
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const formMethodsRef = useRef<TaskFormMethodsRef | null>(null);

  // Handle dialog open/close
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);

    if (open) {
      setShowAIVersion(false);
      setRewrittenValues({});
      setOriginalValues({});
      setSelectedField(null);
      setIsRewriting(false);
      formMethodsRef.current?.reset({
        name: '',
        description: '',
        expected_output: '',
        depends_on_task_ids: [],
        human_approval_required: false,
        includeTask: true,
      });
      return;
    }

    setShowAIVersion(false);
    setRewrittenValues({});
    setOriginalValues({});
    setSelectedField(null);
    setIsRewriting(false);
    formMethodsRef.current?.reset();
  };

  // Handle form submission callbacks
  const handleMutateCallback = () => {
    setIsOpen(false);
  };

  const handleSuccessCallback = () => {
    // No additional handling needed - TaskForm will handle the cache invalidation
  };

  // Handle form submission error
  const handleErrorCallback = () => {
    toast.error('Failed to create task. Please try again.');
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

  // Handle individual field rewrite
  const handleRewriteField = async (field: 'name' | 'description' | 'expected_output') => {
    const currentValues = (formMethodsRef.current?.getValues() || {}) as Partial<WorkflowTaskFormData>;

    // Check if the field exists and has non-empty content
    if (!currentValues[field] || currentValues[field].toString().trim() === '') {
      toast.error(`Please fill in the ${field.replace('_', ' ')} field before rewriting`);
      return;
    }

    const valueToRewrite = currentValues[field];
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

  // Handle rewrite with AI
  const handleRewriteWithAI = async () => {
    // Check if fields are empty
    const currentValues = (formMethodsRef.current?.getValues() || {}) as Partial<WorkflowTaskFormData>;
    const isNameEmpty = !currentValues.name || currentValues.name.trim() === '';
    const isDescriptionEmpty = !currentValues.description || currentValues.description.trim() === '';
    const isExpectedOutputEmpty = !currentValues.expected_output || currentValues.expected_output.trim() === '';

    if (isNameEmpty || isDescriptionEmpty || isExpectedOutputEmpty) {
      toast.error('Please fill in Task Name, Task Description and Expected Output fields before using AI rewrite');
      return;
    }

    setIsRewriting(true);
    setRewrittenValues({}); // Clear previous rewritten values

    try {
      // Store original values
      setOriginalValues({
        name: currentValues.name || '',
        description: currentValues.description || '',
        expected_output: currentValues.expected_output || '',
      });

      const { data } = await appApiClient.post<{ data: Partial<WorkflowTaskFormData> }>('/api/tasks/rewrite', {
        task: {
          name: currentValues.name || '',
          description: currentValues.description || '',
          expected_output: currentValues.expected_output || '',
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

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full">Create Task</Button>
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

          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenChange(false)}>
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
          <DialogTitle>Task Creation</DialogTitle>
          <DialogDescription>Create a task for your workflow.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          <TaskForm
            mode="create"
            workflowId={workflowId}
            agents={agents}
            allTasks={allTasks}
            onMutateCallback={handleMutateCallback}
            onSuccessCallback={handleSuccessCallback}
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
