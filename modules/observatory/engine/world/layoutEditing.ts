import type {
  ObservatoryGridPoint,
  ObservatoryGridRect,
  ObservatoryGridSize,
} from '@/modules/observatory/engine/world/grid';
import { pointInGridRect } from '@/modules/observatory/engine/world/grid';
import { validateObservatoryLayout } from '@/modules/observatory/engine/world/layoutValidation';
import { generateObservatoryCorridorRoom } from '@/modules/observatory/generation/corridorGeneration';
import {
  findObservatoryCollisionSafePlacement,
  generateObservatoryDoorObjects,
  validateObservatoryGeneratedLayout,
} from '@/modules/observatory/generation/proceduralLayoutRules';
import {
  createObservatoryTemplateObject,
  getObservatoryRoomTemplate,
  type ObservatoryPlacedRoomTemplate,
  type ObservatoryRoomTemplateId,
} from '@/modules/observatory/engine/world/roomTemplates';
import type {
  ObservatoryLayoutDocument,
  ObservatoryLayoutIssue,
  ObservatoryMap,
  ObservatoryObject,
  ObservatoryObjectRenderOptions,
  ObservatoryRoom,
  ObservatoryRoomWallEdgeOpening,
  ObservatoryRoomWallCellKind,
  ObservatoryRoomWallSide,
  ObservatoryRoomKind,
} from '@/modules/observatory/engine/world/layoutTypes';

export interface ObservatoryLayoutEditResult {
  changed: boolean;
  issues: ObservatoryLayoutIssue[];
  layout: ObservatoryLayoutDocument;
  message: string;
  placedTemplate?: ObservatoryPlacedRoomTemplate;
  selectedObjectId?: string;
  selectedRoomId?: string;
}

export interface ObservatoryPlaceObjectInput {
  assetId: string;
  blocksMovement?: boolean;
  id?: string;
  position: ObservatoryGridPoint;
  roomId?: string;
  size?: ObservatoryGridSize;
}

export interface ObservatoryCreateRoomInput {
  bounds: ObservatoryGridRect;
  floorAssetId?: string;
  id?: string;
  kind?: ObservatoryRoomKind;
  name?: string;
  wallAssetId?: string;
}

export interface ObservatoryUpdateObjectInput {
  blocksMovement?: boolean;
  position?: ObservatoryGridPoint;
  render?: ObservatoryObjectRenderOptions;
  roomId?: string | null;
  size?: ObservatoryGridSize;
}

type ObservatoryWallEditPoint = ObservatoryGridPoint & {
  wallSide?: ObservatoryRoomWallSide;
};

export function cloneObservatoryLayout(
  layout: ObservatoryLayoutDocument
): ObservatoryLayoutDocument {
  return JSON.parse(JSON.stringify(layout)) as ObservatoryLayoutDocument;
}

export function createBlankObservatoryLayout(
  layout: ObservatoryLayoutDocument
): ObservatoryLayoutDocument {
  const nextLayout = cloneObservatoryLayout(layout);
  const timestamp = new Date().toISOString();

  nextLayout.metadata = {
    ...nextLayout.metadata,
    notes: 'Blank canvas draft generated from the builder.',
    status: 'draft',
    updatedAt: timestamp,
  };

  nextLayout.world.maps = nextLayout.world.maps.map((map) => ({
    ...map,
    agents: [],
    objects: [],
    rooms: [],
  }));

  return nextLayout;
}

export function placeObservatoryObject(
  layout: ObservatoryLayoutDocument,
  mapId: string,
  input: ObservatoryPlaceObjectInput
): ObservatoryLayoutEditResult {
  const nextLayout = cloneObservatoryLayout(layout);
  const map = findMap(nextLayout, mapId);

  if (!map) {
    return fail(nextLayout, `Map not found: ${mapId}`, 'world.maps');
  }

  const size = normalizeSize(input.size);
  const requestedRoom = input.roomId
    ? map.rooms.find((room) => room.id === input.roomId)
    : undefined;
  if (input.roomId && !requestedRoom) {
    return fail(nextLayout, `Room not found: ${input.roomId}`, 'object.roomId');
  }

  const initialPosition =
    input.blocksMovement === false
      ? input.position
      : findObservatoryCollisionSafePlacement(map, size, input.position);

  if (!initialPosition) {
    return fail(nextLayout, 'No collision-safe object placement is available.', 'object.position');
  }

  const initialBounds = { ...initialPosition, ...size };
  const shouldRepositionIntoRoom = Boolean(
    requestedRoom && !rectIsInsideRoom(initialBounds, requestedRoom)
  );
  const finalPosition = shouldRepositionIntoRoom
    ? findPlacementInRoom(
        map,
        requestedRoom!,
        size,
        input.blocksMovement ?? true,
        map.objects,
        input.position
      )
    : initialPosition;

  if (!finalPosition) {
    return fail(
      nextLayout,
      `No valid placement is available inside ${requestedRoom?.name ?? input.roomId}.`,
      'object.roomId'
    );
  }

  const objectBounds = { ...finalPosition, ...size };
  if (!rectFitsMap(objectBounds, map)) {
    return fail(nextLayout, 'Object must fit inside the map bounds.', 'object.position');
  }

  const roomId = input.roomId ?? findRoomContainingRect(map, objectBounds)?.id;
  if (roomId && !map.rooms.some((room) => room.id === roomId)) {
    return fail(nextLayout, `Room not found: ${roomId}`, 'object.roomId');
  }

  const object: ObservatoryObject = {
    assetId: input.assetId,
    blocksMovement: input.blocksMovement ?? true,
    id:
      input.id ??
      createNextId(
        'object:manual',
        map.objects.map((candidate) => candidate.id)
      ),
    position: { ...finalPosition },
    roomId,
    size,
  };

  map.objects.push(object);
  return finalize(nextLayout, `Placed ${object.id}.`, { selectedObjectId: object.id });
}

export function moveObservatoryObject(
  layout: ObservatoryLayoutDocument,
  mapId: string,
  objectId: string,
  position: ObservatoryGridPoint
): ObservatoryLayoutEditResult {
  return updateObservatoryObject(layout, mapId, objectId, { position }, 'Moved');
}

export function updateObservatoryObject(
  layout: ObservatoryLayoutDocument,
  mapId: string,
  objectId: string,
  input: ObservatoryUpdateObjectInput,
  actionLabel = 'Updated'
): ObservatoryLayoutEditResult {
  const nextLayout = cloneObservatoryLayout(layout);
  const map = findMap(nextLayout, mapId);

  if (!map) {
    return fail(nextLayout, `Map not found: ${mapId}`, 'world.maps');
  }

  const object = map.objects.find((candidate) => candidate.id === objectId);
  if (!object) {
    return fail(nextLayout, `Object not found: ${objectId}`, 'object.id');
  }

  const size = input.size !== undefined ? normalizeSize(input.size) : normalizeSize(object.size);
  const position = input.position !== undefined ? normalizePoint(input.position) : object.position;
  const blocksMovement = input.blocksMovement ?? object.blocksMovement ?? true;
  const temporaryObjects = map.objects.filter((candidate) => candidate.id !== objectId);
  const safePosition =
    blocksMovement === false
      ? position
      : findObservatoryCollisionSafePlacement(
          { ...map, objects: temporaryObjects },
          size,
          position
        );

  if (!safePosition || safePosition.x !== position.x || safePosition.y !== position.y) {
    return fail(
      nextLayout,
      'Object position collides with another blocking object or exceeds the map bounds.',
      'object.position'
    );
  }

  const bounds = { ...safePosition, ...size };
  if (!rectFitsMap(bounds, map)) {
    return fail(nextLayout, 'Object must fit inside the map bounds.', 'object.position');
  }

  const explicitRoomId =
    input.roomId === null
      ? undefined
      : input.roomId !== undefined
        ? input.roomId
        : findRoomContainingRect(map, bounds)?.id;
  if (explicitRoomId && !map.rooms.some((room) => room.id === explicitRoomId)) {
    return fail(nextLayout, `Room not found: ${explicitRoomId}`, 'object.roomId');
  }

  const targetRoom = explicitRoomId
    ? map.rooms.find((room) => room.id === explicitRoomId)
    : undefined;
  const shouldRepositionIntoRoom = Boolean(targetRoom && !rectIsInsideRoom(bounds, targetRoom));
  const finalPosition = shouldRepositionIntoRoom
    ? findPlacementInRoom(map, targetRoom!, size, blocksMovement, temporaryObjects, safePosition)
    : safePosition;

  if (!finalPosition) {
    return fail(
      nextLayout,
      `No valid placement is available inside ${targetRoom?.name ?? explicitRoomId}.`,
      'object.roomId'
    );
  }

  const finalBounds = { ...finalPosition, ...size };
  if (!rectFitsMap(finalBounds, map)) {
    return fail(nextLayout, 'Object must fit inside the map bounds.', 'object.position');
  }

  const roomId = explicitRoomId ?? findRoomContainingRect(map, finalBounds)?.id;
  object.position = { ...finalPosition };
  object.blocksMovement = blocksMovement;
  object.roomId = roomId;
  object.render = input.render !== undefined ? normalizeObjectRender(input.render) : object.render;
  object.size = input.size !== undefined || object.size !== undefined ? size : undefined;
  return finalize(
    nextLayout,
    `${actionLabel} ${object.id} at ${finalPosition.x}, ${finalPosition.y}.`,
    { selectedObjectId: object.id }
  );
}

export function deleteObservatoryObject(
  layout: ObservatoryLayoutDocument,
  mapId: string,
  objectId: string
): ObservatoryLayoutEditResult {
  const nextLayout = cloneObservatoryLayout(layout);
  const map = findMap(nextLayout, mapId);

  if (!map) {
    return fail(nextLayout, `Map not found: ${mapId}`, 'world.maps');
  }

  const originalLength = map.objects.length;
  map.objects = map.objects.filter((object) => object.id !== objectId);

  if (map.objects.length === originalLength) {
    return fail(nextLayout, `Object not found: ${objectId}`, 'object.id');
  }

  return finalize(nextLayout, `Deleted ${objectId}.`);
}

export function duplicateObservatoryObject(
  layout: ObservatoryLayoutDocument,
  mapId: string,
  objectId: string
): ObservatoryLayoutEditResult {
  const nextLayout = cloneObservatoryLayout(layout);
  const map = findMap(nextLayout, mapId);

  if (!map) {
    return fail(nextLayout, `Map not found: ${mapId}`, 'world.maps');
  }

  const sourceObject = map.objects.find((candidate) => candidate.id === objectId);
  if (!sourceObject) {
    return fail(nextLayout, `Object not found: ${objectId}`, 'object.id');
  }

  const size = normalizeSize(sourceObject.size);
  const blocksMovement = sourceObject.blocksMovement ?? true;
  const duplicateId = createNextId(
    'object:manual',
    map.objects.map((candidate) => candidate.id)
  );
  const preferredPositions: ObservatoryGridPoint[] = [
    { x: sourceObject.position.x + 1, y: sourceObject.position.y },
    { x: sourceObject.position.x, y: sourceObject.position.y + 1 },
    { x: sourceObject.position.x + 1, y: sourceObject.position.y + 1 },
    { x: sourceObject.position.x, y: sourceObject.position.y },
  ].map(normalizePoint);

  let finalPosition: ObservatoryGridPoint | undefined;
  const room = sourceObject.roomId
    ? map.rooms.find((candidate) => candidate.id === sourceObject.roomId)
    : undefined;
  const otherObjects = map.objects;

  if (room) {
    for (const preferredPosition of preferredPositions) {
      finalPosition = findPlacementInRoom(
        map,
        room,
        size,
        blocksMovement,
        otherObjects,
        preferredPosition
      );
      if (finalPosition) {
        break;
      }
    }
  } else {
    for (const preferredPosition of preferredPositions) {
      const safePosition = blocksMovement
        ? findObservatoryCollisionSafePlacement(map, size, preferredPosition)
        : preferredPosition;
      const candidateRect = safePosition ? { ...safePosition, ...size } : null;

      if (safePosition && candidateRect && rectFitsMap(candidateRect, map)) {
        finalPosition = safePosition;
        break;
      }
    }
  }

  if (!finalPosition) {
    return fail(
      nextLayout,
      `No collision-safe duplicate placement is available for ${objectId}.`,
      'object.position'
    );
  }

  map.objects.push({
    assetId: sourceObject.assetId,
    blocksMovement,
    id: duplicateId,
    position: { ...finalPosition },
    render: normalizeObjectRender(sourceObject.render),
    roomId: sourceObject.roomId,
    runtime: sourceObject.runtime ? { ...sourceObject.runtime } : undefined,
    size,
  });

  return finalize(nextLayout, `Duplicated ${objectId} as ${duplicateId}.`, {
    selectedObjectId: duplicateId,
  });
}

export function deleteObservatoryRoom(
  layout: ObservatoryLayoutDocument,
  mapId: string,
  roomId: string
): ObservatoryLayoutEditResult {
  const nextLayout = cloneObservatoryLayout(layout);
  const map = findMap(nextLayout, mapId);

  if (!map) {
    return fail(nextLayout, `Map not found: ${mapId}`, 'world.maps');
  }

  const originalLength = map.rooms.length;
  map.rooms = map.rooms.filter((room) => room.id !== roomId);

  if (map.rooms.length === originalLength) {
    return fail(nextLayout, `Room not found: ${roomId}`, 'room.id');
  }

  reassignRoomScopedObjects(map);
  return finalize(nextLayout, `Deleted ${roomId}.`);
}

export function resizeObservatoryRoom(
  layout: ObservatoryLayoutDocument,
  mapId: string,
  roomId: string,
  bounds: ObservatoryGridRect
): ObservatoryLayoutEditResult {
  const nextLayout = cloneObservatoryLayout(layout);
  const map = findMap(nextLayout, mapId);

  if (!map) {
    return fail(nextLayout, `Map not found: ${mapId}`, 'world.maps');
  }

  const room = map.rooms.find((candidate) => candidate.id === roomId);
  if (!room) {
    return fail(nextLayout, `Room not found: ${roomId}`, 'room.id');
  }

  const nextBounds = normalizeRect(bounds);
  if (!rectFitsMap(nextBounds, map)) {
    return fail(nextLayout, 'Room must fit inside the map bounds.', 'room.bounds');
  }

  room.bounds = nextBounds;
  reassignRoomScopedObjects(map);
  return finalize(nextLayout, `Resized ${room.id} to ${nextBounds.width}x${nextBounds.height}.`, {
    selectedRoomId: room.id,
  });
}

export function moveObservatoryRoom(
  layout: ObservatoryLayoutDocument,
  mapId: string,
  roomId: string,
  origin: ObservatoryGridPoint
): ObservatoryLayoutEditResult {
  const nextLayout = cloneObservatoryLayout(layout);
  const map = findMap(nextLayout, mapId);

  if (!map) {
    return fail(nextLayout, `Map not found: ${mapId}`, 'world.maps');
  }

  const room = map.rooms.find((candidate) => candidate.id === roomId);
  if (!room) {
    return fail(nextLayout, `Room not found: ${roomId}`, 'room.id');
  }

  const nextBounds = normalizeRect({
    ...room.bounds,
    x: origin.x,
    y: origin.y,
  });
  if (!rectFitsMap(nextBounds, map)) {
    return fail(nextLayout, 'Room must fit inside the map bounds.', 'room.bounds');
  }

  const deltaX = nextBounds.x - room.bounds.x;
  const deltaY = nextBounds.y - room.bounds.y;
  const roomObjects = map.objects.filter((object) => object.roomId === room.id);
  const movedObjects = roomObjects.map((object) => {
    const size = normalizeSize(object.size);
    return {
      ...object,
      position: {
        x: object.position.x + deltaX,
        y: object.position.y + deltaY,
      },
      size,
    };
  });

  const roomObjectsFit = movedObjects.every((object) =>
    rectFitsMap({ ...object.position, ...object.size }, map)
  );
  if (!roomObjectsFit) {
    return fail(nextLayout, 'Room contents would move outside the map bounds.', 'room.bounds');
  }

  room.bounds = nextBounds;
  movedObjects.forEach((movedObject) => {
    const target = map.objects.find((object) => object.id === movedObject.id);
    if (target) {
      target.position = movedObject.position;
    }
  });
  reassignRoomScopedObjects(map);
  return finalize(nextLayout, `Moved ${room.id} to ${nextBounds.x}, ${nextBounds.y}.`, {
    selectedRoomId: room.id,
  });
}

export function setObservatoryRoomFloorAsset(
  layout: ObservatoryLayoutDocument,
  mapId: string,
  roomId: string,
  floorAssetId: string
): ObservatoryLayoutEditResult {
  const nextLayout = cloneObservatoryLayout(layout);
  const map = findMap(nextLayout, mapId);

  if (!map) {
    return fail(nextLayout, `Map not found: ${mapId}`, 'world.maps');
  }

  const room = map.rooms.find((candidate) => candidate.id === roomId);
  if (!room) {
    return fail(nextLayout, `Room not found: ${roomId}`, 'room.id');
  }

  room.floorAssetId = floorAssetId;
  return finalize(nextLayout, `Applied ${floorAssetId} to ${room.id}.`, {
    selectedRoomId: room.id,
  });
}

export function setObservatoryRoomFloorCellAsset(
  layout: ObservatoryLayoutDocument,
  mapId: string,
  roomId: string,
  point: ObservatoryGridPoint,
  floorAssetId: string
): ObservatoryLayoutEditResult {
  const nextLayout = cloneObservatoryLayout(layout);
  const map = findMap(nextLayout, mapId);

  if (!map) {
    return fail(nextLayout, `Map not found: ${mapId}`, 'world.maps');
  }

  const room = map.rooms.find((candidate) => candidate.id === roomId);
  if (!room) {
    return fail(nextLayout, `Room not found: ${roomId}`, 'room.id');
  }

  if (!pointInGridRect(point, room.bounds)) {
    return fail(
      nextLayout,
      'Floor edits must target a cell inside the selected room.',
      'room.floorAssetOverrides'
    );
  }

  applyRoomFloorCellAsset(room, point, floorAssetId);
  return finalize(
    nextLayout,
    `Painted floor cell ${point.x}, ${point.y} for ${room.id} with ${floorAssetId}.`,
    { selectedRoomId: room.id }
  );
}

export function setObservatoryRoomWallAsset(
  layout: ObservatoryLayoutDocument,
  mapId: string,
  roomId: string,
  wallAssetId: string
): ObservatoryLayoutEditResult {
  const nextLayout = cloneObservatoryLayout(layout);
  const map = findMap(nextLayout, mapId);

  if (!map) {
    return fail(nextLayout, `Map not found: ${mapId}`, 'world.maps');
  }

  const room = map.rooms.find((candidate) => candidate.id === roomId);
  if (!room) {
    return fail(nextLayout, `Room not found: ${roomId}`, 'room.id');
  }

  room.wallAssetId = wallAssetId;
  return finalize(nextLayout, `Applied ${wallAssetId} to ${room.id}.`, { selectedRoomId: room.id });
}

export function setObservatoryRoomWallCellAsset(
  layout: ObservatoryLayoutDocument,
  mapId: string,
  roomId: string,
  point: ObservatoryWallEditPoint,
  wallAssetId: string
): ObservatoryLayoutEditResult {
  const nextLayout = cloneObservatoryLayout(layout);
  const map = findMap(nextLayout, mapId);

  if (!map) {
    return fail(nextLayout, `Map not found: ${mapId}`, 'world.maps');
  }

  const room = map.rooms.find((candidate) => candidate.id === roomId);
  if (!room) {
    return fail(nextLayout, `Room not found: ${roomId}`, 'room.id');
  }

  if (!hasRoomWallEditTarget(room, point)) {
    return fail(
      nextLayout,
      'Wall edits must target a room perimeter cell.',
      'room.wallAssetOverrides'
    );
  }

  applyRoomWallCellKind(room, point, 'wall');
  applyRoomWallCellAsset(room, point, wallAssetId);

  return finalize(
    nextLayout,
    `Painted wall cell ${point.x}, ${point.y} for ${room.id} with ${wallAssetId}.`,
    { selectedRoomId: room.id }
  );
}

export function toggleObservatoryRoomWallCell(
  layout: ObservatoryLayoutDocument,
  mapId: string,
  roomId: string,
  point: ObservatoryWallEditPoint
): ObservatoryLayoutEditResult {
  return toggleObservatoryRoomWallCellKind(layout, mapId, roomId, point, 'opening');
}

export function toggleObservatoryRoomWallCellKind(
  layout: ObservatoryLayoutDocument,
  mapId: string,
  roomId: string,
  point: ObservatoryWallEditPoint,
  kind: Exclude<ObservatoryRoomWallCellKind, 'wall'>
): ObservatoryLayoutEditResult {
  const nextLayout = cloneObservatoryLayout(layout);
  const map = findMap(nextLayout, mapId);

  if (!map) {
    return fail(nextLayout, `Map not found: ${mapId}`, 'world.maps');
  }

  const room = map.rooms.find((candidate) => candidate.id === roomId);
  if (!room) {
    return fail(nextLayout, `Room not found: ${roomId}`, 'room.id');
  }

  if (!hasRoomWallEditTarget(room, point)) {
    return fail(nextLayout, 'Wall edits must target a room perimeter cell.', 'room.wallOpenings');
  }

  const nextKind = getRoomWallCellKind(room, point) === kind ? 'wall' : kind;
  applyRoomWallCellKind(room, point, nextKind);

  return finalize(
    nextLayout,
    `Updated ${nextKind} wall cell ${point.x}, ${point.y} for ${room.id}.`,
    { selectedRoomId: room.id }
  );
}

export function toggleObservatoryRoomWallTile(
  layout: ObservatoryLayoutDocument,
  mapId: string,
  roomId: string,
  point: ObservatoryWallEditPoint
): ObservatoryLayoutEditResult {
  const nextLayout = cloneObservatoryLayout(layout);
  const map = findMap(nextLayout, mapId);

  if (!map) {
    return fail(nextLayout, `Map not found: ${mapId}`, 'world.maps');
  }

  const room = map.rooms.find((candidate) => candidate.id === roomId);
  if (!room) {
    return fail(nextLayout, `Room not found: ${roomId}`, 'room.id');
  }

  if (!hasRoomWallTileEditTarget(room, point)) {
    return fail(
      nextLayout,
      'Wall tile edits must target a north wall tile.',
      'room.wallTileOpenings'
    );
  }

  const nextHidden = !isRoomWallTileHidden(room, point);
  applyRoomWallTileHidden(room, point, nextHidden);

  return finalize(
    nextLayout,
    `${nextHidden ? 'Removed' : 'Restored'} wall tile ${point.x}, ${point.y} for ${room.id}.`,
    { selectedRoomId: room.id }
  );
}

export function setObservatoryMapDefaultFloorAsset(
  layout: ObservatoryLayoutDocument,
  mapId: string,
  floorAssetId: string
): ObservatoryLayoutEditResult {
  const nextLayout = cloneObservatoryLayout(layout);
  const map = findMap(nextLayout, mapId);

  if (!map) {
    return fail(nextLayout, `Map not found: ${mapId}`, 'world.maps');
  }

  map.defaultFloorAssetId = floorAssetId;
  return finalize(nextLayout, `Set map default floor to ${floorAssetId}.`);
}

export function createObservatoryRoom(
  layout: ObservatoryLayoutDocument,
  mapId: string,
  input: ObservatoryCreateRoomInput
): ObservatoryLayoutEditResult {
  const nextLayout = cloneObservatoryLayout(layout);
  const map = findMap(nextLayout, mapId);

  if (!map) {
    return fail(nextLayout, `Map not found: ${mapId}`, 'world.maps');
  }

  const bounds = normalizeRect(input.bounds);
  if (!rectFitsMap(bounds, map)) {
    return fail(nextLayout, 'Room must fit inside the map bounds.', 'room.bounds');
  }

  const room: ObservatoryRoom = {
    bounds,
    floorAssetId: input.floorAssetId ?? map.defaultFloorAssetId,
    id:
      input.id ??
      createNextId(
        'room:manual',
        map.rooms.map((candidate) => candidate.id)
      ),
    kind: input.kind ?? 'workspace',
    name: input.name ?? `Manual Room ${map.rooms.length + 1}`,
    wallAssetId: input.wallAssetId,
  };

  map.rooms.push(room);
  reassignRoomScopedObjects(map);
  return finalize(nextLayout, `Created ${room.name}.`, { selectedRoomId: room.id });
}

export function placeObservatoryRoomTemplate(
  layout: ObservatoryLayoutDocument,
  mapId: string,
  templateId: ObservatoryRoomTemplateId,
  origin?: ObservatoryGridPoint
): ObservatoryLayoutEditResult {
  const nextLayout = cloneObservatoryLayout(layout);
  const map = findMap(nextLayout, mapId);
  const template = getObservatoryRoomTemplate(templateId);

  if (!map) {
    return fail(nextLayout, `Map not found: ${mapId}`, 'world.maps');
  }

  if (!template) {
    return fail(nextLayout, `Room template not found: ${templateId}`, 'template.id');
  }

  const placementOrigin =
    origin ??
    findObservatoryCollisionSafePlacement(
      map,
      template.size,
      findNextTemplateOrigin(map, template.size)
    );
  if (!placementOrigin) {
    return fail(
      nextLayout,
      `No collision-safe placement is available for ${template.label}.`,
      'template.bounds'
    );
  }

  const bounds = { ...placementOrigin, ...template.size };
  if (!rectFitsMap(bounds, map)) {
    return fail(nextLayout, `${template.label} must fit inside the map bounds.`, 'template.bounds');
  }

  const roomId = createNextId(
    `room:${template.id}`,
    map.rooms.map((candidate) => candidate.id)
  );
  const objectIds: string[] = [];

  map.rooms.push({
    bounds,
    floorAssetId: map.defaultFloorAssetId,
    id: roomId,
    kind: template.kind,
    name: template.defaultName,
    wallAssetId: template.wallAssetId,
  });

  template.objects.forEach((object, index) => {
    const objectId = createNextId(`object:${template.id}-${index + 1}`, [
      ...map.objects.map((candidate) => candidate.id),
      ...objectIds,
    ]);
    objectIds.push(objectId);
    map.objects.push(
      createObservatoryTemplateObject(template, object, roomId, objectId, placementOrigin)
    );
  });

  return finalize(nextLayout, `Placed ${template.label}.`, {
    placedTemplate: { objectIds, roomId },
    selectedObjectId: objectIds[0],
    selectedRoomId: roomId,
  });
}

export function createObservatoryCorridor(
  layout: ObservatoryLayoutDocument,
  mapId: string
): ObservatoryLayoutEditResult {
  const nextLayout = cloneObservatoryLayout(layout);
  const map = findMap(nextLayout, mapId);

  if (!map) {
    return fail(nextLayout, `Map not found: ${mapId}`, 'world.maps');
  }

  const corridor = generateObservatoryCorridorRoom(map, {
    id: createNextId(
      'room:corridor',
      map.rooms.map((candidate) => candidate.id)
    ),
    wallAssetId: 'wall:office-partition',
  });

  if (!rectFitsMap(corridor.bounds, map)) {
    return fail(nextLayout, 'Corridor must fit inside the map bounds.', 'corridor.bounds');
  }

  map.rooms.push(corridor);
  return finalize(nextLayout, `Generated ${corridor.name}.`, { selectedRoomId: corridor.id });
}

export function applyObservatoryProceduralLayoutRules(
  layout: ObservatoryLayoutDocument,
  mapId: string
): ObservatoryLayoutEditResult {
  const nextLayout = cloneObservatoryLayout(layout);
  const map = findMap(nextLayout, mapId);

  if (!map) {
    return fail(nextLayout, `Map not found: ${mapId}`, 'world.maps');
  }

  const existingDoorRoomIds = new Set(
    map.objects
      .filter((object) => object.id.startsWith('object:door-'))
      .map((object) => object.roomId)
      .filter((roomId): roomId is string => Boolean(roomId))
  );
  const doorsToAdd = generateObservatoryDoorObjects(map).filter(
    (door) => !existingDoorRoomIds.has(door.roomId ?? '')
  );
  map.objects.push(...doorsToAdd);

  const validation = validateObservatoryGeneratedLayout(map);
  if (!validation.valid) {
    return {
      changed: false,
      issues: validation.issues,
      layout: nextLayout,
      message: 'Procedural layout rules found issues.',
    };
  }

  return finalize(
    nextLayout,
    `Applied procedural rules: ${doorsToAdd.length} doors placed and layout is walkable.`
  );
}

function finalize(
  layout: ObservatoryLayoutDocument,
  message: string,
  selection: Pick<
    ObservatoryLayoutEditResult,
    'placedTemplate' | 'selectedObjectId' | 'selectedRoomId'
  > = {}
): ObservatoryLayoutEditResult {
  const validation = validateObservatoryLayout(layout);

  if (!validation.layout) {
    return {
      changed: false,
      issues: validation.issues,
      layout,
      message: 'Edit produced an invalid layout.',
      ...selection,
    };
  }

  return {
    changed: true,
    issues: [],
    layout: validation.layout,
    message,
    ...selection,
  };
}

function fail(
  layout: ObservatoryLayoutDocument,
  message: string,
  path: string
): ObservatoryLayoutEditResult {
  return {
    changed: false,
    issues: [{ path, reason: message }],
    layout,
    message,
  };
}

function findMap(layout: ObservatoryLayoutDocument, mapId: string) {
  return layout.world.maps.find((map) => map.id === mapId);
}

function normalizeSize(size: ObservatoryGridSize | undefined): ObservatoryGridSize {
  return {
    height: Math.max(1, Math.floor(size?.height ?? 1)),
    width: Math.max(1, Math.floor(size?.width ?? 1)),
  };
}

function normalizePoint(point: ObservatoryGridPoint): ObservatoryGridPoint {
  return {
    x: Math.max(0, Math.floor(point.x)),
    y: Math.max(0, Math.floor(point.y)),
  };
}

function normalizeObjectRender(
  render: ObservatoryObjectRenderOptions | undefined
): ObservatoryObjectRenderOptions | undefined {
  if (!render) {
    return undefined;
  }

  const normalized: ObservatoryObjectRenderOptions = {};

  if (render.depth !== undefined) {
    normalized.depth = render.depth;
  }

  if (render.offsetPx) {
    normalized.offsetPx = {
      x: render.offsetPx.x,
      y: render.offsetPx.y,
    };
  }

  if (render.sizePx) {
    normalized.sizePx = {
      height: Math.max(1, render.sizePx.height),
      width: Math.max(1, render.sizePx.width),
    };
  }

  if (render.sourceCrop) {
    normalized.sourceCrop = {
      height: Math.max(1, Math.floor(render.sourceCrop.height)),
      width: Math.max(1, Math.floor(render.sourceCrop.width)),
      x: Math.max(0, Math.floor(render.sourceCrop.x)),
      y: Math.max(0, Math.floor(render.sourceCrop.y)),
    };
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeRect(rect: ObservatoryGridRect): ObservatoryGridRect {
  return {
    height: Math.max(1, Math.floor(rect.height)),
    width: Math.max(1, Math.floor(rect.width)),
    x: Math.max(0, Math.floor(rect.x)),
    y: Math.max(0, Math.floor(rect.y)),
  };
}

function rectFitsMap(rect: ObservatoryGridRect, map: ObservatoryMap): boolean {
  return (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.width <= map.size.width &&
    rect.y + rect.height <= map.size.height
  );
}

function rectIsInsideRoom(rect: ObservatoryGridRect, room: ObservatoryRoom): boolean {
  return (
    pointInGridRect({ x: rect.x, y: rect.y }, room.bounds) &&
    pointInGridRect({ x: rect.x + rect.width - 1, y: rect.y + rect.height - 1 }, room.bounds)
  );
}

function findRoomContainingRect(map: ObservatoryMap, rect: ObservatoryGridRect) {
  return map.rooms.find((room) => rectIsInsideRoom(rect, room));
}

function findPlacementInRoom(
  map: ObservatoryMap,
  room: ObservatoryRoom,
  size: ObservatoryGridSize,
  blocksMovement: boolean,
  otherObjects: ObservatoryObject[],
  preferred: ObservatoryGridPoint
): ObservatoryGridPoint | undefined {
  const maxX = room.bounds.x + room.bounds.width - size.width;
  const maxY = room.bounds.y + room.bounds.height - size.height;
  const candidates: ObservatoryGridPoint[] = [];

  if (
    preferred.x >= room.bounds.x &&
    preferred.x <= maxX &&
    preferred.y >= room.bounds.y &&
    preferred.y <= maxY
  ) {
    candidates.push(preferred);
  }

  const centerCandidate = {
    x: Math.max(
      room.bounds.x,
      Math.min(maxX, room.bounds.x + Math.floor((room.bounds.width - size.width) / 2))
    ),
    y: Math.max(
      room.bounds.y,
      Math.min(maxY, room.bounds.y + Math.floor((room.bounds.height - size.height) / 2))
    ),
  };
  if (
    !candidates.some(
      (candidate) => candidate.x === centerCandidate.x && candidate.y === centerCandidate.y
    )
  ) {
    candidates.push(centerCandidate);
  }

  for (let y = room.bounds.y; y <= maxY; y += 1) {
    for (let x = room.bounds.x; x <= maxX; x += 1) {
      candidates.push({ x, y });
    }
  }

  for (const candidate of candidates) {
    const candidateRect = { ...candidate, ...size };
    if (!rectFitsMap(candidateRect, map) || !rectIsInsideRoom(candidateRect, room)) {
      continue;
    }

    if (
      !blocksMovement ||
      !otherObjects.some(
        (object) =>
          (object.blocksMovement ?? true) &&
          rectsOverlap(candidateRect, { ...object.position, ...normalizeSize(object.size) })
      )
    ) {
      return candidate;
    }
  }

  return undefined;
}

function rectsOverlap(first: ObservatoryGridRect, second: ObservatoryGridRect): boolean {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

const roomWallSideOrder: ObservatoryRoomWallSide[] = ['north', 'east', 'south', 'west'];

function hasRoomWallEditTarget(room: ObservatoryRoom, point: ObservatoryWallEditPoint) {
  return resolveRoomWallEditSides(room, point).length > 0;
}

function hasRoomWallTileEditTarget(room: ObservatoryRoom, point: ObservatoryWallEditPoint) {
  return resolveRoomWallTileEditSides(room, point).length > 0;
}

function isRoomPerimeterPoint(room: ObservatoryRoom, point: ObservatoryGridPoint) {
  return getRoomPerimeterSides(room, point).length > 0;
}

function getRoomPerimeterSides(
  room: ObservatoryRoom,
  point: ObservatoryGridPoint
): ObservatoryRoomWallSide[] {
  if (!pointInGridRect(point, room.bounds)) {
    return [];
  }

  const minX = room.bounds.x;
  const maxX = room.bounds.x + room.bounds.width - 1;
  const minY = room.bounds.y;
  const maxY = room.bounds.y + room.bounds.height - 1;
  const sides: ObservatoryRoomWallSide[] = [];

  if (point.y === minY) {
    sides.push('north');
  }

  if (point.x === maxX) {
    sides.push('east');
  }

  if (point.y === maxY) {
    sides.push('south');
  }

  if (point.x === minX) {
    sides.push('west');
  }

  return sides;
}

function resolveRoomWallEditSides(
  room: ObservatoryRoom,
  point: ObservatoryWallEditPoint
): ObservatoryRoomWallSide[] {
  const perimeterSides = getRoomPerimeterSides(room, point);

  if (!point.wallSide) {
    return perimeterSides;
  }

  return perimeterSides.includes(point.wallSide) ? [point.wallSide] : [];
}

function resolveRoomWallTileEditSides(
  room: ObservatoryRoom,
  point: ObservatoryWallEditPoint
): ObservatoryRoomWallSide[] {
  return resolveRoomWallEditSides(room, point).filter((side) => side === 'north');
}

function getRoomWallCellKind(
  room: ObservatoryRoom,
  point: ObservatoryWallEditPoint
): ObservatoryRoomWallCellKind {
  const key = createGridPointKey(point);
  if ((room.wallDoors ?? []).some((door) => createGridPointKey(door) === key)) {
    return 'door';
  }

  if ((room.wallOpenings ?? []).some((opening) => createGridPointKey(opening) === key)) {
    return 'opening';
  }

  if (point.wallSide) {
    return isRoomWallSideOpen(room, point, point.wallSide) ? 'opening' : 'wall';
  }

  const targetSides = resolveRoomWallEditSides(room, point);
  if (
    targetSides.length > 0 &&
    targetSides.every((side) => isRoomWallSideOpen(room, point, side))
  ) {
    return 'opening';
  }

  return 'wall';
}

function applyRoomWallCellKind(
  room: ObservatoryRoom,
  point: ObservatoryWallEditPoint,
  kind: ObservatoryRoomWallCellKind
) {
  const key = createGridPointKey(point);
  const openings = new Set((room.wallOpenings ?? []).map(createGridPointKey));
  const doors = new Set((room.wallDoors ?? []).map(createGridPointKey));
  const edgeOpenings = new Set(
    (room.wallEdgeOpenings ?? []).map((opening) => createRoomWallEdgeOpeningKey(opening))
  );
  const tileOpenings = new Set(
    (room.wallTileOpenings ?? []).map((opening) => createRoomWallEdgeOpeningKey(opening))
  );
  const perimeterSides = getRoomPerimeterSides(room, point);
  const targetSides = resolveRoomWallEditSides(room, point);

  if (targetSides.length === 0) {
    return;
  }

  if (point.wallSide) {
    if (openings.has(key)) {
      perimeterSides.forEach((side) => edgeOpenings.add(createRoomWallEdgeOpeningKey(point, side)));
      openings.delete(key);
    }

    if (kind === 'wall') {
      targetSides.forEach((side) => edgeOpenings.delete(createRoomWallEdgeOpeningKey(point, side)));
      targetSides.forEach((side) => tileOpenings.delete(createRoomWallEdgeOpeningKey(point, side)));
      doors.delete(key);
    } else if (kind === 'opening') {
      targetSides.forEach((side) => edgeOpenings.add(createRoomWallEdgeOpeningKey(point, side)));
      targetSides.forEach((side) => tileOpenings.delete(createRoomWallEdgeOpeningKey(point, side)));
      doors.delete(key);
      applyRoomWallCellAsset(room, point, room.wallAssetId ?? null);
    } else {
      targetSides.forEach((side) => edgeOpenings.add(createRoomWallEdgeOpeningKey(point, side)));
      targetSides.forEach((side) => tileOpenings.delete(createRoomWallEdgeOpeningKey(point, side)));
      doors.add(key);
    }
  } else if (kind === 'wall') {
    openings.delete(key);
    perimeterSides.forEach((side) =>
      edgeOpenings.delete(createRoomWallEdgeOpeningKey(point, side))
    );
    perimeterSides.forEach((side) =>
      tileOpenings.delete(createRoomWallEdgeOpeningKey(point, side))
    );
    doors.delete(key);
  } else if (kind === 'opening') {
    openings.add(key);
    perimeterSides.forEach((side) =>
      edgeOpenings.delete(createRoomWallEdgeOpeningKey(point, side))
    );
    perimeterSides.forEach((side) =>
      tileOpenings.delete(createRoomWallEdgeOpeningKey(point, side))
    );
    doors.delete(key);
    applyRoomWallCellAsset(room, point, room.wallAssetId ?? null);
  } else {
    openings.add(key);
    perimeterSides.forEach((side) =>
      edgeOpenings.delete(createRoomWallEdgeOpeningKey(point, side))
    );
    perimeterSides.forEach((side) =>
      tileOpenings.delete(createRoomWallEdgeOpeningKey(point, side))
    );
    doors.add(key);
  }

  const nextOpenings = sortGridPointsFromKeys(openings);
  const nextDoors = sortGridPointsFromKeys(doors);
  const nextEdgeOpenings = sortRoomWallEdgeOpeningsFromKeys(edgeOpenings);
  const nextTileOpenings = sortRoomWallEdgeOpeningsFromKeys(tileOpenings);

  if (nextOpenings.length > 0) {
    room.wallOpenings = nextOpenings;
  } else {
    delete room.wallOpenings;
  }

  if (nextDoors.length > 0) {
    room.wallDoors = nextDoors;
  } else {
    delete room.wallDoors;
  }

  if (nextEdgeOpenings.length > 0) {
    room.wallEdgeOpenings = nextEdgeOpenings;
  } else {
    delete room.wallEdgeOpenings;
  }

  if (nextTileOpenings.length > 0) {
    room.wallTileOpenings = nextTileOpenings;
  } else {
    delete room.wallTileOpenings;
  }
}

function isRoomWallSideOpen(
  room: ObservatoryRoom,
  point: ObservatoryGridPoint,
  side: ObservatoryRoomWallSide
) {
  const key = createGridPointKey(point);
  if ((room.wallOpenings ?? []).some((opening) => createGridPointKey(opening) === key)) {
    return true;
  }

  return (room.wallEdgeOpenings ?? []).some(
    (opening) =>
      createGridPointKey(opening.point) === key &&
      opening.side === side &&
      isRoomPerimeterPoint(room, opening.point)
  );
}

function createRoomWallEdgeOpeningKey(
  pointOrOpening: ObservatoryGridPoint | ObservatoryRoomWallEdgeOpening,
  side?: ObservatoryRoomWallSide
) {
  if ('point' in pointOrOpening) {
    return `${pointOrOpening.point.x}:${pointOrOpening.point.y}:${pointOrOpening.side}`;
  }

  return `${pointOrOpening.x}:${pointOrOpening.y}:${side}`;
}

function isRoomWallTileHidden(room: ObservatoryRoom, point: ObservatoryWallEditPoint) {
  const pointKey = createGridPointKey(point);
  const targetSides = resolveRoomWallTileEditSides(room, point);

  return (
    targetSides.length > 0 &&
    targetSides.every((side) =>
      (room.wallTileOpenings ?? []).some(
        (opening) => createGridPointKey(opening.point) === pointKey && opening.side === side
      )
    )
  );
}

function applyRoomWallTileHidden(
  room: ObservatoryRoom,
  point: ObservatoryWallEditPoint,
  hidden: boolean
) {
  const tileOpenings = new Set(
    (room.wallTileOpenings ?? []).map((opening) => createRoomWallEdgeOpeningKey(opening))
  );

  for (const side of resolveRoomWallTileEditSides(room, point)) {
    const key = createRoomWallEdgeOpeningKey(point, side);

    if (hidden) {
      tileOpenings.add(key);
    } else {
      tileOpenings.delete(key);
    }
  }

  const nextTileOpenings = sortRoomWallEdgeOpeningsFromKeys(tileOpenings);

  if (nextTileOpenings.length > 0) {
    room.wallTileOpenings = nextTileOpenings;
  } else {
    delete room.wallTileOpenings;
  }
}

function sortRoomWallEdgeOpeningsFromKeys(keys: Set<string>): ObservatoryRoomWallEdgeOpening[] {
  return [...keys]
    .map((key) => {
      const [x = '0', y = '0', side = 'north'] = key.split(':');
      return {
        point: { x: Number(x), y: Number(y) },
        side: side as ObservatoryRoomWallSide,
      };
    })
    .filter((opening) => roomWallSideOrder.includes(opening.side))
    .sort((first, second) => {
      if (first.point.y !== second.point.y) {
        return first.point.y - second.point.y;
      }
      if (first.point.x !== second.point.x) {
        return first.point.x - second.point.x;
      }
      return roomWallSideOrder.indexOf(first.side) - roomWallSideOrder.indexOf(second.side);
    });
}

function applyRoomWallCellAsset(
  room: ObservatoryRoom,
  point: ObservatoryGridPoint,
  assetId: string | null
) {
  const key = createGridPointKey(point);
  const nextOverrides = (room.wallAssetOverrides ?? []).filter(
    (override) => createGridPointKey(override.point) !== key
  );
  const normalizedAssetId = assetId && assetId !== room.wallAssetId ? assetId : null;

  if (normalizedAssetId) {
    nextOverrides.push({
      assetId: normalizedAssetId,
      point: { ...point },
    });
  }

  nextOverrides.sort((first, second) =>
    createGridPointKey(first.point).localeCompare(createGridPointKey(second.point))
  );

  if (nextOverrides.length > 0) {
    room.wallAssetOverrides = nextOverrides;
  } else {
    delete room.wallAssetOverrides;
  }
}

function applyRoomFloorCellAsset(
  room: ObservatoryRoom,
  point: ObservatoryGridPoint,
  assetId: string | null
) {
  const key = createGridPointKey(point);
  const nextOverrides = (room.floorAssetOverrides ?? []).filter(
    (override) => createGridPointKey(override.point) !== key
  );
  const normalizedAssetId = assetId && assetId !== room.floorAssetId ? assetId : null;

  if (normalizedAssetId) {
    nextOverrides.push({
      assetId: normalizedAssetId,
      point: { ...point },
    });
  }

  nextOverrides.sort((first, second) =>
    createGridPointKey(first.point).localeCompare(createGridPointKey(second.point))
  );

  if (nextOverrides.length > 0) {
    room.floorAssetOverrides = nextOverrides;
  } else {
    delete room.floorAssetOverrides;
  }
}

function createGridPointKey(point: ObservatoryGridPoint) {
  return `${Math.floor(point.x)}:${Math.floor(point.y)}`;
}

function sortGridPointsFromKeys(entries: Set<string>) {
  return Array.from(entries, (entry) => {
    const [x, y] = entry.split(':').map((value) => Number.parseInt(value, 10));
    return { x, y };
  }).sort((left, right) => left.y - right.y || left.x - right.x);
}

function reassignRoomScopedObjects(map: ObservatoryMap) {
  for (const object of map.objects) {
    const bounds = { ...object.position, ...normalizeSize(object.size) };
    object.roomId = findRoomContainingRect(map, bounds)?.id;
  }
}

function createNextId(prefix: string, existingIds: string[]) {
  const existing = new Set(existingIds);
  let index = existing.size + 1;
  let candidate = `${prefix}-${index}`;

  while (existing.has(candidate)) {
    index += 1;
    candidate = `${prefix}-${index}`;
  }

  return candidate;
}

function findNextTemplateOrigin(
  map: ObservatoryMap,
  size: ObservatoryGridSize
): ObservatoryGridPoint {
  const existingTemplateRooms = map.rooms.filter(
    (room) =>
      room.id.startsWith('room:engineering-pod') ||
      room.id.startsWith('room:research-room') ||
      room.id.startsWith('room:finance-room') ||
      room.id.startsWith('room:audit-workspace')
  );
  const slot = existingTemplateRooms.length;
  const availableWidth = Math.max(1, map.size.width - size.width);
  const x = 1 + ((slot * (size.width + 1)) % availableWidth);
  const y = Math.max(0, map.size.height - size.height);

  return {
    x: Math.min(x, map.size.width - size.width),
    y,
  };
}
