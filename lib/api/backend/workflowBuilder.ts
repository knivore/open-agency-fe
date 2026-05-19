import { agencyApiClient } from '@/lib/api';
import { backendRoutes } from '@/lib/api/backend/routes';

type WorkflowBuilderDraftType = 'tasks' | 'agents' | 'workflow';

interface WorkflowBuilderGenerateDraftPayload {
  draftType: WorkflowBuilderDraftType;
  conversationHistory?: string;
  latestInstruction?: string;
  latestTasks?: string;
  tasks?: Array<Record<string, unknown>>;
  agents?: Array<Record<string, unknown>>;
  modelProfileId?: string;
}

export const workflowBuilderApi = {
  generateDraft(payload: WorkflowBuilderGenerateDraftPayload) {
    return agencyApiClient.post<Record<string, unknown>>(backendRoutes.workflowBuilder.generateDraft(), {
      draft_type: payload.draftType,
      conversation_history: payload.conversationHistory,
      latest_instruction: payload.latestInstruction,
      latest_tasks: payload.latestTasks,
      tasks: payload.tasks,
      agents: payload.agents,
      model_profile_id: payload.modelProfileId,
    });
  },
  rewriteAgent(agent: Record<string, unknown>, modelProfileId?: string) {
    return agencyApiClient.post<{ data: Record<string, unknown> }>(
      backendRoutes.workflowBuilder.rewriteAgent(),
      {
        agent,
        model_profile_id: modelProfileId,
      }
    );
  },
  rewriteTask(task: Record<string, unknown>, modelProfileId?: string) {
    return agencyApiClient.post<{ data: Record<string, unknown> }>(
      backendRoutes.workflowBuilder.rewriteTask(),
      {
        task,
        model_profile_id: modelProfileId,
      }
    );
  },
};
