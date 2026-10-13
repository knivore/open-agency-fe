# Open Agency FE

Frontend companion for the [`open-agency`](https://github.com/knivore/open-agency) backend.

The public product name is **Open Agency**. The repository names are `open-agency` and
`open-agency-fe`. Existing `AGENCY_*` environment variables and `x-agency-*` headers remain stable compatibility
identifiers shared with the backend.

Module convention:

- frontend feature modules live under `modules/*`
- current canonical smart-home frontend module is `modules/smart-home`
- route files under `app/*` should stay thin entrypoints that render module-owned implementation
- future sibling modules such as a robot module should follow the same pattern under `modules/*`

The current local-development flow is:

- frontend: Next.js app in this repository
- backend: FastAPI app in a sibling `open-agency` repository
- auth in local dev: backend email/password auth with env-backed fallback
- backend base URL in local dev: `http://127.0.0.1:8000`

## Quick Start

From the sibling backend repo, the easiest path is:

```bash
cd ../open-agency
./agency start
```

The backend launcher detects this frontend repo, writes `.env.local`, installs frontend dependencies, and starts
Next.js.

Manual frontend-only setup:

1. Copy `.env.example` to `.env.local`.
2. Set:

```env
NEXT_PUBLIC_AGENCY_API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_AGENCY_DEV_AUTH_ENABLED=true
DEV_AUTH_EMAIL=dev@example.com
DEV_AUTH_PASSWORD=change-me
NEXTAUTH_SECRET=replace-me-in-local-dev
AUTH_TRUST_HOST=true
```

3. Install frontend dependencies:

```bash
npm install
```

4. Start the frontend:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000). On a fresh backend, Open Agency opens `/setup` so you can create
   the first local admin account, then complete runtime setup. After that, use `/login` with those admin credentials.

To start the local backend dependencies, OneCLI, Langfuse, backend API, and frontend together:

```bash
cd ../open-agency
./agency start
```

You can also use `make start` from the backend repo. The same start command is LAN-ready.

## Mobile / LAN Development

To open the local app from a phone on the same Wi-Fi network, prefer a direct LAN URL for the Open Agency runtime. Use
the frontend same-origin reverse proxy only as an explicit local-only fallback.

The easiest path is from the backend repo:

```bash
cd ../open-agency
./agency start
```

On Windows Git Bash:

```bash
./run-windows.sh start
```

The script writes the frontend LAN settings into `.env.local`, starts the backend stack, and then starts the frontend.

Manual setup is:

1. Find the Mac LAN IP:

```bash
ipconfig getifaddr en0
```

2. Start the backend as usual. Docker Compose already publishes port `8000`.

```bash
cd ../open-agency
docker compose up -d postgres redis
make dev
```

3. In the frontend `.env.local`, prefer an explicit Open Agency runtime URL that the browser can reach:

```env
# Keep NEXTAUTH_URL and AUTH_URL unset so auth uses the host you open.
# Set them only when you need one fixed canonical auth origin, such as
# production-like OAuth callback testing or a public tunnel URL.
NEXT_PUBLIC_AGENCY_API_BASE_URL=http://<mac-lan-ip>:8000
```

If the backend must stay reachable only from the laptop, use the local-only same-origin fallback instead:

```env
# Keep NEXTAUTH_URL and AUTH_URL unset so auth uses the host you open.
# Set them only when you need one fixed canonical auth origin, such as
# production-like OAuth callback testing or a public tunnel URL.
AGENCY_FE_ENABLE_BACKEND_REWRITE=true
NEXT_PUBLIC_AGENCY_API_BASE_URL=/backend
AGENCY_INTERNAL_API_BASE_URL=http://127.0.0.1:8000
```

The `/backend/*` rewrite is disabled by default. Enable it only for trusted local LAN or phone testing, and do not use
it for production or internet-facing deployments.

4. Start the frontend on all interfaces:

```bash
npm run dev:lan
```

5. On the phone, open:

```text
http://<mac-lan-ip>:3000
```

With the same-origin fallback, browser requests to `/backend/*` are proxied by Next.js to the FastAPI backend, so the
phone never tries to call `127.0.0.1:8000` directly.

For Tailscale, use the same setup and open the Tailscale URL, for example `http://100.x.y.z:3000`. Do not hardcode that
Tailscale URL into `NEXTAUTH_URL` or `AUTH_URL` for normal local dev. Auth.js will derive it from the incoming request
host, so changing laptops, Wi-Fi networks, or Tailscale addresses does not require editing env. Set a fixed auth URL
only when every auth callback should resolve to one canonical address, such as a deployed domain, an OAuth callback test
URL, or a public tunnel.

## Runtime API Boundary

`open-agency` owns the canonical runtime APIs for agents, chat, tools, workflows, memory, credentials, artifacts,
schedules, approvals, and execution logs. `open-agency-fe` should call the configured Open Agency runtime origin
directly, or use explicit frontend BFF routes only where the management console owns session adaptation, UI aggregation,
or streaming adaptation.

Server-side BFF routes delegate the authenticated frontend session to `open-agency` with
`x-agency-client: agency-fe`; the header value is retained for protocol compatibility, frontend user identity headers,
and a scoped shared identity key from `AGENCY_FE_BFF_IDENTITY_KEY`. Set the same value in
`open-agency` as `AGENCY_INTERNAL_API_KEY`. The older `AGENCY_INTERNAL_API_KEY` and `BACKEND_INTERNAL_API_KEY` frontend
names remain compatibility fallbacks, but new deployments should use the FE-scoped name.

## Agency Graph Local Setup

`/memory-graph` is the Agency Graph investigation surface. It reads projected graph neighborhoods from the backend Neo4j
graph-read API and falls back to execution events for run/workflow investigation when projection is unavailable. The
route name is retained for compatibility; user-facing navigation and page copy use `Agency Graph`.

Current frontend behavior:

- Default root focus is `All`, combining available memory projection data with recent run/event fallback data.
- Root focus can be narrowed from the filter popover. The primary choices are All, Memory, Run, and Workflow; direct-ID
  roots cover Agent, Entity, Document, and Error.
- The visual legend uses a small set of user-facing node categories: Agent, Workflow, Run, Event, Tooling, Knowledge,
  Issue, and Other. Raw backend node labels such as `WorkflowRun` and `RuntimeContainer` remain available in inspector
  details, but are not exposed as primary legend labels.
- Repetitive execution event nodes are condensed out of the default canvas. Event counts and grouped event summaries are
  shown in the selected parent node inspector instead.
- The default UI keeps filtering compact: root focus/search, run status, graph text search, status, severity,
  relationship, clear filters, and only the active runtime badges that affect the current view.
- The graph toolbar exposes Overview, Links, and Focus view modes, plus a 2D/3D renderer toggle. The 2D renderer uses
  the Sigma constellation canvas; the 3D renderer uses a force graph with orbit pause/resume, reset view, and stabilized
  camera movement.
- Advanced presets, timeline controls, clustering controls, dense diagnostics, and temporal controls remain hidden until
  there is clearer product feedback on those workflows.
- Table side panels for runs/events/memories/entities/findings/search results are intentionally deferred. The graph now
  favors a simple canvas, compact legend, focused filters, and click-through inspector details.
- The inspector is scrollable for dense nodes, and the graph has been smoke-checked across desktop, wide desktop,
  tablet, mobile, and fullscreen viewports.
- Selecting a projected node can expand its immediate neighborhood on demand. Heavy event payloads and metrics stay out
  of the default graph document and are shown only through inspector details.
- Large graphs are bounded before rendering: graph reads request depth `2` with a node limit of `250`, the frontend
  renders at most `250` nodes and `500` edges, event fallback uses at most `120` events per run, and labels are capped
  at
  `80` characters. Truncation is shown in the filter popover when the backend or frontend caps the view; source and
  coverage diagnostics live in the status tooltip.
- Graph status and graph neighborhoods are cached briefly so navigating and refreshing the page does not repeatedly
  reload the same projection. The refresh button explicitly invalidates the active graph/root queries.
- Live graph deltas are optional behind `NEXT_PUBLIC_GRAPH_REALTIME_ENABLED=true`; when enabled, Agency Graph shows the
  live/offline state and reconciles deltas with snapshot refreshes.

User-facing guidance lives in [`docs/agency-graph-user-guide.md`](docs/agency-graph-user-guide.md). Developer details
live in [`docs/agency-graph-developer-guide.md`](docs/agency-graph-developer-guide.md).

For local graph-read validation:

1. Start the backend stack from the sibling backend repo:

```bash
cd ../open-agency
./agency start
```

2. Confirm the frontend points to the local backend. Direct local access or the same-origin rewrite are both supported:

```env
NEXT_PUBLIC_AGENCY_API_BASE_URL=http://127.0.0.1:8000
```

or:

```env
AGENCY_FE_ENABLE_BACKEND_REWRITE=true
NEXT_PUBLIC_AGENCY_API_BASE_URL=/backend
AGENCY_INTERNAL_API_BASE_URL=http://127.0.0.1:8000
```

3. Confirm graph read is enabled and reachable:

```bash
curl http://127.0.0.1:8000/graph/read/status
```

Expected connected response:

```json
{ "enabled": true, "available": true, "source": "neo4j" }
```

If `available:false`, the page should still allow Run or Workflow roots and synthesize an event-derived graph from
`/executions`, `/observability/executions/{executionId}/timeline`, and `/executions/{executionId}/events`.

Useful local smoke checks:

```bash
curl http://127.0.0.1:8000/executions
curl http://127.0.0.1:8000/executions/{executionId}/events
curl http://127.0.0.1:8000/observability/executions/{executionId}/timeline
curl http://127.0.0.1:8000/observability/executions/{executionId}/graph
```

Then open [http://localhost:3000/memory-graph](http://localhost:3000/memory-graph), open filters, and verify:

- Root focus exposes All, Memory, Run, and Workflow as primary choices, with Agent, Entity, Document, and Error under
  Direct ID.
- The filter popover stays compact and does not show fallback source labels, recent-run counts, or projection
  diagnostics.
- Event fallback avoids filling the canvas with repeated event nodes; grouped event detail appears after selecting the
  relevant parent node.
- 2D/3D switching, 3D orbit pause/resume, 3D reset view, refresh, and fullscreen controls remain responsive.

Remaining graph work is tracked in `docs/agency-graph-developer-guide.md` under `TODO Next`; keep release-only graph
items there instead of reviving standalone checklist trackers.

`open-agency-fe` must not expose a generic `/backend/*` tunnel in production or internet-facing deployments. The tunnel
is disabled by default and requires `AGENCY_FE_ENABLE_BACKEND_REWRITE=true` for trusted local testing.

## Common Scripts

```bash
npm run dev
npm run dev:lan
npm run build
npm run secret-scan
npm run lint
npm run typecheck
npm run check:unused
npm test
```

## Observatory

`Observatory` is the frontend runtime visualization surface for Open Agency. It lives in
[`modules/observatory`](modules/observatory)
and exposes these app routes:

- `/observatory/builder` for layout editing, publishing, and debug tooling
- `/observatory/embed` for compact read-only embedding
- `/runs` for the main runtime view that can render Observatory alongside execution data

The module-level implementation and packaging notes live in
[`modules/observatory/README.md`](modules/observatory/README.md).

## Developer Docs

Maintained frontend docs:

- [Local Development](docs/local-development.md)
- [Dev Auth Flow](docs/dev-auth-flow.md)
- [Frontend API Client](docs/frontend-api-client.md)
- [Backend Route Registry](docs/backend-route-registry.md)
- [Frontend App Shell](docs/frontend-app-shell.md)
- [Main Agent](docs/main-agent.md)
- [Frontend Domain Types](docs/frontend-domain-types.md)
- [Workflow Monitoring](docs/workflow-monitoring.md)
- [Workflow Runtime Governance](docs/workflow-runtime-governance.md)

The main-agent monitor command center is available under Operations at `/operations/main-agent-monitor` after login. It
shows monitor loop health, pending approval gates, repo-write permission requests, recent findings/proposals/steering
requests, monitored workflow coverage, and notification routing for in-app or linked external chat delivery.

## Main Agent

Protected app pages can open the floating assistant with page context. When a page supplies selected entities and
assistant providers, the popup header shows the active target, conversation messages carry that context to the backend
main-agent LLM, and approval cards show the originating page/provider metadata. Natural-language requests still let the
LLM choose the appropriate tool; workflow, agent, and tool mutations remain proposal/approval based. See
[docs/main-agent.md](docs/main-agent.md) for this repo's frontend UI and page-context contract. Backend main-agent
runtime, prompt, model profile, tool policy, and approval enforcement stay documented in
`../open-agency/docs/main-agent.md`.

## Integrations

The integrations surface includes provider setup and connector operations in one view:

- `/integrations`
  - backend-backed provider inventory
  - planned connector setup and credential save flows
  - connector history, category summaries, and deep links
  - custom tool capabilities rendered as read-only cards
  - failing, healthy, and never-tested filters
  - bulk refresh and bulk connector testing
  - direct `Test now` actions for credential-backed connectors

Connector setup stays inside `/integrations`, where capability checks, secure setup sessions, required metadata,
verification, and health results remain attached to the connector being configured. End-user help is intentionally
limited to the in-app FAQ and the Main Agent assistant.

Runtime outbound webhooks and internal sub-agent callbacks are backend runtime features documented in
`../open-agency/docs/runtime/outbound-webhooks.md` and `../open-agency/docs/runtime/subagent-callbacks.md`. They are not
currently first-class frontend configuration workflows.

Current first-wave operational connectors include:

- Telegram
- WhatsApp Cloud API
- Discord
- Slack setup preparation

The frontend supports degraded operation when backend connector schema routes are not fully rolled out yet:

- connector setup falls back from schema lookups to connector capabilities
- setup dialogs can fall back to planned connector metadata
- WhatsApp fallback still surfaces `phone_number_id`

### Embedded OneCLI credential setup

Set the browser-visible OneCLI dashboard URL at frontend build time:

```env
NEXT_PUBLIC_ONECLI_APP_URL=http://127.0.0.1:10254
```

Integrations exposes an **Open OneCLI** quick link and embeds the connector's OneCLI credential screen after Open Agency
creates an owner-scoped setup session. Configure OneCLI on a separate origin (a different host, scheme, or port); Open
Agency refuses to iframe a same-origin OneCLI URL. This ensures Open Agency JavaScript cannot inspect OneCLI credential
fields. Setup URLs contain only non-secret prefill values such as host, path, connection name, header name, and value
format.

Routing is verified against OneCLI `v1.27.0`: supported native providers use `/connections?connect=<provider>`, verified
header-injection connectors use a prefilled Generic Secret form, and other connectors open OneCLI's secret chooser
without guessing provider configuration. Re-check OneCLI's app registry and Generic Secret query contract when the image
is upgraded.

The backend capability field `runtimeSecretRequired` controls whether Open Agency must request an encrypted runtime
mirror. Telegram is currently the only exception because its token is embedded in the Bot API URL path. Discord can use
the owner-scoped OneCLI header proxy and therefore completes without sending its token back to Open Agency. OneCLI
`v1.27.0`
does not emit an Open Agency completion event, so the Integrations dialog retains an explicit **Complete setup** action
and status polling around the iframe. A new-tab fallback is always available for authentication or OAuth popup
restrictions.

Tool definitions from the backend use split identities: `id` is stable registry identity, `name` is the callable-safe
agent/runtime name, and `display_name` is the human label. Frontend tool lists should render labels with
`toolDisplayName(tool)` from `lib/tools/displayName.ts`; raw callable or implementation names should stay out of normal
integration UI unless a developer/debug view explicitly needs them.

Workflow tool setup also reads backend input-schema extensions. `x-agency-filled-by` distinguishes workflow-author
defaults from agent-supplied runtime inputs, while `x-agency-user-visible: false`
hides setup-managed fields from ordinary editors. The workflow graph tool drawer should stay schema-driven rather than
adding per-tool React exceptions.

Relevant implementation doc:

- [docs/backend-route-registry.md](docs/backend-route-registry.md)

## Browser, local apps and workflow review

Open `/integrations/local-access` while signed in to download and pair the Chrome connection or Windows/macOS companion.
A pairing code prepares the handoff; it does not mean access is connected. Choose allowed sites/windows in the local
extension or companion. Native clicks and text changes require local approval. Managed browser launch preferences remain
separate from your existing Chrome settings.

Open `/operations/main-agent-monitor` for findings, the human approval inbox and **Workflow learning & repair**.
Completed reviews are investigations, not verified repairs. Missing historical workflow revisions require evidence
recovery; exhausted model failures can be retried after correcting their cause. Changes retain human approval, and a
comparable post-change run establishes validation.

The backend owns pairing, run evidence and approval decisions. The frontend proxy accepts only the documented
setup/download actions and forwards trusted identity; it does not store pairing codes in browser storage. The backend's
`docs/local-access-and-improvement.md` is the canonical setup and lifecycle guide.

`npm run check:unused` checks TypeScript and unused symbols without writing an incremental cache, so it also works in
the launcher's read-only Docker checkout.
`npm run lint` checks source rules; `npm test` runs the unit/component suite.

## Auth Note

Azure AD / MSAL is not required for local development. In dev mode, the app uses the email/password flow documented in
[docs/dev-auth-flow.md](docs/dev-auth-flow.md).

## Contributing

`open-agency-fe` is the frontend companion to the Open Agency backend. Contributions should preserve the backend-owned
runtime API boundary and keep route files as thin entrypoints over module-owned implementation.

If you use this repository as a foundation for your own product, deployment, fork, or internal platform, please retain
attribution to the original Open Agency project and consider opening pull requests for fixes, hardening work,
documentation improvements, or general-purpose features that could help the upstream project.

## Author and Attribution

Open Agency and `open-agency-fe` were created by Keh Chin Leong (KEH) and are maintained with contributions from the
Open Agency community.

When redistributing or building on this repository, please credit the original Open Agency project and preserve
applicable copyright, license, and attribution notices.

## License

Licensed under the [Apache License 2.0](./LICENSE).

Copyright 2026 Open Agency contributors.

## Chrome snapshots in Local Access

`/integrations/local-access` offers on-demand allowed-tab discovery and a locally reviewed screenshot preview. Reload
the Agency extension version 0.2.0, pair selected origins, choose a listed tab, request its screenshot, select that tab
in Chrome and approve in the extension popup. This uses temporary `activeTab` permission from user invocation. It does
not automatically open or focus tabs.

Images use an authenticated no-store BFF route, bypass Next image optimization and are retained only as the latest
capture in backend pairing memory for two minutes. Stop/re-pair/restart revokes access. Connection changes clear
component observations and invalidate late responses; failed captures never replay. The agent receives metadata/link,
not image pixels. A human snapshot viewer is not model vision or a live video stream.

Validation:
`npx vitest run components/integrations-app/ChromeSnapshotViewer.test.tsx components/integrations-app/LocalAccessSetup.test.tsx`,
scoped ESLint and `npm run typecheck`. Actual capture needs a paired Chrome extension and local approval; mocked
component/extension tests do not prove that live journey.

Assistant turn recovery uses persisted conversation/turn identity for modern replies and approvals. Late older-turn
events cannot release a newer pending composer; a manual check without completion reports an unverified outcome and
retains Stop rather than recommending replay. Legacy unscoped assistant messages retain timeline compatibility. Unknown
legacy approval origins no longer match by timestamp alone. See Open-Agency's agent-harness chat recovery documentation
for reasoning, tests and remaining durable-worker limitations.

### Browser and local app setup

**Integrations → This computer → Set up browser & apps** opens
`/integrations/local-access`. Install once, approve exact sites or windows locally, then use **Connect Chrome** or
**Connect apps**. Agency hands off a five-minute owner-bound request and shows Connected only after backend
confirmation. Manual pairing remains a recovery option. Chrome requires extension 0.3.2 or newer; refresh the page after
installation or updates.

For release distribution, configure `NEXT_PUBLIC_AGENCY_CHROME_STORE_URL` with an official published Web Store listing
and `NEXT_PUBLIC_AGENCY_COMPANION_INSTALLER_URL`
with an HTTPS signed, self-contained Windows installer. Without these, the UI explains developer installation. The
Windows developer route requires Python 3 with the `py` launcher, downloads a PowerShell installer, and provides a
copyable command that selects the newest exact installer-name match in Downloads, including Chrome's numbered
duplicates. It prints the selected path and respects execution policy. Clipboard denial leaves the command selectable.

A running Windows companion accepts setup requests on `127.0.0.1:18765`;
`agency-connect://open` launches an installed companion. Browser launch and local network prompts, site/window approval,
session lifetime, and Stop remain explicit boundaries. See the
backend [local-access guide](https://github.com/knivore/open-agency/blob/main/docs/local-access-and-improvement.md)
for installation, recovery, and runtime limits. Neither published release artifact is supplied by this change.

macOS selects its own setup instructions and `Install-AgencyConnect.command`
download. **Copy Terminal command** runs the newest matching downloaded installer. The developer route needs Python
3.10+ with Tk and creates a per-user application launcher. Open it, explicitly grant Accessibility permission in System
Settings, select allowed windows, then Connect apps. A signed/notarized release can use
`NEXT_PUBLIC_AGENCY_MACOS_COMPANION_INSTALLER_URL`; no such release is supplied yet. The browser extension is
platform-neutral. Native Mac installation and app control still require real-device validation; automated tests use
injected AX fixtures.

## Reusable UI composition

Pages compose shared components instead of maintaining independent control styles:

| Need                         | Canonical components                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| Workspace chrome and context | `AppShell`, `PageHeader` (breadcrumbs, actions, metadata, compact mode)                |
| Search and feedback          | `WorkspaceSearch`, `WorkspaceDirectory`, `AppState`, `AppInlineState`                  |
| Filtering and summaries      | `WorkspaceToolbar`, `WorkspaceMetrics` (controlled values, filter callbacks, status counts) |
| Detail and activity          | `InlineEditActions`, `ActivityTimeline`, `WorkspaceSectionNav` (exported by `PageHeader`) |
| Form layout and validation   | `FormSection`, `FormFieldGroup`, `FormField`, `FieldFeedback`                          |
| Controls                     | `Input`, `Textarea`, `NativeSelect`, Radix `Select`, `Checkbox`                        |
| Searchable choices           | `Combobox`, controlled/uncontrolled `MultiSelect`                                      |
| Form-library integration     | Typed adapters in `components/react-hook-form`                                         |
| Panels and interaction       | `Card`, `Tabs`, `ScrollArea`, `AppDialog`, `AppDrawer`, `ConfirmActionDialog`          |
| Tool evidence                | Contract widgets, `ToolInputForm`, `DiffViewer`, `PolicyVerdictPanel`, `ToolRunResult` |

Configure labels, options, descriptions, validation messages, disabled states, initial values, layout classes and
callbacks through props. Field IDs and feedback associations support independent instances. A picker's `value` is
controlled; `defaultValue` initializes an uncontrolled instance. Filtered catalogs preserve unavailable selections.

`WorkspaceDirectory` accepts grouped entries, metadata, filters and guarded selection callbacks, with a native
selector on smaller screens. Agent creation and inline editing share `AgentIdentityFields` and
`AgentInstructionsField`. The capability browser reuses `ToolAssignmentControls` in read-only mode; browsing the
main agent's full catalog never changes its explicit saved assignments. Switching agent detail sections preserves
form and upload drafts, while saving access still uses the feature's existing mutation path.

Workspace filters are presentation state. Saved run views retain workflow and date filters while older saved
views continue to work. `useDraftDiscardGuard` shares explicit discard decisions for inline editors; feature
components own draft values, pending requests and navigation callbacks. Keep form sections mounted when switching
views so section navigation and filtering do not erase input. Revision history is read-only and fetched on demand.
`CardTitle` supplies heading semantics by default; callers can override the heading level with `aria-level`.

Retain useful library components even before a page needs them. Remove superseded duplication by adopting the
canonical component, rather than treating every unreferenced library export as dead code. Keep queries, mutations,
capability ownership and approval decisions in the owning feature; UI callbacks do not grant access or authorize work.
