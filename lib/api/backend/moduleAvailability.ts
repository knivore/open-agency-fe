import { ApiError, isApiError } from '@/lib/api/errors';
import type { BackendCapabilitiesPayload } from '@/lib/api/backend/capabilities';

export type BackendOptionalModuleKey = 'smart_home' | 'physical_devices';

export interface BackendModuleAvailability {
  available: boolean;
  reason?: string | null;
  status?: string | number;
  source: 'capabilities' | 'missing_capabilities_module' | 'fallback_probe';
}

const DEFAULT_UNAVAILABLE_REASONS: Record<BackendOptionalModuleKey, string> = {
  smart_home: 'Smart-home backend module is unavailable.',
  physical_devices: 'Physical-devices backend module is unavailable.',
};

export function getModuleAvailabilityFromCapabilities(
  capabilities: BackendCapabilitiesPayload,
  moduleKey: BackendOptionalModuleKey
): BackendModuleAvailability | null {
  if (!capabilities.modules) {
    return null;
  }

  const moduleCapabilities = capabilities.modules[moduleKey];
  if (!moduleCapabilities) {
    return {
      available: false,
      reason: DEFAULT_UNAVAILABLE_REASONS[moduleKey],
      source: 'missing_capabilities_module',
    };
  }

  if (moduleCapabilities.available === false) {
    return {
      available: false,
      reason: moduleCapabilities.reason ?? DEFAULT_UNAVAILABLE_REASONS[moduleKey],
      status: moduleCapabilities.status,
      source: 'capabilities',
    };
  }

  return { available: true, source: 'capabilities' };
}

export function moduleUnavailableFromProbeError(
  error: unknown,
  moduleKey: BackendOptionalModuleKey,
  unavailableStatuses = [404, 405, 501, 503]
): BackendModuleAvailability | null {
  if (!isApiError(error) || !unavailableStatuses.includes(error.status)) {
    return null;
  }

  return {
    available: false,
    reason: DEFAULT_UNAVAILABLE_REASONS[moduleKey],
    status: error.status,
    source: 'fallback_probe',
  };
}

export function isOptionalModuleUnavailableError(error: unknown): error is ApiError {
  return isApiError(error) && [404, 405, 501, 503].includes(error.status);
}
