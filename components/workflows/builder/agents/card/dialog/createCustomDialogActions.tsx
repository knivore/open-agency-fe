import { useState } from 'react';
import { Button } from '../../../../../library/shadcn/button';
import { Toggle } from '../../../../../library/shadcn/toggle';
import { X, Wand2 } from 'lucide-react';
import type { WorkflowAgentFormData } from '@/types/workflows';
import { useFormContext } from 'react-hook-form';
import { toast } from 'sonner';
import { appApiClient } from '@/lib/api';

interface CreateCustomDialogActionsProps {
  onClose: () => void;
  isAdvance: boolean;
  setIsAdvance: (isAdvance: boolean) => void;
}

export const CreateCustomDialogActions = ({
  onClose,
  isAdvance,
  setIsAdvance,
}: CreateCustomDialogActionsProps) => {
  const { getValues, setValue } = useFormContext<WorkflowAgentFormData>();
  const [isRewriting, setIsRewriting] = useState(false);
  const [showAIVersion, setShowAIVersion] = useState(false);
  const [originalValues, setOriginalValues] = useState<Partial<WorkflowAgentFormData>>(() => {
    const currentValues = getValues();
    return {
      role: currentValues.role || '',
      instructions: currentValues.instructions || '',
      backstory: currentValues.backstory || '',
    };
  });
  const [rewrittenValues, setRewrittenValues] = useState<Partial<WorkflowAgentFormData>>({});

  const handleSwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;

    if (checked) {
      // Switch to rewritten
      if (rewrittenValues.role) setValue('role', rewrittenValues.role, { shouldDirty: true });
      if (rewrittenValues.instructions) setValue('instructions', rewrittenValues.instructions, { shouldDirty: true });
      if (rewrittenValues.backstory) setValue('backstory', rewrittenValues.backstory, { shouldDirty: true });
    } else {
      // Switch back to original
      if (originalValues.role) setValue('role', originalValues.role, { shouldDirty: false });
      if (originalValues.instructions) setValue('instructions', originalValues.instructions, { shouldDirty: false });
      if (originalValues.backstory) setValue('backstory', originalValues.backstory, { shouldDirty: false });
    }

    setShowAIVersion(checked);
  };

  const handleRewriteWithAI = async () => {
    const currentValues = getValues();

    // Check if there's anything to rewrite
    if (!currentValues.role && !currentValues.instructions && !currentValues.backstory) {
      toast.error("Please fill in role, instructions, and backstory before using 'Rewrite with AI'");
      return;
    }

    // Store current values as original before rewriting
    setOriginalValues({
      role: currentValues.role || '',
      instructions: currentValues.instructions || '',
      backstory: currentValues.backstory || '',
    });

    setIsRewriting(true);
    try {
      const { data } = await appApiClient.post<{ data: Partial<WorkflowAgentFormData> }>('/api/agents/rewrite', {
        agent: currentValues,
      });

      // Store rewritten values
      setRewrittenValues(data);

      // Update form with improved content
      if (data.role) setValue('role', data.role, { shouldDirty: true });
      if (data.instructions) setValue('instructions', data.instructions, { shouldDirty: true });
      if (data.backstory) setValue('backstory', data.backstory, { shouldDirty: true });

      setShowAIVersion(true);
    } catch (error) {
      console.error('Error rewriting agent:', error);
      toast.error("Failed to rewrite content. Please try again.");
    } finally {
      setIsRewriting(false);
    }
  };

  // Reset to empty values when modal is closed
  const handleClose = () => {
    // Reset form to empty values
    setValue('role', '', { shouldDirty: false });
    setValue('instructions', '', { shouldDirty: false });
    setValue('backstory', '', { shouldDirty: false });

    // Reset state
    setShowAIVersion(false);
    setRewrittenValues({});
    setOriginalValues({});

    // Close modal
    onClose();
  };

  return (
    <div className="flex flex-col">
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

        <Toggle
          variant="outline"
          size="sm"
          className="w-fit h-10 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          onClick={() => setIsAdvance(!isAdvance)}
        >
          {isAdvance ? 'Simple' : 'Advance'}
        </Toggle>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {rewrittenValues.role && (
        <div className="absolute right-4 top-16 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Original</span>
          <div className="relative inline-block w-11 h-5">
            <input
              type="checkbox"
              checked={showAIVersion}
              onChange={handleSwitchChange}
              className="peer appearance-none w-11 h-5 bg-slate-100 rounded-full checked:bg-slate-800 cursor-pointer transition-colors duration-300"
            />
            <span className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform duration-300 peer-checked:translate-x-6"></span>
          </div>
          <span className="text-sm text-muted-foreground">Rewritten</span>
        </div>
      )}
    </div>
  );
};
