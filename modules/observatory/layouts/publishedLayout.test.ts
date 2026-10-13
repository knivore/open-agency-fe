import { describe, expect, it } from 'vitest';

import { collectObservatoryMapAssetIds } from '@/modules/observatory/engine/assets/assetUsage';
import type { ObservatoryFurnitureManifestAsset } from '@/modules/observatory/engine/assets/furnitureManifest';
import { getObservatoryFullModuleAssetRegistry } from '@/modules/observatory/engine/assets/moduleFullAssetRegistry';
import {
  isObservatoryGridWalkable,
  pickObservatoryObjectAdjacentWalkablePoint,
  resolveObservatoryGridPath,
  observatoryRoomInteriorBounds,
} from '@/modules/observatory/engine/rendering/agentBehaviorTargets';
import { validateObservatoryLayout } from '@/modules/observatory/engine/world/layoutValidation';
import type { ObservatoryMap } from '@/modules/observatory/engine/world/layoutTypes';
import { observatoryObjectVisibleBounds } from '../engine/world/objectGeometry';
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

  it('reserves scaled decor geometry without stretching the artwork', () => {
    const validation = validateObservatoryLayout(publishedLayout);
    const objects = validation.layout?.world.maps.flatMap((map) => map.objects) ?? [];

    const screens = objects.filter((object) => object.assetId === 'decor:runtime-screens');
    const servers = objects.filter((object) => object.assetId === 'decor:runtime-server');
    const kitchenettes = objects.filter((object) => object.assetId === 'decor:pantry-kitchenette');

    expect(screens.length).toBeGreaterThan(0);
    expect(servers.length).toBeGreaterThan(0);
    expect(kitchenettes).toHaveLength(2);
    expect(
      screens.every(
        (object) =>
          object.render?.sizePx?.width === 128 &&
          object.render?.sizePx?.height === 96 &&
          object.size?.width === 3 &&
          object.size?.height === 2
      )
    ).toBe(true);
    expect(servers.every((object) => object.size?.width === 1 && object.size?.height === 3)).toBe(
      true
    );
    expect(
      kitchenettes.every(
        (object) =>
          object.render?.sizePx?.width === 144 &&
          object.render?.sizePx?.height === 96 &&
          object.size?.width === 3 &&
          object.size?.height === 1
      )
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

  it('keeps the saved library and portable published layout synchronized', () => {
    expect(defaultLibraryLayout).toEqual(publishedLayout);
  });

  it('furnishes each room for its named purpose', () => {
    const map = getPublishedLevel1Map();
    const assetsIn = (id: string) => getObjectsByRoom(map, id).map((object) => object.assetId);
    expect(assetsIn('room:level-1-pantry')).toEqual(
      expect.arrayContaining([
        'decor:pantry-kitchenette',
        'decor:pantry-fridge',
        furniture('office-water-cooler'),
        furniture('modern-office-small-beige-desk-front'),
      ])
    );
    expect(
      assetsIn('room:level-1-pantry').some((id) => /printer|monitor|workstation/.test(id))
    ).toBe(false);
    expect(assetsIn('room:level-1-planning-lounge')).toEqual(
      expect.arrayContaining([
        furniture('planning-whiteboard-chart'),
        furniture('large-wood-table-vertical'),
      ])
    );
    expect(assetsIn('room:level-1-runtime-lab')).toEqual(
      expect.arrayContaining([
        'decor:runtime-screens',
        'decor:runtime-server',
        furniture('dual-monitor-workstation-wide'),
        furniture('tall-control-server-rack'),
      ])
    );
    expect(assetsIn('room:level-1-reception')).toEqual(
      expect.arrayContaining([
        furniture('modern-office-low-wood-service-counter'),
        furniture('modern-office-desk-phone-handset'),
        furniture('modern-office-small-tan-desk-front'),
        furniture('modern-office-orange-office-chair-front-alt'),
      ])
    );
    // Complementary table pieces are valid only as linked trim, never as stray floor props.
    expect(
      map.objects.some(
        (object) =>
          /platform-with-drawer|runtime-server-tower/.test(object.assetId) &&
          object.runtime?.role !== 'surface-trim'
      )
    ).toBe(false);
  });

  it('provides 20 work points with paired north-facing seats', () => {
    const maps = validateObservatoryLayout(publishedLayout).layout!.world.maps;
    expect(
      maps.map(
        (map) => map.objects.filter((object) => object.runtime?.role === 'workstation').length
      )
    ).toEqual([11, 9]);
    expect(
      getObjectsByRoom(maps[0]!, 'room:level-1-common-work').filter(
        (object) => object.runtime?.role === 'workstation'
      )
    ).toHaveLength(6);
    maps.forEach((map) => {
      const desks = map.objects.filter((object) => object.runtime?.role === 'workstation');
      const seats = map.objects.filter((object) => object.runtime?.role === 'workstation-seat');
      expect(seats).toHaveLength(desks.length);
      desks.forEach((desk) => {
        const paired = seats.filter((seat) => seat.runtime?.targetObjectId === desk.id);
        expect(paired, desk.id).toHaveLength(1);
        // The pack's "front" export shows the outside of the backrest, facing the desk.
        expect(paired[0]!.assetId).toContain('office-chair-front');
        expect(paired[0]!.position.y).toBeGreaterThan(desk.position.y);
      });
    });
  });

  it('finishes wide desktops with a matching right apron and keeps agents off furniture', () => {
    const assets = new Map(
      getObservatoryFullModuleAssetRegistry().assets.map((asset) => [asset.id, asset])
    );
    const maps = validateObservatoryLayout(publishedLayout).layout!.world.maps;
    for (const map of maps) {
      for (const agent of map.agents)
        expect(isObservatoryGridWalkable(map, agent.position, assets), agent.id).toBe(true);
      for (const desk of map.objects.filter((object) =>
        /wide-(beige|white|gray|tan)-desk-front$/.test(object.assetId)
      )) {
        const finish = map.objects.find(
          (object) =>
            object.runtime?.role === 'surface-trim' && object.runtime.targetObjectId === desk.id
        );
        expect(finish, desk.id).toBeDefined();
        const surface = observatoryObjectVisibleBounds(desk, assets.get(desk.assetId));
        const trim = observatoryObjectVisibleBounds(finish!, assets.get(finish!.assetId));
        expect(trim.x + trim.width, desk.id).toBeCloseTo(surface.x + surface.width);
        expect(trim.y + trim.height, desk.id).toBeCloseTo(surface.y + surface.height);
      }
    }
  });

  it('faces dining and meeting chairs inward toward their complete table', () => {
    const assets = new Map(
      getObservatoryFullModuleAssetRegistry().assets.map((asset) => [asset.id, asset])
    );
    for (const map of validateObservatoryLayout(publishedLayout).layout!.world.maps) {
      for (const chair of map.objects.filter(
        (object) =>
          /office-chair-side-(left|right)$/.test(object.assetId) && object.runtime?.targetObjectId
      )) {
        const table = map.objects.find((object) => object.id === chair.runtime!.targetObjectId)!;
        const seat = observatoryObjectVisibleBounds(chair, assets.get(chair.assetId));
        const surface = observatoryObjectVisibleBounds(table, assets.get(table.assetId));
        expect(chair.assetId, chair.id).toContain(
          seat.x + seat.width / 2 < surface.x + surface.width / 2 ? 'side-right' : 'side-left'
        );
        const seatY = seat.y + seat.height * 0.72;
        expect(seatY, chair.id).toBeGreaterThan(surface.y);
        expect(seatY, chair.id).toBeLessThan(surface.y + surface.height);
      }
    }
  });

  it('equips both pantries with real kitchen fixtures and a complete dining set', () => {
    for (const map of validateObservatoryLayout(publishedLayout).layout!.world.maps) {
      const pantry = map.rooms.find((room) => room.name.includes('Pantry'))!;
      const objects = getObjectsByRoom(map, pantry.id);
      expect(objects.map((object) => object.assetId)).toEqual(
        expect.arrayContaining([
          'decor:pantry-kitchenette',
          'decor:pantry-fridge',
          furniture('office-water-cooler'),
        ])
      );
      expect(objects.filter((object) => object.runtime?.role === 'visitor-seat')).toHaveLength(2);
      expect(
        objects.some(
          (object) =>
            object.assetId === 'decor:coffee-loop' || object.assetId.includes('storage-cabinet')
        )
      ).toBe(false);
    }
  });

  it('keeps floor furniture inside room interiors without overlapping blocking footprints', () => {
    const maps = validateObservatoryLayout(publishedLayout).layout!.world.maps;
    maps.forEach((map) => {
      const rooms = new Map(map.rooms.map((room) => [room.id, room]));
      const blocking = map.objects.filter((object) => object.blocksMovement);
      blocking.forEach((object, index) => {
        const interior = observatoryRoomInteriorBounds(rooms.get(object.roomId!)!);
        const size = object.size!;
        expect(object.position.x, object.id).toBeGreaterThanOrEqual(interior.minX);
        expect(object.position.y, object.id).toBeGreaterThanOrEqual(interior.minY);
        expect(object.position.x + size.width - 1, object.id).toBeLessThanOrEqual(interior.maxX);
        expect(object.position.y + size.height - 1, object.id).toBeLessThanOrEqual(interior.maxY);
        blocking.slice(index + 1).forEach((other) => {
          const overlaps =
            object.position.x < other.position.x + other.size!.width &&
            other.position.x < object.position.x + size.width &&
            object.position.y < other.position.y + other.size!.height &&
            other.position.y < object.position.y + size.height;
          expect(overlaps, object.id + ' / ' + other.id).toBe(false);
        });
      });
    });
  });

  it('compensates transparent source padding and keeps visible sprites within their rooms', () => {
    const maps = validateObservatoryLayout(publishedLayout).layout!.world.maps;
    const assets = new Map(typedFurnitureManifest.assets!.map((asset) => [asset.id, asset]));
    maps.forEach((map) => {
      const rooms = new Map(map.rooms.map((room) => [room.id, room]));
      map.objects
        .filter((object) => object.assetId.startsWith('furniture:'))
        .forEach((object) => {
          const asset = assets.get(object.assetId)!;
          const crop = object.render!.sourceCrop!;
          const scale = object.render!.sizePx!.width / asset.width;
          if (object.runtime?.role === 'surface-trim') {
            expect(crop.x, object.id).toBeGreaterThanOrEqual(asset.sourceCrop!.x);
            expect(crop.y, object.id).toBeGreaterThanOrEqual(asset.sourceCrop!.y);
            expect(crop.x + crop.width, object.id).toBeLessThanOrEqual(
              asset.sourceCrop!.x + asset.sourceCrop!.width
            );
            expect(crop.y + crop.height, object.id).toBeLessThanOrEqual(
              asset.sourceCrop!.y + asset.sourceCrop!.height
            );
          } else expect(crop, object.id).toEqual(asset.sourceCrop);
          expect(object.render!.sizePx!.height / asset.height, object.id).toBeCloseTo(scale);
          const left = object.position.x * 48 + object.render!.offsetPx!.x + crop.x * scale;
          const top = object.position.y * 48 + object.render!.offsetPx!.y + crop.y * scale;
          const room = rooms.get(object.roomId!)!.bounds;
          expect(left, object.id).toBeGreaterThanOrEqual(room.x * 48);
          expect(top, object.id).toBeGreaterThanOrEqual(room.y * 48);
          expect(left + crop.width * scale, object.id).toBeLessThanOrEqual(
            (room.x + room.width) * 48
          );
          expect(top + crop.height * scale, object.id).toBeLessThanOrEqual(
            (room.y + room.height) * 48
          );
        });
    });
  });

  it('keeps equipment, seats, and existing agents attached to valid room-local targets', () => {
    const maps = validateObservatoryLayout(publishedLayout).layout!.world.maps;
    maps.forEach((map) => {
      const objects = new Map(map.objects.map((object) => [object.id, object]));
      map.objects
        .filter((object) => object.runtime?.targetObjectId)
        .forEach((object) => {
          const target = objects.get(object.runtime!.targetObjectId!);
          expect(target, object.id).toBeDefined();
          expect(target!.roomId, object.id).toBe(object.roomId);
          expect(object.blocksMovement, object.id).toBe(false);
        });
      map.agents.forEach((agent) => {
        expect(objects.has(agent.runtime!.targetObjectId!), agent.id).toBe(true);
      });
    });
  });

  it('keeps every work point accessible from the floor corridor', () => {
    const assets = new Map(
      getObservatoryFullModuleAssetRegistry().assets.map((asset) => [asset.id, asset])
    );
    const maps = validateObservatoryLayout(publishedLayout).layout!.world.maps;
    const starts = [
      { x: 14, y: 9 },
      { x: 13, y: 11 },
    ];
    maps.forEach((map, index) => {
      const start = starts[index]!;
      expect(isObservatoryGridWalkable(map, start, assets)).toBe(true);
      map.objects
        .filter((object) => object.runtime?.role === 'workstation')
        .forEach((object) => {
          const point = pickObservatoryObjectAdjacentWalkablePoint(map, object, {
            assetsById: assets,
            fromPoint: start,
          });
          expect(point, object.id).toBeDefined();
          expect
            .soft(resolveObservatoryGridPath(map, start, point!, assets).length, object.id)
            .toBeGreaterThan(0);
        });
    });
  });
});
