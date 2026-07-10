import { beforeEach, describe, expect, it, vi } from 'vitest';
import { smartHomeApi } from '@/lib/api/backend/smartHome';
import { ApiError } from '@/lib/api/errors';

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock('@/lib/api/clientInstances', () => ({
  appApiClient: {
    get: getMock,
  },
}));

describe('smartHomeApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists smart-home entities through the FE proxy route', async () => {
    getMock.mockResolvedValue({ count: 0, items: [] });

    await smartHomeApi.listEntities({ domain: ' light ', roomName: ' Kitchen ' });

    expect(getMock).toHaveBeenCalledWith('/api/smart-home/entities?domain=light&room_name=Kitchen');
  });

  it('reports smart-home module availability from backend capabilities', async () => {
    getMock.mockResolvedValueOnce({
      modules: {
        smart_home: {
          available: true,
          status: 'available',
        },
      },
    });

    await expect(smartHomeApi.getAvailability()).resolves.toEqual({
      available: true,
      source: 'capabilities',
    });
    expect(getMock).toHaveBeenCalledWith('/api/capabilities');
  });

  it('reports unavailable from backend capabilities without probing routes', async () => {
    getMock.mockResolvedValueOnce({
      modules: {
        smart_home: {
          available: false,
          status: 'disabled',
          reason: 'Smart-home module disabled by backend configuration.',
        },
      },
    });

    await expect(smartHomeApi.getAvailability()).resolves.toEqual({
      available: false,
      reason: 'Smart-home module disabled by backend configuration.',
      source: 'capabilities',
      status: 'disabled',
    });
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it('treats missing smart-home module capabilities as unavailable without probing routes', async () => {
    getMock.mockResolvedValueOnce({
      modules: {
        physical_devices: {
          available: true,
          status: 'available',
        },
      },
    });

    await expect(smartHomeApi.getAvailability()).resolves.toEqual({
      available: false,
      reason: 'Smart-home backend module is unavailable.',
      source: 'missing_capabilities_module',
    });
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to entity probing for older backends without module capabilities', async () => {
    getMock
      .mockResolvedValueOnce({ name: 'agency-runtime', version: '1.0' })
      .mockResolvedValueOnce({ count: 0, items: [] });

    await expect(smartHomeApi.getAvailability()).resolves.toEqual({
      available: true,
      source: 'entities_probe',
    });
    expect(getMock).toHaveBeenNthCalledWith(1, '/api/capabilities');
    expect(getMock).toHaveBeenNthCalledWith(2, '/api/smart-home/entities');
  });

  it('reports unavailable instead of throwing when fallback probing finds absent modules', async () => {
    getMock
      .mockRejectedValueOnce(new ApiError({ status: 404, message: 'Not found' }))
      .mockRejectedValueOnce(new ApiError({ status: 503, message: 'Module disabled' }));

    await expect(smartHomeApi.getAvailability()).resolves.toEqual({
      available: false,
      reason: 'Smart-home backend module is unavailable.',
      source: 'entities_probe',
      status: 503,
    });
  });
});
