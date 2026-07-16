import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDevCurrentUser, loginWithDevCredentials } from '@/lib/auth/devAuthAdapter';

const ORIGINAL_ENV = process.env;

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('dev auth adapter', () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      NEXT_PUBLIC_APP_ENV: 'local',
      NEXT_PUBLIC_AGENCY_DEV_AUTH_ENABLED: 'true',
      NEXT_PUBLIC_AGENCY_API_BASE_URL: 'http://backend.test',
      DEV_AUTH_EMAIL: 'dev@example.com',
      DEV_AUTH_PASSWORD: 'change-me',
      DEV_AUTH_NAME: 'Local Dev',
      DEV_AUTH_USER_ID: 'local-dev',
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.unstubAllGlobals();
  });

  it('uses backend login when auth endpoints are available', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        access_token: 'backend-token',
        user: {
          id: 'backend-user',
          email: 'Backend@Example.com',
          name: 'Backend User',
          image: 'https://example.com/avatar.png',
        },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      loginWithDevCredentials({ email: 'backend@example.com', password: 'pw' })
    ).resolves.toEqual({
      accessToken: 'backend-token',
      user: {
        id: 'backend-user',
        email: 'backend@example.com',
        name: 'Backend User',
        image: 'https://example.com/avatar.png',
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'backend@example.com', password: 'pw' }),
      })
    );
  });

  it('treats backend credential rejection as authoritative', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ detail: 'Invalid' }, { status: 401 }))
    );

    await expect(
      loginWithDevCredentials({ email: 'dev@example.com', password: 'change-me' })
    ).resolves.toBeNull();
  });

  it('falls back to configured local credentials when backend auth routes are missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ detail: 'Missing' }, { status: 404 }))
    );

    const response = await loginWithDevCredentials({
      email: 'dev@example.com',
      password: 'change-me',
    });

    expect(response?.accessToken).toMatch(/^dev-/);
    expect(response?.user).toEqual({
      id: 'local-dev',
      email: 'dev@example.com',
      name: 'Local Dev',
      image: null,
    });
  });

  it('loads the current user from backend me for backend-issued tokens', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 'backend-user',
        email: 'Backend@Example.com',
        display_name: 'Backend User',
        avatar_url: 'https://example.com/avatar.png',
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(getDevCurrentUser('backend-token')).resolves.toEqual({
      id: 'backend-user',
      email: 'backend@example.com',
      name: 'Backend User',
      image: 'https://example.com/avatar.png',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/auth/me',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer backend-token' }),
      })
    );
  });

  it('does not map rejected backend-issued tokens to the configured local user', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ detail: 'Invalid' }, { status: 401 }))
    );

    await expect(getDevCurrentUser('backend-token')).resolves.toBeNull();
  });

  it('keeps locally generated dev tokens tied to configured local user data', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(getDevCurrentUser('dev-local-token')).resolves.toEqual({
      id: 'local-dev',
      email: 'dev@example.com',
      name: 'Local Dev',
      image: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
