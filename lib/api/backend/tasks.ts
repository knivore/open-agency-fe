import { toTask } from '@/lib/api/backend/agentTransforms';
import { workflowsApi } from '@/lib/api/backend/workflows';
import type { Task } from '@/types/workflows';

export const tasksApi = {
  async listTasksForWorkflow(workflowId: string): Promise<Task[]> {
    const workflow = await workflowsApi.getWorkflow(workflowId);
    return (workflow.task_definitions ?? []).map(toTask);
  },
};
