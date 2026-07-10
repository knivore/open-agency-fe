# Runtime Events

`GraphRuntimeEvent` is the module-level shape for live graph activity. It is intentionally transport-neutral: callers
can feed it from polling, websockets, server-sent events, recorded replays, or local fixtures.

## Event Shape

Runtime events can reference a graph, node, edge, status, payload, and metadata:

```ts
const event = {
  id: 'event-1',
  type: 'task.started',
  timestamp: '2026-05-21T00:00:00.000Z',
  graphId: 'workflow-1',
  nodeId: 'task-node-1',
  status: 'running',
  payload: { runId: 'run-1' },
};
```

The core module does not prescribe status names. Workflow apps can use statuses such as `queued`, `running`, or
`succeeded`; infrastructure apps can use statuses such as `healthy`, `degraded`, or `offline`.

For common execution UI, the module exports node statuses `idle`, `queued`, `running`, `waiting`, `succeeded`, `failed`,
and `skipped`, plus edge statuses `inactive`, `transmitting`, `blocked`, `completed`, and `failed`.

## Canvas Integration

Pass events to `GraphCanvas` through `runtimeEvents`:

```tsx
<GraphCanvas
  document={document}
  runtimeEvents={events}
  onRuntimeEventClick={(event) => inspectEvent(event)}
/>
```

The default canvas shows the most recent events in a small overlay. Projects can replace each row with
`renderRuntimeEvent`.

When events include `nodeId` or `edgeId`, `GraphCanvas` projects the latest status onto the rendered node or edge.
Clicking a node-targeted event selects that node. Edge-targeted events show the edge ID in the detail view without
forcing ReactFlow edge selection. This projection is render-only; graph edits continue to write back to the saved
document without copying transient runtime statuses into the document.

The runtime overlay includes a replay slider plus play, pause, and speed controls. Live mode applies all supplied
events. Scrubbing the slider applies only events up to the selected event index, and playback advances through the same
replay cursor, which lets project UIs inspect an execution without changing the persisted graph document. Replay mode
marks the current event row, keeps the event detail panel synced to that event, and focuses the viewport on the current
event while playback is running.

Payload summaries prefer common data keys such as `message`, `summary`, `error`, `input`, `output`, `result`, `data`,
`artifactId`, `runId`, `taskId`, and `agentId`. Project renderers can replace this behavior through
`renderRuntimeEvent`.

When an active event references an edge, the default edge renderer shows the latest payload summary as a small transient
badge near that edge. Live mode can show the latest badge for each active edge. Replay mode shows the current edge event
badge more prominently so older applied events do not clutter the graph. These badges follow the replay slider and are
not persisted to the graph document.

Clicking a runtime event row opens a compact event detail view with summary rows, timing rows when duration or latency
metadata exists, and collapsible payload and metadata JSON. The detail view is read-only and follows the same replay
cursor, so events outside the current replay position are hidden.

## Replay Helpers

Use `createGraphRuntimeTimeline(events)` to sort events into a replayable timeline.

Use `applyRuntimeEventsToGraphDocument(document, events)` to project the latest node and edge statuses onto a document
without changing the saved document format.

Use `replayGraphRuntimeEvents(document, timeline, timestamp)` to render the graph state at a point in time.

The module ships a deterministic fixture for browser and unit tests:

```ts
import {
  recordedRuntimeReplayDocument,
  recordedRuntimeReplayEvents,
  recordedRuntimeReplayTimeline,
} from '@/modules/react-flow-graph/fixtures/recordedRuntimeReplay';
```

Use this fixture when a project needs stable animation, replay, and payload-preview coverage without relying on a live
backend.

## Stream Adapter

`GraphRuntimeEventStreamAdapter` is the generic contract for event sources:

```ts
const adapter = {
  getSnapshot: async () => events,
  subscribe: (listener) => {
    socket.on('event', listener);
    return () => socket.off('event', listener);
  },
};
```

## Adapter Contract

Project adapters should normalize backend events before passing them to `modules/react-flow-graph`.

Required fields:

- `id`: stable event ID. If the backend does not provide one, derive one from timestamp, target ID, event type, and
  sequence number.
- `type`: project event type, such as `task.started`, `edge.transmitting`, or `tool.output`.
- `timestamp`: ISO-8601 timestamp. Replay sorting is lexical, so always use normalized UTC timestamps.

Target fields:

- `graphId`: optional graph/document ID. Use it when one stream can contain events for multiple graphs.
- `nodeId`: graph node ID to receive the latest runtime status.
- `edgeId`: graph edge ID to receive the latest runtime status.
- Use node-only events for node state, edge-only events for data movement, and separate events when both targets need
  different statuses.

Status fields:

- Node status should use `idle`, `queued`, `running`, `waiting`, `succeeded`, `failed`, or `skipped` when the default UI
  should style it.
- Edge status should use `inactive`, `transmitting`, `blocked`, `completed`, or `failed` when the default UI should
  style it.
- Custom statuses are allowed, but projects should provide custom renderers or CSS if they need a visible treatment.

Payload and metadata:

- `payload` is for user-facing event details such as inputs, outputs, result summaries, artifact IDs, errors, or request
  IDs.
- `metadata` is for adapter-only context such as backend source, execution IDs, tenant IDs, latency, token usage, cost,
  or raw event references.
- Keep large payloads out of the event list. Store full artifacts elsewhere and put IDs or short summaries in `payload`.

Ordering:

- Emit monotonic timestamps for deterministic replay.
- If several backend events share the same timestamp, include enough ordering in derived IDs or pre-sort before passing
  to `GraphCanvas`.
- Do not mutate the saved `GraphDocument` with runtime statuses. Keep runtime state in `runtimeEvents` so the overlay
  remains read-only.

## Boundary

Runtime event transport belongs outside `modules/react-flow-graph`. The module should receive already-normalized events
and render or route them through callbacks.
