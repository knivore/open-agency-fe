import { agencyApiClient, appApiClient } from '@/lib/api';
import { backendRoutes } from '@/lib/api/backend/routes';
import { toAgentRun } from '@/lib/api/backend/agentTransforms';
import type {
  AgentRun,
  CrudListResponse,
  DeleteResponse,
  ExecutionRecord,
  WorkflowDefinition,
  WorkflowMonitoringEventsResponse,
  WorkflowMonitoringOperatorPayload,
  WorkflowMonitoringUpdateResponse,
  WorkflowSharedMemoryOperatorPayload,
  WorkflowSharedMemoryUpdateResponse,
} from '@/lib/api/backend/types';
import type { AuthUser } from '@/types/auth';

function currentUserHeaders(user: AuthUser, internalApiKey?: string | null): HeadersInit {
  return {
    'x-agency-user-id': user.id,
    'x-agency-user-email': user.email,
    'x-agency-user-name': user.name,
    'x-agency-auth-provider': 'local',
    'x-agency-provider-subject': user.id,
    'x-agency-provider-account-id': user.email,
    ...(internalApiKey ? { 'x-agency-internal-api-key': internalApiKey } : {}),
  };
}

interface BackendUser {
  id: string;
  email: string;
  display_name?: string | null;
  avatar_url?: string | null;
  roles?: string[];
  metadata?: Record<string, unknown>;
}

export const workflowsApi = {
  listWorkflows() {
    return agencyApiClient.get<CrudListResponse<WorkflowDefinition>>(backendRoutes.workflows.list());
  },
  getWorkflow(workflowId: string) {
    return agencyApiClient.get<WorkflowDefinition>(backendRoutes.workflows.byId(workflowId));
  },
  createWorkflow(payload: WorkflowDefinition | Record<string, unknown>) {
    return appApiClient
      .post<{ data: WorkflowDefinition }>('/api/workflows', payload)
      .then((response) => response.data);
  },
  updateWorkflow(workflowId: string, patch: Record<string, unknown>) {
    return appApiClient.put<{ msg?: string; status?: number }>(`/api/workflows/${workflowId}`, patch);
  },
  deleteWorkflow(workflowId: string) {
    return appApiClient.delete<DeleteResponse | { message?: string; status?: number }>(`/api/workflows/${workflowId}`);
  },
  publishWorkflow(workflowId: string, payload?: Record<string, unknown>) {
    return appApiClient.post<WorkflowDefinition>(`/api/workflows/${workflowId}/publish`, payload || {});
  },
  unpublishWorkflow(workflowId: string, payload?: Record<string, unknown>) {
    return appApiClient.post<WorkflowDefinition>(`/api/workflows/${workflowId}/unpublish`, payload || {});
  },
  getWorkflowMonitoring(workflowId: string) {
    return agencyApiClient.get<WorkflowMonitoringOperatorPayload>(backendRoutes.workflows.monitoring(workflowId));
  },
  listWorkflowMonitoringEvents(workflowId: string) {
    return appApiClient.get<WorkflowMonitoringEventsResponse>(`/api/workflows/${workflowId}/monitoring/events`);
  },
  updateWorkflowMonitoring(workflowId: string, patch: Record<string, unknown>) {
    return appApiClient.patch<WorkflowMonitoringUpdateResponse>(`/api/workflows/${workflowId}/monitoring`, patch);
  },
  getWorkflowSharedMemory(workflowId: string) {
    return appApiClient.get<WorkflowSharedMemoryOperatorPayload>(`/api/workflows/${workflowId}/shared-memory`);
  },
  updateWorkflowSharedMemory(workflowId: string, patch: Record<string, unknown>) {
    return appApiClient.patch<WorkflowSharedMemoryUpdateResponse>(`/api/workflows/${workflowId}/shared-memory`, patch);
  },
  validateWorkflow(payload: WorkflowDefinition | Record<string, unknown>) {
    return agencyApiClient.post<Record<string, unknown>>(backendRoutes.workflows.validate(), payload);
  },
  listWorkflowExecutions(workflowId: string) {
    return agencyApiClient.get<CrudListResponse<ExecutionRecord>>(backendRoutes.workflows.executions(workflowId));
  },
  async listWorkflowRuns(workflowId: string): Promise<AgentRun[]> {
    const response = await this.listWorkflowExecutions(workflowId);
    return response.items.map(toAgentRun);
  },
};

export const backendWorkflowsApi = {
  getWorkflow(workflowId: string) {
    return agencyApiClient.get<WorkflowDefinition>(backendRoutes.workflows.byId(workflowId));
  },
  createWorkflow(payload: WorkflowDefinition | Record<string, unknown>, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.post<WorkflowDefinition>(backendRoutes.workflows.create(), payload, {
      headers: currentUserHeaders(user, internalApiKey),
    });
  },
  updateWorkflow(workflowId: string, patch: Record<string, unknown>, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.put<WorkflowDefinition>(backendRoutes.workflows.byId(workflowId), patch, {
      headers: currentUserHeaders(user, internalApiKey),
    });
  },
  deleteWorkflow(workflowId: string, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.delete<DeleteResponse>(backendRoutes.workflows.byId(workflowId), {
      headers: currentUserHeaders(user, internalApiKey),
    });
  },
  publishWorkflow(workflowId: string, payload: Record<string, unknown> | undefined, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.post<WorkflowDefinition>(backendRoutes.workflows.publish(workflowId), payload || {}, {
      headers: currentUserHeaders(user, internalApiKey),
    });
  },
  unpublishWorkflow(workflowId: string, payload: Record<string, unknown> | undefined, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.post<WorkflowDefinition>(backendRoutes.workflows.unpublish(workflowId), payload || {}, {
      headers: currentUserHeaders(user, internalApiKey),
    });
  },
  getWorkflowMonitoring(workflowId: string, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<WorkflowMonitoringOperatorPayload>(backendRoutes.workflows.monitoring(workflowId), {
      headers: currentUserHeaders(user, internalApiKey),
    });
  },
  listWorkflowMonitoringEvents(workflowId: string, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<WorkflowMonitoringEventsResponse>(
      backendRoutes.workflows.monitoringEvents(workflowId),
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  updateMonitoringControls(
    workflowId: string,
    patch: Record<string, unknown>,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.patch<WorkflowMonitoringUpdateResponse>(
      backendRoutes.workflows.monitoring(workflowId),
      patch,
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  getWorkflowSharedMemory(workflowId: string, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<WorkflowSharedMemoryOperatorPayload>(
      backendRoutes.workflows.sharedMemory(workflowId),
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  updateWorkflowSharedMemory(
    workflowId: string,
    patch: Record<string, unknown>,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.patch<WorkflowSharedMemoryUpdateResponse>(
      backendRoutes.workflows.sharedMemory(workflowId),
      patch,
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  cloneWorkflow(workflowId: string, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.post<WorkflowDefinition>(backendRoutes.workflows.clone(workflowId), {}, {
      headers: currentUserHeaders(user, internalApiKey),
    });
  },
  listOwners(workflowId: string, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<CrudListResponse<BackendUser>>(`${backendRoutes.workflows.byId(workflowId)}/owners`, {
      headers: currentUserHeaders(user, internalApiKey),
    });
  },
  addOwners(workflowId: string, ownerIds: string[], user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.post<{ owner_ids: string[]; workflow: WorkflowDefinition }>(
      `${backendRoutes.workflows.byId(workflowId)}/owners`,
      { owner_ids: ownerIds },
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  removeOwner(workflowId: string, ownerId: string, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.delete<{ owner_ids: string[]; workflow: WorkflowDefinition }>(
      `${backendRoutes.workflows.byId(workflowId)}/owners`,
      {
        headers: currentUserHeaders(user, internalApiKey),
        body: { owner_id: ownerId },
      }
    );
  },
};
