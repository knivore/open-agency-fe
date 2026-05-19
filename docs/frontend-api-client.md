# Frontend API Client

## Purpose

The shared frontend API client lives under `lib/api` and provides a single foundation for:

- backend API requests to `agency`
- same-origin frontend `app/api/*` requests
- normalized error handling

## Environment Configuration

Add these variables to your local frontend environment:

```env
NEXT_PUBLIC_AGENCY_API_BASE_URL=http://127.0.0.1:8000
```

Expected local development backend URL:

- `http://127.0.0.1:8000`

Notes:

- `NEXT_PUBLIC_AGENCY_API_BASE_URL` is the base URL used by the shared backend client.
- `LOCAL_BACKEND` is still supported as a fallback for compatibility, but new code should prefer `NEXT_PUBLIC_AGENCY_API_BASE_URL`.

## Client Modules

Primary files:

- `lib/api/client.ts`
- `lib/api/errors.ts`
- `lib/api/config.ts`
- `lib/api/index.ts`

Exports:

- `agencyApiClient`
  - configured for `NEXT_PUBLIC_AGENCY_API_BASE_URL`
- `appApiClient`
  - configured for same-origin frontend routes that remain as local BFF or compatibility routes
- `createApiClient`
  - factory for additional clients
- `ApiError`
  - normalized error type

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
import { agencyApiClient } from '@/lib/api';

const tools = await agencyApiClient.get('/tools');
```

### GET with query params

```ts
import { appApiClient } from '@/lib/api';

const response = await appApiClient.get('/api/workflows', {
  query: { userId: 'user-123' },
});
```

### POST example

```ts
import { agencyApiClient } from '@/lib/api';

const execution = await agencyApiClient.post('/executions', {
  workflowId: 'workflow-123',
  input: {},
  trigger: { type: 'manual' },
});
```

### Handling errors

```ts
import { agencyApiClient, isApiError } from '@/lib/api';

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

The client has been introduced first in low-risk places:

- `app/api/backend_endpoints.ts`
- `app/api/utils/crew.ts`
- `app/(protected)/profile/page.tsx`

This is only the foundation phase. Existing pages and route structures remain in place.
