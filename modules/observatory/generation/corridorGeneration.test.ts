import { describe, expect, it } from 'vitest';

import {
  generateObservatoryCorridorBounds,
  generateObservatoryCorridorRoom,
} from '@/modules/observatory/generation/corridorGeneration';
import { validateObservatoryLayout } from '@/modules/observatory/engine/world/layoutValidation';
import sampleLayout from '@/modules/observatory/engine/world/sampleLayout.json';

function map() {
  const validation = validateObservatoryLayout(sampleLayout);
  const layout = validation.layout;

  if (!layout) {
    throw new Error('Sample layout must be valid for corridor generation tests.');
  }

  return layout.world.maps[0]!;
}

describe('observatory pixel corridor generation', () => {
  it('finds the first open horizontal corridor row in the sample map', () => {
    expect(generateObservatoryCorridorBounds(map())).toEqual({
      height: 1,
      width: 40,
      x: 1,
      y: 0,
    });
  });

  it('creates a valid commons corridor room with default floor metadata', () => {
    expect(
      generateObservatoryCorridorRoom(map(), {
        id: 'room:corridor-main',
        wallAssetId: 'wall:office-partition',
        y: 13,
      })
    ).toEqual({
      bounds: { height: 1, width: 40, x: 1, y: 13 },
      floorAssetId: 'floor:office-blue',
      id: 'room:corridor-main',
      kind: 'commons',
      name: 'Main Corridor',
      wallAssetId: 'wall:office-partition',
    });
  });
});
