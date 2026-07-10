import { agencyApiClient } from '@/lib/api/clientInstances';
import { isApiError } from '@/lib/api/errors';
import { backendRoutes } from '@/lib/api/backend/routes';
import { buildPlannedIntegrationRegistryPayload } from '@/lib/integrations/registryPayload';
import type {
  IntegrationRegistryCategoryDefinition,
  IntegrationRegistryPayload,
  IntegrationRegistrySource,
} from '@/types/integrations';

export interface ConnectorRegistryResponse {
  categories: IntegrationRegistryCategoryDefinition[];
  source: IntegrationRegistrySource;
  updatedAt?: string | null;
}

function isRegistryPayload(value: unknown): value is IntegrationRegistryPayload {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'categories' in value &&
    Array.isArray((value as { categories?: unknown }).categories)
  );
}

export const connectorRegistryApi = {
  async listCategories(): Promise<ConnectorRegistryResponse> {
    try {
      const response = await agencyApiClient.get<
        IntegrationRegistryCategoryDefinition[] | IntegrationRegistryPayload
      >(backendRoutes.connectorRegistry.categories());
      return {
        categories: isRegistryPayload(response) ? response.categories : response,
        source: 'backend',
        updatedAt: isRegistryPayload(response) ? (response.updated_at ?? null) : null,
      };
    } catch (error) {
      if (isApiError(error) && [404, 405, 501].includes(error.status)) {
        const fallback = buildPlannedIntegrationRegistryPayload();
        return {
          categories: fallback.categories,
          source: 'fallback',
          updatedAt: fallback.updated_at ?? null,
        };
      }
      throw error;
    }
  },
};
