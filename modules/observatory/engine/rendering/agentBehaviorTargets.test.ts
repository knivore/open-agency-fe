import { describe, expect, it } from 'vitest';

import {
  classifyObservatoryObjectBehaviorRole,
  isObservatoryGridWalkable,
  pickObservatoryAgentBehaviorTargetPoint,
  pickObservatoryObjectAdjacentWalkablePoint,
} from '@/modules/observatory/engine/rendering/agentBehaviorTargets';
import type { ObservatoryAssetDefinition } from '@/modules/observatory/engine/assets/assetRegistry';
import type { ObservatoryMap } from '@/modules/observatory/engine/world/layoutTypes';

describe('observatory pixel agent behavior targets', () => {
  it('sends planning agents to a whiteboard-adjacent tile', () => {
    const map: ObservatoryMap = {
      agents: [
        {
          assetId: 'human:atlas',
          id: 'agent:atlas',
          name: 'Atlas',
          position: { x: 2, y: 6 },
          roomId: 'room:planning',
          runtime: { behavior: 'planning' },
          status: 'working',
        },
      ],
      defaultFloorAssetId: 'floor:default',
      id: 'map:test',
      name: 'Test',
      objects: [
        {
          assetId: 'furniture:whiteboard',
          blocksMovement: true,
          id: 'object:whiteboard',
          position: { x: 4, y: 2 },
          roomId: 'room:planning',
          size: { height: 2, width: 2 },
        },
      ],
      rooms: [
        {
          bounds: { height: 8, width: 10, x: 0, y: 0 },
          id: 'room:planning',
          kind: 'workspace',
          name: 'Planning',
        },
      ],
      size: { height: 8, width: 10 },
    };

    const target = pickObservatoryAgentBehaviorTargetPoint(map, {
      agentId: 'agent:atlas',
      seed: 'stable',
      targetRoomId: 'room:planning',
    });

    expect(target).not.toEqual({ x: 4, y: 2 });
    expect(target).not.toEqual({ x: 5, y: 2 });
    expect(target).toEqual(
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
    );
  });

  it('classifies manifest-style office assets into behavior target roles', () => {
    expect(
      classifyObservatoryObjectBehaviorRole(
        'furniture:1-modern-office-singles-48x48:compact-gray-laptop'
      )
    ).toBe('computer');
    expect(
      classifyObservatoryObjectBehaviorRole(
        'furniture:1-modern-office-singles-48x48:server-workbench-with-tools'
      )
    ).toBe('runtime');
    expect(
      classifyObservatoryObjectBehaviorRole(
        'furniture:1-modern-office-singles-48x48:planning-whiteboard-chart'
      )
    ).toBe('planning');
  });

  it('uses the full object perimeter when the four cardinal interaction tiles are blocked', () => {
    const map: ObservatoryMap = {
      agents: [],
      defaultFloorAssetId: 'floor:default',
      id: 'map:test',
      name: 'Test',
      objects: [
        {
          assetId: 'furniture:wide-desk',
          blocksMovement: true,
          id: 'object:wide-desk',
          position: { x: 2, y: 2 },
          roomId: 'room:test',
          size: { height: 2, width: 3 },
        },
        ...[
          { x: 3, y: 4 },
          { x: 3, y: 1 },
          { x: 1, y: 3 },
          { x: 5, y: 3 },
        ].map((position, index) => ({
          assetId: `furniture:blocker-${index}`,
          blocksMovement: true,
          id: `object:blocker-${index}`,
          position,
          roomId: 'room:test',
          size: { height: 1, width: 1 },
        })),
      ],
      rooms: [
        {
          bounds: { height: 8, width: 8, x: 0, y: 0 },
          id: 'room:test',
          kind: 'workspace',
          name: 'Test',
        },
      ],
      size: { height: 8, width: 8 },
    };

    const target = pickObservatoryObjectAdjacentWalkablePoint(map, map.objects[0]!, {
      fromPoint: { x: 6, y: 5 },
      seed: 'stable',
    });

    expect(target).toEqual({ x: 2, y: 4 });
  });

  it('rejects walkable points that sit outside every room interior', () => {
    const map: ObservatoryMap = {
      agents: [],
      defaultFloorAssetId: 'floor:default',
      id: 'map:test',
      name: 'Test',
      objects: [],
      rooms: [
        {
          bounds: { height: 6, width: 6, x: 1, y: 1 },
          id: 'room:left',
          kind: 'workspace',
          name: 'Left',
        },
        {
          bounds: { height: 6, width: 6, x: 10, y: 1 },
          id: 'room:right',
          kind: 'workspace',
          name: 'Right',
        },
      ],
      size: { height: 12, width: 20 },
    };

    expect(isObservatoryGridWalkable(map, { x: 3, y: 4 })).toBe(true);
    expect(isObservatoryGridWalkable(map, { x: 8, y: 4 })).toBe(false);
  });

  it('uses asset collision metadata inside the larger layout render footprint', () => {
    const assetsById = new Map<string, ObservatoryAssetDefinition>([
      [
        'furniture:manifest-backed-chair',
        {
          category: 'furniture',
          collision: { height: 2, offsetY: 1, width: 1 },
          height: 144,
          id: 'furniture:manifest-backed-chair',
          label: 'Manifest-backed Chair',
          source: { kind: 'image', uri: '/chair.png' },
          width: 96,
        },
      ],
    ]);
    const map: ObservatoryMap = {
      agents: [],
      defaultFloorAssetId: 'floor:default',
      id: 'map:test',
      name: 'Test',
      objects: [
        {
          assetId: 'furniture:manifest-backed-chair',
          blocksMovement: true,
          id: 'object:chair',
          position: { x: 3, y: 3 },
          roomId: 'room:test',
          size: { height: 3, width: 2 },
        },
      ],
      rooms: [
        {
          bounds: { height: 8, width: 8, x: 0, y: 0 },
          id: 'room:test',
          kind: 'workspace',
          name: 'Test',
        },
      ],
      size: { height: 8, width: 8 },
    };

    expect(isObservatoryGridWalkable(map, { x: 3, y: 3 }, assetsById)).toBe(true);
    expect(isObservatoryGridWalkable(map, { x: 4, y: 3 }, assetsById)).toBe(true);
    expect(isObservatoryGridWalkable(map, { x: 3, y: 4 }, assetsById)).toBe(false);
    expect(isObservatoryGridWalkable(map, { x: 3, y: 5 }, assetsById)).toBe(false);
    expect(isObservatoryGridWalkable(map, { x: 4, y: 5 }, assetsById)).toBe(true);
  });
});
