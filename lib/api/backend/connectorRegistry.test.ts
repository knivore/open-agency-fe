import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { plannedIntegrationRegistry } from '@/lib/integrations/registry';
import { connectorRegistryApi } from '@/lib/api/backend/connectorRegistry';

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  agencyApiClient: {
    get: getMock,
  },
}));

describe('connectorRegistryApi.listCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts the canonical wrapped payload from the backend', async () => {
    getMock.mockResolvedValue({
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
      updated_at: '2026-05-07T00:00:00Z',
    });

    const result = await connectorRegistryApi.listCategories();

    expect(result.source).toBe('backend');
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0]?.id).toBe('communications');
  });

  it('accepts the temporary bare-array payload from the backend', async () => {
    getMock.mockResolvedValue([
      {
        id: 'storage',
        name: 'Storage',
        description: 'Storage connectors',
        providers: {},
      },
    ]);

    const result = await connectorRegistryApi.listCategories();

    expect(result.source).toBe('backend');
    expect(result.categories).toEqual([
      {
        id: 'storage',
        name: 'Storage',
        description: 'Storage connectors',
        providers: {},
      },
    ]);
  });

  it('falls back to the local registry when the backend route is not implemented', async () => {
    getMock.mockRejectedValue(
      new ApiError({
        status: 404,
        message: 'Not found',
      })
    );

    const result = await connectorRegistryApi.listCategories();

    expect(result.source).toBe('fallback');
    expect(result.categories).toEqual(plannedIntegrationRegistry);
  });
});
