import { agencyApiClient } from '@/lib/api';
import { backendRoutes } from '@/lib/api/backend/routes';
import { toAgent, toAgentRun } from '@/lib/api/backend/agentTransforms';
import type { Agent, AgentDefinition, AgentRun, CrudListResponse, DeleteResponse, ExecutionRecord } from '@/lib/api/backend/types';

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
    return agencyApiClient.get<CrudListResponse<ExecutionRecord>>(backendRoutes.agents.executions(agentId));
  },
  async listAgentRuns(agentId: string): Promise<AgentRun[]> {
    const response = await this.listAgentExecutions(agentId);
    return response.items.map(toAgentRun);
  },
};
