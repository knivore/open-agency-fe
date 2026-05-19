import {
  OBSERVATORY_GENERIC_SSE_SOURCE_ID,
  type ObservatorySourceRegistry,
} from '@/modules/observatory/integrations/sourceRegistry';
import type {
  ObservatoryStreamAdapter,
  ObservatoryStreamAdapterReconnectOptions,
  ObservatoryStreamAdapterStateOptions,
  ObservatoryStreamAdapterStatus,
  ObservatoryStreamAdapterStatusSnapshot,
} from '@/modules/observatory/integrations/streamAdapterTypes';
import { ingestObservatoryStreamPayload } from '@/modules/observatory/integrations/streamPayload';
import type { ObservatoryEventValidationIssue } from '@/modules/observatory/runtime/events';

export interface ObservatoryEventSourceLike {
  close(): void;
  onerror: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onopen: (() => void) | null;
}

export interface ObservatoryEventSourceConstructor {
  new (url: string, init?: EventSourceInit): ObservatoryEventSourceLike;
}

export interface ObservatorySseAdapterOptions extends ObservatoryStreamAdapterStateOptions {
  EventSourceCtor?: ObservatoryEventSourceConstructor;
  clearTimeoutFn?: (timerId: ReturnType<typeof setTimeout>) => void;
  eventSourceInit?: EventSourceInit;
  maxPayloadBytes?: number;
  reconnect?: ObservatoryStreamAdapterReconnectOptions;
  registry?: ObservatorySourceRegistry;
  setTimeoutFn?: (handler: () => void, timeout: number) => ReturnType<typeof setTimeout>;
  sourceId?: string;
  url: string;
}

export function createObservatorySseAdapter({
  clearTimeoutFn = clearTimeout,
  EventSourceCtor = globalThis.EventSource as ObservatoryEventSourceConstructor | undefined,
  eventSourceInit,
  getState,
  maxPayloadBytes,
  onAcceptedEvent,
  onIssues,
  onStatusChange,
  reconnect,
  registry,
  setState,
  setTimeoutFn = setTimeout,
  sourceId = OBSERVATORY_GENERIC_SSE_SOURCE_ID,
  url,
}: ObservatorySseAdapterOptions): ObservatoryStreamAdapter {
  if (!EventSourceCtor) {
    throw new Error('Observatory SSE adapter requires an EventSource constructor.');
  }

  let attempt = 0;
  let eventSource: ObservatoryEventSourceLike | undefined;
  let manualDisconnect = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
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

    eventSource = new EventSourceCtor(url, eventSourceInit);
    eventSource.onopen = () => {
      setStatus('connected');
    };
    eventSource.onmessage = (message) => {
      const result = ingestObservatoryStreamPayload(getState(), message.data, { maxPayloadBytes });
      setState(result.state);
      emitIssues(result.issues);

      for (let index = 0; index < result.acceptedCount; index += 1) {
        onAcceptedEvent?.();
      }
    };
    eventSource.onerror = () => {
      eventSource?.close();

      if (manualDisconnect) {
        setStatus('closed');
        return;
      }

      if (!reconnectConfig.enabled || attempt >= reconnectConfig.maxAttempts) {
        setStatus('error');
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
      eventSource?.close();
      setStatus('closed');
    },
    getStatus: snapshot,
  };
}
