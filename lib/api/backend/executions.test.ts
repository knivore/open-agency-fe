import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executionsApi } from '@/lib/api/backend/executions';

const { agencyGetMock, agencyPostMock } = vi.hoisted(() => ({
  agencyGetMock: vi.fn(),
  agencyPostMock: vi.fn(),
}));

vi.mock('@/lib/api/clientInstances', () => ({
  agencyApiClient: {
    get: agencyGetMock,
    post: agencyPostMock,
  },
}));

const user = {
  id: 'user-123',
  name: 'Test User',
  email: 'test@example.com',
  image: null,
  accessToken: null,
  authMode: 'prod' as const,
};

describe('executionsApi identity forwarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards current user headers when starting a workflow execution', async () => {
    agencyPostMock.mockResolvedValue({ process_id: 'proc-1', status: 'queued' });

    await executionsApi.startWorkflowExecution(
      'workflow-1',
      {
        input: { inputs: {}, taskOrder: [], agentConfigs: {} },
        trigger: { type: 'manual', requested_by: user.id },
        runtimeAdapterId: 'native',
        executionHost: 'docker',
      },
      user,
      'internal-key'
    );

    expect(agencyPostMock).toHaveBeenCalledWith(
      '/workflows/workflow-1/executions/start',
      expect.objectContaining({
        runtime_adapter_id: 'native',
        execution_host: 'docker',
      }),
      {
        headers: expect.objectContaining({
          'x-agency-user-id': user.id,
          'x-agency-user-email': user.email,
          'x-agency-user-name': user.name,
          'x-agency-auth-provider': 'nextauth',
          'x-agency-provider-subject': user.id,
          'x-agency-provider-account-id': user.email,
          'x-agency-internal-api-key': 'internal-key',
        }),
      }
    );
    expect(agencyPostMock.mock.calls[0][1]).not.toHaveProperty('runtimeAdapterId');
    expect(agencyPostMock.mock.calls[0][1]).not.toHaveProperty('executionHost');
  });

  it('forwards current user headers when fetching execution status', async () => {
    agencyGetMock.mockResolvedValue({ execution: { id: 'exec-1' } });

    await executionsApi.getExecution('exec-1', user, 'internal-key');

    expect(agencyGetMock).toHaveBeenCalledWith('/executions/exec-1', {
      headers: expect.objectContaining({
        'x-agency-user-id': user.id,
        'x-agency-internal-api-key': 'internal-key',
      }),
    });
  });

  it('preserves anonymous behavior for callers that do not provide a user', async () => {
    agencyPostMock.mockResolvedValue({ process_id: 'proc-1', status: 'queued' });

    await executionsApi.startWorkflowExecution('workflow-1', {
      input: { inputs: {}, taskOrder: [], agentConfigs: {} },
      trigger: { type: 'manual', requested_by: null },
    });

    expect(agencyPostMock).toHaveBeenCalledWith(
      '/workflows/workflow-1/executions/start',
      expect.any(Object),
      undefined
    );
  });

  it('posts task retry requests to the execution task retry endpoint', async () => {
    agencyPostMock.mockResolvedValue({
      status: 'queued',
      replacement_execution_id: 'exec-retry-1',
    });

    await executionsApi.retryExecutionTask('exec-failed-1', 'task-1', 'retry from graph', user);

    expect(agencyPostMock).toHaveBeenCalledWith(
      '/executions/exec-failed-1/tasks/task-1/retry',
      { reason: 'retry from graph' },
      {
        headers: expect.objectContaining({
          'x-agency-user-id': user.id,
        }),
      }
    );
  });

  it('posts checkpoint resume requests to the execution checkpoint endpoint', async () => {
    agencyPostMock.mockResolvedValue({
      status: 'queued',
      replacement_execution_id: 'exec-resume-1',
    });

    await executionsApi.resumeExecutionFromCheckpoint('exec-failed-1', 'resume checkpoint', user);

    expect(agencyPostMock).toHaveBeenCalledWith(
      '/executions/exec-failed-1/resume-from-checkpoint',
      { reason: 'resume checkpoint' },
      {
        headers: expect.objectContaining({
          'x-agency-user-id': user.id,
        }),
      }
    );
  });
});
