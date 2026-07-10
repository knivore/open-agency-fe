import { describe, expect, it, vi } from 'vitest';

import type { ObservatoryNormalizedOfficeEvent } from '@/modules/observatory/runtime/events';
import { createInitialObservatoryRuntimeVisualState } from '@/modules/observatory/runtime/visualState';
import { createObservatoryRuntimeVisualStore } from '@/modules/observatory/state/runtimeVisualStore';

function event(
  overrides: Partial<ObservatoryNormalizedOfficeEvent>
): ObservatoryNormalizedOfficeEvent {
  return {
    id: 'evt:test',
    level: 'info',
    source: 'test',
    timestamp: '2026-05-09T00:00:00.000Z',
    type: 'LOG_RECEIVED',
    ...overrides,
  };
}

describe('observatory pixel runtime visual store', () => {
  it('publishes updates when reducing events', () => {
    const store = createObservatoryRuntimeVisualStore();
    const listener = vi.fn();

    store.subscribe(listener);
    store.reduceEvent(event({ agentId: 'agent:atlas', id: 'evt:agent-log', message: 'Working' }));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState().agentsById['agent:atlas']?.lastMessage).toBe('Working');
  });

  it('supports batched reduction and unsubscribe', () => {
    const store = createObservatoryRuntimeVisualStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.reduceEvents([
      event({ id: 'evt:1', timestamp: '2026-05-09T00:00:01.000Z' }),
      event({ id: 'evt:2', timestamp: '2026-05-09T00:00:02.000Z' }),
    ]);
    unsubscribe();
    store.reduceEvent(event({ id: 'evt:3', timestamp: '2026-05-09T00:00:03.000Z' }));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState().activityFeed.map((entry) => entry.eventId)).toEqual([
      'evt:3',
      'evt:2',
      'evt:1',
    ]);
  });

  it('resets to an empty or provided state', () => {
    const seeded = createInitialObservatoryRuntimeVisualState();
    seeded.droppedStaleEventCount = 2;

    const store = createObservatoryRuntimeVisualStore(seeded);
    expect(store.getState().droppedStaleEventCount).toBe(2);

    store.reset();
    expect(store.getState()).toEqual(createInitialObservatoryRuntimeVisualState());
  });

  it('replays event history to a cursor', () => {
    const store = createObservatoryRuntimeVisualStore();
    const frame = store.replay(
      [
        event({
          id: 'evt:start',
          taskId: 'task:collect',
          timestamp: '2026-05-09T00:00:01.000Z',
          type: 'TASK_STARTED',
        }),
        event({
          id: 'evt:done',
          progress: 1,
          taskId: 'task:collect',
          timestamp: '2026-05-09T00:00:02.000Z',
          type: 'TASK_COMPLETED',
        }),
      ],
      0
    );

    expect(frame.event?.id).toBe('evt:start');
    expect(store.getState().tasksById['task:collect']?.status).toBe('working');
  });
});
