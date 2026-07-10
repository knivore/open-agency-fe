import { beforeEach, describe, expect, it, vi } from 'vitest';
import { workflowsApi } from '@/lib/api/backend/workflows';

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
});
