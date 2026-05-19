import type Phaser from 'phaser';

import type { ObservatoryObject } from '@/modules/observatory/engine/world/layoutTypes';

export interface ObservatoryObjectInspector {
  showObject(object: ObservatoryObject): void;
}

export function createObservatoryObjectInspector(scene: Phaser.Scene): ObservatoryObjectInspector {
  const panel = scene.add.rectangle(16, 96, 320, 132, 0x0f172a, 0.92).setOrigin(0).setDepth(60);
  panel.setStrokeStyle(1, 0x94a3b8, 0.45);

  const body = scene.add
    .text(32, 116, 'Object Inspector\nSelect a furniture/decor object.', {
      color: '#cbd5e1',
      fontFamily: 'monospace',
      fontSize: '12px',
      lineSpacing: 4,
    })
    .setDepth(61);

  return {
    showObject(object) {
      body.setText([
        'Object Inspector',
        `id: ${object.id}`,
        `asset: ${object.assetId}`,
        `room: ${object.roomId ?? 'unassigned'}`,
        `grid: ${object.position.x}, ${object.position.y}`,
        `blocks: ${object.blocksMovement ? 'yes' : 'no'}`,
      ]);
    },
  };
}
