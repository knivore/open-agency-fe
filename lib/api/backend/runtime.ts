import { agentRunsApi } from '@/lib/api/backend/agentRuns';
import { runsApi } from '@/lib/api/backend/runs';
import { runtimeAdaptersApi } from '@/lib/api/backend/runtimeAdapters';
import type { AgentRun, RuntimeAdapterDefinition } from '@/types/runtime';
import type { CrudListResponse } from '@/types/api';
import type { ExecutionHost } from '@/types/workflows';

export const runtimeApi = {
  listAdapters(): Promise<CrudListResponse<RuntimeAdapterDefinition>> {
    return runtimeAdaptersApi.listRuntimeAdapters();
  },
  listActiveRuns(): Promise<AgentRun[]> {
    return agentRunsApi.listActiveRuns();
  },
  getRunStatus(runId: string): Promise<AgentRun> {
    return agentRunsApi.getRun(runId);
  },
  executeWorkflow(
    workflowId: string,
    runtimeAdapterId?: string | null,
    executionHost?: ExecutionHost | null
  ) {
    return runsApi.executeWorkflow(workflowId, runtimeAdapterId, executionHost);
  },
};
