# Guardrails

## Runtime Safety

- The visualization module must not execute commands.
- Visual events must not mutate backend state.
- Phaser scenes must not call privileged Agency APIs.
- Event messages must be displayed as text, never raw HTML.

## Trust Boundaries

- Treat all external runtime events as untrusted until validation succeeds.
- Validate source type, event type, timestamp, payload size, and message length.
- Keep a source allowlist for direct external streams.
- Validate browser origins for future `postMessage` support.

## Backpressure

Initial recommended limits:

- Max feed entries: 1,000.
- Max speech bubble characters: 160.
- Max activity message characters: 1,000.
- Max raw event payload: 64 KB.
- Max visible speech bubbles per agent: 1.
- Max concurrent live sources in MVP: 1.

## Implementation Discipline

- Keep engine, runtime, integrations, and React UI separated.
- Do not store Phaser runtime objects in global state.
- Do not hardcode Agency, Codex, Claude Code, or Hermes into the engine.
- Do not introduce multiple overlapping event models.
- Keep every phase independently reviewable.
