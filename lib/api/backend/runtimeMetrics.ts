import { agencyApiClient } from '@/lib/api/clientInstances';
import { backendRoutes } from '@/lib/api/backend/routes';

export const runtimeMetricsApi = {
  getRuntimeMetrics() {
    return agencyApiClient.get<Record<string, unknown>>(backendRoutes.executions.runtimeMetrics());
  },
};
