import { workflowToolOptionToAgentToolConfig } from '@/lib/workflows/toolOptions';
import type { WorkflowAgentFormData, WorkflowToolOption } from '@/types/workflows';
import { useFormContext } from 'react-hook-form';

import { MultiSelect } from '../../../../../multi-select/MultiSelect';
import FormHeader from '../../../../../form-header/FormHeader';

// * When tools are selected in this component, they're converted to agentTools before being sent to the backend
export default function AgentToolsSelection({ tools }: { tools: WorkflowToolOption[] }) {
  const { setValue, watch } = useFormContext<WorkflowAgentFormData>();
  const selectedTools = watch('tool_configs') || [];
  const toolsById = new Map(tools.map((tool) => [tool.id, tool]));

  const handleToolChange = (values: string[]) => {
    if (values.length < selectedTools.length) {
      const nextConfigs = selectedTools.filter((tool) => values.includes(tool.id));
      setValue('tool_configs', nextConfigs);
      setValue('tool_ids', nextConfigs.map((tool) => tool.id));
    } else {
      const newToolKey = values.find((v) => !selectedTools.find((t) => t.id === v));
      const tool = newToolKey ? toolsById.get(newToolKey) : undefined;
      if (tool) {
        const nextConfigs = [
          ...selectedTools,
          workflowToolOptionToAgentToolConfig(tool),
        ];
        setValue('tool_configs', nextConfigs);
        setValue('tool_ids', nextConfigs.map((tool) => tool.id));
      }
    }
  };

  // Convert the tools object into the format expected by multi-select
  const toolOptions = tools.map((tool) => ({
    // WorkflowToolOption.name is already normalized from ToolDefinition.display_name.
    label: tool.name,
    value: tool.id,
    // Optionally add an icon if you want to show different icons for CrewAI vs Agency tools
    // icon: tool.created_by === 'CrewAI' ? CrewAIIcon : AgencyIcon
  }));

  // Extract just the IDs from the selected tools for the multi-select
  const selectedValues = selectedTools.map((tool) => tool.id);

  return (
    <div className="space-y-4">
      <FormHeader title="Tools" description="Select the tools that the agent can use" />
      <div>
        <MultiSelect
          options={toolOptions}
          defaultValue={selectedValues}
          onValueChange={handleToolChange}
          placeholder="Select tools"
          maxCount={5} // Optionally show more tools before collapsing
        />
      </div>
    </div>
  );
}
