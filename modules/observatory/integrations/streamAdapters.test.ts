import { describe, expect, it } from 'vitest';

import {
  createObservatorySseAdapter,
  type ObservatoryEventSourceLike,
} from '@/modules/observatory/integrations/sseAdapter';
import type { ObservatoryStreamAdapterStatus } from '@/modules/observatory/integrations/streamAdapterTypes';
import {
  ingestObservatoryStreamPayload,
  OBSERVATORY_DEFAULT_MAX_STREAM_PAYLOAD_BYTES,
} from '@/modules/observatory/integrations/streamPayload';
import {
  createObservatoryWebSocketAdapter,
  type ObservatoryWebSocketLike,
} from '@/modules/observatory/integrations/webSocketAdapter';
import {
  AGENCY_RUNTIME_EVENT_SCHEMA_VERSION,
  type ObservatoryExternalRuntimeEvent,
} from '@/modules/observatory/runtime/events';
import {
  createInitialObservatoryRuntimeVisualState,
  type ObservatoryRuntimeVisualState,
} from '@/modules/observatory/runtime/visualState';

function rawEvent(
  overrides: Partial<ObservatoryExternalRuntimeEvent> = {}
): ObservatoryExternalRuntimeEvent {
  return {
    id: 'evt:stream-test',
    source: 'stream-test',
    sourceType: 'custom',
    timestamp: '2026-05-09T00:00:00.000Z',
    type: 'task_progress',
    actor: {
      id: 'agent:atlas',
      name: 'Atlas',
    },
    task: {
      id: 'task:stream',
      progress: 0.65,
      title: 'Stream adapter test',
    },
    workflow: {
      id: 'workflow:stream',
      roomId: 'room:runtime-floor',
    },
    ...overrides,
  };
}

class FakeWebSocket implements ObservatoryWebSocketLike {
  static instances: FakeWebSocket[] = [];

  onclose: ObservatoryWebSocketLike['onclose'] = null;
  onerror: ObservatoryWebSocketLike['onerror'] = null;
  onmessage: ObservatoryWebSocketLike['onmessage'] = null;
  onopen: ObservatoryWebSocketLike['onopen'] = null;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  close() {
    this.onclose?.({ wasClean: true });
  }
}

class FakeEventSource implements ObservatoryEventSourceLike {
  static instances: FakeEventSource[] = [];

  onerror: ObservatoryEventSourceLike['onerror'] = null;
  onmessage: ObservatoryEventSourceLike['onmessage'] = null;
  onopen: ObservatoryEventSourceLike['onopen'] = null;

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  close() {}
}

describe('observatory pixel stream payload ingestion', () => {
  it('accepts the Agency runtime event schema version when present', () => {
    const result = ingestObservatoryStreamPayload(
      createInitialObservatoryRuntimeVisualState(),
      JSON.stringify(rawEvent({ schemaVersion: AGENCY_RUNTIME_EVENT_SCHEMA_VERSION }))
    );

    expect(result.acceptedCount).toBe(1);
    expect(result.issues).toEqual([]);
  });

  it('rejects unknown runtime event schema versions when present', () => {
    const result = ingestObservatoryStreamPayload(
      createInitialObservatoryRuntimeVisualState(),
      JSON.stringify(rawEvent({ schemaVersion: 'obsvis-pixel.runtime-event.v1' }))
    );

    expect(result.acceptedCount).toBe(0);
    expect(result.issues).toEqual([
      { path: 'schemaVersion', reason: 'must be agency.runtime-event.v1 when present' },
    ]);
  });

  it('accepts single JSON events and batches', () => {
    let state = createInitialObservatoryRuntimeVisualState();
    const first = ingestObservatoryStreamPayload(state, JSON.stringify(rawEvent()));
    state = first.state;
    const second = ingestObservatoryStreamPayload(
      state,
      JSON.stringify([rawEvent({ id: 'evt:stream-test-2' })])
    );

    expect(first.acceptedCount).toBe(1);
    expect(second.acceptedCount).toBe(1);
    expect(second.issues).toEqual([]);
    expect(second.state.tasksById['task:stream']?.progress).toBe(0.65);
  });

  it('reports malformed JSON as validation issues', () => {
    const result = ingestObservatoryStreamPayload(
      createInitialObservatoryRuntimeVisualState(),
      '{bad-json'
    );

    expect(result.acceptedCount).toBe(0);
    expect(result.issues).toEqual([
      { path: 'payload', reason: 'stream payload must be valid JSON when sent as a string' },
    ]);
  });

  it('rejects payloads larger than the configured byte limit', () => {
    const result = ingestObservatoryStreamPayload(
      createInitialObservatoryRuntimeVisualState(),
      JSON.stringify(rawEvent({ message: 'x'.repeat(128) })),
      { maxPayloadBytes: 32 }
    );

    expect(OBSERVATORY_DEFAULT_MAX_STREAM_PAYLOAD_BYTES).toBe(65_536);
    expect(result.acceptedCount).toBe(0);
    expect(result.issues).toEqual([
      { path: 'payload', reason: 'stream payload exceeds 32 byte limit' },
    ]);
  });
});

describe('observatory pixel WebSocket adapter', () => {
  it('connects, ingests messages, reports status, and reconnects', () => {
    FakeWebSocket.instances = [];
    let acceptedEventCount = 0;
    let state: ObservatoryRuntimeVisualState = createInitialObservatoryRuntimeVisualState();
    const statuses: ObservatoryStreamAdapterStatus[] = [];

    const adapter = createObservatoryWebSocketAdapter({
      getState: () => state,
      onAcceptedEvent: () => {
        acceptedEventCount += 1;
      },
      onStatusChange: (snapshot) => {
        statuses.push(snapshot.status);
      },
      reconnect: { baseDelayMs: 1, maxAttempts: 2 },
      setState: (nextState) => {
        state = nextState;
      },
      setTimeoutFn: (handler) => {
        handler();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      },
      url: 'ws://localhost:4321/runtime',
      WebSocketCtor: FakeWebSocket,
    });

    adapter.connect();
    FakeWebSocket.instances[0]?.onopen?.();
    FakeWebSocket.instances[0]?.onmessage?.({ data: JSON.stringify(rawEvent()) });
    FakeWebSocket.instances[0]?.onclose?.({ wasClean: false });

    expect(acceptedEventCount).toBe(1);
    expect(state.agentsById['agent:atlas']?.currentRoomId).toBe('room:runtime-floor');
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(statuses).toContain('connected');
    expect(statuses).toContain('reconnecting');
  });

  it('applies the payload byte limit before reducing WebSocket events', () => {
    FakeWebSocket.instances = [];
    let state: ObservatoryRuntimeVisualState = createInitialObservatoryRuntimeVisualState();
    let issuesCount = 0;

    const adapter = createObservatoryWebSocketAdapter({
      getState: () => state,
      maxPayloadBytes: 24,
      onIssues: (issues) => {
        issuesCount += issues.length;
      },
      setState: (nextState) => {
        state = nextState;
      },
      url: 'ws://localhost:4321/runtime',
      WebSocketCtor: FakeWebSocket,
    });

    adapter.connect();
    FakeWebSocket.instances[0]?.onmessage?.({ data: JSON.stringify(rawEvent()) });

    expect(issuesCount).toBe(1);
    expect(state).toEqual(createInitialObservatoryRuntimeVisualState());
  });
});

describe('observatory pixel SSE adapter', () => {
  it('connects, ingests server-sent messages, reports status, and reconnects on error', () => {
    FakeEventSource.instances = [];
    let acceptedEventCount = 0;
    let state: ObservatoryRuntimeVisualState = createInitialObservatoryRuntimeVisualState();
    const statuses: ObservatoryStreamAdapterStatus[] = [];

    const adapter = createObservatorySseAdapter({
      EventSourceCtor: FakeEventSource,
      getState: () => state,
      onAcceptedEvent: () => {
        acceptedEventCount += 1;
      },
      onStatusChange: (snapshot) => {
        statuses.push(snapshot.status);
      },
      reconnect: { baseDelayMs: 1, maxAttempts: 2 },
      setState: (nextState) => {
        state = nextState;
      },
      setTimeoutFn: (handler) => {
        handler();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      },
      url: 'http://localhost:4321/runtime/events',
    });

    adapter.connect();
    FakeEventSource.instances[0]?.onopen?.();
    FakeEventSource.instances[0]?.onmessage?.({ data: JSON.stringify(rawEvent()) });
    FakeEventSource.instances[0]?.onerror?.({});

    expect(acceptedEventCount).toBe(1);
    expect(state.tasksById['task:stream']?.progress).toBe(0.65);
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(statuses).toContain('connected');
    expect(statuses).toContain('reconnecting');
  });
});
