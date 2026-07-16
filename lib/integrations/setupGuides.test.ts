import { describe, expect, it } from 'vitest';
import { plannedIntegrationRegistry } from '@/lib/integrations/registry';
import { integrationSetupGuides } from '@/lib/integrations/setupGuides';

describe('integrationSetupGuides', () => {
  const catalogBackendKeys = plannedIntegrationRegistry.flatMap((category) =>
    Object.values(category.providers).map((provider) => provider.backendKey)
  );

  it('covers every connector in the planned integration catalog', () => {
    expect(Object.keys(integrationSetupGuides).sort()).toEqual(catalogBackendKeys.sort());
  });

  it.each(catalogBackendKeys)('%s has actionable, source-backed setup guidance', (backendKey) => {
    const guide = integrationSetupGuides[backendKey];

    expect(guide.prerequisites?.length).toBeGreaterThan(0);
    expect(guide.steps?.length).toBeGreaterThanOrEqual(3);
    expect(guide.verification?.length).toBeGreaterThan(0);
    expect(guide.troubleshooting?.length).toBeGreaterThan(0);
    expect(guide.resources?.length).toBeGreaterThan(0);
    expect(guide.resources?.every((resource) => resource.url.startsWith('https://'))).toBe(true);
    expect(guide.reviewedAt).toBe('2026-07-14');
    expect(guide.completionSignal).toMatch(/Open Agency verifies.+metadata API/i);
    expect(JSON.stringify(guide)).not.toMatch(/runtime secret mirror|mirrored runtime secret/i);
  });

  it('documents credentialless setup without inventing a Wikipedia secret', () => {
    expect(integrationSetupGuides.wikipedia.fields.every((field) => !field.secret)).toBe(true);
  });
});
