import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AgencyGraphWorkspace from './AgencyGraphWorkspace';

const {
  authUser,
  getMemoryNeighborhoodMock,
  getStatusMock,
  listExecutionsMock,
  listMemoriesMock,
  listWorkflowsMock,
} = vi.hoisted(() => ({
  authUser: {
    id: 'dev-user',
    name: 'Dev User',
    email: 'dev@example.com',
    image: null,
    accessToken: null,
    authMode: 'dev' as const,
  },
  getMemoryNeighborhoodMock: vi.fn(),
  getStatusMock: vi.fn(),
  listExecutionsMock: vi.fn(),
  listMemoriesMock: vi.fn(),
  listWorkflowsMock: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: authUser,
    },
  }),
}));

vi.mock('@/lib/api/backend/executions', () => ({
  executionsApi: {
    listExecutionEvents: vi.fn(),
    listExecutions: listExecutionsMock,
  },
}));

vi.mock('@/lib/api/backend/memory', () => ({
  memoriesApi: {
    listMemories: listMemoriesMock,
  },
}));

vi.mock('@/lib/api/backend/workflows', () => ({
  workflowsApi: {
    listWorkflows: listWorkflowsMock,
  },
}));

vi.mock('@/lib/api/backend/graphRead', () => ({
  graphReadApi: {
    getMemoryNeighborhood: getMemoryNeighborhoodMock,
    getStatus: getStatusMock,
  },
}));

vi.mock('@/modules/sigma-graph/SigmaGraphCanvas', () => ({
  default: ({ document }: { document: { nodes: { id: string }[]; edges: { id: string }[] } }) => (
    <div data-testid="memory-sigma-graph-canvas">
      {document.nodes.length} nodes / {document.edges.length} edges
    </div>
  ),
}));

function renderWorkspace() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <AgencyGraphWorkspace />
    </QueryClientProvider>
  );
}

describe('AgencyGraphWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStatusMock.mockResolvedValue({ enabled: true, available: true, source: 'neo4j' });
    listExecutionsMock.mockResolvedValue({ items: [] });
    listWorkflowsMock.mockResolvedValue({ items: [] });
  });

  it('loads memory roots and renders the dedicated Sigma graph page', async () => {
    listMemoriesMock.mockResolvedValue({
      items: [
        {
          id: 'memory-1',
          content: 'Important graph root memory',
          summary: 'Graph root',
          tags: [],
          sensitive: false,
          scope: 'workspace',
        },
      ],
    });
    getMemoryNeighborhoodMock.mockResolvedValue({
      nodes: [
        {
          id: 'memory-1',
          type: 'Memory',
          properties: { summary: 'Graph root' },
        },
      ],
      edges: [],
      meta: {},
    });

    renderWorkspace();

    expect(screen.getByRole('heading', { name: 'Agency Graph' })).toBeInTheDocument();
    await waitFor(() => {
      expect(listMemoriesMock).toHaveBeenCalledWith({
        limit: 100,
        status: ['active'],
      });
    });
    await waitFor(() => {
      expect(getMemoryNeighborhoodMock).toHaveBeenCalledWith(
        'memory-1',
        {
          depth: 2,
          incidentLimit: 12,
          includeOperationalCoverage: true,
          limit: 250,
          recentRunLimit: 40,
          workflowRunLimit: 24,
        },
        authUser
      );
    });
    expect(await screen.findByTestId('memory-sigma-graph-canvas')).toHaveTextContent(
      '1 nodes / 0 edges'
    );
  });
});
