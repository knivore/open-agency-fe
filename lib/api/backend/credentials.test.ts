import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { credentialsApi } from '@/lib/api/backend/credentials';

const { appGetMock } = vi.hoisted(() => ({
  appGetMock: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  agencyApiClient: {},
  appApiClient: {
    get: appGetMock,
  },
}));

describe('credentialsApi.getConnectorCredentialSchema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to connector capabilities when the schema route is unavailable', async () => {
    appGetMock
      .mockRejectedValueOnce(
        new ApiError({
          status: 404,
          message: 'Not found',
        })
      )
      .mockResolvedValueOnce({
        connectors: {
          'telegram-bot': {
            backendKey: 'telegram-bot',
            displayName: 'Telegram',
            authModel: 'bot token',
            providerAliases: ['telegram'],
            healthSupported: true,
            requiredMetadata: [],
            supportedSecretRefSchemes: ['env://', 'env:'],
          },
        },
      });

    const result = await credentialsApi.getConnectorCredentialSchema('telegram-bot');

    expect(appGetMock).toHaveBeenNthCalledWith(1, '/api/backend-credentials/connectors/telegram-bot/schema');
    expect(appGetMock).toHaveBeenNthCalledWith(2, '/api/backend-credentials/connectors/capabilities');
    expect(result.displayName).toBe('Telegram');
  });
});
