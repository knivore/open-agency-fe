import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EventSourceSigmaGraphRealtimeAdapter,
  WebSocketSigmaGraphRealtimeAdapter,
} from './realtime';

class MockEventSource {
  static readonly CLOSED = 2;
  static instances: MockEventSource[] = [];

  readonly listeners = new Map<string, Set<(event: MessageEvent) => void>>();
  readyState = 0;
  url: string;

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

  emit(eventName: string, data: unknown) {
    const event = { data: typeof data === 'string' ? data : JSON.stringify(data) } as MessageEvent;
    for (const listener of this.listeners.get(eventName) || []) {
      listener(event);
    }
  }
}

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  readonly listeners = new Map<string, Set<(event: MessageEvent) => void>>();
  url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  addEventListener(eventName: string, listener: (event: MessageEvent) => void) {
    const listeners = this.listeners.get(eventName) || new Set();
    listeners.add(listener);
    this.listeners.set(eventName, listeners);
  }

  close() {
    this.emit('close', '');
  }

  emit(eventName: string, data: unknown) {
    const event = { data: typeof data === 'string' ? data : JSON.stringify(data) } as MessageEvent;
    for (const listener of this.listeners.get(eventName) || []) {
      listener(event);
    }
  }
}

describe('sigma graph realtime adapters', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    MockEventSource.instances = [];
    MockWebSocket.instances = [];
  });

  it('delivers graph deltas from EventSource graph_delta events', () => {
    vi.stubGlobal('EventSource', MockEventSource);
    const adapter = new EventSourceSigmaGraphRealtimeAdapter();
    const connection = adapter.connect({ url: '/graph/stream/deltas' });
    const listener = vi.fn();

    connection.subscribe(listener);
    MockEventSource.instances[0]?.emit('graph_delta', {
      upsertNodes: [{ id: 'run-1', type: 'WorkflowRun', label: 'run-1' }],
    });

    expect(listener).toHaveBeenCalledWith({
      upsertNodes: [{ id: 'run-1', type: 'WorkflowRun', label: 'run-1' }],
    });
    connection.close();
    expect(connection.status()).toBe('closed');
  });

  it('delivers graph deltas from websocket messages', () => {
    vi.stubGlobal('WebSocket', MockWebSocket);
    const adapter = new WebSocketSigmaGraphRealtimeAdapter();
    const connection = adapter.connect({ url: 'ws://graph.test' });
    const listener = vi.fn();

    connection.subscribe(listener);
    MockWebSocket.instances[0]?.emit('message', {
      upsertEdges: [{ id: 'edge-1', source: 'a', target: 'b', type: 'RELATED_TO' }],
    });

    expect(listener).toHaveBeenCalledWith({
      upsertEdges: [{ id: 'edge-1', source: 'a', target: 'b', type: 'RELATED_TO' }],
    });
  });
});
