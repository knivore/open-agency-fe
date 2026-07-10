# Sigma Graph Module

`modules/sigma-graph` is the read-only large graph visualization boundary for memory associations, entity relationships,
document provenance, temporal relationships, operational graph exploration, and constellation-style 2D/3D graph views.

It is intentionally separate from `modules/react-flow-graph`.

- `modules/react-flow-graph` remains the React Flow workflow editing foundation.
- `modules/sigma-graph` is for renderer-neutral graph documents, Sigma.js visualization, 3D force-graph visualization,
  traversal, filtering, clustering, playback, and optional realtime deltas.

## Boundary

The module does not import Agency workflow code, Next.js routes, API clients, or React Flow.

Agency-specific code should adapt backend graph DTOs into `SigmaGraphDocument` through `graphReadDtoAdapter` or a
project-local adapter.

## Public Areas

- `types.ts`: renderer-neutral graph document, delta, filter, layout, realtime, and plugin contracts.
- `normalize.ts`: document normalization and safety checks.
- `store.ts`: framework-agnostic controller/store.
- `filters.ts`: graph filtering helpers.
- `clustering.ts`: cluster derivation.
- `temporal.ts`: temporal graph windowing.
- `layout.ts`: layout engine abstraction and basic circle layout.
- `realtime.ts`: WebSocket delta adapter contract.
- `SigmaGraphCanvas.tsx`: 2D Sigma.js constellation renderer boundary.
- `ForceGraph3DCanvas.tsx`: 3D force-graph constellation renderer boundary with orbit/reset camera behavior.
- `adapters/graphReadDto.ts`: neutral backend `nodes/edges/meta` DTO adapter.

## Minimal Usage

```tsx
'use client';

import SigmaGraphCanvas from '@/modules/sigma-graph/SigmaGraphCanvas';
import { graphReadDtoToSigmaGraph } from '@/modules/sigma-graph/adapters/graphReadDto';

export function AgencyGraphExample({ response }: { response: unknown }) {
  const document = graphReadDtoToSigmaGraph(response as never);
  return <SigmaGraphCanvas document={document} className="h-160 w-full" />;
}
```

Do not use this module to edit workflows. Workflow editing stays in React Flow.

Agency-specific controls, filters, diagnostics, and inspector copy should stay outside this module. The module should
accept `SigmaGraphDocument` input and renderer options, then leave product decisions to callers such as
`components/agency-graph/AgencyGraphPanel.tsx`.
