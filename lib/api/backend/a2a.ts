import { agencyApiClient } from '@/lib/api/clientInstances';
import { backendRoutes } from '@/lib/api/backend/routes';
import type { A2ATaskResponse } from '@/types/runtime';

export const a2aApi = {
  getAgentCard() {
    return agencyApiClient.get<Record<string, unknown>>(backendRoutes.a2a.agentCard());
  },
  createTask(payload: Record<string, unknown>) {
    return agencyApiClient.post<A2ATaskResponse>(backendRoutes.a2a.createTask(), payload);
  },
  getTask(taskId: string) {
    return agencyApiClient.get<A2ATaskResponse>(backendRoutes.a2a.taskById(taskId));
  },
  postTaskMessage(taskId: string, payload: Record<string, unknown>) {
    return agencyApiClient.post<Record<string, unknown>>(backendRoutes.a2a.taskMessages(taskId), payload);
  },
  listTaskArtifacts(taskId: string) {
    return agencyApiClient.get<Record<string, unknown>>(backendRoutes.a2a.taskArtifacts(taskId));
  },
};
