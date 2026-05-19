# Observatory Furniture Review Status

Last updated: 2026-05-11.

This file tracks VLM/human review progress for `modules/observatory/assets/furnitures`. Update it whenever a pack is reviewed and regenerated.

## Summary

- Total furniture assets: `5,635`
- Reviewed manifest assets: `5,635`
- Pending assets: `0`
- Current source of truth: `furniture-review-map.json`
- Generated manifest: `furniture-manifest.generated.json`
- Contact sheets: `_review/*.png`

## Review Progress By Pack

| Status | Reviewed | Total | Pack | Folder |
| --- | ---: | ---: | --- | --- |
| Done | 556 | 556 | Bedroom | `4_Bedroom_Singles_48x48` |
| Done | 550 | 550 | Hospital | `19_Hospital_SIngles_48x48` |
| Done | 494 | 494 | Clothing Store | `21_Clothing_Store_Singles_48x48` |
| Done | 489 | 489 | Grocery Store | `16_Grocery_Store_Singles_48x48` |
| Done | 451 | 451 | Museum | `22_Museum_Singles_48x48` |
| Done | 408 | 408 | Kitchen | `12_Kitchen_Singles_48x48` |
| Done | 344 | 344 | Jail | `18_Jail_Singles_48x48` |
| Done | 339 | 339 | Modern Office | `1_Modern_Office_Singles_48x48` |
| Done | 246 | 246 | Basement | `14_Basement_Singles_48x48` |
| Done | 240 | 240 | Halloween | `11_Halloween_Singles_48x48` |
| Done | 209 | 209 | Gym | `8_Gym_Singles_48x48` |
| Done | 164 | 164 | Music And Sport | `6_Music_and_Sport_48x48` |
| Done | 159 | 159 | Bathroom | `3_Bathroom_Singles_48x48` |
| Done | 133 | 133 | Japanese Interiors | `20_Japanese_Interiors_48x48` |
| Done | 123 | 123 | Christmas | `15_Christmas_Singles_48x48` |
| Done | 122 | 122 | Living Room | `2_Living_Room_Singles_48x48` |
| Done | 102 | 102 | Ice Cream Shop | `24_Ice_Cream_Shop_Singles_48x48` |
| Done | 86 | 86 | Condominium | `26_Condominium_Singles_48x48` |
| Done | 80 | 80 | Television And Film Studio | `23_Television_and_Film_Studio_SIngles_48x48` |
| Done | 77 | 77 | Fishing | `9_Fishing_Singles_48x48` |
| Done | 75 | 75 | Classroom And Library | `5_Classroom_and_Library_Singles_48x48` |
| Done | 68 | 68 | Conference Hall | `13_Conference_Hall_Singles_48x48` |
| Done | 46 | 46 | Art | `7_Art_Singles_48x48` |
| Done | 46 | 46 | Birthday Party | `10_Birthday_Party_Singles_48x48` |
| Done | 28 | 28 | Shooting Range | `25_Shooting_Range_Singles_48x48` |

## Completed Packs

- `22_Museum_Singles_48x48`
- `1_Modern_Office_Singles_48x48`
- `14_Basement_Singles_48x48`
- `20_Japanese_Interiors_48x48`
- `2_Living_Room_Singles_48x48`
- `5_Classroom_and_Library_Singles_48x48`
- `13_Conference_Hall_Singles_48x48`
- `12_Kitchen_Singles_48x48`
- `16_Grocery_Store_Singles_48x48`
- `19_Hospital_SIngles_48x48`
- `24_Ice_Cream_Shop_Singles_48x48`
- `26_Condominium_Singles_48x48`
- `23_Television_and_Film_Studio_SIngles_48x48`
- `4_Bedroom_Singles_48x48`
- `21_Clothing_Store_Singles_48x48`
- `18_Jail_Singles_48x48`
- `11_Halloween_Singles_48x48`
- `8_Gym_Singles_48x48`
- `6_Music_and_Sport_48x48`
- `3_Bathroom_Singles_48x48`
- `15_Christmas_Singles_48x48`
- `9_Fishing_Singles_48x48`
- `7_Art_Singles_48x48`
- `10_Birthday_Party_Singles_48x48`
- `25_Shooting_Range_Singles_48x48`

## Current Best Packs For Office Layouts

These packs already contain useful assets for office/runtime visualization:

- `1_Modern_Office_Singles_48x48`: desks, laptops, monitors, servers, whiteboards, planning props.
- `14_Basement_Singles_48x48`: storage, partitions, counters, monitors, utility machines, lounge chairs, doors, racks.
- `2_Living_Room_Singles_48x48`: sofas, plants, sideboards, cabinets, tables.
- `20_Japanese_Interiors_48x48`: partitions, seating, tables, decor props.
- `12_Kitchen_Singles_48x48`: pantry and utility props.
- `16_Grocery_Store_Singles_48x48`: shelves, carts, counters, display/storage props.
- `19_Hospital_SIngles_48x48`: utility machines, beds, screens, carts, clinical props.
- `5_Classroom_and_Library_Singles_48x48`: desks, bookshelves, classroom boards.
- `13_Conference_Hall_Singles_48x48`: meeting/conference props.

## Suggested Next Review Order

All packs now have review records and registry-ready semantic metadata.

Future work should focus on quality refinement rather than coverage:

1. Manually refine low-priority packs tagged with `low-priority-pack`, especially `Bedroom`, `Clothing Store`, `Jail`, `Halloween`, `Gym`, `Music And Sport`, `Bathroom`, `Christmas`, `Fishing`, `Art`, `Birthday Party`, and `Shooting Range`.
2. Replace broad family-level labels with exact labels only when a sprite becomes important to a layout.
3. Promote frequently used assets into curated layout presets after visual QA in the builder.

## Concurrent VLM Review Notes

Use pack-level ownership to avoid JSON merge conflicts:

- Reviewer A: Modern Office.
- Reviewer B: Classroom and Library plus Conference Hall.
- Reviewer C: Kitchen.
- Reviewer D: Grocery Store.
- Reviewer E: Hospital.

Each reviewer should return only `reviews` for their assigned folder/page. Merge into `furniture-review-map.json`, then run:

```bash
NODE=/Users/kehchinleong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
$NODE modules/observatory/scripts/generate-furniture-manifest.mjs --apply-renames --contact-sheets
$NODE modules/observatory/scripts/generate-asset-catalog.mjs --typescript > modules/observatory/engine/assets/assetCatalog.ts
$NODE modules/observatory/scripts/generate-asset-catalog.mjs --typescript-registry > modules/observatory/engine/assets/generatedAssetRegistry.ts
$NODE modules/observatory/scripts/generate-asset-catalog.mjs > modules/observatory/engine/assets/catalog.generated.json
$NODE modules/observatory/scripts/generate-asset-catalog.mjs --registry-candidates-json > modules/observatory/engine/assets/registryCandidates.generated.json
```

After generation, update this status file with the new counts.
