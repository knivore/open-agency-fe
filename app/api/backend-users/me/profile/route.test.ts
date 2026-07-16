import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PATCH } from '@/app/api/backend-users/me/profile/route';

const { getAuthenticatedUser, getInternalApiKey, updateCurrentUserProfile } = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  getInternalApiKey: vi.fn(),
  updateCurrentUserProfile: vi.fn(),
}));

vi.mock('@/lib/api/backend/users', () => ({
  backendUsersApi: { updateCurrentUserProfile },
}));

vi.mock('@/app/api/backend-users/utils', () => ({
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse: (error: unknown) =>
    Response.json({ message: error instanceof Error ? error.message : 'failed' }, { status: 500 }),
  unauthorizedResponse: () => Response.json({ message: 'Unauthorized' }, { status: 401 }),
}));

const user = {
  id: 'user-1',
  name: 'Owner One',
  email: 'owner@example.com',
  image: null,
  accessToken: null,
  authMode: 'dev' as const,
};

describe('PATCH /api/backend-users/me/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedUser.mockResolvedValue(user);
    getInternalApiKey.mockReturnValue('internal-key');
    updateCurrentUserProfile.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
      display_name: 'Owner Preferred',
      metadata: {
        profile_preferences: {
          display_name: 'Owner Preferred',
          timezone: 'Asia/Singapore',
        },
      },
    });
  });

  it('proxies allowlisted personal settings for the authenticated user', async () => {
    const request = new Request('http://localhost/api/backend-users/me/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        display_name: 'Owner Preferred',
        timezone: 'Asia/Singapore',
      }),
    });

    const response = await PATCH(request);

    expect(response.status).toBe(200);
    expect(updateCurrentUserProfile).toHaveBeenCalledWith(
      user,
      { display_name: 'Owner Preferred', timezone: 'Asia/Singapore' },
      'internal-key'
    );
  });

  it('requires an authenticated frontend user', async () => {
    getAuthenticatedUser.mockResolvedValue(null);
    const request = new Request('http://localhost/api/backend-users/me/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ display_name: 'Owner', timezone: 'UTC' }),
    });

    const response = await PATCH(request);

    expect(response.status).toBe(401);
    expect(updateCurrentUserProfile).not.toHaveBeenCalled();
  });
});
