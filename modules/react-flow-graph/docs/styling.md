# Styling

`GraphCanvas` imports `@xyflow/react/dist/style.css` inside the module shell. Consuming app pages do not need to import
the XYFlow stylesheet directly.

## Canvas Size

Consumers should give `GraphCanvas` a stable height:

```tsx
<GraphCanvas document={document} className="h-160 w-full rounded-md border" />
```

The module does not force a page layout because different projects may embed the canvas in dashboards, editors, drawers,
or full-page routes.

## Render Overrides

Use `nodeRenderers`, `edgeLabelRenderers`, `renderInspector`, `renderToolbar`, and `renderRuntimeEvent` to match a
project design system.

```tsx
<GraphCanvas
  document={document}
  nodeRenderers={{ 'infra.service': ServiceNode }}
  renderToolbar={ProjectToolbar}
/>
```

## Theming

The default renderers use neutral Tailwind classes and are meant as a fallback. Production consumers should provide
their own renderers when the graph represents a specific domain.

## Built-In States

`GraphCanvas` includes optional controls for common shell states:

- `showControls` for XYFlow controls
- `showMiniMap` for a minimap
- `emptyContent` for empty documents
- `readOnlyContent` for read-only mode

## Minimap

`showMiniMap` renders the React Flow minimap in its default bottom-right panel. The minimap uses high-contrast
light/dark colors and type-aware node silhouettes so large workflow graphs remain navigable without enlarging the
minimap itself.

React Flow skips minimap nodes that do not have dimensions. The module's XYFlow adapter therefore supplies
`initialWidth` and `initialHeight` fallbacks by graph node type. These values are only for canvas/minimap measurement;
they are not written back into the app's graph document unless the node has an explicit saved size.

## Portability

When copying `modules/react-flow-graph` into another React project, bring these assumptions:

- React
- `@xyflow/react`
- a CSS pipeline that can handle the project’s renderer classes
- the path aliases used by the consuming app should stay outside `modules/react-flow-graph`
