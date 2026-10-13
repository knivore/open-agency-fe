import type { ObservatoryAssetDefinition } from '@/modules/observatory/engine/assets/assetRegistry';
import type {
  ObservatoryCharacterActionName,
  ObservatoryCharacterDirection,
} from '../assets/assetRegistry';
import { observatoryObjectVisibleBounds } from '../world/objectGeometry';
import type {
  ObservatoryAgent,
  ObservatoryMap,
  ObservatoryObject,
  ObservatoryRoom,
} from '@/modules/observatory/engine/world/layoutTypes';

export type ObservatoryBehaviorTargetRole =
  | 'computer'
  | 'pantry'
  | 'planning'
  | 'runtime'
  | 'seating'
  | 'storage'
  | 'surface'
  | 'unknown';

export interface ObservatoryAgentBehaviorTargetOptions {
  agentId: string;
  assetsById?: Map<string, ObservatoryAssetDefinition>;
  fromPoint?: { x: number; y: number };
  seed?: number | string;
  targetRoomId: string;
  tileSize?: number;
  occupiedPoints?: Array<{ x: number; y: number }>;
  occupiedFootPositions?: Array<{ x: number; y: number }>;
}

export function pickObservatoryAgentBehaviorTargetPoint(
  map: ObservatoryMap,
  options: ObservatoryAgentBehaviorTargetOptions
) {
  return resolveObservatoryAgentBehaviorInteraction(map, options)?.point ?? null;
}
export function resolveObservatoryAgentBehaviorInteraction(
  map: ObservatoryMap,
  options: ObservatoryAgentBehaviorTargetOptions
): ObservatoryObjectInteraction | null {
  const room = map.rooms.find((candidate) => candidate.id === options.targetRoomId);
  if (!room) return null;
  const agent = map.agents.find((candidate) => candidate.id === options.agentId);
  const explicit = map.objects.find(
    (object) => object.id === agent?.runtime?.targetObjectId && object.roomId === room.id
  );
  const target = explicit ?? pickBehaviorTargetObject(map, room, agent, options);
  if (target) {
    const interaction = resolveObservatoryObjectInteraction(map, target, {
      ...options,
      seed: `${options.agentId}:${target.id}:${options.seed ?? ''}`,
    });
    if (interaction) return interaction;
  }
  const point = pickObservatoryRoomRoamPoint(map, room, options);
  return point
    ? { point, direction: 'down', action: 'idle', offsetPx: { x: 0, y: 0 }, objectId: '' }
    : null;
}

export function pickObservatoryObjectAdjacentWalkablePoint(
  map: ObservatoryMap,
  object: ObservatoryObject,
  options: {
    assetsById?: Map<string, ObservatoryAssetDefinition>;
    fromPoint?: { x: number; y: number };
    seed?: number | string;
  } = {}
) {
  return resolveObservatoryObjectInteraction(map, object, options)?.point ?? null;
}

export interface ObservatoryObjectInteraction {
  point: { x: number; y: number };
  direction: ObservatoryCharacterDirection;
  action: ObservatoryCharacterActionName;
  offsetPx: { x: number; y: number };
  objectId: string;
}

export function resolveObservatoryObjectInteraction(
  map: ObservatoryMap,
  requestedObject: ObservatoryObject,
  options: {
    assetsById?: Map<string, ObservatoryAssetDefinition>;
    fromPoint?: { x: number; y: number };
    seed?: number | string;
    tileSize?: number;
    occupiedPoints?: Array<{ x: number; y: number }>;
    occupiedFootPositions?: Array<{ x: number; y: number }>;
  } = {}
): ObservatoryObjectInteraction | null {
  let object = requestedObject;
  const seen = new Set([object.id]);
  // A keyboard or monitor belongs to its desk; approaching its tiny source crop
  // can otherwise put an agent inside the desk's blocking footprint.
  while (object.runtime?.targetObjectId) {
    const parent = map.objects.find(
      (candidate) =>
        candidate.id === object.runtime?.targetObjectId && candidate.roomId === object.roomId
    );
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id);
    object = parent;
  }
  const tile = options.tileSize ?? 48;
  const bounds = objectCollisionGridRect(object, options.assetsById);
  const occupied = (point: { x: number; y: number }, offset = { x: 0, y: 0 }) =>
    options.occupiedPoints?.some((other) => isSameGridPoint(point, other)) ||
    isFootPositionOccupied(point, offset, tile, options.occupiedFootPositions);
  const seats = map.objects.filter(
    (candidate) =>
      candidate.runtime?.targetObjectId === object.id &&
      candidate.runtime.role === 'workstation-seat'
  );
  for (const seat of seats) {
    const visible = observatoryObjectVisibleBounds(
      seat,
      options.assetsById?.get(seat.assetId),
      tile
    );
    const centerX = visible.x + visible.width / 2;
    const point = {
      x: Math.floor(centerX / tile),
      y: Math.floor((visible.y + visible.height - 1) / tile),
    };
    const offsetPx = {
      x: Math.max(-tile / 2, Math.min(tile / 2, centerX - (point.x + 0.5) * tile)),
      y: Math.max(
        -tile / 2,
        Math.min(tile / 2, visible.y + visible.height - (point.y + 0.5) * tile)
      ),
    };
    if (
      occupied(point, offsetPx) ||
      !pickWalkableCandidate(map, [point], options.assetsById, options.fromPoint)
    )
      continue;
    const direction = directionTowardObject(point, bounds);
    return {
      point,
      direction,
      // The tracked sheet has only left/right sitting poses. A north-facing desk
      // uses its supported idle pose instead of silently showing a sideways sit.
      action: direction === 'left' || direction === 'right' ? 'sit' : 'idle',
      offsetPx,
      objectId: object.id,
    };
  }
  const candidates = createObjectInteractionCandidates(bounds, options.seed ?? object.id).filter(
    (point) => !occupied(point)
  );
  const point = pickWalkableCandidate(map, candidates, options.assetsById, options.fromPoint);
  return point
    ? {
        point,
        direction: directionTowardObject(point, bounds),
        action: 'idle',
        offsetPx: { x: 0, y: 0 },
        objectId: object.id,
      }
    : null;
}

function isFootPositionOccupied(
  point: { x: number; y: number },
  offset: { x: number; y: number },
  tile: number,
  feet?: Array<{ x: number; y: number }>
) {
  const x = (point.x + 0.5) * tile + offset.x,
    y = (point.y + 0.5) * tile + offset.y;
  // Chair offsets can put adjacent grid destinations only half a tile apart.
  // Reserve the rendered footprint too, so actors do not stack at the same desk.
  return (
    feet?.some(
      (other) => Math.abs(other.x - x) < tile * 0.9 && Math.abs(other.y - y) < tile * 0.6
    ) ?? false
  );
}

function directionTowardObject(
  point: { x: number; y: number },
  bounds: { x: number; y: number; width: number; height: number }
): ObservatoryCharacterDirection {
  const dx = bounds.x + (bounds.width - 1) / 2 - point.x;
  const dy = bounds.y + (bounds.height - 1) / 2 - point.y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
}

export function resolveObservatoryGridPath(
  map: ObservatoryMap,
  from: { x: number; y: number },
  to: { x: number; y: number },
  assetsById?: Map<string, ObservatoryAssetDefinition>
) {
  if (from.x === to.x && from.y === to.y) {
    return [];
  }

  if (!isObservatoryGridWalkable(map, to, assetsById)) {
    return [];
  }

  const startKey = gridPointKey(from);
  const targetKey = gridPointKey(to);
  const queue = [from];
  const cameFrom = new Map<string, string | null>([[startKey, null]]);

  for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
    const current = queue[queueIndex];

    if (!current) {
      continue;
    }

    if (gridPointKey(current) === targetKey) {
      break;
    }

    for (const neighbor of getGridNeighbors(current)) {
      const neighborKey = gridPointKey(neighbor);

      if (cameFrom.has(neighborKey) || !isObservatoryGridWalkable(map, neighbor, assetsById)) {
        continue;
      }

      cameFrom.set(neighborKey, gridPointKey(current));
      queue.push(neighbor);
    }
  }

  if (!cameFrom.has(targetKey)) {
    return [];
  }

  const path: Array<{ x: number; y: number }> = [];
  let cursor: string | null = targetKey;

  while (cursor && cursor !== startKey) {
    path.push(parseGridPointKey(cursor));
    cursor = cameFrom.get(cursor) ?? null;
  }

  return path.reverse();
}

export function pickObservatoryRoomRoamPoint(
  map: ObservatoryMap,
  room: ObservatoryRoom,
  options: {
    assetsById?: Map<string, ObservatoryAssetDefinition>;
    fromPoint?: { x: number; y: number };
    seed?: number | string;
    tileSize?: number;
    occupiedPoints?: Array<{ x: number; y: number }>;
    occupiedFootPositions?: Array<{ x: number; y: number }>;
  } = {}
) {
  const { minX, maxX, minY, maxY } = observatoryRoomInteriorBounds(room);
  const width = Math.max(1, maxX - minX + 1);
  const height = Math.max(1, maxY - minY + 1);
  const start = hashString(String(options.seed ?? room.id)) % (width * height);

  for (let offset = 0; offset < width * height; offset += 1) {
    const cursor = (start + offset) % (width * height);
    const candidate = {
      x: minX + (cursor % width),
      y: minY + Math.floor(cursor / width),
    };

    if (
      isObservatoryGridWalkable(map, candidate, options.assetsById) &&
      !options.occupiedPoints?.some((point) => isSameGridPoint(point, candidate)) &&
      !isFootPositionOccupied(
        candidate,
        { x: 0, y: 0 },
        options.tileSize ?? 48,
        options.occupiedFootPositions
      ) &&
      (!options.fromPoint ||
        isSameGridPoint(options.fromPoint, candidate) ||
        resolveObservatoryGridPath(map, options.fromPoint, candidate, options.assetsById).length >
          0)
    ) {
      return candidate;
    }
  }

  return null;
}

export function isObservatoryGridWalkable(
  map: ObservatoryMap,
  point: { x: number; y: number },
  assetsById?: Map<string, ObservatoryAssetDefinition>
) {
  if (point.x < 0 || point.y < 0 || point.x >= map.size.width || point.y >= map.size.height) {
    return false;
  }

  if (!isObservatoryPointInsideRoomNetwork(map, point)) {
    return false;
  }

  return !map.objects.some((object) => {
    if (!object.blocksMovement) {
      return false;
    }

    const bounds = objectCollisionGridRect(object, assetsById);

    return (
      point.x >= bounds.x &&
      point.y >= bounds.y &&
      point.x < bounds.x + bounds.width &&
      point.y < bounds.y + bounds.height
    );
  });
}

export function isObservatoryPointInsideRoomNetwork(
  map: ObservatoryMap,
  point: { x: number; y: number }
) {
  return map.rooms.some((room) => {
    const interior = observatoryRoomInteriorBounds(room);
    const isInterior =
      point.x >= interior.minX &&
      point.x <= interior.maxX &&
      point.y >= interior.minY &&
      point.y <= interior.maxY;

    return isInterior || isObservatoryRoomTransitionPoint(room, point);
  });
}

function isObservatoryRoomTransitionPoint(room: ObservatoryRoom, point: { x: number; y: number }) {
  const transitionPoints = [
    ...(room.wallOpenings ?? []),
    ...(room.wallDoors ?? []),
    ...(room.wallEdgeOpenings ?? []).map((opening) => opening.point),
    ...(room.wallTileOpenings ?? []).map((opening) => opening.point),
  ];

  return transitionPoints.some(
    (transitionPoint) =>
      isSameGridPoint(transitionPoint, point) ||
      isSameGridPoint(getRoomTransitionThresholdPoint(room, transitionPoint), point)
  );
}

function getRoomTransitionThresholdPoint(room: ObservatoryRoom, point: { x: number; y: number }) {
  const center = {
    x: room.bounds.x + Math.floor(room.bounds.width / 2),
    y: room.bounds.y + Math.floor(room.bounds.height / 2),
  };

  if (point.x <= room.bounds.x) {
    return { x: point.x + 1, y: point.y };
  }

  if (point.x >= room.bounds.x + room.bounds.width - 1) {
    return { x: point.x - 1, y: point.y };
  }

  if (point.y <= room.bounds.y) {
    return { x: point.x, y: point.y + 1 };
  }

  if (point.y >= room.bounds.y + room.bounds.height - 1) {
    return { x: point.x, y: point.y - 1 };
  }

  return {
    x: point.x + Math.sign(center.x - point.x),
    y: point.y + Math.sign(center.y - point.y),
  };
}

export function observatoryRoomInteriorBounds(room: ObservatoryRoom) {
  const fallbackX = room.bounds.x + Math.floor((room.bounds.width - 1) / 2);
  const fallbackY = room.bounds.y + Math.floor((room.bounds.height - 1) / 2);

  return {
    maxX: room.bounds.width > 2 ? room.bounds.x + room.bounds.width - 2 : fallbackX,
    maxY: room.bounds.height > 3 ? room.bounds.y + room.bounds.height - 2 : fallbackY,
    minX: room.bounds.width > 2 ? room.bounds.x + 1 : fallbackX,
    minY: room.bounds.height > 3 ? room.bounds.y + 2 : fallbackY,
  };
}

export function classifyObservatoryObjectBehaviorRole(
  objectOrAssetId: ObservatoryObject | string,
  assetsById?: Map<string, ObservatoryAssetDefinition>
): ObservatoryBehaviorTargetRole {
  if (typeof objectOrAssetId !== 'string' && objectOrAssetId.runtime?.role === 'workstation')
    return 'computer';
  const assetId = typeof objectOrAssetId === 'string' ? objectOrAssetId : objectOrAssetId.assetId;
  const asset = assetsById?.get(assetId);
  const text = [
    assetId,
    asset?.catalogPath,
    asset?.category,
    asset?.label,
    asset?.semanticId,
    ...(asset?.tags ?? []),
  ]
    .join(' ')
    .toLowerCase();

  if (/(coffee|water|pantry|bottle|fridge|kitchen|tea|sink|counter)/.test(text)) {
    return 'pantry';
  }

  if (/(whiteboard|chalkboard|planning|bulletin|chart|wall-map|board)/.test(text)) {
    return 'planning';
  }

  if (/(server-rack|server-cart|server|runtime|terminal|rack)/.test(text)) {
    return 'runtime';
  }

  if (
    /(workstation|workbench|computer|laptop|monitor|screen|printer|keyboard|mouse|projector|office-machine)/.test(
      text
    )
  ) {
    return 'computer';
  }

  if (/(chair|sofa|seat|bench|stool|seating)/.test(text)) {
    return 'seating';
  }

  if (/(bookshelf|bookcase|cabinet|storage|shelf|locker|drawer)/.test(text)) {
    return 'storage';
  }

  if (/(conference-table|reading-table|study-table|table|desk|podium|lectern|counter)/.test(text)) {
    return 'surface';
  }

  return 'unknown';
}

export function isObservatoryAmbientObjectRole(role: ObservatoryBehaviorTargetRole) {
  return (
    role === 'pantry' ||
    role === 'planning' ||
    role === 'seating' ||
    role === 'storage' ||
    role === 'surface'
  );
}

function pickBehaviorTargetObject(
  map: ObservatoryMap,
  room: ObservatoryRoom,
  agent: ObservatoryAgent | undefined,
  options: ObservatoryAgentBehaviorTargetOptions
) {
  const behavior = agent?.runtime?.behavior ?? statusToBehavior(agent?.status);
  const preferredRoles = behaviorToPreferredRoles(behavior);
  const workflowId = agent?.runtime?.workflowId;
  const objects = map.objects
    .filter((object) => object.roomId === room.id)
    .filter((object) => {
      if (workflowId && object.runtime?.workflowId === workflowId) {
        return (
          object.runtime.behavior === behavior ||
          preferredRoles.has(classifyObservatoryObjectBehaviorRole(object, options.assetsById))
        );
      }

      if (object.runtime?.behavior === behavior) {
        return true;
      }

      return preferredRoles.has(classifyObservatoryObjectBehaviorRole(object, options.assetsById));
    })
    .sort((left, right) => left.id.localeCompare(right.id));

  if (objects.length === 0) {
    return undefined;
  }

  const seed = hashString(`${options.agentId}:${options.seed ?? ''}:${behavior}`);
  return objects[seed % objects.length];
}

function behaviorToPreferredRoles(
  behavior: NonNullable<ObservatoryAgent['runtime']>['behavior'] | undefined
) {
  if (behavior === 'planning' || behavior === 'approval') {
    return new Set<ObservatoryBehaviorTargetRole>(['planning', 'surface']);
  }

  if (behavior === 'executing' || behavior === 'working') {
    return new Set<ObservatoryBehaviorTargetRole>(['computer', 'runtime', 'surface']);
  }

  return new Set<ObservatoryBehaviorTargetRole>([
    'pantry',
    'planning',
    'seating',
    'storage',
    'surface',
  ]);
}

function statusToBehavior(
  status: ObservatoryAgent['status'] | undefined
): NonNullable<ObservatoryAgent['runtime']>['behavior'] {
  if (status === 'blocked') {
    return 'approval';
  }

  if (status === 'working') {
    return 'working';
  }

  return 'ambient';
}

export function objectCollisionGridRect(
  object: ObservatoryObject,
  assetsById?: Map<string, ObservatoryAssetDefinition>
) {
  // Cropped assemblies reserve their visible footprint in `size`; the pack's
  // collision offsets still refer to the original padded source canvas.
  const collision = object.render?.sourceCrop
    ? undefined
    : assetsById?.get(object.assetId)?.collision;
  const size = collision ?? object.size;

  return {
    height: size?.height ?? 1,
    width: size?.width ?? 1,
    x: object.position.x + (collision?.offsetX ?? 0),
    y: object.position.y + (collision?.offsetY ?? 0),
  };
}

function pickWalkableCandidate(
  map: ObservatoryMap,
  candidates: Array<{ x: number; y: number }>,
  assetsById?: Map<string, ObservatoryAssetDefinition>,
  fromPoint?: { x: number; y: number }
) {
  const walkableCandidates = dedupeGridPoints(candidates).filter((candidate) =>
    isObservatoryGridWalkable(map, candidate, assetsById)
  );

  if (fromPoint) {
    const reachableCandidate = walkableCandidates.find(
      (candidate) =>
        isSameGridPoint(fromPoint, candidate) ||
        resolveObservatoryGridPath(map, fromPoint, candidate, assetsById).length > 0
    );

    if (reachableCandidate) {
      return reachableCandidate;
    }
    // A walkable tile in a disconnected room is not a usable fallback.
    return null;
  }

  return walkableCandidates[0] ?? null;
}

function createObjectInteractionCandidates(
  bounds: { height: number; width: number; x: number; y: number },
  seed: number | string
) {
  const centerX = bounds.x + Math.floor((bounds.width - 1) / 2);
  const centerY = bounds.y + Math.floor((bounds.height - 1) / 2);
  // Corner-only contact can leave the avatar looking past the desk. Use tiles
  // that share an edge with the surface, especially when its chair is occupied.
  const horizontal = centerOutRange(bounds.x, bounds.x + bounds.width - 1, centerX);
  const vertical = centerOutRange(bounds.y, bounds.y + bounds.height - 1, centerY);
  const sideOffset = hashString(String(seed)) % 2;
  const sideGroups =
    sideOffset === 0
      ? [
          vertical.map((y) => ({ x: bounds.x + bounds.width, y })),
          vertical.map((y) => ({ x: bounds.x - 1, y })),
        ]
      : [
          vertical.map((y) => ({ x: bounds.x - 1, y })),
          vertical.map((y) => ({ x: bounds.x + bounds.width, y })),
        ];

  return [
    ...horizontal.map((x) => ({ x, y: bounds.y + bounds.height })),
    ...sideGroups[0],
    ...sideGroups[1],
    ...horizontal.map((x) => ({ x, y: bounds.y - 1 })),
  ];
}

function centerOutRange(min: number, max: number, center: number) {
  const values: number[] = [];

  for (let offset = 0; values.length < max - min + 1; offset += 1) {
    const left = center - offset;
    const right = center + offset;

    if (left >= min && left <= max) {
      values.push(left);
    }

    if (offset > 0 && right >= min && right <= max) {
      values.push(right);
    }
  }

  return values;
}

function dedupeGridPoints(points: Array<{ x: number; y: number }>) {
  const seen = new Set<string>();
  const uniquePoints: Array<{ x: number; y: number }> = [];

  for (const point of points) {
    const key = gridPointKey(point);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniquePoints.push(point);
  }

  return uniquePoints;
}

function getGridNeighbors(point: { x: number; y: number }) {
  return [
    { x: point.x + 1, y: point.y },
    { x: point.x - 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x, y: point.y - 1 },
  ];
}

function gridPointKey(point: { x: number; y: number }) {
  return `${point.x},${point.y}`;
}

function parseGridPointKey(key: string) {
  const [x = '0', y = '0'] = key.split(',');
  return { x: Number(x), y: Number(y) };
}

function isSameGridPoint(left: { x: number; y: number }, right: { x: number; y: number }) {
  return left.x === right.x && left.y === right.y;
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}
