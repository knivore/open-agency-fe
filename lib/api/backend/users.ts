import {
  agencyApiClient,
  appApiClient,
} from '@/lib/api/clientInstances';
import { currentUserHeaders } from '@/lib/api/backend/identity';
import { backendRoutes } from '@/lib/api/backend/routes';
import type { CrudListResponse } from '@/types/api';
import type { AuthUser } from '@/types/auth';
import type { User } from '@/types/users';

export type BackendUserStatus = 'active' | 'disabled' | 'invited';

export interface BackendUser {
  id: string;
  email: string;
  display_name?: string | null;
  avatar_url?: string | null;
  status: BackendUserStatus;
  roles: string[];
  provider?: string | null;
  provider_subject?: string | null;
  provider_account_id?: string | null;
  metadata: Record<string, unknown>;
}

function toBackendUserPayload(user: AuthUser): Record<string, unknown> {
  return {
    id: user.id,
    email: user.email,
    display_name: user.name,
    avatar_url: user.image,
    provider: user.authMode === 'dev' ? 'dev-auth' : 'nextauth',
    provider_subject: user.id,
    provider_account_id: user.email,
    metadata: {
      auth_mode: user.authMode,
    },
  };
}

export const usersApi = {
  syncCurrentUser(user: AuthUser) {
    return appApiClient.post<BackendUser>('/api/backend-users/sync', toBackendUserPayload(user));
  },
  getCurrentUser() {
    return appApiClient.get<BackendUser>('/api/backend-users/me');
  },
  getUser(userId: string) {
    return appApiClient.get<BackendUser>(`/api/backend-users/${userId}`);
  },
  searchUsers(email: string) {
    return appApiClient.get<CrudListResponse<BackendUser>>('/api/backend-users', {
      query: { email },
    });
  },
};

export const backendUsersApi = {
  syncCurrentUser(user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.post<BackendUser>(
      backendRoutes.users.sync(),
      toBackendUserPayload(user),
      {
        headers: internalApiKey ? { 'x-agency-internal-api-key': internalApiKey } : undefined,
      }
    );
  },
  getCurrentUser(user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<BackendUser>(backendRoutes.users.me(), {
      headers: {
        ...currentUserHeaders(user),
        ...(internalApiKey ? { 'x-agency-internal-api-key': internalApiKey } : {}),
      },
    });
  },
  getUser(userId: string) {
    return agencyApiClient.get<BackendUser>(backendRoutes.users.byId(userId));
  },
  searchUsers(email: string) {
    return agencyApiClient.get<CrudListResponse<BackendUser>>(backendRoutes.users.list(), {
      query: { email },
    });
  },
};

export function backendUserToUser(user: BackendUser): User {
  return {
    id: user.id,
    name: user.display_name || user.email,
    email: user.email,
    image: user.avatar_url ?? null,
  };
}
