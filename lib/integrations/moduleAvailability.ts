import { agencyApiClient } from '@/lib/api/clientInstances';
import type { BackendCapabilitiesPayload } from '@/lib/api/backend/capabilities';
import { getModuleAvailabilityFromCapabilities } from '@/lib/api/backend/moduleAvailability';

export interface IntegrationModuleAvailability {
  smartHomeAvailable: boolean;
  smartHomeReason?: string | null;
  smartHomeHiddenRoutePrefixes?: string[];
  smartHomeHiddenToolNames?: string[];
  physicalDevicesAvailable: boolean;
  physicalDevicesReason?: string | null;
  physicalDevicesHiddenRoutePrefixes?: string[];
  physicalDevicesHiddenToolNames?: string[];
}

export async function getIntegrationModuleAvailability(): Promise<IntegrationModuleAvailability> {
  try {
    const capabilities = await agencyApiClient.get<BackendCapabilitiesPayload>('/capabilities');
    const smartHome = getModuleAvailabilityFromCapabilities(capabilities, 'smart_home');
    const physicalDevices = getModuleAvailabilityFromCapabilities(capabilities, 'physical_devices');

    return {
      smartHomeAvailable: smartHome?.available !== false,
      smartHomeReason:
        smartHome?.available === false
          ? (smartHome.reason ?? 'Smart Home is disabled on the paired backend.')
          : undefined,
      smartHomeHiddenRoutePrefixes:
        capabilities.modules?.smart_home?.hiddenWhenUnavailable?.routePrefixes ?? [],
      smartHomeHiddenToolNames:
        capabilities.modules?.smart_home?.hiddenWhenUnavailable?.toolNames ?? [],
      physicalDevicesAvailable: physicalDevices?.available !== false,
      physicalDevicesReason:
        physicalDevices?.available === false
          ? (physicalDevices.reason ?? 'Physical Devices is disabled on the paired backend.')
          : undefined,
      physicalDevicesHiddenRoutePrefixes:
        capabilities.modules?.physical_devices?.hiddenWhenUnavailable?.routePrefixes ?? [],
      physicalDevicesHiddenToolNames:
        capabilities.modules?.physical_devices?.hiddenWhenUnavailable?.toolNames ?? [],
    };
  } catch {
    // Older or restricted backends may not expose /capabilities. Keep the
    // direct setup surfaces available so the backend can report the next step.
    return {
      smartHomeAvailable: true,
      physicalDevicesAvailable: true,
    };
  }
}
