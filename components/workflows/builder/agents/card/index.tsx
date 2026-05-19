import type { WorkflowAgentFormData, WorkflowToolOption } from '@/types/workflows';
import useDeleteAgent from '@/hooks/useDeleteAgent';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import AgentForm from '@/components/workflows/builder/agents/agentForm';
import { AgentSummary } from '@/components/workflows/builder/agents/card/agentSummary';
import { CustomDialogActions } from '@/components/workflows/builder/agents/card/dialog/customDialogActions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../../library/shadcn/dialog';
import { FormProvider, useForm } from 'react-hook-form';
import { appApiClient } from '@/lib/api';

interface AgentCardProps {
  agent: WorkflowAgentFormData;
  workflowId: string;
  tools: WorkflowToolOption[];
}

export default function AgentCard({ agent, workflowId, tools }: AgentCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdvance, setIsAdvance] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [showAIVersion, setShowAIVersion] = useState(false);
  const [originalValues, setOriginalValues] = useState<Partial<WorkflowAgentFormData>>({});
  const [rewrittenValues, setRewrittenValues] = useState<Partial<WorkflowAgentFormData>>({});

  const queryClient = useQueryClient();
  const methods = useForm<WorkflowAgentFormData>({
    // Default values are set in the useEffect below to ensure they capture the initial state
  });

  const builderFieldLabel = (field: 'name' | 'role' | 'instructions' | 'backstory') => field;

  const { handleDelete, isDisabled } = useDeleteAgent({
    agentId: agent.id!,
    workflowId,
    onSuccess: () => {
      setIsOpen(false); // Close dialog on successful delete
      queryClient.invalidateQueries({ queryKey: queryKeys.workflowDetail(workflowId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.workflowInputs(workflowId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflow(workflowId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowList() });
    },
    onError: (error) => console.error('Failed to delete agent:', error),
  });

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

  // Handle global rewrite
  const handleRewriteWithAI = async () => {
    if (!agent) return;

    setIsRewriting(true);
    const currentAgentData = methods.getValues(); // Use current form values
    setOriginalValues(currentAgentData); // Store current form state as original
    setRewrittenValues({}); // Clear previous rewritten values

    try {
      const { data } = await appApiClient.post<{ data: Partial<WorkflowAgentFormData> }>('/api/agents/rewrite', {
        agent: currentAgentData,
      });

      setRewrittenValues(data);
      setShowAIVersion(true);
      applyValuesToForm(data, true); // Apply rewritten values to form

      toast.success('Agent rewritten with AI successfully!');
    } catch (error) {
      console.error('Error rewriting agent:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to rewrite agent with AI');
      // If error, revert to original values? Consider this UX.
      // applyValuesToForm(originalValues, false);
    } finally {
      setIsRewriting(false);
    }
  };

  // Handle individual field rewrite
  const handleRewriteField = async (field: 'name' | 'role' | 'instructions' | 'backstory') => {
    if (!agent) return;

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
      // Keep selectedField until dialog closes or another rewrite starts
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

  // Handle dialog open/close state changes, including reset logic
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      const initialValues = {
        ...agent,
        temperature: parseFloat(agent?.temperature?.toString() || '0.5'),
      };
      setOriginalValues(initialValues);
      methods.reset(initialValues);
      setRewrittenValues({});
      setShowAIVersion(false);
      setSelectedField(null);
      return;
    }

    if (!open) {
      setShowAIVersion(false);
      setRewrittenValues({});
      setSelectedField(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <AgentSummary agent={agent} />
      </DialogTrigger>
      <DialogContent
        className={`${isAdvance ? 'max-w-[60vw] w-[60vw]' : ''} flex flex-col max-h-[90vh]`}
        hideCloseButton
      >
        <FormProvider {...methods}>
          <CustomDialogActions
            onClose={() => handleOpenChange(false)} // Ensure close calls the main handler
            onDelete={handleDelete}
            isDeleteDisabled={isDisabled}
            isAdvance={isAdvance}
            setIsAdvance={setIsAdvance}
            agent={agent} // Still needed for delete check?
            onRewriteWithAI={handleRewriteWithAI} // Pass global rewrite handler
            isRewriting={isRewriting}
            // No need to pass setIsRewriting or selectedField if only used for display logic managed here
            showAIVersion={showAIVersion} // Pass state for toggle display
            rewrittenValues={rewrittenValues} // Pass state for toggle display condition
            onToggleChange={handleToggleChange} // Pass toggle handler
          />
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Agent Details</DialogTitle>
            <DialogDescription>Update your agent details here</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            <AgentForm
              mode="edit"
              workflowId={workflowId}
              agent={agent}
              tools={tools}
              onMutateCallback={() => handleOpenChange(false)} // Close dialog on success
              isAdvance={isAdvance}
              onRewriteField={handleRewriteField} // Pass field rewrite handler
              isRewriting={isRewriting}
              selectedField={selectedField}
            />
          </div>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
