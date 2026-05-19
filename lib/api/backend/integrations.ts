import { connectorRegistryApi } from '@/lib/api/backend/connectorRegistry';
import { credentialsApi } from '@/lib/api/backend/credentials';
import { providersApi } from '@/lib/api/backend/providers';
import { toolsApi } from '@/lib/api/backend/tools';
import { isApiError } from '@/lib/api/errors';
import { buildIntegrationCatalog } from '@/lib/integrations/catalog';
import type { CrudListResponse, IntegrationCatalogPayload } from '@/lib/api/backend/types';

function isCrudListResponse<T>(value: unknown): value is CrudListResponse<T> {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && 'items' in value
    && Array.isArray((value as { items?: unknown }).items)
  );
}

function normalizeListResponse<T>(value: CrudListResponse<T> | T[] | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (isCrudListResponse<T>(value)) {
    return value.items;
  }

  return [];
}

async function loadOptional<T>(loader: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    if (isApiError(error)) {
      if ([0, 400, 401, 403, 404, 405, 500, 501, 502, 503, 504].includes(error.status)) {
        return fallback;
      }
    }
    return fallback;
  }
}

export const integrationsApi = {
  async listCategories(): Promise<IntegrationCatalogPayload> {
    const [credentials, registry, modelProviders, modelProfiles, tools, mcpServers, runtimeAdapters] = await Promise.all([
      loadOptional(() => credentialsApi.listCredentials(), { items: [] }),
      connectorRegistryApi.listCategories(),
      loadOptional(() => providersApi.listModelProviders(), { items: [] }),
      loadOptional(() => providersApi.listModelProfiles(), { items: [] }),
      loadOptional(() => toolsApi.listTools(), { items: [] }),
      loadOptional(() => providersApi.listMcpServers(), { items: [] }),
      loadOptional(() => providersApi.listRuntimeAdapters(), { items: [] }),
    ]);

    return {
      categories: buildIntegrationCatalog({
        credentials: normalizeListResponse(credentials),
        registryCategories: registry.categories,
        modelProviders: normalizeListResponse(modelProviders),
        modelProfiles: normalizeListResponse(modelProfiles),
        tools: normalizeListResponse(tools),
        mcpServers: normalizeListResponse(mcpServers),
        runtimeAdapters: normalizeListResponse(runtimeAdapters),
      }),
      registrySource: registry.source,
      registryUpdatedAt: registry.updatedAt ?? null,
    };
  },
};
