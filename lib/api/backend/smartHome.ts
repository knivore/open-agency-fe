import { appApiClient } from '@/lib/api/clientInstances';
import { backendCapabilitiesApi } from '@/lib/api/backend/capabilities';
import { ApiError, isApiError } from '@/lib/api/errors';
import {
  getModuleAvailabilityFromCapabilities,
  isOptionalModuleUnavailableError,
  moduleUnavailableFromProbeError,
} from '@/lib/api/backend/moduleAvailability';

export interface SmartHomeEntitySummary {
  entity_id: string;
  state: string;
  attributes?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SmartHomeEntityListPayload {
  count: number;
  items: SmartHomeEntitySummary[];
}

export function isSmartHomeModuleUnavailable(error: unknown): error is ApiError {
  return isApiError(error) && [404, 405, 501, 503].includes(error.status);
}

export const smartHomeApi = {
  async getAvailability() {
    try {
      const capabilities = await backendCapabilitiesApi.getCapabilities();
      const availability = getModuleAvailabilityFromCapabilities(capabilities, 'smart_home');
      if (availability) {
        return availability;
      }
    } catch (error) {
      if (!isOptionalModuleUnavailableError(error)) {
        throw error;
      }
    }

    // Older Agency backends do not expose /capabilities.modules yet, so keep a
    // cheap entity-list probe as the compatibility fallback.
    try {
      await this.listEntities();
      return { available: true as const, source: 'entities_probe' as const };
    } catch (error) {
      const unavailable = moduleUnavailableFromProbeError(error, 'smart_home');
      if (unavailable) {
        return { ...unavailable, source: 'entities_probe' as const };
      }
      throw error;
    }
  },
  listEntities(params?: { domain?: string; roomName?: string }) {
    const query = new URLSearchParams();
    if (params?.domain?.trim()) {
      query.set('domain', params.domain.trim());
    }
    if (params?.roomName?.trim()) {
      query.set('room_name', params.roomName.trim());
    }
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return appApiClient.get<SmartHomeEntityListPayload>(`/api/smart-home/entities${suffix}`);
  },
};
