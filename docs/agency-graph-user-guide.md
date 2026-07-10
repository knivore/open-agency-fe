# Agency Graph User Guide

Agency Graph is a read-only investigation view for how Agency work is connected. It brings together workflow runs,
failures, agents, tools, memories, documents, entities, provenance, and health signals in one canvas.

The page is available at `/memory-graph` for compatibility, but the product surface is Agency Graph.

## What It Is For

Use Agency Graph when you want to:

- Inspect a failed run and see the surrounding workflow, runtime, container, event, and error records.
- Understand where a memory came from and what documents, entities, runs, or conversations support it.
- See whether graph projection is available, disabled, empty, or falling back to execution events.
- Follow relationships without reading raw ids as the primary UI.

Agency Graph is read-only. Actions in the inspector link to source records such as runs, workflows, and memories when
those links are available.

## Root Focus

The default focus is `All`. It can combine available memory projection data with recent run/event fallback data.

You can narrow the focus from the filter button. All, Memory, Run, and Workflow are the primary choices. Agent, Entity,
Document, and Error are available as direct-ID roots when you already know the record id.

| Focus    | Use it for                                                  |
|----------|-------------------------------------------------------------|
| All      | Broad overview across available roots.                      |
| Memory   | Memory provenance and related entities/documents.           |
| Run      | Failed or completed execution investigation.                |
| Workflow | Workflow lineage and recent execution context.              |
| Agent    | Agent relationships when projected graph data is available. |
| Entity   | Entity-to-memory/document relationships.                    |
| Document | Document and chunk provenance.                              |
| Error    | Error-centered investigation.                               |

When you choose a specific focus, root search appears for searchable roots so you can find the relevant run, workflow, or
memory.

## Filters

The visible filter set is intentionally small:

- Root focus and root search.
- Direct-ID root type for Agent, Entity, Document, and Error.
- Run status when Run focus is selected.
- Search graph, for visible node/edge text.
- Status, when the visible graph has statuses.
- Severity, when the visible graph has severities.
- Relationship type, when relationship choices are available.
- Clear filters.

Advanced operational presets, path exploration, timelines, clustering, temporal filters, and table panels are hidden for
now. Details move into the node/edge inspector after you click something on the graph.

The older graph mode plan grouped data as operational, knowledge, lineage, health, cost, and security views. Those modes
are not exposed as separate controls in the current UI. The same signals now appear through node colors, status rings,
warning colors, line styles, and the inspector.

Fallback source labels, recent-run counts, workflow counts, event counts, and projection diagnostics are intentionally
not shown in the filter popover. The filter should stay short enough for normal users. Source, coverage, live-state, and
truncation details live in the status tooltip instead.

## Canvas Controls

The toolbar above the canvas controls how the current graph is viewed:

- `Overview` shows the whole current graph.
- `Links` emphasizes connected nodes and relationships.
- `Focus` focuses on the selected node neighborhood.
- `2D` uses the Sigma constellation canvas with a flatter asteroid/comet atmosphere.
- `3D` uses the force-graph constellation view with orbit motion.
- In 2D, rotate-left and rotate-right controls adjust the canvas orientation.
- In 3D, pause/resume orbit controls camera motion, and reset view returns the camera to a useful overview distance.
- Refresh reloads the active graph/root data.
- Fullscreen expands the graph surface for dense investigations.

## Reading The Graph

Colors and line styles are summarized by the compact legend:

- Node color indicates the user-facing category, such as Run, Workflow, Knowledge, Tooling, or Issue.
- Status rings indicate states such as Failed or Running.
- Warning colors highlight failures, stale context, missing embeddings, unavailable projections, and similar health
  signals.
- Edge tones differentiate operational, lineage, knowledge, cost, and governance relationships.

Repeated execution event nodes are condensed out of the default canvas. Select the run or parent node to see grouped
event summaries in the inspector.

The 2D and 3D renderers are two views over the same filtered graph document. 3D may summarize dense workflow runs into
visual clusters at overview distances so the scene stays navigable, while the inspector and filters remain grounded in
the graph records.

When projected Neo4j data is available, selecting a projected node can expand its immediate neighborhood on demand. This
keeps the first view bounded while still letting you pull nearby context into the canvas when you need it.

## Fallback Graph Mode

If Neo4j projection is unavailable or empty, Agency Graph can synthesize a fallback graph from execution APIs:

- `/executions`
- `/executions/{executionId}/events`
- `/observability/executions/{executionId}/timeline`

Fallback graphs are useful for failed runs because events often exist even when durable projection is offline. They are
not a persisted Neo4j projection, so use them as runtime evidence rather than long-term graph state.

Large event payloads and metrics are not placed into the default graph document. They are shown in the inspector only
when you select the relevant event-derived node or parent summary.

## Empty States

| Empty state               | What it means                                          | What to do                                                                |
|---------------------------|--------------------------------------------------------|---------------------------------------------------------------------------|
| Loading memory roots      | The page is still loading root choices.                | Wait or refresh.                                                          |
| No active memories found  | No active memory roots are available.                  | Use Run focus if runs exist, or create memory through normal workflows.   |
| Graph backend disabled    | Backend graph read is disabled.                        | Use Run focus for event fallback, or enable graph read in backend config. |
| Graph backend unavailable | Neo4j graph read is unavailable.                       | Use Run focus for event fallback, then check backend/Neo4j status.        |
| Graph request failed      | The graph read request errored.                        | Refresh or inspect the backend error.                                     |
| Graph returned zero nodes | The request succeeded but projection returned nothing. | Try another root or use run fallback.                                     |

## Performance Limits

Agency Graph is bounded so it stays navigable:

- Projection requests use depth `2` and limit `250`.
- The frontend renders at most `250` nodes and `500` edges.
- Event fallback uses at most `120` events per run.
- Recent-run fallback keeps at most `40` recent runs.
- Workflow fallback keeps at most `24` workflow runs.
- Long labels are shortened to `80` characters.

When a graph is capped, the filter popover shows a truncation badge. The graph remains useful for investigation, but it
is not showing every possible node or edge.

If live graph updates are enabled by the deployment, the status tooltip shows the live connection state. Live updates are
best-effort; refresh the graph if the connection is offline or if projected data appears stale.

## Status Indicator

The small status dot beside the filter and refresh controls summarizes the graph state:

| Status  | Meaning                                                              |
|---------|----------------------------------------------------------------------|
| Green   | The selected graph has data or fallback evidence available.          |
| Blue    | Agency Graph is checking the backend or loading graph data.          |
| Amber   | Graph status, projection, or run events are unavailable or degraded. |
| Neutral | No projected data is available for the current root.                 |

Hover the status dot for source, root, root count, live update state, and truncation details.
