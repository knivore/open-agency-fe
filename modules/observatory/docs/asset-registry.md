# Asset Registry

Observatory uses a versioned asset registry for pixel engine assets.

## Current Scope

The live module registry is built from an asset pipeline:

- `engine/assets/catalog.generated.json` inventories every raster asset with dimensions,
  directory, filename, extension, and SHA-256.
- `engine/assets/registryCandidates.generated.json` stores generated registry candidates
  with guessed category, frame geometry, semantic tags, and review priority.
- `engine/assets/registry.overrides.json` records human-reviewed corrections for high-value
  assets.
- `engine/assets/generatedAssetRegistry.ts` and `engine/assets/assetCatalog.ts` are the
  TypeScript runtime views generated from the same source files.

Reviewed curated entries take precedence for sample-map floors, walls, furniture, decor,
and character action sheets. Phaser preload still filters to the current map's required
assets so the full registry does not force all files into a scene.

Supported MVP categories:

- `floor`
- `wall`
- `furniture`
- `decor`
- `human`

Reviewed RPG Maker-style autotile sheets can also declare `autotile` metadata. Current
supported kinds:

- `rpgmaker-a2-ground`: A2 ground/floor sheets. Local sheets are `16 x 12` cells at `32px`
  per cell, where each ground set is a `2 x 3` block.
- `rpgmaker-a4-wall`: A4 wall sheets. Local sheets are `16 x 15` cells at `32px` per cell,
  where each wall set is a `2 x 5` block.

Supported source kinds:

- `image`
- `spritesheet`

## Furniture Footprint And Collision

Generated furniture entries join the raster catalog with
`assets/furnitures/furniture-manifest.generated.json`.

Furniture display and collision are intentionally different:

- Display uses the full PNG source dimensions. A `96x144` source image renders at `96x144`
  pixels and occupies `ceil(96 / 48) x ceil(144 / 48)`, or `2 x 3`, grid cells in layouts.
- `previewCrop` uses manifest `sourceCrop` only for palette thumbnails and focused previews.
- Collision uses manifest `sourceCrop`, converted to grid cells with optional `offsetX` and
  `offsetY`. For example, a chair whose visible pixels start around `y:75` can display as
  `2 x 3` but collide as `{ width: 1, height: 2, offsetY: 1 }`.

Layout JSON should store furniture `size` from full source dimensions, not crop dimensions. It
should not store furniture `render.sourceCrop`, because the renderer treats that as an explicit
runtime crop.

## Validation Rules

- `registryVersion` must match the supported registry version.
- `assetPackVersion` must be a non-empty string.
- Asset IDs must use lowercase letters, numbers, colon, or dash.
- `catalogPath` links generated and curated registry entries back to asset-pack files.
- Asset categories must be known.
- Source URIs must be non-empty and bounded.
- Sprite sheets must define positive `frameWidth` and `frameHeight`.
- A2/A4 autotile metadata must define positive `tileSize`, `columns`, and a valid source set.
- Generated catalog entries must keep stable SHA-256 hashes and path metadata.
- Duplicate asset IDs are skipped.

Invalid entries are reported and skipped. They must not crash the Phaser preload path.

## Review Workflow

Use the retained office-focused asset set as the source of truth. The normal flow is:

1. Add or replace files under `modules/observatory/assets`.
2. Run `node modules/observatory/scripts/generate-asset-catalog.mjs` with the needed output
   mode to refresh generated JSON/TS artifacts.
3. Open the builder Asset Pack debug drawer and inspect the high-priority review queue.
4. Promote only assets needed by current layouts or runtime behavior into
   `registry.overrides.json`.
5. Add or update the corresponding curated runtime entry in `moduleAssetRegistry.ts` only when
   that asset needs a stable semantic ID, collision, action manifest, or hand-corrected frame
   geometry.

## Fallback

The engine creates a generated checkerboard fallback texture under
`observatory:fallback-texture`. Later rendering phases should use this key when a layout
references an asset that is missing or failed to load.
