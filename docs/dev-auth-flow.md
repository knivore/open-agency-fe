# Dev Auth Flow

## Purpose

This project supports a development email/password login flow so local frontend work can begin without Azure AD while
also using backend auth endpoints when they are available.

## Current Assumptions

- The frontend first tries backend auth routes from the configured Agency API base URL.
- If those routes are absent, local development falls back to env-configured credentials.
- The env fallback is explicitly dev-only and should not be treated as production security.

## Backend Endpoints Used

Preferred backend routes:

- `POST /auth/login`, falling back to `POST /api/auth/login`
- `GET /auth/me`, falling back to `GET /api/auth/me` and `GET /me`

Current route/session backbone:

- `next-auth` session endpoints under `/api/auth/*`
- app route guard via `proxy.ts`

## Dev Login Behavior

1. User opens `/login`
2. User enters email and password
3. Frontend calls `signIn('credentials')`
4. `lib/auth/devAuthAdapter.ts` posts credentials to the backend auth endpoint when available.
5. If the backend auth route is missing or unreachable, credentials are validated against local dev env values.
6. Successful backend auth stores the backend access token in the `next-auth` JWT session.
7. Successful env fallback creates a local `dev-*` session marker.
8. The session is exposed to the app through `SessionProvider`.
9. The shared API client forwards backend-issued tokens and suppresses local `dev-*` markers.

## Token Storage Approach

- The access token or local `dev-*` marker is stored in the `next-auth` JWT session payload
- The token is synchronized into the frontend API client through `app/providers.tsx`
- Backend-issued tokens are attached as bearer tokens when available; local `dev-*` markers are not sent to Agency

This keeps persistence simple while avoiding a custom standalone auth store.

## Environment Variables

Required for dev auth:

```env
NEXTAUTH_SECRET=replace-me-in-local-dev
AUTH_TRUST_HOST=true
NEXT_PUBLIC_AGENCY_DEV_AUTH_ENABLED=true
DEV_AUTH_EMAIL=dev@example.com
DEV_AUTH_PASSWORD=change-me
DEV_AUTH_NAME=Dev User
DEV_AUTH_USER_ID=dev-user
```

Optional backend auth overrides:

```env
# Set to false to force the legacy env-backed local credential check.
AGENCY_DEV_AUTH_BACKEND_ENABLED=true

# Comma-separated path lists are supported for local backend experiments.
AGENCY_AUTH_LOGIN_PATH=/auth/login,/api/auth/login
AGENCY_AUTH_ME_PATH=/auth/me,/api/auth/me,/me
```

For local LAN or Tailscale access, leave `NEXTAUTH_URL` and `AUTH_URL` unset so Auth.js uses the incoming request host.
That keeps auth working when the laptop, Wi-Fi network, or Tailscale address changes. Set a fixed auth URL only when
every auth callback should resolve to one canonical address, such as a deployed domain, an OAuth callback test URL, or a
public tunnel.

## Files Involved

- `auth.ts`
- `lib/auth/devAuthAdapter.ts`
- `app/(auth)/login/page.tsx`
- `app/providers.tsx`
- `components/navbar/UserAvatar.tsx`
- `types/next-auth.d.ts`

## How To Disable Env Fallback Later

After backend auth is mandatory:

1. Remove the local fallback branch from `lib/auth/devAuthAdapter.ts`.
2. Remove the `DEV_AUTH_*` variables from local env.
3. Keep `NEXT_PUBLIC_AGENCY_DEV_AUTH_ENABLED=true` only where credentials mode should remain available.

## Backend Contract

- `POST /auth/login` or `POST /api/auth/login`
  - request:
    - `{ email: string, password: string }`
  - response:
    - `{ access_token: string, token_type?: "Bearer", user: { id, email, name, image? } }`

- `GET /auth/me` or `GET /api/auth/me`
  - response:
    - `{ id, email, name, image? }`

- `POST /auth/logout` or `POST /api/auth/logout`
  - response:
    - implementation-defined; frontend only needs success/failure

## Azure AD Later

Azure AD-related files were intentionally left in place:

- `lib/auth/customprovider.ts`
- Azure-related env vars in `.env.example`

They should be treated as future production auth paths. The current dev flow is only a local development bridge, not a replacement for production SSO.
