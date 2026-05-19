# Observatory Embed

Use `/observatory/embed` when a host page needs a compact, iframe-friendly runtime visualization surface.

The route renders `ObservatoryRuntimeSurface` in compact read-only mode:

- Local replay/reset controls are hidden.
- Raw JSON injection is hidden.
- Activity feed mutation controls are hidden.
- Same-origin `window.postMessage` runtime events are still accepted and validated.

Host pages can send events with:

```ts
iframe.contentWindow?.postMessage(
  {
    type: 'observatory:runtime-event',
    event: {
      id: 'evt:host-1',
      source: 'host-app',
      sourceType: 'custom',
      type: 'task_progress',
      timestamp: new Date().toISOString(),
      actor: { id: 'agent:atlas' },
      workflow: { id: 'workflow:host', roomId: 'room:runtime-floor' },
      task: { id: 'task:host', title: 'Host event', progress: 0.5 },
    },
  },
  window.location.origin
);
```
