# Observatory

`observatory` is the isolated observability and visualization pixel module for Open Agency FE.
It renders agent/workflow/runtime activity as a Phaser-powered pixel office. It is a visual
surface only: it displays runtime state from Open Agency or external sources, but it must not
execute backend work itself.

This module is self-contained and should not depend on legacy rendering modules.

## What You Get

- Canvas-only runtime viewer for product pages.
- Developer builder for editing layouts, inspecting runtime state, and reviewing assets.
- Repo-backed published layout JSON for lift-and-shift use.
- Generated asset pipeline for hundreds of images.
- Runtime event contracts, reducers, replay helpers, and frontend-safe stream adapters.
- Curated pixel asset registry with generated fallbacks and reviewed overrides.

## Main Routes

- `/runs`: product/runtime viewer. This should stay clean and canvas-first.
- `/observatory/builder`: developer builder, manual layout editor, debug panels, asset review.
- `/observatory/embed`: compact read-only viewer for iframe/embed use.

The normal flow is: edit and debug in `/observatory/builder`, publish/export the layout, then
consume the published layout in `/runs` or `/observatory/embed`.

## Module Structure

```text
modules/observatory/
  app/                 React shell for viewer/builder composition
  assets/              Pixel art source assets
  components/          React panels, drawers, inspector, feed, canvas wrapper
  docs/                Architecture and implementation notes
  engine/              Phaser engine, rendering, layout, asset registry
  examples/            Template host examples
  generation/          Prompt/layout generation and procedural helpers
  integrations/        WebSocket/SSE/local SDK/platform adapters
  layouts/             Repo-backed published layouts
  marketplace/         Package/readiness metadata drafts
  runtime/             Event contracts, reducer, visual behavior mapping
  scripts/             Asset/layout/package maintenance scripts
  state/               Frontend store helpers
  index.ts             Public module barrel
```

## Use It In A Project

Import from the owning module files:

```ts
import ObservatoryRuntimeSurface from '@/modules/observatory/app/ObservatoryRuntimeSurface';
import { createObservatoryLocalSdkClient } from '@/modules/observatory/integrations/localSdkClient';
import { createObservatorySseAdapter } from '@/modules/observatory/integrations/sseAdapter';
import { createObservatoryWebSocketAdapter } from '@/modules/observatory/integrations/webSocketAdapter';
```

Mount a product viewer:

```tsx
<ObservatoryRuntimeSurface mode="viewer" readOnly />
```

Mount the developer builder:

```tsx
<ObservatoryRuntimeSurface mode="builder" />
```

Mount a compact embed:

```tsx
<ObservatoryRuntimeSurface compact mode="embed" readOnly />
```

Host requirements:

- `phaser` must be installed.
- The host must support PNG imports from `modules/observatory/assets`.
- Phaser components must run on the client.
- Keep runtime execution, privileged APIs, and backend jobs outside this module.

## Layout Workflow

The portable source of truth is:

```text
modules/observatory/layouts/publishedLayout.json
```

Builder workflow:

1. Open `/observatory/builder`.
2. Edit rooms, objects, agents, templates, and runtime preview state.
3. Use the builder publish button for quick browser-local verification.
4. Use `Export JSON` when the layout is ready for repo storage.
5. Save the exported layout into the repo:

```bash
node modules/observatory/scripts/save-layout-to-repo.mjs exported-layout.json
```

Check an exported layout without writing it:

```bash
node modules/observatory/scripts/save-layout-to-repo.mjs --check exported-layout.json
```

Runtime behavior:

- `/observatory/builder` uses browser-local draft storage first, then repo layout fallback.
- `/runs` and `/observatory/embed` use browser-local published storage first, then repo layout fallback.
- Commit `layouts/publishedLayout.json` when you want the layout to travel with the module.

## Asset Workflow

Do not review hundreds of images manually upfront. The module uses a staged asset pipeline.

Source assets live here:

```text
modules/observatory/assets/
```

Generated and curated asset metadata lives here:

```text
modules/observatory/engine/assets/assetCatalog.ts
modules/observatory/engine/assets/generatedAssetRegistry.ts
modules/observatory/engine/assets/catalog.generated.json
modules/observatory/engine/assets/registryCandidates.generated.json
modules/observatory/engine/assets/registry.overrides.json
modules/observatory/engine/assets/moduleAssetRegistry.ts
```

What each file does:

- `catalog.generated.json`: every raster file, dimensions, folder metadata, SHA-256 hash.
- `registryCandidates.generated.json`: generated category/frame/tag/review-priority guesses.
- `assetCatalog.ts`: TypeScript view of the generated catalog.
- `generatedAssetRegistry.ts`: TypeScript runtime registry candidates with imported asset URLs.

Reviewed furniture/decor images are now handled as cleaned 48px-ish single PNG packs under:

```text
modules/observatory/assets/furnitures/<pack-folder>/*.png
```

Generate the furniture manifest and VLM contact sheets:

```bash
/Users/kehchinleong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node modules/observatory/scripts/generate-furniture-manifest.mjs --contact-sheets
```

This writes:

```text
modules/observatory/assets/furnitures/furniture-manifest.generated.json
modules/observatory/assets/furnitures/<pack-folder>/manifest.generated.json
modules/observatory/assets/furnitures/_review/*.png
modules/observatory/assets/furnitures/_review/review-batches.generated.json
modules/observatory/assets/furnitures/_review/vlm-furniture-naming-prompt.md
```

The manifest also alpha-trims transparent padding. `sourceCrop` describes the visible pixels
inside the PNG, but it is not used to shrink the canvas render. The builder and runtime render
the full source image at its native pixel size. `footprintW` and `footprintH` are derived from
the full source dimensions with `ceil(width / 48)` and `ceil(height / 48)`, so a `96x144`
chair occupies `2 x 3` grid cells. Collision is the separate crop-derived grid rect: the
registry converts `sourceCrop` into `collision.width`, `collision.height`, and optional
`offsetX`/`offsetY`, so transparent padding and upper wall/decor pixels do not block movement.

For VLM/Codex naming, review each `_review/*.png` contact sheet and append reviewed names to:

```text
modules/observatory/assets/furnitures/furniture-review-map.json
```

Example review entry:

```json
{
  "sourcePath": "1_Modern_Office_Singles_48x48/Modern_Office_Singles_48x48_320.png",
  "reviewedFileName": "server-workbench-with-tools.png",
  "label": "Server Workbench With Tools",
  "category": "office",
  "semanticRole": "workbench",
  "tags": ["office", "server", "workbench", "tools"]
}
```

Apply reviewed filenames and regenerate manifests:

```bash
/Users/kehchinleong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node modules/observatory/scripts/generate-furniture-manifest.mjs --apply-renames
```

To review a single pack:

```bash
/Users/kehchinleong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node modules/observatory/scripts/generate-furniture-manifest.mjs --folder=1_Modern_Office_Singles_48x48 --contact-sheets
```

The canvas consumes `getObservatoryFullModuleAssetRegistry()` and filters it to the active map,
so layout-critical furniture can come from the generated manifest-backed registry without adding
each id to `moduleAssetRegistry.ts`. Keep `moduleAssetRegistry.ts` for hand-authored semantics,
animations, collision overrides, and stable curated aliases.

- `registry.overrides.json`: reviewed corrections and promotion notes.
- `moduleAssetRegistry.ts`: live curated registry entries with stable semantic IDs, collisions, animations, and
  character action metadata.

When adding or changing assets:

1. Put images under `modules/observatory/assets/<category>/`.
2. Regenerate all generated asset artifacts:

```bash
node modules/observatory/scripts/generate-asset-catalog.mjs --typescript > modules/observatory/engine/assets/assetCatalog.ts
node modules/observatory/scripts/generate-asset-catalog.mjs --typescript-registry > modules/observatory/engine/assets/generatedAssetRegistry.ts
node modules/observatory/scripts/generate-asset-catalog.mjs > modules/observatory/engine/assets/catalog.generated.json
node modules/observatory/scripts/generate-asset-catalog.mjs --registry-candidates-json > modules/observatory/engine/assets/registryCandidates.generated.json
```

3. Open `/observatory/builder`.
4. Open the Asset Pack debug drawer.
5. Review the high-priority queue first. It shows thumbnails, guessed frame size, frame count, semantic tags, and review
   reasons.
6. Promote only layout-critical assets into `registry.overrides.json`.
7. Add or update `moduleAssetRegistry.ts` only when the asset needs a stable ID or hand-authored metadata.

Promotion examples:

- A new runtime monitor needs exact animation frames: add an override and a curated `decor:*` entry.
- A chair becomes placeable in room templates: add a semantic `furniture:*` entry with collision metadata.
- A new character sheet should drive agent actions: add/verify character action metadata.
- A decorative asset not used by layouts can remain generated until needed.

After regenerating furniture assets, saved layout objects should keep `size` in grid cells based
on the full source image dimensions. Do not persist furniture `render.sourceCrop` in layout JSON;
that field crops the runtime sprite. If a layout stores `96x144` furniture, its object size should
be `{ "width": 2, "height": 3 }`, while pathing should rely on the asset registry collision.

## Runtime Events

Use runtime events to drive the visual state. The visualizer accepts events through:

- Local SDK: same frontend bundle.
- WebSocket adapter: direct browser stream.
- SSE adapter: server-sent event stream.
- Same-origin `postMessage`: `/observatory/embed` iframe previews.

Safety rules:

- Validate and normalize events before reducing visual state.
- Keep payloads bounded.
- Put platform-specific details in inert metadata.
- Do not render raw HTML from event messages.
- Do not execute commands from events.

See `docs/integration-guide.md`, `docs/streaming.md`, and `docs/event-model.md`.

## Verification

Run the module checks after layout, asset, or runtime changes:

```bash
node node_modules/vitest/vitest.mjs run modules/observatory
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js modules/observatory --ext .ts,.tsx
```

## Public API

The public entrypoint is:

```text
modules/observatory/index.ts
```

Prefer importing from the barrel instead of deep module paths. It exports:

- React surfaces: `ObservatoryRuntimeSurface`, `ObservatoryGameCanvas`, panels, feeds, source manager.
- Asset helpers: registry validation, generated inventory, review queue, pipeline summaries.
- Layout helpers: validation, persistence, editing, templates, prompt-to-layout helpers.
- Runtime helpers: event validation, normalizer, reducer, replay, visual state mapping.
- Inspector log helpers: agent, room, and object log query contracts with adapter-backed
  layout/runtime-context sources.
- Integration helpers: local SDK, WebSocket/SSE adapters, platform placeholders.

## Current Status

Observatory is source-ready inside `open-agency-fe`, but it remains an in-repo module. The `/runs`
inspector now reads backend-loaded run events/log previews through the same adapter contract
as layout/demo metadata. The repo-published layout uses a `48px` logical grid for 48x48
furniture assets and fits the `/runs` viewer through the Phaser camera. Remaining production work is mainly direct
backend
endpoint expansion and broader asset curation as assets become layout-critical.

## More Docs

- `docs/architecture.md`
- `docs/layout-model.md`
- `docs/asset-registry.md`
- `docs/runtime-visual-state.md`
- `docs/event-model.md`
- `docs/guardrails.md`
- `docs/integration-guide.md`
- `docs/streaming.md`
- `docs/embed.md`
