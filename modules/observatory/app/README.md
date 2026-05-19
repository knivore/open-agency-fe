# App

React shell composition for Observatory belongs here.

Responsibilities:

- Module-level page shell.
- Canvas mounting boundary.
- Toolbar, side panel, debug shell, and layout composition.
- Wiring engine, runtime state, and integration status together through React props.

Non-responsibilities:

- Low-level Phaser scene implementation.
- Raw event transport implementation.
- Runtime execution.

The app layer can coordinate contexts, but it should not collapse their responsibilities.
