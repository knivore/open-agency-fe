# Public Types

The graph module centers on a small JSON-safe document model.

## GraphDocument

`GraphDocument` is the portable saved shape. New documents use `graph.document.v1`.

```ts
interface GraphDocument {
  schemaVersion: string;
  id?: string;
  title?: string;
  description?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  viewport?: GraphViewport;
  selection?: GraphSelection;
  metadata?: GraphJsonObject;
}
```

Projects should store domain-specific meaning in `metadata`, `node.data`, and `edge.data`.

## GraphNode

`GraphNode` is intentionally generic:

```ts
interface GraphNode {
  id: string;
  type: string;
  label: string;
  description?: string;
  position?: GraphPosition;
  size?: GraphSize;
  status?: string;
  data?: GraphJsonObject;
  style?: GraphVisualStyle;
  ports?: GraphPort[];
  capabilities?: string[];
  metadata?: GraphJsonObject;
}
```

The module only requires `id`, `type`, and `label`. Renderers can use the rest when available.

## GraphEdge

`GraphEdge` connects two nodes:

```ts
interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type: string;
  label?: string;
  status?: string;
  data?: GraphJsonObject;
  style?: GraphVisualStyle;
  metadata?: GraphJsonObject;
}
```

Edges should reference node IDs, not domain object IDs. Domain IDs can go into `edge.data`.

## Descriptors

`GraphNodeTypeDescriptor` and `GraphEdgeTypeDescriptor` register project-defined types. Descriptors can provide labels,
default data, ports, validation, and render slot names.

## Runtime Events

`GraphRuntimeEvent` is an overlay/event model. It is not part of the saved document unless a consuming app chooses to
persist it separately.

## Persistence Helpers

Use `parseGraphDocumentJson`, `stringifyGraphDocument`, and `migrateGraphDocument` for JSON import/export and schema
migration. These helpers do not depend on app routes or backend clients.
