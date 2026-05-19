import { describe, expect, it } from 'vitest';

import type { ObservatoryAssetDefinition } from '@/modules/observatory/engine/assets/assetRegistry';
import type { ObservatoryRoom } from '@/modules/observatory/engine/world/layoutTypes';
import {
  A4_WALL_E,
  A4_WALL_N,
  A4_WALL_S,
  A4_WALL_W,
  createRpgMakerA4WallArchitecturalMockMap,
  getRpgMakerA4WallColorKeyedTextureKey,
  getWallBitmask,
  RPG_MAKER_A4_WALL_ARCHITECTURAL_MATERIALS,
  RPG_MAKER_A4_WALL_ACTIVE_HEIGHT,
  RPG_MAKER_A4_WALL_ACTIVE_WIDTH,
  RPG_MAKER_A4_WALL_BRICK_BLOCK_INDEX,
  RPG_MAKER_A4_WALL_COLOR_KEY_TOLERANCE,
  RPG_MAKER_A4_WALL_WHITE_TOP_BLOCK_INDEX,
  resolveA4WallCeilingQuadrantsForBitmask,
  resolveA4WallDropShadowQuadrantsForBitmask,
  resolveA4WallFaceQuadrantsForBitmask,
  resolveA4WallFaceStackQuadrantsForBitmask,
  resolveObservatoryFloorAutotileFrame,
  resolveObservatoryWallAutotileLayerQuadrants,
  resolveObservatoryWallAutotileQuadrants,
  resolveObservatoryWallAutotileFrame,
} from '@/modules/observatory/engine/rendering/rpgMakerAutotiles';

const room: ObservatoryRoom = {
  bounds: { height: 4, width: 5, x: 10, y: 20 },
  id: 'room:test',
  kind: 'workspace',
  name: 'Test Room',
};

const a2Asset: ObservatoryAssetDefinition = {
  autotile: {
    columns: 16,
    kind: 'rpgmaker-a2-ground',
    set: { height: 3, width: 2, x: 2, y: 3 },
    tileSize: 32,
  },
  category: 'floor',
  frame: 50,
  id: 'floor:test',
  label: 'Test Floor',
  source: { frameHeight: 32, frameWidth: 32, kind: 'spritesheet', uri: '/floor.png' },
};

const a4Asset: ObservatoryAssetDefinition = {
  autotile: {
    columns: 16,
    kind: 'rpgmaker-a4-wall',
    set: { height: 3, width: 2, x: 8, y: 0 },
    tileSize: 32,
  },
  category: 'wall',
  id: 'wall:test',
  label: 'Test Wall',
  source: { frameHeight: 32, frameWidth: 32, kind: 'spritesheet', uri: '/wall.png' },
};

const standardA4WallAsset: ObservatoryAssetDefinition = {
  ...a4Asset,
  autotile: {
    columns: 16,
    kind: 'rpgmaker-a4-wall',
    set: { height: 3, width: 2, x: 0, y: 0 },
    tileSize: 48,
  },
  source: { frameHeight: 48, frameWidth: 48, kind: 'spritesheet', uri: '/wall-48.png' },
};

const walls1A4WallAsset: ObservatoryAssetDefinition = {
  ...a4Asset,
  autotile: {
    columns: 16,
    kind: 'rpgmaker-a4-wall',
    set: { height: 3, width: 2, x: 0, y: 0 },
    sourceLayout: { blockCount: 4, blockWidth: 96, colorKey: '#1a1c2c', faceY: 144, topY: 0, x: 0 },
    tileSize: 48,
  },
  source: { frameHeight: 48, frameWidth: 48, kind: 'spritesheet', uri: '/walls-1.png' },
};

const walls1BrickA4WallAsset: ObservatoryAssetDefinition = {
  ...walls1A4WallAsset,
  autotile: {
    columns: 16,
    kind: 'rpgmaker-a4-wall',
    set: { height: 3, width: 2, x: RPG_MAKER_A4_WALL_BRICK_BLOCK_INDEX * 2, y: 0 },
    sourceLayout: { blockCount: 4, blockWidth: 96, colorKey: '#1a1c2c', faceY: 144, topY: 0, x: 0 },
    tileSize: 48,
  },
  id: 'wall:test-brick',
};

describe('observatory pixel RPG Maker autotile frame selection', () => {
  it('documents the RPG Maker MV A4 wall sheet math', () => {
    expect(RPG_MAKER_A4_WALL_ACTIVE_WIDTH).toBe(768);
    expect(RPG_MAKER_A4_WALL_ACTIVE_HEIGHT).toBe(240);
    expect(RPG_MAKER_A4_WALL_COLOR_KEY_TOLERANCE).toBe(6);
    expect(RPG_MAKER_A4_WALL_BRICK_BLOCK_INDEX).toBe(2);
    expect(RPG_MAKER_A4_WALL_WHITE_TOP_BLOCK_INDEX).toBe(3);
    expect(RPG_MAKER_A4_WALL_ARCHITECTURAL_MATERIALS).toMatchObject({
      2: { blockIndex: 2, height: 2 },
      3: { blockIndex: 3, height: 1 },
    });
  });

  it('uses a stable reviewed A2 floor frame for repeated room floors', () => {
    expect(resolveObservatoryFloorAutotileFrame(a2Asset, room, { x: 10, y: 20 }, 99)).toBe(50);
    expect(resolveObservatoryFloorAutotileFrame(a2Asset, room, { x: 12, y: 20 }, 99)).toBe(50);
    expect(resolveObservatoryFloorAutotileFrame(a2Asset, room, { x: 10, y: 22 }, 99)).toBe(50);
    expect(resolveObservatoryFloorAutotileFrame(a2Asset, room, { x: 12, y: 22 }, 99)).toBe(50);
  });

  it('uses the display tile as the whole-frame fallback for A4 wall sets', () => {
    expect(resolveObservatoryWallAutotileFrame(a4Asset, room, { x: 10, y: 20 }, 99)).toBe(8);
  });

  it('builds A4 wall cells from sub-tile quadrants and respects openings', () => {
    const topLeft = resolveObservatoryWallAutotileQuadrants(a4Asset, room, { x: 10, y: 20 });
    const topEdge = resolveObservatoryWallAutotileQuadrants(a4Asset, room, { x: 11, y: 20 });
    const leftEdge = resolveObservatoryWallAutotileQuadrants(a4Asset, room, { x: 10, y: 21 });
    const openedRoom: ObservatoryRoom = {
      ...room,
      wallOpenings: [{ x: 10, y: 20 }],
    };

    expect(topLeft).toEqual([
      { sourceX: 0, sourceY: 0, targetX: 0, targetY: 0 },
      { sourceX: 1, sourceY: 0, targetX: 1, targetY: 0 },
      { sourceX: 0, sourceY: 3, targetX: 0, targetY: 1 },
      { sourceX: 3, sourceY: 1, targetX: 1, targetY: 1 },
    ]);
    expect(topEdge).toEqual([
      { sourceX: 2, sourceY: 0, targetX: 0, targetY: 0 },
      { sourceX: 1, sourceY: 0, targetX: 1, targetY: 0 },
      { sourceX: 2, sourceY: 5, targetX: 0, targetY: 1 },
      { sourceX: 1, sourceY: 5, targetX: 1, targetY: 1 },
    ]);
    expect(leftEdge).toEqual([
      { sourceX: 0, sourceY: 8, targetX: 0, targetY: 0 },
      { sourceX: 3, sourceY: 8, targetX: 1, targetY: 0 },
      { sourceX: 0, sourceY: 7, targetX: 0, targetY: 1 },
      { sourceX: 3, sourceY: 7, targetX: 1, targetY: 1 },
    ]);
    expect(
      resolveObservatoryWallAutotileQuadrants(a4Asset, openedRoom, { x: 10, y: 20 })
    ).toBeUndefined();
  });

  it('lets room autotiles ignore adjacent cells with another wall id', () => {
    const topLeft = resolveObservatoryWallAutotileQuadrants(
      a4Asset,
      room,
      { x: 10, y: 20 },
      {
        isMatchingWallCell: (point) =>
          isTestRoomPerimeterCell(room, point) && !(point.x === 11 && point.y === 20),
      }
    );

    expect(topLeft).toEqual([
      { sourceX: 0, sourceY: 0, targetX: 0, targetY: 0 },
      { sourceX: 3, sourceY: 0, targetX: 1, targetY: 0 },
      { sourceX: 0, sourceY: 3, targetX: 0, targetY: 1 },
      { sourceX: 3, sourceY: 3, targetX: 1, targetY: 1 },
    ]);
  });

  function isTestRoomPerimeterCell(testRoom: ObservatoryRoom, point: { x: number; y: number }) {
    const minX = testRoom.bounds.x;
    const maxX = testRoom.bounds.x + testRoom.bounds.width - 1;
    const minY = testRoom.bounds.y;
    const maxY = testRoom.bounds.y + testRoom.bounds.height - 1;
    const inside = point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
    const onPerimeter =
      point.x === minX || point.x === maxX || point.y === minY || point.y === maxY;
    return inside && onPerimeter;
  }

  it('slices standard 2x5 A4 wall blocks into roof and wall-side mini-tiles', () => {
    expect(
      resolveObservatoryWallAutotileQuadrants(standardA4WallAsset, room, { x: 10, y: 20 })
    ).toEqual([
      { sourceX: 0, sourceY: 0, targetX: 0, targetY: 0 },
      { sourceX: 1, sourceY: 0, targetX: 1, targetY: 0 },
      { sourceX: 0, sourceY: 3, targetX: 0, targetY: 1 },
      { sourceX: 3, sourceY: 1, targetX: 1, targetY: 1 },
    ]);
    expect(
      resolveObservatoryWallAutotileQuadrants(standardA4WallAsset, room, { x: 10, y: 21 })
    ).toEqual([
      { sourceX: 0, sourceY: 8, targetX: 0, targetY: 0 },
      { sourceX: 3, sourceY: 8, targetX: 1, targetY: 0 },
      { sourceX: 0, sourceY: 7, targetX: 0, targetY: 1 },
      { sourceX: 3, sourceY: 7, targetX: 1, targetY: 1 },
    ]);
  });

  it('supports Walls_1 2x5 A4 blocks with material face rows stored lower in the PNG', () => {
    expect(
      resolveObservatoryWallAutotileQuadrants(walls1A4WallAsset, room, { x: 10, y: 20 })
    ).toEqual([
      { sourceX: 0, sourceY: 0, targetX: 0, targetY: 0 },
      { sourceX: 1, sourceY: 0, targetX: 1, targetY: 0 },
      { sourceX: 0, sourceY: 3, targetX: 0, targetY: 1 },
      { sourceX: 3, sourceY: 1, targetX: 1, targetY: 1 },
    ]);
    expect(
      resolveObservatoryWallAutotileQuadrants(walls1A4WallAsset, room, { x: 10, y: 21 })
    ).toEqual([
      { sourceX: 0, sourceY: 8, targetX: 0, targetY: 0 },
      { sourceX: 3, sourceY: 8, targetX: 1, targetY: 0 },
      { sourceX: 0, sourceY: 7, targetX: 0, targetY: 1 },
      { sourceX: 3, sourceY: 7, targetX: 1, targetY: 1 },
    ]);
  });

  it('computes a standard 8-neighbor wall bitmask with filtered diagonals', () => {
    expect(
      getWallBitmask(
        [
          [0, 1, 0],
          [1, 1, 1],
          [0, 1, 0],
        ],
        1,
        1
      )
    ).toBe(85);
    expect(
      getWallBitmask(
        [
          [1, 1, 1],
          [1, 1, 1],
          [1, 1, 1],
        ],
        1,
        1
      )
    ).toBe(255);
  });

  it('connects only matching non-zero wall ids in numeric wall maps', () => {
    expect(
      getWallBitmask(
        [
          [0, 2, 0],
          [2, 2, 3],
          [0, 3, 0],
        ],
        1,
        1
      )
    ).toBe(65);
    expect(
      getWallBitmask(
        [
          [0, 2, 0],
          [2, 3, 3],
          [0, 3, 0],
        ],
        1,
        1
      )
    ).toBe(20);
  });

  it('can treat matrix boundaries as connected architectural outer walls', () => {
    expect(getWallBitmask([[3]], 0, 0)).toBe(255);
    expect(getWallBitmask([[3]], 0, 0, undefined, { connectOutOfBounds: false })).toBe(0);
  });

  it('builds the requested white perimeter and two-high brick divider mock map', () => {
    expect(
      createRpgMakerA4WallArchitecturalMockMap({ bottomDividerY: 4, columns: 8, rows: 7 })
    ).toEqual([
      [
        { id: 3, height: 1 },
        { id: 3, height: 1 },
        { id: 3, height: 1 },
        { id: 3, height: 1 },
        { id: 3, height: 1 },
        { id: 3, height: 1 },
        { id: 3, height: 1 },
        { id: 3, height: 1 },
      ],
      [{ id: 3, height: 1 }, 0, 0, 0, 0, 0, 0, { id: 3, height: 1 }],
      [{ id: 3, height: 1 }, 0, 0, 0, 0, 0, 0, { id: 3, height: 1 }],
      [{ id: 3, height: 1 }, 0, 0, 0, 0, 0, 0, { id: 3, height: 1 }],
      [
        { id: 3, height: 1 },
        0,
        { id: 2, height: 2 },
        { id: 2, height: 2 },
        { id: 2, height: 2 },
        { id: 2, height: 2 },
        0,
        { id: 3, height: 1 },
      ],
      [{ id: 3, height: 1 }, 0, 0, 0, 0, 0, 0, { id: 3, height: 1 }],
      [
        { id: 3, height: 1 },
        { id: 3, height: 1 },
        { id: 3, height: 1 },
        { id: 3, height: 1 },
        { id: 3, height: 1 },
        { id: 3, height: 1 },
        { id: 3, height: 1 },
        { id: 3, height: 1 },
      ],
    ]);
  });

  it('uses stable color-keyed texture names for preprocessed wall sheets', () => {
    expect(getRpgMakerA4WallColorKeyedTextureKey('wall:office-partition')).toBe(
      'wall:office-partition:colorkey:1a1c2c:t6'
    );
  });

  it('resolves ceiling and face fragments from separate source sections', () => {
    const bitmask = A4_WALL_N | A4_WALL_E | A4_WALL_S | A4_WALL_W;

    expect(
      resolveA4WallCeilingQuadrantsForBitmask(bitmask).every((quadrant) => quadrant.sourceY < 6)
    ).toBe(true);
    expect(
      resolveA4WallFaceQuadrantsForBitmask(bitmask).every((quadrant) => quadrant.sourceY >= 6)
    ).toBe(true);
    expect(resolveA4WallCeilingQuadrantsForBitmask(bitmask)).toEqual([
      { sourceX: 2, sourceY: 2, targetX: 0, targetY: 0 },
      { sourceX: 1, sourceY: 2, targetX: 1, targetY: 0 },
      { sourceX: 2, sourceY: 1, targetX: 0, targetY: 1 },
      { sourceX: 3, sourceY: 1, targetX: 1, targetY: 1 },
    ]);
    expect(
      resolveA4WallCeilingQuadrantsForBitmask(
        getWallBitmask(
          [
            [2, 2, 2],
            [2, 2, 2],
            [2, 2, 2],
          ],
          1,
          1
        )
      )
    ).toEqual([
      { sourceX: 2, sourceY: 4, targetX: 0, targetY: 0 },
      { sourceX: 1, sourceY: 4, targetX: 1, targetY: 0 },
      { sourceX: 2, sourceY: 3, targetX: 0, targetY: 1 },
      { sourceX: 1, sourceY: 3, targetX: 1, targetY: 1 },
    ]);
  });

  it('maps A4 roof quadrants through the full Section A 4x6 micro-grid', () => {
    expect(resolveA4WallCeilingQuadrantsForBitmask(0)).toEqual([
      { sourceX: 0, sourceY: 0, targetX: 0, targetY: 0 },
      { sourceX: 1, sourceY: 0, targetX: 1, targetY: 0 },
      { sourceX: 0, sourceY: 1, targetX: 0, targetY: 1 },
      { sourceX: 1, sourceY: 1, targetX: 1, targetY: 1 },
    ]);
    expect(resolveA4WallCeilingQuadrantsForBitmask(A4_WALL_N | A4_WALL_W)).toContainEqual({
      sourceX: 2,
      sourceY: 2,
      targetX: 0,
      targetY: 0,
    });
    expect(resolveA4WallCeilingQuadrantsForBitmask(A4_WALL_N | A4_WALL_W | A4_WALL_E)).toEqual([
      { sourceX: 2, sourceY: 2, targetX: 0, targetY: 0 },
      { sourceX: 1, sourceY: 2, targetX: 1, targetY: 0 },
      { sourceX: 2, sourceY: 5, targetX: 0, targetY: 1 },
      { sourceX: 1, sourceY: 5, targetX: 1, targetY: 1 },
    ]);
    expect(resolveA4WallCeilingQuadrantsForBitmask(255)).toEqual([
      { sourceX: 2, sourceY: 4, targetX: 0, targetY: 0 },
      { sourceX: 1, sourceY: 4, targetX: 1, targetY: 0 },
      { sourceX: 2, sourceY: 3, targetX: 0, targetY: 1 },
      { sourceX: 1, sourceY: 3, targetX: 1, targetY: 1 },
    ]);
  });

  it('uses the Section A ceiling cap for the brick partition block', () => {
    const expectedSectionACap = [
      { sourceX: 0, sourceY: 0, targetX: 0, targetY: 0 },
      { sourceX: 1, sourceY: 0, targetX: 1, targetY: 0 },
      { sourceX: 0, sourceY: 1, targetX: 0, targetY: 1 },
      { sourceX: 1, sourceY: 1, targetX: 1, targetY: 1 },
    ];

    expect(
      resolveObservatoryWallAutotileLayerQuadrants(walls1BrickA4WallAsset, room, {
        x: 10,
        y: 20,
      })?.ceilingQuadrants
    ).toEqual(expectedSectionACap);
  });

  it('adds a right-side A4 shadow strip when a vertical wall opens to floor on the east', () => {
    expect(resolveA4WallDropShadowQuadrantsForBitmask(A4_WALL_N | A4_WALL_S)).toEqual([
      { sourceX: 3, sourceY: 8, targetX: 2, targetY: 0 },
      { sourceX: 3, sourceY: 7, targetX: 2, targetY: 1 },
    ]);
    expect(resolveA4WallDropShadowQuadrantsForBitmask(A4_WALL_N | A4_WALL_S | A4_WALL_E)).toEqual(
      []
    );
  });

  it('uses the A4 wall-side table for stacked face cells', () => {
    const bitmask = getWallBitmask(
      [
        [0, 2, 0],
        [2, 2, 2],
        [0, 0, 0],
      ],
      1,
      1
    );

    expect(resolveA4WallFaceStackQuadrantsForBitmask(bitmask, 0)).toEqual([
      { sourceX: 2, sourceY: 8, targetX: 0, targetY: 0 },
      { sourceX: 1, sourceY: 8, targetX: 1, targetY: 0 },
      { sourceX: 2, sourceY: 9, targetX: 0, targetY: 1 },
      { sourceX: 1, sourceY: 9, targetX: 1, targetY: 1 },
    ]);
    expect(resolveA4WallFaceStackQuadrantsForBitmask(bitmask, 1)).toEqual([
      { sourceX: 2, sourceY: 8, targetX: 0, targetY: 0 },
      { sourceX: 1, sourceY: 8, targetX: 1, targetY: 0 },
      { sourceX: 2, sourceY: 9, targetX: 0, targetY: 1 },
      { sourceX: 1, sourceY: 9, targetX: 1, targetY: 1 },
    ]);
  });

  it('falls back for non-autotile assets', () => {
    expect(resolveObservatoryFloorAutotileFrame(undefined, room, { x: 10, y: 20 }, 99)).toBe(99);
    expect(resolveObservatoryWallAutotileFrame(undefined, room, { x: 10, y: 20 }, 99)).toBe(99);
  });
});
