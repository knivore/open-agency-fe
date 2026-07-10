import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getApiClientAuthToken, setApiClientTokenProvider } from './auth';

describe('api auth token provider', () => {
  beforeEach(() => {
    setApiClientTokenProvider(null);
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    setApiClientTokenProvider(null);
  });

  it('uses stored API tokens when no session token provider is registered', async () => {
    window.localStorage.setItem('agency_api_token', 'stored-token');

    await expect(getApiClientAuthToken()).resolves.toBe('stored-token');
  });

  it('does not fall back to stored API tokens when the session token provider is authoritative', async () => {
    window.localStorage.setItem('agency_api_token', 'stale-token');
    setApiClientTokenProvider(() => null);

    await expect(getApiClientAuthToken()).resolves.toBeNull();
  });
});
