import { describe, expect, it } from 'vitest';

import { setupObservatorySceneInteractions } from '@/modules/observatory/engine/rendering/sceneInteractionControls';
import type { ObservatoryMap } from '@/modules/observatory/engine/world/layoutTypes';

type SceneEventName = 'gameout' | 'pointerdown' | 'pointermove' | 'pointerup' | 'wheel';

function createSceneHarness() {
  const handlers = new Map<SceneEventName, (pointer: FakePointer) => void>();
  const textUpdates: string[] = [];
  const camera = {
    height: 320,
    getBounds: () => ({
      height: 900,
      width: 900,
      x: -120,
      y: -80,
    }),
    scrollX: 100,
    scrollY: 100,
    setZoom(nextZoom: number) {
      this.zoom = nextZoom;
    },
    width: 320,
    zoom: 1,
  };
  const scene = {
    add: {
      graphics: () => ({
        clear: () => undefined,
        fillRect: () => undefined,
        fillRoundedRect: () => undefined,
        fillStyle: () => undefined,
        lineStyle: () => undefined,
        setDepth: () => ({
          clear: () => undefined,
          fillRect: () => undefined,
          fillRoundedRect: () => undefined,
          fillStyle: () => undefined,
          lineStyle: () => undefined,
          strokeRect: () => undefined,
          strokeRoundedRect: () => undefined,
        }),
        strokeRect: () => undefined,
        strokeRoundedRect: () => undefined,
      }),
      text: (_x: number, _y: number, text: string) => {
        textUpdates.push(text);
        return {
          setDepth: () => ({
            setText: (nextText: string) => textUpdates.push(nextText),
          }),
          setText: (nextText: string) => textUpdates.push(nextText),
        };
      },
      zone: () => ({
        destroy: () => undefined,
        on: () => ({
          setDepth: () => undefined,
        }),
        setDepth: () => ({
          on: () => undefined,
        }),
        setInteractive: () => ({
          setDepth: () => ({
            on: () => undefined,
          }),
        }),
        setOrigin: () => ({
          setInteractive: () => ({
            setDepth: () => ({
              on: () => undefined,
            }),
          }),
        }),
      }),
    },
    cameras: {
      main: camera,
    },
    events: {
      emit: () => undefined,
    },
    input: {
      on: (eventName: SceneEventName, handler: (pointer: FakePointer) => void) => {
        handlers.set(eventName, handler);
      },
    },
  };

  return {
    camera,
    handlers,
    scene,
    textUpdates,
  };
}

const map = {
  size: {
    height: 50,
    width: 50,
  },
} as ObservatoryMap;

const renderedMap = {
  getSelectedAgentId: () => null,
  getSelectedRoomId: () => null,
  moveSelectedAgentToGrid: () => undefined,
  selectAtWorldPoint: () => false,
  setWallEditHover: () => undefined,
};

interface FakePointer {
  deltaY: number;
  position: { x: number; y: number };
  prevPosition: { x: number; y: number };
  primaryDown: boolean;
  updateWorldPoint: () => void;
  upTime: number;
  worldX: number;
  worldY: number;
}

function createPointer(overrides: Partial<FakePointer> = {}): FakePointer {
  return {
    deltaY: -120,
    position: { x: 120, y: 120 },
    prevPosition: { x: 90, y: 90 },
    primaryDown: true,
    updateWorldPoint: () => undefined,
    upTime: 0,
    worldX: 120,
    worldY: 120,
    ...overrides,
  };
}

describe('setupObservatorySceneInteractions', () => {
  it('ignores drag panning and wheel zooming when camera controls are locked', () => {
    const harness = createSceneHarness();

    setupObservatorySceneInteractions(harness.scene as never, {
      allowPan: false,
      allowZoom: false,
      grid: { tileSize: 16 },
      map,
      renderedMap: renderedMap as never,
      showDebugCoordinates: false,
    });

    harness.handlers.get('pointermove')?.(createPointer());
    harness.handlers.get('wheel')?.(createPointer());

    expect(harness.camera.scrollX).toBe(100);
    expect(harness.camera.scrollY).toBe(100);
    expect(harness.camera.zoom).toBe(1);
    expect(harness.textUpdates).toHaveLength(0);
  });

  it('keeps drag panning and wheel zooming active when controls are enabled', () => {
    const harness = createSceneHarness();

    setupObservatorySceneInteractions(harness.scene as never, {
      allowPan: true,
      allowZoom: true,
      grid: { tileSize: 16 },
      map,
      renderedMap: renderedMap as never,
      showDebugCoordinates: true,
    });

    harness.handlers.get('pointermove')?.(createPointer());
    harness.handlers.get('wheel')?.(createPointer());

    expect(harness.camera.scrollX).toBe(70);
    expect(harness.camera.scrollY).toBe(70);
    expect(harness.camera.zoom).toBeCloseTo(1.045);
    expect(harness.textUpdates.at(-1)).toBe('grid: -, - | zoom: 1.04');
  });

  it('clamps panning against the active camera bounds instead of zero-based world bounds', () => {
    const harness = createSceneHarness();

    setupObservatorySceneInteractions(harness.scene as never, {
      allowPan: true,
      allowZoom: false,
      grid: { tileSize: 16 },
      map,
      renderedMap: renderedMap as never,
      showDebugCoordinates: false,
    });

    harness.camera.scrollX = -110;
    harness.camera.scrollY = -70;
    harness.handlers.get('pointermove')?.(
      createPointer({
        position: { x: 160, y: 160 },
        prevPosition: { x: 90, y: 90 },
      })
    );

    expect(harness.camera.scrollX).toBe(-120);
    expect(harness.camera.scrollY).toBe(-80);
  });

  it('selects inspectable rendered entities from pointer-up world coordinates', () => {
    const harness = createSceneHarness();
    const selectedPoints: Array<{ x: number; y: number }> = [];

    setupObservatorySceneInteractions(harness.scene as never, {
      allowPan: true,
      allowZoom: false,
      grid: { tileSize: 16 },
      map,
      onGridClick: () => {
        throw new Error('grid click should not run after selecting an inspectable entity');
      },
      renderedMap: {
        ...renderedMap,
        selectAtWorldPoint: (point: { x: number; y: number }) => {
          selectedPoints.push(point);
          return true;
        },
      } as never,
      showDebugCoordinates: false,
    });

    harness.handlers.get('pointerup')?.(
      createPointer({
        primaryDown: false,
        upTime: 10,
        worldX: 48,
        worldY: 64,
      })
    );

    expect(selectedPoints).toEqual([{ x: 48, y: 64 }]);
  });
});
