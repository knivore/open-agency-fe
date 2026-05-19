# Integration Guide

Observatory accepts runtime events through multiple frontend-safe paths.

## Local SDK

Use the local SDK when the producer runs in the same frontend bundle:

```ts
const client = createObservatoryLocalSdkClient({
  getState: runtimeStore.getState,
  setState: runtimeStore.setState,
});

client.pushEvent(event);
```

The `/runs` host keeps this path visible through Debug mode, so local event injection
remains available without cluttering the default preview.

## postMessage Embed

Use `/observatory/embed` for same-origin iframe embeds:

```ts
iframe.contentWindow?.postMessage(
  {
    type: 'observatory:runtime-event',
    event,
  },
  window.location.origin
);
```

## WebSocket

Use `createObservatoryWebSocketAdapter` when an external producer streams JSON events directly to the browser.

The adapter validates and normalizes each event before reducing it into visual state. It reports status snapshots and reconnects with bounded attempts.

## SSE

Use `createObservatorySseAdapter` for Server-Sent Events. The SSE `data` payload should be one `ExternalRuntimeEvent` JSON object or an array of events.

## Safety Rules

- Only accept enabled sources from explicitly allowed origins.
- Keep event payloads bounded.
- Put platform-specific details in inert `metadata`.
- Do not render raw HTML from event messages.
- Do not execute commands from events.
