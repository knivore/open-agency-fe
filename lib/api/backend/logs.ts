import { executionsApi } from '@/lib/api/backend/executions';
import { observabilityApi } from '@/lib/api/backend/observability';
import type { CrudListResponse, ExecutionEventRecord, ExecutionTimelineResponse } from '@/lib/api/backend/types';

export const logsApi = {
  listRunEvents(runId: string, afterSequence = 0): Promise<CrudListResponse<ExecutionEventRecord>> {
    return executionsApi.listExecutionEvents(runId, afterSequence);
  },
  getRunTimeline(runId: string): Promise<ExecutionTimelineResponse> {
    return observabilityApi.getExecutionTimeline(runId);
  },
};
