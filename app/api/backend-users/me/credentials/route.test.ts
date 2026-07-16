import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PATCH } from '@/app/api/backend-users/me/credentials/route';

const { getAuthenticatedUser, getInternalApiKey, updateLocalCredentials } = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  getInternalApiKey: vi.fn(),
  updateLocalCredentials: vi.fn(),
}));

vi.mock('@/lib/api/backend/users', () => ({
  backendUsersApi: { updateLocalCredentials },
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
  accessToken: 'agt_session',
  authMode: 'dev' as const,
};

describe('PATCH /api/backend-users/me/credentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedUser.mockResolvedValue(user);
    getInternalApiKey.mockReturnValue('internal-key');
    updateLocalCredentials.mockResolvedValue({
      user: { id: 'user-1', email: 'new-owner@example.com' },
      reauthentication_required: true,
      revoked_sessions: 1,
    });
  });

  it('proxies the owner credential update through the authenticated server session', async () => {
    const patch = {
      email: 'new-owner@example.com',
      current_password: 'old-password',
      new_password: 'new-password',
    };
    const response = await PATCH(
      new Request('http://localhost/api/backend-users/me/credentials', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      })
    );

    expect(response.status).toBe(200);
    expect(updateLocalCredentials).toHaveBeenCalledWith(user, patch, 'internal-key');
    await expect(response.json()).resolves.toMatchObject({ reauthentication_required: true });
  });

  it('requires an authenticated frontend user', async () => {
    getAuthenticatedUser.mockResolvedValue(null);
    const response = await PATCH(
      new Request('http://localhost/api/backend-users/me/credentials', {
        method: 'PATCH',
        body: JSON.stringify({ email: 'owner@example.com', current_password: 'password' }),
      })
    );

    expect(response.status).toBe(401);
    expect(updateLocalCredentials).not.toHaveBeenCalled();
  });
});
