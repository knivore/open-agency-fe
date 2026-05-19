import { mcpServersApi } from '@/lib/api/backend/mcpServers';
import { modelProfilesApi, modelProvidersApi } from '@/lib/api/backend/models';
import { runtimeAdaptersApi } from '@/lib/api/backend/runtimeAdapters';
import type {
  CrudListResponse,
  MCPServerDefinition,
  ModelProfileDefinition,
  ModelProviderDefinition,
  RuntimeAdapterDefinition,
} from '@/lib/api/backend/types';

export const providersApi = {
  listModelProviders(): Promise<CrudListResponse<ModelProviderDefinition>> {
    return modelProvidersApi.listProviders();
  },
  updateModelProvider(providerId: string, patch: Record<string, unknown>) {
    return modelProvidersApi.updateProvider(providerId, patch);
  },
  testModelProvider(providerId: string) {
    return modelProvidersApi.testProvider(providerId);
  },
  listModelProfiles(): Promise<CrudListResponse<ModelProfileDefinition>> {
    return modelProfilesApi.listProfiles();
  },
  updateModelProfile(profileId: string, patch: Record<string, unknown>) {
    return modelProfilesApi.updateProfile(profileId, patch);
  },
  testModelProfile(profileId: string) {
    return modelProfilesApi.testProfile(profileId);
  },
  listMcpServers(): Promise<CrudListResponse<MCPServerDefinition>> {
    return mcpServersApi.listMcpServers();
  },
  updateMcpServer(serverId: string, patch: Record<string, unknown>) {
    return mcpServersApi.updateMcpServer(serverId, patch);
  },
  discoverMcpServer(serverId?: string) {
    return mcpServersApi.discover(serverId);
  },
  listRuntimeAdapters(): Promise<CrudListResponse<RuntimeAdapterDefinition>> {
    return runtimeAdaptersApi.listRuntimeAdapters();
  },
};
