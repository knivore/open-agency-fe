import { beforeEach, describe, expect, it, vi } from 'vitest';
import { observabilityApi } from '@/lib/api/backend/observability';

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock('@/lib/api/clientInstances', () => ({
  agencyApiClient: {
    get: getMock,
  },
}));

describe('observabilityApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests execution projection graphs with bounded traversal params', async () => {
    getMock.mockResolvedValue({
      available: true,
      reason: null,
      graph: { nodes: [], edges: [], meta: {} },
    });

    await observabilityApi.getExecutionProjectionGraph('run-1', {
      depth: 2,
      limit: 50,
      includeDeleted: true,
    });

    expect(getMock).toHaveBeenCalledWith('/observability/executions/run-1/graph', {
      query: {
        depth: 2,
        limit: 50,
        include_deleted: true,
      },
    });
  });

  it('requests workflow projection graphs', async () => {
    getMock.mockResolvedValue({
      available: false,
      reason: 'disabled',
      graph: { nodes: [], edges: [], meta: {} },
    });

    await observabilityApi.getWorkflowProjectionGraph('workflow-1', {
      limit: 25,
    });

    expect(getMock).toHaveBeenCalledWith('/observability/workflows/workflow-1/graph', {
      query: {
        depth: undefined,
        limit: 25,
        include_deleted: undefined,
      },
    });
  });

  it('requests model usage with governance filters', async () => {
    getMock.mockResolvedValue({ items: [], filters: {}, system: {} });

    await observabilityApi.getModelUsage({
      workflowId: 'workflow-1',
      agentId: 'agent-1',
      executionId: 'run-1',
      provider: 'openai',
      model: 'gpt-4.1-mini',
    });

    expect(getMock).toHaveBeenCalledWith('/observability/models/usage', {
      query: {
        workflow_id: 'workflow-1',
        agent_id: 'agent-1',
        execution_id: 'run-1',
        provider: 'openai',
        model: 'gpt-4.1-mini',
      },
    });
  });
});
