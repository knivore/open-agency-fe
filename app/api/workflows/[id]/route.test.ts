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

vi.mock('@/lib/api/backend/users', () => ({
  backendUserToUser: vi.fn(),
  backendUsersApi: {},
}));

vi.mock('@/lib/api/backend/workflows', () => ({
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
        metadata: {},
      }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: 'workflow-1' }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: 'workflow-1' });
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

  it('rejects stale full workflow saves when the backend revision has advanced', async () => {
    workflowsApi.getWorkflow.mockResolvedValue({
      id: 'workflow-1',
      name: 'Existing Workflow',
      metadata: {},
      versioning: {
        version: '1.0.0',
        revision: 4,
        is_published: false,
      },
    });
    const request = new Request('http://localhost/api/workflows/workflow-1', {
      method: 'PUT',
      body: JSON.stringify({
        id: 'workflow-1',
        name: 'Updated Workflow',
        description: 'Updated description',
        nodes: [],
        edges: [],
        task_definitions: [],
        agent_definitions: [],
        versioning: {
          version: '1.0.0',
          revision: 3,
          is_published: false,
        },
      }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: 'workflow-1' }) });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      current_revision: 4,
      draft_revision: 3,
    });
    expect(backendWorkflowsApi.updateWorkflow).not.toHaveBeenCalled();
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

  it('strips read-only operator data from full workflow definition updates', async () => {
    const request = new Request('http://localhost/api/workflows/workflow-1', {
      method: 'PUT',
      body: JSON.stringify({
        id: 'workflow-1',
        name: 'Updated Workflow',
        description: 'Updated description',
        nodes: [],
        edges: [],
        task_definitions: [],
        agent_definitions: [],
        monitoring: {
          enabled: false,
          level: 'off',
        },
        runtime_governance: {
          workflow_id: 'workflow-1',
          token_budget: {
            configured: true,
            run_total_tokens: 100000,
            workflow_total_tokens: null,
            agent_total_tokens: null,
            warn_ratio: 0.8,
            hard_ratio: 1,
            action: 'compact_context',
          },
          context_compaction: {
            enabled: true,
            persist_context_pack: false,
            persist_context_pack_source: 'workflow',
            preserve_recent_messages: 3,
            oversized_message_tokens: 600,
            min_estimated_tokens_saved: 50,
            max_summary_chars: 5000,
          },
        },
      }),
    });

    await PUT(request, { params: Promise.resolve({ id: 'workflow-1' }) });

    expect(backendWorkflowsApi.updateWorkflow).toHaveBeenCalledWith(
      'workflow-1',
      expect.not.objectContaining({
        monitoring: expect.anything(),
      }),
      user,
      'internal-key'
    );
    expect(backendWorkflowsApi.updateWorkflow).toHaveBeenCalledWith(
      'workflow-1',
      expect.not.objectContaining({
        runtime_governance: expect.anything(),
      }),
      user,
      'internal-key'
    );
  });

  it('moves frontend memory definitions into metadata before backend update', async () => {
    const request = new Request('http://localhost/api/workflows/workflow-1', {
      method: 'PUT',
      body: JSON.stringify({
        id: 'workflow-1',
        name: 'Updated Workflow',
        description: 'Updated description',
        nodes: [],
        edges: [],
        task_definitions: [],
        agent_definitions: [],
        memory_definitions: [
          {
            id: 'memory-1',
            name: 'Workflow Memory',
            description: 'Shared context',
            memory_type: 'workflow',
            scope: 'workflow',
          },
        ],
      }),
    });

    await PUT(request, { params: Promise.resolve({ id: 'workflow-1' }) });

    expect(backendWorkflowsApi.updateWorkflow).toHaveBeenCalledWith(
      'workflow-1',
      expect.objectContaining({
        metadata: expect.objectContaining({
          workflow_memory_definitions: [
            expect.objectContaining({
              id: 'memory-1',
              name: 'Workflow Memory',
            }),
          ],
        }),
      }),
      user,
      'internal-key'
    );
    expect(backendWorkflowsApi.updateWorkflow).toHaveBeenCalledWith(
      'workflow-1',
      expect.not.objectContaining({
        memory_definitions: expect.anything(),
      }),
      user,
      'internal-key'
    );
  });

  it('strips frontend memory assignment fields from full workflow updates', async () => {
    const request = new Request('http://localhost/api/workflows/workflow-1', {
      method: 'PUT',
      body: JSON.stringify({
        id: 'workflow-1',
        name: 'Updated Workflow',
        description: 'Updated description',
        nodes: [],
        edges: [],
        task_definitions: [
          {
            id: 'task-a',
            name: 'Task A',
            description: 'Do it',
            instructions: 'Do it',
            expected_output: 'Done',
            agent_id: 'agent-a',
            memory_ids: [],
            memoryIds: [],
            depends_on_task_ids: [],
          },
        ],
        agent_definitions: [
          {
            id: 'agent-a',
            name: 'Agent A',
            memory_ids: [],
            memoryIds: [],
          },
        ],
      }),
    });

    await PUT(request, { params: Promise.resolve({ id: 'workflow-1' }) });

    const payload = backendWorkflowsApi.updateWorkflow.mock.calls[0]?.[1];
    expect(payload).toMatchObject({
      task_definitions: [
        expect.not.objectContaining({
          memory_ids: expect.anything(),
          memoryIds: expect.anything(),
        }),
      ],
      agent_definitions: [
        expect.not.objectContaining({
          memory_ids: expect.anything(),
          memoryIds: expect.anything(),
        }),
      ],
    });
  });

  it('preserves supported connector security for dangerous HTTP tools', async () => {
    const request = new Request('http://localhost/api/workflows/workflow-1', {
      method: 'PUT',
      body: JSON.stringify({
        id: 'workflow-1',
        name: 'Updated Workflow',
        description: 'Updated description',
        nodes: [],
        edges: [],
        task_definitions: [],
        agent_definitions: [
          {
            id: 'agent-a',
            name: 'Agent A',
            tool_ids: ['send-http-request'],
          },
        ],
        tool_definitions: [
          {
            id: 'send-http-request',
            name: 'send_http_request',
            display_name: 'Send HTTP Request',
            description: 'Send an HTTP request to an external service.',
            tool_type: 'python_function',
            implementation: {
              target: 'app.tools.http',
              callable_name: 'send_http_request',
              config: {},
            },
            security: {
              connector_bindings: [],
            },
          },
        ],
      }),
    });

    await PUT(request, { params: Promise.resolve({ id: 'workflow-1' }) });

    const payload = backendWorkflowsApi.updateWorkflow.mock.calls[0]?.[1];
    expect(payload).toMatchObject({
      tool_definitions: [
        expect.objectContaining({
          id: 'send-http-request',
          security: {
            connector_bindings: [],
          },
        }),
      ],
    });
  });
});
