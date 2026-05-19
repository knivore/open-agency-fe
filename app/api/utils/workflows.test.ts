import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startWorkflowById } from '@/app/api/utils/workflows';

const { appPostMock } = vi.hoisted(() => ({
  appPostMock: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  appApiClient: {
    post: appPostMock,
  },
}));

vi.mock('@/lib/api/backend', () => ({
  workflowsApi: {},
}));

describe('startWorkflowById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts per-run llm overrides inside agentConfigs', async () => {
    appPostMock.mockResolvedValue({ process_id: 'proc-1', status: 'queued' });

    await startWorkflowById(
      'workflow-1',
      { prompt: 'hello' },
      ['task-1'],
      {
        'agent-1': {
          tool_configs: [],
          model_profile_id: 'profile-ollama',
          llm_override: {
            provider: 'openai_compatible',
            model: 'openai/llama3.2',
            base_url: 'http://host.docker.internal:11434/v1',
            api_key: 'ollama',
          },
        },
      },
      'crewai',
      'docker'
    );

    expect(appPostMock).toHaveBeenCalledWith('/api/workflows/run/workflow-1', {
      inputs: { prompt: 'hello' },
      taskOrder: ['task-1'],
      agentConfigs: {
        'agent-1': {
          tool_configs: [],
          model_profile_id: 'profile-ollama',
          llm_override: {
            provider: 'openai_compatible',
            model: 'openai/llama3.2',
            base_url: 'http://host.docker.internal:11434/v1',
            api_key: 'ollama',
          },
        },
      },
      runtimeAdapterId: 'crewai',
      executionHost: 'docker',
    });
  });
});
