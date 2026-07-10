import type Phaser from 'phaser';

type PhaserRuntime = typeof Phaser;

export function createBootScene(
  PhaserRuntime: PhaserRuntime,
  sceneKey = 'BootScene',
  preloadSceneKey = 'PreloadScene'
) {
  return class BootScene extends PhaserRuntime.Scene {
    constructor() {
      super(sceneKey);
    }

    create() {
      this.scene.start(preloadSceneKey);
    }
  };
}
