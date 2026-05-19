import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PUT } from '@/app/api/workflows/[id]/route';

const {
  backendWorkflowsApi,
  getAuthenticatedUser,
  getInternalApiKey,
  syncCurrentBackendUser,
  workflowsApi,
} = vi.hoisted(() => ({
  backendWorkflowsApi: {
    updateWorkflow: vi.fn(),
  },
  getAuthenticatedUser: vi.fn(),
  getInternalApiKey: vi.fn(),
  syncCurrentBackendUser: vi.fn(),
  workflowsApi: {
    getWorkflow: vi.fn(),
  },
}));

vi.mock('@/lib/api/backend', () => ({
  backendWorkflowsApi,
  workflowsApi,
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
  accessToken: null,
  authMode: 'dev' as const,
};

describe('workflow detail route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedUser.mockResolvedValue(user);
    getInternalApiKey.mockReturnValue('internal-key');
    syncCurrentBackendUser.mockResolvedValue({});
    workflowsApi.getWorkflow.mockResolvedValue({
      id: 'workflow-1',
      name: 'Existing Workflow',
      description: 'Existing description',
      metadata: {
        owner_ids: ['user-1'],
      },
    });
    backendWorkflowsApi.updateWorkflow.mockResolvedValue({
      id: 'workflow-1',
    });
  });

  it('preserves runtime adapter fields when saving a full workflow definition', async () => {
    const request = new Request('http://localhost/api/workflows/workflow-1', {
      method: 'PUT',
      body: JSON.stringify({
        id: 'workflow-1',
        name: 'Updated Workflow',
        description: 'Updated description',
        entrypoint: 'task-a',
        nodes: [
          {
            id: 'node-task-a',
            name: 'Task A',
            node_type: 'task',
            task_id: 'task-a',
            metadata: {},
          },
        ],
        edges: [],
        task_definitions: [
          {
            id: 'task-a',
            name: 'Task A',
            description: 'Do it',
            instructions: 'Do it',
            expected_output: 'Done',
            agent_id: null,
            depends_on_task_ids: [],
          },
        ],
        agent_definitions: [],
        default_runtime_adapter_id: 'native',
        allowed_runtime_adapter_ids: ['native', 'crewai'],
        metadata: {
        },
      }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: 'workflow-1' }) });

    expect(response.status).toBe(200);
    expect(backendWorkflowsApi.updateWorkflow).toHaveBeenCalledWith(
      'workflow-1',
      expect.objectContaining({
        default_runtime_adapter_id: 'native',
        allowed_runtime_adapter_ids: ['native', 'crewai'],
        metadata: {
          owner_ids: ['user-1'],
        },
      }),
      user,
      'internal-key'
    );
  });

  it('adds the default runtime adapter to allowed adapters before updating', async () => {
    const request = new Request('http://localhost/api/workflows/workflow-1', {
      method: 'PUT',
      body: JSON.stringify({
        id: 'workflow-1',
        name: 'Updated Workflow',
        description: 'Updated description',
        entrypoint: 'task-a',
        nodes: [],
        edges: [],
        task_definitions: [],
        agent_definitions: [],
        default_runtime_adapter_id: 'native',
        allowed_runtime_adapter_ids: ['crewai'],
      }),
    });

    await PUT(request, { params: Promise.resolve({ id: 'workflow-1' }) });

    expect(backendWorkflowsApi.updateWorkflow).toHaveBeenCalledWith(
      'workflow-1',
      expect.objectContaining({
        default_runtime_adapter_id: 'native',
        allowed_runtime_adapter_ids: ['crewai', 'native'],
      }),
      user,
      'internal-key'
    );
  });

  it('treats workflow definitions without an entrypoint as full workflow saves', async () => {
    const request = new Request('http://localhost/api/workflows/workflow-1', {
      method: 'PUT',
      body: JSON.stringify({
        id: 'workflow-1',
        name: 'Updated Workflow',
        description: 'Updated description',
        nodes: [
          {
            id: 'node-task-a',
            name: 'Task A',
            node_type: 'task',
            task_id: 'task-a',
            metadata: {},
          },
        ],
        edges: [],
        task_definitions: [
          {
            id: 'task-a',
            name: 'Task A',
            description: 'Do it',
            instructions: 'Do it',
            expected_output: 'Done',
            agent_id: null,
            depends_on_task_ids: [],
          },
        ],
        agent_definitions: [],
        default_runtime_adapter_id: 'native',
        allowed_runtime_adapter_ids: ['native'],
      }),
    });

    await PUT(request, { params: Promise.resolve({ id: 'workflow-1' }) });

    expect(backendWorkflowsApi.updateWorkflow).toHaveBeenCalledWith(
      'workflow-1',
      expect.objectContaining({
        nodes: expect.arrayContaining([expect.objectContaining({ id: 'node-task-a' })]),
        task_definitions: expect.arrayContaining([expect.objectContaining({ id: 'task-a' })]),
        default_runtime_adapter_id: 'native',
        allowed_runtime_adapter_ids: ['native'],
      }),
      user,
      'internal-key'
    );
  });
});
