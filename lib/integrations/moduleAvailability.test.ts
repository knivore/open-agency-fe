import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getIntegrationModuleAvailability } from '@/lib/integrations/moduleAvailability';

const { agencyGet } = vi.hoisted(() => ({
  agencyGet: vi.fn(),
}));

vi.mock('@/lib/api/clientInstances', () => ({
  agencyApiClient: {
    get: agencyGet,
  },
}));

describe('integration module availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns backend availability and disabled reasons', async () => {
    agencyGet.mockResolvedValueOnce({
      modules: {
        smart_home: {
          available: false,
          reason: 'Smart-home module disabled by backend configuration.',
          hiddenWhenUnavailable: {
            routePrefixes: ['/api/smart-home'],
            toolNames: ['home_assistant.turn_on'],
          },
        },
        physical_devices: {
          available: true,
          status: 'available',
        },
      },
    });

    await expect(getIntegrationModuleAvailability()).resolves.toEqual({
      smartHomeAvailable: false,
      smartHomeReason: 'Smart-home module disabled by backend configuration.',
      smartHomeHiddenRoutePrefixes: ['/api/smart-home'],
      smartHomeHiddenToolNames: ['home_assistant.turn_on'],
      physicalDevicesAvailable: true,
      physicalDevicesHiddenRoutePrefixes: [],
      physicalDevicesHiddenToolNames: [],
      physicalDevicesReason: undefined,
    });
  });

  it('keeps direct setup surfaces available for older backends without capabilities', async () => {
    agencyGet.mockRejectedValueOnce(new Error('missing capabilities route'));

    await expect(getIntegrationModuleAvailability()).resolves.toEqual({
      smartHomeAvailable: true,
      physicalDevicesAvailable: true,
    });
  });

  it('treats missing module capabilities as unavailable', async () => {
    agencyGet.mockResolvedValueOnce({
      modules: {
        physical_devices: {
          available: true,
          status: 'available',
        },
      },
    });

    await expect(getIntegrationModuleAvailability()).resolves.toMatchObject({
      smartHomeAvailable: false,
      smartHomeReason: 'Smart-home backend module is unavailable.',
      physicalDevicesAvailable: true,
    });
  });

  it('returns Physical Devices disabled details', async () => {
    agencyGet.mockResolvedValueOnce({
      modules: {
        smart_home: {
          available: true,
          status: 'available',
        },
        physical_devices: {
          available: false,
          reason: 'Physical Devices module disabled by backend configuration.',
          hiddenWhenUnavailable: {
            routePrefixes: ['/api/physical-devices'],
            toolNames: ['agency.physical.command'],
          },
        },
      },
    });

    await expect(getIntegrationModuleAvailability()).resolves.toMatchObject({
      smartHomeAvailable: true,
      physicalDevicesAvailable: false,
      physicalDevicesReason: 'Physical Devices module disabled by backend configuration.',
      physicalDevicesHiddenRoutePrefixes: ['/api/physical-devices'],
      physicalDevicesHiddenToolNames: ['agency.physical.command'],
    });
  });
});
