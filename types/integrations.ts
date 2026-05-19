import type { JsonObject } from '@/types/api';
import type { ProviderConfigField } from '@/types/tools';

export interface ProviderEndpointDefinition extends JsonObject {
  base_url?: string | null;
  api_version?: string | null;
  region?: string | null;
  headers?: Record<string, string>;
}

export interface SecretReference extends JsonObject {
  secret_name: string;
  source?: string | null;
  description?: string | null;
}

export interface CredentialReference extends JsonObject {
  ref: string;
  source?: string | null;
  key?: string | null;
  description?: string | null;
}

export interface CredentialDefinition extends JsonObject {
  id: string;
  owner_user_id?: string | null;
  name: string;
  provider?: string | null;
  secret_ref: string;
  status?: 'active' | 'revoked' | 'disabled' | 'rotation_required';
  last_rotated_at?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
  secret_version?: number;
  rotation_policy?: JsonObject;
  metadata?: JsonObject;
}

export interface ModelProviderDefinition extends JsonObject {
  id: string;
  name: string;
  provider_type: string;
  description?: string | null;
  capabilities?: string[];
  endpoint?: ProviderEndpointDefinition | null;
  default_headers?: Record<string, string>;
  secret_references?: SecretReference[];
  config?: JsonObject;
  framework_hints?: JsonObject;
}

export interface ModelProfileDefinition extends JsonObject {
  id: string;
  name: string;
  provider: string;
  model: string;
  description?: string | null;
  base_url?: string | null;
  api_key_ref?: string | null;
  temperature?: number | null;
  max_tokens?: number | null;
  context_window?: number | null;
  top_p?: number | null;
  supports_tools?: boolean;
  supports_structured_output?: boolean;
  supports_vision?: boolean;
  supports_streaming?: boolean;
  parameters?: JsonObject;
  framework_hints?: JsonObject;
}

export interface ProviderCredentialStatus extends JsonObject {
  managedByBackend: boolean;
  writeSupported: boolean;
  refs: Array<{ name: string; source?: string | null; description?: string | null }>;
  message: string;
}

export type IntegrationStatus =
  | 'available'
  | 'configured'
  | 'needs_configuration'
  | 'enabled'
  | 'disabled'
  | 'planned'
  | 'unsupported';

export interface IntegrationProvider extends JsonObject {
  id: string;
  name: string;
  categoryId: string;
  kind: 'model_provider' | 'model_profile' | 'tool' | 'mcp_server' | 'runtime_adapter' | 'planned';
  status: IntegrationStatus;
  description?: string | null;
  capabilities?: string[];
  configFields: ProviderConfigField[];
  credentialStatus: ProviderCredentialStatus;
  actions: {
    canSaveConfig: boolean;
    canEnableDisable: boolean;
    canTestConnection: boolean;
  };
  raw?: JsonObject;
}

export interface PlannedIntegrationDefinition extends JsonObject {
  backendKey: string;
  authModel: string;
  summary: string;
  launchPriority?: 'now' | 'next' | 'later';
  providerAliases?: string[];
}

export interface PlannedIntegrationState extends PlannedIntegrationDefinition {
  matchedCredentialIds: string[];
  matchedCredentialNames: string[];
}

export interface IntegrationRegistryCategoryDefinition extends JsonObject {
  id: string;
  name: string;
  description: string;
  providers: Record<string, PlannedIntegrationDefinition>;
}

export type IntegrationRegistrySource = 'backend' | 'fallback';

export interface IntegrationRegistryPayload extends JsonObject {
  categories: IntegrationRegistryCategoryDefinition[];
  updated_at?: string | null;
}

export interface ConnectorMetadataRequirementDefinition extends JsonObject {
  key: string;
  description: string;
}

export interface ConnectorCapabilityDefinition extends JsonObject {
  backendKey: string;
  displayName: string;
  authModel: string;
  providerAliases?: string[];
  healthSupported?: boolean;
  requiredMetadata?: ConnectorMetadataRequirementDefinition[];
  supportedSecretRefSchemes?: string[];
}

export interface ConnectorCapabilitiesPayload extends JsonObject {
  connectors: Record<string, ConnectorCapabilityDefinition>;
  updated_at?: string | null;
}

export interface ConnectorCredentialValidationPayload extends JsonObject {
  provider: string;
  valid: boolean;
  errors: string[];
  capability?: ConnectorCapabilityDefinition | null;
}

export interface ConnectorHealthHistoryItem extends JsonObject {
  executionId: string;
  credentialId: string;
  credentialName: string;
  provider: string;
  status: string;
  startedAt?: string | null;
  completedAt?: string | null;
  error?: string | null;
  eventTypes?: string[];
}

export interface ConnectorHealthHistoryPayload extends JsonObject {
  items: ConnectorHealthHistoryItem[];
  total: number;
  limit: number;
  offset: number;
  status?: string | null;
  startedAfter?: string | null;
  startedBefore?: string | null;
}

export interface IntegrationCategory extends JsonObject {
  id: string;
  name: string;
  description: string;
  status: 'supported' | 'planned';
  providers: IntegrationProvider[];
}

export interface IntegrationCatalogPayload extends JsonObject {
  categories: IntegrationCategory[];
  registrySource: IntegrationRegistrySource;
  registryUpdatedAt?: string | null;
}

export interface MCPServerDefinition extends JsonObject {
  id: string;
  name: string;
  transport?: string;
  command: string;
  args?: string[];
  url?: string | null;
  enabled?: boolean;
  env_refs?: CredentialReference[];
  allowlisted_command?: string | null;
  metadata?: JsonObject;
}
