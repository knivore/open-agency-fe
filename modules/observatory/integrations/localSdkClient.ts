import { pushObservatoryLocalRuntimeEvent } from '@/modules/observatory/integrations/localEventBridge';
import type {
  ObservatoryEventValidationIssue,
  ObservatoryNormalizedOfficeEvent,
} from '@/modules/observatory/runtime/events';
import type { ObservatoryRuntimeVisualState } from '@/modules/observatory/runtime/visualState';

export interface ObservatoryLocalSdkClientOptions {
  getState: () => ObservatoryRuntimeVisualState;
  setState: (state: ObservatoryRuntimeVisualState) => void;
  onAcceptedEvent?: (event: ObservatoryNormalizedOfficeEvent) => void;
  onIssues?: (issues: ObservatoryEventValidationIssue[]) => void;
}

export interface ObservatoryLocalSdkClient {
  pushEvent(rawEvent: unknown): ObservatoryEventValidationIssue[];
  pushEvents(rawEvents: unknown[]): ObservatoryEventValidationIssue[];
}

export function createObservatoryLocalSdkClient({
  getState,
  onAcceptedEvent,
  onIssues,
  setState,
}: ObservatoryLocalSdkClientOptions): ObservatoryLocalSdkClient {
  const pushEvent = (rawEvent: unknown) => {
    const result = pushObservatoryLocalRuntimeEvent(getState(), rawEvent);
    setState(result.state);
    onIssues?.(result.issues);

    if (result.issues.length === 0 && result.event) {
      onAcceptedEvent?.(result.event);
    }

    return result.issues;
  };

  return {
    pushEvent,
    pushEvents(rawEvents) {
      const collectedIssues: ObservatoryEventValidationIssue[] = [];

      rawEvents.forEach((rawEvent) => {
        collectedIssues.push(...pushEvent(rawEvent));
      });

      return collectedIssues;
    },
  };
}
