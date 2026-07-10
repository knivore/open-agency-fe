import { plannedIntegrationRegistry } from '@/lib/integrations/registry';
import type { IntegrationRegistryPayload } from '@/types/integrations';

export function buildPlannedIntegrationRegistryPayload(): IntegrationRegistryPayload {
  return {
    categories: plannedIntegrationRegistry,
    updated_at: null,
  };
}
