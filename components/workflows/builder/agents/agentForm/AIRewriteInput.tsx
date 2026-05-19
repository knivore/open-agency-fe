import { Button } from '../../../../library/shadcn/button';
import { Wand2 } from 'lucide-react';
import type { WorkflowAgentFormData } from '@/types/workflows';
import { useFormContext } from 'react-hook-form';
import { Label } from '../../../../library/shadcn/label';
import { Textarea } from '../../../../library/shadcn/textarea';
import { Input } from '../../../../library/shadcn/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../../library/shadcn/tooltip';

type AgentField = 'name' | 'role' | 'instructions' | 'backstory';

interface AIRewriteInputProps {
  label: string;
  name: AgentField;
  placeholder?: string;
  isTextArea?: boolean;
  rows?: number;
  onRewriteField?: (field: AgentField) => Promise<void>;
  isRewriting?: boolean;
  selectedField?: string | null;
}

export function AIRewriteInput({
  label,
  name,
  placeholder,
  isTextArea = false,
  rows = 3,
  onRewriteField,
  isRewriting = false,
  selectedField = null,
}: AIRewriteInputProps) {
  const { register, setValue, watch } = useFormContext<WorkflowAgentFormData>();

  // Get the current value from the form
  const currentValue = watch(name);

  const handleRewrite = async () => {
    if (onRewriteField) {
      await onRewriteField(name);
    }
  };

  const normalizedLabel = label === 'Instructions' ? 'instructions' : label.toLowerCase();

  const InputComponent = isTextArea ? Textarea : Input;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label htmlFor={name}>{label}</Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs gap-1"
                onClick={handleRewrite}
                disabled={isRewriting}
              >
                <Wand2 className={`h-3 w-3 ${isRewriting && selectedField === name ? 'animate-spin' : ''}`} />
                {isRewriting && selectedField === name ? '...' : ''}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Rewrite {normalizedLabel} with AI</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <InputComponent
        {...register(name)}
        id={name}
        placeholder={placeholder}
        className="w-full"
        rows={isTextArea ? rows : undefined}
        value={currentValue || ''}
        onChange={(e) => {
          setValue(name, e.target.value, { shouldDirty: true });
        }}
      />
    </div>
  );
}
