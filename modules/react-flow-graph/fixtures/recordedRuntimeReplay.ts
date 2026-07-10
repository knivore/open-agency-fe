import { createGraphRuntimeTimeline } from '../runtime';
import type { GraphDocument, GraphRuntimeEvent } from '../types';

export const recordedRuntimeReplayDocument: GraphDocument = {
  schemaVersion: 'graph.document.v1',
  id: 'fixture-runtime-replay',
  title: 'Recorded Runtime Replay Fixture',
  nodes: [
    {
      id: 'fixture-ingest',
      type: 'fixture.step',
      label: 'Ingest',
      position: { x: 40, y: 120 },
    },
    {
      id: 'fixture-transform',
      type: 'fixture.step',
      label: 'Transform',
      position: { x: 360, y: 120 },
    },
    {
      id: 'fixture-store',
      type: 'fixture.step',
      label: 'Store',
      position: { x: 680, y: 120 },
    },
  ],
  edges: [
    {
      id: 'fixture-edge-ingest-transform',
      source: 'fixture-ingest',
      target: 'fixture-transform',
      type: 'fixture.data',
      label: 'input',
    },
    {
      id: 'fixture-edge-transform-store',
      source: 'fixture-transform',
      target: 'fixture-store',
      type: 'fixture.data',
      label: 'output',
    },
  ],
};

export const recordedRuntimeReplayEvents: GraphRuntimeEvent[] = [
  {
    id: 'fixture-event-1',
    type: 'node.queued',
    timestamp: '2026-05-21T00:00:00.000Z',
    graphId: recordedRuntimeReplayDocument.id,
    nodeId: 'fixture-ingest',
    status: 'queued',
    payload: { input: { source: 'upload.csv', rows: 12 } },
  },
  {
    id: 'fixture-event-2',
    type: 'node.running',
    timestamp: '2026-05-21T00:00:01.000Z',
    graphId: recordedRuntimeReplayDocument.id,
    nodeId: 'fixture-ingest',
    status: 'running',
    payload: { runId: 'fixture-run-1' },
  },
  {
    id: 'fixture-event-3',
    type: 'edge.transmitting',
    timestamp: '2026-05-21T00:00:02.000Z',
    graphId: recordedRuntimeReplayDocument.id,
    edgeId: 'fixture-edge-ingest-transform',
    status: 'transmitting',
    payload: { data: { rows: 12, format: 'json' } },
  },
  {
    id: 'fixture-event-4',
    type: 'node.running',
    timestamp: '2026-05-21T00:00:03.000Z',
    graphId: recordedRuntimeReplayDocument.id,
    nodeId: 'fixture-transform',
    status: 'running',
    payload: { input: { rows: 12 } },
  },
  {
    id: 'fixture-event-5',
    type: 'edge.completed',
    timestamp: '2026-05-21T00:00:04.000Z',
    graphId: recordedRuntimeReplayDocument.id,
    edgeId: 'fixture-edge-ingest-transform',
    status: 'completed',
    payload: { output: { rows: 12, accepted: true } },
  },
  {
    id: 'fixture-event-6',
    type: 'edge.transmitting',
    timestamp: '2026-05-21T00:00:05.000Z',
    graphId: recordedRuntimeReplayDocument.id,
    edgeId: 'fixture-edge-transform-store',
    status: 'transmitting',
    payload: { data: { records: 12, destination: 'store' } },
  },
  {
    id: 'fixture-event-7',
    type: 'node.succeeded',
    timestamp: '2026-05-21T00:00:06.000Z',
    graphId: recordedRuntimeReplayDocument.id,
    nodeId: 'fixture-store',
    status: 'succeeded',
    payload: { result: { stored: 12 } },
  },
];

export const recordedRuntimeReplayTimeline = createGraphRuntimeTimeline(
  recordedRuntimeReplayEvents
);
