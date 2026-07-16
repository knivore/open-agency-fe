import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import IntegrationsWorkspace from '@/components/integrations-app/IntegrationsWorkspace';
import type {
  ConnectorCapabilityDefinition,
  ConnectorHealthHistoryItem,
  IntegrationCategory,
} from '@/types/integrations';
import type { ComponentProps } from 'react';

const apiMocks = vi.hoisted(() => ({
  connectorsApi: {
    listConnectorInstallations: vi.fn(),
    deleteConnectorInstallation: vi.fn(),
    completeConnectorInstallation: vi.fn(),
    createConnectorSetupSession: vi.fn(),
    resumeConnectorSetupSession: vi.fn(),
    testConnector: vi.fn(),
    getConnectorHistory: vi.fn(),
    getAggregateConnectorHistory: vi.fn(),
  },
  credentialsApi: {
    getConnectorCredentialCapabilities: vi.fn(),
    getConnectorCredentialSchema: vi.fn(),
    validateConnectorCredential: vi.fn(),
    createConnectorCredential: vi.fn(),
    updateConnectorCredential: vi.fn(),
    deleteCredential: vi.fn(),
    getCredential: vi.fn(),
  },
  integrationsApi: {
    listCategories: vi.fn(),
  },
  smartHomeApi: {
    getAvailability: vi.fn(),
    listEntities: vi.fn(),
  },
  mcpServersApi: {
    createMcpServer: vi.fn(),
    deleteMcpServer: vi.fn(),
    discover: vi.fn(),
  },
  profileApi: {
    getIntegrationCredentialCapability: vi.fn(() => ({
      writeSupported: false,
      message: 'Credential writes are not supported in tests.',
    })),
  },
  providersApi: {
    updateMcpServer: vi.fn(),
    discoverMcpServer: vi.fn(),
  },
  toolsApi: {
    createTool: vi.fn(),
    updateTool: vi.fn(),
    deleteTool: vi.fn(),
    testTool: vi.fn(),
  },
}));

const clipboardMocks = vi.hoisted(() => ({
  writeClipboardText: vi.fn(),
}));

export const {
  connectorsApi,
  credentialsApi,
  integrationsApi,
  mcpServersApi,
  profileApi,
  providersApi,
  smartHomeApi,
  toolsApi,
} = apiMocks;

export const { writeClipboardText } = clipboardMocks;

vi.mock('@/lib/api/backend/connectors', () => ({
  connectorsApi: apiMocks.connectorsApi,
}));

vi.mock('@/lib/api/backend/credentials', () => ({
  credentialsApi: apiMocks.credentialsApi,
}));

vi.mock('@/lib/api/backend/integrations', () => ({
  integrationsApi: apiMocks.integrationsApi,
}));

vi.mock('@/lib/api/backend/mcpServers', () => ({
  mcpServersApi: apiMocks.mcpServersApi,
}));

vi.mock('@/lib/api/backend/profile', () => ({
  profileApi: apiMocks.profileApi,
}));

vi.mock('@/lib/api/backend/providers', () => ({
  providersApi: apiMocks.providersApi,
}));

vi.mock('@/lib/api/backend/smartHome', () => ({
  smartHomeApi: apiMocks.smartHomeApi,
}));

vi.mock('@/lib/api/backend/tools', () => ({
  toolsApi: apiMocks.toolsApi,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        id: 'user-integrations',
        email: 'integrations@example.com',
        name: 'Integrations User',
        image: null,
        accessToken: null,
        authMode: 'dev',
      },
    },
    status: 'authenticated',
  }),
}));

export function renderWorkspace(props?: ComponentProps<typeof IntegrationsWorkspace>) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <IntegrationsWorkspace {...props} />
    </QueryClientProvider>
  );
}

export function connectorHistoryPayload(items: ConnectorHealthHistoryItem[] = []) {
  return {
    items,
    total: items.length,
    limit: items.length || 20,
    offset: 0,
    status: null,
    startedAfter: null,
    startedBefore: null,
  };
}

export function setupIntegrationsWorkspaceTest() {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/integrations');
    Object.assign(navigator, {
      clipboard: {
        writeText: writeClipboardText,
      },
    });

    const llmCategory: IntegrationCategory = {
      id: 'llm-models',
      name: 'Models',
      description: 'Configured LLM connections and selectable runtime profiles.',
      status: 'supported',
      providers: [
        {
          id: 'provider-openai',
          name: 'OpenAI',
          categoryId: 'llm-models',
          kind: 'model_provider',
          status: 'configured',
          description: 'OpenAI connection',
          capabilities: [],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: false,
            refs: [],
            message: 'Credential values are expected to be managed by the backend.',
          },
          actions: {
            canSaveConfig: true,
            canEnableDisable: false,
            canTestConnection: false,
          },
          raw: {
            id: 'provider-openai',
            name: 'OpenAI',
            provider_type: 'openai',
            endpoint: {
              base_url: 'https://api.openai.com/v1',
            },
            config: {
              provider_family: 'openai',
              api_key: 'sk-test',
            },
          },
        },
        {
          id: 'profile-main',
          name: 'Primary Profile',
          categoryId: 'llm-models',
          kind: 'model_profile',
          status: 'configured',
          description: 'Primary model preset',
          capabilities: ['tools', 'streaming'],
          configFields: [],
          credentialStatus: {
            managedByBackend: true,
            writeSupported: false,
            refs: [{ name: 'sk-test' }],
            message: 'Credential values are expected to be managed by the backend.',
          },
          actions: {
            canSaveConfig: true,
            canEnableDisable: false,
            canTestConnection: false,
          },
          raw: {
            id: 'profile-main',
            name: 'Primary Profile',
            provider: 'provider-openai',
            model: 'gpt-4.1',
            base_url: 'https://api.openai.com/v1',
            api_key_ref: 'sk-test',
            temperature: 0.2,
            max_tokens: 4096,
            supports_tools: true,
            supports_streaming: true,
          },
        },
      ],
    };

    integrationsApi.listCategories.mockResolvedValue({
      categories: [llmCategory],
      registrySource: 'backend',
      registryUpdatedAt: null,
    });
    credentialsApi.getConnectorCredentialSchema.mockImplementation(
      async (backendKey: string): Promise<ConnectorCapabilityDefinition> => {
        const capabilities: Record<string, ConnectorCapabilityDefinition> = {
          'telegram-bot': {
            backendKey: 'telegram-bot',
            displayName: 'Telegram',
            authModel: 'bot token',
            providerAliases: ['telegram'],
            onecliTransportMode: 'proxy',
            runtimeSecretRequired: false,
            onecliSecretProfile: {
              hostPattern: 'api.telegram.org',
              pathPattern: '/bot*',
              injectionTarget: 'url_path',
              pathTemplate: '/bot{value}',
            },
            healthSupported: true,
            requiredMetadata: [],
            instanceIdentityMetadata: [],
            supportedSecretRefSchemes: ['onecli://', 'env://', 'env:'],
          },
          'discord-bot': {
            backendKey: 'discord-bot',
            displayName: 'Discord',
            authModel: 'bot token',
            providerAliases: ['discord'],
            onecliTransportMode: 'proxy',
            onecliSecretProfile: {
              hostPattern: 'discord.com',
              pathPattern: '/api/v10/*',
              injectionTarget: 'header',
              headerName: 'Authorization',
              valueFormat: 'Bot {value}',
            },
            healthSupported: false,
            requiredMetadata: [],
            instanceIdentityMetadata: [],
            supportedSecretRefSchemes: ['onecli://', 'env://', 'env:'],
          },
          'whatsapp-cloud-api': {
            backendKey: 'whatsapp-cloud-api',
            displayName: 'WhatsApp Cloud API',
            authModel: 'access token',
            providerAliases: ['whatsapp', 'meta-whatsapp'],
            onecliTransportMode: 'proxy',
            onecliSecretProfile: {
              hostPattern: 'graph.facebook.com',
              pathPattern: '/*',
              injectionTarget: 'header',
              headerName: 'Authorization',
              valueFormat: 'Bearer {value}',
            },
            healthSupported: false,
            requiredMetadata: [
              {
                key: 'phone_number_id',
                description:
                  'WhatsApp Cloud API requires the Meta phone number id used for message delivery and health checks.',
              },
            ],
            instanceIdentityMetadata: [],
            supportedSecretRefSchemes: ['onecli://', 'env://', 'env:'],
          },
        };
        return (
          capabilities[backendKey] ?? {
            backendKey,
            displayName: backendKey,
            authModel: 'credential',
            providerAliases: [],
            onecliTransportMode: 'proxy',
            healthSupported: false,
            requiredMetadata: [],
            instanceIdentityMetadata: [],
            supportedSecretRefSchemes: ['onecli://', 'env://', 'env:'],
          }
        );
      }
    );
    credentialsApi.getConnectorCredentialCapabilities.mockResolvedValue({
      connectors: {},
      updated_at: null,
    });
    credentialsApi.validateConnectorCredential.mockResolvedValue({
      provider: 'telegram-bot',
      valid: true,
      errors: [],
      capability: null,
    });
    credentialsApi.createConnectorCredential.mockResolvedValue({
      id: 'credential-telegram',
      name: 'Telegram Bot',
      provider: 'telegram-bot',
      secret_ref: 'env://TELEGRAM_BOT_TOKEN',
      metadata: {},
    });
    credentialsApi.updateConnectorCredential.mockResolvedValue({
      id: 'credential-telegram',
      name: 'Telegram Bot',
      provider: 'telegram-bot',
      secret_ref: 'env://TELEGRAM_BOT_TOKEN',
      metadata: {},
    });
    credentialsApi.getCredential.mockResolvedValue({
      id: 'credential-telegram',
      name: 'Telegram Bot',
      provider: 'telegram-bot',
      secret_ref: 'env://TELEGRAM_BOT_TOKEN',
      metadata: {},
    });
    connectorsApi.listConnectorInstallations.mockResolvedValue({
      items: [],
    });
    connectorsApi.createConnectorSetupSession.mockResolvedValue({
      installation: {
        id: 'connector-installation-telegram',
        owner_user_id: 'user-integrations',
        provider: 'telegram-bot',
        name: 'Telegram Bot',
        onecli_credential_ref:
          'onecli://users/user-integrations/telegram-bot/connector-installation-telegram',
        status: 'setup_pending',
        setup_session_id: 'connector-installation-telegram',
        setup_started_at: '2099-01-01T00:00:00Z',
        setup_expires_at: '2099-01-01T00:30:00Z',
        metadata: {},
      },
      setup_url: 'http://onecli:10254/',
      device_code: 'CONNECTOR',
      onecli_credential_ref:
        'onecli://users/user-integrations/telegram-bot/connector-installation-telegram',
      onecli_resource_name: 'agency-telegram-bot-connectorins',
      expires_at: '2099-01-01T00:30:00Z',
    });
    connectorsApi.resumeConnectorSetupSession.mockResolvedValue({
      installation: {
        id: 'connector-installation-telegram',
        owner_user_id: 'user-integrations',
        provider: 'telegram-bot',
        name: 'Telegram Bot',
        onecli_credential_ref:
          'onecli://users/user-integrations/telegram-bot/connector-installation-telegram',
        status: 'setup_pending',
        setup_session_id: 'connector-installation-telegram',
        setup_started_at: '2099-01-01T00:00:00Z',
        setup_expires_at: '2099-01-01T00:30:00Z',
        metadata: {},
      },
      setup_url: 'http://onecli:10254/',
      device_code: 'CONNECTOR',
      onecli_credential_ref:
        'onecli://users/user-integrations/telegram-bot/connector-installation-telegram',
      onecli_resource_name: 'agency-telegram-bot-connectorins',
      expires_at: '2099-01-01T00:30:00Z',
    });
    connectorsApi.completeConnectorInstallation.mockResolvedValue({
      id: 'connector-installation-telegram',
      owner_user_id: 'user-integrations',
      provider: 'telegram-bot',
      name: 'Telegram Bot',
      onecli_credential_ref:
        'onecli://users/user-integrations/telegram-bot/connector-installation-telegram',
      status: 'active',
      setup_session_id: 'connector-installation-telegram',
      metadata: {},
    });
    connectorsApi.testConnector.mockResolvedValue({
      ok: true,
      provider: 'telegram-bot',
      audit_execution_id: 'connector-test-123',
    });
    connectorsApi.getConnectorHistory.mockResolvedValue(connectorHistoryPayload());
    connectorsApi.getAggregateConnectorHistory.mockResolvedValue(connectorHistoryPayload());
    apiMocks.smartHomeApi.getAvailability.mockResolvedValue({
      available: true,
      source: 'capabilities',
    });
    apiMocks.smartHomeApi.listEntities.mockResolvedValue({
      count: 2,
      items: [
        {
          entity_id: 'light.living_room_main',
          state: 'on',
          attributes: {
            friendly_name: 'Living Room Main',
            area_name: 'Living Room',
          },
        },
        {
          entity_id: 'sensor.entry_motion',
          state: 'off',
          attributes: {
            friendly_name: 'Entry Motion',
            area_name: 'Entry',
          },
        },
      ],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
}
