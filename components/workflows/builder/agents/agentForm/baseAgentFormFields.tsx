import type { WorkflowAgentFormData } from '@/types/workflows';
import { useFormContext } from 'react-hook-form';
import { Button } from '../../../../library/shadcn/button';
import { Wand2 } from 'lucide-react';

import TextArea from '../../../../react-hook-form/textArea';
import MultiTypeInput from '../../../../react-hook-form/multiTypeInput';
import { AIRewriteInput } from './AIRewriteInput';

interface BaseAgentFormFieldsProps {
  mode: 'create' | 'edit';
  agent?: WorkflowAgentFormData;
  isAdvance?: boolean;
  onRewriteField?: (field: 'name' | 'role' | 'instructions' | 'backstory') => Promise<void>;
  isRewriting?: boolean;
  selectedField?: string | null;
}

const calculateRows = (text: string | undefined, defaultRows: number = 5): number => {
  if (!text) return defaultRows;
  const newlineCount = (text.match(/\n/g) || []).length;
  const estimatedRows = Math.ceil(text.length / 100) + newlineCount;
  return Math.min(Math.max(estimatedRows, defaultRows), defaultRows + 5);
};

export default function BaseAgentFormFields({
  mode,
  agent,
  isAdvance = false,
  onRewriteField,
  isRewriting = false,
  selectedField = null,
}: BaseAgentFormFieldsProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<WorkflowAgentFormData>();

  const renderRewriteButton = (field: 'name' | 'role' | 'instructions' | 'backstory') => {
    if (!isAdvance || !onRewriteField) return null;

    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs gap-1 hover:bg-transparent"
        onClick={() => onRewriteField(field)}
        disabled={isRewriting}
        title={`Rewrite ${field} with AI`}
      >
        <Wand2 className={`h-3 w-3 ${isRewriting && selectedField === field ? 'animate-spin' : ''}`} />
      </Button>
    );
  };

  const formFields = {
    name: (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Agent Name
          </label>
          {renderRewriteButton('name')}
        </div>
        <MultiTypeInput
          key="name"
          name="name"
          label=""
          register={register}
          error={errors.name}
          validation={{
            required: 'Agent name is required',
          }}
        />
      </div>
    ),
    role: (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Agent Role
          </label>
          {renderRewriteButton('role')}
        </div>
        <MultiTypeInput
          key="role"
          name="role"
          label=""
          register={register}
          error={errors.role}
          validation={{
            required: 'Agent role is required',
          }}
        />
      </div>
    ),
    instructions: (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Agent Instructions
          </label>
          {renderRewriteButton('instructions')}
        </div>
        <TextArea
          key="instructions"
          name="instructions"
          label=""
          register={register}
          error={errors.instructions}
          validation={{
            required: 'Agent instructions are required',
          }}
          rows={calculateRows(mode === 'edit' ? agent?.instructions : '', 3)}
        />
      </div>
    ),
    backstory: (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Agent Backstory
          </label>
          {renderRewriteButton('backstory')}
        </div>
        <TextArea
          key="backstory"
          name="backstory"
          label=""
          register={register}
          error={errors.backstory}
          validation={{
            required: 'Agent backstory is required',
          }}
          rows={calculateRows(mode === 'edit' ? agent?.backstory : '')}
        />
      </div>
    ),
  };

  return isAdvance ? (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-1 space-y-2">{formFields.name}</div>
      <div className="col-span-1">{formFields.role}</div>
      <div className="col-span-2 space-y-2">
        {formFields.instructions}
        {formFields.backstory}
      </div>
    </div>
  ) : (
    <div className="space-y-4">
      <AIRewriteInput
        label="Name"
        name="name"
        placeholder="Enter agent name"
        onRewriteField={onRewriteField}
        isRewriting={isRewriting}
        selectedField={selectedField}
      />
      <AIRewriteInput
        label="Role"
        name="role"
        placeholder="Enter agent role"
        onRewriteField={onRewriteField}
        isRewriting={isRewriting}
        selectedField={selectedField}
      />
      <AIRewriteInput
        label="Instructions"
        name="instructions"
        placeholder="Enter agent instructions"
        isTextArea
        rows={3}
        onRewriteField={onRewriteField}
        isRewriting={isRewriting}
        selectedField={selectedField}
      />
      <AIRewriteInput
        label="Backstory"
        name="backstory"
        placeholder="Enter agent backstory"
        isTextArea
        rows={5}
        onRewriteField={onRewriteField}
        isRewriting={isRewriting}
        selectedField={selectedField}
      />
    </div>
  );
}
