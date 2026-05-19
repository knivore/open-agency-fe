import type Phaser from 'phaser';

import type { ObservatoryAgent } from '@/modules/observatory/engine/world/layoutTypes';

export interface ObservatoryAgentInspector {
  showAgent(agent: ObservatoryAgent): void;
}

export function createObservatoryAgentInspector(scene: Phaser.Scene): ObservatoryAgentInspector {
  const panel = scene.add.rectangle(16, 244, 320, 132, 0x0f172a, 0.92).setOrigin(0).setDepth(60);
  panel.setStrokeStyle(1, 0x38bdf8, 0.45);

  const body = scene.add
    .text(32, 264, 'Agent Inspector\nSelect an agent.', {
      color: '#cbd5e1',
      fontFamily: 'monospace',
      fontSize: '12px',
      lineSpacing: 4,
    })
    .setDepth(61);

  return {
    showAgent(agent) {
      body.setText([
        'Agent Inspector',
        `id: ${agent.id}`,
        `name: ${agent.name}`,
        `asset: ${agent.assetId}`,
        `room: ${agent.roomId ?? 'unassigned'}`,
        `status: ${agent.status}`,
      ]);
    },
  };
}
