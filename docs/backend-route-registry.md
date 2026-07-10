# Backend Route Registry

## Purpose

The frontend now has a centralized backend route registry and service layer under `lib/api/backend` so backend endpoint strings are not scattered across UI code.

## Detected Backend Route Groups

Based on `agency/app/api/routes/*`, the backend currently exposes these route groups:

- health
- agents
- tools
- model providers
- model profiles
- MCP servers
- runtime adapters
- workflows
- executions
- goals
- schedules
- observability
- integrations registry
- conversation adapter webhooks
- A2A protocol
- workflow-scoped execution runtime routes
- canonical execution artifact/HITL/storage routes

No app-centric auth route group was detected during inspection.

## Frontend Service Modules

Created modules:

- `lib/api/backend/routes.ts`
- `lib/api/backend/health.ts`
- `lib/api/backend/agents.ts`
- `lib/api/backend/tools.ts`
- `lib/api/backend/models.ts`
- `lib/api/backend/mcpServers.ts`
- `lib/api/backend/runtimeAdapters.ts`
- `lib/api/backend/workflows.ts`
- `lib/api/backend/executions.ts`
- `lib/api/backend/goals.ts`
- `lib/api/backend/users.ts`
- `lib/api/backend/profile.ts`
- `lib/api/backend/apiTokens.ts`
- `lib/api/backend/credentials.ts`
- `lib/api/backend/schedules.ts`
- `lib/api/backend/observability.ts`
- `lib/api/backend/connectorRegistry.ts`
- `lib/api/backend/a2a.ts`
- `lib/api/backend/storage.ts`
- `lib/api/backend/index.ts`

## Route Mapping Table

| Backend route group                                               | Frontend service module                   | Example functions                                                                                                                                         |
|-------------------------------------------------------------------|-------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|
| `/`, `/health`, `/health/db`                                      | `healthApi`                               | `getRootInfo()`, `getHealth()`, `getDatabaseHealth()`                                                                                                     |
| `/agents/*`                                                       | `agentsApi`                               | `listAgents()`, `getAgent()`, `listAgentExecutions()`                                                                                                     |
| `/tools/*`                                                        | `toolsApi`                                | `listTools()`, `getTool()`, `validateTool()`, `testTool()`                                                                                                |
| `/tools/contracts/*`                                              | `toolsApi`                                | `listToolContracts()`, `getToolContract()`                                                                                                                |
| `/tools/{tool_name}/run`                                          | `toolsApi`                                | `runTool()`                                                                                                                                               |
| `/model-providers/*`                                              | `modelProvidersApi`                       | `listProviders()`, `getProvider()`                                                                                                                        |
| `/model-profiles/*`                                               | `modelProfilesApi`                        | `listProfiles()`, `getProfile()`                                                                                                                          |
| `/mcp-servers/*`                                                  | `mcpServersApi`                           | `listMcpServers()`, `discover()`                                                                                                                          |
| `/runtime-adapters/*`                                             | `runtimeAdaptersApi`                      | `listRuntimeAdapters()`, `getRuntimeAdapter()`                                                                                                            |
| `/workflows/*`                                                    | `workflowsApi`, `executionsApi`           | `listWorkflows()`, `getWorkflow()`, `startWorkflowExecution()`                                                                                            |
| `/executions/*`                                                   | `executionsApi`                           | `listExecutions()`, `createExecution()`, `getExecution()`, `streamExecutionEvents()`, `streamArtifactImages()`, `streamHumanLoop()`, `replyToHumanLoop()` |
| `/goals/*`                                                        | `goalsApi`                                | `listGoals()`, `getOperatorView()`, `getOperatorDetail()`, `createGoal()`, `applyOperatorAction()`                                                       |
| `/schedules/*`                                                    | `schedulesApi`                            | `listSchedules()`, `getSchedule()`, `triggerNow()`                                                                                                        |
| `/observability/*`                                                | `observabilityApi`                        | `getExecutionTimeline()`, `getAgentMetrics()`, `getWorkflowMetrics()`                                                                                     |
| `/integrations/categories`                                        | `connectorRegistryApi`                    | `listCategories()`                                                                                                                                        |
| `/integrations/conversations/adapters/{provider}/webhook`         | Setup guide only                          | Provider-side conversation adapter webhook URL guidance                                                                                                   |
| `/.well-known/agent-card.json`, `/a2a/*`                          | `a2aApi`                                  | `getAgentCard()`, `createTask()`, `getTask()`                                                                                                             |
| `/workflows/{workflow_id}/executions/*`                           | `executionsApi`                           | `createWorkflowExecution()`, `startWorkflowExecution()`                                                                                                   |
| `/executions/{execution_id}/artifacts/images/stream`              | `executionsApi`                           | `streamArtifactImages()`                                                                                                                                  |
| `/executions/{execution_id}/hitl/*`                               | `executionsApi`                           | `streamHumanLoop()`, `replyToHumanLoop()`                                                                                                                 |
| `/storage/presigned`, `/api/local-storage/*`                      | `storageApi`                              | `getPresignedUrl()`                                                                                                                                       |

## Current Adoption

Existing backend-facing helper code has been updated to use the centralized registry:

- `lib/api/backend/routes.ts`
- service modules under `lib/api/backend/*`

This keeps backend route strings centralized while moving frontend route ownership into `lib/api/backend` and local CRUD orchestration into `/api/workflows/*`.

## Known Gaps And Unknown Schemas

- No backend auth routes were found, so no `authApi` module was added.
- Some canonical response shapes are inferred from backend code and local frontend types rather than generated OpenAPI types.
- `/integrations/categories` now has a frontend contract target, but the backend may still be serving no route or a temporary array-only response during rollout.
- `/executions/{id}/events` and some observability payloads remain loosely typed because the event schema was not fully standardized in the frontend yet.
- Goal plans, evidence, evaluation, and supervisor-decision payloads intentionally use flexible `JsonObject` shapes
  until those backend schemas settle.
- Runtime outbound webhooks and internal sub-agent callbacks are backend service/runtime features, not frontend route groups. See `../open-agency/docs/runtime/outbound-webhooks.md` and `../open-agency/docs/runtime/subagent-callbacks.md`.
- Frontend runtime calls now use canonical workflow/execution routes. Do not add new frontend wires to backend `/api/crew/*`, `/api/history/*`, `/api/artifacts/*`, or `/api/hitl/*` compatibility namespaces.

## OpenAPI Note

The backend root route advertises:

- `/docs`
- `/openapi.json`
- `/redoc`

This suggests OpenAPI is available and could support generated frontend types later.

Recommendation:

- keep local handwritten service modules and types for now
- consider introducing generated types later if the canonical app-centric routes stabilize and become broader frontend dependencies
- avoid adding a heavy generator yet because the current frontend still has a few loose canonical contracts around execution events, observability, and integration payloads

Integration route usage is covered here and in the backend API wrappers under `lib/api/backend`.
