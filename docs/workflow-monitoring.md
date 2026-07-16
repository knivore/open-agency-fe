# Workflow Monitoring

For the consolidated integration operating model across setup, delivery, workflow bindings, and
future TODOs, start with [integration-operations-guide.md](./integration-operations-guide.md).

Workflow monitoring is the workflow-level policy surface for the background main-agent monitor.
The frontend displays and updates the policy, while the backend owns the canonical monitoring
behavior, findings, proposals, evaluation records, steering requests, and approval routing.
Token budgets and compaction policy are configured in the separate Runtime governance panel; see
[`workflow-runtime-governance.md`](workflow-runtime-governance.md).

This document explains the fields exposed by `WorkflowMonitoringOperatorPayload` and
`WorkflowMonitoringControls` in `types/workflows.ts`.

## Runtime Boundary

Monitoring policy is fetched and updated through:

- `GET /api/main-agent/monitor`
- `PATCH /api/main-agent/monitor`
- `GET /api/workflows/:id/monitoring`
- `PATCH /api/workflows/:id/monitoring`
- `GET /api/workflows/:id/monitoring/events`

The Next.js API routes proxy these requests to the Open Agency backend with the authenticated frontend
user. The frontend optimistically updates local query state, then invalidates workflow and
monitoring-event queries after the backend responds.

The Main-Agent Monitor workspace at `/operations/main-agent-monitor` is the operator command center. It uses
`GET /api/main-agent/monitor` to show monitor loop health, latest tick counters, monitored workflow
coverage, pending monitor approvals, repo-write permission gates, recent findings/proposals/steering
requests, and the active notification route. It uses `PATCH /api/main-agent/monitor` to update the
active main-agent monitor approval conversation and optional `monitor_delivery` metadata for
Telegram, Discord, or WhatsApp delivery.

The command center does not silently mutate workflows. Approval buttons act on explicit backend
approval requests, and repo-write requests remain human-held gates.

## Operator Workflow

Use `/operations/main-agent-monitor` when the question is "what needs human attention across all workflows?"
Use a workflow's Monitoring tab when the question is "how should this specific workflow be watched?"

Normal monitor review flow:

1. Check the status counters and confirm the monitor is enabled.
2. Check the latest tick time in the runtime health section.
3. Review the Human attention inbox for pending approvals.
4. Treat Repository write gates as privileged local access requests. Approve only when the workflow is expected to edit
   the named repo and the backend/container mount is configured read-write.
5. Check Recent monitor evidence to understand why the approval was created.
6. Adjust Notification routing if prompts should go to a linked external channel instead of the default monitor inbox.
7. Open the workflow-level Monitoring tab for per-workflow exemptions, supervision scope, steering actions, or
   auto-apply settings.

The page refetches periodically, but approval decisions are still explicit user actions. The frontend sends approval
decisions to the conversation approval API; the backend owns the actual policy enforcement and mutation application.

Monitoring data is not embedded in normal workflow execution definitions. Before starting a run,
`buildExecutionWorkflowDefinition` removes `workflow.monitoring` from the workflow definition sent
to the runtime. Monitoring affects the workflow through backend-side observation, proposals,
approvals, steering events, run metadata, and graph overlays, not by directly rewriting the task
or agent definitions in the frontend execution payload.

## Goal Binding

A workflow run may contribute to a durable goal by carrying `goal_id` in runtime input, trigger metadata, and the
backend execution creation payload. This does not make the workflow definition itself the goal; it makes that execution
an attempt under the goal.

Current frontend support:

- the workflow run panel has a goal selector backed by `goalsApi.getOperatorView()`
- operators can create a guarded active goal from the selector
- manual workflow runs send the selected `goal_id` through execution input, trigger metadata, and the execution payload
- the selected runtime goal is stored per workflow in local browser state so repeat manual runs keep the same binding

The selected `goal_id` should stay run-specific. One workflow can advance different goals over time, while workflow
metadata may still provide reusable goal defaults such as guarded autonomy or suggested success criteria.

## Workflow Governance Queue

Workflow detail now includes a separate Governance Queue panel for record-level operator work on
workflow improvement proposals and steering approvals. This panel is distinct from runtime
governance:

- monitoring explains why the backend monitor created findings, proposals, or steering requests
- runtime governance configures token-budget and compaction policy
- governance queue handles evidence linkage, approval routing, remediation drift, and manual review
  closure for existing governance records

The frontend currently calls these workflow-scoped proxy routes:

- `GET /api/workflows/:id/governance/review-queue`
- `GET /api/workflows/:id/governance/document-suggest`
- `POST /api/workflows/:id/governance/bundle/:recordKind/:recordId`
- `POST /api/workflows/:id/governance/action/:recordKind/:recordId/attach-evidence`
- `POST /api/workflows/:id/governance/action/:recordKind/:recordId/request-approval`
- `POST /api/workflows/:id/governance/action/:recordKind/:recordId/resolve`
- `POST /api/workflows/:id/governance/action/:recordKind/:recordId/dismiss`
- `POST /api/workflows/:id/governance/action/:recordKind/:recordId/reopen`

### Governance Queue Operator Flow

Use the Governance Queue when the question is "what record-level governance work is still open for
this workflow?"

Normal governance review flow:

1. Open the highest-priority queue item and read the audit reason and suggested next actions.
2. Review Suggested evidence and attach the most relevant uploaded workflow document when evidence is missing.
3. Request approval when the record is evidence-backed and should move into a pending approval path.
4. Use Preview Bundle to inspect the guarded evidence-plus-approval workflow before mutating the record.
5. Use Apply Bundle when the top-ranked evidence suggestion and approval routing are both acceptable.
6. Use Resolve or Dismiss only for manual operator closure when no linked approval request exists.
7. Use Reopen to return a manually closed record to active review.

Manual lifecycle actions are intentionally blocked while a governance record is already linked to an
approval request. That prevents the UI from creating local workflow state that silently disagrees
with the canonical approval record.

### Governance Queue Item Shape

Each governance queue item now includes:

| Field                 | Meaning                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `record_kind`         | Either `improvement_proposal` or `steering_approval`.                                                      |
| `record_id`           | Workflow-owned governance record id.                                                                       |
| `status`              | Record status after approval sync and manual operator transitions.                                         |
| `priority`            | Backend-derived review priority such as `repair`, `approval`, `evidence`, `review`, or `resolved`.         |
| `audit_status`        | Current audit outcome for linked approval drift or missing references.                                     |
| `audit_reason`        | Human-readable explanation of the current audit state.                                                     |
| `approval_request_id` | Linked approval id when one exists.                                                                        |
| `approval_request`    | Audit-facing summary of the linked approval request, including status and timestamps when available.       |
| `evidence_links`      | Uploaded workflow documents already linked to this governance record.                                      |
| `next_actions`        | Backend-recommended operator actions for the record.                                                       |
| `activity`            | Derived governance timeline including creation, evidence links, approval requests, decisions, and updates. |

### Governance Activity Timeline

The Governance Queue detail dialog renders `activity` as a compact operator timeline. This timeline
is currently derived from existing workflow state rather than a dedicated append-only event log, so
it is strongest for these events:

- record creation timestamps from proposal or steering history
- evidence link attachment timestamps from workflow document links
- approval request creation timestamps from linked approval records
- decision timestamps such as resolve, dismiss, approve, reject, or apply

When the backend sees a meaningful `updated_at` change without a stronger event signal, it may emit
a generic `updated` activity entry instead of guessing a specific operator action.

## Visible Monitoring Controls

These fields are currently visible in the Main agent monitoring panel.

| UI label              | Payload field                                  | Capability                     | Meaning                                                                                                              | Impact                                                                                                                                                                                                                                             |
| --------------------- | ---------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monitor workflow      | `enabled`, `controls.enabled`                  | Workflow monitoring gate       | Controls whether the backend main-agent monitor can inspect active and recent runs for this workflow.                | When disabled, the workflow is treated as exempt. The graph labels monitored nodes as `Monitoring off`, and the exemption reason can be saved.                                                                                                     |
| Monitoring level      | `level`, `controls.level`                      | Monitoring intensity           | Selects the policy level: `minimal`, `standard`, or `strict`.                                                        | The frontend shows this as the monitoring status. Backend policy decides how many checks, evaluations, or interventions each level enables.                                                                                                        |
| Self monitoring       | `controls.allow_self_monitoring`               | Main-agent self-supervision    | Allows the main-agent monitor to monitor the main agent default workflow itself.                                     | Only shown when `is_main_agent_default_workflow` is true. Turning it on also enables workflow monitoring.                                                                                                                                          |
| Exemption reason      | `reason`                                       | Audit context                  | Human-readable explanation for why monitoring is disabled.                                                           | Saved only while monitoring is off. Helps operators understand why this workflow was excluded.                                                                                                                                                     |
| Token supervision     | `controls.supervise_token_usage`               | Usage supervision              | Allows the monitor to watch token usage and budget-related run signals.                                              | Backend can create findings, proposals, or steering requests from token/budget pressure where supported.                                                                                                                                           |
| Context supervision   | `controls.supervise_context_health`            | Context health supervision     | Allows the monitor to watch context-window health, compaction, and related run diagnostics.                          | Backend can detect context degradation and propose or request corrective action where supported.                                                                                                                                                   |
| Tool supervision      | `controls.supervise_tool_failures`             | Tool failure supervision       | Allows the monitor to inspect tool failures reported by workflow runs.                                               | Backend can create findings or improvement proposals from repeated or high-risk tool failures.                                                                                                                                                     |
| Sub-agent supervision | `controls.supervise_subagents`                 | Agent supervision              | Controls whether sub-agent nodes are supervised.                                                                     | When disabled, graph agent nodes show `Sub-agent supervision off`. Backend should avoid supervising sub-agent behavior under this workflow policy.                                                                                                 |
| Steering approvals    | `controls.route_steering_requests_to_approval` | Approval-gated steering        | Routes supervisor steering requests through approval controls before they are applied.                               | Steering approvals appear in the monitor proposals panel. Operators can approve, reject, or request changes.                                                                                                                                       |
| HITL delegation       | `controls.delegate_hitl_to_main_agent`         | Human-in-the-loop delegation   | Lets the main agent handle eligible HITL checkpoints instead of holding them only for a human.                       | Run detail shows `HITL delegation: Main agent` when workflow metadata reports this setting.                                                                                                                                                        |
| Excluded sub-agents   | `controls.excluded_subagent_ids`               | Agent exclusion                | Removes selected sub-agents from monitor supervision.                                                                | Graph labels excluded agent nodes as `Excluded from supervision`; tasks assigned to excluded agents show `Assigned agent excluded`.                                                                                                                |
| Excluded tasks        | `controls.excluded_task_ids`                   | Task exclusion                 | Removes selected tasks from monitor supervision.                                                                     | Graph labels excluded task nodes as `Task excluded`. Backend should avoid findings or steering scoped to those tasks unless another policy overrides it.                                                                                           |
| Allowed steering      | `controls.allowed_steering_actions`            | Steering allow-list            | Limits the steering actions the monitor may request.                                                                 | Backend should only request actions present in this list. The frontend currently offers human review, replan, redirect sub-agent, pause, resume, cancel, repair stale run, replace task instructions, lower max iterations, and reduce tool scope. |
| Auto-apply steering   | `controls.auto_apply_steering_actions`         | Automatic operational steering | Selects operational steering actions the backend may auto-apply without separate manual approval when policy allows. | The frontend limits this list to pause execution, resume execution, cancel execution, and repair stale run. Approval policy and backend safeguards still control whether auto-apply happens.                                                       |

## Operator Payload Fields

These top-level fields describe the backend's monitoring policy state. Some are visible in the UI;
others are backend/operator metadata.

| Field                            | Capability                   | Meaning                                                                 | Impact                                                                                                                            |
| -------------------------------- | ---------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`                        | Monitoring gate              | Canonical top-level on/off state for workflow monitoring.               | Drives the UI status badge and graph `Monitoring off` labels.                                                                     |
| `level`                          | Monitoring intensity         | Canonical top-level monitoring level.                                   | Displayed as the status label unless the workflow is exempt or off.                                                               |
| `exempted`                       | Exemption state              | Indicates the workflow is explicitly exempt from monitoring.            | UI status becomes `Exempt`; exemption reason is shown when present.                                                               |
| `reason`                         | Exemption context            | Optional explanation for disabled or exempt monitoring.                 | Saved and displayed in the monitoring panel.                                                                                      |
| `visible_to_main_agent`          | Main-agent visibility        | Indicates whether the main agent can see this monitoring policy.        | Backend can use this to hide or expose monitoring policy details to the main agent. The frontend treats it as read-only metadata. |
| `mutable_by_main_agent`          | Main-agent mutability        | Indicates whether the main agent may mutate this monitoring policy.     | Backend can use this to allow or prevent main-agent initiated policy changes. The frontend treats it as read-only metadata.       |
| `default_enabled`                | Default policy state         | Indicates whether this workflow would normally be monitored by default. | Helps distinguish default monitoring from an explicit override. Currently read-only in the frontend.                              |
| `is_main_agent_default_workflow` | Main-agent workflow identity | Indicates this workflow is the active main-agent default workflow.      | Controls whether the Self monitoring UI appears.                                                                                  |
| `status_label`                   | Backend display label        | Backend-provided status label for the policy.                           | Available for display/debugging. The current panel computes a simple status from `enabled`, `exempted`, and `level`.              |
| `controls`                       | Monitoring controls          | Nested policy controls described below.                                 | The editable monitoring panel primarily reads and writes fields in this object.                                                   |
| `exemption`                      | Backend exemption metadata   | Optional structured exemption details beyond the plain `reason`.        | Reserved for backend/operator workflows. Not currently rendered in the panel.                                                     |
| `operator_actions`               | Backend action metadata      | Optional structured actions available to operators.                     | Reserved for backend/operator workflows. Not currently rendered in the panel.                                                     |

## Controls Fields

These fields live under `monitoring.controls`.

| Field                                     | Visible | Capability                     | Meaning                                                                                | Impact                                                                                                               |
| ----------------------------------------- | ------- | ------------------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `enabled`                                 | Yes     | Monitoring gate                | Nested copy of the monitoring enabled state.                                           | Kept aligned with top-level `enabled` by the frontend optimistic patch helper.                                       |
| `level`                                   | Yes     | Monitoring intensity           | Nested copy of the monitoring level.                                                   | Kept aligned with top-level `level` by the frontend optimistic patch helper.                                         |
| `store_run_summaries`                     | No      | Summary persistence            | Allows the backend monitor to store summaries of workflow runs.                        | Can provide compact historical context for later monitoring and review. Not currently editable in the panel.         |
| `store_failure_summaries`                 | No      | Failure-summary persistence    | Allows the backend monitor to store summaries of failed runs.                          | Can support recurring-failure detection and improvement proposals. Not currently editable in the panel.              |
| `allow_improvement_proposals`             | Yes     | Improvement proposals          | Allows the monitor to propose workflow changes from run evidence.                      | When disabled, findings still appear in the workflow monitor review panel, but no improvement proposals are drafted. |
| `allow_evaluation_agent_review`           | No      | Evaluation review              | Allows an evaluation agent or evaluation process to review workflow runs or proposals. | Backend can create evaluation records under monitoring events. Not currently editable in the panel.                  |
| `allow_self_monitoring`                   | Yes     | Main-agent self-supervision    | Allows monitoring of the main agent default workflow.                                  | Visible only for the main agent default workflow.                                                                    |
| `delegate_hitl_to_main_agent`             | Yes     | HITL delegation                | Lets the main agent handle eligible human-in-the-loop checkpoints.                     | Run detail can show HITL delegation as `Main agent` when workflow metadata includes this setting.                    |
| `safe_to_summarize`                       | No      | Summarization permission       | Indicates whether run data for this workflow is safe for backend summarization.        | Backend should use it before storing or generating summaries. Not currently editable in the panel.                   |
| `route_improvement_proposals_to_approval` | Yes     | Proposal approval routing      | Routes monitor improvement proposals through approval controls.                        | Proposal approval requests appear directly in the workflow monitor review panel.                                     |
| `route_steering_requests_to_approval`     | Yes     | Steering approval routing      | Routes supervisor steering requests through approval controls.                         | Steering approval cards appear in the Monitor proposals panel.                                                       |
| `supervise_token_usage`                   | Yes     | Usage supervision              | Enables token/budget supervision.                                                      | Backend can produce findings, proposals, or steering from token usage signals.                                       |
| `supervise_context_health`                | Yes     | Context health supervision     | Enables context-window and compaction supervision.                                     | Backend can produce findings or corrective proposals from context-health signals.                                    |
| `supervise_subagents`                     | Yes     | Agent supervision              | Enables sub-agent supervision.                                                         | Graph policy labels switch between supervised, excluded, or supervision-off states.                                  |
| `supervise_tool_failures`                 | Yes     | Tool failure supervision       | Enables tool failure supervision.                                                      | Backend can produce findings or proposals from tool failure signals.                                                 |
| `excluded_subagent_ids`                   | Yes     | Agent exclusion                | List of workflow agent IDs excluded from supervision.                                  | Graph labels matching agents as excluded and labels tasks assigned to them as assigned-agent excluded.               |
| `excluded_task_ids`                       | Yes     | Task exclusion                 | List of workflow task IDs excluded from supervision.                                   | Graph labels matching tasks as excluded.                                                                             |
| `allowed_steering_actions`                | Yes     | Steering allow-list            | List of steering action IDs the monitor may request.                                   | Backend should restrict steering requests to this list. Empty or null behavior is backend policy dependent.          |
| `auto_apply_steering_actions`             | Yes     | Automatic operational steering | List of steering action IDs that may be auto-applied when backend policy allows.       | Should be limited to operational actions that have backend safeguards.                                               |
| `approval_conversation_id`                | No      | Approval routing destination   | Conversation ID used for monitor proposal or steering approvals.                       | Backend can route approval requests to this conversation. Not currently editable in the panel.                       |

## Main-Agent Monitor Workspace

The `/operations/main-agent-monitor` page is intentionally broader than a single workflow panel:

| Section                 | Source field                                 | Purpose                                                                                 |
| ----------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| Status counters         | `summary`, `settings`, `runtime`             | Shows whether the monitor is enabled, workflow coverage, pending approvals, and ticks.  |
| Notification routing    | `notification_route`                         | Edits the default approval inbox and optional linked chat delivery metadata.            |
| Human attention inbox   | `pending_approvals`                          | Lets an operator approve or reject monitor-created workflow updates and steering gates. |
| Repository write gates  | `repo_write_requests`                        | Highlights approvals that would grant read-write repo access to coding workflows.       |
| Recent monitor evidence | `findings`, `proposals`, `steering_requests` | Shows the newest monitor events across workflows.                                       |
| Monitored workflows     | `workflows`                                  | Links back to workflow-level monitoring controls.                                       |

External chat routing is configured by setting an approval conversation that represents the linked
channel, then saving `monitor_delivery.provider` and `monitor_delivery.credential_id`. Supported
providers are `telegram`, `discord`, and `whatsapp`.

The delivery target is the approval conversation's channel binding. The monitor delivery metadata
intentionally stores only the provider and credential id.

| Provider | Conversation target requirement                                                                        | Credential metadata requirement                                                              |
| -------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Telegram | `channel_thread_id` is the Telegram `chat_id`; `channel_user_id` maps the trusted operator identity.   | Production webhooks need `webhook_secret_ref` or `webhook_secret_token`.                     |
| Discord  | `channel_thread_id` is the Discord `channel_id`; `channel_user_id` maps the trusted operator identity. | Production webhooks need `webhook_public_key`.                                               |
| WhatsApp | `channel_user_id` is the recipient phone number or `wa_id`.                                            | Delivery needs `phone_number_id`; production webhooks need `app_secret_ref` or `app_secret`. |

When multiple credentials exist for the same provider, optional instance identity metadata such as
bot id, workspace/guild id, sender number, project id, repository, bucket, or folder is displayed
with the credential so operators and agents can choose the intended connector instance.

The frontend monitor routing panel can resolve these conversation targets and creates the trusted
channel identity mapping required for the conversation owner to match the selected credential owner.

The general assistant conversation page also exposes a Channel Target panel for saved delivery
bindings. It writes the same conversation fields:

- Telegram: `channel_thread_id` is the `chat_id`; `channel_user_id` is the trusted operator/user id.
- Discord: `channel_thread_id` is the `channel_id`; `channel_user_id` is the trusted Discord user id.
- WhatsApp: `channel_user_id` is the recipient phone number or `wa_id`; the sender is selected from the credential `phone_number_id`.

Backend delivery can now use that saved conversation target directly:

```http
POST /integrations/conversations/channels/{conversation_id}/deliver
```

```json
{
  "credential_id": "credential-id",
  "outbound_messages": [
    {
      "type": "text",
      "text": "Delivery text"
    }
  ]
}
```

The backend formats provider payloads from the conversation target, then sends through the selected
credential. This prevents callers from having to pass raw provider-specific `chat_id`,
`channel_id`, `to`, or `phone_number_id` values on every delivery attempt.

Workflow connector defaults are stored separately in `workflow.metadata.connector_bindings`.
Tool-level bindings in `ToolDefinition.security.connector_bindings` take precedence; workflow-level
bindings provide a default when several tools should use the same provider instance. Each binding
stores:

```json
{
  "provider": "discord-bot",
  "credential_id": "credential-discord-support",
  "purpose": "support_delivery",
  "target_scope": {
    "guild_id": "guild-id",
    "channel_id": "channel-id"
  },
  "identity_summary": "Support Discord Bot (guild_id: guild-id | channel_id: channel-id)"
}
```

Agents must resolve credentials before proposing connector-backed tools or workflows when multiple
provider instances exist. Runtime execution rejects connector-backed tools with no binding, and
rejects ambiguous multiple bindings unless the tool call narrows provider or credential id.

Backend duplicate suppression keeps one pending approval request per workflow/finding/action/failure
signature. Additional repeated evidence remains visible as monitor events, but the inbox should not
fill with identical approval requests while one is still pending.

### Command Center API Contract

`GET /api/main-agent/monitor` returns `MainAgentMonitorCommandCenterResponse`:

| Field                 | Purpose                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------- |
| `settings`            | Global monitor enablement, default policy, interval, stale threshold, and retention values. |
| `runtime`             | Loop health, counters, recent actions, and the latest `main_agent_monitor.tick`.            |
| `active_profile`      | Active main-agent profile summary, when one is configured.                                  |
| `notification_route`  | Default approval conversation and optional linked chat delivery metadata.                   |
| `summary`             | Aggregate counts for workflow coverage, pending approvals, repo-write gates, and evidence.  |
| `workflows`           | Visible workflows plus their effective monitoring policy.                                   |
| `pending_approvals`   | Pending monitor-created approval requests.                                                  |
| `repo_write_requests` | Pending approvals that contain `repo_write_permission` metadata.                            |
| `findings`            | Recent monitor findings across workflows.                                                   |
| `proposals`           | Recent workflow improvement proposals across workflows.                                     |
| `steering_requests`   | Recent supervisor steering requests across workflows.                                       |
| `operator_actions`    | Backend-provided hints for available operator actions.                                      |

`PATCH /api/main-agent/monitor` accepts:

```json
{
  "approval_conversation_id": "conversation-id",
  "monitor_delivery": {
    "provider": "telegram",
    "credential_id": "credential-id"
  }
}
```

`monitor_delivery` is optional. When set, `provider` must be `telegram`, `discord`, or `whatsapp`.
This route changes notification routing only. It does not approve pending requests or change workflow definitions.

### Approval Boundaries

The monitor workspace should make these boundaries clear to operators:

- Workflow/tool mutations are applied only through explicit approval requests.
- Repo-write requests are local privileged access gates and are never auto-approved.
- Auto-apply steering is limited to backend-allowed low-risk actions selected in workflow monitoring controls.
- High-risk actions, credential use, destructive changes, and privileged local execution must stay human-held.
- External chat delivery is notification routing, not delegated approval authority.

## Steering Actions

The frontend currently recognizes these steering action IDs:

| Action ID                   | Meaning                                      | Typical impact                                                           |
| --------------------------- | -------------------------------------------- | ------------------------------------------------------------------------ |
| `request_human_review`      | Ask a human to inspect the workflow or run.  | Creates or routes a review checkpoint.                                   |
| `request_replan`            | Ask the workflow to replan.                  | Can change the execution plan where backend/runtime supports replanning. |
| `redirect_subagent`         | Redirect work from one sub-agent to another. | Can alter responsibility for a task or follow-up action.                 |
| `pause_execution`           | Pause the active execution.                  | Stops forward progress until resumed.                                    |
| `resume_execution`          | Resume a paused execution.                   | Allows a paused run to continue.                                         |
| `cancel_execution`          | Cancel the active execution.                 | Stops the run. This is high impact and should remain policy-gated.       |
| `repair_stale_execution`    | Repair a stale or stuck run.                 | Backend may attempt recovery for stale execution state.                  |
| `replace_task_instructions` | Replace task instructions.                   | Can materially change how a task is executed.                            |
| `lower_max_iterations`      | Reduce maximum iteration count.              | Can limit runaway or overly long agent loops.                            |
| `reduce_tool_scope`         | Restrict available tools.                    | Can lower risk by narrowing tool access during execution.                |

Only `pause_execution`, `resume_execution`, `cancel_execution`, and `repair_stale_execution` are currently offered in
the Auto-apply steering UI.

## Monitoring Events And UI Effects

`GET /api/workflows/:id/monitoring/events` returns monitoring event groups:

| Event group         | Meaning                                                         | UI impact                                                                                           |
| ------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `findings`          | Monitor observations from run evidence.                         | Normalized into graph runtime overlays.                                                             |
| `proposals`         | Suggested workflow improvements.                                | Rendered in the Monitor proposals panel, including approval controls when present.                  |
| `evaluations`       | Evaluation records from monitor or evaluation-agent review.     | Normalized into graph runtime overlays.                                                             |
| `comparisons`       | Comparison records between runs, versions, or behaviors.        | Normalized into graph runtime overlays.                                                             |
| `steering_requests` | Supervisor requests to steer execution.                         | Normalized into graph runtime overlays and surfaced through approval cards when routed to approval. |
| `steering_applied`  | Supervisor steering actions that were applied.                  | Normalized into graph runtime overlays.                                                             |
| `approval_controls` | Approval requests attached to monitoring proposals or steering. | Rendered in the Monitor proposals panel for operator decisions.                                     |

The workflow graph uses monitoring policy and monitoring events in two ways:

- policy labels: agent and task nodes can show monitored, excluded, or off states
- runtime overlays: findings, proposals, evaluations, comparisons, and steering events are normalized into graph runtime events

These overlays are transient UI projections. They are not persisted as standalone editable workflow graph entities.

## Frontend Implementation References

- Types: `types/workflows.ts`
- Controls panel: `components/workflow/WorkflowMonitoringControls.tsx`
- Workflow detail integration: `components/workflow/WorkflowDetailWorkspace.tsx`
- Proposals panel: `components/workflow/WorkflowMonitoringProposals.tsx`
- Graph policy labels: `components/workflow/WorkflowGraphCanvas.tsx`
- Graph event mapping: `lib/workflows/workflowGraphAdapter.ts`
- Execution payload boundary: `lib/workflows/executionPayload.ts`
