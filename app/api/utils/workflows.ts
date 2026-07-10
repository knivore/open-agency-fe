import { appApiClient } from '@/lib/api/clientInstances';
import type {
  ExecutionHost,
  WorkflowExecutionStartPayload,
  WorkflowRunInputs,
  WorkflowRunStatus,
} from '@/types/workflows';

interface WorkflowRunResponse {
  status?: string;
  process_id: string;
  output?: string;
}

export const startWorkflowById = async (
  id: string,
  inputs: WorkflowRunInputs,
  taskOrder: string[] | null,
  agentConfigs?: WorkflowExecutionStartPayload['agentConfigs'],
  runtimeAdapterId?: string | null,
  executionHost?: ExecutionHost | null,
  goalId?: string | null
): Promise<WorkflowRunResponse> => {
  const bodyData: Record<string, unknown> = {
    inputs: inputs || {},
    taskOrder: taskOrder || [],
  };

  if (agentConfigs) {
    bodyData.agentConfigs = agentConfigs;
  }

  if (runtimeAdapterId) {
    bodyData.runtimeAdapterId = runtimeAdapterId;
  }

  if (executionHost) {
    bodyData.executionHost = executionHost;
  }

  if (goalId) {
    bodyData.goalId = goalId;
  }

  return appApiClient.post<WorkflowRunResponse>(`/api/workflows/run/${id}`, bodyData);
};

export const getWorkflowRunStatus = async (process_id: string): Promise<WorkflowRunStatus> => {
  return appApiClient.get<WorkflowRunStatus>(`/api/workflows/process/${process_id}`, {
    cache: 'no-store',
  });
};

export const stopWorkflowRun = async (process_id: string) => {
  return appApiClient.post<{ message?: string; result?: string | null }>(
    `/api/workflows/stop/${process_id}`
  );
};

export const sendWorkflowHumanReply = async (reply: string, process_id: string) => {
  return appApiClient.post<{ message?: string; data?: unknown; status?: number }>(
    `/api/workflows/process/${process_id}/hitl`,
    { reply, process_id }
  );
};
