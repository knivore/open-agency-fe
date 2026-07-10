# Event Model

Observatory should use two event layers only.

## ExternalRuntimeEvent

Raw events from Agency or external sources enter the module as external runtime events.
They are untrusted until validated and sanitized.

Expected fields:

- `id`
- optional `schemaVersion` (`agency.runtime-event.v1` for Open Agency backend streams)
- `source`
- `sourceType`
- `type`
- `timestamp`
- optional `actor`
- optional `workflow`
- optional `task`
- optional `level`
- optional `message`
- optional `metadata`

## NormalizedOfficeEvent

The runtime layer converts raw events into normalized visual events.

Initial normalized event types:

- `AGENT_STATUS_CHANGED`
- `AGENT_SPOKE`
- `TASK_STARTED`
- `TASK_PROGRESS`
- `TASK_COMPLETED`
- `TASK_FAILED`
- `TOOL_STARTED`
- `TOOL_COMPLETED`
- `TOOL_FAILED`
- `LOG_RECEIVED`
- `APPROVAL_REQUIRED`
- `FILE_CHANGED`
- `WORKFLOW_TRANSITIONED`

## Safety Defaults

- Reject invalid event shapes.
- Truncate long messages before display.
- Never render raw HTML.
- Keep metadata serializable.
- Keep the activity feed bounded.
- Drop or sample noisy debug events when needed.

## B1 Implementation

Runtime event code lives under `modules/observatory/runtime`.

Implemented:

- `ObservatoryExternalRuntimeEvent`
- `ObservatoryNormalizedOfficeEvent`
- validation helper
- normalizer helper
- normalizer interface
- local sample external events

Not implemented:

- event reducer
- activity feed
- stream adapters
- engine behavior mapping
