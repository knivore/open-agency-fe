import type { ToolDefinition, ToolParameterMetadata } from '@/types/tools';
import type { WorkflowAgentToolConfig, WorkflowToolOption } from '@/types/workflows';
import { toolDisplayName } from '@/lib/tools/displayName';

function schemaPropertiesToParameterMetadata(tool: ToolDefinition): Record<string, ToolParameterMetadata> {
  const properties = tool.input_schema?.properties;
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    return {};
  }

  const required = Array.isArray(tool.input_schema?.required)
    ? new Set(tool.input_schema.required.filter((item): item is string => typeof item === 'string'))
    : new Set<string>();

  return Object.entries(properties).reduce<Record<string, ToolParameterMetadata>>((acc, [key, value]) => {
    const schema = value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
    const schemaType = typeof schema.type === 'string' ? schema.type : undefined;
    const metadataType = schemaType === 'boolean' ? 'checkbox' : schemaType === 'number' ? 'number' : 'text';

    acc[key] = {
      mandatory: required.has(key),
      input_type: metadataType,
      type: schemaType,
      description: typeof schema.description === 'string' ? schema.description : undefined,
      options: Array.isArray(schema.enum)
        ? schema.enum.filter((item): item is string => typeof item === 'string')
        : undefined,
    };
    return acc;
  }, {});
}

export function toolDefinitionToWorkflowToolOption(tool: ToolDefinition): WorkflowToolOption {
  return {
    id: tool.id,
    name: toolDisplayName(tool),
    description: tool.description,
    parameters_metadata: schemaPropertiesToParameterMetadata(tool),
  };
}

export function toolDefinitionsToWorkflowToolOptions(tools: ToolDefinition[]): WorkflowToolOption[] {
  return tools.map(toolDefinitionToWorkflowToolOption);
}

export function workflowToolOptionToAgentToolConfig(tool: WorkflowToolOption): WorkflowAgentToolConfig {
  return {
    id: tool.id,
    name: tool.name,
    description: tool.description,
    created_by: 'Agency',
    owned_by: 'Agency',
    parameters_metadata: tool.parameters_metadata,
    parameters: Object.keys(tool.parameters_metadata || {}).reduce<Record<string, string>>((acc, key) => {
      acc[key] = '';
      return acc;
    }, {}),
  };
}
