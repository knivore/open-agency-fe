import type Phaser from 'phaser';

import {
  createObservatoryCharacterActionAnimationKey,
  OBSERVATORY_FALLBACK_TEXTURE_KEY,
  type ObservatoryAssetAnimation,
  type ObservatoryAssetDefinition,
  type ObservatoryValidatedAssetRegistry,
} from '@/modules/observatory/engine/assets/assetRegistry';

export function loadObservatoryRegistryAssets(
  scene: Phaser.Scene,
  registry: ObservatoryValidatedAssetRegistry
) {
  for (const asset of registry.assets) {
    loadAsset(scene, asset);
  }
}

export function createObservatoryRegistryAnimations(
  scene: Phaser.Scene,
  registry: ObservatoryValidatedAssetRegistry
) {
  for (const asset of registry.assets) {
    if (asset.source.kind !== 'spritesheet') {
      continue;
    }

    for (const animation of getAssetAnimations(asset)) {
      if (scene.anims.exists(animation.key)) {
        continue;
      }

      scene.anims.create({
        key: animation.key,
        frames: scene.anims.generateFrameNumbers(asset.id, {
          start: animation.startFrame,
          end: animation.endFrame,
        }),
        frameRate: animation.frameRate,
        repeat: animation.repeat ?? -1,
      });
    }
  }
}

export function ensureObservatoryFallbackTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(OBSERVATORY_FALLBACK_TEXTURE_KEY)) {
    return;
  }

  const texture = scene.textures.createCanvas(OBSERVATORY_FALLBACK_TEXTURE_KEY, 32, 32);

  if (!texture) {
    return;
  }

  const context = texture.getContext();
  context.fillStyle = '#111827';
  context.fillRect(0, 0, 32, 32);
  context.fillStyle = '#f43f5e';
  context.fillRect(0, 0, 16, 16);
  context.fillRect(16, 16, 16, 16);
  context.strokeStyle = '#f8fafc';
  context.lineWidth = 2;
  context.strokeRect(1, 1, 30, 30);
  texture.refresh();
}

function loadAsset(scene: Phaser.Scene, asset: ObservatoryAssetDefinition) {
  if (scene.textures.exists(asset.id)) {
    return;
  }

  if (asset.source.kind === 'spritesheet') {
    scene.load.spritesheet(asset.id, asset.source.uri, {
      frameWidth: asset.source.frameWidth ?? 16,
      frameHeight: asset.source.frameHeight ?? 16,
    });
    return;
  }

  scene.load.image(asset.id, asset.source.uri);
}

function getAssetAnimations(asset: ObservatoryAssetDefinition): ObservatoryAssetAnimation[] {
  const baseAnimations = [asset.animation, ...(asset.animations ?? [])].filter(
    (animation): animation is ObservatoryAssetAnimation => Boolean(animation)
  );
  const characterActionAnimations =
    asset.characterActions?.map((action) => ({
      endFrame: action.loopEndFrame ?? action.endFrame,
      frameRate: action.frameRate ?? 6,
      key: createObservatoryCharacterActionAnimationKey(asset.id, action.action, action.direction),
      repeat: action.playOnce ? 0 : -1,
      startFrame: action.loopStartFrame ?? action.startFrame,
    })) ?? [];

  return [...baseAnimations, ...characterActionAnimations];
}
