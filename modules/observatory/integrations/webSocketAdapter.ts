import {
  OBSERVATORY_GENERIC_WEBSOCKET_SOURCE_ID,
  type ObservatorySourceRegistry,
} from '@/modules/observatory/integrations/sourceRegistry';
import { ingestObservatoryStreamPayload } from '@/modules/observatory/integrations/streamPayload';
import type {
  ObservatoryStreamAdapter,
  ObservatoryStreamAdapterReconnectOptions,
  ObservatoryStreamAdapterStateOptions,
  ObservatoryStreamAdapterStatus,
  ObservatoryStreamAdapterStatusSnapshot,
} from '@/modules/observatory/integrations/streamAdapterTypes';
import type { ObservatoryEventValidationIssue } from '@/modules/observatory/runtime/events';

export interface ObservatoryWebSocketLike {
  close(): void;
  onclose: ((event: { code?: number; reason?: string; wasClean?: boolean }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onopen: (() => void) | null;
}

export interface ObservatoryWebSocketConstructor {
  new (url: string, protocols?: string | string[]): ObservatoryWebSocketLike;
}

export interface ObservatoryWebSocketAdapterOptions extends ObservatoryStreamAdapterStateOptions {
  clearTimeoutFn?: (timerId: ReturnType<typeof setTimeout>) => void;
  maxPayloadBytes?: number;
  protocols?: string | string[];
  reconnect?: ObservatoryStreamAdapterReconnectOptions;
  registry?: ObservatorySourceRegistry;
  setTimeoutFn?: (handler: () => void, timeout: number) => ReturnType<typeof setTimeout>;
  sourceId?: string;
  url: string;
  WebSocketCtor?: ObservatoryWebSocketConstructor;
}

export function createObservatoryWebSocketAdapter({
  clearTimeoutFn = clearTimeout,
  getState,
  maxPayloadBytes,
  onAcceptedEvent,
  onIssues,
  onStatusChange,
  protocols,
  reconnect,
  registry,
  setState,
  setTimeoutFn = setTimeout,
  sourceId = OBSERVATORY_GENERIC_WEBSOCKET_SOURCE_ID,
  url,
  WebSocketCtor = globalThis.WebSocket as ObservatoryWebSocketConstructor | undefined,
}: ObservatoryWebSocketAdapterOptions): ObservatoryStreamAdapter {
  if (!WebSocketCtor) {
    throw new Error('Observatory WebSocket adapter requires a WebSocket constructor.');
  }

  let attempt = 0;
  let manualDisconnect = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let socket: ObservatoryWebSocketLike | undefined;
  let status: ObservatoryStreamAdapterStatus = 'idle';

  const reconnectConfig = {
    baseDelayMs: reconnect?.baseDelayMs ?? 1_000,
    enabled: reconnect?.enabled ?? true,
    maxAttempts: reconnect?.maxAttempts ?? 5,
  };

  const snapshot = (): ObservatoryStreamAdapterStatusSnapshot => ({
    attempt,
    sourceId,
    status,
    url,
  });

  const setStatus = (nextStatus: ObservatoryStreamAdapterStatus) => {
    status = nextStatus;
    onStatusChange?.(snapshot());
  };

  const clearReconnect = () => {
    if (reconnectTimer) {
      clearTimeoutFn(reconnectTimer);
      reconnectTimer = undefined;
    }
  };

  const emitIssues = (issues: ObservatoryEventValidationIssue[]) => {
    onIssues?.(issues);
  };

  const connect = () => {
    clearReconnect();
    manualDisconnect = false;
    attempt += 1;
    setStatus(attempt > 1 ? 'reconnecting' : 'connecting');

    socket = new WebSocketCtor(url, protocols);
    socket.onopen = () => {
      setStatus('connected');
    };
    socket.onerror = () => {
      setStatus('error');
    };
    socket.onmessage = (message) => {
      const result = ingestObservatoryStreamPayload(getState(), message.data, { maxPayloadBytes });
      setState(result.state);
      emitIssues(result.issues);

      for (let index = 0; index < result.acceptedCount; index += 1) {
        onAcceptedEvent?.();
      }
    };
    socket.onclose = () => {
      if (manualDisconnect) {
        setStatus('closed');
        return;
      }

      if (!reconnectConfig.enabled || attempt >= reconnectConfig.maxAttempts) {
        setStatus('closed');
        return;
      }

      setStatus('reconnecting');
      reconnectTimer = setTimeoutFn(connect, reconnectConfig.baseDelayMs * attempt);
    };
  };

  return {
    connect() {
      const source = registry?.getSource(sourceId);
      if (source && !source.enabled) {
        emitIssues([{ path: 'source', reason: `Runtime source "${sourceId}" is disabled.` }]);
        setStatus('closed');
        return;
      }

      connect();
    },
    disconnect() {
      manualDisconnect = true;
      clearReconnect();
      socket?.close();
      setStatus('closed');
    },
    getStatus: snapshot,
  };
}
