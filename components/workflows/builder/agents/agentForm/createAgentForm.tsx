import type { WorkflowAgentFormData, WorkflowToolOption } from '@/types/workflows';
import { useState } from 'react';
import { toast } from 'sonner';

import AgentForm from '@/components/workflows/builder/agents/agentForm';
import { Button } from '../../../../library/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../../library/shadcn/dialog';
import { FormProvider, useForm } from 'react-hook-form';
import { Wand2, X } from 'lucide-react';
import { appApiClient } from '@/lib/api';

export default function CreateAgentForm({ workflowId, tools }: {
  workflowId: string;
  tools: WorkflowToolOption[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdvance, setIsAdvance] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [showAIVersion, setShowAIVersion] = useState(false);
  const [originalValues, setOriginalValues] = useState<Partial<WorkflowAgentFormData>>({});
  const [rewrittenValues, setRewrittenValues] = useState<Partial<WorkflowAgentFormData>>({});

  const methods = useForm<WorkflowAgentFormData>({
    defaultValues: {
      name: '',
      role: '',
      instructions: '',
      backstory: '',
      tool_ids: [],
      handoff_agent_ids: [],
      tool_configs: [],
      temperature: 0.5,
    },
  });

  const builderFieldLabel = (field: 'name' | 'role' | 'instructions' | 'backstory') => field;

  // Helper function to apply values to form
  const applyValuesToForm = (values: Partial<WorkflowAgentFormData>, isDirty: boolean) => {
    if (values.name !== undefined) methods.setValue('name', values.name, { shouldDirty: isDirty });
    if (values.role !== undefined) methods.setValue('role', values.role, { shouldDirty: isDirty });
    if (values.instructions !== undefined) {
      methods.setValue('instructions', values.instructions, { shouldDirty: isDirty });
    }
    if (values.backstory !== undefined) {
      methods.setValue('backstory', values.backstory, { shouldDirty: isDirty });
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

  // Handle full agent rewrite
  const handleRewriteWithAI = async () => {
    // Check if fields are empty
    const currentValues = methods.getValues();
    const isNameEmpty = !currentValues.name || currentValues.name.trim() === '';
    const isRoleEmpty = !currentValues.role || currentValues.role.trim() === '';
    const isInstructionsEmpty = !currentValues.instructions || currentValues.instructions.trim() === '';

    if (isNameEmpty || isRoleEmpty || isInstructionsEmpty) {
      toast.error('Please fill in name, role, and instructions before using AI rewrite');
      return;
    }

    setIsRewriting(true);
    setRewrittenValues({}); // Clear previous rewritten values

    try {
      // Store original values
      setOriginalValues({
        name: currentValues.name || '',
        role: currentValues.role || '',
        instructions: currentValues.instructions || '',
        backstory: currentValues.backstory || '',
      });

      const { data } = await appApiClient.post<{ data: Partial<WorkflowAgentFormData> }>('/api/agents/rewrite', {
        agent: currentValues,
      });

      setRewrittenValues(data);

      // Set the toggle to show AI version and apply the rewritten values
      setShowAIVersion(true);
      applyValuesToForm(data, true);

      toast.success('Agent rewritten with AI successfully!');
    } catch (error) {
      console.error('Error rewriting agent:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to rewrite agent with AI');
    } finally {
      setIsRewriting(false);
    }
  };

  const handleRewriteField = async (field: 'name' | 'role' | 'instructions' | 'backstory') => {
    const currentValues = methods.getValues();
    const valueToRewrite = currentValues[field] || '';

    // Check if the field is empty
    if (!valueToRewrite || valueToRewrite.trim() === '') {
      toast.error(`Please fill in the ${builderFieldLabel(field)} field before rewriting`);
      return;
    }

    setSelectedField(field);
    setIsRewriting(true);

    // Store original value for this specific field if not already stored
    if (originalValues[field] === undefined) {
      setOriginalValues(prev => ({ ...prev, [field]: valueToRewrite }));
    }

    try {
      const { data } = await appApiClient.post<{ data: Partial<WorkflowAgentFormData> }>('/api/agents/rewrite', {
        agent: { ...currentValues, [field]: valueToRewrite },
        field,
      });

      if (data[field]) {
        const newRewrittenValue = data[field];
        methods.setValue(field, newRewrittenValue, { shouldDirty: true });
        // Update rewrittenValues state and show toggle
        setRewrittenValues(prev => ({ ...prev, [field]: newRewrittenValue }));
        setShowAIVersion(true);
        toast.success(`Agent ${builderFieldLabel(field)} rewritten with AI successfully!`);
      }

    } catch (error) {
      console.error(`Error rewriting agent ${field}:`, error);
      toast.error(error instanceof Error ? error.message : `Failed to rewrite agent ${builderFieldLabel(field)} with AI`);
    } finally {
      setIsRewriting(false);
      setSelectedField(null);
    }
  };

  // Handle dialog open/close
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);

    if (open) {
      setShowAIVersion(false);
      setRewrittenValues({});
      setOriginalValues({});
      setSelectedField(null);
      methods.reset({
        name: '',
        role: '',
        instructions: '',
        backstory: '',
        tool_ids: [],
        handoff_agent_ids: [],
        tool_configs: [],
        temperature: 0.5,
      });
      return;
    }

    setShowAIVersion(false);
    setRewrittenValues({});
    setOriginalValues({});
    setSelectedField(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full">Create Agent</Button>
      </DialogTrigger>
      <DialogContent
        className={`${isAdvance ? 'max-w-[60vw] w-[60vw]' : ''} flex flex-col max-h-[90vh]`}
        hideCloseButton
      >
        <FormProvider {...methods}>
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
            <DialogTitle>Agent Creation</DialogTitle>
            <DialogDescription>Create an agent for your workflow.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            <AgentForm
              mode="create"
              workflowId={workflowId}
              tools={tools}
              onMutateCallback={() => {
                // Reset state and close dialog after successful form submission
                setShowAIVersion(false);
                setRewrittenValues({});
                setOriginalValues({});
                setSelectedField(null);
                setIsOpen(false);
              }}
              isAdvance={isAdvance}
              onRewriteField={handleRewriteField}
              isRewriting={isRewriting}
              selectedField={selectedField}
            />
          </div>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
