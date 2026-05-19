import type { WorkflowAgentFormData, WorkflowTaskFormData } from '@/types/workflows';
import { useFormContext } from 'react-hook-form';
import { Button } from '../../../../library/shadcn/button';
import { Wand2 } from 'lucide-react';

import TextArea from '../../../../react-hook-form/textArea';
import MultiTypeInput from '../../../../react-hook-form/multiTypeInput';
import Combobox from '../../../../react-hook-form/combobox';

interface BaseTaskFormFieldsProps {
  agents: WorkflowAgentFormData[];
  isAdvance?: boolean;
  onRewriteField?: (field: 'name' | 'description' | 'expected_output') => Promise<void>;
  isRewriting?: boolean;
  selectedField?: string | null;
}

const calculateRows = (text: string | undefined, defaultRows: number = 5): number => {
  if (!text) return defaultRows;
  const newlineCount = (text.match(/\n/g) || []).length;
  const estimatedRows = Math.ceil(text.length / 100) + newlineCount;
  return Math.min(Math.max(estimatedRows, defaultRows), defaultRows + 5);
};

export default function BaseTaskFormFields({
  agents,
  onRewriteField,
  isRewriting = false,
  selectedField = null,
}: BaseTaskFormFieldsProps) {
  const {
    register,
    control,
    formState: { errors },
    watch,
    setValue,
  } = useFormContext<WorkflowTaskFormData>();

  // Watch includeTask value to react to changes when a task card is clicked
  const includeTask = watch('includeTask');
  const isChecked = includeTask !== false;

  const handleSwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.checked;
    setValue('includeTask', newValue);
  };

  const renderRewriteButton = (field: 'name' | 'description' | 'expected_output') => {
    if (!onRewriteField) return null;

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

  // Rest of your component remains the same
  return (
    <div className="space-y-4">
      {/* Include/Exclude Task Toggle */}
      <div className="inline-flex gap-2">
        <div className="relative inline-block w-11 h-5">
          <input
            id="switch-component-desc"
            type="checkbox"
            checked={isChecked}
            onChange={handleSwitchChange}
            className="peer appearance-none w-11 h-5 bg-slate-100 rounded-full checked:bg-slate-800 cursor-pointer transition-colors duration-300"
          />
          <label
            htmlFor="switch-component-desc"
            className="absolute top-0 left-0 w-5 h-5 bg-white rounded-full border border-slate-300 shadow-sm transition-transform duration-300 peer-checked:translate-x-6 peer-checked:border-slate-800 cursor-pointer"
          />
        </div>

        <label htmlFor="switch-component-desc" className="text-slate-600 text-sm cursor-pointer">
          <div>
            <p className="font-medium">Include Task</p>
          </div>
        </label>
      </div>

      {/* Task Name input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Task Name
          </label>
          {renderRewriteButton('name')}
        </div>
        <MultiTypeInput
          name="name"
          label=""
          register={register}
          error={errors.name}
          validation={{
            required: 'Task name is required',
          }}
          placeholder="Enter task name"
        />
      </div>

      {/* Task Description TextArea */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Task Description
          </label>
          {renderRewriteButton('description')}
        </div>
        <TextArea
          name="description"
          label=""
          register={register}
          error={errors.description}
          validation={{
            required: 'Task description is required',
          }}
          rows={calculateRows(watch('description'), 3)}
          placeholder="Enter task description"
        />
      </div>

      {/* Expected Output TextArea */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Expected Output
          </label>
          {renderRewriteButton('expected_output')}
        </div>
        <TextArea
          name="expected_output"
          label=""
          register={register}
          error={errors.expected_output}
          validation={{
            required: 'Expected output is required',
          }}
          rows={calculateRows(watch('expected_output'), 3)}
          placeholder="Enter expected output"
        />
      </div>

      {/* Agent Selection Combobox */}
      <Combobox
        name="agent_id"
        label="Agent"
        control={control}
        options={agents.map((agent) => ({
          value: agent.id ?? '',
          label: `${agent.name} (${agent.role})`,
        }))}
        error={errors.agent_id}
        canDeselect={true}
        placeholder="Select an agent"
      />
    </div>
  );
}
