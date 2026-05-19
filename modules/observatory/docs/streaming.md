# Streaming

Observatory supports direct-to-frontend stream adapters and Agency backend runtime streams.

## Implemented

- Generic WebSocket adapter.
- Generic SSE adapter.
- Shared payload parser for one event or event batches.
- Strict `ExternalRuntimeEvent` validation.
- Normalization into `NormalizedOfficeEvent`.
- Bounded payload size with a default 64KB limit.
- Reconnect with bounded attempts.
- Source status callbacks.

## Agency Backend Streams

The Agency backend stream track is implemented in the `agency` repository:

- Backend runtime event model.
- Runtime event schema version: `agency.runtime-event.v1`.
- In-memory event bus.
- WebSocket endpoint: `/ws/runtime/events`.
- SSE endpoint: `/api/runtime/events/stream`.
- Auth/filtering.
- Backend queue limits and rate limits.

## Frontend Payload Limit

The direct stream ingestion default is:

```ts
OBSERVATORY_DEFAULT_MAX_STREAM_PAYLOAD_BYTES = 64 * 1024;
```

Hosts can override `maxPayloadBytes` when creating WebSocket or SSE adapters, but should not raise it without a concrete performance and security reason.
