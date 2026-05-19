import { describe, expect, it } from 'vitest';

import {
  findObservatoryCollisionSafePlacement,
  generateObservatoryDoorObjects,
  validateObservatoryCollisionSafety,
  validateObservatoryDeskSpacing,
  validateObservatoryGeneratedLayout,
  validateObservatoryWalkability,
} from '@/modules/observatory/generation/proceduralLayoutRules';
import { validateObservatoryLayout } from '@/modules/observatory/engine/world/layoutValidation';
import type { ObservatoryMap } from '@/modules/observatory/engine/world/layoutTypes';
import sampleLayout from '@/modules/observatory/engine/world/sampleLayout.json';

function map(): ObservatoryMap {
  const validation = validateObservatoryLayout(JSON.parse(JSON.stringify(sampleLayout)));
  const layout = validation.layout;

  if (!layout) {
    throw new Error('Sample layout must be valid for procedural rules tests.');
  }

  return layout.world.maps[0]!;
}

describe('observatory pixel procedural layout rules', () => {
  it('validates desk spacing on the sample map', () => {
    expect(validateObservatoryDeskSpacing(map())).toEqual({ issues: [], valid: true });
  });

  it('reports desks with insufficient spacing', () => {
    const testMap = map();
    testMap.objects.push({
      assetId: 'furniture:ops-workstation',
      blocksMovement: true,
      id: 'object:too-close-desk',
      position: { x: 6, y: 5 },
      roomId: 'room:runtime-floor',
      size: { height: 1, width: 2 },
    });

    expect(validateObservatoryDeskSpacing(testMap).valid).toBe(false);
  });

  it('generates one non-blocking door object per non-corridor room', () => {
    expect(generateObservatoryDoorObjects(map())).toMatchObject([
      {
        assetId: 'floor:office-gray',
        blocksMovement: false,
        id: 'object:door-runtime-floor-5',
        roomId: 'room:runtime-floor',
      },
      {
        id: 'object:door-workflow-pod-5',
        roomId: 'room:workflow-pod',
      },
      {
        id: 'object:door-commons-5',
        roomId: 'room:commons',
      },
    ]);
  });

  it('validates walkability on the sample map', () => {
    expect(validateObservatoryWalkability(map())).toEqual({ issues: [], valid: true });
  });

  it('finds a collision-safe placement and reports blocking overlaps', () => {
    const testMap = map();

    expect(findObservatoryCollisionSafePlacement(testMap, { height: 1, width: 2 }, { x: 4, y: 5 })).toEqual({ x: 0, y: 0 });

    testMap.objects.push({
      assetId: 'furniture:1-modern-office-singles-48x48:modern-office-gray-runtime-server-tower',
      blocksMovement: true,
      id: 'object:overlap',
      position: { x: 4, y: 5 },
      roomId: 'room:runtime-floor',
      size: { height: 1, width: 1 },
    });

    expect(validateObservatoryCollisionSafety(testMap).valid).toBe(false);
  });

  it('combines procedural validations for generated layouts', () => {
    expect(validateObservatoryGeneratedLayout(map())).toEqual({ issues: [], valid: true });
  });
});
