import { agencyApiClient, appApiClient } from '@/lib/api/clientInstances';
import { currentUserHeaders, localCredentialHeaders } from '@/lib/api/backend/identity';
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
  local_credentials_enabled?: boolean;
  metadata: Record<string, unknown>;
}

export interface BackendUserProfilePatch {
  display_name: string;
  timezone: string;
}

export interface BackendLocalCredentialsPatch {
  email: string;
  current_password: string;
  new_password?: string;
}

export interface BackendLocalCredentialsUpdate {
  user: BackendUser;
  reauthentication_required: boolean;
  revoked_sessions: number;
}

export interface BackendUserProfilePreferences {
  displayName: string | null;
  timezone: string | null;
}

export function getBackendUserProfilePreferences(
  user: BackendUser | null | undefined
): BackendUserProfilePreferences {
  const candidate = user?.metadata?.profile_preferences;
  if (!candidate || typeof candidate !== 'object') {
    return { displayName: null, timezone: null };
  }

  const preferences = candidate as Record<string, unknown>;
  return {
    displayName:
      typeof preferences.display_name === 'string' && preferences.display_name.trim()
        ? preferences.display_name.trim()
        : null,
    timezone:
      typeof preferences.timezone === 'string' && preferences.timezone.trim()
        ? preferences.timezone.trim()
        : null,
  };
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
  updateCurrentUserProfile(patch: BackendUserProfilePatch) {
    return appApiClient.patch<BackendUser>('/api/backend-users/me/profile', patch);
  },
  updateLocalCredentials(patch: BackendLocalCredentialsPatch) {
    return appApiClient.patch<BackendLocalCredentialsUpdate>(
      '/api/backend-users/me/credentials',
      patch
    );
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
        headers: currentUserHeaders(user, internalApiKey),
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
  updateCurrentUserProfile(
    user: AuthUser,
    patch: BackendUserProfilePatch,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.patch<BackendUser>(backendRoutes.users.profile(), patch, {
      headers: {
        ...currentUserHeaders(user),
        ...(internalApiKey ? { 'x-agency-internal-api-key': internalApiKey } : {}),
      },
    });
  },
  updateLocalCredentials(
    user: AuthUser,
    patch: BackendLocalCredentialsPatch,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.patch<BackendLocalCredentialsUpdate>(
      backendRoutes.auth.credentials(),
      patch,
      {
        headers: {
          ...localCredentialHeaders(user),
          ...(internalApiKey ? { 'x-agency-internal-api-key': internalApiKey } : {}),
        },
      }
    );
  },
  getUser(userId: string, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<BackendUser>(backendRoutes.users.byId(userId), {
      headers: currentUserHeaders(user, internalApiKey),
    });
  },
  searchUsers(email: string, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<CrudListResponse<BackendUser>>(backendRoutes.users.list(), {
      query: { email },
      headers: currentUserHeaders(user, internalApiKey),
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
