import { describe, expect, it } from 'vitest';

import type { ObservatoryLayoutDocument } from '@/modules/observatory/engine/world/layoutTypes';
import {
  createObservatoryLayoutInspectionLogEntries,
  createObservatoryRuntimeContextInspectionLogEntries,
  createObservatoryStaticRuntimeLogAdapter,
  selectObservatoryAgentInspectionLogs,
  selectObservatoryRoomInspectionLogs,
} from '@/modules/observatory/runtime/inspectionLogs';

const layout: ObservatoryLayoutDocument = {
  schemaVersion: 1,
  world: {
    grid: { size: { width: 12, height: 8 }, tileSize: 32 },
    id: 'world:test',
    maps: [
      {
        defaultFloorAssetId: 'floor:office-blue',
        id: 'map:test',
        name: 'Test Map',
        objects: [
          {
            assetId: 'decor:planning-whiteboard',
            id: 'object:whiteboard',
            position: { x: 2, y: 2 },
            roomId: 'room:alpha',
            runtime: {
              logs: ['[board] planning notes updated'],
              recentEvents: ['09:00 · planning board received workflow context'],
              runId: 'run:alpha',
              workflowId: 'workflow:alpha',
            },
          },
        ],
        rooms: [
          {
            bounds: { height: 6, width: 10, x: 1, y: 1 },
            id: 'room:alpha',
            kind: 'workspace',
            name: 'Alpha Room',
            runtime: {
              logs: ['[room] workflow alpha log line'],
              recentEvents: ['09:01 · workflow alpha event'],
              runId: 'run:alpha',
              workflowId: 'workflow:alpha',
            },
          },
        ],
        size: { width: 12, height: 8 },
        agents: [
          {
            assetId: 'human:atlas',
            id: 'agent:atlas',
            name: 'Atlas',
            position: { x: 3, y: 3 },
            roomId: 'room:alpha',
            runtime: {
              logs: ['[atlas] started implementation', '[atlas] completed validation'],
              recentEvents: ['09:02 · Atlas streamed runtime event'],
              runId: 'run:alpha',
              workflowId: 'workflow:alpha',
            },
            status: 'working',
          },
        ],
      },
    ],
    name: 'Test World',
  },
};

describe('observatory pixel inspection logs', () => {
  it('extracts agent, object, and room runtime metadata into queryable log entries', () => {
    const entries = createObservatoryLayoutInspectionLogEntries(layout);

    expect(entries).toHaveLength(7);
    expect(entries.map((entry) => entry.workflowId)).toEqual(Array(7).fill('workflow:alpha'));
    expect(entries.some((entry) => entry.source === 'runtime-event')).toBe(true);
    expect(entries.some((entry) => entry.source === 'runtime-log')).toBe(true);
  });

  it('selects full workflow context when inspecting an agent', () => {
    const entries = createObservatoryLayoutInspectionLogEntries(layout);
    const result = selectObservatoryAgentInspectionLogs(entries, {
      agentId: 'agent:atlas',
      workflowId: 'workflow:alpha',
    });

    expect(result.status).toBe('ready');
    expect(result.entries).toHaveLength(7);
    expect(result.entries.some((entry) => entry.agentId === 'agent:atlas')).toBe(true);
    expect(result.entries.some((entry) => entry.objectId === 'object:whiteboard')).toBe(true);
  });

  it('selects room workflow logs across room, object, and agent entries', () => {
    const entries = createObservatoryLayoutInspectionLogEntries(layout);
    const result = selectObservatoryRoomInspectionLogs(entries, {
      roomId: 'room:alpha',
      workflowId: 'workflow:alpha',
    });

    expect(result.status).toBe('ready');
    expect(result.entries).toHaveLength(7);
    expect(result.entries.some((entry) => entry.agentId === 'agent:atlas')).toBe(true);
    expect(result.entries.some((entry) => entry.objectId === 'object:whiteboard')).toBe(true);
  });

  it('provides a static adapter with the same query contract as future backend adapters', async () => {
    const entries = createObservatoryLayoutInspectionLogEntries(layout);
    const adapter = createObservatoryStaticRuntimeLogAdapter(entries);
    const result = await adapter.getRoomLogs({
      roomId: 'room:alpha',
      workflowId: 'workflow:alpha',
    });

    expect(result.status).toBe('ready');
    expect(result.entries).toHaveLength(7);
  });

  it('converts loaded run events and runtime logs into inspection entries', async () => {
    const entries = createObservatoryRuntimeContextInspectionLogEntries([
      {
        events: [
          {
            agentId: 'agent:atlas',
            eventType: 'task_started',
            message: 'Atlas started implementation.',
            sequence: 1,
            taskId: 'task:alpha',
            timestamp: '2026-05-11T00:00:00.000Z',
          },
        ],
        logs: ['[atlas] streamed backend runtime log line', '[runtime] workflow room log line'],
        run: {
          id: 'run:alpha',
          status: 'running',
          workflowId: 'workflow:alpha',
        },
        workflow: {
          agent_definitions: [{ id: 'agent:atlas', name: 'Atlas', role: 'main-agent' }],
          id: 'workflow:alpha',
          name: 'Alpha Workflow',
        },
      },
    ]);
    const adapter = createObservatoryStaticRuntimeLogAdapter(entries);

    expect(entries).toHaveLength(3);
    expect(
      (await adapter.getAgentLogs({ agentId: 'agent:atlas', workflowId: 'workflow:alpha' })).entries
    ).toHaveLength(3);
    expect(
      (await adapter.getRoomLogs({ roomId: 'room:alpha', workflowId: 'workflow:alpha' })).entries
    ).toHaveLength(3);
  });
});
