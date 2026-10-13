import type { ObservatoryAssetDefinition } from '../assets/assetRegistry';
import {
  isObservatoryGridWalkable,
  objectCollisionGridRect,
  resolveObservatoryObjectInteraction,
} from '../rendering/agentBehaviorTargets';
import { pointInGridRect } from './grid';
import type { ObservatoryMap } from './layoutTypes';
import { observatoryObjectVisibleBounds } from './objectGeometry';

export interface ObservatoryPlacementIssue {
  message: string;
  objectId?: string;
  roomId?: string;
  severity: 'error' | 'warning';
}
export function inspectObservatoryMap(
  map: ObservatoryMap,
  assets: Map<string, ObservatoryAssetDefinition>,
  tileSize = 48
) {
  const issues: ObservatoryPlacementIssue[] = [];
  const blocking = map.objects.filter((object) => object.blocksMovement);
  const bounds = new Map(
    blocking.map((object) => [object.id, objectCollisionGridRect(object, assets)])
  );
  const overlap = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  blocking.forEach((object, index) => {
    const rect = bounds.get(object.id)!;
    for (const other of blocking.slice(index + 1))
      if (overlap(rect, bounds.get(other.id)!))
        issues.push({
          message: 'Blocking furniture overlaps another object.',
          objectId: object.id,
          severity: 'error',
        });
    for (const room of map.rooms) {
      const doors = [
        ...(room.wallDoors ?? []),
        ...(room.wallOpenings ?? []),
        ...(room.wallEdgeOpenings ?? []).map((entry) => entry.point),
      ];
      if (doors.some((point) => pointInGridRect(point, rect)))
        issues.push({
          message: `Furniture blocks an entrance to ${room.name}.`,
          objectId: object.id,
          roomId: room.id,
          severity: 'error',
        });
    }
  });
  const objectIds = new Set(map.objects.map((object) => object.id));
  for (const object of [...map.objects, ...map.agents])
    if (object.runtime?.targetObjectId && !objectIds.has(object.runtime.targetObjectId))
      issues.push({
        message: 'Interaction target is missing.',
        objectId: object.id,
        severity: 'error',
      });
  for (const object of map.objects) {
    if (!assets.has(object.assetId))
      issues.push({
        message: 'Asset is missing from the tracked catalog.',
        objectId: object.id,
        severity: 'error',
      });
    const visible = observatoryObjectVisibleBounds(object, assets.get(object.assetId), tileSize);
    const room = map.rooms.find((candidate) => candidate.id === object.roomId);
    const container = room
      ? {
          x: room.bounds.x * tileSize,
          y: room.bounds.y * tileSize,
          width: room.bounds.width * tileSize,
          height: room.bounds.height * tileSize,
        }
      : { x: 0, y: 0, width: map.size.width * tileSize, height: map.size.height * tileSize };
    if (
      visible.x < container.x ||
      visible.y < container.y ||
      visible.x + visible.width > container.x + container.width ||
      visible.y + visible.height > container.y + container.height
    )
      issues.push({
        message: `Visible sprite extends beyond ${room?.name ?? 'the floor'}.`,
        objectId: object.id,
        severity: 'warning',
      });
  }
  const walkable: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < map.size.height; y++)
    for (let x = 0; x < map.size.width; x++)
      if (isObservatoryGridWalkable(map, { x, y }, assets)) walkable.push({ x, y });
  const key = (point: { x: number; y: number }) => `${point.x}:${point.y}`;
  const remaining = new Set(walkable.map(key));
  let reachable = new Set<string>();
  // Use the largest connected aisle network, rather than an arbitrary first tile
  // which might belong to a sealed room or a decorative pocket.
  while (remaining.size) {
    const [x, y] = remaining.values().next().value!.split(':').map(Number);
    const queue = [{ x, y }];
    const component = new Set([`${x}:${y}`]);
    remaining.delete(`${x}:${y}`);
    for (let i = 0; i < queue.length; i++) {
      const point = queue[i];
      for (const [dx, dy] of [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
      ]) {
        const next = { x: point.x + dx, y: point.y + dy };
        const nextKey = key(next);
        if (remaining.delete(nextKey)) {
          component.add(nextKey);
          queue.push(next);
        }
      }
    }
    if (component.size > reachable.size) reachable = component;
  }
  const workstations = map.objects.filter((object) => object.runtime?.role === 'workstation');
  const disconnected = walkable.filter((point) => !reachable.has(key(point)));
  for (const room of map.rooms) {
    const count = disconnected.filter((point) => pointInGridRect(point, room.bounds)).length;
    if (count)
      issues.push({
        message: `${room.name} has an isolated walkable area (${count} tiles).`,
        roomId: room.id,
        severity: 'warning',
      });
  }
  let reachableWorkstations = 0;
  for (const object of workstations) {
    const interaction = resolveObservatoryObjectInteraction(map, object, {
      assetsById: assets,
      tileSize,
    });
    const seat = map.objects.find(
      (candidate) =>
        candidate.runtime?.targetObjectId === object.id &&
        candidate.runtime.role === 'workstation-seat'
    );
    if (seat && interaction) {
      const visible = observatoryObjectVisibleBounds(seat, assets.get(seat.assetId), tileSize);
      const footX = (interaction.point.x + 0.5) * tileSize + interaction.offsetPx.x;
      const footY = (interaction.point.y + 0.5) * tileSize + interaction.offsetPx.y;
      if (
        Math.abs(footX - visible.x - visible.width / 2) > 1 ||
        Math.abs(footY - visible.y - visible.height) > 1
      )
        issues.push({
          message: 'Workstation chair is outside its usable interaction area.',
          objectId: seat.id,
          severity: 'warning',
        });
    }
    const rect = objectCollisionGridRect(object, assets);
    const accessible = walkable.some(
      (point) =>
        reachable.has(key(point)) &&
        (((point.x === rect.x - 1 || point.x === rect.x + rect.width) &&
          point.y >= rect.y &&
          point.y < rect.y + rect.height) ||
          ((point.y === rect.y - 1 || point.y === rect.y + rect.height) &&
            point.x >= rect.x &&
            point.x < rect.x + rect.width))
    );
    if (accessible) reachableWorkstations++;
    else
      issues.push({
        message: 'Workstation cannot be reached from the main aisle network.',
        objectId: object.id,
        severity: 'warning',
      });
  }
  return {
    issues,
    walkable,
    disconnected,
    reachableWorkstations,
    workstations: workstations.length,
    seats: map.objects.filter((object) => object.runtime?.role === 'workstation-seat').length,
  };
}
