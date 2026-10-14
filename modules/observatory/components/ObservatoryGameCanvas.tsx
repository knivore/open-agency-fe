'use client';

import { Input } from '@/components/library/shadcn/input';
import { NativeSelect } from '@/components/library/shadcn/select';
import { createPortal } from 'react-dom';
import { type ReactNode, type CSSProperties, useEffect, useRef, useState } from 'react';

import type {
  ObservatoryCanvasGridClick,
  ObservatoryCanvasSelection,
} from '@/modules/observatory/engine/selection';
import type { ObservatoryGameHandle } from '@/modules/observatory/engine/OfficeGame';
import { createObservatoryGame } from '@/modules/observatory/engine/OfficeGame';
import type { ObservatoryCameraState } from '@/modules/observatory/engine/scenes/OfficeScene';
import type { ObservatoryOfficeMapViewFilter } from '@/modules/observatory/engine/rendering/officeMapRenderer';
import type { ObservatoryGridRect } from '@/modules/observatory/engine/world/grid';
import { getObservatoryLayoutFootprint } from '@/modules/observatory/engine/world/layoutFootprint';
import type { ObservatoryLayoutDocument } from '@/modules/observatory/engine/world/layoutTypes';

import styles from './ObservatoryGameCanvas.module.css';
import { getObservatoryFullModuleAssetRegistry } from '../engine/assets/moduleFullAssetRegistry';
import {
  observatoryAssetSourceSize,
  observatoryObjectVisibleBounds,
} from '../engine/world/objectGeometry';
import type { ObservatoryObject } from '../engine/world/layoutTypes';
import type { OfficeWalkthroughProgress } from '../engine/rendering/officeWalkthrough';

export interface ObservatoryGameCanvasProps {
  enableMovementTest?: boolean;
  walkabilityCells?: Array<{ x: number; y: number }>;
  inspectorTarget?: HTMLElement | null;
  placementPreview?: { objects: ObservatoryObject[]; valid: boolean } | null;
  selectedSetupSize?: number;
  editWholeSetup?: boolean;
  onEditWholeSetupChange?: (value: boolean) => void;
  activeWallEditRoomId?: string | null;
  activeWallEditRoomLabel?: string | null;
  activeWallEditTool?: 'door' | 'floor' | 'opening' | 'paint' | 'tile';
  activeWallEditWallAssetId?: string | null;
  activeWallEditDoorCount?: number;
  activeWallEditOpeningCount?: number;
  placementActive?: boolean;
  allowPan?: boolean;
  allowZoom?: boolean;
  enableAmbientAutoplay?: boolean;
  initialZoom?: number | null;
  layout?: ObservatoryLayoutDocument;
  onActiveWallEditClose?: () => void;
  onActiveWallEditToolChange?: (tool: 'door' | 'floor' | 'opening' | 'paint' | 'tile') => void;
  onGridHover?: (point: ObservatoryCanvasGridClick) => void;
  onGridClick?: (point: ObservatoryCanvasGridClick) => void;
  onSelectedObjectClose?: () => void;
  onSelectedObjectDuplicate?: () => void;
  onSelectedObjectDelete?: () => void;
  onSelectedObjectMove?: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onSelectedObjectCollisionSizeApply?: (size: { width: number; height: number }) => void;
  onSelectedObjectCollisionSizeReset?: () => void;
  onSelectedObjectOffsetApply?: (offset: { x: number; y: number }) => void;
  onSelectedObjectOffsetReset?: () => void;
  onSelectedObjectRenderSizeApply?: (size: { width: number; height: number }) => void;
  onSelectedObjectRenderSizeReset?: () => void;
  onSelectedObjectScaleApply?: (scale: number) => void;
  onSelectedObjectToggleBlocksMovement?: () => void;
  onRoomResizeCommit?: (roomId: string, bounds: ObservatoryGridRect) => void;
  onSelectedRoomBoundsApply?: (bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
  onSelectedRoomClose?: () => void;
  onSelectedRoomDelete?: () => void;
  onSelectedRoomFloorApply?: () => void;
  onSelectedRoomFloorSelect?: (assetId: string) => void;
  onSelectedRoomWallApply?: () => void;
  onSelectedRoomWallBrushSelect?: (assetId: string) => void;
  onSelectedRoomWallEditToggle?: () => void;
  onSelectionDrag?: (payload: {
    from: ObservatoryCanvasGridClick;
    id: string;
    kind: 'object' | 'room';
    to: ObservatoryCanvasGridClick;
  }) => void;
  onSelectionChange?: (selection: ObservatoryCanvasSelection) => void;
  presentation?: 'builder' | 'viewer' | 'viewerCompact' | 'viewerFull';
  selectedAgentId?: string | null;
  selectedObjectId?: string | null;
  selectedObjectBaseHeightPx?: number | null;
  selectedObjectBaseWidthPx?: number | null;
  selectedObjectBlocksMovement?: boolean;
  selectedObjectCollisionHeight?: number | null;
  selectedObjectCollisionWidth?: number | null;
  selectedObjectLabel?: string | null;
  selectedObjectOffsetX?: number | null;
  selectedObjectOffsetY?: number | null;
  selectedObjectPositionLabel?: string | null;
  selectedObjectRenderHeightPx?: number | null;
  selectedObjectRenderWidthPx?: number | null;
  selectedRoomDoorCount?: number;
  selectedRoomFloorLabel?: string | null;
  selectedRoomFloorOptions?: Array<{ label: string; value: string }>;
  selectedRoomFloorValue?: string | null;
  selectedRoomId?: string | null;
  selectedRoomLabel?: string | null;
  selectedRoomOpeningCount?: number;
  selectedRoomPositionLabel?: string | null;
  selectedRoomRows?: number | null;
  selectedRoomSizeLabel?: string | null;
  selectedRoomWallLabel?: string | null;
  selectedRoomWallBrushOptions?: Array<{ label: string; value: string }>;
  selectedRoomWallBrushValue?: string | null;
  selectedRoomCols?: number | null;
  selectedRoomX?: number | null;
  selectedRoomY?: number | null;
  showWallEditOverlay?: boolean;
  showDebugCoordinates?: boolean;
  viewFilter?: ObservatoryOfficeMapViewFilter;
}

function createGameUpdateKey(options: {
  activeWallEditRoomId?: string | null;
  activeWallEditTool?: string | null;
  activeWallEditWallAssetId?: string | null;
  placementActive?: boolean;
  allowPan?: boolean;
  allowZoom?: boolean;
  enableAmbientAutoplay?: boolean;
  initialZoom?: number | null;
  layout?: ObservatoryLayoutDocument;
  selectedAgentId?: string | null;
  selectedObjectId?: string | null;
  showDebugCoordinates?: boolean;
  showWallEditOverlay?: boolean;
  viewFilter?: ObservatoryOfficeMapViewFilter;
}) {
  return JSON.stringify({
    activeWallEditRoomId: options.activeWallEditRoomId ?? null,
    activeWallEditTool: options.activeWallEditTool ?? null,
    activeWallEditWallAssetId: options.activeWallEditWallAssetId ?? null,
    placementActive: options.placementActive ?? false,
    allowPan: options.allowPan ?? true,
    allowZoom: options.allowZoom ?? true,
    enableAmbientAutoplay: options.enableAmbientAutoplay ?? false,
    initialZoom: options.initialZoom ?? null,
    layout: options.layout ? createLayoutRenderKey(options.layout) : null,
    showDebugCoordinates: options.showDebugCoordinates ?? true,
    showWallEditOverlay: options.showWallEditOverlay ?? false,
    viewFilter: options.viewFilter ?? null,
  });
}

function createRuntimeRenderKey(
  runtime:
    | NonNullable<ObservatoryLayoutDocument['world']['maps'][number]['agents'][number]['runtime']>
    | undefined
) {
  if (!runtime) {
    return null;
  }

  return {
    behavior: runtime.behavior ?? null,
    runId: runtime.runId ?? null,
    targetObjectId: runtime.targetObjectId ?? null,
    workflowId: runtime.workflowId ?? null,
  };
}

function createLayoutRenderKey(layout: ObservatoryLayoutDocument) {
  return {
    schemaVersion: layout.schemaVersion,
    world: {
      grid: layout.world.grid,
      id: layout.world.id,
      maps: layout.world.maps.map((map) => ({
        agents: map.agents.map((agent) => ({
          assetId: agent.assetId,
          id: agent.id,
          name: agent.name,
          position: agent.position,
          roomId: agent.roomId ?? null,
          runtime: createRuntimeRenderKey(agent.runtime),
          status: agent.status,
        })),
        defaultFloorAssetId: map.defaultFloorAssetId,
        id: map.id,
        name: map.name,
        objects: map.objects.map((object) => ({
          assetId: object.assetId,
          blocksMovement: object.blocksMovement ?? null,
          id: object.id,
          position: object.position,
          render: object.render ?? null,
          roomId: object.roomId ?? null,
          runtime: createRuntimeRenderKey(object.runtime),
          size: object.size ?? null,
        })),
        rooms: map.rooms.map((room) => ({
          bounds: room.bounds,
          floorAssetId: room.floorAssetId ?? null,
          floorAssetOverrides: room.floorAssetOverrides ?? null,
          id: room.id,
          kind: room.kind,
          name: room.name,
          runtime: createRuntimeRenderKey(room.runtime),
          wallAssetId: room.wallAssetId ?? null,
          wallAssetOverrides: room.wallAssetOverrides ?? null,
          wallDoors: room.wallDoors ?? null,
          wallEdgeOpenings: room.wallEdgeOpenings ?? null,
          wallHeight: room.wallHeight ?? null,
          wallOpenings: room.wallOpenings ?? null,
          wallTileOpenings: room.wallTileOpenings ?? null,
        })),
        size: map.size,
      })),
      name: layout.world.name,
    },
  };
}

type ObjectControlsDraft = {
  collisionHeight: string;
  collisionWidth: string;
  offsetX: string;
  offsetY: string;
  renderHeight: string;
  renderWidth: string;
  scale: string;
  sourceKey: string;
};

type RoomControlsDraft = {
  cols: string;
  rows: string;
  sourceKey: string;
  x: string;
  y: string;
};

function createObjectControlsDraft(options: {
  baseHeightPx?: number | null;
  baseWidthPx?: number | null;
  collisionHeight?: number | null;
  collisionWidth?: number | null;
  offsetX?: number | null;
  offsetY?: number | null;
  renderHeightPx?: number | null;
  renderWidthPx?: number | null;
  sourceKey: string;
}): ObjectControlsDraft {
  return {
    collisionHeight: String(Math.max(1, Math.round(options.collisionHeight ?? 1))),
    collisionWidth: String(Math.max(1, Math.round(options.collisionWidth ?? 1))),
    offsetX: String(options.offsetX ?? 0),
    offsetY: String(options.offsetY ?? 0),
    renderHeight: options.renderHeightPx ? String(Math.round(options.renderHeightPx)) : '',
    renderWidth: options.renderWidthPx ? String(Math.round(options.renderWidthPx)) : '',
    scale: (options.baseWidthPx &&
    options.baseHeightPx &&
    options.renderWidthPx &&
    options.renderHeightPx
      ? (options.renderWidthPx / options.baseWidthPx +
          options.renderHeightPx / options.baseHeightPx) /
        2
      : 1
    ).toFixed(2),
    sourceKey: options.sourceKey,
  };
}

function createRoomControlsDraft(options: {
  cols?: number | null;
  rows?: number | null;
  sourceKey: string;
  x?: number | null;
  y?: number | null;
}): RoomControlsDraft {
  return {
    cols: options.cols !== null && options.cols !== undefined ? String(options.cols) : '',
    rows: options.rows !== null && options.rows !== undefined ? String(options.rows) : '',
    sourceKey: options.sourceKey,
    x: options.x !== null && options.x !== undefined ? String(options.x) : '',
    y: options.y !== null && options.y !== undefined ? String(options.y) : '',
  };
}

export default function ObservatoryGameCanvas({
  enableMovementTest = false,
  walkabilityCells,
  inspectorTarget = null,
  placementPreview = null,
  selectedSetupSize = 1,
  editWholeSetup = true,
  onEditWholeSetupChange,
  activeWallEditRoomId = null,
  activeWallEditTool = 'opening',
  activeWallEditWallAssetId = null,
  activeWallEditDoorCount = 0,
  activeWallEditOpeningCount = 0,
  placementActive = false,
  allowPan = true,
  allowZoom = true,
  enableAmbientAutoplay = false,
  initialZoom = null,
  layout,
  onActiveWallEditClose,
  onActiveWallEditToolChange,
  onGridClick,
  onGridHover,
  onSelectedObjectClose,
  onSelectedObjectDuplicate,
  onSelectedObjectDelete,
  onSelectedObjectMove,
  onSelectedObjectCollisionSizeApply,
  onSelectedObjectCollisionSizeReset,
  onSelectedObjectOffsetApply,
  onSelectedObjectOffsetReset,
  onSelectedObjectRenderSizeApply,
  onSelectedObjectRenderSizeReset,
  onSelectedObjectScaleApply,
  onSelectedObjectToggleBlocksMovement,
  onRoomResizeCommit,
  onSelectedRoomBoundsApply,
  onSelectedRoomClose,
  onSelectedRoomDelete,
  onSelectedRoomFloorApply,
  onSelectedRoomFloorSelect,
  onSelectedRoomWallApply,
  onSelectedRoomWallBrushSelect,
  onSelectedRoomWallEditToggle,
  onSelectionDrag,
  onSelectionChange,
  presentation = 'builder',
  selectedAgentId = null,
  selectedObjectId = null,
  selectedObjectBaseHeightPx = null,
  selectedObjectBaseWidthPx = null,
  selectedObjectBlocksMovement = true,
  selectedObjectCollisionHeight = 1,
  selectedObjectCollisionWidth = 1,
  selectedObjectLabel = null,
  selectedObjectOffsetX = 0,
  selectedObjectOffsetY = 0,
  selectedObjectPositionLabel = null,
  selectedObjectRenderHeightPx = null,
  selectedObjectRenderWidthPx = null,
  selectedRoomDoorCount = 0,
  selectedRoomFloorLabel = null,
  selectedRoomFloorOptions = [],
  selectedRoomFloorValue = null,
  selectedRoomId = null,
  selectedRoomLabel = null,
  selectedRoomOpeningCount = 0,
  selectedRoomPositionLabel = null,
  selectedRoomRows = null,
  selectedRoomSizeLabel = null,
  selectedRoomWallLabel = null,
  selectedRoomWallBrushOptions = [],
  selectedRoomWallBrushValue = null,
  selectedRoomCols = null,
  selectedRoomX = null,
  selectedRoomY = null,
  showWallEditOverlay = false,
  showDebugCoordinates = true,
  viewFilter,
}: ObservatoryGameCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<ObservatoryGameHandle | null>(null);
  const cameraStateRef = useRef<ObservatoryCameraState | null>(null);
  const [cameraView, setCameraView] = useState<ObservatoryCameraState | null>(null);
  const [walkthroughAgentId, setWalkthroughAgentId] = useState('');
  const [walkthroughProgress, setWalkthroughProgress] = useState<OfficeWalkthroughProgress | null>(
    null
  );
  const [walkthroughVisits, setWalkthroughVisits] = useState<string[]>([]);
  const testAgents = layout?.world.maps[0]?.agents ?? [];
  const activeTestAgentId = testAgents.some((agent) => agent.id === walkthroughAgentId)
    ? walkthroughAgentId
    : (testAgents[0]?.id ?? '');
  const walkthroughActive =
    walkthroughProgress?.status === 'walking' || walkthroughProgress?.status === 'interacting';
  const lastCanvasSizeRef = useRef<{ height: number; width: number } | null>(null);
  const onGridClickRef = useRef(onGridClick);
  const onRoomResizeCommitRef = useRef(onRoomResizeCommit);
  const onSelectionDragRef = useRef(onSelectionDrag);
  const onGridHoverRef = useRef(onGridHover);
  useEffect(() => {
    onGridHoverRef.current = onGridHover;
  }, [onGridHover]);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const lastGameUpdateKeyRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraZoom, setCameraZoom] = useState<number | null>(null);
  const map = layout?.world.maps[0];
  const objectControlsSourceKey = JSON.stringify({
    selectedObjectBaseHeightPx,
    selectedObjectBaseWidthPx,
    selectedObjectCollisionHeight,
    selectedObjectCollisionWidth,
    selectedObjectId,
    selectedObjectOffsetX,
    selectedObjectOffsetY,
    selectedObjectRenderHeightPx,
    selectedObjectRenderWidthPx,
  });
  const defaultObjectControlsDraft = createObjectControlsDraft({
    baseHeightPx: selectedObjectBaseHeightPx,
    baseWidthPx: selectedObjectBaseWidthPx,
    collisionHeight: selectedObjectCollisionHeight,
    collisionWidth: selectedObjectCollisionWidth,
    offsetX: selectedObjectOffsetX,
    offsetY: selectedObjectOffsetY,
    renderHeightPx: selectedObjectRenderHeightPx,
    renderWidthPx: selectedObjectRenderWidthPx,
    sourceKey: objectControlsSourceKey,
  });
  const roomControlsSourceKey = JSON.stringify({
    selectedRoomCols,
    selectedRoomId,
    selectedRoomRows,
    selectedRoomX,
    selectedRoomY,
  });
  const defaultRoomControlsDraft = createRoomControlsDraft({
    cols: selectedRoomCols,
    rows: selectedRoomRows,
    sourceKey: roomControlsSourceKey,
    x: selectedRoomX,
    y: selectedRoomY,
  });
  const [objectControlsDraft, setObjectControlsDraft] = useState(defaultObjectControlsDraft);
  const [roomControlsDraft, setRoomControlsDraft] = useState(defaultRoomControlsDraft);
  const activeObjectControlsDraft =
    objectControlsDraft.sourceKey === objectControlsSourceKey
      ? objectControlsDraft
      : defaultObjectControlsDraft;
  const activeRoomControlsDraft =
    roomControlsDraft.sourceKey === roomControlsSourceKey
      ? roomControlsDraft
      : defaultRoomControlsDraft;
  const updateObjectControlsDraft = (patch: Partial<Omit<ObjectControlsDraft, 'sourceKey'>>) => {
    setObjectControlsDraft((currentDraft) => ({
      ...(currentDraft.sourceKey === objectControlsSourceKey
        ? currentDraft
        : defaultObjectControlsDraft),
      ...patch,
      sourceKey: objectControlsSourceKey,
    }));
  };
  const updateRoomControlsDraft = (patch: Partial<Omit<RoomControlsDraft, 'sourceKey'>>) => {
    setRoomControlsDraft((currentDraft) => ({
      ...(currentDraft.sourceKey === roomControlsSourceKey
        ? currentDraft
        : defaultRoomControlsDraft),
      ...patch,
      sourceKey: roomControlsSourceKey,
    }));
  };
  const objectCollisionWidthInput = activeObjectControlsDraft.collisionWidth;
  const objectCollisionHeightInput = activeObjectControlsDraft.collisionHeight;
  const objectOffsetXInput = activeObjectControlsDraft.offsetX;
  const objectOffsetYInput = activeObjectControlsDraft.offsetY;
  const objectRenderWidthInput = activeObjectControlsDraft.renderWidth;
  const objectRenderHeightInput = activeObjectControlsDraft.renderHeight;
  const objectScaleInput = activeObjectControlsDraft.scale;
  const roomXInput = activeRoomControlsDraft.x;
  const roomYInput = activeRoomControlsDraft.y;
  const roomColsInput = activeRoomControlsDraft.cols;
  const roomRowsInput = activeRoomControlsDraft.rows;
  const setObjectCollisionWidthInput = (value: string) =>
    updateObjectControlsDraft({ collisionWidth: value });
  const setObjectCollisionHeightInput = (value: string) =>
    updateObjectControlsDraft({ collisionHeight: value });
  const setObjectOffsetXInput = (value: string) => updateObjectControlsDraft({ offsetX: value });
  const setObjectOffsetYInput = (value: string) => updateObjectControlsDraft({ offsetY: value });
  const setObjectRenderWidthInput = (value: string) =>
    updateObjectControlsDraft({
      renderWidth: value,
      renderHeight: String(
        Math.round(
          (Number(value) * (selectedObjectBaseHeightPx ?? 1)) / (selectedObjectBaseWidthPx ?? 1)
        )
      ),
    });
  const setObjectRenderHeightInput = (value: string) =>
    updateObjectControlsDraft({
      renderHeight: value,
      renderWidth: String(
        Math.round(
          (Number(value) * (selectedObjectBaseWidthPx ?? 1)) / (selectedObjectBaseHeightPx ?? 1)
        )
      ),
    });
  const setObjectScaleInput = (value: string) => updateObjectControlsDraft({ scale: value });
  const setRoomXInput = (value: string) => updateRoomControlsDraft({ x: value });
  const setRoomYInput = (value: string) => updateRoomControlsDraft({ y: value });
  const setRoomColsInput = (value: string) => updateRoomControlsDraft({ cols: value });
  const setRoomRowsInput = (value: string) => updateRoomControlsDraft({ rows: value });
  const footprint = getObservatoryLayoutFootprint(layout);
  const fillsAvailableViewport = presentation === 'viewer' || presentation === 'viewerCompact';
  const showStatus = presentation !== 'viewer' && presentation !== 'viewerCompact';
  const isBuilderPresentation = presentation === 'builder';
  const baseTileDisplayPx =
    presentation === 'viewerFull'
      ? 32
      : presentation === 'viewerCompact'
        ? 26
        : isBuilderPresentation
          ? 36
          : 28;
  const compactViewportHeight = footprint
    ? Math.min(760, Math.max(620, footprint.height * 36 + 80))
    : 640;
  const viewportStyle =
    map && footprint
      ? fillsAvailableViewport
        ? {
            '--canvas-aspect': `${Math.max(1, footprint.width)} / ${Math.max(1, footprint.height)}`,
            height: presentation === 'viewerCompact' ? `${compactViewportHeight}px` : undefined,
            maxHeight: 'none',
            maxWidth: 'none',
          }
        : ({
            '--canvas-aspect': `${Math.max(1, footprint.width)} / ${Math.max(1, footprint.height)}`,
            maxHeight: `${Math.min(isBuilderPresentation ? 920 : 760, Math.max(isBuilderPresentation ? 420 : 320, footprint.height * baseTileDisplayPx))}px`,
            maxWidth: `${Math.min(
              presentation === 'viewerFull' ? 1280 : isBuilderPresentation ? 1460 : 1160,
              Math.max(isBuilderPresentation ? 720 : 520, footprint.width * baseTileDisplayPx)
            )}px`,
          } as CSSProperties)
      : undefined;
  const handleCameraStateChange = (state: ObservatoryCameraState) => {
    cameraStateRef.current = state;
    setCameraView(state);
    setCameraZoom((currentZoom) =>
      currentZoom !== null && Math.abs(currentZoom - state.zoom) < 0.005 ? currentZoom : state.zoom
    );
  };
  const initialGameOptionsRef = useRef({
    activeWallEditRoomId,
    activeWallEditTool,
    activeWallEditWallAssetId,
    placementActive,
    allowPan,
    allowZoom,
    enableAmbientAutoplay,
    initialZoom,
    layout,
    selectedAgentId,
    selectedObjectId,
    showDebugCoordinates,
    showWallEditOverlay,
    viewFilter,
  });

  useEffect(() => {
    onGridClickRef.current = onGridClick;
  }, [onGridClick]);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  useEffect(() => {
    onRoomResizeCommitRef.current = onRoomResizeCommit;
  }, [onRoomResizeCommit]);

  useEffect(() => {
    onSelectionDragRef.current = onSelectionDrag;
  }, [onSelectionDrag]);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;

    const readContainerSize = (container: HTMLDivElement) => {
      const bounds = container.getBoundingClientRect();
      return {
        width: Math.max(320, Math.floor(bounds.width)),
        height: Math.max(360, Math.floor(bounds.height)),
      };
    };

    async function mountGame() {
      if (!containerRef.current || gameRef.current) {
        return;
      }

      try {
        const initialSize = readContainerSize(containerRef.current);
        const initialOptions = initialGameOptionsRef.current;
        lastCanvasSizeRef.current = initialSize;
        const gameHandle = await createObservatoryGame({
          activeWallEditRoomId: initialOptions.activeWallEditRoomId,
          activeWallEditTool: initialOptions.activeWallEditTool,
          activeWallEditWallAssetId: initialOptions.activeWallEditWallAssetId,
          placementActive: initialOptions.placementActive,
          allowPan: initialOptions.allowPan,
          allowZoom: initialOptions.allowZoom,
          enableAmbientAutoplay: initialOptions.enableAmbientAutoplay,
          initialZoom: initialOptions.initialZoom,
          initialCameraState: cameraStateRef.current,
          layout: initialOptions.layout,
          onCameraStateChange: handleCameraStateChange,
          onGridClick: (point) => onGridClickRef.current?.(point),
          onGridHover: (point) => onGridHoverRef.current?.(point),
          onRoomResizeCommit: (...args) => onRoomResizeCommitRef.current?.(...args),
          onSelectionDrag: (payload) => onSelectionDragRef.current?.(payload),
          onSelectionChange: (selection) => onSelectionChangeRef.current?.(selection),
          parent: containerRef.current,
          showWallEditOverlay: initialOptions.showWallEditOverlay,
          showDebugCoordinates: initialOptions.showDebugCoordinates,
          selectedAgentId: initialOptions.selectedAgentId,
          selectedObjectId: initialOptions.selectedObjectId,
          viewFilter: initialOptions.viewFilter,
          width: initialSize.width,
          height: initialSize.height,
        });

        if (cancelled) {
          gameHandle.destroy();
          return;
        }

        gameRef.current = gameHandle;
        lastGameUpdateKeyRef.current = createGameUpdateKey({
          ...initialOptions,
        });
        resizeObserver = new ResizeObserver((entries) => {
          const entry = entries[0];

          if (!entry || !gameRef.current) {
            return;
          }

          const width = Math.max(320, Math.floor(entry.contentRect.width));
          const height = Math.max(360, Math.floor(entry.contentRect.height));
          const lastSize = lastCanvasSizeRef.current;

          if (lastSize?.width === width && lastSize.height === height) {
            return;
          }

          lastCanvasSizeRef.current = { height, width };
          gameRef.current.resize(width, height);
        });
        resizeObserver.observe(containerRef.current);
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            caughtError instanceof Error ? caughtError.message : 'Failed to mount Observatory.'
          );
        }
      }
    }

    void mountGame();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      gameRef.current?.destroy();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const nextUpdateKey = createGameUpdateKey({
      activeWallEditRoomId,
      activeWallEditTool,
      activeWallEditWallAssetId,
      placementActive,
      allowPan,
      allowZoom,
      enableAmbientAutoplay,
      initialZoom,
      layout,
      showDebugCoordinates,
      showWallEditOverlay,
      viewFilter,
    });

    if (!gameRef.current || lastGameUpdateKeyRef.current === nextUpdateKey) {
      return;
    }

    lastGameUpdateKeyRef.current = nextUpdateKey;
    gameRef.current.stopOfficeWalkthrough?.();
    gameRef.current.update({
      activeWallEditRoomId,
      activeWallEditTool,
      activeWallEditWallAssetId,
      placementActive,
      allowPan,
      allowZoom,
      enableAmbientAutoplay,
      initialZoom,
      initialCameraState: cameraStateRef.current,
      layout,
      onCameraStateChange: handleCameraStateChange,
      onGridClick: (point) => onGridClickRef.current?.(point),
      onGridHover: (point) => onGridHoverRef.current?.(point),
      onRoomResizeCommit: (...args) => onRoomResizeCommitRef.current?.(...args),
      onSelectionDrag: (payload) => onSelectionDragRef.current?.(payload),
      onSelectionChange: (selection) => onSelectionChangeRef.current?.(selection),
      showWallEditOverlay,
      showDebugCoordinates,
      viewFilter,
    });
  }, [
    activeWallEditRoomId,
    activeWallEditTool,
    activeWallEditWallAssetId,
    placementActive,
    allowPan,
    allowZoom,
    enableAmbientAutoplay,
    initialZoom,
    layout,
    showDebugCoordinates,
    showWallEditOverlay,
    viewFilter,
  ]);

  useEffect(() => {
    gameRef.current?.updateSelection({
      selectedAgentId,
      selectedObjectId,
    });
  }, [selectedAgentId, selectedObjectId]);

  const parsedObjectCollisionWidth = Number.parseInt(objectCollisionWidthInput, 10);
  const parsedObjectCollisionHeight = Number.parseInt(objectCollisionHeightInput, 10);
  const parsedObjectRenderWidth = Number.parseFloat(objectRenderWidthInput);
  const parsedObjectRenderHeight = Number.parseFloat(objectRenderHeightInput);
  const parsedObjectOffsetX = Number.parseFloat(objectOffsetXInput);
  const parsedObjectOffsetY = Number.parseFloat(objectOffsetYInput);
  const parsedObjectScale = Number.parseFloat(objectScaleInput);
  const canApplyObjectCollisionSize =
    Number.isInteger(parsedObjectCollisionWidth) &&
    parsedObjectCollisionWidth > 0 &&
    Number.isInteger(parsedObjectCollisionHeight) &&
    parsedObjectCollisionHeight > 0;
  const canApplyObjectOffset =
    Number.isFinite(parsedObjectOffsetX) && Number.isFinite(parsedObjectOffsetY);
  const canApplyObjectRenderSize =
    Number.isFinite(parsedObjectRenderWidth) &&
    parsedObjectRenderWidth > 0 &&
    Number.isFinite(parsedObjectRenderHeight) &&
    parsedObjectRenderHeight > 0;
  const canApplyObjectScale =
    Number.isFinite(parsedObjectScale) && parsedObjectScale >= 0.1 && parsedObjectScale <= 2;
  const objectScaleRatio =
    selectedObjectBaseWidthPx &&
    selectedObjectBaseHeightPx &&
    selectedObjectRenderWidthPx &&
    selectedObjectRenderHeightPx
      ? (selectedObjectRenderWidthPx / selectedObjectBaseWidthPx +
          selectedObjectRenderHeightPx / selectedObjectBaseHeightPx) /
        2
      : null;
  const parsedRoomX = Number.parseInt(roomXInput, 10);
  const parsedRoomY = Number.parseInt(roomYInput, 10);
  const parsedRoomCols = Number.parseInt(roomColsInput, 10);
  const parsedRoomRows = Number.parseInt(roomRowsInput, 10);
  const canApplyRoomBounds =
    Number.isInteger(parsedRoomX) &&
    parsedRoomX >= 0 &&
    Number.isInteger(parsedRoomY) &&
    parsedRoomY >= 0 &&
    Number.isInteger(parsedRoomCols) &&
    parsedRoomCols > 0 &&
    Number.isInteger(parsedRoomRows) &&
    parsedRoomRows > 0;
  const selectedRoomFloorOptionLabel =
    selectedRoomFloorOptions.find((option) => option.value === selectedRoomFloorValue)?.label ??
    selectedRoomFloorLabel ??
    selectedRoomFloorValue;
  const selectedRoomWallBrushOptionLabel =
    selectedRoomWallBrushOptions.find((option) => option.value === selectedRoomWallBrushValue)
      ?.label ??
    selectedRoomWallLabel ??
    selectedRoomWallBrushValue;
  return (
    <section
      className={`${styles.shell} ${presentation === 'viewer' ? styles.viewerShell : ''} ${presentation === 'viewerCompact' ? styles.viewerCompactShell : ''} ${presentation === 'viewerFull' ? styles.viewerFullShell : ''}`}
      aria-label="Observatory Phaser canvas"
    >
      <div className={styles.viewportFrame}>
        {walkabilityCells && cameraView ? (
          <div className={styles.placementLayer} aria-hidden="true">
            {walkabilityCells.map((point) => (
              <div
                key={`${point.x}:${point.y}`}
                style={{
                  position: 'absolute',
                  left:
                    (point.x * (layout?.world.grid.tileSize ?? 48) -
                      (cameraView.viewX ?? cameraView.scrollX)) *
                    cameraView.zoom,
                  top:
                    (point.y * (layout?.world.grid.tileSize ?? 48) -
                      (cameraView.viewY ?? cameraView.scrollY)) *
                    cameraView.zoom,
                  width: (layout?.world.grid.tileSize ?? 48) * cameraView.zoom,
                  height: (layout?.world.grid.tileSize ?? 48) * cameraView.zoom,
                  background: '#14b8a633',
                  border: '1px solid #0d948866',
                }}
              />
            ))}
          </div>
        ) : null}
        {placementPreview && cameraView ? (
          <div className={styles.placementLayer} aria-hidden="true">
            {placementPreview.objects.map((object) => {
              const asset = getObservatoryFullModuleAssetRegistry().assets.find(
                (candidate) => candidate.id === object.assetId
              );
              if (!asset) return null;
              const bounds = observatoryObjectVisibleBounds(
                object,
                asset,
                layout?.world.grid.tileSize
              );
              const source = observatoryAssetSourceSize(asset);
              const size = object.render?.sizePx ?? source;
              const crop = object.render?.sourceCrop;
              return (
                <div
                  key={object.id}
                  style={{
                    position: 'absolute',
                    left: (bounds.x - (cameraView.viewX ?? cameraView.scrollX)) * cameraView.zoom,
                    top: (bounds.y - (cameraView.viewY ?? cameraView.scrollY)) * cameraView.zoom,
                    width: bounds.width * cameraView.zoom,
                    height: bounds.height * cameraView.zoom,
                    overflow: 'hidden',
                    outline: `2px solid ${placementPreview.valid ? '#16a34a' : '#dc2626'}`,
                    background: placementPreview.valid ? '#22c55e22' : '#ef444433',
                    opacity: 0.75,
                  }}
                >
                  {/* Native crops are previewed with the same source scale as Phaser. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt=""
                    src={asset.source.uri}
                    draggable={false}
                    style={{
                      position: 'absolute',
                      maxWidth: 'none',
                      width: size.width * cameraView.zoom,
                      height: size.height * cameraView.zoom,
                      left: ((-(crop?.x ?? 0) * size.width) / source.width) * cameraView.zoom,
                      top: ((-(crop?.y ?? 0) * size.height) / source.height) * cameraView.zoom,
                    }}
                  />
                </div>
              );
            })}
          </div>
        ) : null}
        <div ref={containerRef} className={styles.viewport} style={viewportStyle} />
        {allowZoom ? (
          <div className={styles.cameraHud} aria-live="polite">
            {presentation === 'builder' ? (
              <button
                type="button"
                aria-label="Zoom out"
                onClick={() => gameRef.current?.adjustCamera('out')}
              >
                −
              </button>
            ) : null}
            <span>Zoom {cameraZoom ? cameraZoom.toFixed(2) : 'fit'}x</span>
            {presentation === 'builder' ? (
              <>
                <button
                  type="button"
                  aria-label="Zoom in"
                  onClick={() => gameRef.current?.adjustCamera('in')}
                >
                  +
                </button>
                <button type="button" onClick={() => gameRef.current?.adjustCamera('fit')}>
                  Fit floor
                </button>
                {selectedObjectId || selectedRoomId ? (
                  <button type="button" onClick={() => gameRef.current?.adjustCamera('selection')}>
                    Inspect selection
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
        {selectedObjectId || selectedRoomId ? (
          <InspectorPortal target={inspectorTarget}>
            <div className={styles.hudRail}>
              {selectedObjectId ? (
                <div
                  className={styles.objectHud}
                  aria-label="Selected object canvas guide"
                  role="group"
                >
                  <div className={styles.objectHudHeader}>
                    <div className={styles.objectHudTitleGroup}>
                      <strong>Object actions</strong>
                      <span>{selectedObjectLabel ?? selectedObjectId}</span>
                    </div>
                    <button
                      className={styles.objectHudClose}
                      onClick={onSelectedObjectClose}
                      type="button"
                    >
                      Close
                    </button>
                  </div>
                  <div className={styles.objectHudMeta}>
                    {selectedObjectPositionLabel ? (
                      <span className={styles.objectHudBadge}>{selectedObjectPositionLabel}</span>
                    ) : null}
                    {objectScaleRatio ? (
                      <span className={styles.objectHudBadge}>
                        Scale {objectScaleRatio.toFixed(2)}x
                      </span>
                    ) : null}
                    <span className={styles.objectHudBadge}>
                      Collision {selectedObjectCollisionWidth}x{selectedObjectCollisionHeight}
                    </span>
                    <span className={styles.objectHudBadge}>
                      {selectedObjectBlocksMovement ? 'Blocks movement' : 'Pass-through'}
                    </span>
                    <span className={styles.objectHudBadge}>Selected on canvas</span>
                  </div>
                  <div className={styles.objectHudEditor}>
                    {selectedSetupSize > 1 ? (
                      <label className={styles.objectHudField}>
                        <span>
                          <Input
                            type="checkbox"
                            checked={editWholeSetup}
                            onChange={(event) => onEditWholeSetupChange?.(event.target.checked)}
                          />{' '}
                          Move/copy/remove setup ({selectedSetupSize} parts)
                        </span>
                      </label>
                    ) : null}
                    <details className={styles.advancedControls}>
                      <summary>Advanced geometry</summary>
                      <div className={styles.objectHudSectionLabel}>Collision size</div>
                      <div className={styles.objectHudInlineRow}>
                        <div className={styles.objectHudFieldRow}>
                          <label className={styles.objectHudField}>
                            <span>Width tiles</span>
                            <Input
                              className={styles.objectHudInput}
                              inputMode="numeric"
                              onChange={(event) => setObjectCollisionWidthInput(event.target.value)}
                              value={objectCollisionWidthInput}
                            />
                          </label>
                          <label className={styles.objectHudField}>
                            <span>Height tiles</span>
                            <Input
                              className={styles.objectHudInput}
                              inputMode="numeric"
                              onChange={(event) =>
                                setObjectCollisionHeightInput(event.target.value)
                              }
                              value={objectCollisionHeightInput}
                            />
                          </label>
                        </div>
                        <div className={styles.objectHudButtonRow}>
                          <button
                            className={styles.objectHudAction}
                            disabled={!canApplyObjectCollisionSize}
                            onClick={() =>
                              onSelectedObjectCollisionSizeApply?.({
                                width: parsedObjectCollisionWidth,
                                height: parsedObjectCollisionHeight,
                              })
                            }
                            type="button"
                          >
                            Apply
                          </button>
                          <button
                            className={styles.objectHudActionSecondary}
                            onClick={onSelectedObjectCollisionSizeReset}
                            type="button"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                      <div className={styles.objectHudSectionLabel}>Visual offset</div>
                      <div className={styles.objectHudInlineRow}>
                        <div className={styles.objectHudFieldRow}>
                          <label className={styles.objectHudField}>
                            <span>Offset X px</span>
                            <Input
                              className={styles.objectHudInput}
                              inputMode="decimal"
                              onChange={(event) => setObjectOffsetXInput(event.target.value)}
                              value={objectOffsetXInput}
                            />
                          </label>
                          <label className={styles.objectHudField}>
                            <span>Offset Y px</span>
                            <Input
                              className={styles.objectHudInput}
                              inputMode="decimal"
                              onChange={(event) => setObjectOffsetYInput(event.target.value)}
                              value={objectOffsetYInput}
                            />
                          </label>
                        </div>
                        <div className={styles.objectHudButtonRow}>
                          <button
                            className={styles.objectHudAction}
                            disabled={!canApplyObjectOffset}
                            onClick={() =>
                              onSelectedObjectOffsetApply?.({
                                x: parsedObjectOffsetX,
                                y: parsedObjectOffsetY,
                              })
                            }
                            type="button"
                          >
                            Apply
                          </button>
                          <button
                            className={styles.objectHudActionSecondary}
                            onClick={onSelectedObjectOffsetReset}
                            type="button"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                      <div className={styles.objectHudSectionLabel}>Visual size</div>
                      <div className={styles.objectHudInlineRow}>
                        <div className={styles.objectHudFieldRow}>
                          <label className={styles.objectHudField}>
                            <span>Source width px (proportional)</span>
                            <Input
                              className={styles.objectHudInput}
                              inputMode="decimal"
                              onChange={(event) => setObjectRenderWidthInput(event.target.value)}
                              value={objectRenderWidthInput}
                            />
                          </label>
                          <label className={styles.objectHudField}>
                            <span>Source height px</span>
                            <Input
                              className={styles.objectHudInput}
                              inputMode="decimal"
                              onChange={(event) => setObjectRenderHeightInput(event.target.value)}
                              value={objectRenderHeightInput}
                            />
                          </label>
                        </div>
                        <div className={styles.objectHudButtonRow}>
                          <button
                            className={styles.objectHudAction}
                            disabled={!canApplyObjectRenderSize}
                            onClick={() =>
                              onSelectedObjectRenderSizeApply?.({
                                width: parsedObjectRenderWidth,
                                height: parsedObjectRenderHeight,
                              })
                            }
                            type="button"
                          >
                            Apply
                          </button>
                          <button
                            className={styles.objectHudActionSecondary}
                            onClick={onSelectedObjectRenderSizeReset}
                            type="button"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    </details>
                    <div className={styles.objectHudSectionLabel}>Scale (proportional)</div>
                    <div className={styles.objectHudInlineRow}>
                      <Input
                        className={styles.objectHudScaleSlider}
                        max="2"
                        min="0.1"
                        onChange={(event) =>
                          setObjectScaleInput(Number.parseFloat(event.target.value).toFixed(2))
                        }
                        step="0.01"
                        type="range"
                        aria-label="Object scale slider"
                        value={Number.isFinite(parsedObjectScale) ? parsedObjectScale : 1}
                      />
                      <Input
                        className={styles.objectHudInput}
                        inputMode="decimal"
                        max="2"
                        min="0.1"
                        onChange={(event) => setObjectScaleInput(event.target.value)}
                        step="0.01"
                        type="number"
                        aria-label="Object scale"
                        value={objectScaleInput}
                      />
                      <button
                        className={styles.objectHudAction}
                        disabled={!canApplyObjectScale}
                        onClick={() => onSelectedObjectScaleApply?.(parsedObjectScale)}
                        type="button"
                      >
                        Apply
                      </button>
                      <button
                        className={styles.objectHudActionSecondary}
                        onClick={() => {
                          setObjectScaleInput('1.00');
                          onSelectedObjectRenderSizeReset?.();
                        }}
                        type="button"
                      >
                        Reset
                      </button>
                    </div>
                    <div className={styles.objectHudButtonRow}>
                      <button
                        className={styles.objectHudActionSecondary}
                        onClick={onSelectedObjectDuplicate}
                        type="button"
                      >
                        Duplicate
                      </button>
                      <button
                        className={styles.objectHudActionSecondary}
                        onClick={onSelectedObjectToggleBlocksMovement}
                        type="button"
                      >
                        {selectedObjectBlocksMovement ? 'Set pass-through' : 'Set blocking'}
                      </button>
                    </div>
                  </div>
                  <div className={styles.objectHudMovePad}>
                    <button
                      className={`${styles.objectHudMoveButton} ${styles.objectHudMoveUp}`}
                      onClick={() => onSelectedObjectMove?.('up')}
                      type="button"
                    >
                      Up
                    </button>
                    <button
                      className={`${styles.objectHudMoveButton} ${styles.objectHudMoveLeft}`}
                      onClick={() => onSelectedObjectMove?.('left')}
                      type="button"
                    >
                      Left
                    </button>
                    <button
                      className={`${styles.objectHudMoveButton} ${styles.objectHudMoveRight}`}
                      onClick={() => onSelectedObjectMove?.('right')}
                      type="button"
                    >
                      Right
                    </button>
                    <button
                      className={`${styles.objectHudMoveButton} ${styles.objectHudMoveDown}`}
                      onClick={() => onSelectedObjectMove?.('down')}
                      type="button"
                    >
                      Down
                    </button>
                    <button
                      className={styles.objectHudRemove}
                      onClick={onSelectedObjectDelete}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.roomHud} aria-label="Selected room canvas guide">
                  <div className={styles.roomHudHeader}>
                    <div className={styles.roomHudTitleGroup}>
                      <strong>Room actions</strong>
                      <span>{selectedRoomLabel ?? selectedRoomId}</span>
                    </div>
                    <button
                      className={styles.roomHudClose}
                      onClick={onSelectedRoomClose}
                      type="button"
                    >
                      Close
                    </button>
                  </div>
                  <div className={styles.roomHudMeta}>
                    {selectedRoomPositionLabel ? (
                      <span className={styles.roomHudBadge}>{selectedRoomPositionLabel}</span>
                    ) : null}
                    {selectedRoomSizeLabel ? (
                      <span className={styles.roomHudBadge}>{selectedRoomSizeLabel}</span>
                    ) : null}
                    <span className={styles.roomHudBadge}>Openings {selectedRoomOpeningCount}</span>
                    <span className={styles.roomHudBadge}>Doors {selectedRoomDoorCount}</span>
                    <span className={styles.roomHudBadge}>Selected on canvas</span>
                  </div>
                  <div className={styles.roomHudEditor}>
                    <div className={styles.objectHudSectionLabel}>Room bounds</div>
                    <div className={styles.objectHudInlineRow}>
                      <div className={styles.objectHudFieldRow}>
                        <label className={styles.objectHudField}>
                          <span>X</span>
                          <Input
                            className={styles.objectHudInput}
                            inputMode="numeric"
                            onChange={(event) => setRoomXInput(event.target.value)}
                            value={roomXInput}
                          />
                        </label>
                        <label className={styles.objectHudField}>
                          <span>Y</span>
                          <Input
                            className={styles.objectHudInput}
                            inputMode="numeric"
                            onChange={(event) => setRoomYInput(event.target.value)}
                            value={roomYInput}
                          />
                        </label>
                        <label className={styles.objectHudField}>
                          <span>Cols</span>
                          <Input
                            className={styles.objectHudInput}
                            inputMode="numeric"
                            onChange={(event) => setRoomColsInput(event.target.value)}
                            value={roomColsInput}
                          />
                        </label>
                        <label className={styles.objectHudField}>
                          <span>Rows</span>
                          <Input
                            className={styles.objectHudInput}
                            inputMode="numeric"
                            onChange={(event) => setRoomRowsInput(event.target.value)}
                            value={roomRowsInput}
                          />
                        </label>
                      </div>
                      <div className={styles.objectHudButtonRow}>
                        <button
                          className={styles.objectHudAction}
                          disabled={!canApplyRoomBounds}
                          onClick={() =>
                            onSelectedRoomBoundsApply?.({
                              x: parsedRoomX,
                              y: parsedRoomY,
                              width: parsedRoomCols,
                              height: parsedRoomRows,
                            })
                          }
                          type="button"
                        >
                          Apply
                        </button>
                        <button
                          className={styles.objectHudActionSecondary}
                          onClick={() => {
                            setRoomXInput(selectedRoomX !== null ? String(selectedRoomX) : '');
                            setRoomYInput(selectedRoomY !== null ? String(selectedRoomY) : '');
                            setRoomColsInput(
                              selectedRoomCols !== null ? String(selectedRoomCols) : ''
                            );
                            setRoomRowsInput(
                              selectedRoomRows !== null ? String(selectedRoomRows) : ''
                            );
                          }}
                          type="button"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className={styles.roomHudEditor}>
                    <div className={styles.objectHudSectionLabel}>Room surfaces</div>
                    <div className={styles.roomHudMeta}>
                      <span className={styles.roomHudBadge}>
                        Surface tools use the selected floor or wall brush.
                      </span>
                      {selectedRoomWallBrushOptionLabel ? (
                        <span className={styles.roomHudBadge}>
                          Wall brush {selectedRoomWallBrushOptionLabel}
                        </span>
                      ) : null}
                      {selectedRoomFloorOptionLabel ? (
                        <span className={styles.roomHudBadge}>
                          Floor {selectedRoomFloorOptionLabel}
                        </span>
                      ) : null}
                    </div>
                    <div className={styles.roomHudSurfaceGrid}>
                      <label className={styles.roomHudSurface}>
                        <strong>Floor</strong>
                        <NativeSelect
                          className={styles.roomHudSelect}
                          onChange={(event) => onSelectedRoomFloorSelect?.(event.target.value)}
                          value={selectedRoomFloorValue ?? ''}
                        >
                          {selectedRoomFloorOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </NativeSelect>
                      </label>
                      <label className={styles.roomHudSurface}>
                        <strong>Wall brush</strong>
                        <NativeSelect
                          className={styles.roomHudSelect}
                          onChange={(event) => onSelectedRoomWallBrushSelect?.(event.target.value)}
                          value={selectedRoomWallBrushValue ?? ''}
                        >
                          {selectedRoomWallBrushOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </NativeSelect>
                      </label>
                    </div>
                    <div className={styles.roomHudActions}>
                      <button
                        className={styles.roomHudAction}
                        onClick={onSelectedRoomFloorApply}
                        type="button"
                      >
                        Apply floor
                      </button>
                      <button
                        className={styles.roomHudAction}
                        onClick={onSelectedRoomWallApply}
                        type="button"
                      >
                        Apply wall to all
                      </button>
                    </div>
                  </div>
                  <div className={styles.roomHudEditor}>
                    <div className={styles.objectHudSectionLabel}>Edit surfaces</div>
                    <div className={styles.roomHudMeta}>
                      <span className={styles.roomHudBadge}>
                        {showWallEditOverlay ? 'Surface edit active' : 'Surface edit off'}
                      </span>
                      <span className={styles.roomHudBadge}>
                        {activeWallEditTool === 'floor' ? 'Room cells' : 'Perimeter cells'}
                      </span>
                      <span className={styles.roomHudBadge}>
                        Openings {activeWallEditOpeningCount || selectedRoomOpeningCount}
                      </span>
                      <span className={styles.roomHudBadge}>
                        Doors {activeWallEditDoorCount || selectedRoomDoorCount}
                      </span>
                    </div>
                    <div className={styles.wallEditHudTools}>
                      <button
                        className={`${styles.wallEditHudToggle} ${activeWallEditTool === 'floor' ? styles.wallEditHudToggleActive : ''}`}
                        onClick={() => {
                          if (showWallEditOverlay && activeWallEditTool === 'floor') {
                            onActiveWallEditClose?.();
                            return;
                          }
                          if (!showWallEditOverlay) {
                            onSelectedRoomWallEditToggle?.();
                          }
                          onActiveWallEditToolChange?.('floor');
                        }}
                        type="button"
                      >
                        Paint floor
                      </button>
                      <button
                        className={`${styles.wallEditHudToggle} ${activeWallEditTool === 'paint' ? styles.wallEditHudToggleActive : ''}`}
                        onClick={() => {
                          if (showWallEditOverlay && activeWallEditTool === 'paint') {
                            onActiveWallEditClose?.();
                            return;
                          }
                          if (!showWallEditOverlay) {
                            onSelectedRoomWallEditToggle?.();
                          }
                          onActiveWallEditToolChange?.('paint');
                        }}
                        type="button"
                      >
                        Paint wall
                      </button>
                      <button
                        className={`${styles.wallEditHudToggle} ${activeWallEditTool === 'opening' ? styles.wallEditHudToggleActive : ''}`}
                        onClick={() => {
                          if (showWallEditOverlay && activeWallEditTool === 'opening') {
                            onActiveWallEditClose?.();
                            return;
                          }
                          if (!showWallEditOverlay) {
                            onSelectedRoomWallEditToggle?.();
                          }
                          onActiveWallEditToolChange?.('opening');
                        }}
                        type="button"
                      >
                        Remove wall
                      </button>
                      <button
                        className={`${styles.wallEditHudToggle} ${activeWallEditTool === 'tile' ? styles.wallEditHudToggleActive : ''}`}
                        onClick={() => {
                          if (showWallEditOverlay && activeWallEditTool === 'tile') {
                            onActiveWallEditClose?.();
                            return;
                          }
                          if (!showWallEditOverlay) {
                            onSelectedRoomWallEditToggle?.();
                          }
                          onActiveWallEditToolChange?.('tile');
                        }}
                        type="button"
                      >
                        Remove tile
                      </button>
                      <button
                        className={`${styles.wallEditHudToggle} ${activeWallEditTool === 'door' ? styles.wallEditHudToggleActive : ''}`}
                        onClick={() => {
                          if (showWallEditOverlay && activeWallEditTool === 'door') {
                            onActiveWallEditClose?.();
                            return;
                          }
                          if (!showWallEditOverlay) {
                            onSelectedRoomWallEditToggle?.();
                          }
                          onActiveWallEditToolChange?.('door');
                        }}
                        type="button"
                      >
                        Door tool
                      </button>
                    </div>
                    <p className={styles.roomHudHint}>
                      {showWallEditOverlay
                        ? activeWallEditTool === 'floor'
                          ? 'Click cells inside the selected room to paint floor overrides with the current floor selection.'
                          : activeWallEditTool === 'tile'
                            ? 'Click north wall tiles to hide or restore the wall tile while keeping the white room border.'
                            : 'Click perimeter wall cells on the canvas to paint, remove, or place doors with the current wall brush. Painting the same wall as the room default will not look different.'
                        : 'Choose a surface tool to paint floor cells, paint wall cells grid by grid, remove wall cells back to floor, hide top wall tiles, or place door segments.'}
                    </p>
                  </div>
                  <div className={styles.roomHudEditor}>
                    <div className={styles.objectHudSectionLabel}>Room actions</div>
                    <div className={styles.roomHudActions}>
                      <button
                        className={styles.roomHudActionMuted}
                        onClick={onSelectedRoomDelete}
                        type="button"
                      >
                        Delete room
                      </button>
                    </div>
                    <p className={styles.roomHudHint}>
                      Use the explicit room controls to move rooms. Resize from the east, south, or
                      corner handle on the canvas.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </InspectorPortal>
        ) : null}
      </div>
      {enableMovementTest ? (
        <div className={styles.movementTest} aria-label="Office movement test">
          <label>
            Test agent{' '}
            <NativeSelect
              aria-label="Walkthrough agent"
              value={activeTestAgentId}
              disabled={walkthroughActive}
              onChange={(event) => setWalkthroughAgentId(event.target.value)}
            >
              {testAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <button
            type="button"
            className={styles.objectHudActionSecondary}
            disabled={!cameraView || !activeTestAgentId}
            onClick={() => {
              if (walkthroughActive) {
                gameRef.current?.stopOfficeWalkthrough();
                return;
              }
              setWalkthroughVisits([]);
              gameRef.current?.startOfficeWalkthrough(activeTestAgentId, (progress) => {
                setWalkthroughProgress(progress);
                if (progress.status === 'interacting')
                  setWalkthroughVisits((visits) => [
                    ...visits,
                    `${progress.label} (${progress.point?.x}, ${progress.point?.y})`,
                  ]);
              });
            }}
          >
            {walkthroughActive ? 'Stop walkthrough' : 'Run office walkthrough'}
          </button>
          <p role="status" aria-label="Movement test progress">
            {walkthroughProgress
              ? `${walkthroughProgress.status === 'interacting' ? 'Using workstation / visiting room' : walkthroughProgress.status}: ${walkthroughProgress.label} · ${walkthroughProgress.completed}/${walkthroughProgress.total} stops`
              : 'Preview an agent walking through every room and workstation on this floor.'}
          </p>
          {walkthroughVisits.length ? (
            <details>
              <summary>Visited stops ({walkthroughVisits.length})</summary>
              <ol>
                {walkthroughVisits.map((visit, index) => (
                  <li key={index}>{visit}</li>
                ))}
              </ol>
            </details>
          ) : null}
        </div>
      ) : null}
      {showStatus || error ? (
        <p className={`${styles.status} ${error ? styles.error : ''}`}>
          {error ??
            (allowPan || allowZoom
              ? 'Observatory Phaser 4 canvas. Drag to pan and wheel to zoom when camera controls are enabled.'
              : 'Observatory Phaser 4 canvas. Camera pan and wheel zoom are locked.')}
        </p>
      ) : null}
    </section>
  );
}

function InspectorPortal({
  target,
  children,
}: {
  target?: HTMLElement | null;
  children: ReactNode;
}) {
  return target ? createPortal(children, target) : children;
}
