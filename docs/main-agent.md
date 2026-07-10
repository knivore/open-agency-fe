# Main Agent

This document covers the frontend side of the Agency main agent. The backend-native behavior is documented in
`../open-agency/docs/main-agent.md`; this file focuses on the `open-agency-fe` setup: UI surfaces, component wiring, page-context
metadata, stream handling, and how proposals/approvals are rendered.

This doc should not define backend runtime behavior, model setup, tool policy, prompt rules, or approval enforcement.
Those belong in the backend `agency` repo. The frontend only supplies context and renders backend state; it does not own
the main-agent decision loop.

For frontend code changes made by Codex or coding agents, follow the repository `AGENTS.md`: add concise inline
comments, docstrings, or function-level notes where implementation reasoning is not obvious, especially around adapter
boundaries, guardrails, async flows, caching, retries, and workarounds.

## Surfaces

The frontend exposes the main agent in two ways:

- `/assistant`: the full conversation workspace with history, files, compact packs, activity, proposals, and approvals.
- floating popup assistant: the same `ConversationWorkspace` in popup mode, opened from protected app pages such as
  workflows, agents, tools, runs, and integrations.

Both surfaces use the canonical backend conversation APIs:

- `POST /conversations`
- `GET /conversations`
- `GET /conversations/main-agent-profile`
- `GET /conversations/{conversation_id}/messages`
- `POST /conversations/{conversation_id}/messages`
- `GET /conversations/{conversation_id}/stream`
- `GET /conversations/{conversation_id}/approval-requests`
- approval approve/reject routes under `/conversations/approval-requests/*`

Browser chat should use `response_mode: "async"` so long LLM planning and tool calls continue through the conversation
stream instead of blocking the UI.

Frontend ownership:

- render the full assistant and popup assistant experiences
- collect compact page context from app workspaces
- submit user messages and metadata to backend conversation APIs
- subscribe to conversation SSE streams and backfill missed messages
- render assistant activity, proposal cards, approval cards, model-auth recovery actions, and generated files

Backend ownership:

- resolve the active `MainAgentProfile`, model profile, and tool set
- run the main-agent LLM and system prompt
- validate tool calls against policy
- create, persist, approve/reject, and apply approval-gated mutations
- enforce workflow/tool visibility, trust, and side-effect policy

## LLM-First Behavior

Plain user text is sent to the backend main-agent LLM. The frontend should not parse natural language into deterministic
workflow, agent, tool, or run mutations. The backend model chooses a tool from the policy-visible tool set, then backend
policy validates the call and creates approval requests where required.

Structured app payloads may still be sent when the UI is already performing an explicit app command, such as an existing
workflow proposal or execution request. Natural-language assistant messages should stay LLM-first.

## Goal Mentions

Goals are durable objectives, not personas. `@persona` changes the assistant persona or behavioral lens; `@goal`
selects, creates, inspects, or steers a long-running objective that can outlive the current conversation and individual
workflow runs.

Expected chat patterns:

```text
@goal Create a long-running goal to monitor competitor pricing weekly.
@goal:pricing-monitor What is the current status?
@goal:pricing-monitor Add a success criterion requiring evidence links.
@goal:pricing-monitor pause
```

Current frontend support:

- the assistant composer has a compact `@` context menu for goal and persona actions
- the goal tab is backed by `goalsApi.getOperatorView()`
- the goal tab requests only active goals; completed, failed, cancelled, and abandoned goals are omitted after refresh
- the composer picker shows at most 20 matching active goals and exposes filtering when the active list is larger
- the goal tab manages existing goals with edit, pause, resume, and stop controls
- new goals are initiated from typed `@goal ...` chat intent rather than from the picker
- selecting a goal inserts `@goal:<goal-id>` into the composer
- typed `@goal` and `@persona` tokens are highlighted in the composer to show that special mention routing is active
- selected goal context is shown as a compact composer chip until cleared
- selecting a persona inserts an inline `@persona` mention without creating durable goal context
- messages sent with a selected goal include `goal_id`, `goal_mentions`, and `goal_intent` metadata
- goal completion, evidence review, and high-risk completion approval belong in goal detail or operator surfaces, not the
  quick composer picker
- high-risk goal actions still rely on backend approval flows

The assistant context menu and typed goal client live in `components/conversations/AssistantContextMenu.tsx`,
`types/goals.ts`, and `lib/api/backend/goals.ts`. Workflow execution forms still use
`components/goals/GoalSelector.tsx` when a goal needs to be attached to a workflow run.

## Popup Page Context

Protected pages can make the floating assistant page-aware by passing a `contextMetadata` callback into
`ConversationWorkspace`. The callback should return:

- `page_context`: current surface, route, title, selected IDs, visible entities, summaries, and allowed actions.
- `assistant_providers`: page-scoped provider capabilities that the backend LLM may choose from.

Use `assistantProviderMetadata(pageContext)` from `lib/assistant/providerManifest.ts` and merge it with the page context
snapshot before sending messages.

Keep context compact and stable:

- use selected ID keys such as `workflowId`, `agentId`, `toolId`, and `runId`
- include small `entities` entries with `type`, `id`, and a human label or name
- include the current `surface`, `route`, and user-facing `title`
- expose only providers that are relevant to the current surface

The backend prompt treats page `selection` and `entities` as the target for words like "this", "current", and
"selected". Provider metadata is only a hint for the model; it is not a deterministic router.

Frontend pages should treat `assistant_providers` as a capability advertisement. They should not choose the backend tool
for the LLM or mark a mutation as already approved.

## User Experience

Popup mode shows the active page target in the header, for example `Context: Agent: Research Agent`, plus provider chips
when the page supplied provider metadata.

Approval cards show a source chip when the approval originated from popup context. Backend approval metadata can include
`source_page_context`, `source_surface`, `source_route`, and `source_provider_ids`, allowing the frontend to show which
page/provider produced the proposal.

Live activity items translate common provider tool calls into readable labels such as:

- `Preparing workflow proposal`
- `Preparing agent proposal`
- `Preparing tool proposal`
- `Reading run state`
- `Controlling run`
- `Reading connector credentials`

## Mutation And Approval Boundaries

Workflow, agent, and tool changes should remain proposal/approval based. The assistant may prepare a proposal, but the
backend should persist the change only after the user approves the request.

Direct execution control is appropriate only when the user explicitly asks for a control action such as pausing,
resuming, or cancelling the selected run. Protected workflow launches and approval-gated tools still use backend
approval policy.

## Related Backend Doc

See `../open-agency/docs/main-agent.md` for the backend model profile, system prompt, tool planning, policy gates, approval
metadata, and model-auth behavior.
