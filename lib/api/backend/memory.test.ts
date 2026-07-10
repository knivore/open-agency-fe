import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memoriesApi } from '@/lib/api/backend/memory';
import type { CompactBackfillPayload } from '@/types/memory';

const { postMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
}));

vi.mock('@/lib/api/clientInstances', () => ({
  agencyApiClient: {
    post: postMock,
  },
}));

describe('memoriesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts compact backfill requests to the backend memory admin route', async () => {
    postMock.mockResolvedValue({
      status: 'dry_run',
      processed: 1,
      created: 0,
      skipped: 0,
      failed: 0,
      results: [],
      progress: {
        total_steps: 1,
        completed_steps: 1,
        failed_steps: 0,
        events: [],
      },
    });

    const payload: CompactBackfillPayload = {
      conversation_id: 'conversation-1',
      user_id: 'user-1',
      workspace_id: 'workspace-1',
      workflow_id: 'workflow-1',
      mode: 'technical',
      strategy: 'deterministic',
      token_budget: 1600,
      source_range: 'older_than_recent',
      recent_message_limit: 4,
      scope: 'workflow',
      limit: 25,
      dry_run: true,
      confirmed: false,
      skip_existing: true,
      supersede_previous: false,
      idempotency_key: 'compact-backfill-1',
      model_profile_id: 'model-profile-1',
      custom_keep: ['decisions', 'tasks'],
      custom_drop: ['scratch'],
    };

    const result = await memoriesApi.backfillCompactPacks(payload);

    expect(postMock).toHaveBeenCalledWith('/memories/compact/backfill', payload);
    expect(result.status).toBe('dry_run');
  });
});
