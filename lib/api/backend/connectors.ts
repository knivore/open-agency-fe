import {
  agencyApiClient,
  appApiClient,
} from '@/lib/api/clientInstances';
import { backendRoutes } from '@/lib/api/backend/routes';
import type {
  ConnectorHealthHistoryPayload,
  ConnectorInstallationDefinition,
  ConnectorSetupSessionPayload,
} from '@/types/integrations';

export interface ConnectorHistoryQuery {
  limit?: number;
  offset?: number;
  provider?: string;
  status?: string;
  started_after?: string;
  started_before?: string;
}

function connectorHistoryQueryString(query?: ConnectorHistoryQuery) {
  if (!query) {
    return '';
  }

  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value == null || value === '') {
      return;
    }
    params.set(key, String(value));
  });

  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

export const connectorsApi = {
  listConnectorInstallations() {
    return appApiClient.get<{ items: ConnectorInstallationDefinition[] }>(
      '/api/backend-connectors/installations'
    );
  },
  deleteConnectorInstallation(installationId: string) {
    return appApiClient.delete<Record<string, unknown>>(
      `/api/backend-connectors/installations/${installationId}`
    );
  },
  completeConnectorInstallation(installationId: string, payload: Record<string, unknown>) {
    return appApiClient.post<ConnectorInstallationDefinition>(
      `/api/backend-connectors/installations/${installationId}/complete`,
      payload
    );
  },
  createConnectorSetupSession(providerKey: string, payload: Record<string, unknown>) {
    return appApiClient.post<ConnectorSetupSessionPayload>(
      `/api/backend-connectors/${providerKey}/setup-sessions`,
      payload
    );
  },
  getConnectorHealth(credentialId: string) {
    return appApiClient.get<Record<string, unknown>>(
      `/api/backend-connectors/${credentialId}/health`
    );
  },
  testConnector(credentialId: string) {
    return appApiClient.post<Record<string, unknown>>(
      `/api/backend-connectors/${credentialId}/test`,
      {}
    );
  },
  getConnectorHistory(credentialId: string, query?: ConnectorHistoryQuery) {
    return appApiClient.get<ConnectorHealthHistoryPayload>(
      `/api/backend-connectors/${credentialId}/history${connectorHistoryQueryString(query)}`
    );
  },
  getAggregateConnectorHistory(query?: ConnectorHistoryQuery) {
    return appApiClient.get<ConnectorHealthHistoryPayload>(
      `/api/backend-connectors/history${connectorHistoryQueryString(query)}`
    );
  },
};

export const backendConnectorsApi = {
  listConnectorInstallations(headers: HeadersInit) {
    return agencyApiClient.get<{ items: ConnectorInstallationDefinition[] }>(
      backendRoutes.connectors.installations(),
      {
        headers,
      }
    );
  },
  deleteConnectorInstallation(installationId: string, headers: HeadersInit) {
    return agencyApiClient.delete<Record<string, unknown>>(
      backendRoutes.connectors.installationById(installationId),
      {
        headers,
      }
    );
  },
  createConnectorSetupSession(
    providerKey: string,
    payload: Record<string, unknown>,
    headers: HeadersInit
  ) {
    return agencyApiClient.post<ConnectorSetupSessionPayload>(
      backendRoutes.connectors.createSetupSession(providerKey),
      payload,
      {
        headers,
      }
    );
  },
  getConnectorHealth(credentialId: string, headers: HeadersInit) {
    return agencyApiClient.get<Record<string, unknown>>(
      backendRoutes.connectors.health(credentialId),
      {
        headers,
      }
    );
  },
  testConnector(credentialId: string, headers: HeadersInit) {
    return agencyApiClient.post<Record<string, unknown>>(
      backendRoutes.connectors.test(credentialId),
      {},
      {
        headers,
      }
    );
  },
  rotateConnectorInstallation(
    installationId: string,
    payload: Record<string, unknown>,
    headers: HeadersInit
  ) {
    return agencyApiClient.post<ConnectorSetupSessionPayload>(
      backendRoutes.connectors.rotateInstallation(installationId),
      payload,
      {
        headers,
      }
    );
  },
  completeConnectorInstallation(
    installationId: string,
    payload: Record<string, unknown>,
    headers: HeadersInit
  ) {
    return agencyApiClient.post<ConnectorInstallationDefinition>(
      backendRoutes.connectors.completeInstallation(installationId),
      payload,
      {
        headers,
      }
    );
  },
  getConnectorHistory(credentialId: string, headers: HeadersInit, query?: ConnectorHistoryQuery) {
    return agencyApiClient.get<ConnectorHealthHistoryPayload>(
      `${backendRoutes.connectors.history(credentialId)}${connectorHistoryQueryString(query)}`,
      {
        headers,
      }
    );
  },
  getAggregateConnectorHistory(headers: HeadersInit, query?: ConnectorHistoryQuery) {
    return agencyApiClient.get<ConnectorHealthHistoryPayload>(
      `${backendRoutes.connectors.aggregateHistory()}${connectorHistoryQueryString(query)}`,
      {
        headers,
      }
    );
  },
};
