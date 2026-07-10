# Graph Module Boundary

`modules/react-flow-graph` is designed to be lifted into another React project with minimal changes. Keep this boundary
strict so the module remains reusable.

## Allowed

- Generic TypeScript types for graph documents, nodes, edges, ports, runtime events, descriptors, and validation.
- Renderer-agnostic graph utilities.
- Optional UI wrappers in later phases, as long as project-specific UI stays outside the core.
- Adapter interfaces that let projects map their own data into graph documents.
- Documentation and examples that explain project integration.

## Not Allowed

- Imports from workflow components.
- Imports from workflow API clients.
- Imports from app routes or Next.js route handlers.
- Direct dependency on backend response shapes.
- Hardcoded workflow, agent, task, CRM, observability, or other domain-specific node types in the core module.
- Required AI extraction, enrichment, matching, or inference logic.

## Dependency Direction

Project code can import from `modules/react-flow-graph`.

`modules/react-flow-graph` must not import project code.

```txt
project adapter -> modules/react-flow-graph
workflow adapter -> modules/react-flow-graph
modules/react-flow-graph -/-> project adapter
modules/react-flow-graph -/-> workflow adapter
```

## Descriptor Model

Projects extend the module by registering descriptors:

- `GraphNodeTypeDescriptor`
- `GraphEdgeTypeDescriptor`
- document validators
- node validators
- edge validators
- render slot names
- inspector slot names

The core module stores `render` and `inspector` as slot references, not React components. This keeps Phase 1 portable
and leaves renderer binding to later UI layers.
