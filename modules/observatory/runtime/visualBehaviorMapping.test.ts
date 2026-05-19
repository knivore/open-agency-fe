import { describe, expect, it } from 'vitest';

import {
  mapRuntimeStateToAgentVisualStates,
  mapRuntimeStateToRoomVisualStates,
} from '@/modules/observatory/runtime/visualBehaviorMapping';
import {
  createInitialObservatoryRuntimeVisualState,
  type ObservatoryRuntimeVisualState,
} from '@/modules/observatory/runtime/visualState';

describe('observatory pixel visual behavior mapping', () => {
  it('maps agent room, progress, and completion outcome into serializable visual state', () => {
    const state: ObservatoryRuntimeVisualState = {
      ...createInitialObservatoryRuntimeVisualState(),
      agentsById: {
        'agent:atlas': {
          id: 'agent:atlas',
          currentRoomId: 'room:runtime-floor',
          currentTaskId: 'task:collect',
          lastEventId: 'evt:done',
          lastUpdatedAt: '2026-05-09T00:00:00.000Z',
          status: 'complete',
          taskProgress: 1,
          taskTitle: 'Collect logs',
        },
      },
    };

    expect(mapRuntimeStateToAgentVisualStates(state)).toEqual([
      {
        action: 'idle',
        attention: undefined,
        agentId: 'agent:atlas',
        direction: 'down',
        movementKey: 'room:runtime-floor:task:collect',
        speechMessage: undefined,
        status: 'complete',
        targetRoomId: 'room:runtime-floor',
        taskEffectKey: 'task:collect:complete:evt:done',
        taskOutcome: 'complete',
        taskProgress: 1,
        taskTitle: 'Collect logs',
      },
    ]);
  });

  it('maps active agent statuses to attention overlays', () => {
    const state: ObservatoryRuntimeVisualState = {
      ...createInitialObservatoryRuntimeVisualState(),
      agentsById: {
        'agent:byte': {
          id: 'agent:byte',
          lastEventId: 'evt:working',
          lastUpdatedAt: '2026-05-09T00:00:00.000Z',
          status: 'working',
        },
        'agent:delta': {
          id: 'agent:delta',
          lastEventId: 'evt:error',
          lastUpdatedAt: '2026-05-09T00:00:00.000Z',
          status: 'error',
        },
        'agent:echo': {
          id: 'agent:echo',
          lastEventId: 'evt:blocked',
          lastUpdatedAt: '2026-05-09T00:00:00.000Z',
          status: 'blocked',
        },
      },
    };

    expect(
      mapRuntimeStateToAgentVisualStates(state).map((agent) => ({
        action: agent.action,
        agentId: agent.agentId,
        attention: agent.attention,
      })),
    ).toEqual([
      { action: 'phone', agentId: 'agent:byte', attention: 'thinking' },
      { action: 'idle', agentId: 'agent:delta', attention: 'error' },
      { action: 'idle', agentId: 'agent:echo', attention: 'approval' },
    ]);
  });

  it('maps review-like working tasks to reading action', () => {
    const state: ObservatoryRuntimeVisualState = {
      ...createInitialObservatoryRuntimeVisualState(),
      agentsById: {
        'agent:clio': {
          id: 'agent:clio',
          lastEventId: 'evt:review',
          lastUpdatedAt: '2026-05-09T00:00:00.000Z',
          status: 'working',
          taskTitle: 'Review output',
        },
      },
    };

    expect(mapRuntimeStateToAgentVisualStates(state)[0]?.action).toBe('reading');
  });

  it('maps planning-like tasks to reading while facing board direction', () => {
    const state: ObservatoryRuntimeVisualState = {
      ...createInitialObservatoryRuntimeVisualState(),
      agentsById: {
        'agent:planner': {
          id: 'agent:planner',
          lastEventId: 'evt:plan',
          lastUpdatedAt: '2026-05-09T00:00:00.000Z',
          status: 'working',
          taskTitle: 'Plan workflow implementation',
        },
      },
    };

    expect(mapRuntimeStateToAgentVisualStates(state)[0]).toMatchObject({
      action: 'reading',
      direction: 'up',
    });
  });

  it('prefers explicit visual action and direction overrides', () => {
    const state: ObservatoryRuntimeVisualState = {
      ...createInitialObservatoryRuntimeVisualState(),
      agentsById: {
        'agent:byte': {
          id: 'agent:byte',
          lastEventId: 'evt:sit',
          lastUpdatedAt: '2026-05-09T00:00:00.000Z',
          status: 'working',
          visualAction: 'sit',
          visualDirection: 'right',
        },
      },
    };

    expect(mapRuntimeStateToAgentVisualStates(state)[0]).toMatchObject({
      action: 'sit',
      direction: 'right',
    });
  });

  it('maps active workflow rooms and skips idle or unknown rooms', () => {
    const state: ObservatoryRuntimeVisualState = {
      ...createInitialObservatoryRuntimeVisualState(),
      workflowsById: {
        'workflow:runtime': {
          id: 'workflow:runtime',
          lastEventId: 'evt:runtime',
          lastUpdatedAt: '2026-05-09T00:00:00.000Z',
          roomId: 'room:runtime-floor',
          status: 'working',
        },
        'workflow:idle': {
          id: 'workflow:idle',
          lastEventId: 'evt:idle',
          lastUpdatedAt: '2026-05-09T00:00:00.000Z',
          roomId: 'room:commons',
          status: 'idle',
        },
      },
    };

    expect(mapRuntimeStateToRoomVisualStates(state)).toEqual([
      {
        roomId: 'room:runtime-floor',
        status: 'working',
        workflowId: 'workflow:runtime',
      },
    ]);
  });
});
