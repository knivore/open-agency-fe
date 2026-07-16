import { beforeEach, describe, expect, it, vi } from 'vitest';
import { backendWorkflowsApi, workflowsApi } from '@/lib/api/backend/workflows';

const { agencyGetMock, appGetMock, postMock } = vi.hoisted(() => ({
  agencyGetMock: vi.fn(),
  appGetMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock('@/lib/api/clientInstances', () => ({
  agencyApiClient: {
    get: agencyGetMock,
  },
  appApiClient: {
    get: appGetMock,
    post: postMock,
  },
}));

describe('workflowsApi persona version endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses workflow persona version notice and action routes', async () => {
    agencyGetMock.mockResolvedValue({ items: [] });
    appGetMock.mockResolvedValue({ items: [] });
    postMock.mockResolvedValue({ workflow: { id: 'workflow-1' } });

    await workflowsApi.listWorkflowPersonaVersionNotices('workflow-1');
    await workflowsApi.listWorkflowVersions('workflow-1');
    await workflowsApi.getWorkflowVersion('workflow-1', 3);
    await workflowsApi.useLatestPersonaAgent('workflow-1', 'agent-1');
    await workflowsApi.keepCurrentPersonaAgent('workflow-1', 'agent-1');
    await workflowsApi.promoteWorkflowAgent('workflow-1', 'agent-1', {
      global_agent_id: 'catalog-agent-1',
      replace_workflow_agent: true,
    });
    await workflowsApi.createWorkflowSteeringApproval('workflow-1', {
      recommendedAction: 'request_replan',
      reason: 'Selected from graph node.',
      targetTaskId: 'task-1',
      operatorParameters: { instructions: 'Replan this task.' },
    });

    expect(appGetMock).toHaveBeenCalledWith('/api/workflows/workflow-1/persona-version-notices');
    expect(agencyGetMock).toHaveBeenCalledWith('/workflows/workflow-1/versions');
    expect(agencyGetMock).toHaveBeenCalledWith('/workflows/workflow-1/versions/3');
    expect(postMock).toHaveBeenCalledWith(
      '/api/workflows/workflow-1/persona-agents/agent-1/use-latest',
      {}
    );
    expect(postMock).toHaveBeenCalledWith(
      '/api/workflows/workflow-1/persona-agents/agent-1/keep-current',
      {}
    );
    expect(postMock).toHaveBeenCalledWith('/api/workflows/workflow-1/agents/agent-1/promote', {
      global_agent_id: 'catalog-agent-1',
      replace_workflow_agent: true,
    });
    expect(postMock).toHaveBeenCalledWith('/api/workflows/workflow-1/steering-approvals', {
      recommendedAction: 'request_replan',
      reason: 'Selected from graph node.',
      targetTaskId: 'task-1',
      operatorParameters: { instructions: 'Replan this task.' },
    });
  });

  it('clones workflows through the authenticated frontend route', async () => {
    postMock.mockResolvedValue({ data: { id: 'workflow-copy' } });

    await expect(workflowsApi.cloneWorkflow('workflow-1')).resolves.toEqual({
      id: 'workflow-copy',
    });
    expect(postMock).toHaveBeenCalledWith('/api/workflows/workflow-1', {});
  });

  it('forwards BFF identity when reading a workflow for a server-side mutation', async () => {
    agencyGetMock.mockResolvedValue({ id: 'workflow-1' });
    const user = {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      image: null,
      accessToken: null,
      authMode: 'dev' as const,
    };

    await backendWorkflowsApi.getWorkflow('workflow-1', user, 'internal-key');

    expect(agencyGetMock).toHaveBeenCalledWith('/workflows/workflow-1', {
      headers: expect.objectContaining({
        'x-agency-user-id': user.id,
        'x-agency-internal-api-key': 'internal-key',
      }),
    });
  });

  it('forwards BFF identity when listing workflows from a server route', async () => {
    agencyGetMock.mockResolvedValue({ items: [] });
    const user = {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      image: null,
      accessToken: null,
      authMode: 'dev' as const,
    };

    await backendWorkflowsApi.listWorkflows(user, 'internal-key');

    expect(agencyGetMock).toHaveBeenCalledWith('/workflows', {
      headers: expect.objectContaining({
        'x-agency-user-id': user.id,
        'x-agency-internal-api-key': 'internal-key',
      }),
    });
  });
});
