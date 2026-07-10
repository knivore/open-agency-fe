import type { ObservatoryNormalizedOfficeEvent } from '@/modules/observatory/runtime/events';
import {
  createObservatoryReplayFrame,
  type ObservatoryReplayFrame,
} from '@/modules/observatory/runtime/replayTimeline';
import {
  createInitialObservatoryRuntimeVisualState,
  type ObservatoryRuntimeReducerOptions,
  type ObservatoryRuntimeVisualState,
  reduceObservatoryRuntimeEvent,
  reduceObservatoryRuntimeEvents,
} from '@/modules/observatory/runtime/visualState';

export type ObservatoryRuntimeVisualStoreListener = () => void;

export interface ObservatoryRuntimeVisualStore {
  getState(): ObservatoryRuntimeVisualState;
  reduceEvent(
    event: ObservatoryNormalizedOfficeEvent,
    options?: ObservatoryRuntimeReducerOptions
  ): ObservatoryRuntimeVisualState;
  reduceEvents(
    events: ObservatoryNormalizedOfficeEvent[],
    options?: ObservatoryRuntimeReducerOptions
  ): ObservatoryRuntimeVisualState;
  replay(
    events: ObservatoryNormalizedOfficeEvent[],
    cursor: number,
    options?: ObservatoryRuntimeReducerOptions
  ): ObservatoryReplayFrame;
  reset(nextState?: ObservatoryRuntimeVisualState): ObservatoryRuntimeVisualState;
  setState(nextState: ObservatoryRuntimeVisualState): ObservatoryRuntimeVisualState;
  subscribe(listener: ObservatoryRuntimeVisualStoreListener): () => void;
}

export function createObservatoryRuntimeVisualStore(
  initialState: ObservatoryRuntimeVisualState = createInitialObservatoryRuntimeVisualState()
): ObservatoryRuntimeVisualStore {
  let state = initialState;
  const listeners = new Set<ObservatoryRuntimeVisualStoreListener>();

  const emit = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const setState = (nextState: ObservatoryRuntimeVisualState) => {
    state = nextState;
    emit();
    return state;
  };

  return {
    getState() {
      return state;
    },
    reduceEvent(event, options) {
      return setState(reduceObservatoryRuntimeEvent(state, event, options));
    },
    reduceEvents(events, options) {
      return setState(reduceObservatoryRuntimeEvents(state, events, options));
    },
    replay(events, cursor, options) {
      const frame = createObservatoryReplayFrame(events, cursor, options);
      setState(frame.state);
      return frame;
    },
    reset(nextState = createInitialObservatoryRuntimeVisualState()) {
      return setState(nextState);
    },
    setState,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
