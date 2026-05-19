# Runtime Visual State

Phase B2 adds a pure reducer for normalized runtime events.

Implemented scope:

- Agent visual state by ID.
- Task visual state by ID.
- Workflow visual state by ID.
- Bounded activity feed.
- Bounded normalized event history.
- Speech bubble display state for agent speech/log messages.
- Timestamp ordering for feed/history.
- Per-entity stale event protection.
- Replay/time-travel helpers that rebuild reducer state at a cursor or timestamp.
- `/runs` replay controls backed by normalized event history.

Not implemented yet:

- Time-based speech bubble expiration.
- Event batching or sampling.

The reducer accepts `ObservatoryNormalizedOfficeEvent` only. Raw external events must be
validated and normalized before they reach this state layer.
