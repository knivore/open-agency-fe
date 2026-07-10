import { normalizeObservatoryRuntimeEvent } from '@/modules/observatory/runtime/eventNormalizer';
import type {
  ObservatoryEventValidationIssue,
  ObservatoryNormalizedOfficeEvent,
} from '@/modules/observatory/runtime/events';
import {
  type ObservatoryRuntimeVisualState,
  reduceObservatoryRuntimeEvent,
} from '@/modules/observatory/runtime/visualState';

export interface ObservatoryLocalEventBridgeResult {
  event?: ObservatoryNormalizedOfficeEvent;
  issues: ObservatoryEventValidationIssue[];
  state: ObservatoryRuntimeVisualState;
}

export function pushObservatoryLocalRuntimeEvent(
  state: ObservatoryRuntimeVisualState,
  rawEvent: unknown
): ObservatoryLocalEventBridgeResult {
  const normalization = normalizeObservatoryRuntimeEvent(rawEvent);

  if (!normalization.event) {
    return {
      issues: normalization.issues,
      state,
    };
  }

  return {
    event: normalization.event,
    issues: [],
    state: reduceObservatoryRuntimeEvent(state, normalization.event),
  };
}
