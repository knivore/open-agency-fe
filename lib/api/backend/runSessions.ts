import { agencyApiClient } from '@/lib/api';
import { toRunSessionDetail, toRunSessionSummary } from '@/lib/api/backend/agentTransforms';
import { backendRoutes } from '@/lib/api/backend/routes';
import { executionsApi } from '@/lib/api/backend/executions';
import type {
  CrudListResponse,
  ExecutionArtifact,
  ExecutionDetailResponse,
  ExecutionEventRecord,
  ExecutionRecord,
  RunLogEntry,
  RunSessionDetail,
  RunSessionSummary,
} from '@/lib/api/backend/types';

export const runSessionsApi = {
  async listRunSessions(): Promise<RunSessionSummary[]> {
    const response = await agencyApiClient.get<CrudListResponse<ExecutionRecord>>(backendRoutes.executions.list());
    return response.items.map(toRunSessionSummary);
  },
  async listActiveRunSessions(): Promise<RunSessionSummary[]> {
    const response = await agencyApiClient.get<CrudListResponse<ExecutionRecord>>(backendRoutes.executions.active());
    return response.items.map(toRunSessionSummary);
  },
  async getRunSession(runId: string): Promise<RunSessionDetail> {
    const response = await agencyApiClient.get<ExecutionDetailResponse>(backendRoutes.executions.byId(runId));
    return toRunSessionDetail(response);
  },
  listRunEvents(runId: string, afterSequence = 0): Promise<CrudListResponse<ExecutionEventRecord>> {
    return executionsApi.listExecutionEvents(runId, afterSequence);
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
