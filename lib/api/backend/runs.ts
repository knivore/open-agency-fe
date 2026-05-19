import { appApiClient } from '@/lib/api';
import { executionsApi } from '@/lib/api/backend/executions';
import { workflowsApi } from '@/lib/api/backend/workflows';
import { toAgentRun } from '@/lib/api/backend/agentTransforms';
import { normalizeRunStatus } from '@/lib/workflows/runFormatting';
import type { AgentRun, CreateExecutionPayload, ExecutionRecord } from '@/lib/api/backend/types';
import type { ExecutionHost } from '@/types/workflows';

interface WorkflowRunProxyResponse {
  execution?: ExecutionRecord;
  run?: AgentRun;
  run_id?: string;
  process_id: string;
  status?: string;
}

export const runsApi = {
  listRuns() {
    return executionsApi.listAgentRuns();
  },
  listActiveRuns() {
    return executionsApi.listActiveAgentRuns();
  },
  getRun(runId: string) {
    return executionsApi.getAgentRun(runId);
  },
  async createWorkflowRun(payload: CreateExecutionPayload): Promise<AgentRun> {
    const created = await executionsApi.createExecution(payload);
    return {
      id: created.id,
      workflowId: created.workflow_id ?? payload.workflowId,
      runtimeAdapterId: created.runtime_adapter_id ?? payload.runtimeAdapterId ?? null,
      status: normalizeRunStatus(created.status),
      triggerType: created.trigger_type ?? 'manual',
      createdAt: created.created_at ?? null,
      startedAt: created.started_at ?? null,
      completedAt: created.completed_at ?? null,
      createdBy: created.created_by ?? null,
      error: created.error ?? null,
    };
  },
  async executeWorkflow(
    workflowId: string,
    runtimeAdapterId?: string | null,
    executionHost?: ExecutionHost | null
  ): Promise<AgentRun> {
    const response = await appApiClient.post<WorkflowRunProxyResponse>(`/api/workflows/run/${workflowId}`, {
      inputs: {},
      taskOrder: [],
      ...(runtimeAdapterId ? { runtimeAdapterId } : {}),
      ...(executionHost ? { executionHost } : {}),
    });

    if (response.run) {
      return response.run;
    }

    if (response.execution) {
      return toAgentRun(response.execution);
    }

    return {
      id: response.run_id ?? response.process_id,
      workflowId,
      runtimeAdapterId: runtimeAdapterId ?? null,
      status: normalizeRunStatus(response.status),
      triggerType: 'manual',
      createdAt: null,
      startedAt: null,
      completedAt: null,
      createdBy: null,
      error: null,
    };
  },
  listRunsForWorkflow(workflowId: string) {
    return workflowsApi.listWorkflowRuns(workflowId);
  },
  pauseRun(runId: string) {
    return executionsApi.pauseExecution(runId);
  },
  resumeRun(runId: string) {
    return executionsApi.resumeExecution(runId);
  },
  cancelRun(runId: string) {
    return executionsApi.cancelExecution(runId);
  },
};
