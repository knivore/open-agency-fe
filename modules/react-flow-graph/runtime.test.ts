import { describe, expect, it } from 'vitest';
import type { GraphDocument, GraphRuntimeEvent } from './types';
import {
  applyRuntimeEventsToGraphDocument,
  createGraphRuntimeTimeline,
  replayGraphRuntimeEvents,
} from './runtime';
import {
  recordedRuntimeReplayDocument,
  recordedRuntimeReplayEvents,
  recordedRuntimeReplayTimeline,
} from './fixtures/recordedRuntimeReplay';

const document: GraphDocument = {
  schemaVersion: 'graph.document.v1',
  id: 'graph-1',
  nodes: [
    { id: 'node-1', type: 'task', label: 'Task 1' },
    { id: 'node-2', type: 'task', label: 'Task 2' },
  ],
  edges: [{ id: 'edge-1', source: 'node-1', target: 'node-2', type: 'dependency' }],
};

const events: GraphRuntimeEvent[] = [
  {
    id: 'event-2',
    type: 'task.completed',
    timestamp: '2026-05-21T00:00:02.000Z',
    nodeId: 'node-1',
    edgeId: 'edge-1',
    status: 'succeeded',
  },
  {
    id: 'event-1',
    type: 'task.started',
    timestamp: '2026-05-21T00:00:01.000Z',
    nodeId: 'node-1',
    edgeId: 'edge-1',
    status: 'running',
  },
];

describe('graph runtime helpers', () => {
  it('applies the latest runtime status to nodes and edges', () => {
    const nextDocument = applyRuntimeEventsToGraphDocument(document, events);

    expect(nextDocument.nodes.find((node) => node.id === 'node-1')?.status).toBe('succeeded');
    expect(nextDocument.edges.find((edge) => edge.id === 'edge-1')?.status).toBe('succeeded');
    expect(nextDocument.nodes.find((node) => node.id === 'node-2')?.status).toBeUndefined();
  });

  it('creates and replays a timestamp-ordered runtime timeline', () => {
    const timeline = createGraphRuntimeTimeline(events);
    const replayedDocument = replayGraphRuntimeEvents(
      document,
      timeline,
      '2026-05-21T00:00:01.500Z'
    );

    expect(timeline.events.map((event) => event.id)).toEqual(['event-1', 'event-2']);
    expect(replayedDocument.nodes.find((node) => node.id === 'node-1')?.status).toBe('running');
    expect(replayedDocument.edges.find((edge) => edge.id === 'edge-1')?.status).toBe('running');
  });

  it('keeps the recorded replay fixture deterministic for animation smoke tests', () => {
    const replayedDocument = replayGraphRuntimeEvents(
      recordedRuntimeReplayDocument,
      recordedRuntimeReplayTimeline,
      '2026-05-21T00:00:05.500Z'
    );

    expect(recordedRuntimeReplayTimeline.events.map((event) => event.id)).toEqual(
      recordedRuntimeReplayEvents.map((event) => event.id)
    );
    expect(
      replayedDocument.edges.find((edge) => edge.id === 'fixture-edge-ingest-transform')?.status
    ).toBe('completed');
    expect(
      replayedDocument.edges.find((edge) => edge.id === 'fixture-edge-transform-store')?.status
    ).toBe('transmitting');
    expect(
      replayedDocument.nodes.find((node) => node.id === 'fixture-store')?.status
    ).toBeUndefined();
  });
});
