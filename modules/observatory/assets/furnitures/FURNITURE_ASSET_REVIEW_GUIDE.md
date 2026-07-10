# Open Agency Furniture Asset Review Guide

This directory is the redistributable furniture boundary for Open Agency Observatory.

## Policy

- Review and catalog only files committed to this repository.
- Never copy paid/private assets or their generated metadata from another repository.
- A review record must resolve through either `sourcePath` or `originalPath` to a PNG in the
  tracked Open Agency furniture inventory.
- Generated manifests must contain no missing paths.
- Curated runtime imports must be a subset of the generated manifest.

## Current Pack

The open distribution currently contains the reviewed
`1_Modern_Office_Singles_48x48` pack. Its renamed PNG files, review records, and generated
manifest are the source of truth for the public builder palette and runtime office layouts.

## Adding Redistributable Assets

1. Confirm that redistribution is permitted and record provenance outside the raster filename.
2. Add PNGs below a clearly named pack folder in this directory.
3. Add or update review records in `furniture-review-map.json`.
4. Regenerate furniture and Observatory catalog artifacts.
5. Run the asset registry and published-layout tests.
6. Confirm every generated path exists and no untracked/private directory name appears.

## Regeneration

```bash
node modules/observatory/scripts/generate-furniture-manifest.mjs
node modules/observatory/scripts/generate-asset-catalog.mjs > modules/observatory/engine/assets/catalog.generated.json
node modules/observatory/scripts/generate-asset-catalog.mjs --registry-candidates-json > modules/observatory/engine/assets/registryCandidates.generated.json
node modules/observatory/scripts/generate-asset-catalog.mjs --typescript > modules/observatory/engine/assets/assetCatalog.ts
node modules/observatory/scripts/generate-asset-catalog.mjs --typescript-registry > modules/observatory/engine/assets/generatedAssetRegistry.ts
```

The generated JSON catalog is the single inventory source. `assetCatalog.ts` intentionally
wraps that JSON rather than duplicating the catalog in the frontend bundle.
