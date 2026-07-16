# Local Development

## Scope

This guide is for running the frontend in `..` against the backend in `/Users/kehchinleong/Documents/Personal/Agency/agency`.

Local development assumptions:

- frontend runs on `http://localhost:3000`
- backend runs on `http://127.0.0.1:8000`
- dev auth uses email/password
- Azure AD is not required in dev mode

## Frontend Setup

This repo uses `npm` and `package-lock.json`.

Install dependencies:

```bash
cd ..
npm install
```

Create local env:

```bash
cp .env.example .env.local
```

Recommended minimum `.env.local` values:

```env
NEXTAUTH_SECRET=replace-me-in-local-dev
AUTH_TRUST_HOST=true

# Leave these unset for local LAN/Tailscale access. This lets Auth.js use the
# incoming Host header, so localhost, LAN IP, and Tailscale IP all work without
# editing this file when the laptop/network changes.
#
# Set these only when you need one fixed canonical auth origin, such as
# production-like OAuth callback testing or a public tunnel URL.
# NEXTAUTH_URL=http://localhost:3000
# AUTH_URL=http://localhost:3000

NEXT_PUBLIC_APP_ENV=local
NEXT_PUBLIC_AGENCY_API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_AGENCY_DEV_AUTH_ENABLED=true
NEXT_PUBLIC_ENABLE_MOCK_FALLBACKS=false

DEV_AUTH_EMAIL=dev@example.com
DEV_AUTH_PASSWORD=change-me
DEV_AUTH_NAME=Dev User
DEV_AUTH_USER_ID=dev-user
```

Start the frontend:

```bash
npm run dev
```

Or start the local Agency stack from the backend repo:

```bash
cd /Users/kehchinleong/Documents/Personal/Agency/agency
./run.sh start
```

This starts Postgres, Redis, OneCLI, and Langfuse from the backend Compose file,
runs migrations, runs agent setup, starts the backend when it is not already healthy, and then starts the
frontend on `0.0.0.0` for LAN testing.

Useful frontend commands:

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
npm run test:e2e
```

Protected execution browser smoke:

```bash
E2E_FRONTEND_URL=http://localhost:3000 \
E2E_BACKEND_URL=http://127.0.0.1:8000 \
E2E_DEV_AUTH_EMAIL="$DEV_AUTH_EMAIL" \
E2E_DEV_AUTH_PASSWORD="$DEV_AUTH_PASSWORD" \
npm run test:e2e -- e2e/protected-execution.spec.ts
```

## Backend Setup

Backend repo:

```bash
cd /Users/kehchinleong/Documents/Personal/Agency/agency
```

Create the Python environment and install dependencies:

```bash
pyenv install 3.12.13
pyenv local 3.12.13
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install
cp .env.example .env
```

Recommended minimum backend `.env` values from the backend README:

```env
APP_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/agency
DATABASE_ECHO=false
DATABASE_POOL_SIZE=5
DATABASE_MAX_OVERFLOW=10
REDIS_HOST=localhost
REDIS_PORT=6379
ENVIRONMENT=local
LOCAL_STORAGE_PATH=local_storage
```

Start local infrastructure:

```bash
docker compose up -d postgres redis
```

Apply migrations:

```bash
make migrate
```

Start the backend:

```bash
make dev
```

Equivalent backend run command:

```bash
SSL_CERT_FILE=certs/local_cloudflare.cert ./.venv/bin/python -m uvicorn app:app --reload
```

## Dev Login

The frontend does not require Azure AD in dev mode.

Login flow:

1. On a fresh install, open `http://localhost:3000` and create the first local admin on `/setup`.
2. After that account exists, open `http://localhost:3000/login`.
3. Enter the admin email and password.
4. Submit the form.

The session is handled by `next-auth` credentials mode and the frontend API client attaches the dev access token automatically after login.

If `NEXT_PUBLIC_AGENCY_DEV_AUTH_ENABLED=false`, the email/password form remains unavailable and the app falls back to the future/prod auth path.

## Backend Base URL

Primary frontend backend URL:

```env
NEXT_PUBLIC_AGENCY_API_BASE_URL=http://127.0.0.1:8000
```

Compatibility fallback still exists:

```env
LOCAL_BACKEND=http://127.0.0.1:8000
```

New configuration should use `NEXT_PUBLIC_AGENCY_API_BASE_URL`. `LOCAL_BACKEND` remains only for transitional compatibility.

## Connectivity Check

Verify backend health directly:

```bash
curl http://127.0.0.1:8000/health
```

Expected response:

```json
{"ok":true}
```

Useful backend URLs:

- health: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)
- docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- openapi: [http://127.0.0.1:8000/openapi.json](http://127.0.0.1:8000/openapi.json)

Frontend behavior when backend is offline:

- the app shell health badge shows `Backend offline`
- backend-backed pages show query error states
- retry actions remain available from the screen or health indicator refresh button

## Troubleshooting

### CORS errors

Symptoms:

- browser console shows blocked cross-origin requests
- login succeeds locally but backend requests fail immediately

Checks:

1. Confirm the frontend is using `http://127.0.0.1:8000` or the exact backend origin you configured.
2. Confirm the backend is running through the transformed FastAPI app entrypoint.
3. Inspect `/Users/kehchinleong/Documents/Personal/Agency/agency/app/api/main.py` if origin handling needs adjustment.

### 401 Unauthorized

Symptoms:

- protected routes redirect back to login
- backend calls fail after login

Checks:

1. Confirm `NEXT_PUBLIC_AGENCY_DEV_AUTH_ENABLED=true`.
2. Confirm the login form credentials match `DEV_AUTH_EMAIL` and `DEV_AUTH_PASSWORD`.
3. Sign out and sign back in.
4. If the session is stale, clear browser cookies for `localhost`.

### Backend unavailable

Symptoms:

- shell health badge shows `Backend offline`
- agent/workflow/runtime/integration screens show request failures

Checks:

1. Run `curl http://127.0.0.1:8000/health`
2. If it fails, restart the backend with `make dev`
3. If Postgres or Redis are missing, restart them with `docker compose up -d postgres redis`

### Wrong API base URL

Symptoms:

- requests go to the wrong host or port
- the frontend loads but data screens fail consistently

Checks:

1. Confirm `.env.local` sets `NEXT_PUBLIC_AGENCY_API_BASE_URL=http://127.0.0.1:8000`
2. Restart `npm run dev` after changing env values
3. Do not hardcode localhost URLs inside components

### Token or session stuck

Symptoms:

- login state looks inconsistent
- requests still use an old token after env changes

Checks:

1. Sign out from the app
2. Delete browser cookies for `localhost`
3. Reload the app and sign in again

### Stale localStorage or sessionStorage

Symptoms:

- old UI state persists across backend changes
- legacy screens keep showing outdated selections or cached values

Checks:

1. Open browser devtools
2. Clear `localStorage` and `sessionStorage` for `http://localhost:3000`
3. Reload the app

## Notes

- Azure AD and Google auth variables can remain in `.env.local`, but they are not required for local dev auth.
- The frontend still contains some transitional compatibility flows under `/api/*`. Those continue to work best when the backend is started from the transformed backend repo and the compatibility routes are available.
- For deeper auth details, see [docs/dev-auth-flow.md](../docs/dev-auth-flow.md).
