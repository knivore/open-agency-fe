import { pushObservatoryLocalRuntimeEvent } from '@/modules/observatory/integrations/localEventBridge';
import type { ObservatoryEventValidationIssue } from '@/modules/observatory/runtime/events';
import type { ObservatoryRuntimeVisualState } from '@/modules/observatory/runtime/visualState';

export const OBSERVATORY_DEFAULT_MAX_STREAM_PAYLOAD_BYTES = 64 * 1024;

export interface ObservatoryStreamPayloadOptions {
  maxPayloadBytes?: number;
}

export interface ObservatoryStreamPayloadResult {
  acceptedCount: number;
  issues: ObservatoryEventValidationIssue[];
  state: ObservatoryRuntimeVisualState;
}

export function parseObservatoryStreamPayload(payload: unknown): unknown[] {
  const parsedPayload = typeof payload === 'string' ? JSON.parse(payload) : payload;
  return Array.isArray(parsedPayload) ? parsedPayload : [parsedPayload];
}

export function ingestObservatoryStreamPayload(
  state: ObservatoryRuntimeVisualState,
  payload: unknown,
  options: ObservatoryStreamPayloadOptions = {}
): ObservatoryStreamPayloadResult {
  const maxPayloadBytes = options.maxPayloadBytes ?? OBSERVATORY_DEFAULT_MAX_STREAM_PAYLOAD_BYTES;
  const payloadSize = estimatePayloadBytes(payload);

  if (payloadSize > maxPayloadBytes) {
    return {
      acceptedCount: 0,
      issues: [
        {
          path: 'payload',
          reason: `stream payload exceeds ${maxPayloadBytes} byte limit`,
        },
      ],
      state,
    };
  }

  let events: unknown[];

  try {
    events = parseObservatoryStreamPayload(payload);
  } catch {
    return {
      acceptedCount: 0,
      issues: [
        { path: 'payload', reason: 'stream payload must be valid JSON when sent as a string' },
      ],
      state,
    };
  }

  return events.reduce<ObservatoryStreamPayloadResult>(
    (result, event) => {
      const next = pushObservatoryLocalRuntimeEvent(result.state, event);

      return {
        acceptedCount: next.issues.length === 0 ? result.acceptedCount + 1 : result.acceptedCount,
        issues: [...result.issues, ...next.issues],
        state: next.state,
      };
    },
    { acceptedCount: 0, issues: [], state }
  );
}

function estimatePayloadBytes(payload: unknown) {
  if (typeof payload === 'string') {
    return new TextEncoder().encode(payload).length;
  }

  try {
    return new TextEncoder().encode(JSON.stringify(payload)).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}
