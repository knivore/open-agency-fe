import { agencyApiClient } from '@/lib/api';
import { backendRoutes } from '@/lib/api/backend/routes';
import type { DatabaseHealthResponse, HealthResponse, RootInfoResponse } from '@/lib/api/backend/types';

export const healthApi = {
  getRootInfo() {
    return agencyApiClient.get<RootInfoResponse>(backendRoutes.root());
  },
  getHealth() {
    return agencyApiClient.get<HealthResponse>(backendRoutes.health.root());
  },
  getDatabaseHealth() {
    return agencyApiClient.get<DatabaseHealthResponse>(backendRoutes.health.db());
  },
};

