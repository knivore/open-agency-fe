# Workflow Runtime Governance

Workflow runtime governance is the workflow-level UI surface for token budget policy and native
runtime context compaction policy. The backend owns enforcement, execution events, persisted
metadata, and compaction records; the frontend displays and updates the operator controls.

## Runtime Boundary

Runtime governance policy is fetched and updated through:

- `GET /api/workflows/:id/runtime-governance`
- `PATCH /api/workflows/:id/runtime-governance`

Run-level governance timelines use filtered execution events from the backend:

- `GET /executions/:id/events?event_type=token.budget.warning&event_type=context.compaction.completed`

Cross-run observability dashboards can use filtered model usage and scoped governance summaries:

- `GET /observability/models/usage?workflow_id=:workflowId&agent_id=:agentId&execution_id=:runId`
- `GET /observability/agents/:agentId/metrics`
- `GET /observability/workflows/:workflowId/metrics`

Model fallback signals are part of the same observability path. Run Detail reads `model.fallback.used` and
`model.fallback.failed` events in the Runtime Governance timeline, while Workflow Detail reads
`observabilityApi.getModelUsage({ workflowId })` and renders fallback count, failure count, fallback rate, primary models
that fell back, and recent fallback failures in the Governance observability section.

The Next.js API route proxies these requests to the Open Agency backend with the authenticated frontend
user. `GET /api/workflows/:id` may also include the same operator payload as `runtime_governance`,
but the detail page still fetches the dedicated endpoint so the panel has a stable query key and can
be invalidated independently.

Runtime governance data is not embedded in the workflow execution definition sent by the frontend.
Before and during execution, the backend reads workflow metadata, applies global defaults, emits
runtime governance events, and exposes execution snapshots through the execution usage/context APIs.
Run detail renders a filtered Runtime Governance event timeline for token, context, compaction, and
supervisor steering events so the UI does not need to download unrelated execution events for that
panel.

The frontend backend client exposes `observabilityApi.getModelUsage(filters)` with camelCase filter
fields (`workflowId`, `agentId`, `executionId`, `provider`, and `model`) and maps them to the
backend query contract.

Workflow detail renders a read-only Governance observability section beside the runtime governance
workflow controls. It reads:

- `observabilityApi.getWorkflowMetrics(workflowId)` for workflow token, context, budget, and
  compaction totals.
- `observabilityApi.getModelUsage({ workflowId })` for workflow-scoped model usage buckets and fallback summary.
- `observabilityApi.getAgentMetrics(agentId)` for up to the visible workflow agents shown in the
  workflow definition.

`ObservabilityModelUsageResponse.fallback_summary` may include:

- `fallback_count`
- `fallback_failure_count`
- `fallback_rate`
- `fallback_primary_models`
- `recent_failures`

Per-model usage rows may include `fallback_count`, `fallback_rate`, and `fallback_primary_models`.

Workflow graph nodes also show compact observability badges when data is available:

- Agent nodes show scoped agent token totals and latest context status from agent observability
  metrics.
- Task nodes show recent token usage and context status from workflow execution events already used
  by the graph runtime timeline.
- Badges are intentionally compact (`1.8K tok`, `ctx warning`) so the graph remains readable.

First-release scope keeps governance visibility on filtered execution events, execution snapshots,
and existing runtime stream log/progress entries. Do not add specialized token/context/supervisor
runtime stream event handling unless a specific live UI requires lower latency than filtered event
replay.

Frontend code should not assume dedicated backend aggregate tables for token or context data. The
first-release backend contract is JSON/event based: execution snapshots expose current state, filtered
execution events expose evidence, and observability endpoints aggregate from those records.

## Visible Controls

These fields are visible in the Runtime governance panel.

| UI label             | PATCH field                                 | Capability                  | Meaning                                                                             |
| -------------------- | ------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------- |
| Run token limit      | `tokenBudget.runTotalTokens`                | Per-run budget              | Maximum total tokens allowed for one workflow run.                                  |
| Workflow token limit | `tokenBudget.workflowTotalTokens`           | Workflow budget             | Maximum cumulative workflow tokens where backend aggregation is available.          |
| Agent token limit    | `tokenBudget.agentTotalTokens`              | Agent budget                | Maximum cumulative tokens allowed for one agent or sub-agent.                       |
| Budget action        | `tokenBudget.action`                        | Budget enforcement          | One of `warn_only`, `compact_context`, `pause_execution`, or `fail_execution`.      |
| Warn ratio           | `tokenBudget.warnRatio`                     | Budget warning threshold    | Ratio that emits budget warning events before the hard threshold.                   |
| Hard ratio           | `tokenBudget.hardRatio`                     | Budget exceeded threshold   | Ratio that emits exceeded events and applies the selected action.                   |
| Context compaction   | `contextCompaction.enabled`                 | Compaction gate             | Allows native runtime compaction when context health or budget policy requires it.  |
| Persist context pack | `contextCompaction.persistContextPack`      | Compaction persistence      | Persists compacted runtime summaries as workflow-scoped context packs when enabled. |
| Preserve recent      | `contextCompaction.preserveRecentMessages`  | Working-context retention   | Number of recent assistant/tool messages kept raw after compaction.                 |
| Oversized message    | `contextCompaction.oversizedMessageTokens`  | Compaction safeguard        | Message size threshold used by deterministic compaction safeguards.                 |
| Minimum savings      | `contextCompaction.minEstimatedTokensSaved` | Compaction usefulness check | Minimum estimated token savings required before compaction is considered useful.    |
| Summary length       | `contextCompaction.maxSummaryChars`         | Summary size limit          | Maximum character length for deterministic compacted summaries.                     |

## Operator Payload

`GET /api/workflows/:id/runtime-governance` returns:

```json
{
  "workflow_id": "workflow-1",
  "token_budget": {
    "configured": true,
    "run_total_tokens": 100000,
    "workflow_total_tokens": null,
    "agent_total_tokens": null,
    "warn_ratio": 0.8,
    "hard_ratio": 1,
    "action": "compact_context"
  },
  "context_compaction": {
    "enabled": true,
    "persist_context_pack": false,
    "persist_context_pack_source": "workflow",
    "preserve_recent_messages": 3,
    "oversized_message_tokens": 600,
    "min_estimated_tokens_saved": 50,
    "max_summary_chars": 5000
  },
  "operator_actions": {
    "update_controls": "/workflows/workflow-1/runtime-governance"
  }
}
```

The frontend sends only documented fields. Backend validation rejects unknown PATCH fields, so new
UI controls should be added to this document and `types/workflows.ts` before being wired into the
panel.

## Frontend Implementation References

- Types: `types/workflows.ts`
- Controls panel: `components/workflow/WorkflowRuntimeGovernanceControls.tsx`
- Workflow detail integration: `components/workflow/WorkflowDetailWorkspace.tsx`
- Workflow observability summary: `components/workflow/WorkflowObservabilitySummary.tsx`
- API wrapper: `lib/api/backend/workflows.ts`
- Observability API wrapper: `lib/api/backend/observability.ts`
- Next.js proxy route: `app/api/workflows/[id]/runtime-governance/route.ts`
