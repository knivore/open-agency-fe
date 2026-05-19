# Frontend Domain Types

## Type Organization

The frontend now has a centralized domain type layer under `/Users/kehchinleong/Documents/Personal/Agency/agency-fe/types`.

- [types/api.ts](/Users/kehchinleong/Documents/Personal/Agency/agency-fe/types/api.ts)
  Shared API primitives such as `JsonObject`, list/delete envelopes, health responses, backend validation errors, and `ApiError`.
- [types/auth.ts](/Users/kehchinleong/Documents/Personal/Agency/agency-fe/types/auth.ts)
  Auth-facing types for `User`, `AuthUser`, `AuthSession`, `LoginRequest`, and `LoginResponse`.
- [types/agents.ts](/Users/kehchinleong/Documents/Personal/Agency/agency-fe/types/agents.ts)
  Canonical agent and behavior profile models used by agent and profile screens.
- [types/workflows.ts](/Users/kehchinleong/Documents/Personal/Agency/agency-fe/types/workflows.ts)
  Workflow, node, edge, task, and versioning models aligned to the transformed backend workflow definitions.
- [types/runtime.ts](/Users/kehchinleong/Documents/Personal/Agency/agency-fe/types/runtime.ts)
  Execution, run, status, schedule, artifact, event, and A2A task types.
- [types/integrations.ts](/Users/kehchinleong/Documents/Personal/Agency/agency-fe/types/integrations.ts)
  Model provider, model profile, MCP server, integration category, provider status, and credential-reference models.
- [types/tools.ts](/Users/kehchinleong/Documents/Personal/Agency/agency-fe/types/tools.ts)
  Tool definitions, tool bindings, validation payloads, and provider config field metadata.
- [types/workflowBuilderDrafts.ts](/Users/kehchinleong/Documents/Personal/Agency/agency-fe/types/workflowBuilderDrafts.ts)
  Assistant/builder draft payloads used for workflow proposal generation and persistence.
- [types/index.ts](/Users/kehchinleong/Documents/Personal/Agency/agency-fe/types/index.ts)
  Barrel export for shared import ergonomics.

`/Users/kehchinleong/Documents/Personal/Agency/agency-fe/lib/api/backend/types.ts` now acts as a compatibility re-export only. New code should prefer importing from `@/types/*` directly.

## Backend Sources Used

The type layer was aligned from the transformed backend codebase at `/Users/kehchinleong/Documents/Personal/Agency/agency`, primarily:

- `app/domain/agents.py`
- `app/domain/workflows.py`
- `app/domain/executions.py`
- `app/domain/models.py`
- `app/domain/tools.py`
- `app/domain/credentials.py`
- `app/domain/protocols.py`
- `app/api/routes/executions.py`
- `app/api/routes/health.py`
- `app/protocols/a2a/tasks.py`
- `app/protocols/a2a/messages.py`
- `app/protocols/a2a/artifacts.py`

Existing frontend usage was also used as a constraint, especially in:

- [lib/api/backend](/Users/kehchinleong/Documents/Personal/Agency/agency-fe/lib/api/backend)
- [components/agent-app](/Users/kehchinleong/Documents/Personal/Agency/agency-fe/components/agent-app)
- [components/workflow-app](/Users/kehchinleong/Documents/Personal/Agency/agency-fe/components/workflow-app)
- [components/integrations-app](/Users/kehchinleong/Documents/Personal/Agency/agency-fe/components/integrations-app)
- [app/(protected)/profile/page.tsx](/Users/kehchinleong/Documents/Personal/Agency/agency-fe/app/(protected)/profile/page.tsx)

## Important Schema Assumptions

- `LoginResponse` is still based on the dev-auth adapter contract because the transformed backend does not yet expose canonical login endpoints.
- `User` is intentionally minimal: `id`, `name`, `email`, and `image`. Extra identity claims were not added because the current backend/frontend contract does not require them.
- `Agent`, `Workflow`, `ExecutionRecord`, `WorkflowRun`, and `IntegrationProvider` only include fields confirmed by backend models or existing UI usage.
- `A2ATaskResponse` is based on the observed dict returned by `execution_to_a2a_task()` rather than a formal OpenAPI-generated schema.
- Runtime bridge compatibility types have been removed. Frontend execution, HITL, artifact, and storage flows should use canonical workflow/execution/storage types.
- Some backend models still permit flexible metadata/config payloads. Those remain typed as `JsonObject` instead of deeply nested frontend-only interfaces.

## Refactoring Applied

The new type layer is already in active use in representative frontend modules:

- [lib/api/errors.ts](/Users/kehchinleong/Documents/Personal/Agency/agency-fe/lib/api/errors.ts)
- [lib/workflows/graphMapping.ts](/Users/kehchinleong/Documents/Personal/Agency/agency-fe/lib/workflows/graphMapping.ts)
- [lib/workflows/runFormatting.ts](/Users/kehchinleong/Documents/Personal/Agency/agency-fe/lib/workflows/runFormatting.ts)
- [lib/integrations/catalog.ts](/Users/kehchinleong/Documents/Personal/Agency/agency-fe/lib/integrations/catalog.ts)
- [lib/api/backend/a2a.ts](/Users/kehchinleong/Documents/Personal/Agency/agency-fe/lib/api/backend/a2a.ts)

## Recommendation On Generated Types

OpenAPI-driven generation is reasonable later, but not yet the right default for this codebase.

- The backend does expose an OpenAPI surface through `/openapi.json`.
- The frontend still consumes both canonical app-centric routes and legacy compatibility routes.
- Several current responses are intentionally loose or dict-based, especially around A2A and compatibility flows.

Recommended next step:

1. Stabilize canonical backend request/response schemas for auth, runtime actions, and provider configuration.
2. Keep adapter-specific runtime fields behind canonical workflow/execution request shapes.
3. Introduce a lightweight generated type workflow only for canonical backend routes once the schemas are stable enough to justify generation.
