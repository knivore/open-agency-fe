import type Phaser from 'phaser';

import { filterObservatoryRegistryForMap } from '@/modules/observatory/engine/assets/assetUsage';
import { getObservatoryFullModuleAssetRegistry } from '@/modules/observatory/engine/assets/moduleFullAssetRegistry';
import {
  createObservatoryRegistryAnimations,
  ensureObservatoryFallbackTexture,
  loadObservatoryRegistryAssets,
} from '@/modules/observatory/engine/assets/phaserAssetLoader';
import { preprocessRpgMakerA4WallTextures } from '@/modules/observatory/engine/rendering/rpgMakerAutotiles';
import sampleLayout from '@/modules/observatory/engine/world/sampleLayout.json';
import { validateObservatoryLayout } from '@/modules/observatory/engine/world/layoutValidation';
import type { ObservatoryLayoutDocument } from '@/modules/observatory/engine/world/layoutTypes';

type PhaserRuntime = typeof Phaser;

export function createPreloadScene(
  PhaserRuntime: PhaserRuntime,
  layout: ObservatoryLayoutDocument = sampleLayout as ObservatoryLayoutDocument,
  sceneKey = 'PreloadScene',
  officeSceneKey = 'OfficeScene',
  officeScene?: new () => Phaser.Scene
) {
  return class PreloadScene extends PhaserRuntime.Scene {
    constructor() {
      super(sceneKey);
    }

    preload() {
      const registry = getObservatoryFullModuleAssetRegistry();
      const validatedLayout = validateObservatoryLayout(layout);
      const map = validatedLayout.layout?.world.maps[0];
      const assetsToLoad = map ? filterObservatoryRegistryForMap(registry, map) : registry;

      if (registry.invalidAssets.length > 0) {
        console.warn('[observatory] skipped invalid registry assets', registry.invalidAssets);
      }

      loadObservatoryRegistryAssets(this, assetsToLoad);
    }

    create() {
      ensureObservatoryFallbackTexture(this);
      const registry = getObservatoryFullModuleAssetRegistry();
      const validatedLayout = validateObservatoryLayout(layout);
      const map = validatedLayout.layout?.world.maps[0];
      const assetsToCreate = map ? filterObservatoryRegistryForMap(registry, map) : registry;
      preprocessRpgMakerA4WallTextures(this, assetsToCreate);
      createObservatoryRegistryAnimations(this, assetsToCreate);
      if (officeScene) {
        const existingOfficeScene = (
          this.scene.manager as unknown as { keys?: Record<string, Phaser.Scene> }
        ).keys?.[officeSceneKey];

        if (existingOfficeScene) {
          this.scene.start(officeSceneKey);
          return;
        }

        this.scene.add(officeSceneKey, officeScene, true);
        return;
      }

      this.scene.start(officeSceneKey);
    }
  };
}
