import { credentialsApi } from '@/lib/api/backend/credentials';
import { toolDisplayName } from '@/lib/tools/displayName';
import type {
  CredentialDefinition,
  IntegrationCategory,
  IntegrationRegistryCategoryDefinition,
  IntegrationProvider,
  IntegrationStatus,
  MCPServerDefinition,
  ModelProfileDefinition,
  ModelProviderDefinition,
  PlannedIntegrationDefinition,
  PlannedIntegrationState,
  ProviderCredentialStatus,
} from '@/types/integrations';
import type { ProviderConfigField, ToolDefinition } from '@/types/tools';
import type { RuntimeAdapterDefinition } from '@/types/runtime';

function createCredentialStatus(
  refs: Array<{ name: string; source?: string | null; description?: string | null }>
): ProviderCredentialStatus {
  return {
    managedByBackend: true,
    writeSupported: false,
    refs,
    message: refs.length
      ? 'Credential values are expected to be managed by the backend or deployment environment.'
      : credentialsApi.getUnsupportedStatus().message,
  };
}

const CREDENTIAL_IDENTITY_KEYS = [
  'workspace_id',
  'workspace_name',
  'tenant_id',
  'team_id',
  'channel_id',
  'default_channel_id',
  'guild_id',
  'default_guild_id',
  'bot_user_id',
  'bot_username',
  'phone_number_id',
  'business_account_id',
  'display_phone_number',
  'mailbox',
  'site_id',
  'project_key',
  'space_key',
  'base_id',
  'owner',
  'repo',
  'installation_id',
  'namespace',
  'project_id',
  'organization_slug',
  'project_slug',
  'service_id',
  'bucket',
  'region',
  'prefix',
  'drive_id',
  'folder_id',
] as const;

function credentialIdentitySummary(credential: CredentialDefinition) {
  const metadata = credential.metadata ?? {};
  const parts = CREDENTIAL_IDENTITY_KEYS.flatMap((key) => {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) {
      return [`${key}: ${value.trim()}`];
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return [`${key}: ${String(value)}`];
    }
    return [];
  });

  return parts.slice(0, 4).join(' | ');
}

function createPlannedCredentialStatus(
  matchedCredentials: CredentialDefinition[],
  authModel: string
): ProviderCredentialStatus {
  return {
    managedByBackend: true,
    writeSupported: true,
    refs: matchedCredentials.map((credential) => ({
      name: credential.name,
      source: typeof credential.provider === 'string' ? credential.provider : null,
      description:
        [
          credentialIdentitySummary(credential),
          typeof credential.secret_ref === 'string' ? `Secret ref: ${credential.secret_ref}` : null,
        ]
          .filter(Boolean)
          .join(' | ') || null,
    })),
    message:
      matchedCredentials.length > 0
        ? `${matchedCredentials.length} backend credential${matchedCredentials.length === 1 ? '' : 's'} mapped to this connector.`
        : `No backend credential mapped yet. Expected auth model: ${authModel}.`,
  };
}

function providerStatus(provider: ModelProviderDefinition): IntegrationStatus {
  if ((provider.endpoint?.base_url ?? '').trim()) {
    return 'configured';
  }
  if (
    (provider.secret_references?.length ?? 0) > 0 ||
    Object.keys(provider.config ?? {}).length > 0
  ) {
    return 'needs_configuration';
  }
  return 'available';
}

function modelProviderFields(provider: ModelProviderDefinition): ProviderConfigField[] {
  return [
    {
      key: 'description',
      label: 'Description',
      type: 'textarea',
      required: false,
      value: provider.description ?? '',
      editable: true,
    },
    {
      key: 'endpoint.base_url',
      label: 'Base URL',
      type: 'text',
      required: false,
      value: provider.endpoint?.base_url ?? '',
      editable: true,
    },
    {
      key: 'endpoint.api_version',
      label: 'API Version',
      type: 'text',
      required: false,
      value: provider.endpoint?.api_version ?? '',
      editable: true,
    },
    {
      key: 'endpoint.region',
      label: 'Region',
      type: 'text',
      required: false,
      value: provider.endpoint?.region ?? '',
      editable: true,
    },
  ];
}

function toModelProvider(provider: ModelProviderDefinition): IntegrationProvider {
  return {
    id: provider.id,
    name: provider.name,
    categoryId: 'llm-models',
    kind: 'model_provider',
    status: providerStatus(provider),
    description: provider.description ?? null,
    capabilities: provider.capabilities ?? [],
    configFields: modelProviderFields(provider),
    credentialStatus: createCredentialStatus(
      (provider.secret_references ?? []).map((reference) => ({
        name: reference.secret_name,
        source: reference.source ?? null,
        description: reference.description ?? null,
      }))
    ),
    actions: {
      canSaveConfig: true,
      canEnableDisable: false,
      canTestConnection: true,
    },
    raw: provider,
  };
}

function toModelProfile(profile: ModelProfileDefinition): IntegrationProvider {
  return {
    id: profile.id,
    name: profile.name,
    categoryId: 'llm-models',
    kind: 'model_profile',
    status: profile.base_url || profile.api_key_ref ? 'configured' : 'available',
    description: profile.description ?? `${profile.provider} / ${profile.model}`,
    capabilities: [
      profile.supports_tools ? 'tools' : '',
      profile.supports_structured_output ? 'structured_output' : '',
      profile.supports_vision ? 'vision' : '',
      profile.supports_streaming ? 'streaming' : '',
    ].filter(Boolean),
    configFields: [
      {
        key: 'provider',
        label: 'Provider',
        type: 'text',
        required: true,
        value: profile.provider,
        editable: false,
      },
      {
        key: 'model',
        label: 'Model',
        type: 'text',
        required: true,
        value: profile.model,
        editable: false,
      },
      {
        key: 'base_url',
        label: 'Base URL',
        type: 'text',
        required: false,
        value: profile.base_url ?? '',
        editable: true,
      },
      {
        key: 'api_key_ref',
        label: 'API Key Reference',
        type: 'secret',
        required: false,
        value: profile.api_key_ref ?? '',
        editable: false,
      },
      {
        key: 'temperature',
        label: 'Temperature',
        type: 'number',
        required: false,
        value: profile.temperature ?? '',
        editable: true,
      },
      {
        key: 'max_tokens',
        label: 'Max Tokens',
        type: 'number',
        required: false,
        value: profile.max_tokens ?? '',
        editable: true,
      },
    ],
    credentialStatus: createCredentialStatus(
      profile.api_key_ref
        ? [{ name: profile.api_key_ref, description: 'Backend secret or reference name' }]
        : []
    ),
    actions: {
      canSaveConfig: true,
      canEnableDisable: false,
      canTestConnection: true,
    },
    raw: profile,
  };
}

function toTool(tool: ToolDefinition): IntegrationProvider {
  return {
    id: tool.id,
    name: toolDisplayName(tool),
    categoryId: 'custom',
    kind: 'tool',
    status: 'available',
    description: tool.description,
    capabilities: tool.tags ?? [],
    configFields: [],
    credentialStatus: createCredentialStatus([]),
    actions: {
      canSaveConfig: false,
      canEnableDisable: false,
      canTestConnection: true,
    },
    raw: tool,
  };
}

function toMcpServer(server: MCPServerDefinition): IntegrationProvider {
  return {
    id: server.id,
    name: server.name,
    categoryId: 'custom',
    kind: 'mcp_server',
    status: server.enabled ? 'enabled' : 'disabled',
    description: server.url || server.command,
    capabilities: [server.transport ?? 'stdio'],
    configFields: [
      {
        key: 'transport',
        label: 'Transport',
        type: 'text',
        required: true,
        value: server.transport ?? 'stdio',
        editable: false,
      },
      {
        key: 'command',
        label: 'Command',
        type: 'text',
        required: true,
        value: server.command,
        editable: true,
      },
      {
        key: 'args',
        label: 'Args',
        type: 'list',
        required: false,
        value: server.args ?? [],
        editable: true,
      },
      {
        key: 'url',
        label: 'URL',
        type: 'text',
        required: false,
        value: server.url ?? '',
        editable: true,
      },
      {
        key: 'enabled',
        label: 'Enabled',
        type: 'boolean',
        required: false,
        value: server.enabled ?? false,
        editable: true,
      },
    ],
    credentialStatus: createCredentialStatus(
      (server.env_refs ?? []).map((reference) => ({
        name: reference.ref,
        source: reference.source ?? null,
        description: reference.description ?? null,
      }))
    ),
    actions: {
      canSaveConfig: true,
      canEnableDisable: true,
      canTestConnection: true,
    },
    raw: server,
  };
}

function normalizeProviderKey(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function plannedProvider(
  categoryId: string,
  name: string,
  definition: PlannedIntegrationDefinition,
  credentials: CredentialDefinition[]
): IntegrationProvider {
  const providerKeys = [definition.backendKey, ...(definition.providerAliases ?? [])].map((value) =>
    normalizeProviderKey(value)
  );
  const matchedCredentials = credentials.filter((credential) =>
    providerKeys.includes(normalizeProviderKey(credential.provider))
  );
  const plannedState: PlannedIntegrationState = {
    ...definition,
    matchedCredentialIds: matchedCredentials.map((credential) => credential.id),
    matchedCredentialNames: matchedCredentials.map((credential) => credential.name),
    matchedCredentials,
  };

  return {
    id: `${categoryId}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
    categoryId,
    kind: 'planned',
    status: matchedCredentials.length > 0 ? 'configured' : 'planned',
    description: definition.summary,
    capabilities: [definition.authModel, definition.launchPriority ?? 'later'],
    configFields: [],
    credentialStatus: createPlannedCredentialStatus(matchedCredentials, definition.authModel),
    actions: {
      canSaveConfig: false,
      canEnableDisable: false,
      canTestConnection: false,
    },
    raw: plannedState,
  };
}

export function buildIntegrationCatalog(input: {
  credentials: CredentialDefinition[];
  registryCategories: IntegrationRegistryCategoryDefinition[];
  modelProviders: ModelProviderDefinition[];
  modelProfiles: ModelProfileDefinition[];
  tools: ToolDefinition[];
  mcpServers: MCPServerDefinition[];
  runtimeAdapters: RuntimeAdapterDefinition[];
}): IntegrationCategory[] {
  const llmProviders: IntegrationProvider[] = [
    ...input.modelProviders.map(toModelProvider),
    ...input.modelProfiles.map(toModelProfile),
  ];

  const customProviders: IntegrationProvider[] = [
    ...input.tools.map(toTool),
    ...input.mcpServers.map(toMcpServer),
  ];

  const planned = (category: IntegrationRegistryCategoryDefinition): IntegrationCategory => ({
    id: category.id,
    name: category.name,
    description: category.description,
    status: 'planned',
    providers: Object.entries(category.providers).map(([providerName, definition]) =>
      plannedProvider(category.id, providerName, definition, input.credentials)
    ),
  });

  return [
    {
      id: 'llm-models',
      name: 'Models',
      description: 'Configured LLM connections and selectable runtime profiles.',
      status: 'supported',
      providers: llmProviders,
    },
    {
      id: 'custom',
      name: 'Custom',
      description: 'Tools and MCP servers currently exposed by backend route groups.',
      status: 'supported',
      providers: customProviders,
    },
    ...input.registryCategories.map(planned),
  ];
}
