import type Phaser from 'phaser';

import type { ObservatoryCanvasGridClick } from '@/modules/observatory/engine/selection';
import {
  pointInGridRect,
  worldToGrid,
  type ObservatoryGridConfig,
} from '@/modules/observatory/engine/world/grid';
import type { ObservatoryMap } from '@/modules/observatory/engine/world/layoutTypes';
import type { ObservatoryGridRect } from '@/modules/observatory/engine/world/grid';
import type { ObservatoryRenderedOfficeMap } from '@/modules/observatory/engine/rendering/officeMapRenderer';

export interface ObservatorySceneInteractionOptions {
  allowPan?: boolean;
  allowZoom?: boolean;
  grid: ObservatoryGridConfig;
  map: ObservatoryMap;
  onCameraStateChange?: (state: { scrollX: number; scrollY: number; zoom: number }) => void;
  onGridClick?: (point: ObservatoryCanvasGridClick) => void;
  onRoomResizeCommit?: (roomId: string, bounds: ObservatoryGridRect) => void;
  onSelectionDrag?: (payload: {
    from: ObservatoryCanvasGridClick;
    id: string;
    kind: 'object' | 'room';
    to: ObservatoryCanvasGridClick;
  }) => void;
  renderedMap: ObservatoryRenderedOfficeMap;
  wallEditActive?: boolean;
  showDebugCoordinates?: boolean;
}

const doubleClickMs = 320;
const wheelZoomStep = 1.045;
export const OBSERVATORY_CAMERA_USER_ADJUSTED_EVENT = 'observatory:camera-user-adjusted';

export function setupObservatorySceneInteractions(
  scene: Phaser.Scene,
  {
    allowPan = true,
    allowZoom = true,
    grid,
    map,
    onCameraStateChange,
    onGridClick,
    onRoomResizeCommit,
    onSelectionDrag,
    renderedMap,
    wallEditActive = false,
    showDebugCoordinates = true,
  }: ObservatorySceneInteractionOptions
) {
  const camera = scene.cameras.main;
  const worldWidth = map.size.width * grid.tileSize;
  const worldHeight = map.size.height * grid.tileSize + 96;
  const fittedZoom = camera.zoom;
  const minCameraZoom = Math.max(0.25, Math.min(fittedZoom, 0.6));
  const maxCameraZoom = Math.max(2.2, fittedZoom * 4);
  let lastClickAt = 0;
  let didDrag = false;
  let dragStartGridPoint: ObservatoryCanvasGridClick | null = null;
  let dragTarget: { id: string; kind: 'object' | 'room' } | null = null;
  let resizeZones: Phaser.GameObjects.Zone[] = [];
  let roomResizeDrag: {
    mode: 'east' | 'south' | 'southeast';
    roomId: string;
    startBounds: ObservatoryGridRect;
  } | null = null;
  let roomResizePreview: ObservatoryGridRect | null = null;
  const resizeOverlay = scene.add.graphics().setDepth(44);
  const resizePreviewOverlay = scene.add.graphics().setDepth(45);
  const handleSize = Math.max(12, Math.floor(grid.tileSize * 0.35));

  const debugText = showDebugCoordinates
    ? scene.add
        .text(16, worldHeight - 28, 'grid: -, - | zoom: 1.00', {
          color: '#475569',
          fontFamily: 'monospace',
          fontSize: '12px',
        })
        .setDepth(70)
    : null;

  scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
    pointer.updateWorldPoint(camera);
    const gridPoint = worldToGrid({ x: pointer.worldX, y: pointer.worldY }, grid);
    renderedMap.setWallEditHover(gridPoint);

    if (roomResizeDrag) {
      roomResizePreview = computeRoomResizeBounds(
        roomResizeDrag.startBounds,
        roomResizeDrag.mode,
        gridPoint,
        map
      );
      drawRoomResizePreview(roomResizePreview);
      return;
    }

    debugText?.setText(`grid: ${gridPoint.x}, ${gridPoint.y} | zoom: ${camera.zoom.toFixed(2)}`);

    if (!pointer.primaryDown) {
      return;
    }

    const deltaX = pointer.position.x - pointer.prevPosition.x;
    const deltaY = pointer.position.y - pointer.prevPosition.y;

    if (Math.abs(deltaX) + Math.abs(deltaY) < 2) {
      return;
    }

    didDrag = true;

    if (!dragTarget && onSelectionDrag) {
      dragTarget = resolveDragTarget(gridPoint);
      if (dragTarget && !dragStartGridPoint) {
        dragStartGridPoint = gridPoint;
      }
    }

    if (dragTarget && onSelectionDrag) {
      const movedGridCell = dragStartGridPoint
        ? dragStartGridPoint.x !== gridPoint.x || dragStartGridPoint.y !== gridPoint.y
        : false;

      if (movedGridCell && dragStartGridPoint) {
        onSelectionDrag({
          from: dragStartGridPoint,
          id: dragTarget.id,
          kind: dragTarget.kind,
          to: gridPoint,
        });
        dragStartGridPoint = gridPoint;
        refreshRoomResizeHandles();
      }

      return;
    }

    if (!allowPan) {
      return;
    }

    scene.events.emit(OBSERVATORY_CAMERA_USER_ADJUSTED_EVENT);
    camera.scrollX -= deltaX / camera.zoom;
    camera.scrollY -= deltaY / camera.zoom;
    clampCamera(camera, worldWidth, worldHeight);
    emitCameraState();
  });

  scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    if (roomResizeDrag) {
      return;
    }

    pointer.updateWorldPoint(camera);
    const gridPoint = worldToGrid({ x: pointer.worldX, y: pointer.worldY }, grid);

    if (wallEditActive) {
      didDrag = false;
      dragStartGridPoint = null;
      dragTarget = null;
      return;
    }

    if (!onSelectionDrag) {
      return;
    }

    dragStartGridPoint = gridPoint;
    dragTarget = resolveDragTarget(gridPoint);
  });

  scene.input.on('wheel', (pointer: Phaser.Input.Pointer) => {
    if (!allowZoom) {
      return;
    }

    pointer.event?.preventDefault();
    pointer.event?.stopPropagation();
    scene.events.emit(OBSERVATORY_CAMERA_USER_ADJUSTED_EVENT);
    pointer.updateWorldPoint(camera);
    const beforeZoomWorldX = pointer.worldX;
    const beforeZoomWorldY = pointer.worldY;
    const nextZoom = clamp(
      camera.zoom * (pointer.deltaY > 0 ? 1 / wheelZoomStep : wheelZoomStep),
      minCameraZoom,
      maxCameraZoom
    );

    camera.setZoom(nextZoom);
    pointer.updateWorldPoint(camera);
    camera.scrollX += beforeZoomWorldX - pointer.worldX;
    camera.scrollY += beforeZoomWorldY - pointer.worldY;
    clampCamera(camera, worldWidth, worldHeight);
    debugText?.setText(`grid: -, - | zoom: ${camera.zoom.toFixed(2)}`);
    emitCameraState();
  });

  scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
    const now = pointer.upTime;

    if (roomResizeDrag) {
      const nextBounds = roomResizePreview ?? roomResizeDrag.startBounds;
      const changed = !areBoundsEqual(nextBounds, roomResizeDrag.startBounds);
      const targetRoomId = roomResizeDrag.roomId;
      roomResizeDrag = null;
      roomResizePreview = null;
      resizePreviewOverlay.clear();
      refreshRoomResizeHandles();

      if (changed) {
        onRoomResizeCommit?.(targetRoomId, nextBounds);
      }

      lastClickAt = now;
      dragTarget = null;
      dragStartGridPoint = null;
      return;
    }

    pointer.updateWorldPoint(camera);
    const gridPoint = worldToGrid({ x: pointer.worldX, y: pointer.worldY }, grid);

    if (wallEditActive) {
      lastClickAt = now;
      dragTarget = null;
      dragStartGridPoint = null;
      didDrag = false;
      refreshRoomResizeHandles();
      return;
    }

    const movedGridCell = dragStartGridPoint
      ? dragStartGridPoint.x !== gridPoint.x || dragStartGridPoint.y !== gridPoint.y
      : false;

    if ((didDrag || movedGridCell) && dragTarget && dragStartGridPoint) {
      onSelectionDrag?.({
        from: dragStartGridPoint,
        id: dragTarget.id,
        kind: dragTarget.kind,
        to: gridPoint,
      });
      didDrag = false;
      dragTarget = null;
      dragStartGridPoint = null;
      lastClickAt = now;
      refreshRoomResizeHandles();
      return;
    }

    if (didDrag) {
      didDrag = false;
      dragTarget = null;
      dragStartGridPoint = null;
      lastClickAt = now;
      refreshRoomResizeHandles();
      return;
    }

    if (renderedMap.selectAtWorldPoint({ x: pointer.worldX, y: pointer.worldY })) {
      dragTarget = null;
      dragStartGridPoint = null;
      lastClickAt = now;
      refreshRoomResizeHandles();
      return;
    }

    if (now - lastClickAt <= doubleClickMs && renderedMap.getSelectedAgentId()) {
      renderedMap.moveSelectedAgentToGrid(gridPoint);
      lastClickAt = 0;
      dragTarget = null;
      dragStartGridPoint = null;
      refreshRoomResizeHandles();
      return;
    }

    onGridClick?.(gridPoint);
    lastClickAt = now;
    dragTarget = null;
    dragStartGridPoint = null;
    refreshRoomResizeHandles();
  });

  scene.input.on('gameout', () => {
    renderedMap.setWallEditHover(null);
    dragTarget = null;
    dragStartGridPoint = null;
    didDrag = false;
  });

  refreshRoomResizeHandles();

  function refreshRoomResizeHandles() {
    resizeZones.forEach((zone) => zone.destroy());
    resizeZones = [];
    resizeOverlay.clear();

    if (!onRoomResizeCommit) {
      return;
    }

    const roomId = renderedMap.getSelectedRoomId();
    if (!roomId) {
      return;
    }

    const room = map.rooms.find((candidate) => candidate.id === roomId);
    if (!room) {
      return;
    }

    const right = (room.bounds.x + room.bounds.width) * grid.tileSize;
    const bottom = (room.bounds.y + room.bounds.height) * grid.tileSize;
    const centerY = room.bounds.y * grid.tileSize + (room.bounds.height * grid.tileSize) / 2;
    const centerX = room.bounds.x * grid.tileSize + (room.bounds.width * grid.tileSize) / 2;
    const handleSpecs = [
      { mode: 'east' as const, x: right, y: centerY },
      { mode: 'south' as const, x: centerX, y: bottom },
      { mode: 'southeast' as const, x: right, y: bottom },
    ];

    resizeOverlay.fillStyle(0x0f172a, 0.92);
    resizeOverlay.lineStyle(2, 0xe0f2fe, 0.9);

    for (const handle of handleSpecs) {
      resizeOverlay.fillRoundedRect(
        handle.x - handleSize / 2,
        handle.y - handleSize / 2,
        handleSize,
        handleSize,
        6
      );
      resizeOverlay.strokeRoundedRect(
        handle.x - handleSize / 2,
        handle.y - handleSize / 2,
        handleSize,
        handleSize,
        6
      );
      const zone = scene.add
        .zone(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize)
        .setOrigin(0)
        .setInteractive()
        .setDepth(46)
        .on('pointerdown', () => {
          roomResizeDrag = {
            mode: handle.mode,
            roomId,
            startBounds: { ...room.bounds },
          };
          roomResizePreview = { ...room.bounds };
          drawRoomResizePreview(roomResizePreview);
        });
      resizeZones.push(zone);
    }
  }

  function drawRoomResizePreview(bounds: ObservatoryGridRect | null) {
    resizePreviewOverlay.clear();

    if (!bounds) {
      return;
    }

    resizePreviewOverlay.fillStyle(0x38bdf8, 0.14);
    resizePreviewOverlay.lineStyle(3, 0x38bdf8, 0.95);
    resizePreviewOverlay.fillRect(
      bounds.x * grid.tileSize,
      bounds.y * grid.tileSize,
      bounds.width * grid.tileSize,
      bounds.height * grid.tileSize
    );
    resizePreviewOverlay.strokeRect(
      bounds.x * grid.tileSize + 1,
      bounds.y * grid.tileSize + 1,
      bounds.width * grid.tileSize - 2,
      bounds.height * grid.tileSize - 2
    );
  }

  function resolveDragTarget(gridPoint: ObservatoryCanvasGridClick) {
    const selectedRoomId = renderedMap.getSelectedRoomId();
    if (!selectedRoomId) {
      return null;
    }

    const selectedRoom = map.rooms.find((candidate) => candidate.id === selectedRoomId);
    if (!selectedRoom) {
      return null;
    }

    return pointInGridRect(gridPoint, selectedRoom.bounds)
      ? { id: selectedRoomId, kind: 'room' as const }
      : null;
  }

  function emitCameraState() {
    onCameraStateChange?.({
      scrollX: camera.scrollX,
      scrollY: camera.scrollY,
      zoom: camera.zoom,
    });
  }
}

function computeRoomResizeBounds(
  bounds: ObservatoryGridRect,
  mode: 'east' | 'south' | 'southeast',
  gridPoint: { x: number; y: number },
  map: ObservatoryMap
): ObservatoryGridRect {
  const nextBounds = { ...bounds };

  if (mode === 'east' || mode === 'southeast') {
    const maxRight = map.size.width;
    const nextWidth = Math.max(1, Math.min(maxRight - bounds.x, gridPoint.x - bounds.x + 1));
    nextBounds.width = nextWidth;
  }

  if (mode === 'south' || mode === 'southeast') {
    const maxBottom = map.size.height;
    const nextHeight = Math.max(1, Math.min(maxBottom - bounds.y, gridPoint.y - bounds.y + 1));
    nextBounds.height = nextHeight;
  }

  return nextBounds;
}

function areBoundsEqual(left: ObservatoryGridRect, right: ObservatoryGridRect) {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
}

function clampCamera(
  camera: Phaser.Cameras.Scene2D.Camera,
  worldWidth: number,
  worldHeight: number
) {
  const bounds =
    typeof camera.getBounds === 'function'
      ? camera.getBounds()
      : { x: 0, y: 0, width: worldWidth, height: worldHeight };
  const visibleWidth = camera.width / camera.zoom;
  const visibleHeight = camera.height / camera.zoom;
  const minScrollX = bounds.x;
  const minScrollY = bounds.y;
  const maxScrollX = Math.max(minScrollX, bounds.x + bounds.width - visibleWidth);
  const maxScrollY = Math.max(minScrollY, bounds.y + bounds.height - visibleHeight);

  camera.scrollX = clamp(camera.scrollX, minScrollX, maxScrollX);
  camera.scrollY = clamp(camera.scrollY, minScrollY, maxScrollY);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
