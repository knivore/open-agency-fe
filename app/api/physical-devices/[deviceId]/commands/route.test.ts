import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/physical-devices/[deviceId]/commands/route';

const { getAuthenticatedUser, getInternalApiKey, syncCurrentBackendUser, agencyGet } = vi.hoisted(
  () => ({
    getAuthenticatedUser: vi.fn(),
    getInternalApiKey: vi.fn(),
    syncCurrentBackendUser: vi.fn(),
    agencyGet: vi.fn(),
  })
);

vi.mock('@/lib/api/clientInstances', () => ({
  agencyApiClient: {
    get: agencyGet,
  },
}));

vi.mock('@/app/api/backend-users/utils', () => ({
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse: (error: unknown) =>
    Response.json({ message: error instanceof Error ? error.message : 'failed' }, { status: 500 }),
  syncCurrentBackendUser,
  unauthorizedResponse: () => Response.json({ message: 'Unauthorized' }, { status: 401 }),
}));

const user = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  image: null,
  accessToken: null,
  authMode: 'dev' as const,
};

describe('GET /api/physical-devices/[deviceId]/commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedUser.mockResolvedValue(user);
    getInternalApiKey.mockReturnValue('internal-key');
    syncCurrentBackendUser.mockResolvedValue({});
    agencyGet.mockResolvedValue({ count: 0, items: [] });
  });

  it('proxies selected physical device command history to the backend', async () => {
    const response = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ deviceId: 'device-1' }),
    });

    expect(response.status).toBe(200);
    expect(agencyGet).toHaveBeenCalledWith('/api/devices/device-1/commands', {
      headers: expect.objectContaining({
        'x-agency-user-id': 'user-1',
        'x-agency-internal-api-key': 'internal-key',
      }),
    });
  });
});
