import type Phaser from 'phaser';

import {
  createObservatoryCharacterActionAnimationKey,
  OBSERVATORY_FALLBACK_TEXTURE_KEY,
  type ObservatoryAssetDefinition,
  type ObservatoryCharacterActionDefinition,
  type ObservatoryCharacterActionName,
  type ObservatoryCharacterDirection,
  type ObservatoryValidatedAssetRegistry,
} from '@/modules/observatory/engine/assets/assetRegistry';
import {
  gridRectToWorldRect,
  gridToWorld,
  gridToWorldCenter,
  pointInGridRect,
  type ObservatoryGridConfig,
} from '@/modules/observatory/engine/world/grid';
import type {
  ObservatoryAgent,
  ObservatoryAgentStatus,
  ObservatoryMap,
  ObservatoryObject,
  ObservatoryRoom,
  ObservatoryRoomWallCellKind,
  ObservatoryRoomWallSide,
  ObservatoryRoomKind,
} from '@/modules/observatory/engine/world/layoutTypes';
import type {
  ObservatoryAgentVisualState,
  ObservatoryRoomVisualState,
} from '@/modules/observatory/engine/rendering/agentVisualState';
import {
  isObservatoryGridWalkable,
  pickObservatoryAgentBehaviorTargetPoint,
  resolveObservatoryGridPath,
} from '@/modules/observatory/engine/rendering/agentBehaviorTargets';
import {
  RPG_MAKER_A4_WALL_BRICK_BLOCK_INDEX,
  RpgMakerA4WallAutotileRenderer,
  resolveA4WallSolidFaceQuadrants,
  resolveObservatoryFloorAutotileFrame,
} from '@/modules/observatory/engine/rendering/rpgMakerAutotiles';

export interface ObservatoryOfficeMapRendererOptions {
  activeWallEditRoomId?: string | null;
  activeWallEditTool?: 'door' | 'floor' | 'opening' | 'paint' | 'tile';
  activeWallEditWallAssetId?: string | null;
  assetRegistry?: ObservatoryValidatedAssetRegistry;
  debugGrid?: boolean;
  enableDirectSelection?: boolean;
  onWallEditCellClick?: (point: ObservatoryWallEditPoint) => void;
  renderAgents?: boolean;
  renderObjects?: boolean;
  showWallEditOverlay?: boolean;
  viewFilter?: ObservatoryOfficeMapViewFilter;
  onAgentSelected?: (agent: ObservatoryAgent) => void;
  onObjectSelected?: (object: ObservatoryObject) => void;
  onRoomSelected?: (room: ObservatoryRoom) => void;
}

export interface ObservatoryOfficeMapViewFilter {
  layer?: 'agents' | 'all' | 'objects';
  roomKind?: 'all' | ObservatoryRoomKind;
  search?: string;
}

export interface ObservatoryRenderedOfficeMap {
  applyAgentVisualStates(agentStates: ObservatoryAgentVisualState[]): void;
  applyRoomVisualStates(roomStates: ObservatoryRoomVisualState[]): void;
  getSelectedAgentId(): string | null;
  getSelectedObjectBounds(): {
    height: number;
    label: string;
    width: number;
    x: number;
    y: number;
  } | null;
  getSelectedObjectId(): string | null;
  getSelectedRoomBounds(): {
    height: number;
    label: string;
    width: number;
    x: number;
    y: number;
  } | null;
  getSelectedRoomId(): string | null;
  getObjectIdAtGrid(point: { x: number; y: number }): string | null;
  getRoomIdAtGrid(point: { x: number; y: number }): string | null;
  moveSelectedAgentToGrid(point: { x: number; y: number }): boolean;
  setWallEditHover(point: { x: number; y: number } | null): void;
  selectAgent(agentId: string | null): void;
  selectAtWorldPoint(point: { x: number; y: number }): boolean;
  selectObject(objectId: string | null): void;
  selectRoom(roomId: string | null): void;
}

interface RenderedAgentHandle {
  agent: ObservatoryAgent;
  asset?: ObservatoryAssetDefinition;
  attention?: ObservatoryAgentVisualState['attention'];
  attentionSprite?: Phaser.GameObjects.Text;
  badge: Phaser.GameObjects.Arc;
  currentAction?: ObservatoryCharacterActionName;
  currentDirection?: ObservatoryCharacterDirection;
  hitZone: Phaser.GameObjects.Zone;
  label: Phaser.GameObjects.Text;
  movementKey?: string;
  movementTween?: Phaser.Tweens.Tween;
  pendingSpeechMessage?: string;
  pendingSpeechKey?: string;
  pendingSpeechDurationMs?: number;
  pendingSpeechTone?: ObservatoryAgentVisualState['speechTone'];
  progressBackground?: Phaser.GameObjects.Rectangle;
  progressFill?: Phaser.GameObjects.Rectangle;
  progressLabel?: Phaser.GameObjects.Text;
  taskEffectKey?: string;
  speechKey?: string;
  speechBubble?: Phaser.GameObjects.Text;
  speechTimer?: Phaser.Time.TimerEvent;
  sprite: Phaser.GameObjects.Sprite;
}

interface RenderedRoomHandle {
  highlight: Phaser.GameObjects.Rectangle;
  hitZone: Phaser.GameObjects.Zone;
  nodes: Phaser.GameObjects.GameObject[];
  room: ObservatoryRoom;
}

interface RenderedObjectHandle {
  hitZone: Phaser.GameObjects.Zone;
  nodes: Phaser.GameObjects.GameObject[];
  object: ObservatoryObject;
}

interface RoomWallBlitterLayers {
  faceLayer: Phaser.GameObjects.Blitter;
}

interface RoomWallFaceAnchor {
  asset: ObservatoryAssetDefinition;
  assetId: string;
  blockIndex: number;
  faceHeight: number;
  point: { x: number; y: number };
  renderer: RpgMakerA4WallAutotileRenderer;
  rendererCacheKey: string;
  textureKey: string;
}

interface ObservatoryWallEditPoint {
  wallSide?: ObservatoryRoomWallSide;
  x: number;
  y: number;
}

interface RoomWallEditTarget {
  point: { x: number; y: number };
  side: ObservatoryRoomWallSide;
}

const roomKindTint: Record<ObservatoryRoom['kind'], number> = {
  commons: 0xfacc15,
  runtime: 0x38bdf8,
  workspace: 0x86efac,
};

const agentStatusTint: Record<ObservatoryAgentStatus, number> = {
  blocked: 0xf97316,
  complete: 0x22c55e,
  error: 0xef4444,
  idle: 0x94a3b8,
  working: 0x38bdf8,
};

const roomWallBorderStripDepth = 5.75;
const roomWallStripColor = 0xffffff;
const roomWallStripSize = 5;

const attentionMarkerText: Record<
  NonNullable<ObservatoryAgentVisualState['attention']>,
  string
> = {
  approval: 'OK',
  error: '!',
  thinking: '...',
};

const agentWalkTileDurationMs = 540;

export function renderObservatoryOfficeMap(
  scene: Phaser.Scene,
  map: ObservatoryMap,
  grid: ObservatoryGridConfig,
  options: ObservatoryOfficeMapRendererOptions = {}
): ObservatoryRenderedOfficeMap {
  const roomSelectionOutline = scene.add.graphics().setDepth(40);
  const objectSelectionOutline = scene.add.graphics().setDepth(41);
  const agentSelectionOutline = scene.add.graphics().setDepth(42);
  const objectSelectionLabel = scene.add
    .text(0, 0, '', {
      backgroundColor: '#0f172a',
      color: '#f8fafc',
      fontFamily: 'monospace',
      fontSize: '11px',
      padding: { x: 8, y: 4 },
    })
    .setDepth(43)
    .setVisible(false);
  const wallEditOverlay = scene.add.graphics().setDepth(39);
  let wallEditPreviewNodes: Phaser.GameObjects.GameObject[] = [];
  let wallEditZones: Phaser.GameObjects.Zone[] = [];
  const agentHandles = new Map<string, RenderedAgentHandle>();
  const objectHandles = new Map<string, RenderedObjectHandle>();
  const roomHandles = new Map<string, RenderedRoomHandle>();
  const assetsById = new Map(options.assetRegistry?.assets.map((asset) => [asset.id, asset]) ?? []);
  const viewFilter = normalizeViewFilter(options.viewFilter);
  const directSelectionEnabled = options.enableDirectSelection ?? true;
  let selectedAgentId: string | null = null;
  let selectedObjectId: string | null = null;
  let selectedRoomId: string | null = null;
  let objectSelectionPulseTween: Phaser.Tweens.Tween | null = null;
  let wallEditHoverPoint: { x: number; y: number } | null = null;

  renderMapBackdrop(scene, map, grid);

  for (const room of map.rooms) {
    const nodes = [
      ...renderRoomFloor(scene, map, room, grid, assetsById),
      ...renderRoomWalls(scene, map, room, grid, assetsById),
      ...renderRoomWallDoors(scene, room, grid),
    ];
    const highlight = renderRoomHighlight(scene, room, grid);
    const label = renderRoomLabel(scene, room, grid);
    const hitZone = addRoomHitArea(scene, room, grid, () => {
      selectRoom(room.id);
      options.onRoomSelected?.(room);
    });
    roomHandles.set(room.id, { highlight, hitZone, nodes: [...nodes, label, hitZone], room });
  }

  if (options.debugGrid) {
    renderDebugGrid(scene, map, grid);
  }

  if (options.renderObjects !== false) {
    for (const object of map.objects) {
      const objectHandle = renderObject(scene, object, grid, assetsById, () => {
        selectObject(object.id);
        options.onObjectSelected?.(object);
      });
      objectHandles.set(object.id, objectHandle);
    }
  }

  if (options.renderAgents !== false) {
    for (const agent of map.agents) {
      const agentHandle = renderAgent(scene, agent, grid, assetsById, () => {
        selectAgent(agent.id);
        options.onAgentSelected?.(agent);
      });
      agentHandles.set(agent.id, agentHandle);
    }
  }

  applyViewFilter();
  renderWallEditOverlay();

  function selectRoom(roomId: string | null) {
    roomSelectionOutline.clear();
    objectSelectionOutline.clear();
    objectSelectionLabel.setVisible(false);
    agentSelectionOutline.clear();
    objectSelectionPulseTween?.stop();
    objectSelectionPulseTween = null;
    objectSelectionOutline.setAlpha(1);
    selectedObjectId = null;
    selectedRoomId = roomId;
    selectedAgentId = null;

    if (!roomId) {
      return;
    }

    const room = map.rooms.find((candidate) => candidate.id === roomId);

    if (!room) {
      return;
    }

    const bounds = gridRectToWorldRect(room.bounds, grid);
    roomSelectionOutline.lineStyle(4, roomKindTint[room.kind], 0.95);
    roomSelectionOutline.strokeRect(
      bounds.x + 2,
      bounds.y + 2,
      bounds.width - 4,
      bounds.height - 4
    );
  }

  function selectObject(objectId: string | null) {
    if (objectId && selectedObjectId === objectId) {
      return;
    }

    roomSelectionOutline.clear();
    objectSelectionOutline.clear();
    objectSelectionLabel.setVisible(false);
    agentSelectionOutline.clear();
    selectedObjectId = objectId;
    selectedRoomId = null;
    selectedAgentId = null;
    objectSelectionPulseTween?.stop();
    objectSelectionPulseTween = null;
    objectSelectionOutline.setAlpha(1);

    if (!objectId) {
      return;
    }

    const object = map.objects.find((candidate) => candidate.id === objectId);

    if (!object) {
      return;
    }

    const bounds = objectCollisionBoundsToWorldRect(object, grid, assetsById.get(object.assetId));
    objectSelectionOutline.fillStyle(0xfacc15, 0.12);
    objectSelectionOutline.fillRoundedRect(
      bounds.x - 4,
      bounds.y - 4,
      bounds.width + 8,
      bounds.height + 8,
      12
    );
    objectSelectionOutline.lineStyle(3, 0xfacc15, 0.95);
    objectSelectionOutline.strokeRoundedRect(
      bounds.x - 3,
      bounds.y - 3,
      bounds.width + 6,
      bounds.height + 6,
      12
    );
    objectSelectionOutline.lineStyle(1, 0xfffbeb, 0.85);
    objectSelectionOutline.strokeRoundedRect(
      bounds.x + 1,
      bounds.y + 1,
      bounds.width - 2,
      bounds.height - 2,
      8
    );
    drawObjectCollisionTileGrid(objectSelectionOutline, bounds, grid);
    objectSelectionLabel
      .setText(object.assetId)
      .setPosition(
        bounds.x + bounds.width / 2 - objectSelectionLabel.width / 2,
        Math.max(8, bounds.y - objectSelectionLabel.height - 10)
      )
      .setVisible(true);
    objectSelectionPulseTween = scene.tweens.add({
      alpha: { from: 1, to: 0.72 },
      duration: 680,
      repeat: -1,
      targets: objectSelectionOutline,
      yoyo: true,
    });
  }

  function selectAgent(agentId: string | null) {
    roomSelectionOutline.clear();
    objectSelectionOutline.clear();
    objectSelectionLabel.setVisible(false);
    agentSelectionOutline.clear();
    objectSelectionPulseTween?.stop();
    objectSelectionPulseTween = null;
    objectSelectionOutline.setAlpha(1);
    selectedObjectId = null;
    selectedRoomId = null;

    if (!agentId) {
      selectedAgentId = null;
      return;
    }

    const agent = map.agents.find((candidate) => candidate.id === agentId);

    if (!agent) {
      return;
    }

    const center = gridToWorldCenter(agent.position, grid);
    const handle = agentHandles.get(agent.id);

    if (handle) {
      const width = handle.sprite.displayWidth + 10;
      const height = handle.sprite.displayHeight + 10;
      const x = handle.sprite.x - width / 2;
      const y = handle.sprite.y - handle.sprite.displayHeight - 5;
      agentSelectionOutline.fillStyle(0x22d3ee, 0.12);
      agentSelectionOutline.fillRoundedRect(x, y, width, height, 8);
      agentSelectionOutline.lineStyle(3, 0x22d3ee, 0.95);
      agentSelectionOutline.strokeRoundedRect(x, y, width, height, 8);
    } else {
      agentSelectionOutline.lineStyle(3, 0x22d3ee, 0.95);
      agentSelectionOutline.strokeCircle(center.x, center.y, grid.tileSize * 0.58);
    }

    selectedAgentId = agent.id;
  }

  function getSelectedAgentId() {
    return selectedAgentId;
  }

  function getSelectedObjectId() {
    return selectedObjectId;
  }

  function getSelectedObjectBounds() {
    if (!selectedObjectId) {
      return null;
    }

    const object = map.objects.find((candidate) => candidate.id === selectedObjectId);
    if (!object) {
      return null;
    }

    const bounds = objectCollisionBoundsToWorldRect(object, grid, assetsById.get(object.assetId));
    return {
      height: bounds.height,
      label: object.assetId,
      width: bounds.width,
      x: bounds.x,
      y: bounds.y,
    };
  }

  function getSelectedRoomId() {
    return selectedRoomId;
  }

  function getSelectedRoomBounds() {
    if (!selectedRoomId) {
      return null;
    }

    const room = map.rooms.find((candidate) => candidate.id === selectedRoomId);
    if (!room) {
      return null;
    }

    const bounds = gridRectToWorldRect(room.bounds, grid);
    return {
      height: bounds.height,
      label: room.name,
      width: bounds.width,
      x: bounds.x,
      y: bounds.y,
    };
  }

  function renderWallEditOverlay() {
    wallEditOverlay.clear();
    wallEditPreviewNodes.forEach((node) => node.destroy());
    wallEditPreviewNodes = [];
    wallEditZones.forEach((zone) => zone.destroy());
    wallEditZones = [];

    if (!options.showWallEditOverlay || !options.activeWallEditRoomId) {
      return;
    }

    const room = map.rooms.find((candidate) => candidate.id === options.activeWallEditRoomId);
    if (!room) {
      return;
    }

    if (options.activeWallEditTool === 'floor') {
      for (let y = room.bounds.y; y < room.bounds.y + room.bounds.height; y += 1) {
        for (let x = room.bounds.x; x < room.bounds.x + room.bounds.width; x += 1) {
          const point = { x, y };
          const world = gridToWorld(point, grid);
          const isHover = wallEditHoverPoint?.x === x && wallEditHoverPoint?.y === y;
          const hitZone = scene.add
            .zone(world.x, world.y, grid.tileSize, grid.tileSize)
            .setOrigin(0)
            .setDepth(38.8)
            .setInteractive()
            .on('pointerdown', () => {
              options.onWallEditCellClick?.(point);
            });
          wallEditZones.push(hitZone);

          if (!isHover) {
            continue;
          }

          if (options.activeWallEditWallAssetId) {
            wallEditPreviewNodes.push(
              ...renderFloorEditPreviewCell(
                scene,
                map,
                room,
                point,
                grid,
                assetsById,
                options.activeWallEditWallAssetId
              )
            );
          }
          wallEditOverlay.fillStyle(0x38bdf8, 0.18);
          wallEditOverlay.fillRect(world.x + 3, world.y + 3, grid.tileSize - 6, grid.tileSize - 6);
          wallEditOverlay.lineStyle(3, 0x38bdf8, 1);
          wallEditOverlay.strokeRect(
            world.x + 1,
            world.y + 1,
            grid.tileSize - 2,
            grid.tileSize - 2
          );
        }
      }
      return;
    }

    const doors = new Set((room.wallDoors ?? []).map((door) => `${door.x}:${door.y}`));
    const overlayColor = 0xf59e0b;
    const openingColor = 0x22c55e;
    const doorColor = 0x8b5cf6;
    const tileColor = 0x14b8a6;
    const hoverColor = options.activeWallEditTool === 'paint' ? 0x38bdf8 : 0x0ea5e9;

    for (let y = room.bounds.y; y < room.bounds.y + room.bounds.height; y += 1) {
      for (let x = room.bounds.x; x < room.bounds.x + room.bounds.width; x += 1) {
        const point = { x, y };
        const editTargets = resolveRoomWallEditTargets(room, point).filter(
          (target) => options.activeWallEditTool !== 'tile' || target.side === 'north'
        );

        if (editTargets.length === 0) {
          continue;
        }

        const world = gridToWorld(point, grid);
        const isHover = wallEditHoverPoint?.x === x && wallEditHoverPoint?.y === y;

        for (const editTarget of editTargets) {
          const editTargetPoint = { ...editTarget.point, wallSide: editTarget.side };
          const key = `${editTarget.point.x}:${editTarget.point.y}`;
          const cellKind = getRoomWallCellKind(room, editTargetPoint);
          const isOpening = cellKind === 'opening';
          const isDoor = doors.has(key) && cellKind === 'door';
          const isTileHidden =
            options.activeWallEditTool === 'tile' &&
            isRoomWallTileHidden(room, editTarget.point, editTarget.side);
          const isGeneratedTopFaceCell = editTarget.point.x !== x || editTarget.point.y !== y;
          const cellColor = isDoor
            ? doorColor
            : isTileHidden
              ? tileColor
              : isOpening
                ? openingColor
                : overlayColor;
          const zoneRect = resolveWallEditTargetZone(room, point, editTarget, grid);
          const hitZone = scene.add
            .zone(zoneRect.x, zoneRect.y, zoneRect.width, zoneRect.height)
            .setOrigin(0)
            .setDepth(38.8)
            .setInteractive()
            .on('pointerdown', () => {
              options.onWallEditCellClick?.(editTargetPoint);
            });
          wallEditZones.push(hitZone);
          wallEditOverlay.fillStyle(cellColor, isOpening || isTileHidden ? 0.34 : 0.16);
          wallEditOverlay.fillRect(
            zoneRect.x + 2,
            zoneRect.y + 2,
            Math.max(1, zoneRect.width - 4),
            Math.max(1, zoneRect.height - 4)
          );
          wallEditOverlay.lineStyle(2, cellColor, 0.95);
          wallEditOverlay.strokeRect(
            zoneRect.x + 2,
            zoneRect.y + 2,
            Math.max(1, zoneRect.width - 4),
            Math.max(1, zoneRect.height - 4)
          );

          if (isDoor && !isGeneratedTopFaceCell) {
            drawDoorGlyph(wallEditOverlay, room, point, world.x, world.y, grid.tileSize, doorColor);
          }

          if (isHover) {
            if (options.activeWallEditTool === 'paint' && options.activeWallEditWallAssetId) {
              wallEditPreviewNodes.push(
                ...renderWallEditPreviewCell(
                  scene,
                  room,
                  editTargetPoint,
                  grid,
                  assetsById,
                  options.activeWallEditWallAssetId
                )
              );
            }
            wallEditOverlay.fillStyle(hoverColor, 0.18);
            wallEditOverlay.fillRect(
              zoneRect.x + 4,
              zoneRect.y + 4,
              Math.max(1, zoneRect.width - 8),
              Math.max(1, zoneRect.height - 8)
            );
            wallEditOverlay.lineStyle(3, hoverColor, 1);
            wallEditOverlay.strokeRect(
              zoneRect.x + 1,
              zoneRect.y + 1,
              Math.max(1, zoneRect.width - 2),
              Math.max(1, zoneRect.height - 2)
            );
          }
        }
      }
    }
  }

  function setWallEditHover(point: { x: number; y: number } | null) {
    if (wallEditHoverPoint?.x === point?.x && wallEditHoverPoint?.y === point?.y) {
      return;
    }
    wallEditHoverPoint = point;
    renderWallEditOverlay();
  }

  function getObjectIdAtGrid(point: { x: number; y: number }) {
    for (let index = map.objects.length - 1; index >= 0; index -= 1) {
      const object = map.objects[index]!;
      const width = object.size?.width ?? 1;
      const height = object.size?.height ?? 1;

      if (
        point.x >= object.position.x &&
        point.y >= object.position.y &&
        point.x < object.position.x + width &&
        point.y < object.position.y + height
      ) {
        return object.id;
      }
    }

    return null;
  }

  function getRoomIdAtGrid(point: { x: number; y: number }) {
    if (getObjectIdAtGrid(point)) {
      return null;
    }

    for (let index = map.rooms.length - 1; index >= 0; index -= 1) {
      const room = map.rooms[index]!;
      if (pointInGridRect(point, room.bounds)) {
        return room.id;
      }
    }

    return null;
  }

  function applyAgentVisualStates(agentStates: ObservatoryAgentVisualState[]) {
    if (!isSceneWritable(scene)) {
      return;
    }

    const speechGroupReadiness = createSpeechGroupReadiness(agentStates, agentHandles);

    for (const agentState of agentStates) {
      const handle = agentHandles.get(agentState.agentId);
      let speechDeferredUntilMovementEnds = false;
      const speechKey = agentState.speechMessage
        ? (agentState.speechKey ??
          (agentState.movementKey
            ? `${agentState.movementKey}:${agentState.speechMessage}`
            : `${agentState.agentId}:${agentState.speechMessage}`))
        : undefined;

      if (!handle) {
        continue;
      }

      const speechGroupReady = isSpeechGroupReady(agentState, speechGroupReadiness);
      const speechTargetReached =
        !agentState.targetPoint || isSameGridPoint(handle.agent.position, agentState.targetPoint);
      const speechActive = Boolean(handle.speechBubble && handle.speechTimer);

      if (agentState.speechMessage && handle.movementTween) {
        if (speechGroupReady) {
          handle.pendingSpeechMessage = agentState.speechMessage;
          handle.pendingSpeechKey = speechKey;
          handle.pendingSpeechDurationMs = agentState.speechDurationMs;
          handle.pendingSpeechTone = agentState.speechTone;
        }
        speechDeferredUntilMovementEnds = true;
      } else if (agentState.speechMessage && !speechTargetReached) {
        handle.pendingSpeechMessage = undefined;
        handle.pendingSpeechKey = undefined;
        handle.pendingSpeechDurationMs = undefined;
        handle.pendingSpeechTone = undefined;
        speechDeferredUntilMovementEnds = true;
      }

      if (agentState.status) {
        const previousStatus = handle.agent.status;
        handle.agent.status = agentState.status;
        handle.badge.setFillStyle(agentStatusTint[agentState.status], 1);
        applyAgentStatusVisuals(handle, agentState.status);
        if (previousStatus !== agentState.status) {
          showAgentStatusTransitionEffect(scene, handle, grid, agentState.status);
        }
      }

      if (!handle.movementTween) {
        playAgentAction(
          handle,
          agentState.action ?? actionForStatus(handle.agent.status),
          agentState.direction ?? handle.currentDirection ?? 'down'
        );
      }

      updateAgentAttention(scene, handle, grid, agentState.attention);

      if (
        (agentState.targetPoint || agentState.targetRoomId) &&
        agentState.movementKey &&
        handle.movementKey !== agentState.movementKey
      ) {
        if (!handle.movementTween && !speechActive) {
          const currentRoomId = getRoomIdAtGrid(handle.agent.position);
          const targetPoint =
            agentState.targetPoint ??
            (agentState.targetRoomId
              ? pickObservatoryAgentBehaviorTargetPoint(map, {
                  agentId: agentState.agentId,
                  assetsById,
                  fromPoint: handle.agent.position,
                  seed: agentState.movementKey,
                  targetRoomId: agentState.targetRoomId,
                })
              : null);
          let moved = false;

          if (targetPoint && !isSameGridPoint(targetPoint, handle.agent.position)) {
            moved = moveAgentHandleToGrid(
              handle,
              targetPoint,
              true,
              agentState.action,
              agentState.direction,
              speechGroupReady ? agentState.speechMessage : undefined,
              speechGroupReady ? speechKey : undefined,
              speechGroupReady ? agentState.speechDurationMs : undefined,
              speechGroupReady ? agentState.speechTone : undefined
            );
            speechDeferredUntilMovementEnds = moved && Boolean(agentState.speechMessage);
            handle.movementKey = agentState.movementKey;
          }

          if (!moved && agentState.targetRoomId && !agentState.targetPoint) {
            for (const fallbackRoom of pickFallbackMovementRooms(
              map,
              currentRoomId,
              agentState.targetRoomId,
              agentState.movementKey
            )) {
              const fallbackPoint = pickObservatoryAgentBehaviorTargetPoint(map, {
                agentId: agentState.agentId,
                assetsById,
                fromPoint: handle.agent.position,
                seed: `${agentState.movementKey}:${fallbackRoom.id}`,
                targetRoomId: fallbackRoom.id,
              });

              if (
                fallbackPoint &&
                !isSameGridPoint(fallbackPoint, handle.agent.position) &&
                moveAgentHandleToGrid(
                  handle,
                  fallbackPoint,
                  true,
                  agentState.action,
                  agentState.direction,
                  speechGroupReady ? agentState.speechMessage : undefined,
                  speechGroupReady ? speechKey : undefined,
                  speechGroupReady ? agentState.speechDurationMs : undefined,
                  speechGroupReady ? agentState.speechTone : undefined
                )
              ) {
                moved = true;
                speechDeferredUntilMovementEnds = Boolean(agentState.speechMessage);
                handle.movementKey = agentState.movementKey;
                break;
              }
            }
          }

          if (!moved) {
            handle.movementKey = agentState.movementKey;
            if (agentState.action === 'walk') {
              playAgentAction(
                handle,
                'idle',
                agentState.direction ?? handle.currentDirection ?? 'down'
              );
            }
          }
        } else if (speechActive && !handle.movementTween) {
          playAgentAction(
            handle,
            'idle',
            agentState.direction ?? handle.currentDirection ?? 'down'
          );
        }
      }

      updateAgentTaskProgress(
        scene,
        handle,
        grid,
        agentState.taskProgress,
        agentState.taskTitle,
        agentState.status
      );

      if (
        agentState.taskEffectKey &&
        handle.taskEffectKey !== agentState.taskEffectKey &&
        agentState.taskOutcome
      ) {
        showAgentTaskOutcomeEffect(scene, handle, grid, agentState.taskOutcome);
        handle.taskEffectKey = agentState.taskEffectKey;
      }

      if (
        agentState.speechMessage &&
        speechGroupReady &&
        speechTargetReached &&
        !speechActive &&
        !speechDeferredUntilMovementEnds &&
        handle.speechKey !== speechKey
      ) {
        showAgentSpeechBubble(
          scene,
          handle,
          grid,
          agentState.speechMessage,
          speechKey,
          agentState.speechDurationMs,
          agentState.speechTone
        );
      }
    }
  }

  function applyRoomVisualStates(roomStates: ObservatoryRoomVisualState[]) {
    if (!isSceneWritable(scene)) {
      return;
    }

    const activeRoomIds = new Set(roomStates.map((roomState) => roomState.roomId));

    for (const [roomId, handle] of roomHandles) {
      if (!activeRoomIds.has(roomId)) {
        handle.highlight.setVisible(false);
      }
    }

    for (const roomState of roomStates) {
      const handle = roomHandles.get(roomState.roomId);
      if (!handle) {
        continue;
      }

      handle.highlight
        .setFillStyle(
          agentStatusTint[roomState.status],
          roomState.status === 'complete' ? 0.14 : 0.2
        )
        .setStrokeStyle(2, agentStatusTint[roomState.status], 0.9)
        .setVisible(true);
    }
  }

  function applyViewFilter() {
    const roomMatches = new Map<string, boolean>();
    const objectMatches = new Map<string, boolean>();
    const agentMatches = new Map<string, boolean>();

    for (const room of map.rooms) {
      roomMatches.set(room.id, roomMatchesViewFilter(room, map, viewFilter));
    }

    for (const object of map.objects) {
      objectMatches.set(object.id, objectMatchesViewFilter(object, map, viewFilter));
    }

    for (const agent of map.agents) {
      agentMatches.set(agent.id, agentMatchesViewFilter(agent, map, viewFilter));
    }

    for (const [roomId, handle] of roomHandles) {
      const hasMatchingAgent = map.agents.some(
        (agent) => agent.roomId === roomId && agentMatches.get(agent.id)
      );
      const hasMatchingObject = map.objects.some(
        (object) => object.roomId === roomId && objectMatches.get(object.id)
      );
      const isMatch = Boolean(roomMatches.get(roomId) || hasMatchingAgent || hasMatchingObject);
      setNodesAlpha(handle.nodes, isMatch ? 1 : 0.24);
      setHitZoneEnabled(
        handle.hitZone,
        directSelectionEnabled && isMatch && !options.showWallEditOverlay
      );
    }

    for (const [objectId, handle] of objectHandles) {
      const isLayerVisible = viewFilter.layer === 'all' || viewFilter.layer === 'objects';
      const isMatch = Boolean(isLayerVisible && objectMatches.get(objectId));
      setNodesAlpha(handle.nodes, isMatch ? 1 : 0.16);
      setHitZoneEnabled(
        handle.hitZone,
        directSelectionEnabled && isMatch && !options.showWallEditOverlay
      );
    }

    for (const [agentId, handle] of agentHandles) {
      const isLayerVisible = viewFilter.layer === 'all' || viewFilter.layer === 'agents';
      const isMatch = Boolean(isLayerVisible && agentMatches.get(agentId));
      setAgentHandleAlpha(handle, isMatch ? 1 : 0.16);
      setHitZoneEnabled(
        handle.hitZone,
        directSelectionEnabled && isMatch && !options.showWallEditOverlay
      );
    }
  }

  function moveSelectedAgentToGrid(point: { x: number; y: number }) {
    if (!selectedAgentId || !canMoveAgentToGrid(map, point, assetsById)) {
      return false;
    }

    const handle = agentHandles.get(selectedAgentId);

    if (!handle) {
      return false;
    }

    moveAgentHandleToGrid(handle, point, false);
    selectAgent(selectedAgentId);
    return true;
  }

  function selectAtWorldPoint(point: { x: number; y: number }) {
    const agentHandleList = Array.from(agentHandles.values()).reverse();

    for (const handle of agentHandleList) {
      if (pointInWorldRect(point, getAgentHitZoneBounds(handle))) {
        selectAgent(handle.agent.id);
        options.onAgentSelected?.(handle.agent);
        return true;
      }
    }

    const objectHandleList = Array.from(objectHandles.values()).reverse();

    for (const handle of objectHandleList) {
      const bounds = objectCollisionBoundsToWorldRect(
        handle.object,
        grid,
        assetsById.get(handle.object.assetId)
      );

      if (pointInWorldRect(point, bounds)) {
        selectObject(handle.object.id);
        options.onObjectSelected?.(handle.object);
        return true;
      }
    }

    for (const handle of Array.from(roomHandles.values()).reverse()) {
      if (pointInWorldRect(point, gridRectToWorldRect(handle.room.bounds, grid))) {
        selectRoom(handle.room.id);
        options.onRoomSelected?.(handle.room);
        return true;
      }
    }

    return false;
  }

  function moveAgentHandleToGrid(
    handle: RenderedAgentHandle,
    point: { x: number; y: number },
    animate = true,
    restAction = actionForStatus(handle.agent.status),
    restDirection?: ObservatoryCharacterDirection,
    pendingSpeechMessage?: string,
    pendingSpeechKey?: string,
    pendingSpeechDurationMs?: number,
    pendingSpeechTone?: ObservatoryAgentVisualState['speechTone']
  ) {
    handle.movementTween?.stop();

    if (!animate) {
      const center = gridToWorldCenter(point, grid);
      handle.agent.position = { ...point };
      placeAgentHandleAtCenter(handle, center);
      return true;
    }

    const path = resolveObservatoryGridPath(map, handle.agent.position, point, assetsById);

    if (path.length === 0) {
      playAgentAction(
        handle,
        restAction === 'walk' ? 'idle' : restAction,
        restDirection ?? handle.currentDirection ?? 'down'
      );
      return false;
    }

    handle.pendingSpeechMessage = pendingSpeechMessage;
    handle.pendingSpeechKey = pendingSpeechKey;
    handle.pendingSpeechDurationMs = pendingSpeechDurationMs;
    handle.pendingSpeechTone = pendingSpeechTone;
    moveAgentHandleAlongPath(handle, path, restAction, restDirection);
    return true;
  }

  function moveAgentHandleAlongPath(
    handle: RenderedAgentHandle,
    path: Array<{ x: number; y: number }>,
    restAction: ObservatoryCharacterActionName,
    restDirection?: ObservatoryCharacterDirection
  ) {
    const [nextPoint, ...remainingPath] = path;

    if (!nextPoint) {
      playAgentAction(handle, restAction, restDirection ?? handle.currentDirection ?? 'down');
      if (handle.pendingSpeechMessage) {
        showAgentSpeechBubble(
          scene,
          handle,
          grid,
          handle.pendingSpeechMessage,
          handle.pendingSpeechKey,
          handle.pendingSpeechDurationMs,
          handle.pendingSpeechTone
        );
        handle.pendingSpeechMessage = undefined;
        handle.pendingSpeechKey = undefined;
        handle.pendingSpeechDurationMs = undefined;
        handle.pendingSpeechTone = undefined;
      }
      if (selectedAgentId === handle.agent.id) {
        selectAgent(selectedAgentId);
      }
      return;
    }

    const previousPosition = { ...handle.agent.position };
    const startCenter = getAgentHandleCenter(handle);
    const targetCenter = gridToWorldCenter(nextPoint, grid);
    const tweenPoint = { ...startCenter };
    const movementDirection = directionFromGridDelta(previousPosition, nextPoint);
    playAgentAction(handle, 'walk', movementDirection);

    handle.movementTween = scene.tweens.add({
      duration: agentWalkTileDurationMs,
      ease: 'Linear',
      targets: tweenPoint,
      x: targetCenter.x,
      y: targetCenter.y,
      onUpdate: () => placeAgentHandleAtCenter(handle, tweenPoint),
      onComplete: () => {
        handle.agent.position = { ...nextPoint };
        placeAgentHandleAtCenter(handle, targetCenter);
        handle.movementTween = undefined;
        if (selectedAgentId === handle.agent.id) {
          selectAgent(selectedAgentId);
        }
        moveAgentHandleAlongPath(handle, remainingPath, restAction, restDirection);
      },
    });
  }

  return {
    applyAgentVisualStates,
    applyRoomVisualStates,
    getSelectedAgentId,
    getSelectedObjectBounds,
    getSelectedObjectId,
    getSelectedRoomBounds,
    getSelectedRoomId,
    getObjectIdAtGrid,
    getRoomIdAtGrid,
    moveSelectedAgentToGrid,
    setWallEditHover,
    selectAgent,
    selectAtWorldPoint,
    selectObject,
    selectRoom,
  };
}

function pointInWorldRect(
  point: { x: number; y: number },
  rect: { height: number; width: number; x: number; y: number }
) {
  return (
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x <= rect.x + rect.width &&
    point.y <= rect.y + rect.height
  );
}

function isSameGridPoint(left: { x: number; y: number }, right: { x: number; y: number }) {
  return left.x === right.x && left.y === right.y;
}

function createSpeechGroupReadiness(
  agentStates: ObservatoryAgentVisualState[],
  agentHandles: Map<string, RenderedAgentHandle>
) {
  const readiness = new Map<string, { ready: number; total: number }>();

  for (const agentState of agentStates) {
    if (!agentState.speechGroupKey) {
      continue;
    }

    const current = readiness.get(agentState.speechGroupKey) ?? { ready: 0, total: 0 };
    const handle = agentHandles.get(agentState.agentId);
    current.total += 1;

    if (
      handle &&
      !handle.movementTween &&
      agentState.targetPoint &&
      isSameGridPoint(handle.agent.position, agentState.targetPoint)
    ) {
      current.ready += 1;
    }

    readiness.set(agentState.speechGroupKey, current);
  }

  return readiness;
}

function isSpeechGroupReady(
  agentState: ObservatoryAgentVisualState,
  readiness: Map<string, { ready: number; total: number }>
) {
  if (!agentState.speechGroupKey) {
    return true;
  }

  const group = readiness.get(agentState.speechGroupKey);
  return Boolean(group && group.total >= 2 && group.ready === group.total);
}

function pickFallbackMovementRooms(
  map: ObservatoryMap,
  currentRoomId: string | null,
  targetRoomId: string,
  seed: string
) {
  return [...map.rooms]
    .filter((room) => room.id !== currentRoomId && room.id !== targetRoomId)
    .sort(
      (left, right) =>
        hashString(`${seed}:${left.id}`) - hashString(`${seed}:${right.id}`) ||
        left.id.localeCompare(right.id)
    );
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

interface NormalizedOfficeMapViewFilter {
  layer: 'agents' | 'all' | 'objects';
  roomKind: 'all' | ObservatoryRoomKind;
  search: string;
}

function normalizeViewFilter(
  viewFilter: ObservatoryOfficeMapViewFilter | undefined
): NormalizedOfficeMapViewFilter {
  return {
    layer: viewFilter?.layer ?? 'all',
    roomKind: viewFilter?.roomKind ?? 'all',
    search: normalizeSearch(viewFilter?.search ?? ''),
  };
}

function roomMatchesViewFilter(
  room: ObservatoryRoom,
  map: ObservatoryMap,
  viewFilter: NormalizedOfficeMapViewFilter
) {
  if (viewFilter.roomKind !== 'all' && room.kind !== viewFilter.roomKind) {
    return false;
  }

  if (!viewFilter.search) {
    return true;
  }

  return textMatchesSearch(viewFilter.search, room.id, room.name, room.kind, map.name);
}

function objectMatchesViewFilter(
  object: ObservatoryObject,
  map: ObservatoryMap,
  viewFilter: NormalizedOfficeMapViewFilter
) {
  const room = object.roomId
    ? map.rooms.find((candidate) => candidate.id === object.roomId)
    : undefined;

  if (viewFilter.roomKind !== 'all' && room?.kind !== viewFilter.roomKind) {
    return false;
  }

  if (!viewFilter.search) {
    return true;
  }

  return textMatchesSearch(
    viewFilter.search,
    object.id,
    object.assetId,
    object.roomId,
    room?.id,
    room?.name,
    room?.kind
  );
}

function agentMatchesViewFilter(
  agent: ObservatoryAgent,
  map: ObservatoryMap,
  viewFilter: NormalizedOfficeMapViewFilter
) {
  const room = agent.roomId
    ? map.rooms.find((candidate) => candidate.id === agent.roomId)
    : undefined;

  if (viewFilter.roomKind !== 'all' && room?.kind !== viewFilter.roomKind) {
    return false;
  }

  if (!viewFilter.search) {
    return true;
  }

  return textMatchesSearch(
    viewFilter.search,
    agent.id,
    agent.name,
    agent.assetId,
    agent.roomId,
    agent.status,
    room?.id,
    room?.name,
    room?.kind
  );
}

function textMatchesSearch(search: string, ...values: Array<string | undefined>) {
  return values.some((value) => normalizeSearch(value ?? '').includes(search));
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function setNodesAlpha(nodes: Phaser.GameObjects.GameObject[], alpha: number) {
  for (const node of nodes) {
    setNodeAlpha(node, alpha);
  }
}

function setAgentHandleAlpha(handle: RenderedAgentHandle, alpha: number) {
  const nodes: Phaser.GameObjects.GameObject[] = [
    handle.sprite,
    handle.badge,
    handle.label,
    handle.hitZone,
  ];

  if (handle.attentionSprite) {
    nodes.push(handle.attentionSprite);
  }

  if (handle.progressBackground) {
    nodes.push(handle.progressBackground);
  }

  if (handle.progressFill) {
    nodes.push(handle.progressFill);
  }

  if (handle.progressLabel) {
    nodes.push(handle.progressLabel);
  }

  if (handle.speechBubble) {
    nodes.push(handle.speechBubble);
  }

  setNodesAlpha(nodes, alpha);
}

function setNodeAlpha(node: Phaser.GameObjects.GameObject, alpha: number) {
  const alphaNode = node as Phaser.GameObjects.GameObject & {
    setAlpha?: (nextAlpha: number) => unknown;
  };
  alphaNode.setAlpha?.(alpha);
}

function setHitZoneEnabled(hitZone: Phaser.GameObjects.Zone, enabled: boolean) {
  if (enabled) {
    hitZone.setInteractive();
    return;
  }

  hitZone.disableInteractive();
}

function renderMapBackdrop(scene: Phaser.Scene, map: ObservatoryMap, grid: ObservatoryGridConfig) {
  scene.add
    .rectangle(0, 0, map.size.width * grid.tileSize, map.size.height * grid.tileSize, 0xeaf4f8)
    .setOrigin(0)
    .setDepth(0);
}

function renderRoomFloor(
  scene: Phaser.Scene,
  map: ObservatoryMap,
  room: ObservatoryRoom,
  grid: ObservatoryGridConfig,
  assetsById: Map<string, ObservatoryAssetDefinition>
): Phaser.GameObjects.GameObject[] {
  const nodes: Phaser.GameObjects.GameObject[] = [];
  const minX = room.bounds.x;
  const maxX = room.bounds.x + room.bounds.width;
  const minY = room.bounds.y;
  const maxY = room.bounds.y + room.bounds.height;

  for (let y = minY; y < maxY; y += 1) {
    for (let x = minX; x < maxX; x += 1) {
      const point = { x, y };

      if (!isRoomFloorCellVisible(room, point, assetsById)) {
        continue;
      }

      const assetId = getRoomFloorAssetId(map, room, point);
      const asset = assetsById.get(assetId);
      const textureKey = resolveTextureKey(scene, assetId);
      const fallbackFrame = resolveTextureFrame(assetsById, assetId);
      const world = gridToWorld({ x, y }, grid);
      const frame = resolveObservatoryFloorAutotileFrame(asset, room, point, fallbackFrame);
      nodes.push(
        scene.add
          .image(world.x, world.y, textureKey, frame)
          .setOrigin(0)
          .setDisplaySize(grid.tileSize, grid.tileSize)
          .setDepth(1)
      );
    }
  }

  return nodes;
}

function isRoomFloorCellVisible(
  room: ObservatoryRoom,
  point: { x: number; y: number },
  assetsById: Map<string, ObservatoryAssetDefinition>
) {
  // White perimeter strips overlay the floor. The north wall is different:
  // it is a two-row Section B face strip, so both occupied grid cells must
  // suppress the room floor underneath.
  return !isRoomWallFaceStackCell(room, point, assetsById);
}

function isRoomWallFaceStackCell(
  room: ObservatoryRoom,
  point: { x: number; y: number },
  _assetsById: Map<string, ObservatoryAssetDefinition>
) {
  const topWallPoint = { x: point.x, y: room.bounds.y };

  if (
    !isVisibleRoomWallSide(room, topWallPoint, 'north') ||
    isRoomWallTileHidden(room, topWallPoint, 'north')
  ) {
    return false;
  }

  return point.y === topWallPoint.y || point.y === topWallPoint.y + 1;
}

function renderRoomWalls(
  scene: Phaser.Scene,
  map: ObservatoryMap,
  room: ObservatoryRoom,
  grid: ObservatoryGridConfig,
  assetsById: Map<string, ObservatoryAssetDefinition>
): Phaser.GameObjects.GameObject[] {
  const nodes: Phaser.GameObjects.GameObject[] = [];
  const wallBounds = gridRectToWorldRect(room.bounds, grid);
  const mapSize = map.size ?? resolveMapSizeFromRooms(map.rooms);
  const wallAutotileRenderers = new Map<string, RpgMakerA4WallAutotileRenderer>();
  const wallBlitterLayers = new Map<string, RoomWallBlitterLayers>();

  const getWallAutotileRenderer = (
    textureKey: string,
    rendererOptions: ReturnType<typeof RpgMakerA4WallAutotileRenderer.optionsForAsset>
  ) => {
    const cacheKey = JSON.stringify([textureKey, rendererOptions]);
    const cached = wallAutotileRenderers.get(cacheKey);
    if (cached) {
      return cached;
    }

    const renderer = new RpgMakerA4WallAutotileRenderer(scene, textureKey, rendererOptions);
    wallAutotileRenderers.set(cacheKey, renderer);
    return renderer;
  };

  const getWallBlitterLayers = (
    cacheKey: string,
    renderer: RpgMakerA4WallAutotileRenderer
  ): RoomWallBlitterLayers => {
    const cached = wallBlitterLayers.get(cacheKey);
    if (cached) {
      return cached;
    }

    const textureKey = renderer.getPreparedTextureKey();
    const layers = {
      faceLayer: scene.add
        .blitter(wallBounds.x, wallBounds.y, textureKey)
        .setName('WallFaceBlitterLayer')
        .setDepth(5),
    };
    nodes.push(layers.faceLayer);
    wallBlitterLayers.set(cacheKey, layers);
    return layers;
  };

  const faceAnchors: RoomWallFaceAnchor[] = [];

  for (let y = room.bounds.y; y < room.bounds.y + room.bounds.height; y += 1) {
    for (let x = room.bounds.x; x < room.bounds.x + room.bounds.width; x += 1) {
      const point = { x, y };

      if (!isVisibleRoomWallCell(room, point)) {
        continue;
      }

      const wallAssetId = getRoomWallAssetId(room, point);
      const asset = wallAssetId ? assetsById.get(wallAssetId) : undefined;
      const textureKey = resolveTextureKey(scene, wallAssetId ?? '');

      if (!wallAssetId || !textureKey) {
        continue;
      }

      if (
        asset?.autotile?.kind !== 'rpgmaker-a4-wall' ||
        textureKey === OBSERVATORY_FALLBACK_TEXTURE_KEY
      ) {
        const fallbackFrame = resolveTextureFrame(assetsById, wallAssetId);
        const world = gridToWorld(point, grid);
        nodes.push(
          scene.add
            .image(world.x, world.y, textureKey, fallbackFrame)
            .setOrigin(0)
            .setDisplaySize(grid.tileSize, grid.tileSize)
            .setDepth(5)
        );
        continue;
      }

      const rendererOptions = RpgMakerA4WallAutotileRenderer.optionsForAsset(asset);
      const rendererCacheKey = JSON.stringify([textureKey, rendererOptions]);
      const anchor: RoomWallFaceAnchor = {
        asset,
        assetId: wallAssetId,
        blockIndex: RpgMakerA4WallAutotileRenderer.blockIndexForAsset(asset),
        faceHeight: getRoomWallHeight(room, point, asset),
        point,
        renderer: getWallAutotileRenderer(textureKey, rendererOptions),
        rendererCacheKey,
        textureKey,
      };

      if (
        isRoomWallTopEdge(room, point) &&
        isVisibleRoomWallSide(room, point, 'north') &&
        !isRoomWallTileHidden(room, point, 'north')
      ) {
        const faceHeight = Math.min(2, Math.max(0, mapSize.height - point.y));

        if (faceHeight > 0) {
          faceAnchors.push({
            ...anchor,
            faceHeight,
            point,
          });
        }

        continue;
      }
    }
  }

  // Pass 1: the north/top wall is rendered as a full 48x96 Section B strip.
  // This consumes the room's top perimeter row and the row immediately below
  // it. Section A is intentionally not stamped anywhere in this renderer.
  for (const anchor of faceAnchors) {
    const blitterLayers = getWallBlitterLayers(anchor.rendererCacheKey, anchor.renderer);
    const world = gridToWorld(anchor.point, grid);

    for (let faceIndex = 0; faceIndex < anchor.faceHeight; faceIndex += 1) {
      anchor.renderer.stampQuadrantsToBlitter(
        blitterLayers.faceLayer,
        resolveA4WallSolidFaceQuadrants(faceIndex),
        world.x - wallBounds.x,
        world.y - wallBounds.y + faceIndex * grid.tileSize,
        anchor.blockIndex
      );
    }
  }

  const borderStrips = renderRoomWallBorderStrips(scene, room, grid);
  if (borderStrips) {
    nodes.push(borderStrips);
  }

  return nodes;
}

function renderRoomWallBorderStrips(
  scene: Phaser.Scene,
  room: ObservatoryRoom,
  grid: ObservatoryGridConfig
) {
  const graphics = scene.add.graphics().setDepth(roomWallBorderStripDepth);
  let hasStrips = false;

  for (let y = room.bounds.y; y < room.bounds.y + room.bounds.height; y += 1) {
    for (let x = room.bounds.x; x < room.bounds.x + room.bounds.width; x += 1) {
      const point = { x, y };

      if (!isVisibleRoomWallCell(room, point)) {
        continue;
      }

      drawRoomWallBorderStripCell(graphics, room, point, grid, 1);
      hasStrips = true;
    }
  }

  if (!hasStrips) {
    graphics.destroy();
    return null;
  }

  return graphics;
}

function renderRoomWallBorderStripPreview(
  scene: Phaser.Scene,
  room: ObservatoryRoom,
  point: { x: number; y: number },
  grid: ObservatoryGridConfig,
  side?: ObservatoryRoomWallSide
) {
  const graphics = scene.add.graphics().setDepth(39.65);
  drawRoomWallBorderStripCell(graphics, room, point, grid, 0.72, side ? [side] : undefined);
  return graphics;
}

function drawRoomWallBorderStripCell(
  graphics: Phaser.GameObjects.Graphics,
  room: ObservatoryRoom,
  point: { x: number; y: number },
  grid: ObservatoryGridConfig,
  alpha: number,
  sides?: ObservatoryRoomWallSide[]
) {
  const world = gridToWorld(point, grid);
  const tileSize = grid.tileSize;
  const targetSides =
    sides ??
    getRoomPerimeterSides(room, point).filter((side) => isVisibleRoomWallSide(room, point, side));

  if (targetSides.includes('north')) {
    graphics.fillStyle(roomWallStripColor, alpha);
    graphics.fillRect(world.x, world.y, tileSize, roomWallStripSize);
  }

  if (targetSides.includes('east')) {
    const stripX = world.x + tileSize - roomWallStripSize;
    graphics.fillStyle(roomWallStripColor, alpha);
    graphics.fillRect(stripX, world.y, roomWallStripSize, tileSize);
  }

  if (targetSides.includes('west')) {
    graphics.fillStyle(roomWallStripColor, alpha);
    graphics.fillRect(world.x, world.y, roomWallStripSize, tileSize);
  }

  if (targetSides.includes('south')) {
    const stripY = world.y + tileSize - roomWallStripSize;
    graphics.fillStyle(roomWallStripColor, alpha);
    graphics.fillRect(world.x, stripY, tileSize, roomWallStripSize);
  }
}

function resolveRoomWallEditTargets(
  room: ObservatoryRoom,
  point: { x: number; y: number }
): RoomWallEditTarget[] {
  const targets = getRoomPerimeterSides(room, point).map((side) => ({
    point,
    side,
  }));
  const topWallPoint = { x: point.x, y: room.bounds.y };

  if (point.y === room.bounds.y + 1 && isVisibleRoomWallSide(room, topWallPoint, 'north')) {
    targets.push({ point: topWallPoint, side: 'north' });
  }

  const deduped = new Map<string, RoomWallEditTarget>();
  for (const target of targets) {
    deduped.set(`${target.point.x}:${target.point.y}:${target.side}`, target);
  }

  return [...deduped.values()];
}

function resolveWallEditTargetZone(
  room: ObservatoryRoom,
  displayPoint: { x: number; y: number },
  target: RoomWallEditTarget,
  grid: ObservatoryGridConfig
) {
  const world = gridToWorld(displayPoint, grid);
  const tileSize = grid.tileSize;
  const halfTile = tileSize / 2;
  const isGeneratedTopFaceCell =
    target.point.x !== displayPoint.x || target.point.y !== displayPoint.y;

  if (isGeneratedTopFaceCell) {
    return {
      height: tileSize,
      width: tileSize,
      x: world.x,
      y: world.y,
    };
  }

  if (target.side === 'north') {
    return {
      height: halfTile,
      width: tileSize,
      x: world.x,
      y: world.y,
    };
  }

  if (target.side === 'south') {
    return {
      height: halfTile,
      width: tileSize,
      x: world.x,
      y: world.y + halfTile,
    };
  }

  const sides = getRoomPerimeterSides(room, target.point);
  const trimTop = sides.includes('north') ? halfTile : 0;
  const trimBottom = sides.includes('south') ? halfTile : 0;
  const height = Math.max(1, tileSize - trimTop - trimBottom);

  return {
    height,
    width: halfTile,
    x: target.side === 'east' ? world.x + halfTile : world.x,
    y: world.y + trimTop,
  };
}

function renderRoomWallDoors(
  scene: Phaser.Scene,
  room: ObservatoryRoom,
  grid: ObservatoryGridConfig
): Phaser.GameObjects.GameObject[] {
  if (!room.wallDoors || room.wallDoors.length === 0) {
    return [];
  }

  const graphics = scene.add.graphics().setDepth(6);
  for (const door of room.wallDoors) {
    if (!pointInGridRect(door, room.bounds)) {
      continue;
    }

    const world = gridToWorld(door, grid);
    drawDoorGlyph(graphics, room, door, world.x, world.y, grid.tileSize, 0x7c3aed);
  }

  return [graphics];
}

function renderWallEditPreviewCell(
  scene: Phaser.Scene,
  room: ObservatoryRoom,
  point: ObservatoryWallEditPoint,
  grid: ObservatoryGridConfig,
  assetsById: Map<string, ObservatoryAssetDefinition>,
  wallAssetId: string
) {
  const asset = assetsById.get(wallAssetId);
  const textureKey = resolveTextureKey(scene, wallAssetId);
  const fallbackFrame = resolveTextureFrame(assetsById, wallAssetId);
  const world = gridToWorld(point, grid);
  const nodes: Phaser.GameObjects.GameObject[] = [];

  if (!textureKey) {
    return nodes;
  }

  if (
    asset?.autotile?.kind === 'rpgmaker-a4-wall' &&
    textureKey !== OBSERVATORY_FALLBACK_TEXTURE_KEY
  ) {
    if (point.wallSide === 'north' && isRoomWallTopEdge(room, point)) {
      const renderer = new RpgMakerA4WallAutotileRenderer(
        scene,
        textureKey,
        RpgMakerA4WallAutotileRenderer.optionsForAsset(asset)
      );
      const blockIndex = RpgMakerA4WallAutotileRenderer.blockIndexForAsset(asset);
      const renderTexture = scene.add
        .renderTexture(world.x, world.y, grid.tileSize, grid.tileSize * 2)
        .setOrigin(0)
        .setDepth(39.5)
        .setAlpha(0.72);

      for (let faceIndex = 0; faceIndex < 2; faceIndex += 1) {
        renderer.stampQuadrants(
          renderTexture,
          resolveA4WallSolidFaceQuadrants(faceIndex),
          0,
          faceIndex * grid.tileSize,
          blockIndex,
          grid.tileSize
        );
      }

      (renderTexture as { render?: () => void }).render?.();
      nodes.push(renderTexture);
    }

    nodes.push(renderRoomWallBorderStripPreview(scene, room, point, grid, point.wallSide));
    return nodes;
  }

  nodes.push(
    scene.add
      .image(world.x, world.y, textureKey, fallbackFrame)
      .setOrigin(0)
      .setDisplaySize(grid.tileSize, grid.tileSize)
      .setDepth(39.5)
      .setAlpha(0.72)
  );
  return nodes;
}

function renderFloorEditPreviewCell(
  scene: Phaser.Scene,
  map: ObservatoryMap,
  room: ObservatoryRoom,
  point: { x: number; y: number },
  grid: ObservatoryGridConfig,
  assetsById: Map<string, ObservatoryAssetDefinition>,
  floorAssetId: string
) {
  const asset = assetsById.get(floorAssetId);
  const textureKey = resolveTextureKey(scene, floorAssetId);
  const fallbackFrame = resolveTextureFrame(assetsById, floorAssetId);
  const world = gridToWorld(point, grid);
  const nodes: Phaser.GameObjects.GameObject[] = [];

  if (!textureKey) {
    return nodes;
  }

  const frame = resolveObservatoryFloorAutotileFrame(asset, room, point, fallbackFrame);
  nodes.push(
    scene.add
      .image(world.x, world.y, textureKey, frame)
      .setOrigin(0)
      .setDisplaySize(grid.tileSize, grid.tileSize)
      .setDepth(39.5)
      .setAlpha(0.72)
  );

  return nodes;
}

function renderRoomLabel(scene: Phaser.Scene, room: ObservatoryRoom, grid: ObservatoryGridConfig) {
  const bounds = gridRectToWorldRect(room.bounds, grid);
  const labelY = room.bounds.y > 0 ? Math.max(8, bounds.y - 22) : bounds.y + 10;
  return scene.add
    .text(bounds.x + 10, labelY, room.name, {
      backgroundColor: '#0f172a',
      color: '#ecfeff',
      fontFamily: 'monospace',
      fontSize: '12px',
      padding: { x: 6, y: 4 },
    })
    .setDepth(20);
}

function renderRoomHighlight(
  scene: Phaser.Scene,
  room: ObservatoryRoom,
  grid: ObservatoryGridConfig
): Phaser.GameObjects.Rectangle {
  const bounds = gridRectToWorldRect(room.bounds, grid);
  return scene.add
    .rectangle(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
      bounds.width - 10,
      bounds.height - 10,
      0x38bdf8,
      0
    )
    .setDepth(13)
    .setVisible(false);
}

function addRoomHitArea(
  scene: Phaser.Scene,
  room: ObservatoryRoom,
  grid: ObservatoryGridConfig,
  onSelect: () => void
) {
  const bounds = gridRectToWorldRect(room.bounds, grid);
  return scene.add
    .zone(bounds.x, bounds.y, bounds.width, bounds.height)
    .setOrigin(0)
    .setInteractive()
    .setDepth(30)
    .on('pointerdown', onSelect);
}

function renderObject(
  scene: Phaser.Scene,
  object: ObservatoryObject,
  grid: ObservatoryGridConfig,
  assetsById: Map<string, ObservatoryAssetDefinition>,
  onSelect: () => void
): RenderedObjectHandle {
  const asset = assetsById.get(object.assetId);
  const bounds = objectBoundsToWorldRect(object, grid, asset);
  const hitBounds = objectCollisionBoundsToWorldRect(object, grid, asset);
  const depth = object.render?.depth ?? 18;
  const textureKey = resolveTextureKey(scene, object.assetId);
  const anchor = asset?.anchor ?? { x: 0, y: 0 };
  const x = bounds.x + bounds.width * anchor.x;
  const y = bounds.y + bounds.height * anchor.y;
  const nodes: Phaser.GameObjects.GameObject[] = [];

  if (asset?.animation) {
    nodes.push(
      scene.add
        .sprite(x, y, textureKey, asset.frame ?? 0)
        .setOrigin(anchor.x, anchor.y)
        .setDisplaySize(bounds.width, bounds.height)
        .setDepth(depth)
        .play(asset.animation.key)
    );
  } else {
    nodes.push(
      ...renderStaticObjectImages(scene, textureKey, asset, bounds, anchor, depth, {
        hasExplicitSize: object.render?.sizePx !== undefined,
        sourceCrop: object.render?.sourceCrop,
      })
    );
  }

  const hitZone = scene.add
    .zone(hitBounds.x, hitBounds.y, hitBounds.width, hitBounds.height)
    .setOrigin(0)
    .setInteractive()
    .setDepth(35)
    .on('pointerdown', onSelect);

  nodes.push(hitZone);

  return { hitZone, nodes, object };
}

function renderStaticObjectImages(
  scene: Phaser.Scene,
  textureKey: string,
  asset: ObservatoryAssetDefinition | undefined,
  bounds: { height: number; width: number; x: number; y: number },
  anchor: { x: number; y: number },
  depth: number,
  renderOptions: {
    hasExplicitSize?: boolean;
    sourceCrop?: { height: number; width: number; x: number; y: number };
  } = {}
): Phaser.GameObjects.Image[] {
  const sourceCrop = renderOptions.sourceCrop;

  if (sourceCrop) {
    return [
      scene.add
        .image(bounds.x + bounds.width * anchor.x, bounds.y + bounds.height * anchor.y, textureKey)
        .setOrigin(anchor.x, anchor.y)
        .setCrop(sourceCrop.x, sourceCrop.y, sourceCrop.width, sourceCrop.height)
        .setDisplaySize(bounds.width, bounds.height)
        .setDepth(depth),
    ];
  }

  const frameWidth = asset?.source.frameWidth;
  const frameHeight = asset?.source.frameHeight;
  const sourceWidth = getTextureSourceWidth(scene, textureKey);
  const columns = frameWidth && sourceWidth ? Math.floor(sourceWidth / frameWidth) : 0;
  const objectColumns =
    frameWidth && asset?.width ? Math.max(1, Math.round(asset.width / frameWidth)) : 1;
  const objectRows =
    frameHeight && asset?.height ? Math.max(1, Math.round(asset.height / frameHeight)) : 1;
  const canCompose = Boolean(
    asset?.source.kind === 'spritesheet' &&
    asset.tags?.includes('compose-adjacent') &&
    asset.frame !== undefined &&
    columns > 0 &&
    objectColumns * objectRows > 1 &&
    anchor.x === 0 &&
    anchor.y === 0
  );

  if (!canCompose) {
    const displaySize =
      asset?.source.kind === 'image' &&
      !renderOptions.hasExplicitSize &&
      asset.width !== undefined &&
      asset.height !== undefined
        ? { height: asset.height, width: asset.width }
        : { height: bounds.height, width: bounds.width };

    return [
      scene.add
        .image(
          bounds.x + bounds.width * anchor.x,
          bounds.y + bounds.height * anchor.y,
          textureKey,
          asset?.frame
        )
        .setOrigin(anchor.x, anchor.y)
        .setDisplaySize(displaySize.width, displaySize.height)
        .setDepth(depth),
    ];
  }

  const cellWidth = bounds.width / objectColumns;
  const cellHeight = bounds.height / objectRows;
  const nodes: Phaser.GameObjects.Image[] = [];

  for (let row = 0; row < objectRows; row += 1) {
    for (let column = 0; column < objectColumns; column += 1) {
      nodes.push(
        scene.add
          .image(
            bounds.x + column * cellWidth,
            bounds.y + row * cellHeight,
            textureKey,
            asset!.frame! + row * columns + column
          )
          .setOrigin(0)
          .setDisplaySize(cellWidth, cellHeight)
          .setDepth(depth)
      );
    }
  }

  return nodes;
}

function isVisibleRoomWallCell(room: ObservatoryRoom, point: { x: number; y: number }) {
  return getRoomPerimeterSides(room, point).some((side) =>
    isVisibleRoomWallSide(room, point, side)
  );
}

function isVisibleRoomWallSide(
  room: ObservatoryRoom,
  point: { x: number; y: number },
  side: ObservatoryRoomWallSide
) {
  if (!getRoomPerimeterSides(room, point).includes(side)) {
    return false;
  }

  return !isRoomWallSideOpen(room, point, side);
}

function isRoomWallSideOpen(
  room: ObservatoryRoom,
  point: { x: number; y: number },
  side: ObservatoryRoomWallSide
) {
  const key = `${point.x}:${point.y}`;
  if ((room.wallOpenings ?? []).some((opening) => `${opening.x}:${opening.y}` === key)) {
    return true;
  }

  return (room.wallEdgeOpenings ?? []).some(
    (opening) => opening.point.x === point.x && opening.point.y === point.y && opening.side === side
  );
}

function isRoomWallTileHidden(
  room: ObservatoryRoom,
  point: { x: number; y: number },
  side: ObservatoryRoomWallSide
) {
  return (room.wallTileOpenings ?? []).some(
    (opening) => opening.point.x === point.x && opening.point.y === point.y && opening.side === side
  );
}

function getRoomPerimeterSides(
  room: ObservatoryRoom,
  point: { x: number; y: number }
): ObservatoryRoomWallSide[] {
  const minX = room.bounds.x;
  const maxX = room.bounds.x + room.bounds.width - 1;
  const minY = room.bounds.y;
  const maxY = room.bounds.y + room.bounds.height - 1;
  const sides: ObservatoryRoomWallSide[] = [];

  if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY) {
    return sides;
  }

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

function resolveMapSizeFromRooms(rooms: ObservatoryRoom[]) {
  return rooms.reduce(
    (size, room) => ({
      height: Math.max(size.height, room.bounds.y + room.bounds.height),
      width: Math.max(size.width, room.bounds.x + room.bounds.width),
    }),
    { height: 0, width: 0 }
  );
}

function isRoomWallTopEdge(room: ObservatoryRoom, point: { x: number; y: number }) {
  return point.y === room.bounds.y;
}

function getRoomWallAssetId(room: ObservatoryRoom, point: { x: number; y: number }) {
  const override = room.wallAssetOverrides?.find(
    (candidate) => candidate.point.x === point.x && candidate.point.y === point.y
  );
  return override?.assetId ?? room.wallAssetId;
}

function getRoomWallHeight(
  room: ObservatoryRoom,
  point: { x: number; y: number },
  asset: ObservatoryAssetDefinition | undefined
) {
  const override = room.wallAssetOverrides?.find(
    (candidate) => candidate.point.x === point.x && candidate.point.y === point.y
  );
  return Math.max(
    1,
    Math.floor(override?.height ?? room.wallHeight ?? getDefaultA4WallHeightForAsset(asset))
  );
}

function getDefaultA4WallHeightForAsset(asset: ObservatoryAssetDefinition | undefined) {
  if (asset?.autotile?.kind !== 'rpgmaker-a4-wall') {
    return 1;
  }

  return RpgMakerA4WallAutotileRenderer.blockIndexForAsset(asset) ===
    RPG_MAKER_A4_WALL_BRICK_BLOCK_INDEX
    ? 2
    : 1;
}

function getRoomFloorAssetId(
  map: ObservatoryMap,
  room: ObservatoryRoom,
  point: { x: number; y: number }
) {
  const override = room.floorAssetOverrides?.find(
    (candidate) => candidate.point.x === point.x && candidate.point.y === point.y
  );
  return override?.assetId ?? room.floorAssetId ?? map.defaultFloorAssetId;
}

function getRoomWallCellKind(
  room: ObservatoryRoom,
  point: ObservatoryWallEditPoint
): ObservatoryRoomWallCellKind {
  if ((room.wallDoors ?? []).some((door) => door.x === point.x && door.y === point.y)) {
    return 'door';
  }

  if ((room.wallOpenings ?? []).some((opening) => opening.x === point.x && opening.y === point.y)) {
    return 'opening';
  }

  if (point.wallSide) {
    return isRoomWallSideOpen(room, point, point.wallSide) ? 'opening' : 'wall';
  }

  const sides = getRoomPerimeterSides(room, point);
  if (sides.length > 0 && sides.every((side) => isRoomWallSideOpen(room, point, side))) {
    return 'opening';
  }

  return 'wall';
}

function drawDoorGlyph(
  graphics: Phaser.GameObjects.Graphics,
  room: ObservatoryRoom,
  point: { x: number; y: number },
  worldX: number,
  worldY: number,
  tileSize: number,
  color: number
) {
  const kind = resolveWallDoorOrientation(room, point);
  const thickness = Math.max(10, Math.floor(tileSize * 0.2));
  const span = Math.max(20, Math.floor(tileSize * 0.62));
  const x =
    kind === 'horizontal' ? worldX + (tileSize - span) / 2 : worldX + (tileSize - thickness) / 2;
  const y =
    kind === 'horizontal' ? worldY + (tileSize - thickness) / 2 : worldY + (tileSize - span) / 2;
  const width = kind === 'horizontal' ? span : thickness;
  const height = kind === 'horizontal' ? thickness : span;

  graphics.fillStyle(0xffffff, 0.92);
  graphics.lineStyle(2, color, 0.98);
  graphics.fillRoundedRect(x, y, width, height, 6);
  graphics.strokeRoundedRect(x, y, width, height, 6);
}

function resolveWallDoorOrientation(room: ObservatoryRoom, point: { x: number; y: number }) {
  const minX = room.bounds.x;
  const maxX = room.bounds.x + room.bounds.width - 1;
  return point.x === minX || point.x === maxX ? 'vertical' : 'horizontal';
}

function getTextureSourceWidth(scene: Phaser.Scene, textureKey: string) {
  const sourceImage = scene.textures.get(textureKey)?.getSourceImage() as
    | { width?: number }
    | undefined;
  return sourceImage?.width;
}

function renderAgent(
  scene: Phaser.Scene,
  agent: ObservatoryAgent,
  grid: ObservatoryGridConfig,
  assetsById: Map<string, ObservatoryAssetDefinition>,
  onSelect: () => void
): RenderedAgentHandle {
  const center = gridToWorldCenter(agent.position, grid);
  const textureKey = resolveTextureKey(scene, agent.assetId);
  const asset = assetsById.get(agent.assetId);
  const badgeTint = agentStatusTint[agent.status];

  const sprite = scene.add
    .sprite(center.x, center.y, textureKey, resolveAgentInitialFrame(asset))
    .setOrigin(0.5, 1)
    .setDisplaySize(grid.tileSize * 0.92, grid.tileSize * 1.84)
    .setDepth(28);

  const badge = scene.add
    .circle(center.x + 10, center.y - 12, 5, badgeTint, 1)
    .setStrokeStyle(1, 0x0f172a, 0.9)
    .setDepth(32)
    .setVisible(false);

  const label = scene.add
    .text(center.x, center.y + 18, agent.name, {
      color: '#ecfeff',
      fontFamily: 'monospace',
      fontSize: '10px',
    })
    .setOrigin(0.5, 0)
    .setDepth(32);

  const hitZone = scene.add
    .zone(
      center.x - getAgentHitZoneWidth(grid) / 2,
      center.y - getAgentHitZoneHeight(grid) / 2,
      getAgentHitZoneWidth(grid),
      getAgentHitZoneHeight(grid)
    )
    .setOrigin(0)
    .setInteractive()
    .setDepth(45)
    .on('pointerdown', onSelect);

  const handle: RenderedAgentHandle = {
    agent: { ...agent, position: { ...agent.position } },
    asset,
    badge,
    hitZone,
    label,
    sprite,
  };

  applyAgentStatusVisuals(handle, agent.status);
  placeAgentHandleAtCenter(handle, center);
  playAgentAction(handle, actionForStatus(agent.status), 'down');

  return handle;
}

function playAgentAction(
  handle: RenderedAgentHandle,
  action: ObservatoryCharacterActionName,
  direction?: ObservatoryCharacterDirection
) {
  const directionToUse = resolveAvailableActionDirection(handle.asset, action, direction);
  const animationKey = createObservatoryCharacterActionAnimationKey(
    handle.agent.assetId,
    action,
    directionToUse
  );
  const actionDefinition = findCharacterActionDefinition(handle.asset, action, directionToUse);

  if (!actionDefinition) {
    return;
  }

  if (handle.currentAction === action && handle.currentDirection === directionToUse) {
    return;
  }

  if (!handle.sprite.scene.anims.exists(animationKey)) {
    handle.sprite.setFrame(actionDefinition.loopStartFrame ?? actionDefinition.startFrame);
    handle.currentAction = action;
    handle.currentDirection = directionToUse;
    return;
  }

  handle.sprite.play(animationKey);
  handle.currentAction = action;
  handle.currentDirection = directionToUse;
}

function resolveAgentInitialFrame(asset: ObservatoryAssetDefinition | undefined) {
  return findCharacterActionDefinition(asset, 'face', 'down')?.startFrame ?? asset?.frame ?? 0;
}

function findCharacterActionDefinition(
  asset: ObservatoryAssetDefinition | undefined,
  action: ObservatoryCharacterActionName,
  direction: ObservatoryCharacterDirection | undefined
): ObservatoryCharacterActionDefinition | undefined {
  return asset?.characterActions?.find(
    (candidate) => candidate.action === action && candidate.direction === direction
  );
}

function resolveAvailableActionDirection(
  asset: ObservatoryAssetDefinition | undefined,
  action: ObservatoryCharacterActionName,
  direction: ObservatoryCharacterDirection | undefined
) {
  const availableActions =
    asset?.characterActions?.filter((candidate) => candidate.action === action) ?? [];

  if (availableActions.some((candidate) => candidate.direction === direction)) {
    return direction;
  }

  if (availableActions.some((candidate) => candidate.direction === 'down')) {
    return 'down';
  }

  return availableActions[0]?.direction;
}

function actionForStatus(status: ObservatoryAgentStatus): ObservatoryCharacterActionName {
  if (status === 'working') {
    return 'phone';
  }

  if (status === 'blocked') {
    return 'reading';
  }

  if (status === 'error') {
    return 'hurt';
  }

  return 'idle';
}

function applyAgentStatusVisuals(handle: RenderedAgentHandle, status: ObservatoryAgentStatus) {
  const statusLabelColor: Record<ObservatoryAgentStatus, string> = {
    blocked: '#fdba74',
    complete: '#86efac',
    error: '#fca5a5',
    idle: '#cbd5e1',
    working: '#7dd3fc',
  };

  handle.sprite.clearTint().setAlpha(1);
  handle.label.setColor(statusLabelColor[status]);
}

function showAgentSpeechBubble(
  scene: Phaser.Scene,
  handle: RenderedAgentHandle,
  grid: ObservatoryGridConfig,
  message: string,
  speechKey?: string,
  durationMs = 7_500,
  tone: ObservatoryAgentVisualState['speechTone'] = 'chat'
) {
  if (!isSceneWritable(scene)) {
    return;
  }

  if (speechKey && handle.speechKey === speechKey) {
    return;
  }

  const center = gridToWorldCenter(handle.agent.position, grid);
  const speechText = message.length > 80 ? `${message.slice(0, 79)}…` : message;
  const speechStyle = resolveSpeechBubbleStyle(tone);
  handle.speechKey = speechKey;

  if (handle.speechBubble) {
    handle.speechBubble.destroy();
  }

  handle.speechTimer?.remove(false);

  handle.speechBubble = scene.add
    .text(center.x, center.y - 46, speechText, {
      backgroundColor: speechStyle.backgroundColor,
      color: speechStyle.color,
      fixedWidth: 172,
      fontFamily: 'monospace',
      fontSize: '10px',
      padding: { x: 6, y: 5 },
      wordWrap: { width: 160 },
    })
    .setOrigin(0.5, 1)
    .setDepth(55);

  handle.speechTimer = scene.time.delayedCall(durationMs, () => {
    handle.speechBubble?.destroy();
    handle.speechBubble = undefined;
    handle.speechTimer = undefined;
  });
}

function resolveSpeechBubbleStyle(tone: ObservatoryAgentVisualState['speechTone'] = 'chat') {
  const styles: Record<
    NonNullable<ObservatoryAgentVisualState['speechTone']>,
    { backgroundColor: string; color: string }
  > = {
    chat: { backgroundColor: '#f8fafc', color: '#0f172a' },
    computer: { backgroundColor: '#ecfeff', color: '#155e75' },
    pantry: { backgroundColor: '#fff7ed', color: '#7c2d12' },
    planning: { backgroundColor: '#fefce8', color: '#713f12' },
    runtime: { backgroundColor: '#eff6ff', color: '#1e3a8a' },
    storage: { backgroundColor: '#f5f3ff', color: '#4c1d95' },
  };

  return styles[tone ?? 'chat'];
}

function showAgentTaskOutcomeEffect(
  scene: Phaser.Scene,
  handle: RenderedAgentHandle,
  grid: ObservatoryGridConfig,
  outcome: 'complete' | 'error'
) {
  const center = gridToWorldCenter(handle.agent.position, grid);
  const color = outcome === 'complete' ? 0x22c55e : 0xef4444;
  const ring = scene.add
    .circle(center.x, center.y, grid.tileSize * 0.6, color, 0.16)
    .setStrokeStyle(3, color, 0.95)
    .setDepth(54);

  scene.tweens.add({
    alpha: 0,
    duration: 700,
    ease: 'Sine.easeOut',
    onComplete: () => ring.destroy(),
    scale: 1.7,
    targets: ring,
  });
}

function showAgentStatusTransitionEffect(
  scene: Phaser.Scene,
  handle: RenderedAgentHandle,
  grid: ObservatoryGridConfig,
  status: ObservatoryAgentStatus
) {
  if (status === 'idle' || status === 'working') {
    return;
  }

  const center = gridToWorldCenter(handle.agent.position, grid);
  const color = agentStatusTint[status];
  const label = status === 'blocked' ? 'APPROVAL' : status === 'complete' ? 'DONE' : 'ERROR';
  const ring = scene.add
    .circle(center.x, center.y, grid.tileSize * 0.52, color, 0.12)
    .setStrokeStyle(2, color, 0.9)
    .setDepth(54);
  const text = scene.add
    .text(center.x, center.y - 42, label, {
      backgroundColor: '#0f172a',
      color: '#f8fafc',
      fontFamily: 'monospace',
      fontSize: '9px',
      padding: { x: 5, y: 3 },
    })
    .setOrigin(0.5, 1)
    .setDepth(57);

  scene.tweens.add({
    alpha: 0,
    duration: 900,
    ease: 'Sine.easeOut',
    onComplete: () => {
      ring.destroy();
      text.destroy();
    },
    scale: 1.8,
    targets: ring,
  });
  scene.tweens.add({
    alpha: 0,
    duration: 900,
    ease: 'Sine.easeOut',
    y: text.y - 10,
    targets: text,
  });
}

function placeAgentHandleAtCenter(handle: RenderedAgentHandle, center: { x: number; y: number }) {
  const footY = center.y + handle.sprite.displayHeight * 0.38;
  handle.sprite.setPosition(center.x, footY);
  handle.badge.setPosition(center.x + 10, footY - handle.sprite.displayHeight + 12);
  handle.label.setPosition(center.x, footY + 4);
  handle.hitZone.setPosition(
    center.x - handle.hitZone.width / 2,
    center.y - handle.hitZone.height / 2
  );
  handle.progressBackground?.setPosition(center.x, footY + 21);
  handle.progressFill?.setPosition(center.x - 18, footY + 21);
  handle.progressLabel?.setPosition(center.x, footY + 26);
  handle.speechBubble?.setPosition(center.x, footY - handle.sprite.displayHeight - 10);
  handle.attentionSprite?.setPosition(center.x + 18, footY - handle.sprite.displayHeight + 2);
}

function getAgentHitZoneWidth(grid: ObservatoryGridConfig) {
  return grid.tileSize * 1.35;
}

function getAgentHitZoneHeight(grid: ObservatoryGridConfig) {
  return grid.tileSize * 2.35;
}

function getAgentHitZoneBounds(handle: RenderedAgentHandle) {
  return {
    height: handle.hitZone.height,
    width: handle.hitZone.width,
    x: handle.hitZone.x,
    y: handle.hitZone.y,
  };
}

function getAgentHandleCenter(handle: RenderedAgentHandle) {
  return {
    x: handle.sprite.x,
    y: handle.sprite.y - handle.sprite.displayHeight * 0.38,
  };
}

function updateAgentAttention(
  scene: Phaser.Scene,
  handle: RenderedAgentHandle,
  grid: ObservatoryGridConfig,
  attention: ObservatoryAgentVisualState['attention']
) {
  if (!attention) {
    handle.attentionSprite?.setVisible(false);
    handle.attention = undefined;
    return;
  }

  const center = gridToWorldCenter(handle.agent.position, grid);

  if (!handle.attentionSprite) {
    handle.attentionSprite = scene.add
      .text(center.x + 18, center.y - 34, '', {
        align: 'center',
        backgroundColor: '#ffffff',
        color: '#0f172a',
        fontFamily: 'monospace',
        fontSize: '10px',
        fontStyle: '700',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 0.5)
      .setDepth(56);
  }

  handle.attention = attention;
  handle.attentionSprite.clearTint().setVisible(true);
  handle.attentionSprite.setText(attentionMarkerText[attention]);

  placeAgentHandleAtCenter(handle, center);
}

function updateAgentTaskProgress(
  scene: Phaser.Scene,
  handle: RenderedAgentHandle,
  grid: ObservatoryGridConfig,
  progress: number | undefined,
  taskTitle: string | undefined,
  status: ObservatoryAgentStatus | undefined
) {
  if (progress === undefined && !taskTitle) {
    return;
  }

  const center = gridToWorldCenter(handle.agent.position, grid);
  const safeProgress = Math.max(0, Math.min(1, progress ?? 0));
  const fillColor = status === 'complete' ? 0x22c55e : status === 'error' ? 0xef4444 : 0x38bdf8;

  if (!handle.progressBackground) {
    handle.progressBackground = scene.add
      .rectangle(center.x, center.y + 35, 40, 5, 0x0f172a, 0.9)
      .setStrokeStyle(1, 0xe2e8f0, 0.55)
      .setDepth(33);
  }

  if (!handle.progressFill) {
    handle.progressFill = scene.add
      .rectangle(center.x - 18, center.y + 35, 1, 3, fillColor, 1)
      .setOrigin(0, 0.5)
      .setDepth(34);
  }

  if (!handle.progressLabel) {
    handle.progressLabel = scene.add
      .text(center.x, center.y + 40, '', {
        color: '#e0f2fe',
        fontFamily: 'monospace',
        fontSize: '9px',
      })
      .setOrigin(0.5, 0)
      .setDepth(34);
  }

  handle.progressFill.setFillStyle(fillColor, 1).setDisplaySize(Math.max(1, 36 * safeProgress), 3);
  handle.progressLabel.setText(`${taskTitle ?? 'Task'} ${Math.round(safeProgress * 100)}%`);
}

function objectBoundsToWorldRect(
  object: ObservatoryObject,
  grid: ObservatoryGridConfig,
  asset?: ObservatoryAssetDefinition
) {
  const baseBounds = objectIntrinsicBoundsToWorldRect(object, grid, asset);

  return {
    height: object.render?.sizePx?.height ?? baseBounds.height,
    width: object.render?.sizePx?.width ?? baseBounds.width,
    x: baseBounds.x + (object.render?.offsetPx?.x ?? 0),
    y: baseBounds.y + (object.render?.offsetPx?.y ?? 0),
  };
}

function objectIntrinsicBoundsToWorldRect(
  object: ObservatoryObject,
  grid: ObservatoryGridConfig,
  asset?: ObservatoryAssetDefinition
) {
  const intrinsicWidth = asset?.width ?? asset?.source.frameWidth ?? 48;
  const intrinsicHeight = asset?.height ?? asset?.source.frameHeight ?? 48;

  return gridRectToWorldRect(
    {
      x: object.position.x,
      y: object.position.y,
      width: object.size?.width ?? Math.max(1, Math.ceil(intrinsicWidth / grid.tileSize)),
      height: object.size?.height ?? Math.max(1, Math.ceil(intrinsicHeight / grid.tileSize)),
    },
    grid
  );
}

function objectCollisionBoundsToWorldRect(
  object: ObservatoryObject,
  grid: ObservatoryGridConfig,
  asset?: ObservatoryAssetDefinition
) {
  const sourceCrop = object.render?.sourceCrop ?? asset?.sourceCrop;

  if (sourceCrop) {
    return sourceCropToWorldRect(object, grid, sourceCrop, asset);
  }

  const collision = asset?.collision;
  const width = collision?.width ?? object.size?.width ?? 1;
  const height = collision?.height ?? object.size?.height ?? 1;
  const x = object.position.x + (collision?.offsetX ?? 0);
  const y = object.position.y + (collision?.offsetY ?? 0);
  const renderOffsetX = object.render?.offsetPx?.x ?? 0;
  const renderOffsetY = object.render?.offsetPx?.y ?? 0;
  const bounds = gridRectToWorldRect({ height, width, x, y }, grid);

  return {
    ...bounds,
    x: bounds.x + renderOffsetX,
    y: bounds.y + renderOffsetY,
  };
}

function sourceCropToWorldRect(
  object: ObservatoryObject,
  grid: ObservatoryGridConfig,
  sourceCrop: { height: number; width: number; x: number; y: number },
  asset?: ObservatoryAssetDefinition
) {
  const sourceWidth = Math.max(
    1,
    asset?.width ?? asset?.source.frameWidth ?? sourceCrop.x + sourceCrop.width
  );
  const sourceHeight = Math.max(
    1,
    asset?.height ?? asset?.source.frameHeight ?? sourceCrop.y + sourceCrop.height
  );
  const intrinsicBounds = objectIntrinsicBoundsToWorldRect(object, grid, asset);
  const renderWidth = object.render?.sizePx?.width ?? intrinsicBounds.width;
  const renderHeight = object.render?.sizePx?.height ?? intrinsicBounds.height;
  const scaleX = renderWidth / sourceWidth;
  const scaleY = renderHeight / sourceHeight;

  return {
    height: sourceCrop.height * scaleY,
    width: sourceCrop.width * scaleX,
    x: intrinsicBounds.x + (object.render?.offsetPx?.x ?? 0) + sourceCrop.x * scaleX,
    y: intrinsicBounds.y + (object.render?.offsetPx?.y ?? 0) + sourceCrop.y * scaleY,
  };
}

function drawObjectCollisionTileGrid(
  graphics: Phaser.GameObjects.Graphics,
  bounds: { height: number; width: number; x: number; y: number },
  grid: ObservatoryGridConfig
) {
  if (bounds.width <= grid.tileSize && bounds.height <= grid.tileSize) {
    return;
  }

  graphics.lineStyle(1, 0xfffbeb, 0.45);

  for (let x = bounds.x + grid.tileSize; x < bounds.x + bounds.width; x += grid.tileSize) {
    graphics.lineBetween(x, bounds.y + 2, x, bounds.y + bounds.height - 2);
  }

  for (let y = bounds.y + grid.tileSize; y < bounds.y + bounds.height; y += grid.tileSize) {
    graphics.lineBetween(bounds.x + 2, y, bounds.x + bounds.width - 2, y);
  }
}

function renderDebugGrid(scene: Phaser.Scene, map: ObservatoryMap, grid: ObservatoryGridConfig) {
  const graphics = scene.add.graphics().setDepth(15);
  const width = map.size.width * grid.tileSize;
  const height = map.size.height * grid.tileSize;

  graphics.lineStyle(1, 0x94a3b8, 0.16);

  for (let x = 0; x <= width; x += grid.tileSize) {
    graphics.lineBetween(x, 0, x, height);
  }

  for (let y = 0; y <= height; y += grid.tileSize) {
    graphics.lineBetween(0, y, width, y);
  }
}

function resolveTextureKey(scene: Phaser.Scene, assetId?: string) {
  if (assetId && scene.textures.exists(assetId)) {
    return assetId;
  }

  return OBSERVATORY_FALLBACK_TEXTURE_KEY;
}

function resolveTextureFrame(
  assetsById: Map<string, ObservatoryAssetDefinition>,
  assetId?: string
) {
  return assetId ? assetsById.get(assetId)?.frame : undefined;
}

function isSceneWritable(scene: Phaser.Scene) {
  return Boolean(scene.sys?.displayList && scene.sys?.updateList);
}

function canMoveAgentToGrid(
  map: ObservatoryMap,
  point: { x: number; y: number },
  assetsById: Map<string, ObservatoryAssetDefinition>
) {
  return isObservatoryGridWalkable(map, point, assetsById);
}

function directionFromGridDelta(
  from: { x: number; y: number },
  to: { x: number; y: number }
): ObservatoryCharacterDirection {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0 ? 'right' : 'left';
  }

  return deltaY >= 0 ? 'down' : 'up';
}
