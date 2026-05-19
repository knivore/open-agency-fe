import type { WorkflowTaskFormData } from '@/types/workflows';
import { useFormContext } from 'react-hook-form';

import FormHeader from '../../../../../form-header/FormHeader';
import { MultiSelect } from '../../../../../multi-select/MultiSelect';

export default function ContextSelection({
  currentTaskId,
  allTasks,
}: {
  currentTaskId: string;
  allTasks: WorkflowTaskFormData[];
}) {
  const { setValue, watch } = useFormContext<WorkflowTaskFormData>();
  const selectedTasks = watch('depends_on_task_ids') || [];

  const taskOptions = allTasks
    .filter((task) => task.id !== currentTaskId)
    .map((task) => ({
      label: task.name,
      value: task.id!,
    }));

  const handleTaskChange = (values: string[]) => {
    setValue('depends_on_task_ids', values);
  };

  return (
    <div className="space-y-4">
      <FormHeader
        title="Context"
        description="Select specific tasks whose outputs are used as context for this task."
      />
      <div>
        <MultiSelect
          options={taskOptions}
          defaultValue={selectedTasks}
          onValueChange={handleTaskChange}
          placeholder="Select tasks for context"
          maxCount={5}
        />
      </div>
    </div>
  );
}
