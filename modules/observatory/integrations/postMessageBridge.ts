import { pushObservatoryLocalRuntimeEvent } from '@/modules/observatory/integrations/localEventBridge';
import {
  createObservatorySourceRegistry,
  OBSERVATORY_POST_MESSAGE_SOURCE_ID,
  type ObservatorySourceRegistry,
} from '@/modules/observatory/integrations/sourceRegistry';
import type {
  ObservatoryEventValidationIssue,
  ObservatoryNormalizedOfficeEvent,
} from '@/modules/observatory/runtime/events';
import type { ObservatoryRuntimeVisualState } from '@/modules/observatory/runtime/visualState';

export const OBSERVATORY_POST_MESSAGE_TYPE = 'observatory:runtime-event';

export interface ObservatoryPostMessagePayload {
  type: typeof OBSERVATORY_POST_MESSAGE_TYPE;
  sourceId?: string;
  event: unknown;
}

export interface ObservatoryPostMessageReceiverOptions {
  getState: () => ObservatoryRuntimeVisualState;
  onAcceptedEvent?: (event: ObservatoryNormalizedOfficeEvent) => void;
  onIssues?: (issues: ObservatoryEventValidationIssue[]) => void;
  registry?: ObservatorySourceRegistry;
  setState: (state: ObservatoryRuntimeVisualState) => void;
  targetWindow?: Window;
}

export function isObservatoryPostMessagePayload(
  value: unknown
): value is ObservatoryPostMessagePayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Partial<ObservatoryPostMessagePayload>;
  return payload.type === OBSERVATORY_POST_MESSAGE_TYPE && 'event' in payload;
}

export function createObservatoryPostMessageReceiver({
  getState,
  onAcceptedEvent,
  onIssues,
  registry = createObservatorySourceRegistry(),
  setState,
  targetWindow = window,
}: ObservatoryPostMessageReceiverOptions) {
  const listener = (message: MessageEvent<unknown>) => {
    if (!isObservatoryPostMessagePayload(message.data)) {
      return;
    }

    const sourceId = message.data.sourceId ?? OBSERVATORY_POST_MESSAGE_SOURCE_ID;
    if (!registry.validateSourceOrigin(sourceId, message.origin, targetWindow.location.origin)) {
      onIssues?.([
        {
          path: 'origin',
          reason: `Rejected postMessage origin "${message.origin}" for source "${sourceId}".`,
        },
      ]);
      return;
    }

    const result = pushObservatoryLocalRuntimeEvent(getState(), message.data.event);
    setState(result.state);
    onIssues?.(result.issues);

    if (result.issues.length === 0 && result.event) {
      onAcceptedEvent?.(result.event);
    }
  };

  targetWindow.addEventListener('message', listener);

  return () => {
    targetWindow.removeEventListener('message', listener);
  };
}
