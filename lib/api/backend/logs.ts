import { executionsApi } from '@/lib/api/backend/executions';
import { observabilityApi } from '@/lib/api/backend/observability';
import type { CrudListResponse } from '@/types/api';
import type { ExecutionEventRecord, ExecutionTimelineResponse } from '@/types/runtime';

export const logsApi = {
  listRunEvents(
    runId: string,
    afterSequence = 0,
    eventTypes: string[] = []
  ): Promise<CrudListResponse<ExecutionEventRecord>> {
    return executionsApi.listExecutionEvents(runId, afterSequence, eventTypes);
  },
  getRunTimeline(runId: string): Promise<ExecutionTimelineResponse> {
    return observabilityApi.getExecutionTimeline(runId);
  },
};
