import { agencyApiClient } from '@/lib/api/clientInstances';
import { toRunSessionDetail, toRunSessionSummary } from '@/lib/api/backend/agentTransforms';
import { backendRoutes } from '@/lib/api/backend/routes';
import { executionsApi } from '@/lib/api/backend/executions';
import type { CrudListResponse } from '@/types/api';
import type {
  ExecutionApprovalRequest,
  ExecutionContextUsageResponse,
  ExecutionArtifact,
  ExecutionDetailResponse,
  ExecutionEventRecord,
  ExecutionRecord,
  ExecutionUsageResponse,
  ExecutionWaitRecord,
  RunLogEntry,
  RunSessionDetail,
  RunSessionSummary,
} from '@/types/runtime';

export const runSessionsApi = {
  async listRunSessions(): Promise<RunSessionSummary[]> {
    const response = await agencyApiClient.get<CrudListResponse<ExecutionRecord>>(
      backendRoutes.executions.list()
    );
    return response.items.map(toRunSessionSummary);
  },
  async listActiveRunSessions(): Promise<RunSessionSummary[]> {
    const response = await agencyApiClient.get<CrudListResponse<ExecutionRecord>>(
      backendRoutes.executions.active()
    );
    return response.items.map(toRunSessionSummary);
  },
  async getRunSession(runId: string): Promise<RunSessionDetail> {
    const response = await agencyApiClient.get<ExecutionDetailResponse>(
      backendRoutes.executions.byId(runId)
    );
    return toRunSessionDetail(response);
  },
  listRunEvents(
    runId: string,
    afterSequence = 0,
    eventTypes: string[] = []
  ): Promise<CrudListResponse<ExecutionEventRecord>> {
    return executionsApi.listExecutionEvents(runId, afterSequence, eventTypes);
  },
  listRunApprovals(runId: string): Promise<CrudListResponse<ExecutionApprovalRequest>> {
    return executionsApi.listExecutionApprovals(runId);
  },
  listRunWaits(runId: string): Promise<CrudListResponse<ExecutionWaitRecord>> {
    return executionsApi.listExecutionWaits(runId, 'pending');
  },
  getRunUsage(runId: string): Promise<ExecutionUsageResponse> {
    return executionsApi.getExecutionUsage(runId);
  },
  getRunContextUsage(runId: string): Promise<ExecutionContextUsageResponse> {
    return executionsApi.getExecutionContextUsage(runId);
  },
  listRunArtifacts(runId: string): Promise<CrudListResponse<ExecutionArtifact>> {
    return executionsApi.listExecutionArtifacts(runId);
  },
  getRunLogs(runId: string, tailLines = 200): Promise<RunLogEntry> {
    return agencyApiClient.get<RunLogEntry>(backendRoutes.executions.runtimeLogs(runId), {
      query: { tail_lines: tailLines },
    });
  },
};
