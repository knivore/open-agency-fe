import { describe, expect, it } from 'vitest';

import { collectObservatoryMapAssetIds } from '@/modules/observatory/engine/assets/assetUsage';
import type { ObservatoryFurnitureManifestAsset } from '@/modules/observatory/engine/assets/furnitureManifest';
import { getObservatoryFullModuleAssetRegistry } from '@/modules/observatory/engine/assets/moduleFullAssetRegistry';
import { observatoryRoomInteriorBounds } from '@/modules/observatory/engine/rendering/agentBehaviorTargets';
import { validateObservatoryLayout } from '@/modules/observatory/engine/world/layoutValidation';
import type {
  ObservatoryMap,
  ObservatoryObject,
} from '@/modules/observatory/engine/world/layoutTypes';
import furnitureManifest from '@/modules/observatory/assets/furnitures/furniture-manifest.generated.json';
import defaultLibraryLayout from '@/modules/observatory/layouts/library/default-observatory-agency-office.json';
import publishedLayout from '@/modules/observatory/layouts/publishedLayout.json';

type ObservatoryFurnitureManifestFixture = {
  assets?: ObservatoryFurnitureManifestAsset[];
};

const typedFurnitureManifest = furnitureManifest as ObservatoryFurnitureManifestFixture;
const furniture = (semanticId: string) => `furniture:1-modern-office-singles-48x48:${semanticId}`;

function getPublishedLevel1Map(): ObservatoryMap {
  const validation = validateObservatoryLayout(publishedLayout);
  const map = validation.layout?.world.maps.find((candidate) => candidate.id === 'map:level-1');

  expect(map).toBeDefined();

  return map as ObservatoryMap;
}

function getObjectsByRoom(map: ObservatoryMap, roomId: string) {
  return map.objects.filter((object) => object.roomId === roomId);
}

describe('observatory pixel repo published layout', () => {
  it('is a valid published layout document', () => {
    const validation = validateObservatoryLayout(publishedLayout);

    expect(validation.issues).toEqual([]);
    expect(validation.layout?.metadata?.status).toBe('published');
    expect(validation.layout?.metadata?.version).toBeGreaterThan(0);
    expect(validation.layout?.world.maps[0]?.rooms.length).toBeGreaterThan(0);
  });

  it('uses layout footprints that match the verified animated decor geometry', () => {
    const validation = validateObservatoryLayout(publishedLayout);
    const objects = validation.layout?.world.maps.flatMap((map) => map.objects) ?? [];

    const screens = objects.filter((object) => object.assetId === 'decor:runtime-screens');
    const servers = objects.filter((object) => object.assetId === 'decor:runtime-server');
    const coffeeLoops = objects.filter((object) => object.assetId === 'decor:coffee-loop');

    expect(screens.length).toBeGreaterThan(0);
    expect(servers.length).toBeGreaterThan(0);
    expect(coffeeLoops.length).toBeGreaterThan(0);
    expect(screens.every((object) => object.size?.width === 4 && object.size?.height === 3)).toBe(
      true
    );
    expect(servers.every((object) => object.size?.width === 1 && object.size?.height === 3)).toBe(
      true
    );
    expect(
      coffeeLoops.every((object) => object.size?.width === 1 && object.size?.height === 2)
    ).toBe(true);
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
      }))
    ).toEqual([
      { heightPx: 816, id: 'map:level-1', widthPx: 1296 },
      { heightPx: 960, id: 'map:level-2', widthPx: 1536 },
    ]);
  });

  it('keeps each compact floor connected through a corridor room', () => {
    const validation = validateObservatoryLayout(publishedLayout);
    const maps = validation.layout?.world.maps ?? [];

    expect(maps.every((map) => map.rooms.some((room) => room.id.includes('corridor')))).toBe(true);
    expect(
      maps.every((map) =>
        map.rooms.every((room) => room.bounds.x + room.bounds.width <= map.size.width)
      )
    ).toBe(true);
    expect(
      maps.every((map) =>
        map.rooms.every((room) => room.bounds.y + room.bounds.height <= map.size.height)
      )
    ).toBe(true);
  });

  it('keeps default rooms connected wall-to-wall without dead grid gaps', () => {
    const validation = validateObservatoryLayout(publishedLayout);
    const mapsById = new Map((validation.layout?.world.maps ?? []).map((map) => [map.id, map]));
    const level1Rooms = new Map(mapsById.get('map:level-1')?.rooms.map((room) => [room.id, room]));
    const level2Rooms = new Map(mapsById.get('map:level-2')?.rooms.map((room) => [room.id, room]));
    const right = (
      roomId: string,
      rooms: Map<string, { bounds: { width: number; x: number } }>
    ) => {
      const room = rooms.get(roomId);
      return (room?.bounds.x ?? 0) + (room?.bounds.width ?? 0);
    };
    const bottom = (
      roomId: string,
      rooms: Map<string, { bounds: { height: number; y: number } }>
    ) => {
      const room = rooms.get(roomId);
      return (room?.bounds.y ?? 0) + (room?.bounds.height ?? 0);
    };

    expect(right('room:level-1-reception', level1Rooms)).toBe(
      level1Rooms.get('room:level-1-common-work')?.bounds.x
    );
    expect(right('room:level-1-common-work', level1Rooms)).toBe(
      level1Rooms.get('room:level-1-pantry')?.bounds.x
    );
    expect(bottom('room:level-1-reception', level1Rooms)).toBe(
      level1Rooms.get('room:level-1-west-corridor')?.bounds.y
    );
    expect(bottom('room:level-1-west-corridor', level1Rooms)).toBe(
      level1Rooms.get('room:level-1-corridor')?.bounds.y
    );
    expect(bottom('room:level-1-common-work', level1Rooms)).toBe(
      level1Rooms.get('room:level-1-corridor')?.bounds.y
    );
    expect(bottom('room:level-1-pantry', level1Rooms)).toBe(
      level1Rooms.get('room:level-1-planning-lounge')?.bounds.y
    );
    expect(right('room:level-1-runtime-lab', level1Rooms)).toBe(
      level1Rooms.get('room:level-1-corridor')?.bounds.x
    );
    expect(bottom('room:level-1-corridor', level1Rooms)).toBe(
      level1Rooms.get('room:level-1-executive')?.bounds.y
    );
    expect(right('room:level-1-runtime-lab', level1Rooms)).toBe(
      level1Rooms.get('room:level-1-executive')?.bounds.x
    );
    expect(right('room:level-1-executive', level1Rooms)).toBe(
      level1Rooms.get('room:level-1-planning-lounge')?.bounds.x
    );

    expect(right('room:level-2-medium-meeting', level2Rooms)).toBe(
      level2Rooms.get('room:level-2-small-meeting-a')?.bounds.x
    );
    expect(right('room:level-2-small-meeting-a', level2Rooms)).toBe(
      level2Rooms.get('room:level-2-small-meeting-b')?.bounds.x
    );
    expect(bottom('room:level-2-medium-meeting', level2Rooms)).toBe(
      level2Rooms.get('room:level-2-corridor')?.bounds.y
    );
    expect(bottom('room:level-2-small-meeting-a', level2Rooms)).toBe(
      level2Rooms.get('room:level-2-corridor')?.bounds.y
    );
    expect(bottom('room:level-2-small-meeting-b', level2Rooms)).toBe(
      level2Rooms.get('room:level-2-corridor')?.bounds.y
    );
    expect(bottom('room:level-2-corridor', level2Rooms)).toBe(
      level2Rooms.get('room:level-2-war-room')?.bounds.y
    );
    expect(right('room:level-2-war-room', level2Rooms)).toBe(
      level2Rooms.get('room:level-2-pantry')?.bounds.x
    );
  });

  it('references furniture assets that exist in the generated furniture manifest', () => {
    const validation = validateObservatoryLayout(publishedLayout);
    const furnitureAssetIds = new Set(
      (typedFurnitureManifest.assets ?? []).map((asset) => asset.id)
    );
    const furnitureReferences =
      validation.layout?.world.maps.flatMap((map) =>
        map.objects
          .map((object) => object.assetId)
          .filter((assetId) => assetId.startsWith('furniture:'))
      ) ?? [];

    expect(furnitureReferences.length).toBeGreaterThan(0);
    expect(furnitureReferences.filter((assetId) => !furnitureAssetIds.has(assetId))).toEqual([]);
  });

  it('references assets that are present in the runtime registry', () => {
    const assetIds = new Set(
      getObservatoryFullModuleAssetRegistry().assets.map((asset) => asset.id)
    );
    const layouts = [publishedLayout, defaultLibraryLayout];
    const missingReferences = layouts.flatMap((layout) => {
      const validation = validateObservatoryLayout(layout);
      const maps = validation.layout?.world.maps ?? [];

      return maps.flatMap((map) =>
        [...collectObservatoryMapAssetIds(map)]
          .filter((assetId) => !assetIds.has(assetId))
          .map((assetId) => `${layout.metadata.id}:${map.id}:${assetId}`)
      );
    });

    expect(missingReferences).toEqual([]);
  });

  it('selects furniture that matches each level-one room purpose', () => {
    const map = getPublishedLevel1Map();
    const pantryAssets = getObjectsByRoom(map, 'room:level-1-pantry').map(
      (object) => object.assetId
    );
    const loungeAssets = getObjectsByRoom(map, 'room:level-1-planning-lounge').map(
      (object) => object.assetId
    );
    const labAssets = getObjectsByRoom(map, 'room:level-1-runtime-lab').map(
      (object) => object.assetId
    );
    const receptionAssets = getObjectsByRoom(map, 'room:level-1-reception').map(
      (object) => object.assetId
    );

    expect(pantryAssets).toEqual(
      expect.arrayContaining([
        'decor:coffee-loop',
        furniture('modern-office-cream-office-counter-module-052'),
        furniture('modern-office-tall-cream-storage-cabinet'),
        furniture('office-water-cooler'),
      ])
    );
    expect(pantryAssets.some((assetId) => /printer|monitor|workstation|desk/.test(assetId))).toBe(
      false
    );

    expect(loungeAssets).toEqual(
      expect.arrayContaining([
        furniture('planning-whiteboard-chart'),
        furniture('modern-office-wide-beige-table-front'),
        furniture('modern-office-wide-beige-platform-with-drawer'),
      ])
    );
    expect(loungeAssets.some((assetId) => /monitor|workstation|wide-.*desk/.test(assetId))).toBe(
      false
    );

    expect(labAssets).toEqual(
      expect.arrayContaining([
        'decor:runtime-screens',
        'decor:runtime-server',
        furniture('server-workbench-with-tools'),
        furniture('tall-network-server-rack'),
      ])
    );
    expect(receptionAssets).toEqual(
      expect.arrayContaining([
        furniture('modern-office-low-wood-service-counter'),
        furniture('modern-office-desk-phone-handset'),
        furniture('modern-office-wide-beige-platform-with-drawer'),
      ])
    );
  });

  it('keeps blocking furniture footprints inside each room interior', () => {
    const map = getPublishedLevel1Map();
    const roomsById = new Map(map.rooms.map((room) => [room.id, room]));
    const blockingFloorObjects = map.objects.filter(
      (object) => object.blocksMovement === true && object.roomId
    );

    expect(blockingFloorObjects.length).toBeGreaterThan(0);

    blockingFloorObjects.forEach((object) => {
      const room = roomsById.get(object.roomId ?? '');
      const footprint = object.size ?? { height: 1, width: 1 };

      expect(room).toBeDefined();
      if (!room) {
        return;
      }

      const interior = observatoryRoomInteriorBounds(room);
      expect(object.position.x).toBeGreaterThanOrEqual(interior.minX);
      expect(object.position.y).toBeGreaterThanOrEqual(interior.minY);
      expect(object.position.x + footprint.width - 1).toBeLessThanOrEqual(interior.maxX);
      expect(object.position.y + footprint.height - 1).toBeLessThanOrEqual(interior.maxY);
    });
  });

  it('keeps workstation overlays attached to their furniture surfaces', () => {
    const validation = validateObservatoryLayout(publishedLayout);
    const maps = validation.layout?.world.maps ?? [];
    const tabletopAssetIds = new Set([
      furniture('compact-gray-laptop'),
      furniture('dual-monitor-workstation-wide'),
      furniture('low-keyboard-dark'),
      furniture('modern-office-desk-phone-handset'),
      furniture('modern-office-multi-monitor-station-with-base'),
      furniture('monitor-and-terminal-cluster'),
    ]);

    const tabletopObjects = maps.flatMap((map) =>
      map.objects.filter(
        (object) => tabletopAssetIds.has(object.assetId) && object.runtime?.targetObjectId
      )
    );

    expect(tabletopObjects.length).toBeGreaterThan(0);

    maps.forEach((map) => {
      const objectsById = new Map(map.objects.map((object) => [object.id, object]));

      map.objects
        .filter((object) => tabletopAssetIds.has(object.assetId) && object.runtime?.targetObjectId)
        .forEach((object) => {
          const target = objectsById.get(object.runtime?.targetObjectId ?? '');
          const targetSize = target?.size ?? { height: 1, width: 1 };

          expect(object.blocksMovement).toBe(false);
          expect(target).toBeDefined();
          expect(target?.roomId).toBe(object.roomId);
          expect(object.position.x).toBeGreaterThanOrEqual(target?.position.x ?? -1);
          expect(object.position.y).toBeGreaterThanOrEqual(target?.position.y ?? -1);
          expect(object.position.x).toBeLessThan((target?.position.x ?? 0) + targetSize.width);
          expect(object.position.y).toBeLessThan((target?.position.y ?? 0) + targetSize.height);
        });
    });
  });

  it('faces chairs toward the table or desk they belong to', () => {
    const map = getPublishedLevel1Map();
    const objectsById = new Map(map.objects.map((object) => [object.id, object]));
    const target = (object: ObservatoryObject) =>
      objectsById.get(object.runtime?.targetObjectId ?? '');

    ['a', 'b', 'c'].forEach((key) => {
      const chair = objectsById.get(`object:level-1-common-chair-${key}`);

      expect(chair).toBeDefined();
      if (!chair) {
        return;
      }

      const desk = target(chair);
      expect(chair?.assetId).toContain('office-chair-back');
      expect(chair?.position.y).toBeGreaterThan(desk?.position.y ?? 0);
    });

    const executiveChair = objectsById.get('object:level-1-executive-chair');
    const labChair = objectsById.get('object:level-1-lab-chair');
    const receptionChair = objectsById.get('object:level-1-reception-chair');
    const leftLoungeChair = objectsById.get('object:level-1-lounge-chair-left');
    const rightLoungeChair = objectsById.get('object:level-1-lounge-chair-right');

    expect(executiveChair).toBeDefined();
    expect(executiveChair?.assetId).toContain('office-chair-back');
    if (executiveChair) {
      expect(executiveChair.position.y).toBeGreaterThan(target(executiveChair)?.position.y ?? 0);
    }
    expect(labChair).toBeDefined();
    expect(labChair?.assetId).toContain('office-chair-back');
    if (labChair) {
      expect(labChair.position.y).toBeGreaterThan(target(labChair)?.position.y ?? 0);
    }
    expect(receptionChair).toBeDefined();
    expect(receptionChair?.assetId).toContain('office-chair-front');
    if (receptionChair) {
      expect(receptionChair.position.y).toBeLessThan(target(receptionChair)?.position.y ?? 0);
    }
    expect(leftLoungeChair).toBeDefined();
    expect(leftLoungeChair?.assetId).toContain('chair-side-right');
    if (leftLoungeChair) {
      expect(leftLoungeChair.position.x).toBeLessThan(target(leftLoungeChair)?.position.x ?? 0);
    }
    expect(rightLoungeChair).toBeDefined();
    expect(rightLoungeChair?.assetId).toContain('chair-side-left');
    if (rightLoungeChair) {
      expect(rightLoungeChair.position.x).toBeGreaterThan(
        target(rightLoungeChair)?.position.x ?? 0
      );
    }
  });

  it('uses full furniture sprites for common-room equipment overlays', () => {
    const validation = validateObservatoryLayout(publishedLayout);
    const commonWorkObjects =
      validation.layout?.world.maps[0]?.objects.filter(
        (object) => object.roomId === 'room:level-1-common-work'
      ) ?? [];
    const equipmentIds = new Set([
      'object:level-1-common-monitor-a',
      'object:level-1-common-monitor-b',
      'object:level-1-common-monitor-c',
      'object:level-1-common-keyboard-a',
      'object:level-1-common-keyboard-b',
      'object:level-1-common-keyboard-c',
      'object:level-1-common-laptop-b',
      'object:level-1-common-phone-c',
    ]);
    const equipment = commonWorkObjects.filter((object) => equipmentIds.has(object.id));

    expect(equipment).toHaveLength(equipmentIds.size);
    expect(equipment.every((object) => object.blocksMovement === false)).toBe(true);
    expect(
      equipment.every((object) => object.render?.sourceCrop === undefined && object.render?.depth)
    ).toBe(true);
    expect(equipment.every((object) => (object.render?.depth ?? 0) > 18)).toBe(true);
  });

  it('keeps reception composed as an intake counter plus waiting area', () => {
    const validation = validateObservatoryLayout(publishedLayout);
    const receptionObjects =
      validation.layout?.world.maps[0]?.objects.filter(
        (object) => object.roomId === 'room:level-1-reception'
      ) ?? [];
    const objectsById = new Map(receptionObjects.map((object) => [object.id, object]));

    expect(objectsById.get('object:level-1-reception-counter')?.assetId).toBe(
      furniture('modern-office-low-wood-service-counter')
    );
    expect(objectsById.get('object:level-1-reception-phone')?.runtime?.targetObjectId).toBe(
      'object:level-1-reception-counter'
    );
    expect(objectsById.get('object:level-1-reception-sofa')?.assetId).toBe(
      furniture('modern-office-wide-beige-platform-with-drawer')
    );
    expect(objectsById.get('object:level-1-reception-poster')?.render?.sourceCrop).toBeUndefined();
    expect(objectsById.get('object:level-1-reception-phone')?.blocksMovement).toBe(false);
  });
});
