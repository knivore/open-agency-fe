import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/physical-devices/audit/route';

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

describe('GET /api/physical-devices/audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedUser.mockResolvedValue(user);
    getInternalApiKey.mockReturnValue('internal-key');
    syncCurrentBackendUser.mockResolvedValue({});
    agencyGet.mockResolvedValue({
      status: 'ok',
      summary: {},
      bus_health: { provider: 'in_memory', connected: true, subscribers: 0 },
    });
  });

  it('proxies physical device audit query parameters to the backend', async () => {
    const request = new NextRequest(
      'http://localhost/api/physical-devices/audit?stale_after_seconds=900&include_devices=true&limit=5'
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(agencyGet).toHaveBeenCalledWith(
      '/api/devices/audit?stale_after_seconds=900&include_devices=true&limit=5',
      {
        headers: expect.objectContaining({
          'x-agency-user-id': 'user-1',
          'x-agency-internal-api-key': 'internal-key',
        }),
      }
    );
  });
});
