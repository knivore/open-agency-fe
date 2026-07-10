# Adapters

Adapters map project data into `GraphDocument` and back again. They should live in the consuming app, not in
`modules/react-flow-graph`.

## Responsibilities

An adapter should:

- register project-specific node and edge descriptors
- convert domain objects into graph nodes and edges
- preserve stable IDs for imported data
- translate graph edits back into domain objects
- translate generic graph validation into domain-specific messages

An adapter should not:

- import UI pages into `modules/react-flow-graph`
- make the graph module aware of workflow, CRM, infrastructure, or knowledge-graph semantics
- store backend transport details in the module

## Import Shape

```ts
export function projectToGraphDocument(project: Project): GraphDocument {
  return projectGraphDefinition.createDocument({
    id: project.id,
    title: project.name,
    nodes: project.items.map(itemToGraphNode),
    edges: project.links.map(linkToGraphEdge),
  });
}
```

## Export Shape

```ts
export function graphDocumentToProject(
  graph: GraphDocument,
  project: Project
): Project {
  return {
    ...project,
    items: project.items.map((item) => applyNodeEdits(item, graph)),
    links: graph.edges.map(graphEdgeToProjectLink),
  };
}
```

## Current App Adapter

This app uses `lib/workflows/workflowGraphAdapter.ts` for workflow definitions. That file is the reference pattern for
keeping workflow semantics outside the reusable module.
