import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DiagnosticsWorkspace from './DiagnosticsWorkspace';

const { backendCapabilitiesApi, executionsApi, graphReadApi, physicalDevicesApi, smartHomeApi } =
  vi.hoisted(() => ({
    backendCapabilitiesApi: {
      getCapabilities: vi.fn(),
    },
    executionsApi: {
      listExecutions: vi.fn(),
    },
    graphReadApi: {
      getStatus: vi.fn(),
    },
    physicalDevicesApi: {
      getAvailability: vi.fn(),
    },
    smartHomeApi: {
      getAvailability: vi.fn(),
    },
  }));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    status: 'authenticated',
    data: {
      user: {
        id: 'user-1',
        email: 'owner@example.com',
        name: 'Owner One',
        authMode: 'nextauth',
      },
    },
  }),
}));

vi.mock('@/lib/api/backend/capabilities', () => ({
  backendCapabilitiesApi,
}));

vi.mock('@/lib/api/backend/executions', () => ({
  executionsApi,
}));

vi.mock('@/lib/api/backend/graphRead', () => ({
  graphReadApi,
}));

vi.mock('@/lib/api/backend/physicalDevices', () => ({
  physicalDevicesApi,
}));

vi.mock('@/lib/api/backend/smartHome', () => ({
  smartHomeApi,
}));

function renderWorkspace() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DiagnosticsWorkspace />
    </QueryClientProvider>
  );
}

describe('DiagnosticsWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();

    backendCapabilitiesApi.getCapabilities.mockResolvedValue({
      name: 'Agency Backend',
      version: '1.2.3',
      modules: {
        physical_devices: { available: false, status: 'disabled' },
        smart_home: { available: true, status: 'ready' },
      },
    });
    graphReadApi.getStatus.mockResolvedValue({
      available: true,
      enabled: true,
      source: 'neo4j',
    });
    executionsApi.listExecutions.mockResolvedValue({
      items: [
        {
          id: 'run-1',
          workflow_id: 'workflow-1',
          status: 'failed',
          error: 'Tool failed',
        },
        {
          id: 'run-2',
          workflow_id: 'workflow-1',
          status: 'running',
        },
        {
          id: 'run-3',
          workflow_id: 'workflow-2',
          status: 'completed',
        },
      ],
    });
    physicalDevicesApi.getAvailability.mockResolvedValue({
      available: false,
      reason: 'Physical-devices backend module is unavailable.',
      source: 'capabilities',
      status: 'disabled',
    });
    smartHomeApi.getAvailability.mockResolvedValue({
      available: true,
      source: 'capabilities',
    });
  });

  it('keeps diagnostics hidden until the profile preference is enabled', async () => {
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('Diagnostics are hidden')).toBeInTheDocument();
    });
    expect(backendCapabilitiesApi.getCapabilities).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Enable Diagnostics' }));

    await waitFor(() => {
      expect(screen.getByText('Operational Signals')).toBeInTheDocument();
    });
    expect(window.localStorage.getItem('agency:user-preferences:v1')).toContain(
      '"showDiagnostics":true'
    );
  });

  it('renders site-wide diagnostics when the user has opted in', async () => {
    window.localStorage.setItem(
      'agency:user-preferences:v1',
      JSON.stringify({ showDiagnostics: true })
    );

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('1.2.3')).toBeInTheDocument();
    });

    expect(screen.getByText('Operational Signals')).toBeInTheDocument();
    expect(screen.getAllByText('neo4j').length).toBeGreaterThan(0);
    expect(screen.getByText('3 total')).toBeInTheDocument();
    expect(screen.getByText('1 failed, 1 running')).toBeInTheDocument();
    expect(screen.getByText('2 workflows, 1 failed, 1 with error details')).toBeInTheDocument();
    expect(screen.getByText('Graph Intelligence Roadmap')).toBeInTheDocument();
    expect(screen.getByText('Incident clustering across workflows and errors')).toBeInTheDocument();
  });
});
