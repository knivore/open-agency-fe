import { describe, expect, it } from 'vitest';

import type { ObservatoryNormalizedOfficeEvent } from '@/modules/observatory/runtime/events';
import {
  createInitialObservatoryRuntimeVisualState,
  reduceObservatoryRuntimeEvent,
  reduceObservatoryRuntimeEvents,
} from '@/modules/observatory/runtime/visualState';

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

describe('observatory pixel runtime visual state reducer', () => {
  it('tracks agents, tasks, workflows, and feed entries from normalized events', () => {
    const state = reduceObservatoryRuntimeEvents(createInitialObservatoryRuntimeVisualState(), [
      event({
        agentId: 'agent:atlas',
        id: 'evt:task-started',
        roomId: 'room:runtime-floor',
        taskId: 'task:collect',
        timestamp: '2026-05-09T00:00:01.000Z',
        title: 'Collect logs',
        type: 'TASK_STARTED',
        workflowId: 'workflow:runtime',
      }),
      event({
        agentId: 'agent:atlas',
        id: 'evt:task-progress',
        progress: 0.5,
        taskId: 'task:collect',
        timestamp: '2026-05-09T00:00:02.000Z',
        type: 'TASK_PROGRESS',
        workflowId: 'workflow:runtime',
      }),
    ]);

    expect(state.agentsById['agent:atlas']?.status).toBe('working');
    expect(state.agentsById['agent:atlas']?.currentRoomId).toBe('room:runtime-floor');
    expect(state.agentsById['agent:atlas']?.currentTaskId).toBe('task:collect');
    expect(state.agentsById['agent:atlas']?.taskProgress).toBe(0.5);
    expect(state.tasksById['task:collect']?.progress).toBe(0.5);
    expect(state.workflowsById['workflow:runtime']?.roomId).toBe('room:runtime-floor');
    expect(state.activityFeed).toHaveLength(2);
    expect(state.activityFeed[0]?.eventId).toBe('evt:task-progress');
  });

  it('bounds activity feed and event history', () => {
    const state = reduceObservatoryRuntimeEvents(
      createInitialObservatoryRuntimeVisualState(),
      [
        event({ id: 'evt:1', timestamp: '2026-05-09T00:00:01.000Z' }),
        event({ id: 'evt:2', timestamp: '2026-05-09T00:00:02.000Z' }),
        event({ id: 'evt:3', timestamp: '2026-05-09T00:00:03.000Z' }),
      ],
      { maxEventHistory: 2, maxFeedEntries: 2 }
    );

    expect(state.activityFeed.map((entry) => entry.eventId)).toEqual(['evt:3', 'evt:2']);
    expect(state.eventHistory.map((entry) => entry.id)).toEqual(['evt:3', 'evt:2']);
  });

  it('creates replay-safe feed ids for repeated events', () => {
    const replayedEvent = event({
      id: 'evt:replayable',
      timestamp: '2026-05-09T00:00:01.000Z',
      type: 'LOG_RECEIVED',
    });
    const state = reduceObservatoryRuntimeEvents(createInitialObservatoryRuntimeVisualState(), [
      replayedEvent,
      replayedEvent,
    ]);

    expect(state.activityFeed.map((entry) => entry.id)).toEqual([
      'feed:evt:replayable:0',
      'feed:evt:replayable:1',
    ]);
    expect(new Set(state.activityFeed.map((entry) => entry.id)).size).toBe(2);
    expect(state.nextFeedSequence).toBe(2);
  });

  it('maps task failure into agent, task, and workflow error state', () => {
    const state = reduceObservatoryRuntimeEvent(
      createInitialObservatoryRuntimeVisualState(),
      event({
        agentId: 'agent:delta',
        id: 'evt:failed',
        level: 'error',
        progress: 0.33,
        roomId: 'room:workflow-pod',
        taskId: 'task:ship-regression',
        timestamp: '2026-05-09T00:00:03.000Z',
        title: 'Ship regression check',
        type: 'TASK_FAILED',
        workflowId: 'workflow:runtime',
      })
    );

    expect(state.agentsById['agent:delta']?.status).toBe('error');
    expect(state.agentsById['agent:delta']?.taskProgress).toBe(0.33);
    expect(state.tasksById['task:ship-regression']?.status).toBe('error');
    expect(state.tasksById['task:ship-regression']?.progress).toBe(0.33);
    expect(state.workflowsById['workflow:runtime']?.status).toBe('error');
    expect(state.workflowsById['workflow:runtime']?.roomId).toBe('room:workflow-pod');
  });

  it('maps approval required into blocked agent, task, and workflow state', () => {
    const state = reduceObservatoryRuntimeEvent(
      createInitialObservatoryRuntimeVisualState(),
      event({
        agentId: 'agent:echo',
        id: 'evt:approval',
        level: 'warning',
        progress: 0.82,
        roomId: 'room:runtime-floor',
        taskId: 'task:deploy-preview',
        timestamp: '2026-05-09T00:00:04.000Z',
        title: 'Deploy preview',
        type: 'APPROVAL_REQUIRED',
        workflowId: 'workflow:runtime',
      })
    );

    expect(state.agentsById['agent:echo']?.status).toBe('blocked');
    expect(state.tasksById['task:deploy-preview']?.status).toBe('blocked');
    expect(state.workflowsById['workflow:runtime']?.status).toBe('blocked');
  });

  it('stores valid visual action and direction overrides from event metadata', () => {
    const state = reduceObservatoryRuntimeEvent(
      createInitialObservatoryRuntimeVisualState(),
      event({
        agentId: 'agent:byte',
        id: 'evt:visual-action',
        metadata: {
          status: 'working',
          visualAction: 'sit',
          visualDirection: 'right',
        },
        timestamp: '2026-05-09T00:00:05.000Z',
        type: 'AGENT_STATUS_CHANGED',
      })
    );

    expect(state.agentsById['agent:byte']?.visualAction).toBe('sit');
    expect(state.agentsById['agent:byte']?.visualDirection).toBe('right');
  });

  it('does not let stale entity events overwrite newer state', () => {
    const initial = reduceObservatoryRuntimeEvent(
      createInitialObservatoryRuntimeVisualState(),
      event({
        agentId: 'agent:atlas',
        id: 'evt:newer',
        metadata: { status: 'working' },
        timestamp: '2026-05-09T00:00:10.000Z',
        type: 'AGENT_STATUS_CHANGED',
      })
    );

    const stale = reduceObservatoryRuntimeEvent(
      initial,
      event({
        agentId: 'agent:atlas',
        id: 'evt:older',
        metadata: { status: 'idle' },
        timestamp: '2026-05-09T00:00:01.000Z',
        type: 'AGENT_STATUS_CHANGED',
      })
    );

    expect(stale.agentsById['agent:atlas']?.lastEventId).toBe('evt:newer');
    expect(stale.agentsById['agent:atlas']?.status).toBe('working');
    expect(stale.droppedStaleEventCount).toBe(1);
  });
});
