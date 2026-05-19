import { describe, expect, it } from 'vitest';

import {
  generateObservatoryLayoutFromPrompt,
  parseObservatoryLayoutPrompt,
  validateObservatoryPromptLayout,
} from '@/modules/observatory/generation/promptToLayout';
import { validateObservatoryLayout } from '@/modules/observatory/engine/world/layoutValidation';
import type { ObservatoryLayoutDocument } from '@/modules/observatory/engine/world/layoutTypes';
import sampleLayout from '@/modules/observatory/engine/world/sampleLayout.json';

function layout(): ObservatoryLayoutDocument {
  const validation = validateObservatoryLayout(JSON.parse(JSON.stringify(sampleLayout)));
  if (!validation.layout) {
    throw new Error('Sample layout must be valid for prompt generation tests.');
  }

  return validation.layout;
}

describe('observatory pixel prompt-to-layout generation', () => {
  it('parses prompt keywords into room template intent', () => {
    expect(parseObservatoryLayoutPrompt('Create an engineering pod, finance room, and approval review gate')).toMatchObject({
      includeCorridor: true,
      includeDoors: true,
      templateIds: ['engineering-pod', 'finance-room', 'approval-room'],
    });
  });

  it('falls back to a useful default layout plan', () => {
    expect(parseObservatoryLayoutPrompt('make an office')).toMatchObject({
      templateIds: ['engineering-pod', 'ops-center', 'meeting-room'],
    });
  });

  it('generates valid editable office layout JSON from a prompt', () => {
    const result = generateObservatoryLayoutFromPrompt(layout(), 'Build a full operations office with research, audit, approvals, and meetings');

    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.layout?.world.maps[0]?.rooms.map((room) => room.name)).toEqual(
      expect.arrayContaining(['Research Room', 'Audit Workspace', 'Approval Room', 'Meeting Room', 'Main Corridor']),
    );
    expect(result.layout?.world.maps[0]?.objects.some((object) => object.id.startsWith('object:door-'))).toBe(true);
  });

  it('validates generated layouts with schema and procedural rules', () => {
    const result = generateObservatoryLayoutFromPrompt(layout(), 'engineering and ops command center');

    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.layout).toBeDefined();
    expect(validateObservatoryPromptLayout(result.layout!).valid).toBe(true);
  });

  it('reports invalid prompt layouts', () => {
    const invalidLayout = layout();
    invalidLayout.world.maps[0]!.objects.push({
      assetId: 'furniture:1-modern-office-singles-48x48:modern-office-gray-runtime-server-tower',
      blocksMovement: true,
      id: 'object:bad-overlap',
      position: { x: 4, y: 5 },
      roomId: 'room:runtime-floor',
      size: { height: 1, width: 1 },
    });

    expect(validateObservatoryPromptLayout(invalidLayout).valid).toBe(false);
  });
});
