import type { WorkflowAgentFormData } from '@/types/workflows';
import { useFormContext } from 'react-hook-form';
import MultiTypeInput from '../../../../react-hook-form/multiTypeInput';

export default function AdvanceAgentFormFields({ agent }: {
  agent?: WorkflowAgentFormData;
}) {
  const {
    register,
    formState: { errors },
  } = useFormContext<WorkflowAgentFormData>();

  const formFields = {
    temperature: (
      <MultiTypeInput
        key="temperature"
        name="temperature"
        label="Temperature"
        register={register}
        error={errors.temperature}
        type="range"
        min="0.1" max="1" step="0.1"
        defaultValue={agent?.temperature || 0.5}
      />
    ),
  };

  return (
    <div className="space-y-4 ">{Object.values(formFields)}</div>
  );
}
