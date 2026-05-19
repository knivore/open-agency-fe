# Components

Reusable React UI components for Observatory belong here.

Responsibilities:

- Activity feed UI.
- Source manager UI.
- Debug raw event panel.
- Agent, room, object, and task inspectors.
- Toolbar and status controls.
- Non-Phaser overlays.

Non-responsibilities:

- Phaser game lifecycle.
- Socket/SSE lifecycle.
- Event normalization logic.
- Backend mutation.

Components should receive already-normalized data or explicit callbacks from the app
layer.
