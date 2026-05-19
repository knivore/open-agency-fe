import { describe, expect, it } from 'vitest';
import { plannedIntegrationRegistry } from '@/lib/integrations/registry';
import { buildPlannedIntegrationRegistryPayload } from '@/lib/integrations/registryPayload';

describe('buildPlannedIntegrationRegistryPayload', () => {
  it('returns the current planned registry in canonical payload form', () => {
    const payload = buildPlannedIntegrationRegistryPayload();

    expect(payload.updated_at).toBeNull();
    expect(payload.categories).toEqual(plannedIntegrationRegistry);
  });
});
