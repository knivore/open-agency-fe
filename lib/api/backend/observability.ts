import { agencyApiClient } from '@/lib/api';
import { backendRoutes } from '@/lib/api/backend/routes';
import type { ExecutionTimelineResponse } from '@/lib/api/backend/types';

export const observabilityApi = {
  getExecutionTimeline(executionId: string) {
    return agencyApiClient.get<ExecutionTimelineResponse>(backendRoutes.observability.executionTimeline(executionId));
  },
  getAgentMetrics(agentId: string) {
    return agencyApiClient.get<Record<string, unknown>>(backendRoutes.observability.agentMetrics(agentId));
  },
  getWorkflowMetrics(workflowId: string) {
    return agencyApiClient.get<Record<string, unknown>>(backendRoutes.observability.workflowMetrics(workflowId));
  },
  getModelUsage() {
    return agencyApiClient.get<Record<string, unknown>>(backendRoutes.observability.modelUsage());
  },
};
