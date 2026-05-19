import { describe, expect, it } from 'vitest';

import type { ObservatoryNormalizedOfficeEvent } from '@/modules/observatory/runtime/events';
import {
  clampObservatoryReplayCursor,
  createObservatoryReplayFrame,
  createObservatoryReplayFrameAtTimestamp,
  createObservatoryReplayTimeline,
} from '@/modules/observatory/runtime/replayTimeline';

function event(overrides: Partial<ObservatoryNormalizedOfficeEvent>): ObservatoryNormalizedOfficeEvent {
  return {
    id: 'evt:test',
    level: 'info',
    source: 'test',
    timestamp: '2026-05-09T00:00:00.000Z',
    type: 'LOG_RECEIVED',
    ...overrides,
  };
}

describe('observatory pixel replay timeline', () => {
  it('sorts runtime history chronologically with stable ties', () => {
    const timeline = createObservatoryReplayTimeline([
      event({ id: 'evt:3', timestamp: '2026-05-09T00:00:03.000Z' }),
      event({ id: 'evt:1', timestamp: '2026-05-09T00:00:01.000Z' }),
      event({ id: 'evt:2a', timestamp: '2026-05-09T00:00:02.000Z' }),
      event({ id: 'evt:2b', timestamp: '2026-05-09T00:00:02.000Z' }),
    ]);

    expect(timeline.events.map((timelineEvent) => timelineEvent.event.id)).toEqual([
      'evt:1',
      'evt:2a',
      'evt:2b',
      'evt:3',
    ]);
    expect(timeline.events.map((timelineEvent) => timelineEvent.index)).toEqual([0, 1, 2, 3]);
  });

  it('creates reducer state at a replay cursor', () => {
    const frame = createObservatoryReplayFrame(
      [
        event({
          agentId: 'agent:atlas',
          id: 'evt:start',
          taskId: 'task:collect',
          timestamp: '2026-05-09T00:00:01.000Z',
          type: 'TASK_STARTED',
        }),
        event({
          agentId: 'agent:atlas',
          id: 'evt:progress',
          progress: 0.5,
          taskId: 'task:collect',
          timestamp: '2026-05-09T00:00:02.000Z',
          type: 'TASK_PROGRESS',
        }),
      ],
      0,
    );

    expect(frame.cursor).toBe(0);
    expect(frame.event?.id).toBe('evt:start');
    expect(frame.hasNext).toBe(true);
    expect(frame.hasPrevious).toBe(false);
    expect(frame.state.agentsById['agent:atlas']?.taskProgress).toBe(0);
    expect(frame.state.tasksById['task:collect']?.progress).toBe(0);
  });

  it('creates reducer state at a timestamp', () => {
    const frame = createObservatoryReplayFrameAtTimestamp(
      [
        event({
          id: 'evt:early',
          taskId: 'task:collect',
          timestamp: '2026-05-09T00:00:01.000Z',
          type: 'TASK_STARTED',
        }),
        event({
          id: 'evt:late',
          progress: 1,
          taskId: 'task:collect',
          timestamp: '2026-05-09T00:00:03.000Z',
          type: 'TASK_COMPLETED',
        }),
      ],
      '2026-05-09T00:00:02.000Z',
    );

    expect(frame.cursor).toBe(0);
    expect(frame.event?.id).toBe('evt:early');
    expect(frame.state.tasksById['task:collect']?.status).toBe('working');
  });

  it('clamps empty and out-of-range cursors', () => {
    expect(clampObservatoryReplayCursor(10, 0)).toBe(-1);
    expect(clampObservatoryReplayCursor(-10, 3)).toBe(0);
    expect(clampObservatoryReplayCursor(10, 3)).toBe(2);
  });
});
