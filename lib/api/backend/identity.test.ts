import { describe, expect, it } from 'vitest';
import { currentUserHeaders, localCredentialHeaders } from '@/lib/api/backend/identity';
import type { AuthUser } from '@/types/auth';

const user: AuthUser = {
  id: 'user-main',
  email: 'main@example.com',
  name: 'Main User',
  image: null,
  accessToken: null,
  authMode: 'dev',
};

describe('currentUserHeaders', () => {
  it('marks management-console requests with delegated user identity', () => {
    expect(currentUserHeaders(user, 'fe-bff-key')).toEqual({
      'x-agency-client': 'agency-fe',
      'x-agency-user-id': 'user-main',
      'x-agency-user-email': 'main@example.com',
      'x-agency-user-name': 'Main User',
      'x-agency-auth-provider': 'dev-auth',
      'x-agency-provider-subject': 'user-main',
      'x-agency-provider-account-id': 'main@example.com',
      'x-agency-internal-api-key': 'fe-bff-key',
    });
  });

  it('does not emit an empty internal credential header', () => {
    expect(currentUserHeaders(user)).not.toHaveProperty('x-agency-internal-api-key');
  });

  it('forwards the authenticated bearer for sensitive backend operations', () => {
    expect(localCredentialHeaders({ ...user, accessToken: 'agt_session' })).toHaveProperty(
      'Authorization',
      'Bearer agt_session'
    );
    expect(localCredentialHeaders({ ...user, accessToken: 'dev-fallback' })).not.toHaveProperty(
      'Authorization'
    );
  });
});
