import { appApiClient } from '@/lib/api';
import { toolsApi, workflowsApi } from '@/lib/api/backend';
import {
  extractWorkflowInputs,
} from '@/lib/workflows/executionPayload';
import { toolDefinitionsToWorkflowToolOptions } from '@/lib/workflows/toolOptions';
import type {
  ExecutionHost,
  WorkflowAgentFormData,
  WorkflowDefinition,
  WorkflowEditorFormData,
  WorkflowExecutionStartPayload,
  WorkflowRunInputs,
  WorkflowRunStatus,
  WorkflowTaskFormData,
  WorkflowToolOption,
  WorkflowWorkspaceDetail,
} from '@/types/workflows';
import type { User } from '@/types/users';

interface WorkflowMutationResponse {
  message?: string;
  data: WorkflowDefinition;
  status: number;
}

interface WorkflowRunResponse {
  status?: string;
  process_id: string;
  output?: string;
}

export const listOwnedWorkflows = async (): Promise<WorkflowDefinition[]> => {
  const { workflows } = await appApiClient.get<{ workflows: WorkflowDefinition[] }>('/api/workflows', {
    cache: 'no-store',
  });
  return workflows;
};

export const getWorkflowDetail = async (id: string): Promise<WorkflowWorkspaceDetail> => {
  return appApiClient.get<WorkflowWorkspaceDetail>(`/api/workflows/${id}`, {
    cache: 'no-store',
  });
};

export const getWorkflowInputs = async (id: string): Promise<string[]> => {
  const workflow = await workflowsApi.getWorkflow(id);
  return extractWorkflowInputs(workflow);
};

export const getWorkflowPreview = async (id: string): Promise<WorkflowDefinition> => {
  return workflowsApi.getWorkflow(id);
};

export const deleteWorkflow = async (id: string): Promise<void> => {
  await appApiClient.delete<{ status?: number }>(`/api/workflows/${id}`);
};

export const addWorkflowAgent = async (id: string, updateAgent: WorkflowAgentFormData) => {
  return appApiClient.post<WorkflowAgentFormData>(`/api/workflows/${id}/agents`, updateAgent);
};

export const updateWorkflowAgent = async (workflowId: string, payload: WorkflowAgentFormData) => {
  return appApiClient.put<WorkflowAgentFormData>(`/api/workflows/${workflowId}/agents`, payload);
};
export const editWorkflowAgent = updateWorkflowAgent;

export const deleteWorkflowAgent = async (workflowId: string, agentId: string) => {
  return appApiClient.delete<{ message?: string; status?: number }>(
    `/api/workflows/${workflowId}/agents`,
    {
      body: { agentId },
    }
  );
};

export const addWorkflowTask = async (id: string, tasks: WorkflowTaskFormData) => {
  return appApiClient.post<WorkflowTaskFormData>(`/api/workflows/${id}/tasks`, tasks);
};

export const updateWorkflowTask = async (workflowId: string, payload: WorkflowTaskFormData) => {
  return appApiClient.put<WorkflowTaskFormData>(`/api/workflows/${workflowId}/tasks`, payload);
};

export const deleteWorkflowTask = async (workflowId: string, taskId: string) => {
  return appApiClient.delete<{ message?: string; status?: number }>(
    `/api/workflows/${workflowId}/tasks`,
    {
      body: { taskId },
    }
  );
};

export const updateWorkflow = async (id: string, payload: WorkflowEditorFormData) => {
  return appApiClient.put<{ msg: string; status: number }>(`/api/workflows/${id}`, payload);
};
export const editWorkflow = updateWorkflow;

export const createWorkflow = async (data: WorkflowEditorFormData): Promise<WorkflowMutationResponse> => {
  return appApiClient.post<WorkflowMutationResponse>('/api/workflows', data);
};

export const startWorkflowById = async (
  id: string,
  inputs: WorkflowRunInputs,
  taskOrder: string[] | null,
  agentConfigs?: WorkflowExecutionStartPayload['agentConfigs'],
  runtimeAdapterId?: string | null,
  executionHost?: ExecutionHost | null
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

export const getWorkflowToolOptions = async (): Promise<WorkflowToolOption[]> => {
  const response = await toolsApi.listTools();
  return toolDefinitionsToWorkflowToolOptions(response.items);
};

export const uploadToS3 = async (file: File, s3Key: string): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('s3Key', s3Key);

  const result = await appApiClient.post<{ data: string; message?: string }>('/api/file', formData, {
    headers: {
      Accept: 'application/json',
    },
  });

  return result.data;
};

export const getS3DownloadURL = async (s3Key: string): Promise<string> => {
  const result = await appApiClient.get<{ data: string; message?: string }>(`/api/file`, {
    query: { key: s3Key },
  });

  return result.data;
};

export const getUsersByEmail = async (email: string): Promise<User[]> => {
  return [];
};
