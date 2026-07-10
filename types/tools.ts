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

export interface ConnectorBindingDefinition extends JsonObject {
  provider: string;
  credential_id: string;
  purpose?: string | null;
  target_scope?: JsonObject;
  identity_summary?: string | null;
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

export interface GeneratedToolPackageSummary extends JsonObject {
  package_id: string;
  name: string;
  root_path: string;
  manifest_path: string;
  readme_path?: string;
  requirements_path?: string;
  module_root: string;
  tool_modules: string[];
  metadata?: JsonObject;
  package_state?: string;
  has_readme?: boolean;
  has_requirements?: boolean;
  published_tool_count?: number;
  registered_tools: ToolDefinition[];
}

export interface GeneratedToolPackageDetail extends GeneratedToolPackageSummary {
  manifest: JsonObject;
  files: Array<{
    name: string;
    path: string;
    kind: string;
    size_bytes?: number | null;
  }>;
  readme_preview?: string | null;
}

export interface GeneratedToolPackageListResponse extends JsonObject {
  packages: GeneratedToolPackageSummary[];
  count: number;
}

export interface GeneratedToolScaffoldPayload extends JsonObject {
  packageId: string;
  name: string;
  description?: string;
  functionName?: string;
  overwrite?: boolean;
}

export interface GeneratedToolScaffoldResponse extends JsonObject {
  ok: boolean;
  package: JsonObject;
}

export interface GeneratedToolPublishPayload extends JsonObject {
  packageId: string;
  toolId: string;
  name: string;
  description: string;
  callableName: string;
  displayName?: string;
  inputSchema: JsonObject;
  outputSchema: JsonObject;
  tags?: string[];
  security?: JsonObject;
}

export interface GeneratedToolPublishResponse extends JsonObject {
  ok: boolean;
  tool: ToolDefinition;
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
