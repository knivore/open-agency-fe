import { agencyApiClient } from '@/lib/api';
import { backendRoutes } from '@/lib/api/backend/routes';
import { toAgentRun, toRunSessionSummary } from '@/lib/api/backend/agentTransforms';
import type {
  ApprovalRequestPayload,
  AgentRun,
  CreateExecutionPayload,
  CrudListResponse,
  ExecutionEventRecord,
  ExecutionDetailResponse,
  ExecutionArtifact,
  ExecutionRecord,
} from '@/lib/api/backend/types';
import type { AuthUser } from '@/types/auth';

function currentUserHeaders(user: AuthUser, internalApiKey?: string | null): HeadersInit {
  return {
    'x-agency-user-id': user.id,
    'x-agency-user-email': user.email,
    'x-agency-user-name': user.name,
    'x-agency-auth-provider': user.authMode === 'dev' ? 'dev-auth' : 'nextauth',
    'x-agency-provider-subject': user.id,
    'x-agency-provider-account-id': user.email,
    ...(internalApiKey ? { 'x-agency-internal-api-key': internalApiKey } : {}),
  };
}

function backendExecutionPayload(payload: Omit<CreateExecutionPayload, 'workflowId'>) {
  const { executionHost, runtimeAdapterId, ...rest } = payload;

  return {
    ...rest,
    ...(runtimeAdapterId ? { runtime_adapter_id: runtimeAdapterId } : {}),
    ...(executionHost ? { execution_host: executionHost } : {}),
  };
}

export const executionsApi = {
  listExecutions() {
    return agencyApiClient.get<CrudListResponse<ExecutionRecord>>(backendRoutes.executions.list());
  },
  listActiveExecutions() {
    return agencyApiClient.get<CrudListResponse<ExecutionRecord>>(backendRoutes.executions.active());
  },
  createExecution(payload: CreateExecutionPayload) {
    const { workflowId, ...rest } = payload;
    return agencyApiClient.post<ExecutionRecord>(backendRoutes.executions.create(), {
      workflowId,
      ...backendExecutionPayload(rest),
    });
  },
  createWorkflowExecution(workflowId: string, payload: Omit<CreateExecutionPayload, 'workflowId'>) {
    return agencyApiClient.post<ExecutionRecord>(
      backendRoutes.workflows.executions(workflowId),
      backendExecutionPayload(payload)
    );
  },
  startWorkflowExecution(
    workflowId: string,
    payload: Omit<CreateExecutionPayload, 'workflowId'>,
    user?: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.post<{ execution: ExecutionRecord; process_id: string; status: string }>(
      backendRoutes.workflows.startExecution(workflowId),
      backendExecutionPayload(payload),
      user
        ? {
            headers: currentUserHeaders(user, internalApiKey),
          }
        : undefined
    );
  },
  getExecution(executionId: string, user?: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<ExecutionDetailResponse>(backendRoutes.executions.byId(executionId), {
      headers: user ? currentUserHeaders(user, internalApiKey) : undefined,
    });
  },
  updateExecution(executionId: string, patch: Record<string, unknown>) {
    return agencyApiClient.put<ExecutionRecord>(backendRoutes.executions.byId(executionId), patch);
  },
  startExecution(executionId: string) {
    return agencyApiClient.post<Record<string, unknown>>(backendRoutes.executions.start(executionId), {});
  },
  pauseExecution(executionId: string) {
    return agencyApiClient.post<Record<string, unknown>>(backendRoutes.executions.pause(executionId), {});
  },
  resumeExecution(executionId: string) {
    return agencyApiClient.post<Record<string, unknown>>(backendRoutes.executions.resume(executionId), {});
  },
  cancelExecution(executionId: string, user?: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.post<Record<string, unknown>>(
      backendRoutes.executions.cancel(executionId),
      {},
      {
        headers: user ? currentUserHeaders(user, internalApiKey) : undefined,
      }
    );
  },
  approveExecution(executionId: string, payload: ApprovalRequestPayload) {
    return agencyApiClient.post<Record<string, unknown>>(backendRoutes.executions.approve(executionId), payload);
  },
  rejectExecution(executionId: string, payload: ApprovalRequestPayload) {
    return agencyApiClient.post<Record<string, unknown>>(backendRoutes.executions.reject(executionId), payload);
  },
  listExecutionEvents(executionId: string, afterSequence = 0) {
    return agencyApiClient.get<CrudListResponse<ExecutionEventRecord>>(
      backendRoutes.executions.events(executionId),
      { query: { after_sequence: afterSequence } }
    );
  },
  listExecutionArtifacts(executionId: string, user?: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<CrudListResponse<ExecutionArtifact>>(backendRoutes.executions.artifacts(executionId), {
      headers: user ? currentUserHeaders(user, internalApiKey) : undefined,
    });
  },
  streamArtifactImages(executionId: string, user?: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<Response>(backendRoutes.executions.artifactImagesStream(executionId), {
      cache: 'no-store',
      headers: {
        ...(user ? currentUserHeaders(user, internalApiKey) : {}),
        Accept: 'multipart/x-mixed-replace',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Connection: 'keep-alive',
      },
      responseType: 'raw',
    });
  },
  streamExecutionEvents(executionId: string, afterSequence = 0, user?: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<Response>(backendRoutes.executions.stream(executionId), {
      query: { after_sequence: afterSequence },
      headers: {
        ...(user ? currentUserHeaders(user, internalApiKey) : {}),
        Accept: 'text/event-stream',
      },
      responseType: 'raw',
    });
  },
  streamHumanLoop(executionId: string, user?: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<Response>(backendRoutes.executions.hitlStream(executionId), {
      cache: 'no-store',
      headers: {
        ...(user ? currentUserHeaders(user, internalApiKey) : {}),
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
      responseType: 'raw',
    });
  },
  replyToHumanLoop(executionId: string, reply: string, user?: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.post<{ message?: string }>(
      backendRoutes.executions.hitlReply(executionId),
      { reply },
      {
        headers: user ? currentUserHeaders(user, internalApiKey) : undefined,
      }
    );
  },
  async listAgentRuns(): Promise<AgentRun[]> {
    const response = await this.listExecutions();
    return response.items.map(toAgentRun);
  },
  async listActiveAgentRuns(): Promise<AgentRun[]> {
    const response = await this.listActiveExecutions();
    return response.items.map(toAgentRun);
  },
  async getAgentRun(executionId: string): Promise<AgentRun> {
    const response = await this.getExecution(executionId);
    return toAgentRun(response.execution);
  },
  async listRunSessions() {
    const response = await this.listExecutions();
    return response.items.map(toRunSessionSummary);
  },
  async listActiveRunSessions() {
    const response = await this.listActiveExecutions();
    return response.items.map(toRunSessionSummary);
  },
};
