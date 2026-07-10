# Builder UX

`GraphCanvas` includes opt-in builder primitives that stay generic across projects.

## Built-In Toolbar Actions

Use `builtInToolbarActions` when a project wants common canvas commands without writing its own handlers:

```tsx
import GraphCanvas, {
  graphBuiltInToolbarActionIds,
} from '@/modules/react-flow-graph/GraphCanvas';

<GraphCanvas
  defaultDocument={document}
  paletteItems={paletteItems}
  builtInToolbarActions={[
    graphBuiltInToolbarActionIds.addNode,
    graphBuiltInToolbarActionIds.autoLayout,
    graphBuiltInToolbarActionIds.fitView,
    graphBuiltInToolbarActionIds.undo,
    graphBuiltInToolbarActionIds.redo,
    graphBuiltInToolbarActionIds.export,
    graphBuiltInToolbarActionIds.import,
  ]}
  onExportGraph={(_document, json) => {
    void navigator.clipboard?.writeText(json);
  }}
  onImportGraph={() => parseGraphDocumentJson(importedJson)}
/>;
```

The generic actions are:

- `graph.addNode`: adds the first available palette item.
- `graph.autoLayout`: lays out nodes in a stable grid.
- `graph.fitView`: fits the canvas viewport.
- `graph.undo`: restores the previous graph document.
- `graph.redo`: reapplies an undone graph document.
- `graph.export`: emits serialized `GraphDocument` JSON through `onExportGraph`.
- `graph.import`: accepts a replacement `GraphDocument` from `onImportGraph`.

Projects can still pass `toolbarActions` and `onToolbarAction` for domain-specific commands such as validation, running
a workflow, or opening a custom modal.

`onConnect(edge, document)` can return a replacement `GraphEdge`, a replacement `GraphDocument`, `false` to reject the
proposed connection, or nothing to accept the generic edge. Use this from project wrappers when connection rules depend
on domain semantics.

## Large Graph Navigation

The generic canvas exposes focus hooks that app wrappers can use for search or jump controls:

- `focusNodeId` identifies the node that should be brought into view.
- `focusNodeRevision` forces a repeated focus action for the same node id.

The workflow graph uses these hooks for its Jump control. The control stays app-specific because search labels and node
grouping are workflow concepts, but the viewport behavior belongs to the reusable canvas.

Dense workflow graphs can also provide their own detail-level toggle through wrapper state. The current workflow wrapper
persists a Clean/Detailed edge-label preference per workflow route, while keeping approval, branching, and invalid edge
labels visible even in Clean mode.

## Keyboard Shortcuts

Keyboard shortcuts are enabled by default. They run toolbar actions by id, so they work for built-in actions and
project-specific actions.

Default shortcuts:

- `Cmd+Z` / `Ctrl+Z`: undo.
- `Cmd+Shift+Z` / `Ctrl+Shift+Z` / `Ctrl+Y`: redo.
- `0`: fit view.

Projects can disable shortcuts or provide their own bindings:

```tsx
<GraphCanvas
  defaultDocument={document}
  keyboardShortcuts={[
    {
      id: 'validate-shortcut',
      actionId: 'validate',
      key: 'v',
      metaKey: true,
      preventDefault: true,
    },
  ]}
  toolbarActions={[{ id: 'validate', label: 'Validate' }]}
  onToolbarAction={(action, currentDocument) => {
    if (action.id === 'validate') {
      validateGraphDocument(currentDocument);
    }
  }}
/>
```

## Canvas States

`GraphCanvas` exposes generic states that projects can drive from their own loaders and validators:

```tsx
<GraphCanvas
  defaultDocument={document}
  loading={isLoading}
  loadingContent="Loading workflow graph"
  validationIssues={issues}
  invalidContent="Fix graph validation issues before running"
  readOnly={!canEdit}
  emptyContent="No nodes yet"
/>
```

The module does not own validation policy. It only displays `GraphValidationIssue[]` supplied by a project or by
`validateGraphDocument`.

When a validation issue targets a node or edge, `GraphCanvas` highlights that graph item and renders the issue as a
selectable row in the validation panel. Selecting the issue updates graph selection through the normal
`onSelectionChange` callback, so project inspectors can open the same item without special validation-specific wiring.
