# Graph Module

`modules/react-flow-graph` is a portable React graph foundation for reusable node-and-edge experiences. It owns generic
graph primitives and canvas behavior, while each consuming project owns the domain meaning through adapters, node types,
edge types, renderers, inspectors, validators, and runtime events.

Use this module when another project needs a graph UI without taking this app's workflow-specific code.

## What You Get

- Versioned graph document model.
- Generic node and edge types.
- Type registries through `createGraphDefinition`.
- A `GraphCanvas` wrapper around `@xyflow/react`.
- Controlled and uncontrolled canvas modes.
- Pan, zoom, fit view, selection, dragging, and node connection.
- Palette, toolbar, inspector, node renderer, and edge label extension points.
- Built-in validation for duplicate IDs, dangling edges, unsupported types, and custom validators.
- Import/export helpers for graph JSON.
- Runtime event overlays, replay controls, edge packets, payload badges, and event details.
- Layout, ID, normalization, persistence, and replay helpers.

## What Stays Outside

The module does not know what a task, agent, person, company, service, document, or workflow means.

Keep these in the consuming project:

- backend clients
- app routes
- domain state
- workflow, CRM, infrastructure, or knowledge-graph models
- API event transport
- save/import/export workflows for the app's domain data

Project code should map domain data into `GraphDocument`, then map graph edits back into domain data when needed.

## Dependencies

Install the graph renderer in the consuming project:

```bash
npm install @xyflow/react
```

This module imports the XYFlow stylesheet internally from `GraphCanvas.tsx`:

```ts
import '@xyflow/react/dist/style.css';
```

If a copied project has strict CSS import rules, move that import to the project's app shell or top-level stylesheet and
remove it from `GraphCanvas.tsx`.

The module also expects React and TypeScript. This repo uses Tailwind utility classes in the default canvas chrome, but
project-specific renderers can replace the visuals.

## Files To Copy

For lift-and-shift reuse, copy the whole module directory:

```text
modules/react-flow-graph/
```

Recommended additional reference:

```text
components/workflow/WorkflowGraphCanvas.tsx
```

The workflow adapter is not required by the module, but it shows how an application can map domain data into the generic
graph vocabulary and wire runtime replay into a production route.

If the target project does not use the `@/modules/react-flow-graph/*` path alias, update imports to a local alias or
relative path. The core module source is intentionally self-contained and uses module-local imports internally.

## Public API

Import from the module index:

```ts
import {
  createGraphId,
  createGraphEdgeId,
} from '@/modules/react-flow-graph/ids';
import { createGraphDefinition } from '@/modules/react-flow-graph/definition';
import GraphCanvas, {
  graphBuiltInToolbarActionIds,
} from '@/modules/react-flow-graph/GraphCanvas';
import { layoutGraphDocumentGrid } from '@/modules/react-flow-graph/layout';
import {
  parseGraphDocumentJson,
  stringifyGraphDocument,
} from '@/modules/react-flow-graph/persistence';
import { validateGraphDocument } from '@/modules/react-flow-graph/validation';
import type {
  GraphDocument,
  GraphEdge,
  GraphNode,
  GraphRuntimeEvent,
} from '@/modules/react-flow-graph/types';
```

Key exported areas:

- `types.ts`: graph document, node, edge, validation, runtime, toolbar, and descriptor types.
- `definition.ts`: `createGraphDefinition`.
- `GraphCanvas.tsx`: React canvas and renderer contracts.
- `validation.ts`: generic graph validation.
- `persistence.ts`: graph JSON parsing, normalization, migration, and stringifying.
- `runtime.ts`: runtime status projection and replay helpers.
- `layout.ts`: simple grid layout helper.
- `ids.ts`: stable ID helpers.
- `export.ts`: browser download helper for graph JSON.

## Minimal Graph

Use `GraphCanvas` with a plain `GraphDocument`.

```tsx
'use client';

import { useState } from 'react';
import GraphCanvas from '@/modules/react-flow-graph/GraphCanvas';
import type { GraphDocument } from '@/modules/react-flow-graph/types';

const initialDocument: GraphDocument = {
  schemaVersion: 'graph.document.v1',
  id: 'demo-graph',
  title: 'Demo Graph',
  nodes: [
    {
      id: 'source',
      type: 'item',
      label: 'Source',
      position: { x: 80, y: 120 },
    },
    {
      id: 'target',
      type: 'item',
      label: 'Target',
      position: { x: 420, y: 120 },
    },
  ],
  edges: [
    {
      id: 'source-to-target',
      source: 'source',
      target: 'target',
      type: 'link',
      label: 'Sends data',
    },
  ],
};

export function DemoGraph() {
  const [document, setDocument] = useState(initialDocument);

  return (
    <GraphCanvas
      document={document}
      className="h-130 w-full"
      onGraphChange={setDocument}
    />
  );
}
```

Use `document` for controlled mode. The parent owns state and persists changes.

Use `defaultDocument` for uncontrolled mode when the graph is only a local demo:

```tsx
<GraphCanvas defaultDocument={initialDocument} className="h-130 w-full" />
```

## Define Project Node And Edge Types

Use `createGraphDefinition` to define the graph vocabulary for a project.

```ts
import { createGraphDefinition } from '@/modules/react-flow-graph/definition';

export const projectGraph = createGraphDefinition({
  nodeTypes: {
    person: {
      type: 'person',
      label: 'Person',
      description: 'A person in the project graph.',
      defaultData: {
        title: '',
        email: '',
      },
      defaultPorts: [{ id: 'relationships', direction: 'bidirectional' }],
      validate: (node) =>
        node.label.trim()
          ? []
          : [
              {
                id: `${node.id}-missing-label`,
                severity: 'error',
                code: 'person.missingLabel',
                message: 'Person must have a name.',
                target: 'node',
                targetId: node.id,
              },
            ],
    },
    company: {
      type: 'company',
      label: 'Company',
      defaultData: {
        domain: '',
      },
    },
  },
  edgeTypes: {
    worksAt: {
      type: 'worksAt',
      label: 'Works at',
    },
    knows: {
      type: 'knows',
      label: 'Knows',
    },
  },
});
```

Then create documents through the definition:

```ts
const document = projectGraph.createDocument({
  id: 'people-map',
  title: 'People Map',
  nodes: [
    projectGraph.createNode({
      type: 'person',
      label: 'Ada Lovelace',
      position: { x: 80, y: 100 },
      data: { title: 'Engineer', email: 'ada@example.com' },
    }),
    projectGraph.createNode({
      type: 'company',
      label: 'Analytical Engines Ltd',
      position: { x: 420, y: 100 },
      data: { domain: 'engines.example' },
    }),
  ],
});
```

## Render Custom Nodes

Projects can render nodes without editing `modules/react-flow-graph`.

```tsx
import { Handle, Position } from '@xyflow/react';
import GraphCanvas, {
  type GraphNodeRendererProps,
} from '@/modules/react-flow-graph/GraphCanvas';

function PersonNode({
  node,
  selected,
  readOnly,
  runtimeEvent,
  onRemove,
}: GraphNodeRendererProps) {
  return (
    <div
      className={[
        'relative min-w-56 rounded-md border bg-white px-3 py-3 text-sm shadow-sm',
        selected ? 'border-sky-500 ring-2 ring-sky-100' : 'border-neutral-200',
      ].join(' ')}
    >
      {!readOnly && onRemove ? (
        <button
          type="button"
          aria-label={`Remove ${node.label}`}
          onClick={onRemove}
        >
          Remove
        </button>
      ) : null}
      <Handle type="target" position={Position.Left} />
      <div className="font-medium">{node.label}</div>
      {typeof node.data?.title === 'string' ? (
        <div className="text-xs text-neutral-500">{node.data.title}</div>
      ) : null}
      {runtimeEvent ? (
        <div className="mt-2 rounded border border-sky-200 bg-sky-50 px-2 py-1 text-xs">
          {runtimeEvent.type}
        </div>
      ) : null}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

<GraphCanvas
  document={document}
  nodeRenderers={{
    person: PersonNode,
  }}
/>;
```

`GraphNodeRendererProps` includes:

- `node`
- `selected`
- `readOnly`
- `runtimeEvent`
- `runtimeEventIsCurrent`
- `validationIssues`
- `onRemove`

## Render Custom Edge Labels

Edge labels are also project-controlled.

```tsx
<GraphCanvas
  document={document}
  edgeLabelRenderers={{
    worksAt: ({ edge, selected, onOpen }) => (
      <button
        type="button"
        className={
          selected ? 'rounded-full border px-2' : 'rounded-full border px-2'
        }
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
      >
        {edge.label ?? 'Works at'}
      </button>
    ),
  }}
/>
```

Use `onOpen` when an edge label should open a project drawer or inspector.

## Inspect And Edit

For the generic built-in inspector, pass `showInspector`.

```tsx
<GraphCanvas document={document} showInspector onGraphChange={setDocument} />
```

For project-specific inspectors:

```tsx
<GraphCanvas
  document={document}
  showInspector
  nodeInspectors={{
    person: ({ node, readOnly, onUpdateNode }) => (
      <form>
        <label>
          Name
          <input
            value={node.label}
            disabled={readOnly}
            onChange={(event) =>
              onUpdateNode({
                ...node,
                label: event.target.value,
              })
            }
          />
        </label>
      </form>
    ),
  }}
/>
```

Many apps will prefer an external drawer instead of the built-in inspector. Use `onNodeOpen`, `onEdgeOpen`, and
`onSelectionChange` for that.

```tsx
<GraphCanvas
  document={document}
  onNodeOpen={(node) => setDrawer({ type: 'node', node })}
  onEdgeOpen={(edge) => setDrawer({ type: 'edge', edge })}
/>
```

## Add Palette And Toolbar Actions

Palette items create generic nodes. Toolbar actions can use built-in graph actions or project actions.

```tsx
import { graphBuiltInToolbarActionIds } from '@/modules/react-flow-graph/GraphCanvas';
import type { GraphToolbarAction } from '@/modules/react-flow-graph/types';

const toolbarActions: GraphToolbarAction[] = [
  {
    id: 'project.validate',
    label: 'Validate',
    description: 'Validate this project graph.',
  },
];

<GraphCanvas
  document={document}
  onGraphChange={setDocument}
  paletteItems={[
    {
      id: 'person',
      type: 'person',
      label: 'Person',
      defaultData: { title: '', email: '' },
    },
  ]}
  builtInToolbarActions={[
    graphBuiltInToolbarActionIds.addNode,
    graphBuiltInToolbarActionIds.autoLayout,
    graphBuiltInToolbarActionIds.fitView,
    graphBuiltInToolbarActionIds.undo,
    graphBuiltInToolbarActionIds.redo,
    graphBuiltInToolbarActionIds.export,
  ]}
  toolbarActions={toolbarActions}
  onToolbarAction={(action, currentDocument) => {
    if (action.id === 'project.validate') {
      console.log(projectGraph.validate(currentDocument));
    }
  }}
/>;
```

## Connect Nodes Safely

Use `onConnect` to decide whether a proposed edge is valid for the project.

```tsx
<GraphCanvas
  document={document}
  onGraphChange={setDocument}
  onConnect={(edge, currentDocument) => {
    const source = currentDocument.nodes.find(
      (node) => node.id === edge.source
    );
    const target = currentDocument.nodes.find(
      (node) => node.id === edge.target
    );

    if (source?.type === 'person' && target?.type === 'company') {
      return {
        ...edge,
        type: 'worksAt',
        label: 'Works at',
      };
    }

    return false;
  }}
/>
```

Return values:

- `GraphEdge`: accept the edge, possibly modified.
- `GraphDocument`: accept and replace the whole graph document.
- `false`: reject the connection.
- `void`: use the proposed edge as-is.

## Remove Nodes

Custom node renderers can call `onRemove` from `GraphNodeRendererProps`. By default this removes the node and any
connected edges from the graph document.

Projects that need domain-specific deletion can pass `onRemoveNode`:

```tsx
<GraphCanvas
  document={document}
  onGraphChange={setDocument}
  onRemoveNode={(node, currentDocument) => {
    const derivedNodeIds = new Set(
      currentDocument.nodes
        .filter((candidate) => candidate.metadata?.derivedFrom === node.id)
        .map((candidate) => candidate.id)
    );
    derivedNodeIds.add(node.id);

    return {
      ...currentDocument,
      nodes: currentDocument.nodes.filter(
        (candidate) => !derivedNodeIds.has(candidate.id)
      ),
      edges: currentDocument.edges.filter(
        (edge) =>
          !derivedNodeIds.has(edge.source) && !derivedNodeIds.has(edge.target)
      ),
    };
  }}
/>
```

Return `false` from `onRemoveNode` to reject deletion.

## Validate

Use generic validation directly:

```ts
const issues = validateGraphDocument(document, {
  nodeTypes: projectGraph.nodeTypes,
  edgeTypes: projectGraph.edgeTypes,
});
```

Or validate through a definition:

```ts
const issues = projectGraph.validate(document);
```

Pass validation issues to the canvas:

```tsx
<GraphCanvas document={document} validationIssues={issues} />
```

The canvas highlights invalid nodes and edges and shows a compact issue panel.

## Persist And Restore

Graph JSON is versioned.

```ts
import {
  parseGraphDocumentJson,
  stringifyGraphDocument,
} from '@/modules/react-flow-graph/persistence';
import type { GraphDocument } from '@/modules/react-flow-graph/types';

const json = stringifyGraphDocument(document);
localStorage.setItem('project.graph', json);

const restored: GraphDocument = parseGraphDocumentJson(
  localStorage.getItem('project.graph') ?? ''
);
```

For app-level data, prefer saving the app's domain object and using an adapter to rebuild `GraphDocument`. Store graph
positions or graph metadata in the domain object only where the app needs them.

## Runtime Events And Replay

Runtime events are transient overlays. They should not be copied into saved graph documents.

```tsx
import type { GraphRuntimeEvent } from '@/modules/react-flow-graph/types';

const events: GraphRuntimeEvent[] = [
  {
    id: 'event-1',
    type: 'person.enriched',
    timestamp: '2026-05-21T00:00:00.000Z',
    nodeId: 'person-1',
    status: 'running',
    payload: {
      input: { source: 'crm' },
    },
  },
  {
    id: 'event-2',
    type: 'relationship.transmitted',
    timestamp: '2026-05-21T00:00:01.000Z',
    edgeId: 'person-1-company-1',
    status: 'transmitting',
    payload: {
      data: { confidence: 0.92 },
    },
  },
];

<GraphCanvas
  document={document}
  runtimeEvents={events}
  onRuntimeEventClick={(event) => {
    console.log(event);
  }}
/>;
```

Common node statuses:

- `idle`
- `queued`
- `running`
- `waiting`
- `succeeded`
- `failed`
- `skipped`

Common edge statuses:

- `inactive`
- `transmitting`
- `blocked`
- `completed`
- `failed`

The default canvas applies status styling, animated edge packets, payload badges, a runtime timeline, event details, and
replay controls.

Use runtime helpers for deterministic replay:

```ts
import {
  createGraphRuntimeTimeline,
  replayGraphRuntimeEvents,
} from '@/modules/react-flow-graph/runtime';

const timeline = createGraphRuntimeTimeline(events);
const replayedDocument = replayGraphRuntimeEvents(
  document,
  timeline,
  '2026-05-21T00:00:01.000Z'
);
```

## Build A Domain Adapter

Most real projects should not save raw graph documents as their primary data model. Instead, write an adapter.

Example domain model:

```ts
interface ProjectMap {
  id: string;
  name: string;
  people: Array<{
    id: string;
    name: string;
    title?: string;
    x?: number;
    y?: number;
  }>;
  companies: Array<{
    id: string;
    name: string;
    domain?: string;
    x?: number;
    y?: number;
  }>;
  relationships: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    type: string;
  }>;
}
```

Map domain data to graph:

```ts
import { createGraphEdgeId } from '@/modules/react-flow-graph/ids';
import type { GraphDocument } from '@/modules/react-flow-graph/types';

export function projectMapToGraph(project: ProjectMap): GraphDocument {
  return {
    schemaVersion: 'graph.document.v1',
    id: project.id,
    title: project.name,
    nodes: [
      ...project.people.map((person) => ({
        id: `person-${person.id}`,
        type: 'person',
        label: person.name,
        position: { x: person.x ?? 80, y: person.y ?? 80 },
        data: {
          personId: person.id,
          title: person.title ?? '',
        },
      })),
      ...project.companies.map((company) => ({
        id: `company-${company.id}`,
        type: 'company',
        label: company.name,
        position: { x: company.x ?? 420, y: company.y ?? 80 },
        data: {
          companyId: company.id,
          domain: company.domain ?? '',
        },
      })),
    ],
    edges: project.relationships.map((relationship) => ({
      id:
        relationship.id ||
        createGraphEdgeId({
          source: `person-${relationship.sourceId}`,
          target: `company-${relationship.targetId}`,
          type: relationship.type,
        }),
      source: `person-${relationship.sourceId}`,
      target: `company-${relationship.targetId}`,
      type: relationship.type,
      data: {
        relationshipId: relationship.id,
      },
    })),
  };
}
```

Map graph changes back to domain data:

```ts
export function applyGraphPositions(
  project: ProjectMap,
  graph: GraphDocument
): ProjectMap {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

  return {
    ...project,
    people: project.people.map((person) => {
      const node = nodeById.get(`person-${person.id}`);
      return {
        ...person,
        x: node?.position?.x ?? person.x,
        y: node?.position?.y ?? person.y,
      };
    }),
    companies: project.companies.map((company) => {
      const node = nodeById.get(`company-${company.id}`);
      return {
        ...company,
        x: node?.position?.x ?? company.x,
        y: node?.position?.y ?? company.y,
      };
    }),
  };
}
```

For full editing, also map created/deleted nodes and edges back into the domain model.

## Recommended Project Structure

In a consuming app:

```text
modules/react-flow-graph/                 # copied reusable module
lib/my-domain/graphAdapter.ts   # domain to GraphDocument mapping
components/my-domain/Graph.tsx  # GraphCanvas wrapper
components/my-domain/Node.tsx   # custom node renderer
components/my-domain/Drawer.tsx # domain inspector/drawer
```

Keep backend calls in app/domain code. Feed `GraphCanvas` with normalized documents and runtime events.

## Common Integration Checklist

1. Copy `modules/react-flow-graph`.
2. Install `@xyflow/react`.
3. Configure imports for the target project.
4. Add a domain graph definition with node and edge descriptors.
5. Write a domain adapter into `GraphDocument`.
6. Render `GraphCanvas` in controlled mode.
7. Decide which graph edits are allowed in `onConnect`, toolbar actions, and inspectors.
8. Persist domain data, not transient runtime overlays.
9. Normalize backend events into `GraphRuntimeEvent`.
10. Add tests for adapter round-trips, validation, and runtime projection.

## Deeper Docs

- `docs/types.md`: graph data contracts.
- `docs/adapters.md`: adapter responsibilities and patterns.
- `docs/custom-node-types.md`: custom types, renderers, inspectors, and validators.
- `docs/builder-ux.md`: palette, toolbar, keyboard shortcuts, and editor controls.
- `docs/runtime-events.md`: runtime overlays, replay, event contracts, and telemetry.
- `docs/styling.md`: styling hooks and renderer overrides.
- `docs/workflow-adapter.md`: reference adapter used by this app.
- `docs/boundary.md`: module boundary rules.
