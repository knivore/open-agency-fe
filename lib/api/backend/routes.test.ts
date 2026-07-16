import { describe, expect, it } from 'vitest';

import { backendRoutes } from '@/lib/api/backend/routes';

function collectDynamicRouteBuilders(
  value: unknown,
  prefix = 'backendRoutes'
): Array<[string, (...args: string[]) => string]> {
  if (!value || typeof value !== 'object') {
    return [];
  }

  return Object.entries(value).flatMap(([key, child]) => {
    const name = `${prefix}.${key}`;
    if (typeof child === 'function' && child.length > 0) {
      return [[name, child as (...args: string[]) => string]];
    }
    return collectDynamicRouteBuilders(child, name);
  });
}

describe('backend route path segments', () => {
  it('encodes control characters in every dynamic route builder', () => {
    const attackerSegment = 'x/../../../users/sync?role=admin#fragment\\host';

    for (const [name, buildRoute] of collectDynamicRouteBuilders(backendRoutes)) {
      const route = buildRoute(...Array.from({ length: buildRoute.length }, () => attackerSegment));

      expect(route, name).not.toContain(attackerSegment);
      expect(route, name).not.toMatch(/[?#\\]/);
      expect(new URL(route, 'http://backend.internal').pathname, name).toContain('%2F');
    }
  });

  it('rejects standalone URL dot segments before URL construction', () => {
    expect(() => backendRoutes.profile.credentialById('..')).toThrow(/dot segments/);
    expect(() => backendRoutes.workflows.byId('.')).toThrow(/dot segments/);
  });

  it('keeps a crafted credential provider inside the intended backend route', () => {
    const route = backendRoutes.profile.validateConnectorCredential('x/../../../users/sync?x=');
    const resolved = new URL(route, 'http://backend.internal');

    expect(resolved.pathname).toBe(
      '/credentials/connectors/x%2F..%2F..%2F..%2Fusers%2Fsync%3Fx%3D/validate'
    );
    expect(resolved.search).toBe('');
  });
});
