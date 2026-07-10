# Agentic Workflow Evolution Checklist

Last reviewed: 2026-06-25 against `agency-fe` and `agency`.

This checklist defines how Agency's workflow graph should evolve as an agentic execution surface. The goal is not to
become a general automation builder like n8n. The graph should make agent planning, execution, supervision, memory,
tools, handoffs, approvals, runtime evidence, and failures understandable and controllable.

Keep the reusable graph module portable. App-specific workflow semantics should stay in
`lib/workflows/workflowGraphAdapter.ts`, `components/workflow/WorkflowGraphCanvas.tsx`,
`components/workflow/WorkflowDetailWorkspace.tsx`, and related workflow UI wrappers. Backend workflow semantics live in
`agency/app/api/routes/workflows.py`, `agency/app/services/workflows.py`, `agency/app/services/workflow_validation.py`,
and runtime services.

## Source Review Snapshot

- `components/workflow/WorkflowDetailWorkspace.tsx` now normalizes every workflow detail tab request to `graph`, renders
  the graph directly as the primary surface, and keeps workflow metadata/configuration in an expandable supporting
  section.
- Legacy Builder and Runs tabs are no longer part of workflow detail. Runs are represented through the graph runtime
  overlay and linked to the dedicated `/runs` workspace.
- `components/workflow/WorkflowGraphCanvas.tsx` supports task, agent, tool, memory, approval, and router nodes; graph
  toolbar actions; validation highlighting; runtime event overlays; collapsed timeline state; latest-run selection when
  opened; run/type filters; expanded graph mode; persona notices; memory link counts; monitoring badges; governance
  metrics badges; per-node runtime failure/tool-call/duration evidence; graph-level resume and native tool approval
  controls; node-level resume, native approval, failed-task retry, checkpoint resume, and pause-point retry controls on
  implicated task, approval, tool, memory, and agent nodes; compact routine
  edge labels for dense graphs; repeated failure clustering on implicated nodes; tool source/provider/health/auth/
  permission/credential/approval cues; blocked-tool and missing-credential runtime state badges; memory-node
  retrieved-context runtime evidence with stale/missing/auth/permission warning badges and memory-edge activity
  projection; a compact task-template chooser behind Add Task; and metadata-backed artifact output nodes with a
  selected-node drawer. Derived approval nodes stay independently positionable, show a visible
  "Gates task" task tag, use a non-editable task-to-approval relationship edge, open an approval-specific drawer tied
  to the owning task, and do not expose generic freeform ports.
- `lib/workflows/workflowGraphAdapter.ts` owns workflow-specific conversion, graph node/edge vocabulary, connection
  rules, runtime-event projection, memory/tool/artifact node persistence, derived approval node layout, task
  input/runtime override metadata, conversion-safety validation, and graph-to-workflow round trips.
- Frontend tests cover graph adapter round trips, connection rules, memory nodes, runtime overlays, timeline default
  behavior, runtime playback viewport focus, autosave, persona version actions, governance controls, monitoring
  controls, local-save behavior, export/import, and runtime graph e2e coverage.
- Backend workflow routes now support shared memory, workflow memory links, persona version notices,
  use-latest/keep-current persona actions, workflow versions, validation, monitoring controls/events,
  runtime governance controls, stale execution repair, execution listing, and native-runtime enforcement for
  metadata-backed task runtime overrides and first-class workflow execution policy fields.
- Native runtime code includes approval coordination, resume execution primitives, failed-task retry replacement
  executions, checkpoint resume replacement executions, event streaming/projection, shared memory/context packs,
  governance recording, token/context health, workflow max-runtime/retry/concurrency/approval policy enforcement,
  task timeout/retry/model/max-token override enforcement, summary-level agent step lifecycle events, handoff edge
  lifecycle events, run summaries, and main-agent monitoring events. Task and agent graph nodes can request main-agent
  supervisor steering through approval-backed workflow steering records. The graph UI does not yet expose every backend
  primitive directly from nodes.

## Product Direction

- [x] Treat the graph as the primary workflow detail and editing surface; do not rebuild the legacy text-based builder.
- [x] Keep service automation secondary. Integrations appear as tool nodes, connector bindings, runtime parameters,
      memory sources, or execution adapters rather than as the main graph vocabulary.
- [x] Maintain a clean boundary between reusable graph primitives, app-specific workflow adapters, saved workflow
      definition, transient runtime events, and observability data.
- [x] Continue optimizing for agentic execution: reasoning steps, task ownership, context flow, tool use, memory access,
      approvals, retries, runtime evidence, and supervisor steering.
- [x] Make every visual node answer one user question without opening a drawer: who acts, what work runs, what context
      is available, what tools can be used, and what happened during execution.

## Current UX Baseline

- [x] Workflow detail is graph-first by default.
- [x] Legacy Builder and Runs tabs are hidden/removed from workflow detail.
- [x] The timeline is collapsed on load.
- [x] When users open the timeline, the latest run is selected by default unless the user already picked another run.
- [x] Users can switch runtime runs and event types without changing the saved graph.
- [x] Runtime event projection is render-only and does not persist transient node or edge statuses into the workflow
      definition.
- [x] Workflow metadata/configuration is expandable with a partial preview, bottom fade, and centered affordance.
- [x] Graph actions cover add task, add agent, add tool, add memory, validate, save, run, fit view, undo, and redo.
- [x] Nodes show compact validation/runtime/persona/monitoring/governance indicators where data is available.
- [x] Graph view shows a compact latest/selected run summary with completed/failed tasks, outputs, artifacts, tokens,
      duration, and follow-up prompts.
- [x] Paused tasks and native approval pause points expose node-level resume, approve, and reject controls when the
      backend runtime state allows those actions.
- [x] Approval nodes are derived task companions with an explicit "Gate for" task-to-approval relationship edge; clicking
      one opens an approval-specific drawer tied to the owning task while leaving the gate independently positionable for
      graph layout. Approval cards show a visible "Gates task" task tag and do not expose generic left/right freeform
      ports.
- [x] Clicking an Artifact node opens an artifact output drawer for durable output metadata.
- [x] Draft graph edits show a change summary against the last saved workflow before users save.
- [x] Add a graph empty state that guides users to create the first task or agent.
- [x] Surface backend save/autosave errors in the graph header with retry and enough diagnostic detail.
- [x] Confirm save uses canonical backend response consistently after graph edits, not only the optimistic payload.

## Agent Drawer

- [x] Move persona selection into the selected agent drawer.
- [x] Add a persona selector that applies a persona-backed agent snapshot to an existing workflow agent.
- [x] Populate agent identity and capability fields from the selected persona-backed agent while preserving graph links
      and task assignments.
- [x] Show persona version status in the drawer when a linked persona has a newer published version.
- [x] Add explicit actions to use the latest persona package or keep the current workflow snapshot.
- [x] Show which fields came from the selected persona.
- [x] Track manual overrides per persona-filled field.
- [x] Preserve manual overrides during persona refresh unless the user chooses to replace all fields.
- [x] Support creating a new workflow agent directly from a persona when no agent node is selected.
- [x] Add guardrail/behavior configuration in the agent drawer when backend agent guardrails are ready to persist.

## Task Drawer

- [x] Show selected task details from the graph drawer.
- [x] Show assigned agent, dependency, dependent task, memory access, and latest runtime event context for selected
      tasks.
- [x] Put expected output, instructions, approval, dependency edge metadata, and adjacent task navigation near task
      editing.
- [x] Show upstream inputs and downstream consumers through dependency/dependent task sections.
- [x] Add inline resource warnings for missing assigned agents, missing tools, missing memories, missing task
      dependencies, and missing handoff targets.
- [x] Add stronger inline warnings for ambiguous dependencies and blocked approvals.
- [x] Support task templates for common agentic patterns through a compact Add Task template chooser instead of
      top-level toolbar buttons for every task type.
- [x] Let a task declare whether it consumes previous task output, memory, uploaded documents, or human input as
      first-class structured settings.
- [x] Add task-level override controls and graph round trips for timeout, retry, model profile, max tokens, and
      approval policy using persisted task metadata.
- [x] Enforce metadata-backed task-level timeout, retry, model profile, max token, and approval policy overrides in the
      native runtime.
- [x] Promote task-level timeout, retry, model profile, max token, and approval policy overrides from metadata to
      first-class backend schema fields.

## Graph Semantics

- [x] Keep the current core node vocabulary focused: Agent, Task, Tool, Memory, Approval, and Router.
- [x] Use edge types for assignment, dependency, data flow, conditional routing, tool access, memory access, and
      handoff.
- [x] Make edge labels visible for assignment, dependency, condition, data flow, tool access, memory access, and handoff
      paths.
- [x] Add connection rules that reject ambiguous or unsupported modeling, including duplicate/self dependencies and
      unsupported endpoint pairs.
- [x] Represent human approval as derived approval nodes for approval-required tasks.
- [x] Show approval ownership through a derived task-to-approval edge and node copy instead of locking approval and task
      node movement together.
- [x] Persist graph layout and tool/memory node metadata without leaking runtime statuses into workflow definition.
- [x] Add first-class Output/Artifact nodes for durable workflow results using workflow metadata until backend schema
      fields exist.
- [x] Persist derived approval gate layout on the owning task metadata so moved approval nodes survive graph rebuilds.
- [x] Promote handoff edges from a declared type to a full backend/runtime-supported handoff model.
- [x] Keep dense graph labels readable by hiding or compressing labels when they stop clarifying execution.

## Runtime Experience

- [x] Show recent run activity as a replayable execution overlay on the saved graph.
- [x] Link runtime event rows back to run detail pages.
- [x] Show edge activity for assignment, dependency, handoff, tool access, approval gates, and downstream readiness through
      projected runtime events.
- [x] Let users inspect event payloads, metadata, summaries, timing, and statuses from the graph runtime panel and
      selected-node drawer.
- [x] Make it clear whether all runs or a specific run is being viewed through the run selector.
- [x] Show monitoring/supervisor steering request and applied counts on graph nodes when events exist.
- [x] Focus the canvas on the active node during playback without hiding important controls.
- [x] Add graph-level resume and native tool approval/rejection controls for paused or approval-waiting runs using
      existing runtime APIs.
- [x] Add retry and resume actions from failed task nodes, backed by the native runtime resume/retry primitives.
- [x] Add pause-point controls for human approval, blocked tools, missing context, and failed guardrails.
- [x] Add a compact run summary after execution: completed tasks, failed tasks, outputs, token use, duration, and
      follow-up actions.

## Agentic Control

- [x] Add workflow-level runtime governance controls for token budgets and context compaction.
- [x] Add workflow monitoring controls for main-agent supervision, exclusions, and approval proposals.
- [x] Add local-save controls with explicit active-run restart behavior.
- [x] Keep schedules, runtime adapters, execution host, shared memory, monitoring, governance, and documents as
      supporting workflow configuration rather than competing builder surfaces.
- [x] Add workflow-level max runtime, max retries, concurrency, and approval mode once backend schema and runtime
      enforcement exist.
- [x] Add task-level override controls for timeout, retry, model profile, max tokens, and approval policy backed by
      persisted task metadata.
- [x] Support supervised runs where a main agent can steer subagents from graph nodes without hiding task graph details.
- [x] Expose checkpoint/resume controls so long-running workflows can resume from the last completed task instead of
      restarting everything.
- [x] Keep graph edit review focused on the last saved local workflow.

## Memory And Context

- [x] Treat memory as explicit graph context through Memory nodes and memory access edges.
- [x] Let memory nodes represent workflow-owned context, catalog memories, memory collections, uploaded documents, and
      backend memory links.
- [x] Show memory access edges from memory to agent or task.
- [x] Keep file uploads attached to workflow or selected memory nodes, not task drawers.
- [x] Show backend memory link counts and catalog selection in the selected memory/agent drawers.
- [x] Show what context was actually retrieved during a run as runtime evidence on memory nodes and memory edges.
- [x] Add stale-memory, missing-memory, and permission/auth warnings where they affect execution.
- [x] Unify graph memory node definitions and backend memory links so users do not need to understand both concepts.

## Tools And Integrations

- [x] Represent integrations as capabilities available to agents through Tool nodes.
- [x] Keep tools attached to agents through tool-access edges and drawer controls instead of turning the graph into
      service automation plumbing.
- [x] Distinguish selected tool lists, workflow-owned tools, connector bindings, credentials, and runtime parameters in
      the tool drawer.
- [x] Show tool-call runtime events on connected tool and agent/task paths when event payloads identify tools.
- [x] Show tool source/type, connector provider, credential requirement, and approval requirement cues on tool nodes
      where tool definition metadata exists.
- [x] Add explicit tool health, auth status, permission, and approval requirement cues on tool nodes.
- [x] Distinguish local runtime tools, MCP tools, external service tools, and internal Agency tools more visibly in the
      graph.
- [x] Add clearer blocked-tool and missing-credential runtime states.

## Validation And Saving

- [x] Add graph validation from the toolbar and inline graph validation issue projection.
- [x] Prevent graph connections that would produce unsupported workflow semantics.
- [x] Keep autosave debounced and blocked while draft validation issues exist.
- [x] Add regression tests for autosave, persona application, connection rules, graph conversion round trips, runtime
      graph projection, and memory node round trips.
- [x] Call backend workflow validation before run, not only client draft validation.
- [x] Prevent saves when graph-to-workflow conversion would drop data.
- [x] Save canonical workflow state returned by the backend after every update.
- [x] Add revision or ETag-style protection to avoid overwriting newer workflow edits.
- [x] Surface backend save errors in the graph header with retry and actionable diagnostics.

## Observability

- [x] Show per-agent token and context-health badges on graph nodes where metrics exist.
- [x] Show workflow-level observability summary for model usage, workflow metrics, and agent metrics in workflow
      configuration.
- [x] Map monitoring and governance data back onto nodes where it helps users find supervision, token, and context
      pressure.
- [x] Keep detailed metrics on demand instead of turning the canvas into a dashboard.
- [x] Add per-node failure counts, tool-call counts, average duration, and recent failures.
- [x] Add failure clustering so repeated errors on the same agent, tool, task, or memory source are easy to spot.

## Collaboration And Review

- [x] Support workflow export packages and graph snapshot-style debugging via export/import tests.
- [x] Add change summaries for graph edits before save.
- [x] Keep marketplace submission/version review outside the local Agency repo.
- [x] Add comments or review notes on nodes once workflow collaboration becomes important.
- [x] Keep audit metadata available in workflow metadata, not as always-visible canvas chrome.

## Revised Implementation Milestones

- [x] Milestone 1: Close graph-first polish. Add empty states, backend save error surfacing, canonical backend response
      handling, backend validation before run, and regression tests for those gaps.
- [x] Milestone 2: Finish persona override tracking. Show persona-filled fields, preserve overrides during refresh, and
      support creating new agents from persona selection in the graph flow.
- [x] Milestone 3: Improve task and agent drawers with missing-resource warnings, structured task inputs, task
      templates, and stronger runtime evidence.
- [x] Milestone 4: Deepen memory/tool runtime evidence with retrieved-context display, stale/missing memory warnings,
      tool health/auth cues, and blocked-tool states.
- [x] Milestone 5: Add richer execution controls: node-level retry/resume, human approval pause points, checkpoint
      resume, and compact post-run summaries.
- [x] Milestone 6: Add output/artifact nodes, backend-supported handoff semantics, and clearer data-flow/output
      modeling.
- [x] Milestone 7: Add local graph change summaries, observability overlays, and failure clustering
      tied directly to graph nodes and edges.

## Done Criteria

- [x] A user can create and update a workflow entirely from the graph, including tasks, agents, tools, memory,
      approvals, runtime settings, and local-save behavior.
- [x] A user can create or update an agent from a persona inside the agent drawer while preserving or replacing field
      overrides intentionally.
- [x] A user can understand task order, agent ownership, tools, memory, approvals, outputs, and runtime state from the
      graph without opening every drawer.
- [x] A user can run a workflow and replay the latest execution without losing graph context.
- [x] A user can retry/resume or approve blocked execution from the graph when backend runtime state allows it.
- [x] A user can diagnose a failed run from the graph by following highlighted nodes, edges, event details, and grouped
      failure evidence.
- [x] The saved workflow definition, graph document, runtime event stream, monitoring data, and observability metrics
      remain separate and test-covered.
