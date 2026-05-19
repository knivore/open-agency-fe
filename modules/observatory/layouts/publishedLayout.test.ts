import { describe, expect, it } from 'vitest';

import furnitureManifest from '@/modules/observatory/assets/furnitures/furniture-manifest.generated.json';
import { validateObservatoryLayout } from '@/modules/observatory/engine/world/layoutValidation';
import publishedLayout from '@/modules/observatory/layouts/publishedLayout.json';

const removedAssetPatterns = [
  /^decor:(runtime-screens|runtime-server|coffee-loop|thinking-emote)$/u,
  /^generated:animations/u,
  /^furniture:(12|13|16|19|2-|23|5-)/u,
  /^floor:office-floors-2:/u,
];

describe('observatory pixel repo published layout', () => {
  it('is a valid published layout document', () => {
    const validation = validateObservatoryLayout(publishedLayout);

    expect(validation.issues).toEqual([]);
    expect(validation.layout?.metadata?.status).toBe('published');
    expect(validation.layout?.metadata?.version).toBeGreaterThan(0);
    expect(validation.layout?.world.maps[0]?.rooms.length).toBeGreaterThan(0);
  });

  it('uses a compact 48px grid and lets the runtime camera fit the viewer target', () => {
    const validation = validateObservatoryLayout(publishedLayout);
    const layout = validation.layout;

    expect(layout?.world.grid.tileSize).toBe(48);
    expect(layout?.world.grid.size).toEqual({ height: 17, width: 27 });
    expect(
      layout?.world.maps.map((map) => ({
        heightPx: map.size.height * layout.world.grid.tileSize,
        id: map.id,
        widthPx: map.size.width * layout.world.grid.tileSize,
      })),
    ).toEqual([
      { heightPx: 816, id: 'map:level-1', widthPx: 1296 },
    ]);
  });

  it('keeps each compact floor connected through a corridor room', () => {
    const validation = validateObservatoryLayout(publishedLayout);
    const maps = validation.layout?.world.maps ?? [];

    expect(maps.every((map) => map.rooms.some((room) => room.id.includes('corridor')))).toBe(true);
    expect(maps.every((map) => map.rooms.every((room) => room.bounds.x + room.bounds.width <= map.size.width))).toBe(true);
    expect(maps.every((map) => map.rooms.every((room) => room.bounds.y + room.bounds.height <= map.size.height))).toBe(true);
  });

  it('references furniture assets that exist in the generated office furniture manifest', () => {
    const validation = validateObservatoryLayout(publishedLayout);
    const furnitureAssetIds = new Set(furnitureManifest.assets.map((asset) => asset.id));
    const furnitureReferences =
      validation.layout?.world.maps.flatMap((map) =>
        map.objects
          .map((object) => object.assetId)
          .filter((assetId) => assetId.startsWith('furniture:')),
      ) ?? [];

    expect(furnitureManifest.folders.map((folder) => folder.path)).toEqual([
      '1_Modern_Office_Singles_48x48',
    ]);
    expect(furnitureReferences.length).toBeGreaterThan(0);
    expect(furnitureReferences.filter((assetId) => !furnitureAssetIds.has(assetId))).toEqual([]);
  });

  it('does not reference removed animation, extra character, second floor, or non-office furniture assets', () => {
    const validation = validateObservatoryLayout(publishedLayout);
    const assetIds =
      validation.layout?.world.maps.flatMap((map) => [
        map.defaultFloorAssetId,
        ...map.rooms.flatMap((room) => [room.floorAssetId, room.wallAssetId]),
        ...map.objects.map((object) => object.assetId),
        ...map.agents.map((agent) => agent.assetId),
      ]) ?? [];

    const definedAssetIds = assetIds.filter((assetId): assetId is string => Boolean(assetId));

    expect(
      definedAssetIds.filter((assetId) =>
        removedAssetPatterns.some((pattern) => pattern.test(assetId)),
      ),
    ).toEqual([]);
  });
});
