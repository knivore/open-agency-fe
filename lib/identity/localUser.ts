import type { AuthUser } from '@/types/auth';

export const localUser: AuthUser = {
  id: 'local-user',
  name: 'Local User',
  email: 'local@agency.local',
  image: null,
  accessToken: null,
  authMode: 'local',
};

export function localUserHeaders(internalApiKey?: string | null): HeadersInit {
  return {
    'x-agency-user-id': localUser.id,
    'x-agency-user-email': localUser.email,
    'x-agency-user-name': localUser.name,
    'x-agency-auth-provider': 'local',
    'x-agency-provider-subject': localUser.id,
    'x-agency-provider-account-id': localUser.email,
    ...(internalApiKey ? { 'x-agency-internal-api-key': internalApiKey } : {}),
  };
}
