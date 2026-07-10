import { describe, expect, it, vi } from 'vitest';

const apiBaseUrlMock = vi.hoisted(() => ({
  value: '/backend',
}));

vi.mock('@/lib/api/config', () => ({
  getAgencyApiBaseUrl: () => apiBaseUrlMock.value,
}));

describe('graph stream API helpers', () => {
  it('uses the same-origin graph stream proxy when backend base URL is relative', async () => {
    const { buildGraphDeltaStreamUrl } = await import('./graphStream');

    apiBaseUrlMock.value = '/backend';

    expect(
      buildGraphDeltaStreamUrl({
        after: 'event-1',
        executionId: 'run-1',
        workflowId: 'workflow-1',
        aggregateType: 'workflow_run',
        eventTypes: ['execution.started', 'task.started'],
        heartbeatSeconds: 5,
        pollSeconds: 1,
        retryMs: 1000,
        limit: 25,
      })
    ).toBe(
      '/api/graph-stream/deltas?after=event-1&execution_id=run-1&workflow_id=workflow-1&aggregate_type=workflow_run&event_types=execution.started%2Ctask.started&heartbeat_seconds=5&poll_seconds=1&retry_ms=1000&limit=25'
    );
  });

  it('uses direct backend graph stream URLs when backend base URL is absolute', async () => {
    const { buildGraphDeltaStreamUrl } = await import('./graphStream');

    apiBaseUrlMock.value = 'http://127.0.0.1:8001';

    expect(buildGraphDeltaStreamUrl({ executionId: 'run-1', pollSeconds: 1 })).toBe(
      'http://127.0.0.1:8001/graph/stream/deltas?execution_id=run-1&poll_seconds=1'
    );
  });
});
