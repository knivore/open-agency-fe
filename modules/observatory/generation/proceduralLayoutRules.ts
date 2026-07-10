import type {
  ObservatoryGridPoint,
  ObservatoryGridRect,
  ObservatoryGridSize,
} from '@/modules/observatory/engine/world/grid';
import type {
  ObservatoryLayoutIssue,
  ObservatoryMap,
  ObservatoryObject,
  ObservatoryRoom,
} from '@/modules/observatory/engine/world/layoutTypes';

export const OBSERVATORY_DOOR_ASSET_ID = 'decor:open-door';
export const OBSERVATORY_DEFAULT_DESK_SPACING = 1;

export interface ObservatoryProceduralValidationResult {
  issues: ObservatoryLayoutIssue[];
  valid: boolean;
}

export function validateObservatoryDeskSpacing(
  map: ObservatoryMap,
  minSpacing = OBSERVATORY_DEFAULT_DESK_SPACING
): ObservatoryProceduralValidationResult {
  const desks = map.objects.filter(isDeskObject);
  const issues: ObservatoryLayoutIssue[] = [];

  for (let index = 0; index < desks.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < desks.length; nextIndex += 1) {
      const first = desks[index]!;
      const second = desks[nextIndex]!;

      if (first.roomId !== second.roomId) {
        continue;
      }

      if (rectsOverlap(expandRect(objectBounds(first), minSpacing), objectBounds(second))) {
        issues.push({
          path: `objects.${first.id}`,
          reason: `desk spacing below ${minSpacing} tile near ${second.id}`,
        });
      }
    }
  }

  return { issues, valid: issues.length === 0 };
}

export function generateObservatoryDoorObjects(map: ObservatoryMap): ObservatoryObject[] {
  return map.rooms
    .filter((room) => !room.id.startsWith('room:corridor'))
    .map((room) =>
      createDoorObjectForRoom(
        room,
        map.objects.map((object) => object.id)
      )
    );
}

export function validateObservatoryWalkability(
  map: ObservatoryMap
): ObservatoryProceduralValidationResult {
  const issues: ObservatoryLayoutIssue[] = [];
  const blocked = createBlockedCellSet(
    map.objects.filter((object) => object.blocksMovement !== false)
  );
  const roomTargets = map.rooms.map(
    (room) => findWalkablePointInRoom(room, map, blocked) ?? roomCenter(room)
  );
  const targets = [...roomTargets, ...map.agents.map((agent) => agent.position)].filter((point) =>
    pointInMap(point, map)
  );
  const start = targets.find((point) => !blocked.has(pointKey(point)));

  if (!start) {
    return {
      issues: [{ path: 'world.maps[0]', reason: 'no walkable start cell found' }],
      valid: false,
    };
  }

  const reachable = floodFillWalkableCells(map, blocked, start);

  targets.forEach((target, index) => {
    if (blocked.has(pointKey(target)) || !reachable.has(pointKey(target))) {
      issues.push({
        path:
          index < map.rooms.length
            ? `rooms.${map.rooms[index]?.id ?? index}`
            : `agents.${map.agents[index - map.rooms.length]?.id ?? index}`,
        reason: `target ${target.x},${target.y} is not walkable`,
      });
    }
  });

  return { issues, valid: issues.length === 0 };
}

export function findObservatoryCollisionSafePlacement(
  map: ObservatoryMap,
  size: ObservatoryGridSize,
  preferred?: ObservatoryGridPoint
): ObservatoryGridPoint | undefined {
  const normalizedSize = normalizeSize(size);

  if (preferred && isCollisionSafeRect({ ...preferred, ...normalizedSize }, map)) {
    return preferred;
  }

  for (let y = 0; y <= map.size.height - normalizedSize.height; y += 1) {
    for (let x = 0; x <= map.size.width - normalizedSize.width; x += 1) {
      const candidate = { x, y, ...normalizedSize };
      if (isCollisionSafeRect(candidate, map)) {
        return { x, y };
      }
    }
  }

  return undefined;
}

export function validateObservatoryCollisionSafety(
  map: ObservatoryMap
): ObservatoryProceduralValidationResult {
  const blockingObjects = map.objects.filter((object) => object.blocksMovement !== false);
  const issues: ObservatoryLayoutIssue[] = [];

  for (let index = 0; index < blockingObjects.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < blockingObjects.length; nextIndex += 1) {
      const first = blockingObjects[index]!;
      const second = blockingObjects[nextIndex]!;

      if (rectsOverlap(objectBounds(first), objectBounds(second))) {
        issues.push({
          path: `objects.${first.id}`,
          reason: `collides with ${second.id}`,
        });
      }
    }
  }

  return { issues, valid: issues.length === 0 };
}

export function validateObservatoryGeneratedLayout(
  map: ObservatoryMap
): ObservatoryProceduralValidationResult {
  const validations = [
    validateObservatoryDeskSpacing(map),
    validateObservatoryCollisionSafety(map),
    validateObservatoryWalkability(map),
  ];
  const issues = validations.flatMap((validation) => validation.issues);

  return { issues, valid: issues.length === 0 };
}

function createDoorObjectForRoom(
  room: ObservatoryRoom,
  existingObjectIds: string[]
): ObservatoryObject {
  const idBase = `object:door-${room.id.replace(/^room:/, '')}`;
  const id = uniqueId(idBase, existingObjectIds);

  return {
    assetId: OBSERVATORY_DOOR_ASSET_ID,
    blocksMovement: false,
    id,
    position: {
      x: Math.max(room.bounds.x, Math.floor(room.bounds.x + room.bounds.width / 2)),
      y: room.bounds.y,
    },
    roomId: room.id,
    size: { height: 1, width: 1 },
  };
}

function isDeskObject(object: ObservatoryObject) {
  return object.assetId.includes('workstation') || object.id.includes('desk');
}

function isCollisionSafeRect(rect: ObservatoryGridRect, map: ObservatoryMap) {
  if (
    rect.x < 0 ||
    rect.y < 0 ||
    rect.x + rect.width > map.size.width ||
    rect.y + rect.height > map.size.height
  ) {
    return false;
  }

  return map.objects
    .filter((object) => object.blocksMovement !== false)
    .every((object) => !rectsOverlap(rect, objectBounds(object)));
}

function objectBounds(object: ObservatoryObject): ObservatoryGridRect {
  return {
    ...object.position,
    ...normalizeSize(object.size),
  };
}

function normalizeSize(size: ObservatoryGridSize | undefined): ObservatoryGridSize {
  return {
    height: Math.max(1, Math.floor(size?.height ?? 1)),
    width: Math.max(1, Math.floor(size?.width ?? 1)),
  };
}

function expandRect(rect: ObservatoryGridRect, amount: number): ObservatoryGridRect {
  return {
    height: rect.height + amount * 2,
    width: rect.width + amount * 2,
    x: rect.x - amount,
    y: rect.y - amount,
  };
}

function rectsOverlap(first: ObservatoryGridRect, second: ObservatoryGridRect) {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

function createBlockedCellSet(objects: ObservatoryObject[]) {
  const blocked = new Set<string>();

  objects.forEach((object) => {
    const bounds = objectBounds(object);
    for (let y = bounds.y; y < bounds.y + bounds.height; y += 1) {
      for (let x = bounds.x; x < bounds.x + bounds.width; x += 1) {
        blocked.add(pointKey({ x, y }));
      }
    }
  });

  return blocked;
}

function floodFillWalkableCells(
  map: ObservatoryMap,
  blocked: Set<string>,
  start: ObservatoryGridPoint
) {
  const reachable = new Set<string>();
  const queue = [start];
  reachable.add(pointKey(start));

  while (queue.length > 0) {
    const point = queue.shift()!;
    const neighbors = [
      { x: point.x + 1, y: point.y },
      { x: point.x - 1, y: point.y },
      { x: point.x, y: point.y + 1 },
      { x: point.x, y: point.y - 1 },
    ];

    neighbors.forEach((neighbor) => {
      const key = pointKey(neighbor);
      if (pointInMap(neighbor, map) && !blocked.has(key) && !reachable.has(key)) {
        reachable.add(key);
        queue.push(neighbor);
      }
    });
  }

  return reachable;
}

function roomCenter(room: ObservatoryRoom): ObservatoryGridPoint {
  return {
    x: Math.floor(room.bounds.x + room.bounds.width / 2),
    y: Math.floor(room.bounds.y + room.bounds.height / 2),
  };
}

function findWalkablePointInRoom(
  room: ObservatoryRoom,
  map: ObservatoryMap,
  blocked: Set<string>
): ObservatoryGridPoint | undefined {
  for (let y = room.bounds.y; y < room.bounds.y + room.bounds.height; y += 1) {
    for (let x = room.bounds.x; x < room.bounds.x + room.bounds.width; x += 1) {
      const point = { x, y };
      if (pointInMap(point, map) && !blocked.has(pointKey(point))) {
        return point;
      }
    }
  }

  return undefined;
}

function pointInMap(point: ObservatoryGridPoint, map: ObservatoryMap) {
  return point.x >= 0 && point.y >= 0 && point.x < map.size.width && point.y < map.size.height;
}

function pointKey(point: ObservatoryGridPoint) {
  return `${point.x}:${point.y}`;
}

function uniqueId(prefix: string, existingIds: string[]) {
  const existing = new Set(existingIds);
  let index = existing.size + 1;
  let candidate = `${prefix}-${index}`;

  while (existing.has(candidate)) {
    index += 1;
    candidate = `${prefix}-${index}`;
  }

  return candidate;
}
