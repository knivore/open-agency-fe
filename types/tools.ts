import type { JsonObject, JsonValue } from '@/types/api';

export interface ToolParameterMetadata {
  mandatory?: boolean;
  input_type?: string;
  file_upload?: boolean;
  file_type?: string;
  cloud_directory?: boolean;
  description?: string;
  type?: string;
  options?: string[];
  [key: string]: unknown;
}

export interface ToolBinding extends JsonObject {
  id: string;
  name?: string;
  description?: string | null;
}

export interface ToolDefinition extends JsonObject {
  id: string;
  name: string;
  display_name?: string | null;
  description: string;
  tool_type?: string;
  input_schema?: JsonObject;
  output_schema?: JsonObject;
  implementation?: JsonObject;
  security?: JsonObject;
  tags?: string[];
  framework_hints?: JsonObject;
}

export interface ToolValidationPayload {
  toolDefinition: ToolDefinition;
}

export interface ToolTestPayload {
  input?: Record<string, unknown>;
}

export interface ProviderConfigField extends JsonObject {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'boolean' | 'secret' | 'json' | 'list';
  required: boolean;
  description?: string;
  value?: JsonValue;
  editable?: boolean;
}
