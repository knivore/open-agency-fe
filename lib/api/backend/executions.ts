import { agencyApiClient } from '@/lib/api/clientInstances';
import { toAgentRun, toRunSessionSummary } from '@/lib/api/backend/agentTransforms';
import { currentUserHeaders } from '@/lib/api/backend/identity';
import { backendRoutes } from '@/lib/api/backend/routes';
import type {
  ApprovalRequestPayload,
  AgentRun,
  CreateExecutionPayload,
  ExecutionApprovalRequest,
  ExecutionContextUsageResponse,
  ExecutionEventRecord,
  ExecutionDetailResponse,
  ExecutionArtifact,
  ExecutionRecord,
  ExecutionUsageResponse,
  ExecutionWaitRecord,
} from '@/types/runtime';
import type { CrudListResponse } from '@/types/api';
import type { AuthUser } from '@/types/auth';

export interface ExecutionListQuery {
  limit?: number;
  offset?: number;
  status?: string;
  workflow_id?: string;
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
  listExecutions(user?: AuthUser, internalApiKey?: string | null, query: ExecutionListQuery = {}) {
    return agencyApiClient.get<CrudListResponse<ExecutionRecord>>(backendRoutes.executions.list(), {
      headers: user ? currentUserHeaders(user, internalApiKey) : undefined,
      query: {
        limit: query.limit,
        offset: query.offset,
        status: query.status || undefined,
        workflow_id: query.workflow_id || undefined,
      },
    });
  },
  listActiveExecutions() {
    return agencyApiClient.get<CrudListResponse<ExecutionRecord>>(
      backendRoutes.executions.active()
    );
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
    return agencyApiClient.get<ExecutionDetailResponse>(
      backendRoutes.executions.byId(executionId),
      {
        headers: user ? currentUserHeaders(user, internalApiKey) : undefined,
      }
    );
  },
  updateExecution(executionId: string, patch: Record<string, unknown>) {
    return agencyApiClient.put<ExecutionRecord>(backendRoutes.executions.byId(executionId), patch);
  },
  startExecution(executionId: string) {
    return agencyApiClient.post<Record<string, unknown>>(
      backendRoutes.executions.start(executionId),
      {}
    );
  },
  pauseExecution(executionId: string, user?: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.post<Record<string, unknown>>(
      backendRoutes.executions.pause(executionId),
      {},
      {
        headers: user ? currentUserHeaders(user, internalApiKey) : undefined,
      }
    );
  },
  resumeExecution(executionId: string, user?: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.post<Record<string, unknown>>(
      backendRoutes.executions.resume(executionId),
      {},
      {
        headers: user ? currentUserHeaders(user, internalApiKey) : undefined,
      }
    );
  },
  retryExecutionTask(
    executionId: string,
    taskId: string,
    reason?: string,
    user?: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.post<Record<string, unknown>>(
      backendRoutes.executions.retryTask(executionId, taskId),
      { reason },
      {
        headers: user ? currentUserHeaders(user, internalApiKey) : undefined,
      }
    );
  },
  resumeExecutionFromCheckpoint(
    executionId: string,
    reason?: string,
    user?: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.post<Record<string, unknown>>(
      backendRoutes.executions.resumeFromCheckpoint(executionId),
      { reason },
      {
        headers: user ? currentUserHeaders(user, internalApiKey) : undefined,
      }
    );
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
  approveExecution(
    executionId: string,
    payload: ApprovalRequestPayload,
    user?: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.post<Record<string, unknown>>(
      backendRoutes.executions.approve(executionId),
      payload,
      {
        headers: user ? currentUserHeaders(user, internalApiKey) : undefined,
      }
    );
  },
  rejectExecution(
    executionId: string,
    payload: ApprovalRequestPayload,
    user?: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.post<Record<string, unknown>>(
      backendRoutes.executions.reject(executionId),
      payload,
      {
        headers: user ? currentUserHeaders(user, internalApiKey) : undefined,
      }
    );
  },
  listExecutionEvents(
    executionId: string,
    afterSequence = 0,
    eventTypes: string[] = [],
    user?: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.get<CrudListResponse<ExecutionEventRecord>>(
      backendRoutes.executions.events(executionId),
      {
        query: {
          after_sequence: afterSequence,
          event_type: eventTypes.length > 0 ? eventTypes : undefined,
        },
        headers: user ? currentUserHeaders(user, internalApiKey) : undefined,
      }
    );
  },
  listExecutionApprovals(executionId: string) {
    return agencyApiClient.get<CrudListResponse<ExecutionApprovalRequest>>(
      backendRoutes.executions.approvals(executionId)
    );
  },
  listExecutionWaits(executionId: string, status?: string) {
    return agencyApiClient.get<CrudListResponse<ExecutionWaitRecord>>(
      backendRoutes.executions.waits(executionId),
      { query: { status: status || undefined } }
    );
  },
  resolveExecutionWait(
    executionId: string,
    waitId: string,
    payload: {
      resolution_key: string;
      resolution_payload?: Record<string, unknown>;
      status?: 'resolved' | 'expired' | 'cancelled';
      resume?: boolean;
    }
  ) {
    return agencyApiClient.post<Record<string, unknown>>(
      backendRoutes.executions.resolveWait(executionId, waitId),
      payload
    );
  },
  getExecutionUsage(executionId: string) {
    return agencyApiClient.get<ExecutionUsageResponse>(backendRoutes.executions.usage(executionId));
  },
  getExecutionContextUsage(executionId: string) {
    return agencyApiClient.get<ExecutionContextUsageResponse>(
      backendRoutes.executions.contextUsage(executionId)
    );
  },
  listExecutionArtifacts(executionId: string, user?: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<CrudListResponse<ExecutionArtifact>>(
      backendRoutes.executions.artifacts(executionId),
      {
        headers: user ? currentUserHeaders(user, internalApiKey) : undefined,
      }
    );
  },
  streamArtifactImages(executionId: string, user?: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<Response>(
      backendRoutes.executions.artifactImagesStream(executionId),
      {
        cache: 'no-store',
        headers: {
          ...(user ? currentUserHeaders(user, internalApiKey) : {}),
          Accept: 'multipart/x-mixed-replace',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Connection: 'keep-alive',
        },
        responseType: 'raw',
      }
    );
  },
  streamExecutionEvents(
    executionId: string,
    afterSequence = 0,
    user?: AuthUser,
    internalApiKey?: string | null
  ) {
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
  replyToHumanLoop(
    executionId: string,
    reply: string,
    user?: AuthUser,
    internalApiKey?: string | null
  ) {
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
