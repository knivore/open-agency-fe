import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import IntegrationsWorkspace from '@/components/integrations-app/IntegrationsWorkspace';
import type { ConnectorHealthHistoryItem, IntegrationCategory } from '@/types/integrations';
import type { ComponentProps } from 'react';

const apiMocks = vi.hoisted(() => ({
  connectorsApi: {
    testConnector: vi.fn(),
    getConnectorHistory: vi.fn(),
    getAggregateConnectorHistory: vi.fn(),
  },
  credentialsApi: {
    getConnectorCredentialSchema: vi.fn(),
    validateConnectorCredential: vi.fn(),
    createConnectorCredential: vi.fn(),
    updateConnectorCredential: vi.fn(),
    getCredential: vi.fn(),
  },
  integrationsApi: {
    listCategories: vi.fn(),
  },
  mcpServersApi: {
    createMcpServer: vi.fn(),
    deleteMcpServer: vi.fn(),
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
  toolsApi,
} = apiMocks;

export const { writeClipboardText } = clipboardMocks;

vi.mock('@/lib/api/backend', () => ({
  connectorsApi: apiMocks.connectorsApi,
  credentialsApi: apiMocks.credentialsApi,
  integrationsApi: apiMocks.integrationsApi,
  mcpServersApi: apiMocks.mcpServersApi,
  profileApi: apiMocks.profileApi,
  providersApi: apiMocks.providersApi,
  toolsApi: apiMocks.toolsApi,
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
      name: 'LLM Models',
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
    credentialsApi.getConnectorCredentialSchema.mockResolvedValue({
      backendKey: 'telegram-bot',
      displayName: 'Telegram',
      authModel: 'bot token',
      providerAliases: ['telegram'],
      healthSupported: true,
      requiredMetadata: [],
      supportedSecretRefSchemes: ['env'],
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
    connectorsApi.testConnector.mockResolvedValue({
      ok: true,
      provider: 'telegram-bot',
      audit_execution_id: 'connector-test-123',
    });
    connectorsApi.getConnectorHistory.mockResolvedValue(connectorHistoryPayload());
    connectorsApi.getAggregateConnectorHistory.mockResolvedValue(connectorHistoryPayload());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
}
