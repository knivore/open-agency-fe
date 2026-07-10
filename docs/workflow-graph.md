# Workflow Graph

The workflow graph is the app-level graph experience for building, inspecting, running, importing, and exporting workflows. It is built on the reusable `modules/react-flow-graph` package, with workflow-specific behavior kept in adapters and wrapper components.

This document is the working reference for the current implementation. The earlier roadmap and adoption checklists were completed and removed after their decisions were folded into this reference.

## Architecture

`modules/react-flow-graph` is the portable graph foundation. It owns generic graph types, validation, persistence, runtime overlays, and the `GraphCanvas` wrapper around `@xyflow/react`.

Workflow-specific behavior lives outside the module:

- `lib/workflows/workflowGraphAdapter.ts` maps workflow definitions to and from generic `GraphDocument` data.
- `components/workflow/WorkflowGraphCanvas.tsx` provides workflow node cards, edge labels, toolbar actions, and runtime row rendering.
- `components/workflow/WorkflowGraphInspector.tsx` provides graph inspector editing where the generic inspector is used.
- `components/workflow/WorkflowGraphToolbar.tsx` provides workflow-specific toolbar actions.
- `components/workflow/WorkflowDetailWorkspace.tsx` owns workflow state, local save/run/import/export behavior, and the graph drawer.

The graph module must stay workflow-agnostic. It must not import workflow components, workflow API clients, app routes, or backend transport code.

## Graph Module

The reusable module is located at `modules/react-flow-graph`.

The public graph document model is intentionally generic:

- `GraphDocument`
- `GraphNode`
- `GraphEdge`
- `GraphViewport`
- `GraphSelection`
- `GraphRuntimeEvent`
- node and edge type descriptors
- palette, toolbar, inspector, and renderer extension points

`GraphCanvas` supports controlled and uncontrolled rendering, pan/zoom, fit view, selection, dragging, connecting, validation display, runtime overlays, replay, keyboard shortcuts, palette items, toolbar actions, minimap, controls, and custom renderers.

Reusable docs live in:

- `modules/react-flow-graph/README.md`
- `modules/react-flow-graph/docs/types.md`
- `modules/react-flow-graph/docs/adapters.md`
- `modules/react-flow-graph/docs/custom-node-types.md`
- `modules/react-flow-graph/docs/builder-ux.md`
- `modules/react-flow-graph/docs/runtime-events.md`
- `modules/react-flow-graph/docs/styling.md`
- `modules/react-flow-graph/docs/workflow-adapter.md`
- `modules/react-flow-graph/docs/boundary.md`

## Workflow Mapping

Workflow data is adapted into graph data as follows:

- agents become `workflow.agent` nodes
- tasks become `workflow.task` nodes
- human approvals become derived `workflow.approval` nodes
- route/condition metadata can become derived `workflow.router` nodes
- task dependencies become `workflow.dependency`, `workflow.condition`, or `workflow.data-flow` edges
- task agent assignments become `workflow.assignment` edges
- workflow-owned and catalog tools become `workflow.tool` nodes when tools are included
- tool access becomes directed `workflow.tool` edges from Tool node to Agent node
- workflow memory contexts become `workflow.memory` nodes
- memory access becomes directed `workflow.memory` edges from Memory node to Agent or Task node

Tool nodes are first-class graph entities. They can only connect to agent nodes, and those Tool -> Agent edges are the source of truth for agent tool access in the graph draft.

Memory nodes are also first-class graph entities. They can connect to agent nodes or task nodes, and those Memory -> Agent/Task edges are the source of truth for memory access in the graph draft.

Graph edits mutate the workflow draft. Save and run still use the existing workflow workspace paths. Marketplace submission is intentionally outside the local workflow graph surface.

## Editing Behavior

The graph tab supports both view and edit modes.

In view mode:

- selecting a task node opens the task drawer
- selecting an agent node opens the agent drawer
- selecting an edge pill opens the connection drawer
- drawers are read-only
- clicking outside a drawer closes it
- runtime overlays are visible and read-only

In edit mode:

- Add Task creates a full workflow task definition
- Add Agent creates a full workflow agent definition
- Add Tool creates a workflow-owned tool definition
- Add Memory creates a workflow-owned memory context definition
- Add Artifact creates a workflow-owned output/artifact node
- moving a task node updates workflow node position metadata
- connecting task to task creates a dependency
- connecting agent to task assigns or replaces that task's agent
- connecting tool to agent grants that agent tool access
- connecting memory to agent or task grants memory access
- deleting task nodes removes task definitions and dependent references
- deleting agent nodes removes agent definitions and clears task assignments
- Save Workflow persists the workflow draft through the existing save path
- Run Workflow delegates to the existing run path

Approval, router, runtime, and monitoring projections are selectable/inspectable but are not persisted as standalone editable workflow entities.

## Canvas Controls

The workflow graph header keeps graph reading controls separate from workflow lifecycle controls:

- Jump lets operators search and focus a node by type and label, which is useful once the graph grows beyond the visible viewport.
- Clean/Detailed controls edge-label density. Clean hides routine labels until selected, while approval, branching, and invalid edges remain visible because they carry operational meaning. The preference is persisted per workflow route.
- The legend wraps across rows on narrow widths so relationship colors and line styles remain readable.
- The minimap appears whenever the graph has nodes. It uses color-coded node silhouettes and React Flow initial node dimensions so custom workflow nodes are visible even before browser measurement completes.
- The bottom action bar stays focused on graph editing and execution actions such as layout, fit view, undo/redo, add node, validate, save, and run.

## Drawer Behavior

The workflow graph uses one right-side drawer model for graph selection.

Task drawer:

- shows task name, description, assigned agent, task path, task inputs, task overrides, memory access, task documents, and task runtime event details
- in graph mode, task content moves into the drawer rather than the node card
- in builder mode, task details stay in the task panel rather than a side drawer
- memory access and latest runtime event sections sit later in the drawer because they are supporting context, not the primary task editing flow

Agent drawer:

- shows name, role, description, model profile, linked tool access, linked memory access, global agent catalog actions, persona source, and latest runtime event
- for persona-backed agents, shows persona slug, workflow persona version, current/pinned/outdated state, and available
  persona version actions
- model profile is selected from available model profiles
- tool access is read-only in the agent drawer and is changed by connecting or removing Tool -> Agent edges
- memory access is read-only in the agent drawer and is changed by connecting or removing Memory -> Agent edges
- latest runtime event sits near the bottom because it is diagnostic context rather than the most common editing path

Tool drawer:

- shows tool name, description, type, ID, and linked agents
- tool access can be removed from linked agents in edit mode
- tool nodes are linked by connecting a Tool node to an Agent node
- for linked tool nodes, parameter inputs are generated from the backend tool `input_schema` rather
  than hardcoded per-tool UI rules
- fields marked with `x-agency-filled-by: "user"` or `x-agency-filled-by: "user_or_agent"` render
  as editable workflow defaults
- fields marked with `x-agency-filled-by: "agent"` render as read-only runtime hints so the user
  can see what the agent is still responsible for during execution
- fields marked with `x-agency-user-visible: false` are hidden from ordinary workflow setup surfaces
- `Write Text File` now exposes `base_folder` as workflow configuration and shows `filename`,
  `content`, and `mode` as agent-filled runtime inputs
- `Send HTTP Request` supports two exclusive setup paths: `Use webhook credentials` for connector
  binding, or `Fill tool parameters` for saved request defaults
- when `Send HTTP Request` uses connector credentials, credential metadata auto-fills binding fields
  such as purpose and target scope, and the request-parameter section remains informational so the
  user can see which values the agent will still provide at runtime

Memory drawer:

- shows memory name, description, type, scope, ID, linked agents, and linked tasks
- memory access can be removed from linked agents or linked tasks in edit mode
- memory nodes are linked by connecting a Memory node to an Agent or Task node

Edge drawer:

- assignment edges show agent, task, assigned-agent selector, and remove assignment action in edit mode
- tool access edges show tool and agent details, and can remove tool access in edit mode
- memory access edges show memory, target agent or task, access metadata, and can remove memory access in edit mode
- task-to-task edges support `default`, `conditional`, `success`, and `failure`
- conditional edges expose a condition input
- metadata is editable as JSON for task-to-task edges
- runtime event details appear when an edge has recent runtime activity

The drawer uses a transparent click-away layer. Clicking outside the drawer closes it; clicking inside the drawer does not.

## Validation

Generic graph validation lives in `modules/react-flow-graph`. It catches missing IDs, duplicate IDs, dangling edges, unsupported node/edge types, and descriptor-provided validation errors.

Workflow validation is mapped into graph references by the workflow adapter. This lets the graph tab highlight invalid workflow tasks, agents, and edges using workflow-language messages.

Save and run are blocked in edit mode when draft validation issues exist.

## Runtime Visualization

Runtime graph state is driven by transient `GraphRuntimeEvent` overlays. Runtime events never mutate workflow drafts.

Supported node states include:

- idle
- queued
- running
- waiting
- succeeded
- failed
- skipped

Supported edge states include:

- inactive
- transmitting
- blocked
- completed
- failed

Runtime behavior includes:

- live node and edge status styling
- animated active/transmitting edges
- moving packet markers on active edges
- edge payload badges
- node-level runtime summaries
- runtime timeline rows
- runtime detail panel with timestamp, status, target, payload, metadata, and timing
- play, pause, speed, and scrub controls for replay
- current replay event highlighting
- run filtering
- event type filtering
- projection filtering for hiding derived events
- viewport focus for selected runtime nodes or edge endpoints

Workflow run summaries, per-run execution events, and monitoring events are normalized into graph runtime events. Task activity is projected onto the task node, assigned agent node, assignment edge, incoming dependency edge, and downstream edge where appropriate.

Workflow monitoring policy fields, backend-only fields, steering actions, and their graph/UI impact are documented in
[Workflow Monitoring](workflow-monitoring.md).

Goal binding is run-scoped rather than graph-definition-scoped. The workflow run panel can attach a `goal_id` to a
manual run, but the editable workflow graph should not persist that selected runtime goal as a node or edge in the
workflow definition. Goal defaults may live in workflow metadata later, while the active `goal_id` remains part of the
execution launch context.

## Persona-Backed Agents

Published Persona Factory agents are ordinary workflow agents at runtime, but graph nodes preserve their persona
metadata for operator clarity:

- `personaSlug` is rendered as an `@slug` badge on agent nodes.
- `personaVersionId` is shown in node facts when present.
- `personaVersionStatus=outdated` uses the amber badge style and indicates a newer persona package exists.
- The workflow detail drawer exposes `Use latest persona` and `Keep current` for outdated persona-backed agents in edit
  mode.

Graph mapping reads persona metadata from embedded workflow `agent_definitions`, so persona badges still appear even
when there is no actionable backend version notice.

## Export And Import

Generic graph JSON export remains part of the reusable graph module.

Workflow graph export was intentionally moved out of the graph toolbar. Workflow export now exports a workflow package from the main workflow page, not just the graph shape.

Workflow exports include:

- workflow definition
- dependency metadata
- import notes
- model profile references
- tool references
- custom workflow-owned tool data where available

Workflow import is available from the workflow list page. Imports normalize unavailable model profiles and tools, preserve import reports on the workflow, and surface action-required messages on imported workflow detail pages.

## Routes

Primary workflow graph route:

- `/workflows/:id?tab=graph`

Graph-first edit route:

- `/workflows/:id/graph`
- redirects into the workflow detail graph tab in edit mode

## Test Coverage

Important coverage includes:

- graph module validation, IDs, layout, runtime replay, and boundary tests
- workflow graph adapter tests for mapping, validation, graph-to-workflow conversion, runtime projection, edge metadata, and saved layout
- workflow workspace tests for save, run, autosave, import/export, and graph integration
- e2e workflow graph runtime coverage
- e2e workflow export/import coverage

Common verification commands:

```bash
npm run typecheck
npm test -- modules/react-flow-graph/runtime.test.ts lib/workflows/workflowGraphAdapter.test.ts components/workflow/WorkflowDetailWorkspace.test.tsx
npm run test:e2e -- e2e/workflow-runtime-graph.spec.ts
```

## Maintenance Notes

Keep `modules/react-flow-graph` generic. Add workflow-specific behavior in `lib/workflows` or `components/workflow`.

Prefer extending `GraphRuntimeEvent` metadata/payload mapping over adding backend-specific assumptions to the graph module.

Keep graph runtime overlays separate from persisted graph/workflow data.

Keep graph toolbar actions domain-safe in the workflow wrapper. Do not expose generic Add Node in the workflow graph unless the adapter can create a valid workflow entity for that node type.

When changing drawer behavior, verify task, agent, and edge selection in view mode and edit mode.

When changing runtime projection, verify the graph module runtime tests and the real workflow graph tab.

When changing import/export, keep graph JSON export separate from workflow package export.

## Current Next Work

The graph is ready for the next operator-experience layer:

- live execution follow mode
- timeline grouping by run and task/agent
- error-first graph navigation
- backend event contract hardening for richer tool and artifact telemetry
