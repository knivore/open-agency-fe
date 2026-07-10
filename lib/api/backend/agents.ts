import { agencyApiClient } from '@/lib/api/clientInstances';
import { backendRoutes } from '@/lib/api/backend/routes';
import { toAgent, toAgentRun } from '@/lib/api/backend/agentTransforms';
import type { Agent, AgentDefinition } from '@/types/agents';
import type { AgentRun, ExecutionRecord } from '@/types/runtime';
import type { CrudListResponse, DeleteResponse } from '@/types/api';
import type {
  AgentImportBatchCommitResult,
  AgentImportBatchPreviewResult,
  AgentImportCommitResult,
  AgentImportProposal,
} from '@/types/agents';

interface AgentImportPreviewPayload {
  markdownText?: string;
  sourceFilename?: string;
  sourceUrl?: string;
  useLlmNormalization?: boolean;
  llmNormalizationModelProfileId?: string | null;
}

interface AgentImportCommitPayload {
  proposal: AgentImportProposal;
  conflictStrategy?: 'create_only' | 'update_existing' | 'duplicate_as_new';
  approvedToolIds?: string[];
  approvedHandoffAgentIds?: string[];
  modelProfileId?: string | null;
  enabled?: boolean;
  useLlmNormalization?: boolean;
  llmNormalizationModelProfileId?: string | null;
}

type AgentImportBatchCommitItem = AgentImportCommitPayload;

export const agentsApi = {
  listAgents() {
    return agencyApiClient.get<CrudListResponse<AgentDefinition>>(backendRoutes.agents.list());
  },
  async listAgentCatalog(): Promise<Agent[]> {
    const response = await this.listAgents();
    return response.items.map(toAgent);
  },
  getAgent(agentId: string) {
    return agencyApiClient.get<AgentDefinition>(backendRoutes.agents.byId(agentId));
  },
  async getAgentCatalogItem(agentId: string): Promise<Agent> {
    return toAgent(await this.getAgent(agentId));
  },
  createAgent(payload: Record<string, unknown>) {
    return agencyApiClient.post<AgentDefinition>(backendRoutes.agents.create(), payload);
  },
  updateAgent(agentId: string, patch: Record<string, unknown>) {
    return agencyApiClient.put<AgentDefinition>(backendRoutes.agents.byId(agentId), patch);
  },
  deleteAgent(agentId: string) {
    return agencyApiClient.delete<DeleteResponse>(backendRoutes.agents.byId(agentId));
  },
  listAgentExecutions(agentId: string) {
    return agencyApiClient.get<CrudListResponse<ExecutionRecord>>(
      backendRoutes.agents.executions(agentId)
    );
  },
  async listAgentRuns(agentId: string): Promise<AgentRun[]> {
    const response = await this.listAgentExecutions(agentId);
    return response.items.map(toAgentRun);
  },
  previewAgentImport(payload: AgentImportPreviewPayload) {
    return agencyApiClient.post<AgentImportProposal>(backendRoutes.agents.importPreview(), {
      markdown_text: payload.markdownText,
      source_filename: payload.sourceFilename,
      source_url: payload.sourceUrl,
      use_llm_normalization: payload.useLlmNormalization ?? false,
      llm_normalization_model_profile_id: payload.llmNormalizationModelProfileId || null,
    });
  },
  previewAgentImportFile(file: File) {
    const formData = new FormData();
    formData.set('file', file);
    return agencyApiClient.post<AgentImportProposal>(
      backendRoutes.agents.importPreview(),
      formData
    );
  },
  previewAgentImportFiles(files: File[]) {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    return agencyApiClient.post<AgentImportBatchPreviewResult>(
      backendRoutes.agents.importBatchPreview(),
      formData
    );
  },
  commitAgentImport(payload: AgentImportCommitPayload) {
    return agencyApiClient.post<AgentImportCommitResult>(backendRoutes.agents.importCommit(), {
      proposal: payload.proposal,
      conflict_strategy: payload.conflictStrategy ?? 'create_only',
      approved_tool_ids: payload.approvedToolIds ?? [],
      approved_handoff_agent_ids: payload.approvedHandoffAgentIds ?? [],
      model_profile_id: payload.modelProfileId || null,
      enabled: payload.enabled ?? false,
      use_llm_normalization: payload.useLlmNormalization ?? false,
      llm_normalization_model_profile_id: payload.llmNormalizationModelProfileId || null,
    });
  },
  commitAgentImportBatch(items: AgentImportBatchCommitItem[]) {
    return agencyApiClient.post<AgentImportBatchCommitResult>(
      backendRoutes.agents.importBatchCommit(),
      {
        items: items.map((item) => ({
          proposal: item.proposal,
          conflict_strategy: item.conflictStrategy ?? 'create_only',
          approved_tool_ids: item.approvedToolIds ?? [],
          approved_handoff_agent_ids: item.approvedHandoffAgentIds ?? [],
          model_profile_id: item.modelProfileId || null,
          enabled: item.enabled ?? false,
          use_llm_normalization: item.useLlmNormalization ?? false,
          llm_normalization_model_profile_id: item.llmNormalizationModelProfileId || null,
        })),
      }
    );
  },
};
