import type { ObservatoryLayoutDocument, ObservatoryMap } from '@/modules/observatory/engine/world/layoutTypes';
import type { ObservatoryGridRect } from '@/modules/observatory/engine/world/grid';

const footprintPaddingTiles = 2;

export function getObservatoryLayoutFootprint(
  layout: ObservatoryLayoutDocument | null | undefined,
  mapId?: string | null,
): ObservatoryGridRect | null {
  if (!layout) {
    return null;
  }

  const map = mapId
    ? layout.world.maps.find((candidate) => candidate.id === mapId) ?? layout.world.maps[0]
    : layout.world.maps[0];

  if (!map) {
    return null;
  }

  return getObservatoryMapFootprint(map);
}

export function getObservatoryMapFootprint(map: ObservatoryMap): ObservatoryGridRect {
  const maxMapX = Math.max(1, map.size.width);
  const maxMapY = Math.max(1, map.size.height);
  let minX = maxMapX;
  let minY = maxMapY;
  let maxX = 0;
  let maxY = 0;
  const hasRooms = map.rooms.length > 0;

  for (const room of map.rooms) {
    minX = Math.min(minX, room.bounds.x);
    minY = Math.min(minY, room.bounds.y);
    maxX = Math.max(maxX, room.bounds.x + room.bounds.width);
    maxY = Math.max(maxY, room.bounds.y + room.bounds.height);
  }

  if (!hasRooms) {
    for (const object of map.objects) {
      const width = Math.max(1, object.size?.width ?? 1);
      const height = Math.max(1, object.size?.height ?? 1);
      minX = Math.min(minX, object.position.x);
      minY = Math.min(minY, object.position.y);
      maxX = Math.max(maxX, object.position.x + width);
      maxY = Math.max(maxY, object.position.y + height);
    }

    for (const agent of map.agents) {
      minX = Math.min(minX, agent.position.x);
      minY = Math.min(minY, agent.position.y);
      maxX = Math.max(maxX, agent.position.x + 1);
      maxY = Math.max(maxY, agent.position.y + 1);
    }
  }

  if (minX >= maxX || minY >= maxY) {
    return {
      height: map.size.height,
      width: map.size.width,
      x: 0,
      y: 0,
    };
  }

  const paddedMinX = Math.max(0, minX - footprintPaddingTiles);
  const paddedMinY = Math.max(0, minY - footprintPaddingTiles);
  const paddedMaxX = Math.min(map.size.width, maxX + footprintPaddingTiles);
  const paddedMaxY = Math.min(map.size.height, maxY + footprintPaddingTiles);

  return {
    height: Math.max(1, paddedMaxY - paddedMinY),
    width: Math.max(1, paddedMaxX - paddedMinX),
    x: paddedMinX,
    y: paddedMinY,
  };
}
