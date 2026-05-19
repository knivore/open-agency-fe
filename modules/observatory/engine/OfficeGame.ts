import type Phaser from 'phaser';

import { createBootScene } from '@/modules/observatory/engine/scenes/BootScene';
import { createOfficeScene } from '@/modules/observatory/engine/scenes/OfficeScene';
import type { ObservatoryCameraState } from '@/modules/observatory/engine/scenes/OfficeScene';
import type { ObservatoryOfficeMapViewFilter } from '@/modules/observatory/engine/rendering/officeMapRenderer';
import { createPreloadScene } from '@/modules/observatory/engine/scenes/PreloadScene';
import type {
  ObservatoryCanvasGridClick,
  ObservatoryCanvasOverlayState,
  ObservatoryCanvasSelection,
} from '@/modules/observatory/engine/selection';
import sampleLayout from '@/modules/observatory/engine/world/sampleLayout.json';
import type { ObservatoryLayoutDocument } from '@/modules/observatory/engine/world/layoutTypes';
import type { ObservatoryGridRect } from '@/modules/observatory/engine/world/grid';

type PhaserRuntime = typeof Phaser;
type PhaserImport = PhaserRuntime & { default?: PhaserRuntime };
let observatoryGameInstanceCounter = 0;

export interface ObservatoryGameOptions {
  activeWallEditRoomId?: string | null;
  activeWallEditTool?: 'door' | 'floor' | 'opening' | 'paint' | 'tile';
  activeWallEditWallAssetId?: string | null;
  allowPan?: boolean;
  allowZoom?: boolean;
  enableAmbientAutoplay?: boolean;
  initialCameraState?: ObservatoryCameraState | null;
  initialZoom?: number | null;
  layout?: ObservatoryLayoutDocument;
  onCameraStateChange?: (state: ObservatoryCameraState) => void;
  onGridClick?: (point: ObservatoryCanvasGridClick) => void;
  onRoomResizeCommit?: (roomId: string, bounds: ObservatoryGridRect) => void;
  onSelectionDrag?: (payload: {
    from: ObservatoryCanvasGridClick;
    id: string;
    kind: 'object' | 'room';
    to: ObservatoryCanvasGridClick;
  }) => void;
  onSelectionChange?: (selection: ObservatoryCanvasSelection) => void;
  parent: HTMLElement;
  selectedAgentId?: string | null;
  selectedObjectId?: string | null;
  showWallEditOverlay?: boolean;
  showDebugCoordinates?: boolean;
  viewFilter?: ObservatoryOfficeMapViewFilter;
  width?: number;
  height?: number;
}

export interface ObservatoryGameHandle {
  game: Phaser.Game;
  destroy(): void;
  getSelectionOverlayState(): ObservatoryCanvasOverlayState | null;
  resize(width: number, height: number): void;
  update(options: Omit<ObservatoryGameOptions, 'parent' | 'width' | 'height'>): void;
  updateSelection(selection: {
    selectedAgentId?: string | null;
    selectedObjectId?: string | null;
  }): void;
}

async function loadPhaser(): Promise<PhaserRuntime> {
  const phaserModule = (await import('phaser')) as PhaserImport;

  return phaserModule.default ?? phaserModule;
}

export async function createObservatoryGame({
  activeWallEditRoomId,
  activeWallEditTool,
  activeWallEditWallAssetId,
  allowPan = true,
  allowZoom = true,
  enableAmbientAutoplay = false,
  initialCameraState = null,
  initialZoom = null,
  layout = sampleLayout as ObservatoryLayoutDocument,
  onCameraStateChange,
  onGridClick,
  onRoomResizeCommit,
  onSelectionDrag,
  onSelectionChange,
  parent,
  selectedAgentId = null,
  selectedObjectId = null,
  showWallEditOverlay = false,
  showDebugCoordinates = true,
  viewFilter,
  width = 960,
  height = 540,
}: ObservatoryGameOptions): Promise<ObservatoryGameHandle> {
  const PhaserRuntime = await loadPhaser();
  const sceneKeySuffix = `${Date.now()}:${(observatoryGameInstanceCounter += 1)}`;
  const sceneKeys = {
    boot: `ObservatoryBootScene:${sceneKeySuffix}`,
    office: `ObservatoryOfficeScene:${sceneKeySuffix}`,
    preload: `ObservatoryPreloadScene:${sceneKeySuffix}`,
  };
  let officeSceneReady = false;
  let queuedUpdateOptions: Omit<ObservatoryGameOptions, 'parent' | 'width' | 'height'> | null =
    null;
  let queuedSelection: {
    selectedAgentId?: string | null;
    selectedObjectId?: string | null;
  } | null = null;
  let preservedCameraState: ObservatoryCameraState | null = initialCameraState;

  const markOfficeSceneReady = () => {
    officeSceneReady = true;

    if (queuedUpdateOptions) {
      const nextOptions = queuedUpdateOptions;
      queuedUpdateOptions = null;
      queueMicrotask(() => {
        if (officeSceneReady) {
          applyUpdate(nextOptions);
        }
      });
      return;
    }

    if (queuedSelection) {
      const nextSelection = queuedSelection;
      queuedSelection = null;
      queueMicrotask(() => {
        if (officeSceneReady) {
          applySelection(nextSelection);
        }
      });
    }
  };
  const buildOfficeScene = (
    nextLayout: ObservatoryLayoutDocument,
    nextOptions: Pick<
      ObservatoryGameOptions,
      | 'activeWallEditRoomId'
      | 'activeWallEditTool'
      | 'activeWallEditWallAssetId'
      | 'allowPan'
      | 'allowZoom'
      | 'enableAmbientAutoplay'
      | 'initialZoom'
      | 'onCameraStateChange'
      | 'onGridClick'
      | 'onRoomResizeCommit'
      | 'onSelectionDrag'
      | 'onSelectionChange'
      | 'selectedAgentId'
      | 'selectedObjectId'
      | 'showWallEditOverlay'
      | 'showDebugCoordinates'
      | 'viewFilter'
    >,
    initialCameraState: ObservatoryCameraState | null
  ) =>
    createOfficeScene(PhaserRuntime, nextLayout, {
      ...nextOptions,
      initialCameraState,
      onSceneReady: markOfficeSceneReady,
      sceneKey: sceneKeys.office,
    });
  const buildSceneOptions = (
    nextOptions: Omit<ObservatoryGameOptions, 'parent' | 'width' | 'height'>
  ) => ({
    activeWallEditRoomId: nextOptions.activeWallEditRoomId,
    activeWallEditTool: nextOptions.activeWallEditTool,
    activeWallEditWallAssetId: nextOptions.activeWallEditWallAssetId,
    allowPan: nextOptions.allowPan,
    allowZoom: nextOptions.allowZoom,
    enableAmbientAutoplay: nextOptions.enableAmbientAutoplay,
    initialZoom: nextOptions.initialZoom,
    onCameraStateChange: nextOptions.onCameraStateChange,
    onGridClick: nextOptions.onGridClick,
    onRoomResizeCommit: nextOptions.onRoomResizeCommit,
    onSelectionDrag: nextOptions.onSelectionDrag,
    onSelectionChange: nextOptions.onSelectionChange,
    selectedAgentId: nextOptions.selectedAgentId,
    selectedObjectId: nextOptions.selectedObjectId,
    showWallEditOverlay: nextOptions.showWallEditOverlay,
    showDebugCoordinates: nextOptions.showDebugCoordinates,
    viewFilter: nextOptions.viewFilter,
  });
  const initialSceneOptions = buildSceneOptions({
    activeWallEditRoomId,
    activeWallEditTool,
    activeWallEditWallAssetId,
    allowPan,
    allowZoom,
    enableAmbientAutoplay,
    initialZoom,
    onCameraStateChange,
    onGridClick,
    onRoomResizeCommit,
    onSelectionDrag,
    onSelectionChange,
    selectedAgentId,
    selectedObjectId,
    showWallEditOverlay,
    showDebugCoordinates,
    viewFilter,
  });
  const buildPreloadScene = (
    nextLayout: ObservatoryLayoutDocument,
    nextOptions: ReturnType<typeof buildSceneOptions>,
    initialCameraState: ObservatoryCameraState | null
  ) =>
    createPreloadScene(
      PhaserRuntime,
      nextLayout,
      sceneKeys.preload,
      sceneKeys.office,
      buildOfficeScene(nextLayout, nextOptions, initialCameraState)
    );

  const applyUpdate = (
    nextOptions: Omit<ObservatoryGameOptions, 'parent' | 'width' | 'height'>
  ) => {
    officeSceneReady = false;
    const nextLayout = nextOptions.layout ?? layout;
    const activeOfficeScene = game.scene.getScene(sceneKeys.office) as Phaser.Scene | null;
    const activeCamera = activeOfficeScene?.cameras?.main;

    if (activeCamera) {
      preservedCameraState = {
        scrollX: activeCamera.scrollX,
        scrollY: activeCamera.scrollY,
        zoom: activeCamera.zoom,
      };
    } else if (nextOptions.initialCameraState) {
      preservedCameraState = nextOptions.initialCameraState;
    }

    const preloadScene = buildPreloadScene(
      nextLayout,
      buildSceneOptions(nextOptions),
      preservedCameraState
    );

    game.scene.stop(sceneKeys.office);
    game.scene.stop(sceneKeys.preload);
    game.scene.remove(sceneKeys.office);
    game.scene.remove(sceneKeys.preload);
    game.scene.add(sceneKeys.preload, preloadScene, true);
  };
  const applySelection = (selection: {
    selectedAgentId?: string | null;
    selectedObjectId?: string | null;
  }) => {
    const activeOfficeScene = game.scene.getScene(sceneKeys.office) as
      | (Phaser.Scene & {
          updateSelection?: (selection: {
            selectedAgentId?: string | null;
            selectedObjectId?: string | null;
          }) => void;
        })
      | null;

    activeOfficeScene?.updateSelection?.(selection);
  };

  const game = new PhaserRuntime.Game({
    type: PhaserRuntime.AUTO,
    parent,
    width,
    height,
    audio: {
      noAudio: true,
    },
    backgroundColor: '#eaf4f8',
    render: {
      antialias: false,
      pixelArt: true,
      roundPixels: true,
    },
    scale: {
      mode: PhaserRuntime.Scale.RESIZE,
      autoCenter: PhaserRuntime.Scale.CENTER_BOTH,
    },
    scene: [
      createBootScene(PhaserRuntime, sceneKeys.boot, sceneKeys.preload),
      buildPreloadScene(layout, initialSceneOptions, null),
    ],
  });

  return {
    game,
    destroy() {
      game.destroy(true);
    },
    getSelectionOverlayState() {
      const officeScene = game.scene.getScene(sceneKeys.office) as {
        getSelectionOverlayState?: () => ObservatoryCanvasOverlayState | null;
      } | null;
      return officeScene?.getSelectionOverlayState?.() ?? null;
    },
    resize(nextWidth, nextHeight) {
      game.scale.resize(
        Math.max(320, Math.floor(nextWidth)),
        Math.max(320, Math.floor(nextHeight))
      );
    },
    update(nextOptions) {
      if (!officeSceneReady) {
        queuedUpdateOptions = nextOptions;
        return;
      }

      applyUpdate(nextOptions);
    },
    updateSelection(selection) {
      if (!officeSceneReady) {
        queuedSelection = selection;
        return;
      }

      applySelection(selection);
    },
  };
}
