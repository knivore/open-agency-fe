import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { graphStreamUrlWithAfter, useAgencyGraphRealtimeDocument } from './realtime';
import type { SigmaGraphDocument } from '@/modules/sigma-graph/types';

class MockEventSource {
  static instances: MockEventSource[] = [];
  static readonly CLOSED = 2;

  readonly listeners = new Map<string, Set<(event: MessageEvent) => void>>();
  readonly url: string;
  readyState = 0;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(eventName: string, listener: (event: MessageEvent) => void) {
    const listeners = this.listeners.get(eventName) || new Set();
    listeners.add(listener);
    this.listeners.set(eventName, listeners);
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
  }

  emit(eventName: string, payload: unknown) {
    const event = {
      data: typeof payload === 'string' ? payload : JSON.stringify(payload),
    } as MessageEvent;
    for (const listener of this.listeners.get(eventName) || []) {
      listener(event);
    }
  }
}

const snapshot: SigmaGraphDocument = {
  schemaVersion: 'sigma.graph.document.v1',
  nodes: [{ id: 'run-1', type: 'WorkflowRun', label: 'Run One' }],
  edges: [],
};

function RealtimeHarness({
  enabled = true,
  onReconnect,
  reconnectDelayMs = 1000,
  streamUrl = '/api/graph-stream/deltas?execution_id=run-1',
  statusPollMs = 1000,
}: {
  enabled?: boolean;
  onReconnect?: Parameters<typeof useAgencyGraphRealtimeDocument>[0]['onReconnect'];
  reconnectDelayMs?: number;
  streamUrl?: string | null;
  statusPollMs?: number;
}) {
  const { document, lastDeltaEventId, realtimeStatus } = useAgencyGraphRealtimeDocument({
    snapshotDocument: snapshot,
    enabled,
    onReconnect,
    reconnectDelayMs,
    streamUrl,
    statusPollMs,
  });

  return (
    <div>
      <span data-testid="status">{realtimeStatus}</span>
      <span data-testid="count">{document?.nodes.length ?? 0} nodes</span>
      <span data-testid="delta">{lastDeltaEventId ?? 'none'}</span>
    </div>
  );
}

describe('useAgencyGraphRealtimeDocument', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    MockEventSource.instances = [];
  });

  it('loads the snapshot and applies graph deltas from EventSource', async () => {
    vi.stubGlobal('EventSource', MockEventSource);

    render(<RealtimeHarness />);

    expect(await screen.findByTestId('count')).toHaveTextContent('1 nodes');
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    expect(MockEventSource.instances[0]?.url).toBe('/api/graph-stream/deltas?execution_id=run-1');

    act(() => {
      MockEventSource.instances[0]?.emit('graph_delta', {
        upsertNodes: [{ id: 'step-1', type: 'StepRun', label: 'Step One' }],
        upsertEdges: [
          {
            id: 'run-1:HAS_STEP_RUN:step-1',
            source: 'run-1',
            target: 'step-1',
            type: 'HAS_STEP_RUN',
          },
        ],
        metadata: { eventId: 'projection-event-1' },
      });
    });

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('2 nodes'));
    expect(screen.getByTestId('delta')).toHaveTextContent('projection-event-1');
  });

  it('does not open a stream when realtime is disabled', async () => {
    vi.stubGlobal('EventSource', MockEventSource);

    render(<RealtimeHarness enabled={false} />);

    expect(await screen.findByTestId('count')).toHaveTextContent('1 nodes');
    expect(screen.getByTestId('status')).toHaveTextContent('closed');
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('reconnects with the last delta event id and reports reconnects', async () => {
    vi.stubGlobal('EventSource', MockEventSource);
    const onReconnect = vi.fn();

    render(<RealtimeHarness onReconnect={onReconnect} reconnectDelayMs={1} statusPollMs={1} />);

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    act(() => {
      MockEventSource.instances[0]?.emit('graph_delta', {
        upsertNodes: [{ id: 'step-1', type: 'StepRun', label: 'Step One' }],
        metadata: { eventId: 'projection-event-1' },
      });
    });
    await waitFor(() =>
      expect(screen.getByTestId('delta')).toHaveTextContent('projection-event-1')
    );

    act(() => {
      MockEventSource.instances[0]?.emit('error', '');
    });

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(2));
    expect(MockEventSource.instances[1]?.url).toBe(
      '/api/graph-stream/deltas?execution_id=run-1&after=projection-event-1'
    );

    act(() => {
      MockEventSource.instances[1]?.emit('open', '');
    });

    await waitFor(() =>
      expect(onReconnect).toHaveBeenCalledWith({
        afterEventId: 'projection-event-1',
        reconnectAttempt: 1,
        streamUrl: '/api/graph-stream/deltas?execution_id=run-1&after=projection-event-1',
      })
    );
  });
});

describe('graphStreamUrlWithAfter', () => {
  it('adds or replaces after on relative and absolute stream URLs', () => {
    expect(graphStreamUrlWithAfter('/api/graph-stream/deltas?execution_id=run-1', 'event-1')).toBe(
      '/api/graph-stream/deltas?execution_id=run-1&after=event-1'
    );
    expect(
      graphStreamUrlWithAfter('http://backend.test/graph/stream/deltas?after=old', 'new')
    ).toBe('http://backend.test/graph/stream/deltas?after=new');
  });
});
