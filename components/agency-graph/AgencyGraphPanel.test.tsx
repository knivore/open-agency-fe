import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import AgencyGraphPanel from './AgencyGraphPanel';

const authUser = {
  id: 'dev-user',
  name: 'Dev User',
  email: 'dev@example.com',
  image: null,
  accessToken: null,
  authMode: 'dev' as const,
};

const {
  expandNodeMock,
  getAgentNeighborhoodMock,
  getEntityNeighborhoodMock,
  getMemoryNeighborhoodMock,
  getNodeNeighborhoodMock,
  getRunNeighborhoodMock,
  getWorkflowNeighborhoodMock,
  getExecutionTimelineMock,
  listExecutionEventsMock,
  listExecutionsMock,
  listWorkflowsMock,
} = vi.hoisted(() => ({
  expandNodeMock: vi.fn(),
  getAgentNeighborhoodMock: vi.fn(),
  getEntityNeighborhoodMock: vi.fn(),
  getExecutionTimelineMock: vi.fn(),
  getMemoryNeighborhoodMock: vi.fn(),
  getNodeNeighborhoodMock: vi.fn(),
  getRunNeighborhoodMock: vi.fn(),
  getWorkflowNeighborhoodMock: vi.fn(),
  listExecutionEventsMock: vi.fn(),
  listExecutionsMock: vi.fn(),
  listWorkflowsMock: vi.fn(),
}));

vi.mock('@/lib/api/backend/executions', () => ({
  executionsApi: {
    listExecutionEvents: listExecutionEventsMock,
    listExecutions: listExecutionsMock,
  },
}));

vi.mock('@/lib/api/backend/workflows', () => ({
  workflowsApi: {
    listWorkflows: listWorkflowsMock,
  },
}));

vi.mock('@/lib/api/backend/graphRead', () => ({
  graphReadApi: {
    expandNode: expandNodeMock,
    getAgentNeighborhood: getAgentNeighborhoodMock,
    getEntityNeighborhood: getEntityNeighborhoodMock,
    getMemoryNeighborhood: getMemoryNeighborhoodMock,
    getNodeNeighborhood: getNodeNeighborhoodMock,
    getRunNeighborhood: getRunNeighborhoodMock,
    getWorkflowNeighborhood: getWorkflowNeighborhoodMock,
  },
}));

vi.mock('@/lib/api/backend/observability', () => ({
  observabilityApi: {
    getExecutionTimeline: getExecutionTimelineMock,
  },
}));

vi.mock('@/modules/sigma-graph/ForceGraph3DCanvas', () => ({
  default: ({
    autoRotate,
    document,
    resetViewToken,
    onSelectionChange,
  }: {
    autoRotate?: boolean;
    document: {
      nodes: { id: string }[];
      edges: { id: string }[];
    };
    resetViewToken?: number;
    onSelectionChange?: (selection: { nodeIds: string[]; edgeIds: string[] }) => void;
  }) => (
    <div data-testid="memory-force-graph-canvas">
      {document.nodes.length} nodes / {document.edges.length} edges
      <span data-testid="memory-force-graph-controls">
        autoRotate {String(autoRotate)} / reset {String(resetViewToken || 0)}
      </span>
      <button
        type="button"
        onClick={() => onSelectionChange?.({ nodeIds: [document.nodes[0]?.id || ''], edgeIds: [] })}
      >
        Select first 3d node
      </button>
    </div>
  ),
}));

vi.mock('@/modules/sigma-graph/SigmaGraphCanvas', () => ({
  default: ({
    document,
    onSelectionChange,
  }: {
    document: {
      nodes: {
        color?: string;
        id: string;
        metadata?: Record<string, unknown>;
        size?: number;
        type?: string;
      }[];
      edges: { color?: string; id: string; metadata?: Record<string, unknown>; size?: number }[];
    };
    onSelectionChange?: (selection: { nodeIds: string[]; edgeIds: string[] }) => void;
  }) => {
    const activeTimelineNodes = document.nodes.filter(
      (node) => node.metadata?.agencyGraphTimelineActive
    );
    const activeTimelineEdges = document.edges.filter(
      (edge) => edge.metadata?.agencyGraphTimelineActive
    );
    const visuallyEncodedNodes = document.nodes.filter(
      (node) => node.metadata?.agencyGraphVisualEncoding
    );
    const statusRingNodes = document.nodes.filter(
      (node) => node.metadata?.agencyGraphStatusRingColor
    );
    const warningNodes = document.nodes.filter((node) => node.metadata?.agencyGraphWarningColor);
    const costNodes = document.nodes.filter(
      (node) => Number(node.metadata?.agencyGraphCostIntensity || 0) > 0
    );
    const styledEdges = document.edges.filter((edge) => edge.metadata?.agencyGraphVisualEncoding);
    return (
      <div data-testid="memory-sigma-graph-canvas">
        {document.nodes.length} nodes / {document.edges.length} edges
        <span data-testid="memory-sigma-graph-timeline-highlight">
          {activeTimelineNodes.length} timeline nodes / {activeTimelineEdges.length} timeline edges
        </span>
        <span data-testid="memory-sigma-graph-visual-encoding">
          {visuallyEncodedNodes.length} visual nodes / {statusRingNodes.length} status rings /{' '}
          {warningNodes.length} warning nodes / {costNodes.length} cost nodes / {styledEdges.length}{' '}
          styled edges
        </span>
        <span data-testid="memory-sigma-graph-node-ids">
          {document.nodes.map((node) => node.id).join(',')}
        </span>
        <button
          type="button"
          onClick={() =>
            onSelectionChange?.({ nodeIds: [document.nodes[0]?.id || ''], edgeIds: [] })
          }
        >
          Select first node
        </button>
        <button
          type="button"
          onClick={() =>
            onSelectionChange?.({
              nodeIds: [document.nodes.find((node) => node.type === 'IncidentCluster')?.id || ''],
              edgeIds: [],
            })
          }
        >
          Select incident cluster
        </button>
        <button
          type="button"
          onClick={() =>
            onSelectionChange?.({ nodeIds: [], edgeIds: [document.edges[0]?.id || ''] })
          }
        >
          Select first edge
        </button>
      </div>
    );
  },
}));

function renderPanel(
  rootOptions = [
    { id: 'memory-1', label: 'Memory One' },
    { id: 'memory-2', label: 'Memory Two' },
  ],
  props: Partial<ComponentProps<typeof AgencyGraphPanel>> = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <AgencyGraphPanel rootOptions={rootOptions} user={authUser} {...props} />
    </QueryClientProvider>
  );

  return queryClient;
}

const operationalGraphReadParams = {
  depth: 2,
  includeOperationalCoverage: true,
  incidentLimit: 12,
  limit: 250,
  recentRunLimit: 40,
  workflowRunLimit: 24,
};

describe('AgencyGraphPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    expandNodeMock.mockResolvedValue({ nodes: [], edges: [], meta: {} });
    getMemoryNeighborhoodMock.mockResolvedValue({ nodes: [], edges: [], meta: {} });
    getAgentNeighborhoodMock.mockResolvedValue({ nodes: [], edges: [], meta: {} });
    getEntityNeighborhoodMock.mockResolvedValue({ nodes: [], edges: [], meta: {} });
    getNodeNeighborhoodMock.mockResolvedValue({ nodes: [], edges: [], meta: {} });
    getExecutionTimelineMock.mockResolvedValue({ execution: null, events: [] });
    listExecutionsMock.mockResolvedValue({ items: [] });
    listExecutionEventsMock.mockResolvedValue({ items: [] });
    listWorkflowsMock.mockResolvedValue({ items: [] });
    getRunNeighborhoodMock.mockResolvedValue({ nodes: [], edges: [], meta: {} });
    getWorkflowNeighborhoodMock.mockResolvedValue({ nodes: [], edges: [], meta: {} });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a Sigma placeholder canvas when there are no memory roots', async () => {
    const refreshRoots = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AgencyGraphPanel rootOptions={[]} onRefreshRoots={refreshRoots} user={authUser} />
      </QueryClientProvider>
    );

    expect(getMemoryNeighborhoodMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('memory-sigma-graph-canvas')).toHaveTextContent('1 nodes / 0 edges');
    expect(screen.getByRole('button', { name: 'Agency graph status' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open agency graph filters' }));
    expect(screen.getByText('No active memories found')).toBeInTheDocument();
    expect(screen.queryByLabelText('Agency graph node type filter')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Agency graph relationship focus')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Agency graph search')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Refresh agency graph' })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh agency graph' }));
    expect(refreshRoots).toHaveBeenCalledTimes(1);
  });

  it('switches between 2D and 3D graph renderers', async () => {
    renderPanel([{ id: 'memory-1', label: 'Memory One' }]);

    expect(screen.getByTestId('memory-sigma-graph-canvas')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Switch agency graph to 3D' }));
    expect(await screen.findByTestId('memory-force-graph-canvas')).toBeInTheDocument();
    expect(screen.queryByTestId('memory-sigma-graph-canvas')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Switch agency graph to 2D' }));
    expect(await screen.findByTestId('memory-sigma-graph-canvas')).toBeInTheDocument();
  });

  it('controls 3D orbit rotation and reset view actions', async () => {
    renderPanel([{ id: 'memory-1', label: 'Memory One' }]);

    fireEvent.click(screen.getByRole('button', { name: 'Switch agency graph to 3D' }));
    expect(await screen.findByTestId('memory-force-graph-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('memory-force-graph-controls')).toHaveTextContent(
      'autoRotate true / reset 0'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pause agency graph orbit rotation' }));
    expect(screen.getByTestId('memory-force-graph-controls')).toHaveTextContent(
      'autoRotate false / reset 0'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reset 3D agency graph view' }));
    expect(screen.getByTestId('memory-force-graph-controls')).toHaveTextContent(
      'autoRotate false / reset 1'
    );
  });

  it('distinguishes loading memory roots from empty memory roots', () => {
    renderPanel([], {
      isRootOptionsLoading: true,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open agency graph filters' }));
    expect(screen.getByText('Loading memory roots')).toBeInTheDocument();
    expect(
      screen.getByText('The page is loading active memories that can be used as graph roots.')
    ).toBeInTheDocument();
    expect(screen.queryByText('No active memories found')).not.toBeInTheDocument();
  });

  it('shows the selected root as a readable label in graph status details', async () => {
    renderPanel([{ id: 'memory-1', label: 'Customer launch memory' }]);

    fireEvent.focus(screen.getByRole('button', { name: 'Agency graph status' }));
    expect((await screen.findAllByText('Selected root: All root types')).length).toBeGreaterThan(0);
  });

  it('shows graph backend disabled state and status messaging', async () => {
    renderPanel([{ id: 'memory-1', label: 'Customer launch memory' }], {
      graphStatus: { enabled: false, available: false, source: 'neo4j' },
    });

    expect(screen.getByTestId('memory-sigma-graph-canvas')).toHaveTextContent('1 nodes / 0 edges');
    expect(getMemoryNeighborhoodMock).not.toHaveBeenCalled();

    fireEvent.focus(screen.getByRole('button', { name: 'Agency graph status' }));
    expect(
      (
        await screen.findAllByText(
          'Neo4j graph read is disabled. Run-event fallback can still be used.'
        )
      ).length
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Open agency graph filters' }));
    expect(screen.getAllByText('Graph backend disabled').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/graph read is disabled/i).length).toBeGreaterThan(0);
  });

  it('shows graph backend unavailable state and status messaging', async () => {
    renderPanel([{ id: 'memory-1', label: 'Customer launch memory' }], {
      graphStatus: { enabled: true, available: false, source: 'neo4j' },
    });

    expect(screen.getByTestId('memory-sigma-graph-canvas')).toHaveTextContent('1 nodes / 0 edges');
    expect(getMemoryNeighborhoodMock).not.toHaveBeenCalled();

    fireEvent.focus(screen.getByRole('button', { name: 'Agency graph status' }));
    expect(
      (
        await screen.findAllByText(
          'Neo4j graph read is unavailable. Run-event fallback can still be used.'
        )
      ).length
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Open agency graph filters' }));
    expect(screen.getAllByText('Graph backend unavailable').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Neo4j graph read is unavailable/i).length).toBeGreaterThan(0);
  });

  it('shows graph request failed when a projected graph request errors', async () => {
    getMemoryNeighborhoodMock.mockRejectedValue(new Error('Neo4j request failed'));

    renderPanel([{ id: 'memory-1', label: 'Customer launch memory' }], {
      graphStatus: { enabled: true, available: true, source: 'neo4j' },
    });

    await waitFor(() => {
      expect(getMemoryNeighborhoodMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open agency graph filters' }));
    expect(await screen.findByText('Graph request failed')).toBeInTheDocument();
    expect(screen.getByText('Neo4j request failed')).toBeInTheDocument();
  });

  it('shows graph returned zero nodes when the projection response is empty', async () => {
    renderPanel([{ id: 'memory-1', label: 'Customer launch memory' }], {
      graphStatus: { enabled: true, available: true, source: 'neo4j' },
    });

    await waitFor(() => {
      expect(getMemoryNeighborhoodMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open agency graph filters' }));
    expect(await screen.findByText('Graph returned zero nodes')).toBeInTheDocument();
    expect(screen.getByText(/projection returned no nodes/i)).toBeInTheDocument();
  });

  it('keeps graph controls stable while a projected graph request is slow', async () => {
    let resolveGraphRequest!: (value: { nodes: unknown[]; edges: unknown[]; meta: object }) => void;
    const graphRequest = new Promise<{ nodes: unknown[]; edges: unknown[]; meta: object }>(
      (resolve) => {
        resolveGraphRequest = resolve;
      }
    );
    getMemoryNeighborhoodMock.mockReturnValue(graphRequest);

    renderPanel([{ id: 'memory-1', label: 'Customer launch memory' }], {
      graphStatus: { enabled: true, available: true, source: 'neo4j' },
    });

    await waitFor(() => {
      expect(getMemoryNeighborhoodMock).toHaveBeenCalled();
    });
    expect(screen.getByRole('button', { name: 'Refresh agency graph' })).toBeDisabled();

    await act(async () => {
      resolveGraphRequest({ nodes: [], edges: [], meta: {} });
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Refresh agency graph' })).not.toBeDisabled();
    });
  });

  it('loads and filters a read-only agency graph projection', async () => {
    getMemoryNeighborhoodMock.mockResolvedValue({
      nodes: [
        {
          id: 'memory-1',
          type: 'Memory',
          properties: {
            summary: 'Memory One',
            scope: 'workflow',
            created_at: '2026-05-20T10:00:00Z',
            status: 'failed',
            severity: 'critical',
            missing_embedding: true,
            token_count: 1234,
            cost_estimate: 0.42,
          },
        },
        {
          id: 'entity-1',
          type: 'Entity',
          properties: {
            name: 'Acme Corp',
            kind: 'organization',
            created_at: '2026-05-20T10:05:00Z',
          },
        },
        {
          id: 'document-1',
          type: 'Document',
          properties: {
            title: 'Planning Doc',
            created_at: '2026-04-01T10:00:00Z',
          },
        },
      ],
      edges: [
        {
          id: 'memory-1:MENTIONS:entity-1',
          source: 'memory-1',
          target: 'entity-1',
          type: 'MENTIONS',
          properties: { confidence: 0.92, created_at: '2026-05-20T10:06:00Z' },
        },
        {
          id: 'memory-1:SOURCE_DOCUMENT:document-1',
          source: 'memory-1',
          target: 'document-1',
          type: 'SOURCE_DOCUMENT',
          properties: { created_at: '2026-04-01T10:05:00Z' },
        },
      ],
      meta: {},
    });

    renderPanel();

    await waitFor(() => {
      expect(getMemoryNeighborhoodMock).toHaveBeenCalledWith(
        'memory-1',
        operationalGraphReadParams,
        authUser
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId('memory-sigma-graph-canvas')).toHaveTextContent(
        '3 nodes / 2 edges'
      );
    });
    expect(screen.getByTestId('memory-sigma-graph-visual-encoding')).toHaveTextContent(
      '3 visual nodes / 1 status rings / 1 warning nodes / 1 cost nodes / 2 styled edges'
    );
    expect(screen.getByLabelText('Agency graph visual legend')).not.toHaveTextContent('Memory 1');
    expect(screen.getByLabelText('Agency graph visual legend')).toHaveTextContent('Failed');
    expect(screen.getByLabelText('Agency graph visual legend')).toHaveTextContent('Knowledge');
    expect(screen.queryByLabelText('Agency graph table side panel')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open agency graph filters' }));
    expect(screen.queryByLabelText('Agency graph node type filter')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Agency graph preset')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Agency graph cluster')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Agency graph relationship focus')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Agency graph view mode')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Agency graph color mode')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Agency graph advanced filters')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Agency graph search')).toBeInTheDocument();
    expect(screen.queryByLabelText('Agency graph local graph')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Agency graph follow selection')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Agency graph relationship type filter')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Select first node' }));
    expect(screen.getAllByText('Memory One').length).toBeGreaterThan(0);
    expect(screen.getByText('scope')).toBeInTheDocument();
    expect(screen.getByText('workflow')).toBeInTheDocument();
    expect(screen.getByText('Health warnings')).toBeInTheDocument();
    expect(screen.getByText('Status: Failed')).toBeInTheDocument();
    expect(screen.getByText('Severity: Critical')).toBeInTheDocument();
    expect(screen.getByText('Missing embedding')).toBeInTheDocument();
    expect(screen.getByText('Cost and tokens')).toBeInTheDocument();
    expect(screen.getByText('$0.42')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('Related records')).toBeInTheDocument();
    expect(screen.getByText('SOURCE_DOCUMENT')).toBeInTheDocument();
    expect(screen.getByText('Planning Doc (Knowledge)')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp (Knowledge)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Select first edge' }));
    expect(screen.getAllByText('MENTIONS').length).toBeGreaterThan(0);
    expect(screen.getByText('Source:')).toBeInTheDocument();
    expect(screen.getByText('Target:')).toBeInTheDocument();
    expect(screen.getByText('confidence')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Agency graph node status filter'), {
      target: { value: 'failed' },
    });
    expect(screen.getByTestId('memory-sigma-graph-canvas')).toHaveTextContent('1 nodes / 0 edges');
    expect(screen.getByText('1 active filter')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    fireEvent.click(screen.getByRole('button', { name: 'Agency graph view Links' }));
    expect(screen.getByRole('button', { name: 'Agency graph view Links' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('exposes keyboard search, focus, overview, and mobile graph guidance', async () => {
    getMemoryNeighborhoodMock.mockResolvedValue({
      nodes: [
        {
          id: 'memory-1',
          type: 'Memory',
          properties: { summary: 'Memory One' },
        },
      ],
      edges: [],
      meta: {},
    });

    renderPanel();
    await screen.findByTestId('memory-sigma-graph-canvas');

    fireEvent.keyDown(window, { key: '/' });
    await waitFor(() => expect(screen.getByLabelText('Agency graph search')).toHaveFocus());
    expect(screen.getByLabelText('Agency graph mobile summary')).toHaveTextContent(
      '1 nodes · 0 links'
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Select first node' }));
    fireEvent.keyDown(window, { key: 'f' });
    expect(screen.getByRole('button', { name: 'Agency graph view Focus' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    fireEvent.keyDown(window, { key: '0' });
    expect(screen.getByRole('button', { name: 'Agency graph view Overview' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('shows multiple workflow runs in fallback mode for a workflow root', async () => {
    listExecutionsMock.mockResolvedValue({
      items: [
        {
          id: 'run-1',
          workflow_id: 'workflow-1',
          status: 'completed',
          created_at: '2026-06-10T10:00:00Z',
        },
        {
          id: 'run-2',
          workflow_id: 'workflow-1',
          status: 'failed',
          created_at: '2026-06-11T10:00:00Z',
          error: 'Coordinator failed',
        },
      ],
    });
    listWorkflowsMock.mockResolvedValue({
      items: [{ id: 'workflow-1', name: 'Coordinator Workflow' }],
    });
    getWorkflowNeighborhoodMock.mockResolvedValue({ nodes: [], edges: [], meta: {} });

    renderPanel([{ id: 'memory-1', label: 'Memory One' }]);

    fireEvent.click(screen.getByRole('button', { name: 'Open agency graph filters' }));
    fireEvent.change(screen.getByLabelText('Agency graph root type'), {
      target: { value: 'workflow' },
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Agency graph root workflow')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Agency graph root workflow'), {
      target: { value: 'workflow-1' },
    });

    await waitFor(() => {
      expect(getWorkflowNeighborhoodMock).toHaveBeenCalledWith(
        'workflow-1',
        operationalGraphReadParams,
        authUser
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId('memory-sigma-graph-canvas')).toHaveTextContent(
        '5 nodes / 4 edges'
      );
    });
    expect(screen.getAllByText('5 nodes / 4 edges').length).toBeGreaterThan(0);
    expect(screen.queryByText('Workflow run fallback')).not.toBeInTheDocument();
    expect(screen.queryByText('2 runs')).not.toBeInTheDocument();
    expect(screen.queryByText('2/2 runs shown')).not.toBeInTheDocument();
    expect(screen.queryByText('1 workflow shown')).not.toBeInTheDocument();
    expect(screen.queryByText('1 issue shown')).not.toBeInTheDocument();
  });

  it('shows multiple recent runs in fallback mode for the all root', async () => {
    listExecutionsMock.mockResolvedValue({
      items: [
        {
          id: 'run-1',
          workflow_id: 'workflow-1',
          status: 'completed',
          created_at: '2026-06-10T10:00:00Z',
        },
        {
          id: 'run-2',
          workflow_id: 'workflow-1',
          status: 'failed',
          created_at: '2026-06-11T10:00:00Z',
          error: 'Coordinator failed',
        },
        {
          id: 'run-3',
          workflow_id: 'workflow-2',
          status: 'running',
          created_at: '2026-06-12T10:00:00Z',
        },
      ],
    });
    listWorkflowsMock.mockResolvedValue({
      items: [
        { id: 'workflow-1', name: 'Coordinator Workflow' },
        { id: 'workflow-2', name: 'Planner Workflow' },
      ],
    });
    getMemoryNeighborhoodMock.mockResolvedValue({ nodes: [], edges: [], meta: {} });

    renderPanel([{ id: 'memory-1', label: 'Memory One' }]);

    await waitFor(() => {
      expect(getMemoryNeighborhoodMock).toHaveBeenCalledWith(
        'memory-1',
        operationalGraphReadParams,
        authUser
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId('memory-sigma-graph-canvas')).toHaveTextContent(
        '8 nodes / 6 edges'
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open agency graph filters' }));
    expect(screen.getAllByText('8 nodes / 6 edges').length).toBeGreaterThan(0);
    expect(screen.queryByText('Recent run fallback')).not.toBeInTheDocument();
    expect(screen.queryByText('3 recent runs')).not.toBeInTheDocument();
    expect(screen.queryByText('3/3 runs shown')).not.toBeInTheDocument();
    expect(screen.queryByText('2 workflows shown')).not.toBeInTheDocument();
    expect(screen.queryByText('1 issue shown')).not.toBeInTheDocument();
  });

  it('renders backend-provided operational coverage nodes when the projection includes them', async () => {
    listExecutionsMock.mockResolvedValue({ items: [] });
    getMemoryNeighborhoodMock.mockResolvedValue({
      nodes: [
        {
          id: 'memory-1',
          type: 'Memory',
          properties: { summary: 'Memory One' },
        },
      ],
      edges: [],
      operational: {
        coverage: {
          recent_run_count: 2,
          workflow_count: 1,
        },
        nodes: [
          {
            id: 'run:run-backend-1',
            type: 'Run',
            properties: {
              id: 'run-backend-1',
              status: 'failed',
              workflow_id: 'workflow-1',
            },
          },
          {
            id: 'incident-cluster:workflow-1:backend',
            type: 'IncidentCluster',
            properties: {
              failure_count: 2,
              incident_signature: 'backend failed',
              run_ids: ['run-backend-1', 'run-backend-2'],
            },
          },
        ],
        edges: [
          {
            id: 'memory-1:SOURCE_EXECUTION:run-backend-1',
            source: 'memory-1',
            target: 'run:run-backend-1',
            type: 'SOURCE_EXECUTION',
          },
        ],
      },
      meta: { projection_mode: 'neo4j-operational' },
    });

    renderPanel([{ id: 'memory-1', label: 'Memory One' }]);

    await waitFor(() => {
      expect(getMemoryNeighborhoodMock).toHaveBeenCalledWith(
        'memory-1',
        operationalGraphReadParams,
        authUser
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId('memory-sigma-graph-canvas')).toHaveTextContent(
        '3 nodes / 1 edges'
      );
    });
    expect(screen.getByTestId('memory-sigma-graph-node-ids')).toHaveTextContent(
      'run:run-backend-1'
    );
    expect(screen.getByTestId('memory-sigma-graph-node-ids')).toHaveTextContent(
      'incident-cluster:workflow-1:backend'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open agency graph filters' }));
    expect(screen.getAllByText('3 nodes / 1 edges').length).toBeGreaterThan(0);
    expect(screen.queryByText('Neo4j projection')).not.toBeInTheDocument();
    expect(screen.queryByText('Recent run fallback')).not.toBeInTheDocument();
  });

  it('keeps recent workflow diversity when one noisy workflow exceeds the fallback budget', async () => {
    const noisyFailures = Array.from({ length: 45 }, (_, index) => ({
      id: `run-noisy-${index + 1}`,
      workflow_id: 'workflow-noisy',
      status: 'failed',
      created_at: `2026-05-${String((index % 28) + 1).padStart(2, '0')}T10:00:00Z`,
      error: 'Coordinator failed',
    }));
    listExecutionsMock.mockResolvedValue({
      items: [
        ...noisyFailures,
        {
          id: 'run-planner-latest',
          workflow_id: 'workflow-planner',
          status: 'completed',
          created_at: '2026-06-14T10:00:00Z',
        },
        {
          id: 'run-review-latest',
          workflow_id: 'workflow-review',
          status: 'running',
          created_at: '2026-06-15T10:00:00Z',
        },
      ],
    });
    listWorkflowsMock.mockResolvedValue({
      items: [
        { id: 'workflow-noisy', name: 'Noisy Workflow' },
        { id: 'workflow-planner', name: 'Planner Workflow' },
        { id: 'workflow-review', name: 'Review Workflow' },
      ],
    });
    getMemoryNeighborhoodMock.mockResolvedValue({ nodes: [], edges: [], meta: {} });

    renderPanel([{ id: 'memory-1', label: 'Memory One' }]);

    await waitFor(() => {
      expect(screen.getByTestId('memory-sigma-graph-node-ids')).toHaveTextContent(
        'run:run-planner-latest'
      );
    });
    expect(screen.getByTestId('memory-sigma-graph-node-ids')).toHaveTextContent(
      'run:run-review-latest'
    );
    expect(screen.getByTestId('memory-sigma-graph-node-ids')).toHaveTextContent('workflow-planner');
    expect(screen.getByTestId('memory-sigma-graph-node-ids')).toHaveTextContent('workflow-review');

    fireEvent.click(screen.getByRole('button', { name: 'Open agency graph filters' }));
    expect(listExecutionsMock).toHaveBeenCalledWith(authUser, null, { limit: 200 });
    expect(screen.queryByText('40 recent runs')).not.toBeInTheDocument();
    expect(screen.queryByText('40/40 runs shown')).not.toBeInTheDocument();
    expect(screen.queryByText('3 workflows shown')).not.toBeInTheDocument();
  });

  it('renders workflow time-window aggregates for dense recent run fallback graphs', async () => {
    listExecutionsMock.mockResolvedValue({
      items: [
        {
          id: 'run-1',
          workflow_id: 'workflow-1',
          status: 'completed',
          created_at: '2026-06-10T10:00:00Z',
        },
        {
          id: 'run-2',
          workflow_id: 'workflow-1',
          status: 'failed',
          created_at: '2026-06-11T10:00:00Z',
          error: 'Coordinator failed',
        },
        {
          id: 'run-3',
          workflow_id: 'workflow-1',
          status: 'failed',
          created_at: '2026-06-12T10:00:00Z',
          error: 'Coordinator failed',
        },
      ],
    });
    listWorkflowsMock.mockResolvedValue({
      items: [{ id: 'workflow-1', name: 'Coordinator Workflow' }],
    });
    getMemoryNeighborhoodMock.mockResolvedValue({ nodes: [], edges: [], meta: {} });

    renderPanel([{ id: 'memory-1', label: 'Memory One' }]);

    await waitFor(() => {
      expect(screen.getByTestId('memory-sigma-graph-canvas')).toHaveTextContent(
        '11 nodes / 10 edges'
      );
    });
    expect(screen.getByTestId('memory-sigma-graph-node-ids')).toHaveTextContent(
      'workflow-run-window:workflow-1:24h'
    );
    expect(screen.getByTestId('memory-sigma-graph-node-ids')).toHaveTextContent(
      'workflow-run-window:workflow-1:7d'
    );
    expect(screen.getByTestId('memory-sigma-graph-node-ids')).toHaveTextContent(
      'incident-cluster:workflow-1'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select incident cluster' }));

    expect(screen.getByText('Incident cluster')).toBeInTheDocument();
    expect(screen.getByText('Failures')).toBeInTheDocument();
    expect(screen.getByText('Affected runs')).toBeInTheDocument();
    expect(screen.getByText('First seen')).toBeInTheDocument();
    expect(screen.getAllByText('Last seen').length).toBeGreaterThan(0);
    expect(screen.getByText('Example error')).toBeInTheDocument();
    expect(screen.getByText('Coordinator failed')).toBeInTheDocument();
    expect(screen.getByText('Signature')).toBeInTheDocument();
    expect(screen.getAllByText('coordinator failed').length).toBeGreaterThan(0);
    expect(screen.getByText('run-2')).toBeInTheDocument();
    expect(screen.getByText('run-3')).toBeInTheDocument();
  });

  it('keeps newest workflow runs when old failures exceed the workflow fallback budget', async () => {
    listExecutionsMock.mockResolvedValue({
      items: [
        ...Array.from({ length: 30 }, (_, index) => ({
          id: `run-old-failure-${index + 1}`,
          workflow_id: 'workflow-1',
          status: 'failed',
          created_at: `2026-05-${String((index % 28) + 1).padStart(2, '0')}T10:00:00Z`,
          error: 'Coordinator failed',
        })),
        {
          id: 'run-new-completed',
          workflow_id: 'workflow-1',
          status: 'completed',
          created_at: '2026-06-13T10:00:00Z',
        },
        {
          id: 'run-new-running',
          workflow_id: 'workflow-1',
          status: 'running',
          created_at: '2026-06-14T10:00:00Z',
        },
      ],
    });
    listWorkflowsMock.mockResolvedValue({
      items: [{ id: 'workflow-1', name: 'Coordinator Workflow' }],
    });
    getWorkflowNeighborhoodMock.mockResolvedValue({ nodes: [], edges: [], meta: {} });

    renderPanel([{ id: 'memory-1', label: 'Memory One' }]);

    fireEvent.click(screen.getByRole('button', { name: 'Open agency graph filters' }));
    fireEvent.change(screen.getByLabelText('Agency graph root type'), {
      target: { value: 'workflow' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('memory-sigma-graph-node-ids')).toHaveTextContent(
        'run:run-new-completed'
      );
    });
    expect(screen.getByTestId('memory-sigma-graph-node-ids')).toHaveTextContent(
      'run:run-new-running'
    );
    expect(screen.queryByText('24 runs')).not.toBeInTheDocument();
    expect(screen.queryByText('24/24 runs shown')).not.toBeInTheDocument();
  });

  it('does not inflate recent run coverage from unrelated projected run nodes', async () => {
    listExecutionsMock.mockResolvedValue({
      items: [
        {
          id: 'run-1',
          workflow_id: 'workflow-1',
          status: 'completed',
          created_at: '2026-06-10T10:00:00Z',
        },
        {
          id: 'run-2',
          workflow_id: 'workflow-1',
          status: 'failed',
          created_at: '2026-06-11T10:00:00Z',
          error: 'Coordinator failed',
        },
      ],
    });
    listWorkflowsMock.mockResolvedValue({
      items: [{ id: 'workflow-1', name: 'Coordinator Workflow' }],
    });
    getMemoryNeighborhoodMock.mockResolvedValue({
      nodes: [
        {
          id: 'unrelated-projected-run',
          type: 'WorkflowRun',
          properties: { id: 'unrelated-run', status: 'completed' },
        },
      ],
      edges: [],
      meta: {},
    });

    renderPanel([{ id: 'memory-1', label: 'Memory One' }]);

    await waitFor(() => {
      expect(screen.getByTestId('memory-sigma-graph-canvas')).toHaveTextContent(
        '6 nodes / 4 edges'
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open agency graph filters' }));
    expect(screen.getAllByText('6 nodes / 4 edges').length).toBeGreaterThan(0);
    expect(screen.queryByText('2/2 runs shown')).not.toBeInTheDocument();
    expect(screen.queryByText('3/2 runs shown')).not.toBeInTheDocument();
  });

  it('expands the selected projected node on demand', async () => {
    getMemoryNeighborhoodMock.mockResolvedValue({
      nodes: [
        {
          id: 'memory-1',
          type: 'Memory',
          properties: { summary: 'Memory One' },
        },
      ],
      edges: [],
      meta: {},
    });
    expandNodeMock.mockResolvedValue({
      nodes: [
        {
          id: 'memory-1',
          type: 'Memory',
          properties: { summary: 'Memory One' },
        },
        {
          id: 'entity-1',
          type: 'Entity',
          properties: { name: 'Expanded Entity' },
        },
      ],
      edges: [
        {
          id: 'memory-1:MENTIONS:entity-1',
          source: 'memory-1',
          target: 'entity-1',
          type: 'MENTIONS',
          properties: {},
        },
      ],
      meta: {},
    });

    renderPanel([{ id: 'memory-1', label: 'Customer launch memory' }], {
      graphStatus: { enabled: true, available: true, source: 'neo4j' },
    });

    expect(await screen.findByTestId('memory-sigma-graph-canvas')).toHaveTextContent(
      '1 nodes / 0 edges'
    );
    await waitFor(() => {
      expect(getMemoryNeighborhoodMock).toHaveBeenCalled();
    });
    expect(screen.getByLabelText('Agency graph visual legend')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Select first node' }));

    await waitFor(() => {
      expect(expandNodeMock).toHaveBeenCalledWith(
        'memory-1',
        {
          depth: 1,
          limit: 120,
        },
        authUser
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId('memory-sigma-graph-canvas')).toHaveTextContent(
        '2 nodes / 1 edges'
      );
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open agency graph filters' }));
    expect(screen.queryByText('Selected node expanded')).not.toBeInTheDocument();
  });

  it('keeps large projected graphs within the render budget and shows truncation context', async () => {
    getMemoryNeighborhoodMock.mockResolvedValue({
      nodes: Array.from({ length: 300 }, (_, index) => ({
        id: `node-${index}`,
        type: index === 0 ? 'Memory' : 'Entity',
        properties: {
          name:
            index === 0
              ? 'Important memory root with a very long label that should be shortened before rendering in the canvas'
              : `Entity ${index}`,
          status: index === 0 ? 'failed' : 'active',
        },
      })),
      edges: Array.from({ length: 650 }, (_, index) => ({
        id: `edge-${index}`,
        source: `node-${index % 250}`,
        target: `node-${(index + 1) % 250}`,
        type: index % 2 === 0 ? 'MENTIONS' : 'SOURCE_DOCUMENT',
        properties: {},
      })),
      meta: { limit: 250, truncated: true },
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId('memory-sigma-graph-canvas')).toHaveTextContent(
        '250 nodes / 500 edges'
      );
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open agency graph filters' }));
    expect(screen.getByText('Truncated to 250 nodes')).toBeInTheDocument();
  });

  it('preserves operational run and workflow nodes when projected graphs exceed the render budget', async () => {
    getMemoryNeighborhoodMock.mockResolvedValue({
      nodes: [
        ...Array.from({ length: 260 }, (_, index) => ({
          id: `entity-${index}`,
          type: 'Entity',
          properties: { name: `Entity ${index}` },
        })),
        {
          id: 'workflow-late',
          type: 'Workflow',
          properties: { name: 'Late Workflow' },
        },
        {
          id: 'run-late',
          type: 'WorkflowRun',
          properties: { status: 'completed' },
        },
      ],
      edges: [
        {
          id: 'workflow-late:STARTED:run-late',
          source: 'workflow-late',
          target: 'run-late',
          type: 'STARTED',
          properties: {},
        },
      ],
      meta: { limit: 250, truncated: true },
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId('memory-sigma-graph-canvas')).toHaveTextContent(
        '250 nodes / 1 edges'
      );
    });
    expect(screen.getByTestId('memory-sigma-graph-node-ids')).toHaveTextContent('workflow-late');
    expect(screen.getByTestId('memory-sigma-graph-node-ids')).toHaveTextContent('run-late');
  });

  it('renders an event-derived fallback graph for a failed run when graph read is unavailable', async () => {
    getMemoryNeighborhoodMock.mockRejectedValue(new Error('Neo4j graph read API is disabled'));
    listExecutionsMock.mockResolvedValue({
      items: [
        {
          id: 'run-1',
          workflow_id: 'workflow-1',
          status: 'failed',
          trigger_type: 'schedule',
          trigger_payload: { schedule_id: 'schedule-1' },
          error: 'Codex CLI timed out after 120 seconds.',
          created_at: '2026-05-27T01:09:39Z',
          started_at: '2026-05-27T01:09:40Z',
          completed_at: '2026-05-27T01:44:25Z',
          runtime_revision_id: 'revision-1',
          runtime_adapter_id: 'native',
          container_id: 'container-1',
          container_name: 'agency-execution-run-1',
          metadata: { agent_ids: ['reviewer-agent'] },
        },
      ],
    });
    listWorkflowsMock.mockResolvedValue({
      items: [{ id: 'workflow-1', name: 'Daily Review Workflow' }],
    });
    listExecutionEventsMock.mockResolvedValue({
      items: [
        {
          id: 'event-1',
          execution_id: 'run-1',
          workflow_id: 'workflow-1',
          event_type: 'execution.created',
          timestamp: '2026-05-27T01:09:39Z',
          sequence: 1,
        },
        {
          id: 'event-2',
          execution_id: 'run-1',
          workflow_id: 'workflow-1',
          parent_event_id: 'event-1',
          event_type: 'container.created',
          status: 'failed',
          timestamp: '2026-05-27T01:09:40Z',
          sequence: 2,
        },
      ],
    });
    getExecutionTimelineMock.mockResolvedValue({
      execution: {
        id: 'run-1',
        workflow_id: 'workflow-1',
        status: 'failed',
        trigger_type: 'schedule',
        trigger_payload: { schedule_id: 'schedule-1' },
        error: 'Codex CLI timed out after 120 seconds.',
        created_at: '2026-05-27T01:09:39Z',
        started_at: '2026-05-27T01:09:40Z',
        completed_at: '2026-05-27T01:44:25Z',
        runtime_revision_id: 'revision-1',
        runtime_adapter_id: 'native',
        container_id: 'container-1',
        container_name: 'agency-execution-run-1',
        metadata: { agent_ids: ['reviewer-agent'] },
      },
      events: [
        {
          id: 'event-1',
          execution_id: 'run-1',
          workflow_id: 'workflow-1',
          event_type: 'execution.created',
          timestamp: '2026-05-27T01:09:39Z',
          sequence: 1,
        },
        {
          id: 'event-2',
          execution_id: 'run-1',
          workflow_id: 'workflow-1',
          parent_event_id: 'event-1',
          event_type: 'container.created',
          status: 'failed',
          timestamp: '2026-05-27T01:09:40Z',
          sequence: 2,
        },
      ],
      execution_duration_ms: 2086000,
    });

    renderPanel(undefined, {
      graphStatus: { enabled: false, available: false, source: 'neo4j' },
    });

    await waitFor(() => {
      expect(listExecutionsMock).toHaveBeenCalledWith(authUser, null, { limit: 200 });
    });
    await waitFor(() => {
      expect(getExecutionTimelineMock).toHaveBeenCalledWith('run-1');
    });
    await waitFor(() => {
      expect(listExecutionEventsMock).toHaveBeenCalledWith('run-1', 0, [], authUser);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open agency graph filters' }));
    expect((await screen.findAllByText('8 nodes / 7 edges')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Event fallback')).not.toBeInTheDocument();
    expect(screen.queryByText('2 events')).not.toBeInTheDocument();
    expect(screen.queryByText(/observability\/executions/)).not.toBeInTheDocument();
    expect(screen.queryByText(/not a persisted Neo4j projection/)).not.toBeInTheDocument();
    expect(screen.getByTestId('memory-sigma-graph-canvas')).toHaveTextContent('8 nodes / 7 edges');
    expect(screen.getByTestId('memory-sigma-graph-visual-encoding')).toHaveTextContent(
      '8 visual nodes / 3 status rings / 3 warning nodes / 0 cost nodes / 7 styled edges'
    );
    expect(screen.getByLabelText('Agency graph visual legend')).toHaveTextContent('Run');
    expect(screen.getByLabelText('Agency graph visual legend')).not.toHaveTextContent(
      'WorkflowRun'
    );
    expect(screen.getByLabelText('Agency graph visual legend')).not.toHaveTextContent('Event');
    expect(screen.queryByLabelText('Agency graph node type filter')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Agency graph visual legend')).toHaveTextContent('Warning');
    expect(screen.queryByLabelText('Agency graph table side panel')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Agency graph root type')).toHaveValue('all');
    expect(screen.queryByLabelText('Agency graph run status filter')).not.toBeInTheDocument();
    expect(screen.queryByText('Timeline')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Agency graph cluster')).not.toBeInTheDocument();
    expect(screen.getByTestId('memory-sigma-graph-timeline-highlight')).toHaveTextContent(
      '0 timeline nodes / 0 timeline edges'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Select first node' }));
    expect(screen.getByText('Condensed events')).toBeInTheDocument();
    expect(screen.queryByLabelText('Agency graph node type filter')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Agency graph node status filter'), {
      target: { value: 'failed' },
    });
    expect(screen.getByTestId('memory-sigma-graph-canvas')).toHaveTextContent('3 nodes / 1 edges');
    expect(screen.getByText('1 active filter')).toBeInTheDocument();
  });

  it('caps dense event fallback graphs before rendering', async () => {
    const events = Array.from({ length: 180 }, (_, index) => ({
      id: `event-${index + 1}`,
      execution_id: 'run-1',
      workflow_id: 'workflow-1',
      event_type: index === 150 ? 'execution.error' : 'execution.progress',
      status: index === 150 ? 'failed' : 'running',
      timestamp: `2026-05-27T01:${String(index % 60).padStart(2, '0')}:00Z`,
      sequence: index + 1,
    }));
    listExecutionsMock.mockResolvedValue({
      items: [
        {
          id: 'run-1',
          workflow_id: 'workflow-1',
          status: 'failed',
          error: 'Repeated progress events ended in failure.',
          created_at: '2026-05-27T01:09:39Z',
        },
      ],
    });
    getExecutionTimelineMock.mockResolvedValue({
      execution: {
        id: 'run-1',
        workflow_id: 'workflow-1',
        status: 'failed',
        error: 'Repeated progress events ended in failure.',
        created_at: '2026-05-27T01:09:39Z',
      },
      events,
    });
    listExecutionEventsMock.mockResolvedValue({ items: events });

    renderPanel(undefined, {
      graphStatus: { enabled: false, available: false, source: 'neo4j' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open agency graph filters' }));
    expect(await screen.findByText(/Truncated to \d+ nodes/)).toBeInTheDocument();
    expect(screen.queryByText('180 events')).not.toBeInTheDocument();
    expect(screen.getByText(/Truncated to \d+ nodes/)).toBeInTheDocument();
    expect(screen.queryByText('120 condensed events')).not.toBeInTheDocument();
    expect(screen.getByTestId('memory-sigma-graph-canvas')).not.toHaveTextContent('180 nodes');
  });

  it('filters run roots by execution status', async () => {
    listExecutionsMock.mockResolvedValue({
      items: [
        {
          id: 'run-failed',
          workflow_id: 'workflow-1',
          status: 'failed',
          created_at: '2026-05-27T01:09:39Z',
        },
        {
          id: 'run-completed',
          workflow_id: 'workflow-1',
          status: 'completed',
          created_at: '2026-05-27T02:09:39Z',
        },
      ],
    });
    listWorkflowsMock.mockResolvedValue({
      items: [{ id: 'workflow-1', name: 'Daily Review Workflow' }],
    });

    renderPanel(undefined, {
      graphStatus: { enabled: true, available: true, source: 'neo4j' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open agency graph filters' }));
    fireEvent.change(screen.getByLabelText('Agency graph root type'), {
      target: { value: 'run' },
    });

    await waitFor(() => {
      expect(getRunNeighborhoodMock).toHaveBeenCalledWith(
        'run-failed',
        operationalGraphReadParams,
        authUser
      );
    });

    fireEvent.change(screen.getByLabelText('Agency graph run status filter'), {
      target: { value: 'completed' },
    });

    await waitFor(() => {
      expect(getRunNeighborhoodMock).toHaveBeenCalledWith(
        'run-completed',
        operationalGraphReadParams,
        authUser
      );
    });
    expect(screen.getByLabelText('Agency graph root run')).toHaveTextContent('Completed run');
    expect(screen.getByLabelText('Agency graph root run')).not.toHaveTextContent('Failed run');
  });

  it('loads a projected Neo4j run graph before using event fallback', async () => {
    listExecutionsMock.mockResolvedValue({
      items: [
        {
          id: 'run-1',
          workflow_id: 'workflow-1',
          status: 'failed',
          created_at: '2026-05-27T01:09:39Z',
        },
      ],
    });
    getRunNeighborhoodMock.mockResolvedValue({
      nodes: [
        {
          id: 'run-1',
          type: 'WorkflowRun',
          properties: { status: 'failed' },
        },
        {
          id: 'workflow-1',
          type: 'Workflow',
          properties: { name: 'Workflow One' },
        },
      ],
      edges: [
        {
          id: 'workflow-1:STARTED:run-1',
          source: 'workflow-1',
          target: 'run-1',
          type: 'STARTED',
          properties: {},
        },
      ],
      meta: {},
    });

    renderPanel(undefined, {
      graphStatus: { enabled: true, available: true, source: 'neo4j' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open agency graph filters' }));
    fireEvent.change(screen.getByLabelText('Agency graph root type'), {
      target: { value: 'run' },
    });

    await waitFor(() => {
      expect(getRunNeighborhoodMock).toHaveBeenCalledWith(
        'run-1',
        operationalGraphReadParams,
        authUser
      );
    });
    expect(listExecutionEventsMock).not.toHaveBeenCalled();
    expect(await screen.findByTestId('memory-sigma-graph-canvas')).toHaveTextContent(
      '2 nodes / 1 edges'
    );
    expect(screen.queryByText('Neo4j projection')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Agency graph root run')).toHaveTextContent('Failed run');
    expect(screen.getByLabelText('Agency graph root run')).not.toHaveTextContent('run-1');
  });

  it('loads a projected Neo4j workflow graph from recent execution workflow ids', async () => {
    listExecutionsMock.mockResolvedValue({
      items: [
        {
          id: 'run-1',
          workflow_id: 'workflow-1',
          status: 'completed',
          created_at: '2026-05-27T01:09:39Z',
        },
      ],
    });
    listWorkflowsMock.mockResolvedValue({
      items: [{ id: 'workflow-1', name: 'Daily Review Workflow' }],
    });
    getWorkflowNeighborhoodMock.mockResolvedValue({
      nodes: [
        {
          id: 'workflow-1',
          type: 'Workflow',
          properties: { name: 'Workflow One' },
        },
      ],
      edges: [],
      meta: {},
    });

    renderPanel(undefined, {
      graphStatus: { enabled: true, available: true, source: 'neo4j' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open agency graph filters' }));
    fireEvent.change(screen.getByLabelText('Agency graph root type'), {
      target: { value: 'workflow' },
    });

    await waitFor(() => {
      expect(getWorkflowNeighborhoodMock).toHaveBeenCalledWith(
        'workflow-1',
        operationalGraphReadParams,
        authUser
      );
    });
    expect(await screen.findByTestId('memory-sigma-graph-canvas')).toHaveTextContent(
      '2 nodes / 1 edges'
    );
    expect(screen.getByLabelText('Agency graph root workflow')).toHaveValue('workflow-1');
    expect(screen.getByLabelText('Agency graph root workflow')).toHaveTextContent(
      'Daily Review Workflow'
    );
  });

  it('loads manual Agent, Entity, Document, and Error roots through graph read APIs', async () => {
    renderPanel(undefined, {
      graphStatus: { enabled: true, available: true, source: 'neo4j' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open agency graph filters' }));
    expect(screen.getByLabelText('Agency graph root type')).toHaveTextContent('Agent');
    expect(screen.getByLabelText('Agency graph root type')).toHaveTextContent('Entity');
    expect(screen.getByLabelText('Agency graph root type')).toHaveTextContent('Document');
    expect(screen.getByLabelText('Agency graph root type')).toHaveTextContent('Error');

    fireEvent.change(screen.getByLabelText('Agency graph root type'), {
      target: { value: 'agent' },
    });
    expect(await screen.findByText('No Agent root selected')).toBeInTheDocument();
    expect(getAgentNeighborhoodMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Agency graph root agent'), {
      target: { value: 'agent:researcher' },
    });
    await waitFor(() => {
      expect(getAgentNeighborhoodMock).toHaveBeenCalledWith(
        'agent:researcher',
        {
          depth: 2,
          limit: 250,
        },
        authUser
      );
    });
    expect(listExecutionEventsMock).not.toHaveBeenCalled();
    expect(getExecutionTimelineMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Agency graph root type'), {
      target: { value: 'entity' },
    });
    fireEvent.change(screen.getByLabelText('Agency graph root entity'), {
      target: { value: 'entity:organization:acme' },
    });
    await waitFor(() => {
      expect(getEntityNeighborhoodMock).toHaveBeenCalledWith(
        'entity:organization:acme',
        {
          depth: 2,
          limit: 250,
        },
        authUser
      );
    });

    fireEvent.change(screen.getByLabelText('Agency graph root type'), {
      target: { value: 'document' },
    });
    fireEvent.change(screen.getByLabelText('Agency graph root document'), {
      target: { value: 'document:planning-doc' },
    });
    await waitFor(() => {
      expect(getNodeNeighborhoodMock).toHaveBeenCalledWith(
        'document:planning-doc',
        {
          depth: 2,
          labels: 'Document',
          limit: 250,
        },
        authUser
      );
    });

    fireEvent.change(screen.getByLabelText('Agency graph root type'), {
      target: { value: 'error' },
    });
    fireEvent.change(screen.getByLabelText('Agency graph root error'), {
      target: { value: 'error:timeout' },
    });
    await waitFor(() => {
      expect(getNodeNeighborhoodMock).toHaveBeenCalledWith(
        'error:timeout',
        {
          depth: 2,
          labels: 'Error',
          limit: 250,
        },
        authUser
      );
    });
  });
});
