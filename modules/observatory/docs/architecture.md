# Architecture Boundary

Observatory is a readonly visualization module.

```text
Runtime Sources
  -> ExternalRuntimeEvent
  -> validate and sanitize
  -> normalize
  -> NormalizedOfficeEvent
  -> reduce into visual state
  -> React UI and pixel engine render state
```

## Ownership

Backend and external runtimes own:

- Task execution.
- Workflow state.
- Tool execution.
- Agent runtime state.
- Logs and approvals.
- Security decisions.

Observatory owns:

- Visual layout.
- Camera and selection UI state.
- Speech bubble display state.
- Activity feed display state.
- Runtime source display configuration.

The engine owns temporarily:

- Phaser game objects.
- Sprite instances.
- Animation instances.
- Camera runtime objects.
- Collision runtime objects.

Phaser references must not be stored in global React state.

## MVP Direction

The MVP should build a local readonly visualization first:

- Simple pixel canvas.
- Three-room sample layout.
- Five sample agents.
- Activity feed.
- Speech bubbles.
- Status badges.
- Debug raw event panel.
- Local sample events before live streams.

Live WebSocket/SSE integration comes after the rendering and event reducer boundaries are
stable.
