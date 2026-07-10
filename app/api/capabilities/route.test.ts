import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/capabilities/route';

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

describe('GET /api/capabilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedUser.mockResolvedValue(user);
    getInternalApiKey.mockReturnValue('internal-key');
    syncCurrentBackendUser.mockResolvedValue({});
    agencyGet.mockResolvedValue({
      name: 'agency-runtime',
      version: '1.0',
      modules: {
        physical_devices: {
          available: true,
        },
      },
    });
  });

  it('proxies runtime capabilities to the backend', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      name: 'agency-runtime',
      version: '1.0',
      modules: {
        physical_devices: {
          available: true,
        },
      },
    });
    expect(agencyGet).toHaveBeenCalledWith('/capabilities', {
      headers: expect.objectContaining({
        'x-agency-user-id': 'user-1',
        'x-agency-internal-api-key': 'internal-key',
      }),
    });
  });

  it('requires an authenticated frontend user', async () => {
    getAuthenticatedUser.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(agencyGet).not.toHaveBeenCalled();
  });
});
