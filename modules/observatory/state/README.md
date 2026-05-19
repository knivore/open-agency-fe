# State

Frontend-only state helpers belong here.

Responsibilities:

- Runtime visual store slice for normalized visualization state.
- Selected room/object/agent IDs.
- Camera preferences represented as serializable values.
- Feed pause/filter preferences.
- Debug UI toggles.
- Local visualization preferences.

Non-responsibilities:

- Authoritative backend runtime state.
- Backend workflow/task state.
- Phaser object instances.
- Raw transport connections.

Keep state serializable and safe to reset.
