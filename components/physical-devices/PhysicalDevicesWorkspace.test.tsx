import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PhysicalDevicesWorkspace from '@/components/physical-devices/PhysicalDevicesWorkspace';
import { ApiError } from '@/lib/api/errors';

const physicalDevicesApi = vi.hoisted(() => ({
  getAvailability: vi.fn(),
  listDevices: vi.fn(),
  getAudit: vi.fn(),
  getEventBusHealth: vi.fn(),
  getState: vi.fn(),
  listCommands: vi.fn(),
  listEvents: vi.fn(),
}));

vi.mock('@/lib/api/backend/physicalDevices', () => ({
  physicalDevicesApi,
  isPhysicalDevicesModuleUnavailable: (error: { status?: number } | null | undefined) =>
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
      <PhysicalDevicesWorkspace />
    </QueryClientProvider>
  );
}

describe('PhysicalDevicesWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    physicalDevicesApi.getAvailability.mockResolvedValue({
      available: true,
      source: 'capabilities',
    });
  });

  it('renders device, audit, and bus health summaries from physical-devices APIs', async () => {
    physicalDevicesApi.listDevices.mockResolvedValue({
      count: 1,
      items: [
        {
          id: 'device-light-1',
          name: 'Kitchen Light',
          type: 'iot_actuator',
          vendor: 'home_assistant',
          room: 'Kitchen',
          capabilities: ['turn_on_off', 'set_brightness'],
          status: 'online',
          lifecycle_status: 'active',
        },
      ],
    });
    physicalDevicesApi.getAudit.mockResolvedValue({
      status: 'ok',
      summary: {
        total_devices: 1,
        offline_devices: 0,
        stale_devices: 0,
        pending_approval: 1,
      },
      bus_health: { provider: 'in_memory', connected: true, subscribers: 1 },
      adapter_health: {
        home_assistant: { status: 'healthy', mapped_devices: 12 },
      },
      effective_policy: {
        require_confirmation_for_risky_commands: true,
        blocked_rooms: ['Nursery'],
      },
      restricted_devices: [{ device_id: 'device-lock-1', status: 'online' }],
      recent_problem_commands: [
        {
          command_id: 'command-1',
          device_name: 'Front Lock',
          status: 'rejected',
          policy_reason: 'Command requires confirmation',
        },
        {
          command_id: 'command-2',
          device_name: 'Hallway Speaker',
          status: 'pending_approval',
          command_type: 'speak',
          requested_by: 'agent:operator',
        },
      ],
      recent_events: [],
      devices: [],
    });
    physicalDevicesApi.getEventBusHealth.mockResolvedValue({
      provider: 'in_memory',
      connected: true,
      subscribers: 1,
    });
    physicalDevicesApi.getState.mockResolvedValue({
      device_id: 'device-light-1',
      online: true,
      battery_level: 88,
      network_status: 'wifi',
      current_activity: 'on',
      sensor_values: { brightness: 70 },
      last_telemetry_at: '2026-06-26T00:00:00Z',
    });
    physicalDevicesApi.listCommands.mockResolvedValue({
      count: 1,
      items: [
        {
          command_id: 'device-command-1',
          device_id: 'device-light-1',
          command_type: 'turn_on',
          priority: 'normal',
          requested_by: 'workflow:test',
          status: 'completed',
          created_at: '2026-06-26T00:01:00Z',
        },
        {
          command_id: 'device-command-2',
          device_id: 'device-light-1',
          command_type: 'set_brightness',
          priority: 'high',
          requested_by: 'workflow:test',
          status: 'pending_approval',
          created_at: '2026-06-26T00:03:00Z',
        },
      ],
    });
    physicalDevicesApi.listEvents.mockResolvedValue({
      count: 1,
      items: [
        {
          event_id: 'device-event-1',
          device_id: 'device-light-1',
          event_type: 'home.light.changed',
          source: 'home_assistant',
          timestamp: '2026-06-26T00:02:00Z',
        },
      ],
    });

    renderWorkspace();

    expect(await screen.findByText('Physical Devices')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText('Kitchen Light').length).toBeGreaterThan(0);
    });
    expect(screen.getByText('turn_on_off, set_brightness')).toBeInTheDocument();
    expect(screen.getByText('Front Lock')).toBeInTheDocument();
    expect(screen.getByText('Command requires confirmation')).toBeInTheDocument();
    expect(screen.getByText('Bus in_memory')).toBeInTheDocument();
    expect(screen.getByText('Approval Queue')).toBeInTheDocument();
    expect(screen.getByText('1 awaiting human approval')).toBeInTheDocument();
    expect(screen.getAllByText('Hallway Speaker').length).toBeGreaterThan(0);
    expect(screen.getByText('Adapter Health')).toBeInTheDocument();
    expect(screen.getByText('home assistant')).toBeInTheDocument();
    expect(screen.getByText('Effective Policy')).toBeInTheDocument();
    expect(screen.getByText('require confirmation for risky commands')).toBeInTheDocument();
    expect(await screen.findByText('Current State')).toBeInTheDocument();
    expect(screen.getByText('Commands')).toBeInTheDocument();
    expect(screen.getByText('Pending / failed')).toBeInTheDocument();
    expect(screen.getByText('1 / 0')).toBeInTheDocument();
    expect(screen.getByText('Latest event')).toBeInTheDocument();
    expect(screen.getByText('88%')).toBeInTheDocument();
    expect(screen.getByText('turn_on')).toBeInTheDocument();
    expect(screen.getAllByText('set_brightness').length).toBeGreaterThan(0);
    expect(screen.getAllByText('home.light.changed').length).toBeGreaterThan(0);
  });

  it('passes room and capability filters to the physical device API', async () => {
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

    renderWorkspace();

    fireEvent.change(await screen.findByLabelText('Filter devices by room'), {
      target: { value: 'Entry' },
    });
    fireEvent.change(screen.getByLabelText('Filter devices by capability'), {
      target: { value: 'lock_unlock' },
    });

    await waitFor(() => {
      expect(physicalDevicesApi.listDevices).toHaveBeenCalledWith({
        room: 'Entry',
        capability: 'lock_unlock',
      });
    });
    expect(screen.getByText(/Filter by room or capability/)).toBeInTheDocument();
  });

  it('shows an unavailable state when the paired backend does not expose physical-devices routes', async () => {
    const unavailable = new ApiError({ status: 404, message: 'Not found' });
    physicalDevicesApi.listDevices.mockRejectedValue(unavailable);
    physicalDevicesApi.getAudit.mockRejectedValue(unavailable);
    physicalDevicesApi.getEventBusHealth.mockRejectedValue(unavailable);
    physicalDevicesApi.getState.mockResolvedValue({ device_id: 'device-1', online: true });
    physicalDevicesApi.listCommands.mockResolvedValue({ count: 0, items: [] });
    physicalDevicesApi.listEvents.mockResolvedValue({ count: 0, items: [] });

    renderWorkspace();

    expect(await screen.findByText('Physical-World Module Not Paired')).toBeInTheDocument();
    expect(screen.getByText('Module unavailable')).toBeInTheDocument();
    expect(screen.getByText(/Other Open Agency pages and tools remain usable/)).toBeInTheDocument();
  });

  it('does not call physical-devices routes when capabilities say the module is unavailable', async () => {
    physicalDevicesApi.getAvailability.mockResolvedValue({
      available: false,
      reason: 'Physical Devices module package is not installed.',
      source: 'missing_capabilities_module',
    });

    renderWorkspace();

    expect(await screen.findByText('Physical-World Module Not Paired')).toBeInTheDocument();
    expect(
      screen.getByText('Physical Devices module package is not installed.')
    ).toBeInTheDocument();
    expect(physicalDevicesApi.listDevices).not.toHaveBeenCalled();
    expect(physicalDevicesApi.getAudit).not.toHaveBeenCalled();
    expect(physicalDevicesApi.getEventBusHealth).not.toHaveBeenCalled();
  });
});
