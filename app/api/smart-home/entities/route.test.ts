import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/smart-home/entities/route';

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

describe('GET /api/smart-home/entities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedUser.mockResolvedValue(user);
    getInternalApiKey.mockReturnValue('internal-key');
    syncCurrentBackendUser.mockResolvedValue({});
    agencyGet.mockResolvedValue({
      count: 1,
      items: [{ entity_id: 'light.living_room_main', state: 'on', attributes: {} }],
    });
  });

  it('proxies the smart-home entity list through the authenticated backend route', async () => {
    const request = new NextRequest(
      'http://localhost/api/smart-home/entities?domain=light&room_name=living'
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      count: 1,
      items: [{ entity_id: 'light.living_room_main', state: 'on', attributes: {} }],
    });
    expect(syncCurrentBackendUser).toHaveBeenCalledWith(user);
    expect(agencyGet).toHaveBeenCalledWith(
      '/api/smart-home/entities?domain=light&room_name=living',
      {
        headers: expect.objectContaining({
          'x-agency-user-id': 'user-1',
          'x-agency-user-email': 'test@example.com',
          'x-agency-internal-api-key': 'internal-key',
        }),
      }
    );
  });

  it('returns unauthorized when there is no authenticated session', async () => {
    getAuthenticatedUser.mockResolvedValue(null);

    const response = await GET(new NextRequest('http://localhost/api/smart-home/entities'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: 'Unauthorized' });
    expect(agencyGet).not.toHaveBeenCalled();
  });
});
