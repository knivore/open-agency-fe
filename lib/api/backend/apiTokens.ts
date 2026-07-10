import {
  agencyApiClient,
  appApiClient,
} from '@/lib/api/clientInstances';
import { currentUserHeaders } from '@/lib/api/backend/identity';
import { backendRoutes } from '@/lib/api/backend/routes';
import type { CrudListResponse } from '@/types/api';
import type { AuthUser } from '@/types/auth';
import type {
  ApiTokenActivityItem,
  ApiTokenCreateResponse,
  ApiTokenDefinition,
  ApiTokenScopeDefinition,
} from '@/types/apiTokens';

export const apiTokensApi = {
  listTokens() {
    return appApiClient.get<CrudListResponse<ApiTokenDefinition>>('/api/backend-api-tokens');
  },
  listScopes() {
    return appApiClient.get<CrudListResponse<ApiTokenScopeDefinition>>(
      '/api/backend-api-tokens/scopes'
    );
  },
  listActivity(limit = 10) {
    return appApiClient.get<{ items: ApiTokenActivityItem[]; total: number }>(
      `/api/backend-api-tokens/activity?limit=${limit}`
    );
  },
  createToken(payload: Record<string, unknown>) {
    return appApiClient.post<ApiTokenCreateResponse>('/api/backend-api-tokens', payload);
  },
  revokeToken(tokenId: string) {
    return appApiClient.post<ApiTokenDefinition>(`/api/backend-api-tokens/${tokenId}/revoke`, {});
  },
};

export const backendApiTokensApi = {
  listTokens(user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<CrudListResponse<ApiTokenDefinition>>(
      backendRoutes.profile.apiTokens(),
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  listScopes(user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<CrudListResponse<ApiTokenScopeDefinition>>(
      backendRoutes.profile.apiTokenScopes(),
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  listActivity(user: AuthUser, internalApiKey?: string | null, limit = 10) {
    return agencyApiClient.get<{ items: ApiTokenActivityItem[]; total: number }>(
      `${backendRoutes.observability.apiTokenActivity()}?limit=${limit}`,
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  createToken(payload: Record<string, unknown>, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.post<ApiTokenCreateResponse>(
      backendRoutes.profile.apiTokens(),
      payload,
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  revokeToken(tokenId: string, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.post<ApiTokenDefinition>(
      backendRoutes.profile.revokeApiToken(tokenId),
      {},
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
};
