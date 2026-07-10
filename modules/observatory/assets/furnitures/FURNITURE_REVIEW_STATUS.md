# Open Agency Observatory Furniture Review Status

The open-source Observatory furniture inventory contains **339 redistributable PNG assets** from:

- `1_Modern_Office_Singles_48x48`

Generated metadata:

- `furniture-manifest.generated.json`: 339 assets
- `1_Modern_Office_Singles_48x48/manifest.generated.json`: 339 assets
- `furniture-review-map.json`: 339 retained reviews

No paid or private furniture pack may be copied into this repository or referenced by its
manifests, runtime imports, layouts, tests, or generated catalogs.

## Regeneration

From the `open-agency-fe` repository root:

```bash
node modules/observatory/scripts/generate-furniture-manifest.mjs
node modules/observatory/scripts/generate-asset-catalog.mjs > modules/observatory/engine/assets/catalog.generated.json
node modules/observatory/scripts/generate-asset-catalog.mjs --registry-candidates-json > modules/observatory/engine/assets/registryCandidates.generated.json
node modules/observatory/scripts/generate-asset-catalog.mjs --typescript > modules/observatory/engine/assets/assetCatalog.ts
node modules/observatory/scripts/generate-asset-catalog.mjs --typescript-registry > modules/observatory/engine/assets/generatedAssetRegistry.ts
```

Run the Observatory asset tests after every inventory or metadata change.
