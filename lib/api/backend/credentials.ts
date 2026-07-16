import { agencyApiClient, appApiClient } from '@/lib/api/clientInstances';
import { isApiError } from '@/lib/api/errors';
import { currentUserHeaders } from '@/lib/api/backend/identity';
import { backendRoutes } from '@/lib/api/backend/routes';
import type {
  ConnectorCapabilitiesPayload,
  ConnectorCapabilityDefinition,
  ConnectorCredentialResolvePayload,
  ConnectorCredentialResolveResult,
  ConnectorCredentialValidationPayload,
  CredentialDefinition,
  ProviderCredentialStatus,
} from '@/types/integrations';
import type { CrudListResponse, DeleteResponse } from '@/types/api';
import type { AuthUser } from '@/types/auth';

export const credentialsApi = {
  hasBackendSupport() {
    return true;
  },
  getUnsupportedStatus(): ProviderCredentialStatus {
    return {
      managedByBackend: true,
      writeSupported: true,
      refs: [],
      message:
        'Credential metadata is managed by the backend. Raw secret values must stay in the configured secret store.',
    };
  },
  listCredentials() {
    return appApiClient.get<CrudListResponse<CredentialDefinition>>('/api/backend-credentials');
  },
  getCredential(credentialId: string) {
    return appApiClient.get<CredentialDefinition>(`/api/backend-credentials/${credentialId}`);
  },
  createCredential(payload: Record<string, unknown>) {
    return appApiClient.post<CredentialDefinition>('/api/backend-credentials', payload);
  },
  updateCredential(credentialId: string, patch: Record<string, unknown>) {
    return appApiClient.put<CredentialDefinition>(
      `/api/backend-credentials/${credentialId}`,
      patch
    );
  },
  deleteCredential(credentialId: string) {
    return appApiClient.delete<DeleteResponse>(`/api/backend-credentials/${credentialId}`);
  },
  revokeCredential(credentialId: string) {
    return appApiClient.post<CredentialDefinition>(
      `/api/backend-credentials/${credentialId}/revoke`,
      {}
    );
  },
  rotateCredential(credentialId: string, payload: Record<string, unknown> = {}) {
    return appApiClient.post<CredentialDefinition>(
      `/api/backend-credentials/${credentialId}/rotate`,
      payload
    );
  },
  getConnectorCredentialCapabilities() {
    return appApiClient.get<ConnectorCapabilitiesPayload>(
      '/api/backend-credentials/connectors/capabilities'
    );
  },
  async getConnectorCredentialSchema(providerKey: string) {
    try {
      return await appApiClient.get<ConnectorCapabilityDefinition>(
        `/api/backend-credentials/connectors/${providerKey}/schema`
      );
    } catch (error) {
      if (!isApiError(error) || ![404, 405, 500, 501].includes(error.status)) {
        throw error;
      }

      const payload = await appApiClient.get<ConnectorCapabilitiesPayload>(
        '/api/backend-credentials/connectors/capabilities'
      );
      const capability = payload.connectors?.[providerKey];
      if (!capability) {
        throw error;
      }
      return capability;
    }
  },
  validateConnectorCredential(providerKey: string, payload: Record<string, unknown>) {
    return appApiClient.post<ConnectorCredentialValidationPayload>(
      `/api/backend-credentials/connectors/${providerKey}/validate`,
      payload
    );
  },
  resolveConnectorCredential(payload: ConnectorCredentialResolvePayload) {
    return appApiClient.post<ConnectorCredentialResolveResult>(
      '/api/backend-credentials/connectors/resolve',
      payload
    );
  },
  createConnectorCredential(providerKey: string, payload: Record<string, unknown>) {
    return appApiClient.post<CredentialDefinition>(
      `/api/backend-credentials/connectors/${providerKey}`,
      payload
    );
  },
  updateConnectorCredential(credentialId: string, patch: Record<string, unknown>) {
    return appApiClient.put<CredentialDefinition>(
      `/api/backend-credentials/${credentialId}/connector`,
      patch
    );
  },
};

export const backendCredentialsApi = {
  listCredentials(user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<CrudListResponse<CredentialDefinition>>(
      backendRoutes.profile.credentials(),
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  getCredential(credentialId: string, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<CredentialDefinition>(
      backendRoutes.profile.credentialById(credentialId),
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  createCredential(
    payload: Record<string, unknown>,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.post<CredentialDefinition>(
      backendRoutes.profile.credentials(),
      payload,
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  updateCredential(
    credentialId: string,
    patch: Record<string, unknown>,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.put<CredentialDefinition>(
      backendRoutes.profile.credentialById(credentialId),
      patch,
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  deleteCredential(credentialId: string, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.delete<DeleteResponse>(
      backendRoutes.profile.credentialById(credentialId),
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  revokeCredential(credentialId: string, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.post<CredentialDefinition>(
      backendRoutes.profile.revokeCredential(credentialId),
      {},
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  rotateCredential(
    credentialId: string,
    payload: Record<string, unknown>,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.post<CredentialDefinition>(
      backendRoutes.profile.rotateCredential(credentialId),
      payload,
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  getConnectorCredentialSchema(
    providerKey: string,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.get<ConnectorCapabilityDefinition>(
      backendRoutes.profile.connectorCredentialSchema(providerKey),
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  validateConnectorCredential(
    providerKey: string,
    payload: Record<string, unknown>,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.post<ConnectorCredentialValidationPayload>(
      backendRoutes.profile.validateConnectorCredential(providerKey),
      payload,
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  resolveConnectorCredential(
    payload: ConnectorCredentialResolvePayload,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.post<ConnectorCredentialResolveResult>(
      backendRoutes.profile.resolveConnectorCredential(),
      payload,
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  createConnectorCredential(
    providerKey: string,
    payload: Record<string, unknown>,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.post<CredentialDefinition>(
      backendRoutes.profile.createConnectorCredential(providerKey),
      payload,
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  updateConnectorCredential(
    credentialId: string,
    patch: Record<string, unknown>,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.put<CredentialDefinition>(
      backendRoutes.profile.updateConnectorCredential(credentialId),
      patch,
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
};
