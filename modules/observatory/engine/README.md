# Engine

Pure visual engine code belongs here.

Responsibilities:

- Phaser bootstrap and lifecycle.
- Office/world scene setup.
- Grid, camera, collision, sprites, and animation.
- Asset registry loading from validated visual assets.
- Rendering rooms, agents, furniture, labels, effects, and debug overlays.

Non-responsibilities:

- Agency API calls.
- WebSocket or SSE connection management.
- Workflow execution.
- Runtime event normalization.
- External platform-specific adapter logic.
- Global React state that stores Phaser object references.

The engine should receive serializable visual state and render it. It should not own
runtime truth.
