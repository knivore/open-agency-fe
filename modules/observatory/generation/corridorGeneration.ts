import type { ObservatoryGridRect } from '@/modules/observatory/engine/world/grid';
import type {
  ObservatoryMap,
  ObservatoryRoom,
} from '@/modules/observatory/engine/world/layoutTypes';

export interface ObservatoryCorridorGenerationOptions {
  floorAssetId?: string;
  id?: string;
  name?: string;
  wallAssetId?: string;
  y?: number;
}

export function generateObservatoryCorridorRoom(
  map: ObservatoryMap,
  options: ObservatoryCorridorGenerationOptions = {}
): ObservatoryRoom {
  const bounds = generateObservatoryCorridorBounds(map, options.y);

  return {
    bounds,
    floorAssetId: options.floorAssetId ?? map.defaultFloorAssetId,
    id: options.id ?? 'room:corridor',
    kind: 'commons',
    name: options.name ?? 'Main Corridor',
    wallAssetId: options.wallAssetId,
  };
}

export function generateObservatoryCorridorBounds(
  map: ObservatoryMap,
  preferredY?: number
): ObservatoryGridRect {
  const width = Math.max(1, map.size.width - 2);
  const y = clamp(preferredY ?? findFirstOpenCorridorY(map), 0, Math.max(0, map.size.height - 1));

  return {
    height: 1,
    width,
    x: map.size.width > 2 ? 1 : 0,
    y,
  };
}

function findFirstOpenCorridorY(map: ObservatoryMap) {
  for (let y = 0; y < map.size.height; y += 1) {
    const overlapsRoom = map.rooms.some(
      (room) => y >= room.bounds.y && y < room.bounds.y + room.bounds.height
    );
    if (!overlapsRoom) {
      return y;
    }
  }

  return Math.floor(map.size.height / 2);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.floor(value)));
}
