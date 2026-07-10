import { beforeEach, describe, expect, it, vi } from 'vitest';
import { physicalDevicesApi } from '@/lib/api/backend/physicalDevices';
import { ApiError } from '@/lib/api/errors';

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock('@/lib/api/clientInstances', () => ({
  appApiClient: {
    get: getMock,
  },
}));

describe('physicalDevicesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists canonical physical devices through the FE proxy route', async () => {
    getMock.mockResolvedValue({ count: 0, items: [] });

    await physicalDevicesApi.listDevices({
      type: 'iot_actuator',
      capability: 'turn_on_off',
      room: ' Kitchen ',
      lifecycleStatus: 'active',
      online: true,
    });

    expect(getMock).toHaveBeenCalledWith('/api/physical-devices', {
      query: {
        type: 'iot_actuator',
        capability: 'turn_on_off',
        room: 'Kitchen',
        zone: undefined,
        owner_id: undefined,
        location_id: undefined,
        lifecycle_status: 'active',
        online: true,
      },
    });
  });

  it('reads physical device audit and event bus health contracts', async () => {
    getMock.mockResolvedValueOnce({ status: 'ok' }).mockResolvedValueOnce({
      provider: 'in_memory',
      connected: true,
      subscribers: 1,
    });

    await physicalDevicesApi.getAudit({
      staleAfterSeconds: 600,
      includeDevices: true,
      limit: 10,
    });
    await physicalDevicesApi.getEventBusHealth();

    expect(getMock).toHaveBeenCalledWith('/api/physical-devices/audit', {
      query: {
        stale_after_seconds: 600,
        include_devices: true,
        limit: 10,
      },
    });
    expect(getMock).toHaveBeenCalledWith('/api/physical-events/health');
  });

  it('reads selected-device state, commands, and events through FE proxy routes', async () => {
    getMock
      .mockResolvedValueOnce({ device_id: 'device/1', online: true })
      .mockResolvedValueOnce({ count: 0, items: [] })
      .mockResolvedValueOnce({ count: 0, items: [] });

    await physicalDevicesApi.getState('device/1');
    await physicalDevicesApi.listCommands('device/1');
    await physicalDevicesApi.listEvents('device/1');

    expect(getMock).toHaveBeenCalledWith('/api/physical-devices/device%2F1/state');
    expect(getMock).toHaveBeenCalledWith('/api/physical-devices/device%2F1/commands');
    expect(getMock).toHaveBeenCalledWith('/api/physical-devices/device%2F1/events');
  });

  it('reports physical-devices module availability from backend capabilities', async () => {
    getMock.mockResolvedValueOnce({
      modules: {
        physical_devices: {
          available: true,
          status: 'available',
        },
      },
    });

    await expect(physicalDevicesApi.getAvailability()).resolves.toEqual({
      available: true,
      source: 'capabilities',
    });
    expect(getMock).toHaveBeenCalledWith('/api/capabilities');
  });

  it('reports unavailable from backend capabilities without probing routes', async () => {
    getMock.mockResolvedValueOnce({
      modules: {
        physical_devices: {
          available: false,
          status: 'restricted',
        },
      },
    });

    await expect(physicalDevicesApi.getAvailability()).resolves.toEqual({
      available: false,
      reason: 'Physical-devices backend module is unavailable.',
      source: 'capabilities',
      status: 'restricted',
    });
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it('treats missing physical-devices module capabilities as unavailable without probing routes', async () => {
    getMock.mockResolvedValueOnce({
      modules: {
        smart_home: {
          available: true,
          status: 'available',
        },
      },
    });

    await expect(physicalDevicesApi.getAvailability()).resolves.toEqual({
      available: false,
      reason: 'Physical-devices backend module is unavailable.',
      source: 'missing_capabilities_module',
    });
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to event bus health for older backends without module capabilities', async () => {
    getMock
      .mockResolvedValueOnce({ name: 'agency-runtime', version: '1.0' })
      .mockResolvedValueOnce({ provider: 'in_memory', connected: true, subscribers: 1 });

    await expect(physicalDevicesApi.getAvailability()).resolves.toEqual({
      available: true,
      source: 'event_bus_health',
    });
    expect(getMock).toHaveBeenNthCalledWith(1, '/api/capabilities');
    expect(getMock).toHaveBeenNthCalledWith(2, '/api/physical-events/health');
  });

  it('reports unavailable instead of throwing when fallback probing finds absent modules', async () => {
    getMock
      .mockRejectedValueOnce(new ApiError({ status: 404, message: 'Not found' }))
      .mockRejectedValueOnce(new ApiError({ status: 404, message: 'Not found' }));

    await expect(physicalDevicesApi.getAvailability()).resolves.toEqual({
      available: false,
      reason: 'Physical-devices backend module is unavailable.',
      source: 'event_bus_health',
      status: 404,
    });
  });
});
