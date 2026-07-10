# Custom Node Types

Projects define their own graph vocabulary with `createGraphDefinition`.

## Register Types

```ts
const graphDefinition = createGraphDefinition({
  nodeTypes: {
    'crm.contact': {
      type: 'crm.contact',
      label: 'Contact',
      defaultData: { email: '', owner: '' },
      defaultPorts: [{ id: 'relationships', direction: 'bidirectional' }],
    },
  },
  edgeTypes: {
    'crm.relationship': {
      type: 'crm.relationship',
      label: 'Relationship',
      defaultData: { strength: 'normal' },
    },
  },
});
```

Type names should be namespaced by the consuming project, such as `workflow.task`, `crm.contact`, or `infra.service`.

## Render Types

`GraphCanvas` accepts renderer maps keyed by node type:

```tsx
<GraphCanvas
  document={document}
  nodeRenderers={{
    'crm.contact': ContactNode,
  }}
/>
```

Custom renderers receive a generic `GraphNode`. Projects can narrow `node.data` inside their own wrapper code.

Renderer props also include editor state and deletion hooks:

- `readOnly`: hide editing controls when true.
- `onRemove`: remove the node from the graph document. Project wrappers can customize the deletion behavior with
  `GraphCanvas`'s `onRemoveNode` prop.

## Inspect Types

Use `nodeInspectors`, `edgeInspectors`, or `renderInspector` to provide project-specific editing panels. Inspector
renderers receive the selected graph item, the active document, read-only state, and generic update callbacks:

- `onUpdateNode(nextNode)`
- `onUpdateEdge(nextEdge)`
- `onUpdateDocument(nextDocument)`

Domain wrappers should translate their own form controls into these generic graph updates, then apply domain conversion
in their adapter layer.

## Validate Types

Descriptors can include validation functions. Definition-level validators can enforce cross-node rules, such as missing
required edges or invalid cycles.
