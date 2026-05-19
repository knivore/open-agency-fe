import { agencyApiClient } from '@/lib/api';
import { backendRoutes } from '@/lib/api/backend/routes';

export {
  agentsApi,
  conversationsApi,
  executionActionsAdapter,
  logsApi,
  runtimeAdaptersApi,
  runSessionsApi,
  runsApi,
  workflowsApi,
} from '@/lib/api/backend';

export const runtimeMetricsApi = {
  getRuntimeMetrics() {
    return agencyApiClient.get<Record<string, unknown>>(backendRoutes.executions.runtimeMetrics());
  },
};
