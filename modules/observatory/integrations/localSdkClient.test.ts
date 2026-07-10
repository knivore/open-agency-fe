import { describe, expect, it } from 'vitest';

import { createObservatoryLocalSdkClient } from '@/modules/observatory/integrations/localSdkClient';
import type { ObservatoryExternalRuntimeEvent } from '@/modules/observatory/runtime/events';
import {
  createInitialObservatoryRuntimeVisualState,
  type ObservatoryRuntimeVisualState,
} from '@/modules/observatory/runtime/visualState';

function rawEvent(
  overrides: Partial<ObservatoryExternalRuntimeEvent> = {}
): ObservatoryExternalRuntimeEvent {
  return {
    id: 'evt:local-sdk-test',
    source: 'local-sdk-test',
    sourceType: 'local',
    timestamp: '2026-05-09T00:00:00.000Z',
    type: 'task_progress',
    actor: {
      id: 'agent:atlas',
      name: 'Atlas',
    },
    task: {
      id: 'task:local-sdk',
      title: 'Local SDK test',
      progress: 0.4,
    },
    workflow: {
      id: 'workflow:local-sdk',
      roomId: 'room:runtime-floor',
    },
    ...overrides,
  };
}

describe('observatory pixel local SDK client', () => {
  it('pushes valid raw events into reducer state', () => {
    let acceptedEventCount = 0;
    let issuesCount = 0;
    let state: ObservatoryRuntimeVisualState = createInitialObservatoryRuntimeVisualState();
    const client = createObservatoryLocalSdkClient({
      getState: () => state,
      onAcceptedEvent: () => {
        acceptedEventCount += 1;
      },
      onIssues: (issues) => {
        issuesCount += issues.length;
      },
      setState: (nextState) => {
        state = nextState;
      },
    });

    const issues = client.pushEvent(rawEvent());

    expect(issues).toEqual([]);
    expect(acceptedEventCount).toBe(1);
    expect(issuesCount).toBe(0);
    expect(state.agentsById['agent:atlas']?.currentRoomId).toBe('room:runtime-floor');
    expect(state.agentsById['agent:atlas']?.taskProgress).toBe(0.4);
    expect(state.tasksById['task:local-sdk']?.progress).toBe(0.4);
  });

  it('returns validation issues without accepting invalid events', () => {
    let acceptedEventCount = 0;
    let state: ObservatoryRuntimeVisualState = createInitialObservatoryRuntimeVisualState();
    const client = createObservatoryLocalSdkClient({
      getState: () => state,
      onAcceptedEvent: () => {
        acceptedEventCount += 1;
      },
      setState: (nextState) => {
        state = nextState;
      },
    });

    const issues = client.pushEvent({ type: 'task_progress' });

    expect(issues.length).toBeGreaterThan(0);
    expect(acceptedEventCount).toBe(0);
    expect(state).toEqual(createInitialObservatoryRuntimeVisualState());
  });
});
