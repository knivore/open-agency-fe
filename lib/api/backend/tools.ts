import { agencyApiClient } from '@/lib/api';
import { backendRoutes } from '@/lib/api/backend/routes';
import type {
  CrudListResponse,
  DeleteResponse,
  ToolContract,
  ToolContractListResponse,
  ToolDefinition,
  ToolRunResponse,
  ToolTestPayload,
  ToolValidationPayload,
} from '@/lib/api/backend/types';

export const toolsApi = {
  listTools() {
    return agencyApiClient.get<CrudListResponse<ToolDefinition>>(backendRoutes.tools.list());
  },
  getTool(toolId: string) {
    return agencyApiClient.get<ToolDefinition>(backendRoutes.tools.byId(toolId));
  },
  createTool(payload: Record<string, unknown>) {
    return agencyApiClient.post<ToolDefinition>(backendRoutes.tools.create(), payload);
  },
  updateTool(toolId: string, patch: Record<string, unknown>) {
    return agencyApiClient.put<ToolDefinition>(backendRoutes.tools.byId(toolId), patch);
  },
  deleteTool(toolId: string) {
    return agencyApiClient.delete<DeleteResponse>(backendRoutes.tools.byId(toolId));
  },
  validateTool(payload: ToolValidationPayload) {
    return agencyApiClient.post<Record<string, unknown>>(backendRoutes.tools.validate(), payload);
  },
  testTool(toolId: string, payload: ToolTestPayload) {
    return agencyApiClient.post<Record<string, unknown>>(backendRoutes.tools.test(toolId), payload);
  },
  listToolContracts() {
    return agencyApiClient.get<ToolContractListResponse>(backendRoutes.tools.contracts(), {
      cache: 'no-store',
    });
  },
  getToolContract(toolName: string) {
    return agencyApiClient.get<ToolContract>(backendRoutes.tools.contractByName(toolName), {
      cache: 'no-store',
    });
  },
  runTool(toolName: string, payload: unknown) {
    return agencyApiClient.post<ToolRunResponse>(backendRoutes.tools.run(toolName), payload);
  },
};
