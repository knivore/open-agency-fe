import { useEffect, useRef, useState } from 'react';
import { EventSourceSigmaGraphRealtimeAdapter } from '@/modules/sigma-graph/realtime';
import { InMemorySigmaGraphController } from '@/modules/sigma-graph/store';
import type { SigmaGraphConnectionStatus, SigmaGraphDocument } from '@/modules/sigma-graph/types';

export interface AgencyGraphRealtimeDocumentOptions {
  snapshotDocument: SigmaGraphDocument | null;
  enabled: boolean;
  streamUrl: string | null;
  statusPollMs?: number;
  reconnectDelayMs?: number;
  onReconnect?: (event: AgencyGraphReconnectEvent) => void;
}

export interface AgencyGraphRealtimeDocumentState {
  document: SigmaGraphDocument | null;
  realtimeStatus: SigmaGraphConnectionStatus;
  lastDeltaEventId: string | null;
}

export interface AgencyGraphReconnectEvent {
  afterEventId: string | null;
  reconnectAttempt: number;
  streamUrl: string;
}

export function graphStreamUrlWithAfter(streamUrl: string, afterEventId: string | null) {
  if (!afterEventId) {
    return streamUrl;
  }
  const relative = streamUrl.startsWith('/') && !streamUrl.startsWith('//');
  const url = new URL(streamUrl, 'http://agency.local');
  url.searchParams.set('after', afterEventId);
  if (!relative) {
    return url.toString();
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function useAgencyGraphRealtimeDocument({
  snapshotDocument,
  enabled,
  streamUrl,
  statusPollMs = 1000,
  reconnectDelayMs = 1000,
  onReconnect,
}: AgencyGraphRealtimeDocumentOptions): AgencyGraphRealtimeDocumentState {
  const [document, setDocument] = useState<SigmaGraphDocument | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<SigmaGraphConnectionStatus>('closed');
  const [lastDeltaEventId, setLastDeltaEventId] = useState<string | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const controllerRef = useRef<InMemorySigmaGraphController | null>(null);
  const lastDeltaEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!snapshotDocument) {
      // Snapshot changes reset the local realtime controller before a new stream can attach.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDocument(null);
      setLastDeltaEventId(null);
      lastDeltaEventIdRef.current = null;
      setReconnectAttempt(0);
      controllerRef.current = null;
      return;
    }

    const controller = new InMemorySigmaGraphController(snapshotDocument);
    controllerRef.current = controller;
    const unsubscribe = controller.subscribe(setDocument);
    setDocument(controller.getDocument());
    setLastDeltaEventId(null);
    lastDeltaEventIdRef.current = null;
    setReconnectAttempt(0);

    return () => {
      unsubscribe();
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    };
  }, [snapshotDocument]);

  useEffect(() => {
    if (!enabled || !streamUrl || !controllerRef.current) {
      setRealtimeStatus('closed');
      return;
    }

    const adapter = new EventSourceSigmaGraphRealtimeAdapter();
    const reconnectAfterEventId = reconnectAttempt > 0 ? lastDeltaEventIdRef.current : null;
    const connectionUrl = graphStreamUrlWithAfter(streamUrl, reconnectAfterEventId);
    const connection = adapter.connect({ url: connectionUrl });
    setRealtimeStatus(connection.status());
    let reconnectTimeout: number | null = null;
    let notifiedReconnectOpen = false;
    const statusInterval = window.setInterval(() => {
      const status = connection.status();
      setRealtimeStatus(status);

      if (status === 'open' && reconnectAttempt > 0 && !notifiedReconnectOpen) {
        notifiedReconnectOpen = true;
        onReconnect?.({
          afterEventId: reconnectAfterEventId,
          reconnectAttempt,
          streamUrl: connectionUrl,
        });
      }

      if ((status === 'error' || status === 'closed') && reconnectTimeout === null) {
        reconnectTimeout = window.setTimeout(() => {
          setReconnectAttempt((current) => current + 1);
        }, reconnectDelayMs);
      }
    }, statusPollMs);
    const unsubscribe = connection.subscribe((delta) => {
      controllerRef.current?.patch(delta);
      const eventId = delta.metadata?.eventId;
      if (typeof eventId === 'string') {
        lastDeltaEventIdRef.current = eventId;
        setLastDeltaEventId(eventId);
      }
    });

    return () => {
      window.clearInterval(statusInterval);
      if (reconnectTimeout !== null) {
        window.clearTimeout(reconnectTimeout);
      }
      unsubscribe();
      connection.close();
      setRealtimeStatus('closed');
    };
  }, [
    enabled,
    onReconnect,
    reconnectAttempt,
    reconnectDelayMs,
    snapshotDocument,
    statusPollMs,
    streamUrl,
  ]);

  return {
    document,
    realtimeStatus,
    lastDeltaEventId,
  };
}
