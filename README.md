# Agency FE

Frontend for the Agency backend.

The current local-development flow is:

- frontend: Next.js app in this repository
- backend: FastAPI app in `/Users/kehchinleong/Documents/Personal/Agency/agency`
- identity in local dev: local single-user headers sent to the backend
- backend base URL in local dev: `http://127.0.0.1:8000`

## Quick Start

1. Copy [.env.example](/Users/kehchinleong/Documents/Personal/Agency/agency-fe/.env.example) to `.env.local`.
2. Set:

```env
NEXT_PUBLIC_AGENCY_API_BASE_URL=http://127.0.0.1:8000
```

3. Install frontend dependencies:

```bash
npm install
```

4. Start the frontend:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000).

## Mobile / LAN Development

To open the local app from a phone on the same Wi-Fi network, use the frontend as a same-origin reverse proxy for the
backend.

The easiest path is from the backend repo:

```bash
cd /Users/kehchinleong/Documents/Personal/Agency/agency
./run.sh --lan
```

On Windows Git Bash:

```bash
./run-windows.sh --lan
```

The script writes the frontend LAN settings into `.env.local`, starts the backend stack, and then starts the frontend.

Manual setup is:

1. Find the Mac LAN IP:

```bash
ipconfig getifaddr en0
```

2. Start the backend as usual. Docker Compose already publishes port `8000`; a host `make dev` backend can stay bound to
   `127.0.0.1` because only the Next.js server calls it.

```bash
cd /Users/kehchinleong/Documents/Personal/Agency/agency
docker compose up -d postgres redis
make dev
```

3. In the frontend `.env.local`, set:

```env
NEXT_PUBLIC_AGENCY_API_BASE_URL=/backend
AGENCY_INTERNAL_API_BASE_URL=http://127.0.0.1:8000
```

4. Start the frontend on all interfaces:

```bash
cd /Users/kehchinleong/Documents/Personal/Agency/agency-fe
npm run dev:lan
```

5. On the phone, open:

```text
http://<mac-lan-ip>:3000
```

With this setup, browser requests to `/backend/*` are proxied by Next.js to the FastAPI backend, so the phone never tries
to call `127.0.0.1:8000` directly.

For Tailscale, use the same setup and open the Tailscale URL, for example `http://100.x.y.z:3000`.

## Common Scripts

```bash
npm run dev
npm run dev:lan
npm run build
npm run lint
npm run typecheck
```

## Observatory

`Observatory` is the frontend runtime visualization surface for Agency. It lives in
[`modules/observatory`](/Users/kehchinleong/Documents/Personal/Agency/agency-fe/modules/observatory)
and exposes these app routes:

- `/observatory/builder` for layout editing, publishing, and debug tooling
- `/observatory/embed` for compact read-only embedding
- `/runs` for the main runtime view that can render Observatory alongside execution data

The module-level implementation and packaging notes live in
[`modules/observatory/README.md`](/Users/kehchinleong/Documents/Personal/Agency/agency-fe/modules/observatory/README.md).

## Developer Docs

Maintained frontend docs:

- [Local Development](docs/local-development.md)
- [Dev Auth Flow](docs/dev-auth-flow.md)
- [Frontend API Client](docs/frontend-api-client.md)
- [Backend Route Registry](docs/backend-route-registry.md)
- [Frontend App Shell](docs/frontend-app-shell.md)
- [Frontend Domain Types](docs/frontend-domain-types.md)

## Integrations

The integrations surface is now split into two complementary views:

- `/integrations`
  - backend-backed provider inventory
  - planned connector setup and credential save flows
  - connector history, category summaries, and deep links
  - custom tool capabilities rendered as read-only cards
- `/integrations/operations`
  - dedicated connector operations queue
  - failing, healthy, and never-tested filters
  - bulk refresh and bulk connector testing
  - direct `Test now` actions for credential-backed connectors

Current first-wave operational connectors include:

- Telegram
- WhatsApp Cloud API
- Discord

The frontend supports degraded operation when backend connector schema routes are not fully rolled out yet:

- connector setup falls back from schema lookups to connector capabilities
- setup dialogs can fall back to planned connector metadata
- WhatsApp fallback still surfaces `phone_number_id`

Tool definitions from the backend use split identities: `id` is stable registry identity, `name` is the callable-safe
agent/runtime name, and `display_name` is the human label. Frontend tool lists should render labels with
`toolDisplayName(tool)` from `lib/tools/displayName.ts`; raw callable or implementation names should stay out of
normal integration UI unless a developer/debug view explicitly needs them.

Relevant implementation doc:

- [docs/backend-route-registry.md](/Users/kehchinleong/Documents/Personal/Agency/agency-fe/docs/backend-route-registry.md)

## Auth Note

Azure AD / MSAL is not required for local development. In dev mode, the app uses the email/password flow documented in [docs/dev-auth-flow.md](/Users/kehchinleong/Documents/Personal/Agency/agency-fe/docs/dev-auth-flow.md).
