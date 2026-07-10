import { beforeEach, describe, expect, it, vi } from 'vitest';
import { graphReadApi } from '@/lib/api/backend/graphRead';

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock('@/lib/api/clientInstances', () => ({
  agencyApiClient: {
    get: getMock,
  },
}));

describe('graphReadApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests run neighborhoods through the graph read API', async () => {
    getMock.mockResolvedValue({ nodes: [], edges: [], meta: {} });

    await graphReadApi.getNodeNeighborhood('run-1', {
      labels: 'WorkflowRun',
      relationshipTypes: 'HAS_STEP_RUN',
      depth: 2,
      limit: 25,
    });

    expect(getMock).toHaveBeenCalledWith('/graph/read/nodes/run-1/neighborhood', {
      query: {
        labels: 'WorkflowRun',
        relationship_types: 'HAS_STEP_RUN',
        depth: 2,
        limit: 25,
        include_deleted: undefined,
        include_operational_coverage: undefined,
        recent_run_limit: undefined,
        workflow_run_limit: undefined,
        incident_limit: undefined,
      },
      headers: undefined,
    });
  });

  it('requests progressive graph expansion with a preset', async () => {
    getMock.mockResolvedValue({ nodes: [], edges: [], meta: {} });

    await graphReadApi.expandNode('run-1', {
      preset: 'workflow_run',
      depth: 1,
      limit: 50,
    });

    expect(getMock).toHaveBeenCalledWith('/graph/read/nodes/run-1/expand', {
      query: {
        labels: undefined,
        relationship_types: undefined,
        depth: 1,
        limit: 50,
        include_deleted: undefined,
        preset: 'workflow_run',
        include_operational_coverage: undefined,
        recent_run_limit: undefined,
        workflow_run_limit: undefined,
        incident_limit: undefined,
      },
      headers: undefined,
    });
  });

  it('requests domain-specific graph neighborhoods', async () => {
    getMock.mockResolvedValue({ nodes: [], edges: [], meta: {} });

    await graphReadApi.getMemoryNeighborhood('memory-1', {
      depth: 2,
      limit: 75,
      includeDeleted: true,
    });

    expect(getMock).toHaveBeenCalledWith('/graph/read/memories/memory-1/neighborhood', {
      query: {
        depth: 2,
        limit: 75,
        include_deleted: true,
        include_operational_coverage: undefined,
        recent_run_limit: undefined,
        workflow_run_limit: undefined,
        incident_limit: undefined,
      },
      headers: undefined,
    });

    await graphReadApi.getEntityNeighborhood('entity:organization:acme-corp', {
      depth: 2,
      limit: 100,
    });

    expect(getMock).toHaveBeenCalledWith(
      '/graph/read/entities/entity:organization:acme-corp/neighborhood',
      {
        query: {
          depth: 2,
          limit: 100,
          include_deleted: undefined,
          include_operational_coverage: undefined,
          recent_run_limit: undefined,
          workflow_run_limit: undefined,
          incident_limit: undefined,
        },
        headers: undefined,
      }
    );
  });

  it('passes operational coverage bounds to domain-specific graph neighborhoods', async () => {
    getMock.mockResolvedValue({ nodes: [], edges: [], meta: {} });

    await graphReadApi.getWorkflowNeighborhood('workflow-1', {
      depth: 2,
      includeOperationalCoverage: true,
      incidentLimit: 12,
      limit: 250,
      recentRunLimit: 40,
      workflowRunLimit: 24,
    });

    expect(getMock).toHaveBeenCalledWith('/graph/read/workflows/workflow-1/neighborhood', {
      query: {
        depth: 2,
        include_deleted: undefined,
        include_operational_coverage: true,
        incident_limit: 12,
        limit: 250,
        recent_run_limit: 40,
        workflow_run_limit: 24,
      },
      headers: undefined,
    });
  });

  it('adds trusted identity headers when a user is provided', async () => {
    getMock.mockResolvedValue({ enabled: true, available: true, source: 'neo4j' });

    await graphReadApi.getStatus({
      id: 'dev-user',
      name: 'Dev User',
      email: 'dev@example.com',
      image: null,
      accessToken: null,
      authMode: 'dev',
    });

    expect(getMock).toHaveBeenCalledWith('/graph/read/status', {
      headers: expect.objectContaining({
        'x-agency-client': 'agency-fe',
        'x-agency-user-id': 'dev-user',
        'x-agency-user-email': 'dev@example.com',
        'x-agency-auth-provider': 'dev-auth',
      }),
    });
  });
});
