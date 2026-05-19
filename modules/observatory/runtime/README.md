# Runtime

Runtime visualization contracts and reducers belong here.

Responsibilities:

- Define raw external runtime event types.
- Define normalized visual event types.
- Validate, sanitize, and normalize events.
- Reduce normalized events into serializable visual state.
- Track activity feed entries, agent status, task progress, and speech bubble data.
- Enforce bounded feed and message limits.

Non-responsibilities:

- Opening sockets or subscribing to browser transport APIs.
- Rendering Phaser objects.
- Executing commands or mutating backend state.
- Persisting authoritative workflow state.

Runtime state here is display state only.

## Current Scope

Track B1 defines the two event layers:

- `ObservatoryExternalRuntimeEvent`
- `ObservatoryNormalizedOfficeEvent`

It also provides validation and normalization helpers. It does not connect streams, reduce
events into visual state, or call the Phaser engine directly.

Track B2 adds a pure reducer that consumes normalized events and returns serializable
display state. It still does not connect streams or call Phaser.
