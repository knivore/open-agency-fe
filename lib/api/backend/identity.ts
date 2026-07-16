import type { AuthUser } from '@/types/auth';

export const AGENCY_FE_CLIENT_NAME = 'agency-fe';

export function currentUserHeaders(user: AuthUser, internalApiKey?: string | null): HeadersInit {
  return {
    'x-agency-client': AGENCY_FE_CLIENT_NAME,
    'x-agency-user-id': user.id,
    'x-agency-user-email': user.email,
    'x-agency-user-name': user.name,
    'x-agency-auth-provider': user.authMode === 'dev' ? 'dev-auth' : 'nextauth',
    'x-agency-provider-subject': user.id,
    'x-agency-provider-account-id': user.email,
    ...(internalApiKey ? { 'x-agency-internal-api-key': internalApiKey } : {}),
  };
}

export function localCredentialHeaders(user: AuthUser): HeadersInit {
  return {
    ...currentUserHeaders(user),
    // Only Open Agency-issued local sessions are valid proof for credential changes.
    // Do not forward fallback or external-provider access tokens as backend API keys.
    ...(user.accessToken?.startsWith('agt_')
      ? { Authorization: `Bearer ${user.accessToken}` }
      : {}),
  };
}
