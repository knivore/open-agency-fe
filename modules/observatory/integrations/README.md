# Integrations

Event source adapters belong here.

Responsibilities:

- Agency runtime stream adapter.
- Generic WebSocket adapter.
- Generic SSE adapter.
- Local SDK/event push adapter.
- `postMessage`/embed adapter.
- Future Hermes, Claude Code, Codex, and custom source adapters.
- Source allowlists, origin checks, payload size limits, and adapter status.

Non-responsibilities:

- Direct rendering.
- Phaser scene access.
- Workflow execution.
- Trusting raw external payloads without validation.

Adapters should emit validated external events into the runtime normalization layer.

Current preview adapters are intentionally local-only:

- `localEventBridge.ts` validates, normalizes, and reduces one raw event.
- `localSdkClient.ts` wraps the bridge with a small `pushEvent`/`pushEvents` API.
- `postMessageBridge.ts` receives same-origin browser messages for FE verification.
- `sourceRegistry.ts` owns preview source status and origin checks.
