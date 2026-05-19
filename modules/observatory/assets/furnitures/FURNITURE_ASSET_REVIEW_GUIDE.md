# Observatory Furniture Asset Review Guide

This folder is the source of truth for furniture and decoration sprites used by `modules/observatory`.

The goal of this workflow is to make raw sliced sprites usable in the builder/runtime by giving each image a stable semantic name, category, role, and tags. The generated registry then lets layouts reference meaningful assets such as `desk`, `monitor`, `whiteboard`, `server`, `chair`, `plant`, `counter`, or `water-dispenser` instead of anonymous sliced PNG names.

## Folder Structure

- `*_Singles_48x48/`: reviewed or pending furniture/decor PNG sprites, grouped by source pack.
- `_review/`: generated contact sheets and VLM prompt files for batch review.
- `furniture-review-map.json`: human/VLM-reviewed metadata and rename instructions.
- `furniture-manifest.generated.json`: generated manifest consumed by the asset registry.
- `*/manifest.generated.json`: generated per-pack manifests.
- `../../scripts/generate-furniture-manifest.mjs`: scans furniture folders, applies reviewed renames, writes manifests, and creates contact sheets.
- `../../scripts/generate-asset-catalog.mjs`: regenerates TypeScript/JSON asset catalogs and import registry.

Do not edit generated files by hand. Edit `furniture-review-map.json`, then regenerate.

## Supported Sheet Types

The current reviewed furniture library is built from already-sliced `48x48` furniture/decor singles. These are usually exported from RPG Maker MV style B/C/D/E furniture tilesheets.

For this module:

- Use one semantic folder per pack, for example `1_Modern_Office_Singles_48x48`.
- Keep each final asset as an individual PNG.
- A single asset can be larger than `48x48`; the manifest alpha-trims transparent padding into `sourceCrop`, but computes `footprintW` and `footprintH` from the full PNG dimensions.
- Runtime display uses the full source image at native pixel size. The grid footprint is only the occupied placement area: `ceil(width / 48)` by `ceil(height / 48)`.
- Collision is separate from display. The generated asset registry converts `sourceCrop` into a crop-derived collision rect with optional `offsetX` and `offsetY`, so transparent padding and high decorative pixels do not block movement.
- Prefer complete furniture objects over raw grid fragments. A long table should ideally be one full PNG if it is meant to be placed as one object.
- RPG Maker `B/C/D/E` sheets are object/decor sheets. Floors and walls are handled separately from this furniture review workflow.
- RPG Maker `A2` floor and `A4` wall autotiles need tile/autotile-specific logic and should not be mixed into this furniture manifest as normal decor unless intentionally extracted as static props.

If a new source is still a raw B/C/D/E sheet, first slice or export it into individual object PNGs. The current preferred state is a folder of object PNGs, not a large sheet.

## Review Record Schema

Add or update records in `furniture-review-map.json`.

```json
{
  "sourcePath": "1_Modern_Office_Singles_48x48/Modern_Office_Singles_48x48_118.png",
  "reviewedFileName": "compact-gray-laptop.png",
  "label": "Compact Gray Laptop",
  "category": "office",
  "semanticRole": "laptop",
  "tags": ["office", "laptop", "work-device"]
}
```

Fields:

- `sourcePath`: current relative path under `assets/furnitures`.
- `reviewedFileName`: lowercase kebab-case PNG name to apply.
- `label`: human-readable display name for the builder.
- `category`: broad grouping such as `office`, `seating`, `storage`, `pantry`, `planning`, `runtime`, `decor`, `architecture`, or `furniture`.
- `semanticRole`: specific behavior/layout role such as `desk`, `workstation`, `monitor`, `server`, `whiteboard`, `chair`, `table`, `cabinet`, `water-dispenser`, `plant`, `door`, or `partition`.
- `tags`: search/filter terms used by the builder and future procedural layout logic.
- `originalPath`: optional; the script fills this after renaming so future reruns can still match the original file.

Naming rules:

- Use boring, literal names.
- Use lowercase kebab-case filenames.
- End every `reviewedFileName` with `.png`.
- Avoid duplicate filenames inside the same folder. The script will suffix duplicates, but clean names are easier to maintain.
- If unsure, use generic but useful terms like `storage-unit`, `decor-object`, `wall-panel`, `small-table`, or `utility-prop`.
- Do not invent invisible properties. If a tiny sprite is ambiguous, name it conservatively.

## Step 1: Add New Furniture Images

1. Put the new PNG files inside a folder under `modules/observatory/assets/furnitures`.
2. Use a pack-style folder name, for example `27_New_Office_Pack_Singles_48x48`.
3. Keep image dimensions accurate. Most singles are `48x48`, but larger object PNGs are allowed.
4. Do not place new furniture images in `_review`; that folder is generated.

## Step 2: Generate Contact Sheets

From the repo root:

```bash
NODE=/Users/kehchinleong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
$NODE modules/observatory/scripts/generate-furniture-manifest.mjs --contact-sheets
```

This writes:

- `assets/furnitures/_review/*.page-001.png`
- `assets/furnitures/_review/review-batches.generated.json`
- `assets/furnitures/_review/vlm-furniture-naming-prompt.md`
- `assets/furnitures/furniture-manifest.generated.json`
- per-folder `manifest.generated.json`

The contact sheets show each sprite with an asset key and short index. Use these sheets for VLM review.

To regenerate only one folder:

```bash
$NODE modules/observatory/scripts/generate-furniture-manifest.mjs --contact-sheets --folder 27_New_Office_Pack_Singles_48x48
```

## Step 3: Perform VLM Review

Use the prompt in:

```text
modules/observatory/assets/furnitures/_review/vlm-furniture-naming-prompt.md
```

Give the VLM:

- The relevant contact sheet image.
- The matching batch entries from `_review/review-batches.generated.json`.
- The instruction to return JSON only in the review schema.

Ask the VLM to review one page at a time. Do not ask it to review thousands of images in one pass. Good batch size is one contact sheet page, usually up to 120 assets.

Recommended extra VLM instruction:

```text
Prioritize office-runtime useful assets: desks, monitors, computers, laptops, whiteboards, planning boards, chairs, tables, counters, plants, server racks, shelves, pantry objects, doors, partitions, and utility machines. Skip or use generic names for unclear novelty props.
```

## Step 4: Merge VLM Output Into `furniture-review-map.json`

Append the returned `reviews` into:

```text
modules/observatory/assets/furnitures/furniture-review-map.json
```

Before merging:

- Ensure `sourcePath` exists.
- Ensure `reviewedFileName` is unique enough and ends in `.png`.
- Ensure `category`, `semanticRole`, and `tags` are useful for search and layout behavior.
- Keep records that already have `originalPath`; do not remove it.

If multiple VLM reviewers work concurrently, split by pack or page and merge JSON carefully to avoid overwriting each other. The safest handoff is one reviewer per folder.

## Step 5: Apply Renames And Regenerate Manifests

After updating `furniture-review-map.json`, run:

```bash
NODE=/Users/kehchinleong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
$NODE modules/observatory/scripts/generate-furniture-manifest.mjs --apply-renames --contact-sheets
```

This will:

- Rename files according to `reviewedFileName`.
- Preserve `originalPath` in `furniture-review-map.json`.
- Update `sourcePath` to the renamed file.
- Regenerate `furniture-manifest.generated.json`.
- Regenerate per-folder manifests.
- Regenerate `_review` contact sheets.

## Step 6: Regenerate The Asset Registry

Run all generated catalog outputs:

```bash
NODE=/Users/kehchinleong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
$NODE modules/observatory/scripts/generate-asset-catalog.mjs --typescript > modules/observatory/engine/assets/assetCatalog.ts
$NODE modules/observatory/scripts/generate-asset-catalog.mjs --typescript-registry > modules/observatory/engine/assets/generatedAssetRegistry.ts
$NODE modules/observatory/scripts/generate-asset-catalog.mjs > modules/observatory/engine/assets/catalog.generated.json
$NODE modules/observatory/scripts/generate-asset-catalog.mjs --registry-candidates-json > modules/observatory/engine/assets/registryCandidates.generated.json
```

The builder/runtime reads generated assets through `generatedAssetRegistry.ts`, with furniture metadata joined from `furniture-manifest.generated.json`. For furniture PNGs:

- `width` and `height` remain the full PNG source dimensions.
- `footprintW` and `footprintH` are `ceil(width / 48)` and `ceil(height / 48)`.
- `previewCrop` uses `sourceCrop` so palette thumbnails can focus on visible pixels.
- Runtime canvas rendering uses the full image, not `sourceCrop`.
- `collision` is generated from `sourceCrop`, including `offsetX` and `offsetY` when the visible crop starts inside a later grid cell.

Example: a `96x144` chair with `sourceCrop: { x: 0, y: 75, width: 48, height: 63 }` displays as `2 x 3` grid cells, while collision becomes `{ width: 1, height: 2, offsetY: 1 }`.

## Step 7: Verify

Run TypeScript:

```bash
NODE=/Users/kehchinleong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
$NODE node_modules/typescript/bin/tsc --noEmit
```

Verify generated furniture footprints, registry candidates, layout sizes, and runtime crop usage:

```bash
NODE=/Users/kehchinleong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
$NODE - <<'NODE'
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('modules/observatory/assets/furnitures/furniture-manifest.generated.json', 'utf8'));
const candidates = JSON.parse(fs.readFileSync('modules/observatory/engine/assets/registryCandidates.generated.json', 'utf8'));
const candidateByPath = new Map(candidates.candidates.map((candidate) => [candidate.catalogPath, candidate]));
const sizeByAssetId = new Map(manifest.assets.map((asset) => [asset.id, {
  height: Math.max(1, Math.ceil(asset.height / 48)),
  width: Math.max(1, Math.ceil(asset.width / 48)),
}]));
const manifestErrors = [];
const candidateErrors = [];

for (const asset of manifest.assets) {
  const expected = sizeByAssetId.get(asset.id);
  if (asset.footprintH !== expected.height || asset.footprintW !== expected.width) {
    manifestErrors.push(asset.id);
  }

  const candidate = candidateByPath.get(`furnitures/${asset.path}`);
  if (!candidate || candidate.width !== asset.width || candidate.height !== asset.height) {
    candidateErrors.push(asset.id);
  }
}

const layoutPaths = [
  'modules/observatory/layouts/publishedLayout.json',
  'modules/observatory/layouts/library/default-observatory-agency-office.json',
  'modules/observatory/layouts/library/default-observatory-agency-office-2.json',
  'modules/observatory/layouts/library/default-observatory-agency-office-3.json',
];
const layoutErrors = [];
const cropErrors = [];

for (const relative of layoutPaths) {
  const layout = JSON.parse(fs.readFileSync(relative, 'utf8'));
  for (const map of layout.world?.maps ?? []) {
    for (const object of map.objects ?? []) {
      const expected = sizeByAssetId.get(object.assetId);
      if (!expected) continue;
      if (object.size?.width !== expected.width || object.size?.height !== expected.height) {
        layoutErrors.push({ path: relative, id: object.id });
      }
      if (object.render?.sourceCrop) {
        cropErrors.push({ path: relative, id: object.id });
      }
    }
  }
}

console.log({
  furnitureAssetsChecked: manifest.assets.length,
  manifestErrorCount: manifestErrors.length,
  candidateErrorCount: candidateErrors.length,
  layoutErrorCount: layoutErrors.length,
  runtimeFurnitureCropCount: cropErrors.length,
});
NODE
```

Run focused observatory tests:

```bash
$NODE node_modules/vitest/vitest.mjs run \
  modules/observatory/engine/assets/assetRegistry.test.ts \
  modules/observatory/engine/world/layoutEditing.test.ts \
  modules/observatory/engine/world/layoutPersistence.test.ts \
  modules/observatory/generation/proceduralLayoutRules.test.ts \
  modules/observatory/runtime/inspectionLogs.test.ts \
  modules/observatory/runtime/visualBehaviorMapping.test.ts \
  modules/observatory/engine/rendering/sceneInteractionControls.test.ts
```

If the full Vitest run fails with `ENOSPC`, the macOS temp volume is probably low on disk space. Rerun the failed suite individually after freeing space.

## Useful Coverage Command

Use this to see reviewed vs pending by pack:

```bash
NODE=/Users/kehchinleong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
$NODE - <<'NODE'
const manifest=require('./modules/observatory/assets/furnitures/furniture-manifest.generated.json');
const review=require('./modules/observatory/assets/furnitures/furniture-review-map.json');
const reviewed=new Set(review.reviews.flatMap((r)=>[r.sourcePath,r.originalPath].filter(Boolean)));
for (const folder of manifest.folders) {
  const assets=manifest.assets.filter((a)=>a.path.startsWith(`${folder.path}/`));
  const count=assets.filter((a)=>reviewed.has(a.path)||reviewed.has(a.source.path)).length;
  console.log(`${count}/${assets.length} ${folder.name} (${folder.path})`);
}
NODE
```

## Common Mistakes

- Do not manually edit generated manifests or generated TypeScript registry files.
- Do not put raw floor/wall autotiles into this furniture registry unless extracted as normal objects.
- Do not rename PNG files manually without updating `furniture-review-map.json`.
- Do not compute furniture footprints from `sourceCrop`; footprints are full-source image dimensions divided by the `48px` grid.
- Do not keep furniture `render.sourceCrop` in layout JSON unless you intentionally want to crop the runtime sprite.
- Do not remove `originalPath` after a rename; it keeps historical matching stable.
- Do not overfit labels. `gray-storage-cabinet` is better than a confident but wrong label.
