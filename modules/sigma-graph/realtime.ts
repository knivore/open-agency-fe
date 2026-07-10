import type {
  SigmaGraphDelta,
  SigmaGraphRealtimeAdapter,
  SigmaGraphRealtimeConnection,
  SigmaGraphUnsubscribe,
} from './types';

export interface WebSocketSigmaGraphRealtimeParams {
  url: string;
  protocols?: string | string[];
}

export interface EventSourceSigmaGraphRealtimeParams {
  url: string;
  eventName?: string;
  withCredentials?: boolean;
}

export class WebSocketSigmaGraphRealtimeAdapter implements SigmaGraphRealtimeAdapter<WebSocketSigmaGraphRealtimeParams> {
  id = 'websocket';

  connect(params: WebSocketSigmaGraphRealtimeParams): SigmaGraphRealtimeConnection {
    const socket = new WebSocket(params.url, params.protocols);
    const listeners = new Set<(delta: SigmaGraphDelta) => void>();
    let connectionStatus: ReturnType<SigmaGraphRealtimeConnection['status']> = 'connecting';

    socket.addEventListener('open', () => {
      connectionStatus = 'open';
    });
    socket.addEventListener('close', () => {
      connectionStatus = 'closed';
    });
    socket.addEventListener('error', () => {
      connectionStatus = 'error';
    });
    socket.addEventListener('message', (event) => {
      const delta = parseDelta(event.data);
      if (!delta) {
        return;
      }
      for (const listener of listeners) {
        listener(delta);
      }
    });

    return {
      close: () => socket.close(),
      status: () => connectionStatus,
      subscribe(listener: (delta: SigmaGraphDelta) => void): SigmaGraphUnsubscribe {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  }
}

export class EventSourceSigmaGraphRealtimeAdapter implements SigmaGraphRealtimeAdapter<EventSourceSigmaGraphRealtimeParams> {
  id = 'event-source';

  connect(params: EventSourceSigmaGraphRealtimeParams): SigmaGraphRealtimeConnection {
    const source = new EventSource(params.url, { withCredentials: params.withCredentials });
    const listeners = new Set<(delta: SigmaGraphDelta) => void>();
    let connectionStatus: ReturnType<SigmaGraphRealtimeConnection['status']> = 'connecting';
    const eventName = params.eventName || 'graph_delta';

    source.addEventListener('open', () => {
      connectionStatus = 'open';
    });
    source.addEventListener('error', () => {
      connectionStatus = source.readyState === EventSource.CLOSED ? 'closed' : 'error';
    });
    source.addEventListener(eventName, (event) => {
      const delta = parseDelta(event.data);
      if (!delta) {
        return;
      }
      for (const listener of listeners) {
        listener(delta);
      }
    });

    return {
      close: () => {
        source.close();
        connectionStatus = 'closed';
      },
      status: () => connectionStatus,
      subscribe(listener: (delta: SigmaGraphDelta) => void): SigmaGraphUnsubscribe {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  }
}

function parseDelta(value: unknown): SigmaGraphDelta | null {
  if (typeof value !== 'string') {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as SigmaGraphDelta) : null;
  } catch {
    return null;
  }
}
