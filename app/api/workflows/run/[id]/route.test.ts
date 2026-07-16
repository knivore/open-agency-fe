import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/workflows/run/[id]/route';

const {
  backendWorkflowsApi,
  executionsApi,
  getAuthenticatedUser,
  getInternalApiKey,
  syncCurrentBackendUser,
} = vi.hoisted(() => ({
  backendWorkflowsApi: {
    getWorkflow: vi.fn(),
  },
  executionsApi: {
    startWorkflowExecution: vi.fn(),
  },
  getAuthenticatedUser: vi.fn(),
  getInternalApiKey: vi.fn(),
  syncCurrentBackendUser: vi.fn(),
}));

vi.mock('@/lib/api/backend/workflows', () => ({ backendWorkflowsApi }));
vi.mock('@/lib/api/backend/executions', () => ({ executionsApi }));
vi.mock('@/lib/api/backend/agentTransforms', () => ({
  toAgentRun: (execution: { id: string }) => ({ id: execution.id }),
}));
vi.mock('@/app/api/backend-users/utils', () => ({
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse: (error: unknown) =>
    Response.json({ message: error instanceof Error ? error.message : 'failed' }, { status: 500 }),
  syncCurrentBackendUser,
  unauthorizedResponse: () => Response.json({ message: 'Unauthorized' }, { status: 401 }),
}));

const user = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  image: null,
  accessToken: 'agt-session',
  authMode: 'dev' as const,
};

describe('POST /api/workflows/run/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedUser.mockResolvedValue(user);
    getInternalApiKey.mockReturnValue('internal-key');
    syncCurrentBackendUser.mockResolvedValue({});
    backendWorkflowsApi.getWorkflow.mockResolvedValue({
      id: 'workflow-1',
      name: 'Workflow One',
      description: 'Test workflow',
      nodes: [],
      edges: [],
      task_definitions: [],
      agent_definitions: [],
      allowed_runtime_adapter_ids: ['native'],
      default_runtime_adapter_id: 'native',
      metadata: {},
    });
    executionsApi.startWorkflowExecution.mockResolvedValue({
      execution: {
        id: 'run-1',
        workflow_id: 'workflow-1',
        status: 'queued',
      },
      process_id: 'process-1',
      status: 'queued',
    });
  });

  it('forwards the authenticated identity through workflow lookup and execution start', async () => {
    const request = new Request('http://localhost/api/workflows/run/workflow-1', {
      method: 'POST',
      body: JSON.stringify({
        inputs: {},
        taskOrder: [],
        runtimeAdapterId: 'native',
        executionHost: 'local',
      }),
    }) as NextRequest;

    const response = await POST(request, {
      params: Promise.resolve({ id: 'workflow-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      process_id: 'process-1',
      run_id: 'run-1',
      status: 'queued',
    });
    expect(syncCurrentBackendUser).toHaveBeenCalledWith(user);
    expect(backendWorkflowsApi.getWorkflow).toHaveBeenCalledWith(
      'workflow-1',
      user,
      'internal-key'
    );
    expect(executionsApi.startWorkflowExecution).toHaveBeenCalledWith(
      'workflow-1',
      expect.objectContaining({
        runtimeAdapterId: 'native',
        executionHost: 'local',
      }),
      user,
      'internal-key'
    );
  });
});
