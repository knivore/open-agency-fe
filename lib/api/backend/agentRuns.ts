import { agentsApi } from '@/lib/api/backend/agents';
import { executionsApi } from '@/lib/api/backend/executions';
import type { AgentRun, ExecutionArtifact } from '@/types/runtime';
import type { CrudListResponse } from '@/types/api';

export const agentRunsApi = {
  listRuns(): Promise<AgentRun[]> {
    return executionsApi.listAgentRuns();
  },
  listActiveRuns(): Promise<AgentRun[]> {
    return executionsApi.listActiveAgentRuns();
  },
  getRun(runId: string): Promise<AgentRun> {
    return executionsApi.getAgentRun(runId);
  },
  listRunsForAgent(agentId: string): Promise<AgentRun[]> {
    return agentsApi.listAgentRuns(agentId);
  },
  listArtifacts(runId: string): Promise<CrudListResponse<ExecutionArtifact>> {
    return executionsApi.listExecutionArtifacts(runId);
  },
};
