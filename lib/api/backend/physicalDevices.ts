import { appApiClient } from '@/lib/api/clientInstances';
import { backendCapabilitiesApi } from '@/lib/api/backend/capabilities';
import { ApiError, isApiError } from '@/lib/api/errors';
import {
  getModuleAvailabilityFromCapabilities,
  isOptionalModuleUnavailableError,
  moduleUnavailableFromProbeError,
} from '@/lib/api/backend/moduleAvailability';

export interface PhysicalDevice {
  id: string;
  name: string;
  type: string;
  vendor?: string | null;
  model?: string | null;
  owner_id?: string | null;
  location_id?: string | null;
  parent_location_id?: string | null;
  room?: string | null;
  zone?: string | null;
  capabilities: string[];
  status: string;
  lifecycle_status: string;
  metadata?: Record<string, unknown>;
  last_seen_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PhysicalDeviceListParams {
  type?: string;
  capability?: string;
  room?: string;
  zone?: string;
  ownerId?: string;
  locationId?: string;
  lifecycleStatus?: string;
  online?: boolean;
}

export interface PhysicalDeviceListPayload {
  count: number;
  items: PhysicalDevice[];
}

export interface PhysicalDeviceState {
  device_id: string;
  online: boolean;
  battery_level?: number | null;
  network_status?: string | null;
  current_activity?: string | null;
  sensor_values?: Record<string, unknown>;
  last_telemetry_at?: string | null;
}

export interface PhysicalDeviceCommand {
  command_id: string;
  device_id: string;
  command_type: string;
  payload?: Record<string, unknown>;
  priority: string;
  requested_by: string;
  correlation_id?: string | null;
  status: string;
  created_at: string;
  expires_at?: string | null;
}

export interface PhysicalDeviceEvent {
  event_id: string;
  device_id: string;
  event_type: string;
  source: string;
  payload?: Record<string, unknown>;
  correlation_id?: string | null;
  timestamp: string;
}

export interface PhysicalDeviceCommandListPayload {
  count: number;
  items: PhysicalDeviceCommand[];
}

export interface PhysicalDeviceEventListPayload {
  count: number;
  items: PhysicalDeviceEvent[];
}

export interface PhysicalEventBusHealth {
  provider: string;
  connected: boolean;
  subscribers: number;
}

export interface PhysicalDeviceAuditParams {
  staleAfterSeconds?: number;
  includeDevices?: boolean;
  limit?: number;
}

export interface PhysicalDeviceAuditPayload {
  status: string;
  summary: Record<string, unknown>;
  bus_health: PhysicalEventBusHealth;
  adapter_health: Record<string, unknown>;
  effective_policy: Record<string, unknown>;
  restricted_devices: Array<Record<string, unknown>>;
  recent_problem_commands: Array<Record<string, unknown>>;
  recent_events: Array<Record<string, unknown>>;
  devices: Array<Record<string, unknown>>;
}

export function isPhysicalDevicesModuleUnavailable(error: unknown): error is ApiError {
  return isApiError(error) && [404, 405, 501, 503].includes(error.status);
}

function cleanString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export const physicalDevicesApi = {
  listDevices(params: PhysicalDeviceListParams = {}) {
    return appApiClient.get<PhysicalDeviceListPayload>('/api/physical-devices', {
      query: {
        type: cleanString(params.type),
        capability: cleanString(params.capability),
        room: cleanString(params.room),
        zone: cleanString(params.zone),
        owner_id: cleanString(params.ownerId),
        location_id: cleanString(params.locationId),
        lifecycle_status: cleanString(params.lifecycleStatus),
        online: params.online,
      },
    });
  },
  getAudit(params: PhysicalDeviceAuditParams = {}) {
    return appApiClient.get<PhysicalDeviceAuditPayload>('/api/physical-devices/audit', {
      query: {
        stale_after_seconds: params.staleAfterSeconds,
        include_devices: params.includeDevices,
        limit: params.limit,
      },
    });
  },
  getEventBusHealth() {
    return appApiClient.get<PhysicalEventBusHealth>('/api/physical-events/health');
  },
  async getAvailability() {
    try {
      const capabilities = await backendCapabilitiesApi.getCapabilities();
      const availability = getModuleAvailabilityFromCapabilities(capabilities, 'physical_devices');
      if (availability) {
        return availability;
      }
    } catch (error) {
      if (!isOptionalModuleUnavailableError(error)) {
        throw error;
      }
    }

    // Older Agency backends do not expose /capabilities.modules yet, so keep the
    // physical event-bus probe as the compatibility fallback.
    try {
      await this.getEventBusHealth();
      return { available: true as const, source: 'event_bus_health' as const };
    } catch (error) {
      const unavailable = moduleUnavailableFromProbeError(error, 'physical_devices');
      if (unavailable) {
        return { ...unavailable, source: 'event_bus_health' as const };
      }
      throw error;
    }
  },
  getState(deviceId: string) {
    return appApiClient.get<PhysicalDeviceState>(
      `/api/physical-devices/${encodeURIComponent(deviceId)}/state`
    );
  },
  listCommands(deviceId: string) {
    return appApiClient.get<PhysicalDeviceCommandListPayload>(
      `/api/physical-devices/${encodeURIComponent(deviceId)}/commands`
    );
  },
  listEvents(deviceId: string) {
    return appApiClient.get<PhysicalDeviceEventListPayload>(
      `/api/physical-devices/${encodeURIComponent(deviceId)}/events`
    );
  },
};
