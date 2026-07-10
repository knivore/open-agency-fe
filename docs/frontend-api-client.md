# Frontend API Client

## Purpose

The shared frontend API client lives under `lib/api` and provides a single foundation for:

- backend API requests to `agency`
- same-origin frontend `app/api/*` requests
- normalized error handling
- optional auth-token injection

## Environment Configuration

Add these variables to your local frontend environment:

```env
NEXT_PUBLIC_AGENCY_API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_AGENCY_DEV_AUTH_ENABLED=true
```

Expected local development backend URL:

- `http://127.0.0.1:8000`

Notes:

- `NEXT_PUBLIC_AGENCY_API_BASE_URL` is the base URL used by the shared backend client.
- `NEXT_PUBLIC_AGENCY_DEV_AUTH_ENABLED` is a frontend feature flag for future dev-auth behavior.
- `LOCAL_BACKEND` is still supported as a fallback for compatibility, but new code should prefer `NEXT_PUBLIC_AGENCY_API_BASE_URL`.
- `AGENCY_FE_BFF_IDENTITY_KEY` is the server-side management-console credential for explicit BFF routes. Set the same
  value in `agency` as `AGENCY_INTERNAL_API_KEY`; older frontend names remain compatibility fallbacks only.

## Client Modules

Primary files:

- `lib/api/client.ts`
- `lib/api/errors.ts`
- `lib/api/auth.ts`
- `lib/api/config.ts`
- `lib/api/index.ts`

Exports:

- `agencyApiClient`
  - configured for `NEXT_PUBLIC_AGENCY_API_BASE_URL`
- `appApiClient`
  - configured for same-origin frontend routes that remain as local BFF or compatibility routes
- `currentUserHeaders`
  - marks explicit BFF calls with `x-agency-client: agency-fe` plus the delegated frontend user identity
- `createApiClient`
  - factory for additional clients
- `ApiError`
  - normalized error type

## Boundary Rules

Use `agencyApiClient` for canonical Agency runtime reads and straightforward mutations when the configured backend origin
is already sufficient for auth and payload shape. Use `appApiClient` only for explicit frontend-owned BFF routes where
Next.js must delegate the authenticated session, aggregate multiple backend calls, or adapt payloads for UI-specific
flows.

Execution launch is the main example: the frontend can choose a route such as `/api/workflows/run/[id]` to attach the
current user and UI defaults, but the route must still hand execution creation off to `agency` instead of rebuilding
runtime policy locally. When a workflow run is advancing a durable goal, the BFF should forward `goal_id` through
execution input, trigger metadata, and the backend execution creation payload.

## Auth Token Behavior

The client can attach `Authorization: Bearer <token>` automatically when a token is available.

Current behavior:

1. If a token provider has been registered via `setApiClientTokenProvider(...)`, that token is used.
2. Otherwise, in the browser the client checks:
   - `localStorage['agency_api_token']`
   - `localStorage['agencyApiToken']`
   - `sessionStorage['agency_api_token']`
   - `sessionStorage['agencyApiToken']`
3. If no token is available, the request is sent without a bearer token.

The client also uses `credentials: 'include'` by default, so cookie/session-based flows continue to work.

## Error Handling

The client throws `ApiError` for normalized failures.

Fields:

- `status`
- `message`
- `code`
- `details`
- `raw`

Examples:

- `401` -> authentication required
- `403` -> permission denied
- `500+` -> server failure
- timeout/abort -> normalized as request/network errors

## Basic Usage

### GET example

```ts
import { agencyApiClient } from '@/lib/api/clientInstances';

const tools = await agencyApiClient.get('/tools');
```

### GET with query params

```ts
import { appApiClient } from '@/lib/api/clientInstances';

const response = await appApiClient.get('/api/workflows', {
  query: { userId: 'user-123' },
});
```

### POST example

```ts
import { agencyApiClient } from '@/lib/api/clientInstances';

const execution = await agencyApiClient.post('/executions', {
  workflowId: 'workflow-123',
  input: {},
  trigger: { type: 'manual' },
});
```

### Goal example

```ts
import { goalsApi } from '@/lib/api/backend/goals';

const goals = await goalsApi.getOperatorView({ active_only: true });
const created = await goalsApi.createGoal({
  objective: 'Monitor weekly pricing changes',
  status: 'active',
  constraints: { autonomy: 'guarded' },
});
```

### Handling errors

```ts
import { agencyApiClient } from '@/lib/api/clientInstances';
import { isApiError } from '@/lib/api/errors';

try {
  await agencyApiClient.get('/executions');
} catch (error) {
  if (isApiError(error)) {
    console.error(error.status, error.message, error.details);
  } else {
    console.error(error);
  }
}
```

## Request Features

Supported by the client:

- configurable base URL
- typed request helper
- JSON request/response handling
- query params
- `GET`, `POST`, `PUT`, `PATCH`, `DELETE`
- normalized errors
- optional auth-token injection
- timeout via `AbortController`

## Current Adoption

The client is now used by the active backend-facing frontend layers:

- `lib/api/backend/*`
- explicit BFF routes under `app/api/backend-*` and `app/api/workflows/*`
- `app/(protected)/profile/page.tsx`

New backend-facing UI code should use the typed service modules under `lib/api/backend` rather than hardcoding route
strings in components.

## Persona Workflow Versioning

Persona Factory frontend maintenance guidance lives in `docs/persona-factory.md`. Keep this section limited to shared
API-client behavior and workflow Persona versioning.

Persona-backed workflow updates use the backend client plus a small same-origin BFF layer:

- `lib/api/backend/personas.ts`
  - `listPersonas()`
  - `listWorkflowUsages(personaId)`
- `lib/api/backend/workflows.ts`
  - `listWorkflowPersonaVersionNotices(workflowId)`
  - `useLatestPersonaAgent(workflowId, agentId)`
  - `keepCurrentPersonaAgent(workflowId, agentId)`
- `app/api/workflows/[id]/persona-version-notices/route.ts`
- `app/api/workflows/[id]/persona-agents/[agentId]/use-latest/route.ts`
- `app/api/workflows/[id]/persona-agents/[agentId]/keep-current/route.ts`

Use direct backend calls for ordinary browser-side reads when the configured backend URL is reachable. Use the BFF routes
for workflow persona actions from protected pages so the frontend session can be delegated consistently through
`currentUserHeaders`.

Frontend code should normalize backend persona notices through `lib/workflows/personaVersioning.ts`. The normalized
status values are:

- `current`: the workflow snapshot matches the persona's current version.
- `outdated`: the workflow snapshot uses an older published persona version and should show `Use latest persona` plus
  `Keep current`.
- `pinned`: the operator has accepted the current older workflow snapshot until another persona version is published.
