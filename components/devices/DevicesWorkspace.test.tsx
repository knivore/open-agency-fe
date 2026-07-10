import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DevicesWorkspace from '@/components/devices/DevicesWorkspace';

const { physicalDevicesApi, smartHomeApi } = vi.hoisted(() => ({
  physicalDevicesApi: {
    getAvailability: vi.fn(),
    listDevices: vi.fn(),
    getAudit: vi.fn(),
    getEventBusHealth: vi.fn(),
    getState: vi.fn(),
    listCommands: vi.fn(),
    listEvents: vi.fn(),
  },
  smartHomeApi: {
    getAvailability: vi.fn(),
    listEntities: vi.fn(),
  },
}));

vi.mock('@/lib/api/backend/physicalDevices', () => ({
  physicalDevicesApi,
  isPhysicalDevicesModuleUnavailable: (error: { status?: number } | null | undefined) =>
    Boolean(error && [404, 405, 501, 503].includes(Number(error.status))),
}));

vi.mock('@/lib/api/backend/smartHome', () => ({
  smartHomeApi,
  isSmartHomeModuleUnavailable: (error: { status?: number } | null | undefined) =>
    Boolean(error && [404, 405, 501, 503].includes(Number(error.status))),
}));

function renderWorkspace() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DevicesWorkspace />
    </QueryClientProvider>
  );
}

describe('DevicesWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    physicalDevicesApi.getAvailability.mockResolvedValue({
      available: true,
      source: 'capabilities',
    });
    smartHomeApi.getAvailability.mockResolvedValue({
      available: true,
      source: 'capabilities',
    });
    physicalDevicesApi.listDevices.mockResolvedValue({ count: 0, items: [] });
    physicalDevicesApi.getAudit.mockResolvedValue({
      status: 'ok',
      summary: {},
      bus_health: { provider: 'in_memory', connected: true, subscribers: 0 },
      adapter_health: {},
      effective_policy: {},
      restricted_devices: [],
      recent_problem_commands: [],
      recent_events: [],
      devices: [],
    });
    physicalDevicesApi.getEventBusHealth.mockResolvedValue({
      provider: 'in_memory',
      connected: true,
      subscribers: 0,
    });
    physicalDevicesApi.getState.mockResolvedValue({ device_id: 'device-1', online: true });
    physicalDevicesApi.listCommands.mockResolvedValue({ count: 0, items: [] });
    physicalDevicesApi.listEvents.mockResolvedValue({ count: 0, items: [] });
    smartHomeApi.listEntities.mockResolvedValue({ count: 0, items: [] });
  });

  it('renders Smart Home devices when Physical Devices is unavailable', async () => {
    physicalDevicesApi.getAvailability.mockResolvedValue({
      available: false,
      reason: 'Physical Devices module package is not installed.',
      source: 'missing_capabilities_module',
    });
    smartHomeApi.listEntities.mockResolvedValue({
      count: 1,
      items: [
        {
          entity_id: 'light.kitchen_counter',
          state: 'on',
          attributes: {
            friendly_name: 'Kitchen Counter',
            area_name: 'Kitchen',
            device_class: 'light',
            brightness: 180,
          },
        },
      ],
    });

    renderWorkspace();

    expect(await screen.findByText('Devices')).toBeInTheDocument();
    expect((await screen.findAllByText('Kitchen Counter')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Smart Home').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Physical Devices not installed').length).toBeGreaterThan(0);
    expect(screen.getByText(/Smart Home devices can still be inspected/i)).toBeInTheDocument();
    expect(physicalDevicesApi.listDevices).not.toHaveBeenCalled();
    expect(physicalDevicesApi.getAudit).not.toHaveBeenCalled();
    expect(physicalDevicesApi.getEventBusHealth).not.toHaveBeenCalled();
    expect(smartHomeApi.listEntities).toHaveBeenCalledWith({ roomName: undefined });
  });

  it('filters Smart Home devices by capability or domain on the client', async () => {
    physicalDevicesApi.getAvailability.mockResolvedValue({
      available: false,
      source: 'missing_capabilities_module',
    });
    smartHomeApi.listEntities.mockResolvedValue({
      count: 2,
      items: [
        {
          entity_id: 'light.kitchen_counter',
          state: 'on',
          attributes: { friendly_name: 'Kitchen Counter', area_name: 'Kitchen' },
        },
        {
          entity_id: 'sensor.hall_temperature',
          state: '24',
          attributes: { friendly_name: 'Hall Temperature', area_name: 'Hallway' },
        },
      ],
    });

    renderWorkspace();

    expect((await screen.findAllByText('Kitchen Counter')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Hall Temperature').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('Filter devices by capability'), {
      target: { value: 'sensor' },
    });

    await waitFor(() => {
      expect(screen.queryAllByText('Kitchen Counter')).toHaveLength(0);
    });
    expect(screen.getAllByText('Hall Temperature').length).toBeGreaterThan(0);
  });
});
