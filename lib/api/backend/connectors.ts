import type { ConnectorHealthHistoryPayload } from '@/lib/api/backend/types';

export interface ConnectorHistoryQuery {
  limit?: number;
  offset?: number;
  provider?: string;
  status?: string;
  started_after?: string;
  started_before?: string;
}

const emptyHistory = (query?: ConnectorHistoryQuery): ConnectorHealthHistoryPayload => ({
  items: [],
  total: 0,
  limit: query?.limit ?? 50,
  offset: query?.offset ?? 0,
});

export const connectorsApi = {
  async getConnectorHealth(_credentialId?: string) {
    return { ok: false, status: 'removed', message: 'Connector operation routes have been removed.' };
  },
  async testConnector(_credentialId?: string) {
    return { ok: false, status: 'removed', message: 'Connector operation routes have been removed.' };
  },
  async getConnectorHistory(_credentialId: string, query?: ConnectorHistoryQuery) {
    return emptyHistory(query);
  },
  async getAggregateConnectorHistory(query?: ConnectorHistoryQuery) {
    return emptyHistory(query);
  },
};

export const backendConnectorsApi = connectorsApi;
