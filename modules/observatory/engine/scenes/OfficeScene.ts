import type Phaser from 'phaser';

import { getObservatoryFullModuleAssetRegistry } from '@/modules/observatory/engine/assets/moduleFullAssetRegistry';
import {
  OBSERVATORY_AGENT_VISUAL_STATE_EVENT,
  type ObservatoryAgentVisualState,
  type ObservatoryAgentVisualStateEventDetail,
} from '@/modules/observatory/engine/rendering/agentVisualState';
import type { ObservatoryOfficeMapViewFilter } from '@/modules/observatory/engine/rendering/officeMapRenderer';
import { renderObservatoryOfficeMap } from '@/modules/observatory/engine/rendering/officeMapRenderer';
import {
  OBSERVATORY_CAMERA_USER_ADJUSTED_EVENT,
  setupObservatorySceneInteractions,
} from '@/modules/observatory/engine/rendering/sceneInteractionControls';
import type {
  ObservatoryCanvasGridClick,
  ObservatoryCanvasOverlayState,
  ObservatoryCanvasSelection,
} from '@/modules/observatory/engine/selection';
import { getObservatoryMapFootprint } from '@/modules/observatory/engine/world/layoutFootprint';
import sampleLayout from '@/modules/observatory/engine/world/sampleLayout.json';
import { validateObservatoryLayout } from '@/modules/observatory/engine/world/layoutValidation';
import type { ObservatoryLayoutDocument } from '@/modules/observatory/engine/world/layoutTypes';
import type { ObservatoryGridRect } from '@/modules/observatory/engine/world/grid';

type PhaserRuntime = typeof Phaser;

export interface ObservatoryCameraState {
  scrollX: number;
  scrollY: number;
  zoom: number;
}

export interface ObservatoryOfficeSceneOptions {
  activeWallEditRoomId?: string | null;
  activeWallEditTool?: 'door' | 'floor' | 'opening' | 'paint' | 'tile';
  activeWallEditWallAssetId?: string | null;
  allowPan?: boolean;
  allowZoom?: boolean;
  enableAmbientAutoplay?: boolean;
  initialCameraState?: ObservatoryCameraState | null;
  initialZoom?: number | null;
  onCameraStateChange?: (state: ObservatoryCameraState) => void;
  onGridClick?: (point: ObservatoryCanvasGridClick) => void;
  onRoomResizeCommit?: (roomId: string, bounds: ObservatoryGridRect) => void;
  onSceneReady?: () => void;
  onSelectionDrag?: (payload: {
    from: ObservatoryCanvasGridClick;
    id: string;
    kind: 'object' | 'room';
    to: ObservatoryCanvasGridClick;
  }) => void;
  onSelectionChange?: (selection: ObservatoryCanvasSelection) => void;
  selectedAgentId?: string | null;
  selectedObjectId?: string | null;
  showWallEditOverlay?: boolean;
  showDebugCoordinates?: boolean;
  sceneKey?: string;
  viewFilter?: ObservatoryOfficeMapViewFilter;
}

export function createOfficeScene(
  PhaserRuntime: PhaserRuntime,
  layout: ObservatoryLayoutDocument = sampleLayout as ObservatoryLayoutDocument,
  options: ObservatoryOfficeSceneOptions = {}
) {
  return class OfficeScene extends PhaserRuntime.Scene {
    private renderedMapHandle: ReturnType<typeof renderObservatoryOfficeMap> | null = null;

    constructor() {
      super(options.sceneKey ?? 'OfficeScene');
    }

    getSelectionOverlayState(): ObservatoryCanvasOverlayState | null {
      if (!this.renderedMapHandle) {
        return null;
      }

      const camera = this.cameras.main;
      const selectedObjectBounds = this.renderedMapHandle.getSelectedObjectBounds();

      if (selectedObjectBounds) {
        const anchorX =
          (selectedObjectBounds.x + selectedObjectBounds.width / 2 - camera.scrollX) * camera.zoom;
        const aboveY = (selectedObjectBounds.y - 12 - camera.scrollY) * camera.zoom;
        const belowY =
          (selectedObjectBounds.y + selectedObjectBounds.height + 12 - camera.scrollY) *
          camera.zoom;

        return {
          anchorX,
          anchorY: aboveY > 108 ? aboveY : belowY,
          kind: 'object',
          label: selectedObjectBounds.label,
          placement: aboveY > 108 ? 'above' : 'below',
        };
      }

      const selectedRoomBounds = this.renderedMapHandle.getSelectedRoomBounds();
      if (!selectedRoomBounds) {
        return null;
      }

      return {
        anchorX: (selectedRoomBounds.x + 18 - camera.scrollX) * camera.zoom,
        anchorY: (selectedRoomBounds.y + 18 - camera.scrollY) * camera.zoom,
        kind: 'room',
        label: selectedRoomBounds.label,
        placement: 'below',
      };
    }

    updateSelection({
      selectedAgentId = null,
      selectedObjectId = null,
    }: {
      selectedAgentId?: string | null;
      selectedObjectId?: string | null;
    }) {
      if (!this.renderedMapHandle) {
        return;
      }

      if (selectedAgentId) {
        this.renderedMapHandle.selectAgent(selectedAgentId);
        return;
      }

      if (selectedObjectId) {
        this.renderedMapHandle.selectObject(selectedObjectId);
        return;
      }

      this.renderedMapHandle.selectAgent(null);
    }

    create() {
      const validatedLayout = validateObservatoryLayout(layout);

      if (!validatedLayout.layout) {
        this.renderInvalidLayout(
          validatedLayout.issues.map((issue) => `${issue.path}: ${issue.reason}`)
        );
        return;
      }

      const { world } = validatedLayout.layout;
      const map = world.maps[0];

      if (!map) {
        this.renderInvalidLayout(['world.maps: expected at least one map']);
        return;
      }

      const footprint = getObservatoryMapFootprint(map);
      const footprintWidthPx = Math.max(
        world.grid.tileSize * 3,
        footprint.width * world.grid.tileSize
      );
      const footprintHeightPx = Math.max(
        world.grid.tileSize * 3,
        footprint.height * world.grid.tileSize + 64
      );
      const worldWidthPx = map.size.width * world.grid.tileSize;
      const worldHeightPx = map.size.height * world.grid.tileSize + 64;
      const footprintCenterX = (footprint.x + footprint.width / 2) * world.grid.tileSize;
      const footprintCenterY = (footprint.y + footprint.height / 2) * world.grid.tileSize;
      let cameraUserAdjusted = false;
      const camera = this.cameras.main;
      const fitZoom = Math.min(camera.width / footprintWidthPx, camera.height / footprintHeightPx);
      const clampedFitZoom = Math.min(1.9, Math.max(0.5, fitZoom));
      const minCameraZoom = Math.max(0.25, Math.min(clampedFitZoom, 0.6));
      const maxCameraZoom = Math.max(2.2, clampedFitZoom * 4);
      const defaultCameraZoom =
        typeof options.initialZoom === 'number' && Number.isFinite(options.initialZoom)
          ? clamp(options.initialZoom, minCameraZoom, maxCameraZoom)
          : clampedFitZoom;
      let cameraBounds = applyCameraBoundsForZoom(defaultCameraZoom);

      const clampCameraToBounds = () => {
        const visibleWidthPx = camera.width / camera.zoom;
        const visibleHeightPx = camera.height / camera.zoom;
        const minScrollX = -cameraBounds.horizontalMarginPx;
        const minScrollY = -cameraBounds.verticalMarginPx;
        const maxScrollX = Math.max(
          minScrollX,
          worldWidthPx + cameraBounds.horizontalMarginPx - visibleWidthPx
        );
        const maxScrollY = Math.max(
          minScrollY,
          worldHeightPx + cameraBounds.verticalMarginPx - visibleHeightPx
        );

        camera.scrollX = clamp(camera.scrollX, minScrollX, maxScrollX);
        camera.scrollY = clamp(camera.scrollY, minScrollY, maxScrollY);
      };

      function applyCameraBoundsForZoom(zoom: number) {
        const visibleWidthPx = camera.width / zoom;
        const visibleHeightPx = camera.height / zoom;
        const horizontalMarginPx = Math.max(0, (visibleWidthPx - footprintWidthPx) / 2);
        const verticalMarginPx = Math.max(0, (visibleHeightPx - footprintHeightPx) / 2);

        camera.setBounds(
          -horizontalMarginPx,
          -verticalMarginPx,
          worldWidthPx + horizontalMarginPx * 2,
          worldHeightPx + verticalMarginPx * 2
        );

        return { horizontalMarginPx, verticalMarginPx };
      }

      const fitCameraToFootprint = (force = false) => {
        if (cameraUserAdjusted && !force) {
          return;
        }

        camera.setZoom(defaultCameraZoom);
        cameraBounds = applyCameraBoundsForZoom(defaultCameraZoom);
        camera.centerOn(footprintCenterX, footprintCenterY);
      };
      const handleCameraResize = () => {
        fitCameraToFootprint(false);
      };

      const markCameraUserAdjusted = () => {
        cameraUserAdjusted = true;
      };
      const emitCameraState = () => {
        options.onCameraStateChange?.({
          scrollX: camera.scrollX,
          scrollY: camera.scrollY,
          zoom: camera.zoom,
        });
      };
      const restoreCameraState = (state: ObservatoryCameraState) => {
        const restoredZoom = clamp(state.zoom, minCameraZoom, maxCameraZoom);

        camera.setZoom(restoredZoom);
        cameraBounds = applyCameraBoundsForZoom(restoredZoom);
        camera.setScroll(state.scrollX, state.scrollY);
        clampCameraToBounds();
        cameraUserAdjusted = true;
        emitCameraState();
      };

      this.events.on(OBSERVATORY_CAMERA_USER_ADJUSTED_EVENT, markCameraUserAdjusted);
      fitCameraToFootprint(true);
      emitCameraState();
      if (options.initialCameraState) {
        restoreCameraState(options.initialCameraState);
        this.time.delayedCall(0, () => {
          if (options.initialCameraState) {
            restoreCameraState(options.initialCameraState);
          }
        });
      }
      this.scale.on('resize', handleCameraResize);
      this.events.once('shutdown', () => {
        this.events.off(OBSERVATORY_CAMERA_USER_ADJUSTED_EVENT, markCameraUserAdjusted);
        this.scale.off('resize', handleCameraResize);
      });

      const grid = { tileSize: world.grid.tileSize };
      const assetRegistry = getObservatoryFullModuleAssetRegistry();

      const renderedMap = renderObservatoryOfficeMap(this, map, grid, {
        activeWallEditRoomId: options.activeWallEditRoomId,
        activeWallEditTool: options.activeWallEditTool,
        activeWallEditWallAssetId: options.activeWallEditWallAssetId,
        assetRegistry,
        debugGrid: true,
        enableDirectSelection: !options.onGridClick,
        onWallEditCellClick: options.onGridClick,
        showWallEditOverlay: options.showWallEditOverlay,
        viewFilter: options.viewFilter,
        onAgentSelected: (agent) => {
          options.onSelectionChange?.({ id: agent.id, kind: 'agent', label: agent.name });
        },
        onObjectSelected: (object) => {
          options.onSelectionChange?.({ id: object.id, kind: 'object', label: object.assetId });
        },
        onRoomSelected: (room) => {
          options.onSelectionChange?.({ id: room.id, kind: 'room', label: room.name });
        },
      });
      if (options.selectedAgentId) {
        renderedMap.selectAgent(options.selectedAgentId);
      } else if (options.selectedObjectId) {
        renderedMap.selectObject(options.selectedObjectId);
      }
      this.renderedMapHandle = renderedMap;
      let ambientAutoplayTick = 0;
      const ambientAutoplayActions: NonNullable<ObservatoryAgentVisualState['action']>[] = [
        'walk',
        'idle',
        'phone',
        'reading',
      ];
      const ambientAutoplayDirections: NonNullable<ObservatoryAgentVisualState['direction']>[] = [
        'down',
        'right',
        'up',
        'left',
      ];

      if (typeof window !== 'undefined') {
        let bridgeActive = true;
        const handleAgentVisualState = (event: Event) => {
          if (!bridgeActive || !this.sys.displayList) {
            return;
          }

          const detail = (event as CustomEvent<ObservatoryAgentVisualStateEventDetail>).detail;
          renderedMap.applyAgentVisualStates(detail.agents);
          renderedMap.applyRoomVisualStates(detail.rooms ?? []);
        };
        const cleanupAgentVisualStateBridge = () => {
          bridgeActive = false;
          window.removeEventListener(OBSERVATORY_AGENT_VISUAL_STATE_EVENT, handleAgentVisualState);
        };

        window.addEventListener(OBSERVATORY_AGENT_VISUAL_STATE_EVENT, handleAgentVisualState);
        this.events.once('shutdown', cleanupAgentVisualStateBridge);
        this.events.once('destroy', cleanupAgentVisualStateBridge);
      }

      if (options.enableAmbientAutoplay) {
        const ambientAutoplayTimer = this.time.addEvent({
          delay: 2_400,
          loop: true,
          callback: () => {
            ambientAutoplayTick += 1;
            const idleAgentStates = map.agents
              .filter((agent) => agent.status === 'idle')
              .map(
                (agent, index): ObservatoryAgentVisualState => ({
                  action:
                    ambientAutoplayActions[
                      (ambientAutoplayTick + index) % ambientAutoplayActions.length
                    ],
                  agentId: agent.id,
                  direction:
                    ambientAutoplayDirections[
                      (ambientAutoplayTick + index) % ambientAutoplayDirections.length
                    ],
                  movementKey: `scene-ambient:${agent.id}:${agent.roomId ?? 'room'}:${ambientAutoplayTick}`,
                  status: 'idle',
                  targetRoomId: agent.roomId,
                })
              );

            if (idleAgentStates.length > 0) {
              renderedMap.applyAgentVisualStates(idleAgentStates);
            }
          },
        });

        this.events.once('shutdown', () => ambientAutoplayTimer.remove(false));
        this.events.once('destroy', () => ambientAutoplayTimer.remove(false));
      }

      setupObservatorySceneInteractions(this, {
        allowPan: options.allowPan,
        allowZoom: options.allowZoom,
        grid,
        map,
        onCameraStateChange: emitCameraState,
        onGridClick: options.onGridClick,
        onRoomResizeCommit: options.onRoomResizeCommit,
        onSelectionDrag: options.onSelectionDrag,
        renderedMap,
        wallEditActive: options.showWallEditOverlay,
        showDebugCoordinates: options.showDebugCoordinates,
      });

      this.events.once('shutdown', () => {
        this.renderedMapHandle = null;
      });
      this.events.once('destroy', () => {
        this.renderedMapHandle = null;
      });

      options.onSceneReady?.();
    }

    private renderInvalidLayout(messages: string[]) {
      this.add
        .text(24, 24, `Invalid Observatory layout\n${messages.join('\n')}`, {
          color: '#fecdd3',
          fontFamily: 'monospace',
          fontSize: '14px',
        })
        .setDepth(50);
    }
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
