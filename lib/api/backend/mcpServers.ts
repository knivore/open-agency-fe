import { agencyApiClient } from '@/lib/api';
import { backendRoutes } from '@/lib/api/backend/routes';
import type { CrudListResponse, DeleteResponse, MCPServerDefinition } from '@/lib/api/backend/types';

export const mcpServersApi = {
  listMcpServers() {
    return agencyApiClient.get<CrudListResponse<MCPServerDefinition>>(backendRoutes.mcpServers.list());
  },
  getMcpServer(serverId: string) {
    return agencyApiClient.get<MCPServerDefinition>(backendRoutes.mcpServers.byId(serverId));
  },
  createMcpServer(payload: Record<string, unknown>) {
    return agencyApiClient.post<MCPServerDefinition>(backendRoutes.mcpServers.create(), payload);
  },
  updateMcpServer(serverId: string, patch: Record<string, unknown>) {
    return agencyApiClient.put<MCPServerDefinition>(backendRoutes.mcpServers.byId(serverId), patch);
  },
  deleteMcpServer(serverId: string) {
    return agencyApiClient.delete<DeleteResponse>(backendRoutes.mcpServers.byId(serverId));
  },
  discover(serverId?: string) {
    return agencyApiClient.post<Record<string, unknown>>(backendRoutes.mcpServers.discover(), serverId ? { serverId } : {});
  },
};

