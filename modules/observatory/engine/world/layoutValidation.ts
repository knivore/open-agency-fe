import {
  OBSERVATORY_LAYOUT_SCHEMA_VERSION,
  type ObservatoryAgentStatus,
  type ObservatoryLayoutDocument,
  type ObservatoryLayoutIssue,
  type ObservatoryRoomKind,
  type ObservatoryValidatedLayout,
} from '@/modules/observatory/engine/world/layoutTypes';

const idPattern = /^[a-z0-9][a-z0-9:-]*$/;
const roomKinds = new Set<ObservatoryRoomKind>(['workspace', 'runtime', 'commons']);
const wallSides = ['east', 'north', 'south', 'west'];
const agentStatuses = new Set<ObservatoryAgentStatus>([
  'idle',
  'working',
  'blocked',
  'complete',
  'error',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isId(value: unknown): value is string {
  return isNonEmptyString(value) && idPattern.test(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function pushIssue(issues: ObservatoryLayoutIssue[], path: string, reason: string) {
  issues.push({ path, reason });
}

function validateGridSize(value: unknown, path: string, issues: ObservatoryLayoutIssue[]) {
  if (!isRecord(value)) {
    pushIssue(issues, path, 'must be an object');
    return;
  }

  if (!isPositiveInteger(value.width)) {
    pushIssue(issues, `${path}.width`, 'must be a positive integer');
  }

  if (!isPositiveInteger(value.height)) {
    pushIssue(issues, `${path}.height`, 'must be a positive integer');
  }
}

function validateGridPoint(value: unknown, path: string, issues: ObservatoryLayoutIssue[]) {
  if (!isRecord(value)) {
    pushIssue(issues, path, 'must be an object');
    return;
  }

  if (!isNonNegativeInteger(value.x)) {
    pushIssue(issues, `${path}.x`, 'must be a non-negative integer');
  }

  if (!isNonNegativeInteger(value.y)) {
    pushIssue(issues, `${path}.y`, 'must be a non-negative integer');
  }
}

function validateGridRect(value: unknown, path: string, issues: ObservatoryLayoutIssue[]) {
  validateGridPoint(value, path, issues);
  validateGridSize(value, path, issues);
}

function validateOptionalString(value: unknown, path: string, issues: ObservatoryLayoutIssue[]) {
  if (value !== undefined && typeof value !== 'string') {
    pushIssue(issues, path, 'must be a string when present');
  }
}

function validateOptionalPositiveInteger(
  value: unknown,
  path: string,
  issues: ObservatoryLayoutIssue[]
) {
  if (value !== undefined && !isPositiveInteger(value)) {
    pushIssue(issues, path, 'must be a positive integer when present');
  }
}

function validateWallEdgeList(value: unknown, path: string, issues: ObservatoryLayoutIssue[]) {
  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value)) {
    pushIssue(issues, path, 'must be an array when present');
    return;
  }

  value.forEach((opening, openingIndex) => {
    if (!opening || typeof opening !== 'object') {
      pushIssue(issues, `${path}[${openingIndex}]`, 'must be an object');
      return;
    }

    validateGridPoint(
      (opening as { point?: unknown }).point,
      `${path}[${openingIndex}].point`,
      issues
    );

    if (!wallSides.includes((opening as { side?: string }).side ?? '')) {
      pushIssue(
        issues,
        `${path}[${openingIndex}].side`,
        'must be one of east, north, south, or west'
      );
    }
  });
}

function validatePixelPoint(value: unknown, path: string, issues: ObservatoryLayoutIssue[]) {
  if (!isRecord(value)) {
    pushIssue(issues, path, 'must be an object');
    return;
  }

  if (!isFiniteNumber(value.x)) {
    pushIssue(issues, `${path}.x`, 'must be a finite number');
  }

  if (!isFiniteNumber(value.y)) {
    pushIssue(issues, `${path}.y`, 'must be a finite number');
  }
}

function validatePixelSize(value: unknown, path: string, issues: ObservatoryLayoutIssue[]) {
  if (!isRecord(value)) {
    pushIssue(issues, path, 'must be an object');
    return;
  }

  if (!isPositiveNumber(value.width)) {
    pushIssue(issues, `${path}.width`, 'must be a positive number');
  }

  if (!isPositiveNumber(value.height)) {
    pushIssue(issues, `${path}.height`, 'must be a positive number');
  }
}

function validateRenderSourceCrop(value: unknown, path: string, issues: ObservatoryLayoutIssue[]) {
  if (!isRecord(value)) {
    pushIssue(issues, path, 'must be an object');
    return;
  }

  if (!isNonNegativeInteger(value.x)) {
    pushIssue(issues, `${path}.x`, 'must be a non-negative integer');
  }

  if (!isNonNegativeInteger(value.y)) {
    pushIssue(issues, `${path}.y`, 'must be a non-negative integer');
  }

  if (!isPositiveInteger(value.width)) {
    pushIssue(issues, `${path}.width`, 'must be a positive integer');
  }

  if (!isPositiveInteger(value.height)) {
    pushIssue(issues, `${path}.height`, 'must be a positive integer');
  }
}

function validateObjectRenderOptions(
  value: unknown,
  path: string,
  issues: ObservatoryLayoutIssue[]
) {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    pushIssue(issues, path, 'must be an object when present');
    return;
  }

  if (value.depth !== undefined && !isFiniteNumber(value.depth)) {
    pushIssue(issues, `${path}.depth`, 'must be a finite number when present');
  }

  if (value.offsetPx !== undefined) {
    validatePixelPoint(value.offsetPx, `${path}.offsetPx`, issues);
  }

  if (value.sizePx !== undefined) {
    validatePixelSize(value.sizePx, `${path}.sizePx`, issues);
  }

  if (value.sourceCrop !== undefined) {
    validateRenderSourceCrop(value.sourceCrop, `${path}.sourceCrop`, issues);
  }
}

function validateMetadata(metadata: unknown, path: string, issues: ObservatoryLayoutIssue[]) {
  if (metadata === undefined) {
    return;
  }

  if (!isRecord(metadata)) {
    pushIssue(issues, path, 'must be an object when present');
    return;
  }

  validateOptionalString(metadata.id, `${path}.id`, issues);
  validateOptionalString(metadata.name, `${path}.name`, issues);
  validateOptionalString(metadata.notes, `${path}.notes`, issues);
  validateOptionalString(metadata.publishedBy, `${path}.publishedBy`, issues);
  validateOptionalString(metadata.createdAt, `${path}.createdAt`, issues);
  validateOptionalString(metadata.updatedAt, `${path}.updatedAt`, issues);
  validateOptionalString(metadata.publishedAt, `${path}.publishedAt`, issues);

  if (
    metadata.status !== undefined &&
    metadata.status !== 'draft' &&
    metadata.status !== 'published'
  ) {
    pushIssue(issues, `${path}.status`, 'must be draft or published when present');
  }

  if (metadata.version !== undefined && !isPositiveInteger(metadata.version)) {
    pushIssue(issues, `${path}.version`, 'must be a positive integer when present');
  }
}

function validateUniqueId(
  id: unknown,
  path: string,
  seenIds: Set<string>,
  issues: ObservatoryLayoutIssue[]
) {
  if (!isId(id)) {
    pushIssue(issues, path, 'must be a lowercase identifier');
    return;
  }

  if (seenIds.has(id)) {
    pushIssue(issues, path, 'must be unique');
    return;
  }

  seenIds.add(id);
}

function validateRooms(rooms: unknown, path: string, issues: ObservatoryLayoutIssue[]) {
  if (!Array.isArray(rooms)) {
    pushIssue(issues, path, 'must be an array');
    return;
  }

  const seenIds = new Set<string>();

  rooms.forEach((room, index) => {
    const roomPath = `${path}[${index}]`;

    if (!isRecord(room)) {
      pushIssue(issues, roomPath, 'must be an object');
      return;
    }

    validateUniqueId(room.id, `${roomPath}.id`, seenIds, issues);

    if (!isNonEmptyString(room.name)) {
      pushIssue(issues, `${roomPath}.name`, 'must be a non-empty string');
    }

    if (typeof room.kind !== 'string' || !roomKinds.has(room.kind as ObservatoryRoomKind)) {
      pushIssue(issues, `${roomPath}.kind`, 'must be workspace, runtime, or commons');
    }

    validateGridRect(room.bounds, `${roomPath}.bounds`, issues);
    validateOptionalString(room.floorAssetId, `${roomPath}.floorAssetId`, issues);
    if (room.floorAssetOverrides !== undefined) {
      if (!Array.isArray(room.floorAssetOverrides)) {
        pushIssue(issues, `${roomPath}.floorAssetOverrides`, 'must be an array when present');
      } else {
        room.floorAssetOverrides.forEach((override, overrideIndex) => {
          if (!override || typeof override !== 'object') {
            pushIssue(
              issues,
              `${roomPath}.floorAssetOverrides[${overrideIndex}]`,
              'must be an object'
            );
            return;
          }

          validateGridPoint(
            (override as { point?: unknown }).point,
            `${roomPath}.floorAssetOverrides[${overrideIndex}].point`,
            issues
          );
          validateOptionalString(
            (override as { assetId?: unknown }).assetId,
            `${roomPath}.floorAssetOverrides[${overrideIndex}].assetId`,
            issues
          );
        });
      }
    }
    validateOptionalString(room.wallAssetId, `${roomPath}.wallAssetId`, issues);
    validateOptionalPositiveInteger(room.wallHeight, `${roomPath}.wallHeight`, issues);
    if (room.wallAssetOverrides !== undefined) {
      if (!Array.isArray(room.wallAssetOverrides)) {
        pushIssue(issues, `${roomPath}.wallAssetOverrides`, 'must be an array when present');
      } else {
        room.wallAssetOverrides.forEach((override, overrideIndex) => {
          if (!override || typeof override !== 'object') {
            pushIssue(
              issues,
              `${roomPath}.wallAssetOverrides[${overrideIndex}]`,
              'must be an object'
            );
            return;
          }

          validateGridPoint(
            (override as { point?: unknown }).point,
            `${roomPath}.wallAssetOverrides[${overrideIndex}].point`,
            issues
          );
          validateOptionalString(
            (override as { assetId?: unknown }).assetId,
            `${roomPath}.wallAssetOverrides[${overrideIndex}].assetId`,
            issues
          );
          validateOptionalPositiveInteger(
            (override as { height?: unknown }).height,
            `${roomPath}.wallAssetOverrides[${overrideIndex}].height`,
            issues
          );
        });
      }
    }

    if (room.wallOpenings !== undefined) {
      if (!Array.isArray(room.wallOpenings)) {
        pushIssue(issues, `${roomPath}.wallOpenings`, 'must be an array when present');
      } else {
        room.wallOpenings.forEach((opening, openingIndex) => {
          validateGridPoint(opening, `${roomPath}.wallOpenings[${openingIndex}]`, issues);
        });
      }
    }

    validateWallEdgeList(room.wallEdgeOpenings, `${roomPath}.wallEdgeOpenings`, issues);
    validateWallEdgeList(room.wallTileOpenings, `${roomPath}.wallTileOpenings`, issues);

    if (room.wallDoors !== undefined) {
      if (!Array.isArray(room.wallDoors)) {
        pushIssue(issues, `${roomPath}.wallDoors`, 'must be an array when present');
      } else {
        room.wallDoors.forEach((door, doorIndex) => {
          validateGridPoint(door, `${roomPath}.wallDoors[${doorIndex}]`, issues);
        });
      }
    }
  });
}

function validateObjects(
  objects: unknown,
  path: string,
  roomIds: Set<string>,
  issues: ObservatoryLayoutIssue[]
) {
  if (!Array.isArray(objects)) {
    pushIssue(issues, path, 'must be an array');
    return;
  }

  const seenIds = new Set<string>();

  objects.forEach((object, index) => {
    const objectPath = `${path}[${index}]`;

    if (!isRecord(object)) {
      pushIssue(issues, objectPath, 'must be an object');
      return;
    }

    validateUniqueId(object.id, `${objectPath}.id`, seenIds, issues);

    if (!isId(object.assetId)) {
      pushIssue(issues, `${objectPath}.assetId`, 'must be a lowercase asset identifier');
    }

    if (
      object.roomId !== undefined &&
      (typeof object.roomId !== 'string' || !roomIds.has(object.roomId))
    ) {
      pushIssue(issues, `${objectPath}.roomId`, 'must reference an existing room');
    }

    validateGridPoint(object.position, `${objectPath}.position`, issues);

    if (object.size !== undefined) {
      validateGridSize(object.size, `${objectPath}.size`, issues);
    }

    if (object.blocksMovement !== undefined && typeof object.blocksMovement !== 'boolean') {
      pushIssue(issues, `${objectPath}.blocksMovement`, 'must be a boolean when present');
    }

    validateObjectRenderOptions(object.render, `${objectPath}.render`, issues);
  });
}

function validateAgents(
  agents: unknown,
  path: string,
  roomIds: Set<string>,
  issues: ObservatoryLayoutIssue[]
) {
  if (!Array.isArray(agents)) {
    pushIssue(issues, path, 'must be an array');
    return;
  }

  const seenIds = new Set<string>();

  agents.forEach((agent, index) => {
    const agentPath = `${path}[${index}]`;

    if (!isRecord(agent)) {
      pushIssue(issues, agentPath, 'must be an object');
      return;
    }

    validateUniqueId(agent.id, `${agentPath}.id`, seenIds, issues);

    if (!isNonEmptyString(agent.name)) {
      pushIssue(issues, `${agentPath}.name`, 'must be a non-empty string');
    }

    if (!isId(agent.assetId)) {
      pushIssue(issues, `${agentPath}.assetId`, 'must be a lowercase asset identifier');
    }

    if (
      agent.roomId !== undefined &&
      (typeof agent.roomId !== 'string' || !roomIds.has(agent.roomId))
    ) {
      pushIssue(issues, `${agentPath}.roomId`, 'must reference an existing room');
    }

    validateGridPoint(agent.position, `${agentPath}.position`, issues);

    if (
      typeof agent.status !== 'string' ||
      !agentStatuses.has(agent.status as ObservatoryAgentStatus)
    ) {
      pushIssue(
        issues,
        `${agentPath}.status`,
        'must be idle, working, blocked, complete, or error'
      );
    }
  });
}

export function validateObservatoryLayout(layout: unknown): ObservatoryValidatedLayout {
  const issues: ObservatoryLayoutIssue[] = [];

  if (!isRecord(layout)) {
    return { issues: [{ path: 'layout', reason: 'must be an object' }] };
  }

  if (layout.schemaVersion !== OBSERVATORY_LAYOUT_SCHEMA_VERSION) {
    pushIssue(issues, 'schemaVersion', `must be ${OBSERVATORY_LAYOUT_SCHEMA_VERSION}`);
  }

  validateMetadata(layout.metadata, 'metadata', issues);

  if (!isRecord(layout.world)) {
    pushIssue(issues, 'world', 'must be an object');
    return { issues };
  }

  validateUniqueId(layout.world.id, 'world.id', new Set(), issues);

  if (!isNonEmptyString(layout.world.name)) {
    pushIssue(issues, 'world.name', 'must be a non-empty string');
  }

  if (!isRecord(layout.world.grid)) {
    pushIssue(issues, 'world.grid', 'must be an object');
  } else {
    if (!isPositiveInteger(layout.world.grid.tileSize)) {
      pushIssue(issues, 'world.grid.tileSize', 'must be a positive integer');
    }

    validateGridSize(layout.world.grid.size, 'world.grid.size', issues);
  }

  if (!Array.isArray(layout.world.maps)) {
    pushIssue(issues, 'world.maps', 'must be an array');
  } else {
    const seenMapIds = new Set<string>();

    layout.world.maps.forEach((map, index) => {
      const mapPath = `world.maps[${index}]`;

      if (!isRecord(map)) {
        pushIssue(issues, mapPath, 'must be an object');
        return;
      }

      validateUniqueId(map.id, `${mapPath}.id`, seenMapIds, issues);

      if (!isNonEmptyString(map.name)) {
        pushIssue(issues, `${mapPath}.name`, 'must be a non-empty string');
      }

      validateGridSize(map.size, `${mapPath}.size`, issues);

      if (!isId(map.defaultFloorAssetId)) {
        pushIssue(issues, `${mapPath}.defaultFloorAssetId`, 'must be a lowercase asset identifier');
      }

      validateRooms(map.rooms, `${mapPath}.rooms`, issues);

      const roomIds = new Set<string>();
      if (Array.isArray(map.rooms)) {
        map.rooms.forEach((room) => {
          if (isRecord(room) && typeof room.id === 'string') {
            roomIds.add(room.id);
          }
        });
      }

      validateObjects(map.objects, `${mapPath}.objects`, roomIds, issues);
      validateAgents(map.agents, `${mapPath}.agents`, roomIds, issues);
    });
  }

  return {
    layout: issues.length === 0 ? (layout as unknown as ObservatoryLayoutDocument) : undefined,
    issues,
  };
}
