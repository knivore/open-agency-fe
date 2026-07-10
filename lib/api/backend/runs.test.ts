import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runsApi } from '@/lib/api/backend/runs';

const { appApiClient, executionsApi, workflowsApi } = vi.hoisted(() => ({
  appApiClient: {
    post: vi.fn(),
  },
  executionsApi: {
    listAgentRuns: vi.fn(),
    listActiveAgentRuns: vi.fn(),
    getAgentRun: vi.fn(),
    createExecution: vi.fn(),
    startExecution: vi.fn(),
    pauseExecution: vi.fn(),
    resumeExecution: vi.fn(),
    retryExecutionTask: vi.fn(),
    resumeExecutionFromCheckpoint: vi.fn(),
    cancelExecution: vi.fn(),
  },
  workflowsApi: {
    listWorkflowRuns: vi.fn(),
  },
}));

vi.mock('@/lib/api/clientInstances', () => ({
  appApiClient,
}));

vi.mock('@/lib/api/backend/executions', () => ({
  executionsApi,
}));

vi.mock('@/lib/api/backend/workflows', () => ({
  workflowsApi,
}));

describe('runsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes workflows when called without the runsApi receiver', async () => {
    appApiClient.post.mockResolvedValue({
      process_id: 'run-1',
      status: 'queued',
      execution: {
        id: 'run-1',
        workflow_id: 'workflow-1',
        runtime_adapter_id: 'adapter-a',
        status: 'running',
        trigger_type: 'manual',
        created_at: '2026-05-14T00:00:00.000Z',
        started_at: null,
        completed_at: null,
        created_by: null,
        error: null,
      },
    });

    const executeWorkflow = runsApi.executeWorkflow;
    const run = await executeWorkflow('workflow-1', 'adapter-a', 'docker');

    expect(appApiClient.post).toHaveBeenCalledWith('/api/workflows/run/workflow-1', {
      inputs: {},
      taskOrder: [],
      runtimeAdapterId: 'adapter-a',
      executionHost: 'docker',
    });
    expect(executionsApi.createExecution).not.toHaveBeenCalled();
    expect(executionsApi.startExecution).not.toHaveBeenCalled();
    expect(run).toEqual({
      id: 'run-1',
      workflowId: 'workflow-1',
      runtimeAdapterId: 'adapter-a',
      status: 'running',
      runtimeRevisionId: null,
      runtimeFingerprint: null,
      triggerType: 'manual',
      createdAt: '2026-05-14T00:00:00.000Z',
      startedAt: null,
      completedAt: null,
      updatedAt: null,
      createdBy: null,
      currentNodeId: null,
      workerId: null,
      lastHeartbeatAt: null,
      container: {
        containerId: null,
        containerName: null,
        image: null,
        status: null,
        startedAt: null,
        endedAt: null,
        exitCode: null,
      },
      replacementOfExecutionId: null,
      restartReason: null,
      metadata: undefined,
      inputPayload: null,
      outputPayload: null,
      error: null,
    });
  });

  it('retries a failed execution task through the executions API', async () => {
    executionsApi.retryExecutionTask.mockResolvedValue({
      status: 'queued',
      replacement_execution_id: 'run-retry-1',
    });

    await runsApi.retryTask('run-failed-1', 'task-1', 'retry from graph');

    expect(executionsApi.retryExecutionTask).toHaveBeenCalledWith(
      'run-failed-1',
      'task-1',
      'retry from graph'
    );
  });

  it('resumes an execution from checkpoint through the executions API', async () => {
    executionsApi.resumeExecutionFromCheckpoint.mockResolvedValue({
      status: 'queued',
      replacement_execution_id: 'run-resume-1',
    });

    await runsApi.resumeFromCheckpoint('run-failed-1', 'resume checkpoint');

    expect(executionsApi.resumeExecutionFromCheckpoint).toHaveBeenCalledWith(
      'run-failed-1',
      'resume checkpoint'
    );
  });
});
