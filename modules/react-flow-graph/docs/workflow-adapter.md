# Workflow Adapter

The graph module does not know what a workflow, agent, task, or tool is. This app maps workflow data into generic graph
documents through `lib/workflows/workflowGraphAdapter.ts`.

## Boundary

- `modules/react-flow-graph` exports reusable graph primitives, validation, XYFlow adapters, and `GraphCanvas`.
- `lib/workflows/workflowGraphAdapter.ts` owns workflow-specific node types, edge types, palette items, toolbar actions,
  and conversion helpers.
- `components/workflow/WorkflowGraphCanvas.tsx` owns workflow-specific rendering and app callbacks.

This keeps the module portable: another project can copy `modules/react-flow-graph` without also taking the workflow
app.

## Conversion Helpers

Use `workflowDefinitionToGraphDocument(workflow)` to create a graph document from the current workflow model.

Use `graphDocumentToWorkflowDefinition(graph, workflow)` to apply graph edits back to an existing workflow definition.
The adapter currently maps:

- graph-created task nodes into new task definitions
- graph-created agent nodes into new agent definitions
- graph-created memory nodes into workflow memory definitions
- task labels and descriptions
- task instructions, expected output, tool ids, and human approval flag
- task positions into `workflow.nodes[].metadata.position`
- task dependencies
- conditional and non-default task flow edges
- agent assignments
- agent labels, descriptions, roles, model profiles, tool ids, and memory ids
- workflow tool node records, selected tool ids, selected tool names, positions, and linked agent ids
- memory labels, descriptions, types, scopes, catalog metadata, and positions
- deleted task nodes into removed task definitions, workflow nodes, dependent edges, and entrypoints
- deleted agent nodes into removed agent definitions and cleared task assignments
- deleted tool and memory nodes into removed workflow metadata/definitions and related access edges

When structured workflow editing rebuilds `workflow.nodes`, it must preserve existing task node metadata. Position data
lives on the workflow node record rather than the task definition, so dropping node metadata makes task nodes appear to
snap back after dragging.

The adapter creates graph nodes for workflow concepts that need visual editing:

- `workflow.approval` nodes for tasks with `human_approval_required`.
- `workflow.router` nodes for conditional or non-default workflow edges.
- `workflow.tool` nodes for per-agent tool lists.

Approval nodes are derived from tasks. Removing an approval node clears the task's human approval flag. Router nodes are
derived from workflow edges, but they participate in graph conversion: a `Task -> Router -> Task` path is written back
as one workflow edge with the original route type, condition, and metadata.

Task-to-task edges are split into workflow-specific graph edge descriptors:

- `workflow.dependency` for plain task ordering.
- `workflow.condition` for conditional routes.
- `workflow.data-flow` for non-default task flow edge types.

Conditional and non-default workflow routes are rendered as connected paths instead of loose annotations. The first edge
carries the route semantics from source task to router; the second edge connects router to target task. Runtime event
projection targets the task-to-router route edge so active conditions animate in the visible path.

## Runtime Events

`workflowActivityToGraphRuntimeEvents` maps workflow runs and monitoring execution events into generic
`GraphRuntimeEvent[]`.

The workflow detail graph uses these events for the live overlay. Event references are mapped to graph node ids when the
backend provides `task_id`, `agent_id`, or a `currentNodeId` such as `node-task-1`.

The adapter also projects task runtime status onto related edges:

- assigned agent to task edges show assignment activity
- dependency, condition, and data-flow edges into the active task show data movement or blocked state
- edge projections are event-only overlays and are never written back to the workflow definition

Detailed monitoring event types such as `task.started`, `task.completed`, and `task.failed` are normalized into graph
runtime statuses before projection, so task-level execution telemetry can drive the same node and edge animation layer
as high-level run rows.

## Validation

Use `validateWorkflowGraphDocument(graph)` when workflow UI needs errors in workflow terms. It wraps generic graph
validation issues with `workflowReference` and `workflowPath` fields.

Use `workflowDraftIssuesToGraphValidationIssues(graph, workflow, issues)` when the structured workflow editor already
has draft validation messages. The helper maps known task, agent, and edge messages back to graph targets so the canvas
can highlight the matching node or edge.

Generic graph validation still belongs in `modules/react-flow-graph`; workflow-specific interpretation belongs in the
adapter.

## Workflow Commands

Workflow graph editing uses domain-specific toolbar commands from the workflow adapter rather than the module's generic
add-node command:

- `workflow.addTask` creates a task node with a stable workflow task id.
- `workflow.addAgent` creates an agent node with a stable workflow agent id.
- `workflow.addTool` creates an empty workflow tool-list node. Clicking that node opens its drawer, where selected tools
  are stored on that specific graph node and linked to the agent connected by the tool-access edge.
- `workflow.addMemory` creates a workflow-owned memory node with a stable memory id.
- `workflow.validate` runs workflow graph validation and reports issues in workflow terms.

Save and run commands stay outside the current adapter surface until the workflow workspace passes the relevant
lifecycle callbacks explicitly.

## Tool UX

Each workflow tool node owns its own selected tool list. Tool selections are persisted into workflow metadata as
`workflow_graph_tool_nodes` records with the node id, selected `toolIds`, selected `toolNames`, optional linked
`agentId`, and graph position.

The drawer opened from a tool node is scoped to that node and the connected agent. It supports searching by tool name or
group and grouped navigation. Adding or removing a tool updates that node's selected tool list and the outgoing
tool-access edge data. A tool node may be reconnected, but each tool node should connect to at most one agent.

The graph rebuild path prefers catalog tool display names over stale workflow-owned copies named `Tools`, and it
persists selected names so adding another tool node does not collapse existing node labels back to the generic `Tools`
text.

## Memory UX

Workflow memory is selected through workflow memory definitions and `memory_ids` on agents and tasks.

- Graph memory nodes open a focused `Memory List` drawer. The drawer filters available catalog memories by memory type,
  lets users select the memory represented by that node, and keeps implementation details such as raw memory ids,
  backend link records, and linked-agent/task diagnostics out of the primary end-user view.
- Memory node file upload lives in the same drawer as `Upload file`. Uploaded files are ingested into memory and then
  represented by the selected memory node through catalog/document metadata on the workflow memory definition.
- Builder agent cards and Builder task cards use the same type-tabbed memory list pattern. Selecting memories updates
  `agent.memory_ids` or `task.memory_ids` in the workflow draft.
- The selected task detail panel also exposes the same memory selector for focused task editing.

Task document upload controls should not live on the task drawer. A task that needs uploaded source material should
reference a memory node or selected workflow memory; the file upload path is the memory node.

## Connection Rules

Workflow graph connections are accepted through `applyWorkflowGraphConnection(graph, edge)`:

- task to task creates a dependency edge
- agent to task creates or replaces that task assignment
- tool to agent creates tool access
- memory to agent or task creates memory access by updating the target agent or task `memory_ids`
- duplicate dependencies, duplicate tool access edges, and duplicate memory access edges are rejected
- unsupported pairs are rejected with workflow validation issues

The generic graph module does not encode these rules; `WorkflowGraphCanvas` passes the proposed connection to the
workflow adapter and commits only the returned graph document.

## Node Removal

Workflow graph nodes render a remove button in edit mode through the generic `GraphCanvas` `onRemoveNode` hook.

- Removing a task removes the task definition, its workflow node, derived nodes such as approval nodes, connected graph
  edges, dependent workflow edges, and invalid entrypoint references.
- Removing an agent removes the agent definition and clears affected task assignments.
- Removing a tool node removes that tool-node metadata record and its tool-access edge.
- Removing a memory node removes the workflow memory definition and related memory-access edges.
- Removing an approval node clears `human_approval_required` on the source task rather than deleting the task.

## Wrapper Components

The workflow app should consume the module through:

- `WorkflowGraphCanvas`
- `WorkflowGraphInspector`
- `WorkflowGraphToolbar`

These wrappers are intentionally outside `modules/react-flow-graph` because they import workflow adapter details and app
UI components.
