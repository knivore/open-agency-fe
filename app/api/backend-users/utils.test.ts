import { afterEach, describe, expect, it, vi } from 'vitest';
import { getInternalApiKey } from '@/app/api/backend-users/utils';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/api/backend/users', () => ({
  backendUsersApi: {
    syncCurrentUser: vi.fn(),
  },
}));

describe('backend user BFF identity configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('recognizes the internal-key name written by the Open Agency launcher', () => {
    vi.stubEnv('AGENCY_FE_BFF_IDENTITY_KEY', '');
    vi.stubEnv('AGENCY_INTERNAL_API_KEY', '');
    vi.stubEnv('BACKEND_INTERNAL_API_KEY', '');
    vi.stubEnv('AGENCY_BACKEND_INTERNAL_API_KEY', 'launcher-key');

    expect(getInternalApiKey()).toBe('launcher-key');
  });
});
