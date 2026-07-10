import type { ObservatoryNormalizedOfficeEvent } from '@/modules/observatory/runtime/events';
import {
  createInitialObservatoryRuntimeVisualState,
  type ObservatoryRuntimeReducerOptions,
  type ObservatoryRuntimeVisualState,
  reduceObservatoryRuntimeEvents,
} from '@/modules/observatory/runtime/visualState';

export interface ObservatoryReplayTimelineEvent {
  event: ObservatoryNormalizedOfficeEvent;
  index: number;
}

export interface ObservatoryReplayTimeline {
  events: ObservatoryReplayTimelineEvent[];
  totalEvents: number;
}

export interface ObservatoryReplayFrame {
  cursor: number;
  event?: ObservatoryNormalizedOfficeEvent;
  hasNext: boolean;
  hasPrevious: boolean;
  state: ObservatoryRuntimeVisualState;
  totalEvents: number;
}

export function createObservatoryReplayTimeline(
  events: ObservatoryNormalizedOfficeEvent[]
): ObservatoryReplayTimeline {
  const sortedEvents = events
    .map((event, insertionIndex) => ({ event, insertionIndex }))
    .sort((left, right) => {
      const timestampDelta = Date.parse(left.event.timestamp) - Date.parse(right.event.timestamp);

      if (timestampDelta !== 0) {
        return timestampDelta;
      }

      return left.insertionIndex - right.insertionIndex;
    })
    .map(({ event }, index) => ({ event, index }));

  return {
    events: sortedEvents,
    totalEvents: sortedEvents.length,
  };
}

export function createObservatoryReplayFrame(
  events: ObservatoryNormalizedOfficeEvent[],
  cursor: number,
  options: ObservatoryRuntimeReducerOptions = {}
): ObservatoryReplayFrame {
  const timeline = createObservatoryReplayTimeline(events);
  const clampedCursor = clampObservatoryReplayCursor(cursor, timeline.totalEvents);
  const replayEvents =
    clampedCursor >= 0
      ? timeline.events.slice(0, clampedCursor + 1).map((timelineEvent) => timelineEvent.event)
      : [];
  const state = reduceObservatoryRuntimeEvents(
    createInitialObservatoryRuntimeVisualState(),
    replayEvents,
    options
  );

  return {
    cursor: clampedCursor,
    event: clampedCursor >= 0 ? timeline.events[clampedCursor]?.event : undefined,
    hasNext: clampedCursor < timeline.totalEvents - 1,
    hasPrevious: clampedCursor > 0,
    state,
    totalEvents: timeline.totalEvents,
  };
}

export function createObservatoryReplayFrameAtTimestamp(
  events: ObservatoryNormalizedOfficeEvent[],
  timestamp: string,
  options: ObservatoryRuntimeReducerOptions = {}
): ObservatoryReplayFrame {
  const timeline = createObservatoryReplayTimeline(events);
  const timestampMs = Date.parse(timestamp);
  let cursor = -1;

  timeline.events.forEach((timelineEvent, index) => {
    if (Date.parse(timelineEvent.event.timestamp) <= timestampMs) {
      cursor = index;
    }
  });

  return createObservatoryReplayFrame(
    timeline.events.map((timelineEvent) => timelineEvent.event),
    cursor,
    options
  );
}

export function clampObservatoryReplayCursor(cursor: number, totalEvents: number) {
  if (totalEvents <= 0) {
    return -1;
  }

  return Math.max(0, Math.min(totalEvents - 1, Math.trunc(cursor)));
}
