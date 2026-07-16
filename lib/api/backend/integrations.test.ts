import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { integrationsApi } from '@/lib/api/backend/integrations';

const {
  listCredentialsMock,
  listRegistryCategoriesMock,
  listModelProvidersMock,
  listModelProfilesMock,
  listToolsMock,
  listMcpServersMock,
  listRuntimeAdaptersMock,
} = vi.hoisted(() => ({
  listCredentialsMock: vi.fn(),
  listRegistryCategoriesMock: vi.fn(),
  listModelProvidersMock: vi.fn(),
  listModelProfilesMock: vi.fn(),
  listToolsMock: vi.fn(),
  listMcpServersMock: vi.fn(),
  listRuntimeAdaptersMock: vi.fn(),
}));

vi.mock('@/lib/api/backend/credentials', () => ({
  credentialsApi: {
    listCredentials: listCredentialsMock,
  },
}));

vi.mock('@/lib/api/backend/connectorRegistry', () => ({
  connectorRegistryApi: {
    listCategories: listRegistryCategoriesMock,
  },
}));

vi.mock('@/lib/api/backend/providers', () => ({
  providersApi: {
    listModelProviders: listModelProvidersMock,
    listModelProfiles: listModelProfilesMock,
    listMcpServers: listMcpServersMock,
    listRuntimeAdapters: listRuntimeAdaptersMock,
  },
}));

vi.mock('@/lib/api/backend/tools', () => ({
  toolsApi: {
    listTools: listToolsMock,
  },
}));

describe('integrationsApi.listCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds the catalog even when non-critical endpoints fail', async () => {
    listCredentialsMock.mockRejectedValue(new ApiError({ status: 401, message: 'Unauthorized' }));
    listRegistryCategoriesMock.mockResolvedValue({
      source: 'fallback',
      updatedAt: null,
      categories: [
        {
          id: 'communications',
          name: 'Communications',
          description: 'Comms connectors',
          providers: {
            Telegram: {
              backendKey: 'telegram-bot',
              authModel: 'bot token',
              summary: 'Telegram connector',
              launchPriority: 'now',
            },
          },
        },
      ],
    });
    listModelProvidersMock.mockRejectedValue(
      new ApiError({ status: 500, message: 'Server error' })
    );
    listModelProfilesMock.mockResolvedValue({ items: [] });
    listToolsMock.mockRejectedValue(new Error('socket hang up'));
    listMcpServersMock.mockResolvedValue({ items: [] });
    listRuntimeAdaptersMock.mockResolvedValue({ items: [] });

    const result = await integrationsApi.listCategories();

    expect(result.registrySource).toBe('fallback');
    expect(result.categories.length).toBeGreaterThan(0);
    expect(result.categories.some((category) => category.id === 'communications')).toBe(true);
  });

  it('accepts bare-array list payloads without crashing', async () => {
    listCredentialsMock.mockResolvedValue([]);
    listRegistryCategoriesMock.mockResolvedValue({
      source: 'backend',
      updatedAt: '2026-05-07T00:00:00Z',
      categories: [],
    });
    listModelProvidersMock.mockResolvedValue([]);
    listModelProfilesMock.mockResolvedValue([]);
    listToolsMock.mockResolvedValue([]);
    listMcpServersMock.mockResolvedValue([]);
    listRuntimeAdaptersMock.mockResolvedValue([]);

    const result = await integrationsApi.listCategories();

    expect(result.registrySource).toBe('backend');
    expect(result.registryUpdatedAt).toBe('2026-05-07T00:00:00Z');
    expect(Array.isArray(result.categories)).toBe(true);
  });
});
