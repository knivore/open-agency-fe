import { agencyApiClient } from '@/lib/api';
import { backendRoutes } from '@/lib/api/backend/routes';
import type {
  CrudListResponse,
  DeleteResponse,
  ModelProfileDefinition,
  ModelProviderDefinition,
} from '@/lib/api/backend/types';

export type ProviderAuthorizeResponse = {
  auth_url: string;
  message: string;
  pkce_verifier: string;
  client_id: string;
  state: string;
  redirect_uri?: string;
  auth_profile_id?: string;
};

export type ProviderAuthorizeCompletePayload = {
  code?: string;
  redirect_url?: string;
  pkce_verifier?: string;
  client_id?: string;
  state?: string;
  auth_profile_id?: string;
};

export type ProviderAuthorizeCompleteResponse = {
  status: string;
  message: string;
  auth_profile_id?: string;
  account_id?: string | null;
};

export type DeviceAuthorizeResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
  message: string;
  auth_profile_id?: string;
};

export type ModelProviderModelOption = {
  id: string;
  name?: string | null;
};

export type ModelProviderModelsResponse = {
  target_type: 'model_provider';
  target_id: string;
  provider_type: string;
  provider_family?: string;
  source: 'live' | 'curated';
  models: ModelProviderModelOption[];
  error?: string;
};

export const modelProvidersApi = {
  listProviders() {
    return agencyApiClient.get<CrudListResponse<ModelProviderDefinition>>(
      backendRoutes.modelProviders.list()
    );
  },
  getProvider(providerId: string) {
    return agencyApiClient.get<ModelProviderDefinition>(
      backendRoutes.modelProviders.byId(providerId)
    );
  },
  createProvider(payload: Record<string, unknown>) {
    return agencyApiClient.post<ModelProviderDefinition>(
      backendRoutes.modelProviders.create(),
      payload
    );
  },
  updateProvider(providerId: string, patch: Record<string, unknown>) {
    return agencyApiClient.put<ModelProviderDefinition>(
      backendRoutes.modelProviders.byId(providerId),
      patch
    );
  },
  testProvider(providerId: string) {
    return agencyApiClient.post<Record<string, unknown>>(
      backendRoutes.modelProviders.test(providerId),
      {}
    );
  },
  listProviderModels(providerId: string) {
    return agencyApiClient.get<ModelProviderModelsResponse>(
      backendRoutes.modelProviders.models(providerId)
    );
  },
  authorizeProvider(
    providerId: string,
    options: { clientId?: string; authProfileId?: string } = {}
  ) {
    const params: Record<string, string> = {};
    if (options.clientId) params.client_id = options.clientId;
    if (options.authProfileId) params.auth_profile_id = options.authProfileId;
    return agencyApiClient.post<ProviderAuthorizeResponse>(
      backendRoutes.modelProviders.authorize(providerId),
      {},
      { query: params }
    );
  },
  completeAuthorizeProvider(providerId: string, payload: ProviderAuthorizeCompletePayload) {
    return agencyApiClient.post<ProviderAuthorizeCompleteResponse>(
      backendRoutes.modelProviders.callbackComplete(providerId),
      {},
      {
        query: {
          code: payload.code,
          redirect_url: payload.redirect_url,
          pkce_verifier: payload.pkce_verifier,
          client_id: payload.client_id,
          state: payload.state,
          auth_profile_id: payload.auth_profile_id,
        },
      }
    );
  },
  deviceAuthorizeProvider(providerId: string, authProfileId?: string) {
    return agencyApiClient.post<DeviceAuthorizeResponse>(
      backendRoutes.modelProviders.deviceAuthorize(providerId),
      {},
      { query: { auth_profile_id: authProfileId } }
    );
  },
  completeDeviceAuthorizeProvider(providerId: string, deviceCode: string, authProfileId?: string) {
    return agencyApiClient.post<ProviderAuthorizeCompleteResponse>(
      backendRoutes.modelProviders.deviceComplete(providerId),
      {},
      { query: { device_code: deviceCode, auth_profile_id: authProfileId } }
    );
  },
  getProviderHealth(providerId: string) {
    return agencyApiClient.get<Record<string, unknown>>(
      backendRoutes.modelProviders.health(providerId)
    );
  },
  deleteProvider(providerId: string) {
    return agencyApiClient.delete<DeleteResponse>(backendRoutes.modelProviders.byId(providerId));
  },
};

export const modelProfilesApi = {
  listProfiles() {
    return agencyApiClient.get<CrudListResponse<ModelProfileDefinition>>(
      backendRoutes.modelProfiles.list()
    );
  },
  getProfile(profileId: string) {
    return agencyApiClient.get<ModelProfileDefinition>(backendRoutes.modelProfiles.byId(profileId));
  },
  createProfile(payload: Record<string, unknown>) {
    return agencyApiClient.post<ModelProfileDefinition>(
      backendRoutes.modelProfiles.create(),
      payload
    );
  },
  updateProfile(profileId: string, patch: Record<string, unknown>) {
    return agencyApiClient.put<ModelProfileDefinition>(
      backendRoutes.modelProfiles.byId(profileId),
      patch
    );
  },
  testProfile(profileId: string) {
    return agencyApiClient.post<Record<string, unknown>>(
      backendRoutes.modelProfiles.test(profileId),
      {}
    );
  },
  getProfileHealth(profileId: string) {
    return agencyApiClient.get<Record<string, unknown>>(
      backendRoutes.modelProfiles.health(profileId)
    );
  },
  deleteProfile(profileId: string) {
    return agencyApiClient.delete<DeleteResponse>(backendRoutes.modelProfiles.byId(profileId));
  },
};
