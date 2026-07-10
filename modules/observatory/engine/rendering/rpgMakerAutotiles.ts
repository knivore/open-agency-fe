import type Phaser from 'phaser';

import type { ObservatoryAssetDefinition } from '@/modules/observatory/engine/assets/assetRegistry';
import type { ObservatoryRoom } from '@/modules/observatory/engine/world/layoutTypes';

export const RPG_MAKER_A4_WALL_TILE_SIZE = 48;
export const RPG_MAKER_A4_WALL_HALF_TILE_SIZE = 24;
export const RPG_MAKER_A4_WALL_BLOCK_WIDTH = 96;
export const RPG_MAKER_A4_WALL_BLOCK_COUNT = 8;
export const RPG_MAKER_A4_WALL_BLOCK_TILE_ROWS = 5;
export const RPG_MAKER_A4_WALL_TOP_SECTION_TILE_ROWS = 3;
export const RPG_MAKER_A4_WALL_FACE_SECTION_TILE_ROWS = 2;
export const RPG_MAKER_A4_WALL_TOP_SECTION_MINI_ROWS = RPG_MAKER_A4_WALL_TOP_SECTION_TILE_ROWS * 2;
export const RPG_MAKER_A4_WALL_ACTIVE_WIDTH =
  RPG_MAKER_A4_WALL_BLOCK_WIDTH * RPG_MAKER_A4_WALL_BLOCK_COUNT;
export const RPG_MAKER_A4_WALL_ACTIVE_HEIGHT =
  RPG_MAKER_A4_WALL_TILE_SIZE * RPG_MAKER_A4_WALL_BLOCK_TILE_ROWS;
export const RPG_MAKER_A4_WALL_COLOR_KEY = '#1a1c2c';
export const RPG_MAKER_A4_WALL_COLOR_KEY_TOLERANCE = 6;
export const RPG_MAKER_A4_WALL_BRICK_BLOCK_INDEX = 2;
export const RPG_MAKER_A4_WALL_WHITE_TOP_BLOCK_INDEX = 3;
export const RPG_MAKER_A4_WALL_TOP_SECTION_Y = 0;
export const RPG_MAKER_A4_WALL_FACE_SECTION_Y =
  RPG_MAKER_A4_WALL_TILE_SIZE * RPG_MAKER_A4_WALL_TOP_SECTION_TILE_ROWS;
export const RPG_MAKER_A4_WALL_LEGACY_WHITE_PERIMETER_ID = 1;
export const RPG_MAKER_A4_WALL_WHITE_PERIMETER_ID = 3;
export const RPG_MAKER_A4_WALL_BRICK_DIVIDER_ID = 2;
const PHASER_TEXTURE_FILTER_NEAREST = 1;

export const A4_WALL_N = 1;
export const A4_WALL_NE = 2;
export const A4_WALL_E = 4;
export const A4_WALL_SE = 8;
export const A4_WALL_S = 16;
export const A4_WALL_SW = 32;
export const A4_WALL_W = 64;
export const A4_WALL_NW = 128;

export type RpgMakerA4WallCeilingMode = 'roof' | 'solid-partition';

type A4WallMiniTileCoordinate = readonly [sourceX: number, sourceY: number];

interface A4WallRoofQuadrantRule {
  diagonalBit: number;
  fill: A4WallMiniTileCoordinate;
  horizontalBit: number;
  horizontalEdge: A4WallMiniTileCoordinate;
  inner: A4WallMiniTileCoordinate;
  outer: A4WallMiniTileCoordinate;
  targetX: 0 | 1;
  targetY: 0 | 1;
  verticalEdge: A4WallMiniTileCoordinate;
  verticalBit: number;
}

interface A4WallSideQuadrantRule {
  both: A4WallMiniTileCoordinate;
  horizontalBit: number;
  horizontalEdge: A4WallMiniTileCoordinate;
  neither: A4WallMiniTileCoordinate;
  targetX: 0 | 1;
  targetY: 0 | 1;
  verticalBit: number;
  verticalEdge: A4WallMiniTileCoordinate;
}

const A4_WALL_ROOF_QUADRANT_RULES: A4WallRoofQuadrantRule[] = [
  {
    diagonalBit: A4_WALL_NW,
    fill: [2, 4],
    horizontalBit: A4_WALL_W,
    horizontalEdge: [2, 0],
    inner: [2, 2],
    outer: [0, 0],
    targetX: 0,
    targetY: 0,
    verticalEdge: [0, 4],
    verticalBit: A4_WALL_N,
  },
  {
    diagonalBit: A4_WALL_NE,
    fill: [1, 4],
    horizontalBit: A4_WALL_E,
    horizontalEdge: [1, 0],
    inner: [1, 2],
    outer: [3, 0],
    targetX: 1,
    targetY: 0,
    verticalEdge: [3, 4],
    verticalBit: A4_WALL_N,
  },
  {
    diagonalBit: A4_WALL_SW,
    fill: [2, 3],
    horizontalBit: A4_WALL_W,
    horizontalEdge: [2, 5],
    inner: [2, 1],
    outer: [0, 5],
    targetX: 0,
    targetY: 1,
    verticalEdge: [0, 3],
    verticalBit: A4_WALL_S,
  },
  {
    diagonalBit: A4_WALL_SE,
    fill: [1, 3],
    horizontalBit: A4_WALL_E,
    horizontalEdge: [1, 5],
    inner: [3, 1],
    outer: [3, 5],
    targetX: 1,
    targetY: 1,
    verticalEdge: [3, 3],
    verticalBit: A4_WALL_S,
  },
];

const A4_WALL_SIDE_QUADRANT_RULES: A4WallSideQuadrantRule[] = [
  {
    both: [2, 2],
    horizontalBit: A4_WALL_W,
    horizontalEdge: [2, 0],
    neither: [0, 0],
    targetX: 0,
    targetY: 0,
    verticalBit: A4_WALL_N,
    verticalEdge: [0, 2],
  },
  {
    both: [1, 2],
    horizontalBit: A4_WALL_E,
    horizontalEdge: [1, 0],
    neither: [3, 0],
    targetX: 1,
    targetY: 0,
    verticalBit: A4_WALL_N,
    verticalEdge: [3, 2],
  },
  {
    both: [2, 1],
    horizontalBit: A4_WALL_W,
    horizontalEdge: [2, 3],
    neither: [0, 3],
    targetX: 0,
    targetY: 1,
    verticalBit: A4_WALL_S,
    verticalEdge: [0, 1],
  },
  {
    both: [1, 1],
    horizontalBit: A4_WALL_E,
    horizontalEdge: [1, 3],
    neither: [3, 3],
    targetX: 1,
    targetY: 1,
    verticalBit: A4_WALL_S,
    verticalEdge: [3, 1],
  },
];

export interface ObservatoryAutotileQuadrant {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}

export interface ObservatoryWallAutotileLayerQuadrants {
  ceilingQuadrants: ObservatoryAutotileQuadrant[];
  faceQuadrants: ObservatoryAutotileQuadrant[];
  shadowQuadrants: ObservatoryAutotileQuadrant[];
}

export interface ObservatoryWallAutotileRoomOptions {
  isMatchingWallCell?: (point: { x: number; y: number }) => boolean;
}

export type ObservatoryWallMapCell =
  | number
  | {
      height?: number;
      id: number;
    }
  | null
  | undefined;

export type ObservatoryWallMapMatrix = ObservatoryWallMapCell[][];

export interface ObservatoryWallMapMaterial {
  blockIndex?: number;
  height?: number;
}

export interface RpgMakerA4WallLayeredMapRenderOptions {
  connectOutOfBounds?: boolean;
  defaultHeight?: number;
  depth?: number;
  materials?: Record<number, ObservatoryWallMapMaterial>;
  x?: number;
  y?: number;
}

export interface RpgMakerA4WallBlitterLayerRenderOptions extends RpgMakerA4WallLayeredMapRenderOptions {
  faceDepth?: number;
  ceilingDepth?: number;
}

export interface RpgMakerA4WallArchitecturalMockMapOptions {
  columns?: number;
  rows?: number;
  bottomDividerY?: number;
}

export interface RpgMakerA4WallBitmaskOptions {
  connectOutOfBounds?: boolean;
}

interface RpgMakerA4WallMatrixFaceAnchor {
  blockIndex: number;
  height: number;
  wallId: number;
  x: number;
  y: number;
}

interface RpgMakerA4WallMatrixCeilingCap {
  blockIndex: number;
  wallId: number;
  x: number;
  y: number;
}

export const RPG_MAKER_A4_WALL_ARCHITECTURAL_MATERIALS: Record<number, ObservatoryWallMapMaterial> =
  {
    [RPG_MAKER_A4_WALL_LEGACY_WHITE_PERIMETER_ID]: {
      blockIndex: RPG_MAKER_A4_WALL_WHITE_TOP_BLOCK_INDEX,
      height: 1,
    },
    [RPG_MAKER_A4_WALL_WHITE_PERIMETER_ID]: {
      blockIndex: RPG_MAKER_A4_WALL_WHITE_TOP_BLOCK_INDEX,
      height: 1,
    },
    [RPG_MAKER_A4_WALL_BRICK_DIVIDER_ID]: {
      blockIndex: RPG_MAKER_A4_WALL_BRICK_BLOCK_INDEX,
      height: 2,
    },
  };

export interface RpgMakerA4WallAutotileRendererOptions {
  blockCount?: number;
  blockWidth?: number;
  colorKey?: string | null;
  faceY?: number;
  sourceX?: number;
  tileRows?: number;
  tileSize?: number;
  topY?: number;
}

export class RpgMakerA4WallAutotileRenderer {
  private framesReady = false;
  private readonly blockCount: number;
  private readonly blockWidth: number;
  private readonly colorKey: string | null;
  private readonly faceY: number;
  private readonly framePrefix: string;
  private materialTextureKey: string;
  private readonly sourceX: number;
  private readonly tileRows: number;
  private readonly tileSize: number;
  private readonly topY: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly textureKey: string,
    options: RpgMakerA4WallAutotileRendererOptions = {}
  ) {
    this.blockCount = options.blockCount ?? RPG_MAKER_A4_WALL_BLOCK_COUNT;
    this.blockWidth = options.blockWidth ?? RPG_MAKER_A4_WALL_BLOCK_WIDTH;
    this.colorKey = options.colorKey === undefined ? RPG_MAKER_A4_WALL_COLOR_KEY : options.colorKey;
    this.materialTextureKey = textureKey;
    this.sourceX = options.sourceX ?? 0;
    this.topY = options.topY ?? RPG_MAKER_A4_WALL_TOP_SECTION_Y;
    this.tileRows = options.tileRows ?? RPG_MAKER_A4_WALL_BLOCK_TILE_ROWS;
    this.tileSize = options.tileSize ?? RPG_MAKER_A4_WALL_TILE_SIZE;
    this.faceY = options.faceY ?? this.topY + RPG_MAKER_A4_WALL_FACE_SECTION_Y;
    this.framePrefix = `a4-wall-${this.sourceX}-${this.topY}-${this.faceY}-${this.blockWidth}-${this.tileRows}`;
  }

  static preload(scene: Phaser.Scene, key: string, url: string) {
    scene.load.image(key, url);
  }

  static optionsForAsset(
    asset: ObservatoryAssetDefinition | undefined
  ): RpgMakerA4WallAutotileRendererOptions {
    const autotile = asset?.autotile;
    const layout = autotile?.sourceLayout;

    return {
      blockCount: layout?.blockCount ?? RPG_MAKER_A4_WALL_BLOCK_COUNT,
      blockWidth: layout?.blockWidth ?? RPG_MAKER_A4_WALL_BLOCK_WIDTH,
      colorKey: layout?.colorKey,
      faceY: layout?.faceY,
      sourceX: layout?.x,
      tileRows: Math.max(
        RPG_MAKER_A4_WALL_BLOCK_TILE_ROWS,
        autotile?.set.height ?? RPG_MAKER_A4_WALL_BLOCK_TILE_ROWS
      ),
      tileSize: autotile?.tileSize ?? RPG_MAKER_A4_WALL_TILE_SIZE,
      topY: layout?.topY ?? (autotile ? autotile.set.y * autotile.tileSize : 0),
    };
  }

  static blockIndexForAsset(asset: ObservatoryAssetDefinition | undefined) {
    const setX = asset?.autotile?.set.x ?? 0;
    return Math.max(0, Math.floor(setX / 2));
  }

  ensureMiniTileFrames() {
    if (this.framesReady) {
      return;
    }

    this.materialTextureKey = this.ensureColorKeyedTexture();
    const texture = this.scene.textures.get(this.materialTextureKey);
    if (!texture) {
      return;
    }

    (texture as { setFilter?: (filterMode: number) => void }).setFilter?.(
      PHASER_TEXTURE_FILTER_NEAREST
    );

    for (let blockIndex = 0; blockIndex < this.blockCount; blockIndex += 1) {
      for (let sourceY = 0; sourceY < this.tileRows * 2; sourceY += 1) {
        for (
          let sourceX = 0;
          sourceX < this.blockWidth / RPG_MAKER_A4_WALL_HALF_TILE_SIZE;
          sourceX += 1
        ) {
          const frameName = this.frameName(blockIndex, sourceX, sourceY);

          if (texture.has(frameName)) {
            continue;
          }

          texture.add(
            frameName,
            0,
            this.sourceX +
              blockIndex * this.blockWidth +
              sourceX * RPG_MAKER_A4_WALL_HALF_TILE_SIZE,
            this.resolveSourceY(sourceY),
            RPG_MAKER_A4_WALL_HALF_TILE_SIZE,
            RPG_MAKER_A4_WALL_HALF_TILE_SIZE
          );
        }
      }
    }

    this.framesReady = true;
  }

  stampQuadrants(
    renderTexture: Phaser.GameObjects.RenderTexture,
    quadrants: ObservatoryAutotileQuadrant[],
    x: number,
    y: number,
    blockIndex = 0,
    outputTileSize = this.tileSize
  ) {
    this.ensureMiniTileFrames();

    const outputHalfTile = outputTileSize / 2;
    const scale = outputHalfTile / RPG_MAKER_A4_WALL_HALF_TILE_SIZE;

    for (const quadrant of quadrants) {
      renderTexture.stamp(
        this.materialTextureKey,
        this.frameName(blockIndex, quadrant.sourceX, quadrant.sourceY),
        Math.round(x + quadrant.targetX * outputHalfTile),
        Math.round(y + quadrant.targetY * outputHalfTile),
        { originX: 0, originY: 0, scale }
      );
    }
  }

  renderMapToTexture(matrix: number[][], x = 0, y = 0, blockIndex = 0, depth = 5) {
    const rows = matrix.length;
    const columns = Math.max(0, ...matrix.map((row) => row.length));
    const renderTexture = this.scene.add
      .renderTexture(Math.round(x), Math.round(y), columns * this.tileSize, rows * this.tileSize)
      .setOrigin(0)
      .setDepth(depth);

    this.stampMap(renderTexture, matrix, blockIndex);
    return renderTexture;
  }

  stampMap(
    renderTexture: Phaser.GameObjects.RenderTexture,
    matrix: ObservatoryWallMapMatrix,
    blockIndex = 0
  ) {
    renderTexture.clear();

    for (let y = 0; y < matrix.length; y += 1) {
      for (let x = 0; x < matrix[y].length; x += 1) {
        const wallId = resolveWallMapCellId(matrix[y]?.[x]);

        if (wallId <= 0) {
          continue;
        }

        const targetBlockIndex = wallId === 1 ? blockIndex : wallId;
        const bitmask = getWallBitmask(matrix, x, y);
        const quadrants = resolveA4WallQuadrantsForBitmask(
          bitmask,
          resolveA4WallMiniTileRows(),
          resolveA4WallCeilingModeForBlockIndex(targetBlockIndex)
        );
        this.stampQuadrants(
          renderTexture,
          quadrants,
          x * this.tileSize,
          y * this.tileSize,
          targetBlockIndex,
          this.tileSize
        );
      }
    }

    (renderTexture as { render?: () => void }).render?.();
  }

  renderLayeredMapToTextures(
    matrix: ObservatoryWallMapMatrix,
    options: RpgMakerA4WallLayeredMapRenderOptions = {}
  ) {
    const rows = matrix.length;
    const columns = Math.max(0, ...matrix.map((row) => row.length));
    const maxHeight = Math.max(
      1,
      ...matrix.flatMap((row) => row.map((cell) => resolveWallMapCellHeight(cell, options)))
    );
    const width = columns * this.tileSize;
    const height = (rows + maxHeight) * this.tileSize;
    const x = Math.round(options.x ?? 0);
    const y = Math.round(options.y ?? 0);
    const depth = options.depth ?? 5;
    const faceLayer = this.scene.add
      .renderTexture(x, y, width, height)
      .setName('WallFaceLayer')
      .setOrigin(0)
      .setDepth(depth);
    const ceilingLayer = this.scene.add
      .renderTexture(x, y, width, height)
      .setName('CeilingLayer')
      .setOrigin(0)
      .setDepth(depth + 1);

    this.stampLayeredMap(faceLayer, ceilingLayer, matrix, options);
    return { ceilingLayer, faceLayer };
  }

  renderLayeredMapToBlitters(
    matrix: ObservatoryWallMapMatrix,
    options: RpgMakerA4WallBlitterLayerRenderOptions = {}
  ) {
    if (this.tileSize !== RPG_MAKER_A4_WALL_TILE_SIZE) {
      throw new Error(
        'RpgMakerA4WallAutotileRenderer.renderLayeredMapToBlitters requires a 48x48 output grid.'
      );
    }

    this.ensureMiniTileFrames();

    const x = Math.round(options.x ?? 0);
    const y = Math.round(options.y ?? 0);
    const depth = options.depth ?? 5;
    const faceLayer = this.scene.add
      .blitter(x, y, this.materialTextureKey)
      .setName('WallFaceBlitterLayer')
      .setDepth(options.faceDepth ?? depth);
    const ceilingLayer = this.scene.add
      .blitter(x, y, this.materialTextureKey)
      .setName('CeilingBlitterLayer')
      .setDepth(options.ceilingDepth ?? depth + 1);

    this.stampLayeredMapToBlitters(faceLayer, ceilingLayer, matrix, options);
    return { ceilingLayer, faceLayer };
  }

  stampLayeredMap(
    faceLayer: Phaser.GameObjects.RenderTexture,
    ceilingLayer: Phaser.GameObjects.RenderTexture,
    matrix: ObservatoryWallMapMatrix,
    options: RpgMakerA4WallLayeredMapRenderOptions = {}
  ) {
    faceLayer.clear();
    ceilingLayer.clear();

    const rows = resolveA4WallMiniTileRows();
    const { ceilingCaps, ceilingCapsByPoint, faceAnchors } = collectA4WallLayeredMatrixAnchors(
      matrix,
      options
    );
    const matrixSize = resolveWallMatrixSize(matrix);

    for (const anchor of faceAnchors) {
      for (let faceIndex = 0; faceIndex < anchor.height; faceIndex += 1) {
        const faceBitmask = getWallBitmask(matrix, anchor.x, anchor.y, undefined, options);
        this.stampQuadrants(
          faceLayer,
          resolveA4WallFaceStackQuadrantsForBitmask(faceBitmask, faceIndex, rows),
          anchor.x * this.tileSize,
          (anchor.y + faceIndex) * this.tileSize,
          anchor.blockIndex,
          this.tileSize
        );
      }
    }

    for (const cap of ceilingCaps) {
      const bitmask = getA4WallLayeredCeilingBitmask(
        cap,
        ceilingCapsByPoint,
        matrixSize,
        options.connectOutOfBounds
      );
      this.stampQuadrants(
        ceilingLayer,
        resolveA4WallCeilingQuadrantsForBitmask(
          bitmask,
          rows,
          resolveA4WallCeilingModeForBlockIndex(cap.blockIndex)
        ),
        cap.x * this.tileSize,
        cap.y * this.tileSize,
        cap.blockIndex,
        this.tileSize
      );
    }

    (faceLayer as { render?: () => void }).render?.();
    (ceilingLayer as { render?: () => void }).render?.();
  }

  stampLayeredMapToBlitters(
    faceLayer: Phaser.GameObjects.Blitter,
    ceilingLayer: Phaser.GameObjects.Blitter,
    matrix: ObservatoryWallMapMatrix,
    options: RpgMakerA4WallLayeredMapRenderOptions = {}
  ) {
    if (this.tileSize !== RPG_MAKER_A4_WALL_TILE_SIZE) {
      throw new Error(
        'RpgMakerA4WallAutotileRenderer.stampLayeredMapToBlitters requires a 48x48 output grid.'
      );
    }

    this.ensureMiniTileFrames();
    faceLayer.clear();
    ceilingLayer.clear();

    const rows = resolveA4WallMiniTileRows();
    const { ceilingCaps, ceilingCapsByPoint, faceAnchors } = collectA4WallLayeredMatrixAnchors(
      matrix,
      options
    );
    const matrixSize = resolveWallMatrixSize(matrix);

    for (const anchor of faceAnchors) {
      for (let faceIndex = 0; faceIndex < anchor.height; faceIndex += 1) {
        const faceBitmask = getWallBitmask(matrix, anchor.x, anchor.y, undefined, options);
        this.stampQuadrantsToBlitter(
          faceLayer,
          resolveA4WallFaceStackQuadrantsForBitmask(faceBitmask, faceIndex, rows),
          anchor.x * this.tileSize,
          (anchor.y + faceIndex) * this.tileSize,
          anchor.blockIndex
        );
      }
    }

    for (const cap of ceilingCaps) {
      const bitmask = getA4WallLayeredCeilingBitmask(
        cap,
        ceilingCapsByPoint,
        matrixSize,
        options.connectOutOfBounds
      );
      this.stampQuadrantsToBlitter(
        ceilingLayer,
        resolveA4WallCeilingQuadrantsForBitmask(
          bitmask,
          rows,
          resolveA4WallCeilingModeForBlockIndex(cap.blockIndex)
        ),
        cap.x * this.tileSize,
        cap.y * this.tileSize,
        cap.blockIndex
      );
    }
  }

  stampQuadrantsToBlitter(
    blitter: Phaser.GameObjects.Blitter,
    quadrants: ObservatoryAutotileQuadrant[],
    x: number,
    y: number,
    blockIndex = 0
  ) {
    this.ensureMiniTileFrames();

    for (const quadrant of quadrants) {
      blitter.create(
        Math.round(x + quadrant.targetX * RPG_MAKER_A4_WALL_HALF_TILE_SIZE),
        Math.round(y + quadrant.targetY * RPG_MAKER_A4_WALL_HALF_TILE_SIZE),
        this.frameName(blockIndex, quadrant.sourceX, quadrant.sourceY)
      );
    }
  }

  getPreparedTextureKey() {
    this.ensureMiniTileFrames();
    return this.materialTextureKey;
  }

  private frameName(blockIndex: number, sourceX: number, sourceY: number) {
    return `${this.framePrefix}-${blockIndex}-${sourceX}-${sourceY}`;
  }

  private ensureColorKeyedTexture() {
    if (!this.colorKey) {
      return this.textureKey;
    }

    return ensureRpgMakerA4WallColorKeyedTexture(this.scene, this.textureKey, this.colorKey);
  }

  private resolveSourceY(logicalMiniTileY: number) {
    if (logicalMiniTileY < RPG_MAKER_A4_WALL_TOP_SECTION_MINI_ROWS) {
      return this.topY + logicalMiniTileY * RPG_MAKER_A4_WALL_HALF_TILE_SIZE;
    }

    return (
      this.faceY +
      (logicalMiniTileY - RPG_MAKER_A4_WALL_TOP_SECTION_MINI_ROWS) *
        RPG_MAKER_A4_WALL_HALF_TILE_SIZE
    );
  }
}

export function preprocessRpgMakerA4WallTextures(
  scene: Phaser.Scene,
  registry: { assets: ObservatoryAssetDefinition[] }
) {
  for (const asset of registry.assets) {
    if (asset.autotile?.kind !== 'rpgmaker-a4-wall') {
      continue;
    }

    const options = RpgMakerA4WallAutotileRenderer.optionsForAsset(asset);
    const colorKey =
      options.colorKey === undefined ? RPG_MAKER_A4_WALL_COLOR_KEY : options.colorKey;

    if (colorKey) {
      ensureRpgMakerA4WallColorKeyedTexture(scene, asset.id, colorKey);
    }
  }
}

export function ensureRpgMakerA4WallColorKeyedTexture(
  scene: Phaser.Scene,
  textureKey: string,
  colorKey = RPG_MAKER_A4_WALL_COLOR_KEY,
  tolerance = RPG_MAKER_A4_WALL_COLOR_KEY_TOLERANCE
) {
  const keyedTextureKey = getRpgMakerA4WallColorKeyedTextureKey(textureKey, colorKey, tolerance);

  if (scene.textures.exists(keyedTextureKey)) {
    return keyedTextureKey;
  }

  const texture = scene.textures.get(textureKey);
  const sourceImage = texture?.getSourceImage() as
    | (CanvasImageSource & { height?: number; width?: number })
    | undefined;
  const width = sourceImage?.width ?? 0;
  const height = sourceImage?.height ?? 0;
  const color = parseHexColor(colorKey);

  if (!texture || !sourceImage || width <= 0 || height <= 0 || !color) {
    return textureKey;
  }

  const keyedTexture = scene.textures.createCanvas(keyedTextureKey, width, height);
  const context = keyedTexture?.getContext();

  if (!keyedTexture || !context) {
    return textureKey;
  }

  context.clearRect(0, 0, width, height);
  context.drawImage(sourceImage, 0, 0);

  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  for (let index = 0; index < pixels.length; index += 4) {
    if (
      isWithinColorKeyThreshold(
        pixels[index]!,
        pixels[index + 1]!,
        pixels[index + 2]!,
        color,
        tolerance
      )
    ) {
      pixels[index + 3] = 0;
    }
  }

  context.putImageData(imageData, 0, 0);
  keyedTexture.refresh();
  (keyedTexture as { setFilter?: (filterMode: number) => void }).setFilter?.(
    PHASER_TEXTURE_FILTER_NEAREST
  );

  return keyedTextureKey;
}

export function getRpgMakerA4WallColorKeyedTextureKey(
  textureKey: string,
  colorKey = RPG_MAKER_A4_WALL_COLOR_KEY,
  tolerance = RPG_MAKER_A4_WALL_COLOR_KEY_TOLERANCE
) {
  return `${textureKey}:colorkey:${colorKey.replace(/[^a-fA-F0-9]/gu, '').toLowerCase()}:t${Math.max(0, Math.floor(tolerance))}`;
}

export function createRpgMakerA4WallArchitecturalMockMap({
  columns = 12,
  rows = 8,
  bottomDividerY = rows - 3,
}: RpgMakerA4WallArchitecturalMockMapOptions = {}): ObservatoryWallMapMatrix {
  const safeColumns = Math.max(4, Math.floor(columns));
  const safeRows = Math.max(4, Math.floor(rows));
  const dividerY = Math.max(1, Math.min(safeRows - 2, Math.floor(bottomDividerY)));
  const matrix: ObservatoryWallMapMatrix = Array.from({ length: safeRows }, () =>
    Array.from({ length: safeColumns }, () => 0)
  );

  for (let x = 0; x < safeColumns; x += 1) {
    matrix[0]![x] = { height: 1, id: RPG_MAKER_A4_WALL_WHITE_PERIMETER_ID };
    matrix[safeRows - 1]![x] = { height: 1, id: RPG_MAKER_A4_WALL_WHITE_PERIMETER_ID };
  }

  for (let y = 0; y < safeRows; y += 1) {
    matrix[y]![0] = { height: 1, id: RPG_MAKER_A4_WALL_WHITE_PERIMETER_ID };
    matrix[y]![safeColumns - 1] = { height: 1, id: RPG_MAKER_A4_WALL_WHITE_PERIMETER_ID };
  }

  for (let x = 2; x < safeColumns - 2; x += 1) {
    matrix[dividerY]![x] = { height: 2, id: RPG_MAKER_A4_WALL_BRICK_DIVIDER_ID };
  }

  return matrix;
}

export function resolveObservatoryFloorAutotileFrame(
  asset: ObservatoryAssetDefinition | undefined,
  _room: ObservatoryRoom,
  _point: { x: number; y: number },
  fallbackFrame: number | undefined
) {
  if (asset?.autotile?.kind !== 'rpgmaker-a2-ground') {
    return fallbackFrame;
  }

  return asset.frame ?? frameAt(asset, 0, 0);
}

export function resolveObservatoryWallAutotileFrame(
  asset: ObservatoryAssetDefinition | undefined,
  _room: ObservatoryRoom,
  _point: { x: number; y: number },
  fallbackFrame: number | undefined
) {
  if (asset?.autotile?.kind !== 'rpgmaker-a4-wall') {
    return fallbackFrame;
  }

  return frameAt(asset, 0, 0);
}

export function resolveObservatoryWallAutotileQuadrants(
  asset: ObservatoryAssetDefinition | undefined,
  room: ObservatoryRoom,
  point: { x: number; y: number },
  options: ObservatoryWallAutotileRoomOptions = {}
) {
  if (asset?.autotile?.kind !== 'rpgmaker-a4-wall' || !isVisibleWallCell(room, point)) {
    return undefined;
  }

  return resolveA4WallQuadrantsForBitmask(
    getRoomWallBitmask(room, point, options.isMatchingWallCell),
    resolveA4WallMiniTileRows(asset),
    resolveA4WallCeilingModeForBlockIndex(RpgMakerA4WallAutotileRenderer.blockIndexForAsset(asset))
  );
}

export function resolveObservatoryWallAutotileLayerQuadrants(
  asset: ObservatoryAssetDefinition | undefined,
  room: ObservatoryRoom,
  point: { x: number; y: number },
  options: ObservatoryWallAutotileRoomOptions = {}
): ObservatoryWallAutotileLayerQuadrants | undefined {
  if (asset?.autotile?.kind !== 'rpgmaker-a4-wall' || !isVisibleWallCell(room, point)) {
    return undefined;
  }

  const bitmask = getRoomWallBitmask(room, point, options.isMatchingWallCell);
  const rows = resolveA4WallMiniTileRows(asset);

  return {
    ceilingQuadrants: resolveA4WallCeilingQuadrantsForBitmask(
      bitmask,
      rows,
      resolveA4WallCeilingModeForBlockIndex(
        RpgMakerA4WallAutotileRenderer.blockIndexForAsset(asset)
      )
    ),
    faceQuadrants: resolveA4WallFaceQuadrantsForBitmask(bitmask, rows),
    shadowQuadrants: resolveA4WallDropShadowQuadrantsForBitmask(bitmask, rows),
  };
}

export function resolveObservatoryWallFaceStackQuadrants(
  asset: ObservatoryAssetDefinition | undefined,
  room: ObservatoryRoom,
  point: { x: number; y: number },
  stackIndex: number,
  options: ObservatoryWallAutotileRoomOptions = {}
) {
  if (asset?.autotile?.kind !== 'rpgmaker-a4-wall' || !isVisibleWallCell(room, point)) {
    return undefined;
  }

  return resolveA4WallFaceStackQuadrantsForBitmask(
    getRoomWallBitmask(room, point, options.isMatchingWallCell),
    stackIndex,
    resolveA4WallMiniTileRows(asset)
  );
}

export function getWallBitmask(
  matrix: ObservatoryWallMapMatrix,
  x: number,
  y: number,
  isWall: (
    matrix: ObservatoryWallMapMatrix,
    x: number,
    y: number,
    originId?: number
  ) => boolean = defaultMatrixWallPredicate,
  options: RpgMakerA4WallBitmaskOptions = {}
) {
  const originId = resolveWallMapCellId(matrix[y]?.[x]);
  const north = isArchitecturalWallConnection(matrix, x, y - 1, originId, isWall, options);
  const south = isArchitecturalWallConnection(matrix, x, y + 1, originId, isWall, options);
  const east = isArchitecturalWallConnection(matrix, x + 1, y, originId, isWall, options);
  const west = isArchitecturalWallConnection(matrix, x - 1, y, originId, isWall, options);
  let mask = 0;

  if (north) {
    mask |= A4_WALL_N;
  }
  if (east) {
    mask |= A4_WALL_E;
  }
  if (south) {
    mask |= A4_WALL_S;
  }
  if (west) {
    mask |= A4_WALL_W;
  }
  if (
    north &&
    east &&
    isArchitecturalWallConnection(matrix, x + 1, y - 1, originId, isWall, options)
  ) {
    mask |= A4_WALL_NE;
  }
  if (
    south &&
    east &&
    isArchitecturalWallConnection(matrix, x + 1, y + 1, originId, isWall, options)
  ) {
    mask |= A4_WALL_SE;
  }
  if (
    south &&
    west &&
    isArchitecturalWallConnection(matrix, x - 1, y + 1, originId, isWall, options)
  ) {
    mask |= A4_WALL_SW;
  }
  if (
    north &&
    west &&
    isArchitecturalWallConnection(matrix, x - 1, y - 1, originId, isWall, options)
  ) {
    mask |= A4_WALL_NW;
  }

  return mask;
}

function collectA4WallLayeredMatrixAnchors(
  matrix: ObservatoryWallMapMatrix,
  options: RpgMakerA4WallLayeredMapRenderOptions
) {
  const faceAnchors: RpgMakerA4WallMatrixFaceAnchor[] = [];
  const ceilingCapsByPoint = new Map<string, RpgMakerA4WallMatrixCeilingCap>();

  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      const cell = matrix[y]?.[x];
      const wallId = resolveWallMapCellId(cell);

      if (wallId <= 0) {
        continue;
      }

      const blockIndex = options.materials?.[wallId]?.blockIndex ?? wallId;
      const height = resolveWallMapCellHeight(cell, options);
      faceAnchors.push({ blockIndex, height, wallId, x, y });

      // RPG Maker A4 wall data marks the vertical face anchor. Section A is
      // generated one 48px grid row above that face only when there is not
      // already another face occupying the upper cell.
      const ceilingY = y - 1;
      if (ceilingY < 0 || resolveWallMapCellId(matrix[ceilingY]?.[x]) > 0) {
        continue;
      }

      ceilingCapsByPoint.set(pointKey({ x, y: ceilingY }), {
        blockIndex,
        wallId,
        x,
        y: ceilingY,
      });
    }
  }

  return {
    ceilingCaps: [...ceilingCapsByPoint.values()],
    ceilingCapsByPoint,
    faceAnchors,
  };
}

function getA4WallLayeredCeilingBitmask(
  cap: RpgMakerA4WallMatrixCeilingCap,
  ceilingCapsByPoint: Map<string, RpgMakerA4WallMatrixCeilingCap>,
  matrixSize: { height: number; width: number },
  connectOutOfBounds = true
) {
  const matches = (x: number, y: number) =>
    isMatchingA4WallLayeredCeilingCap(
      { x, y },
      cap.wallId,
      ceilingCapsByPoint,
      matrixSize,
      connectOutOfBounds
    );
  const north = matches(cap.x, cap.y - 1);
  const south = matches(cap.x, cap.y + 1);
  const east = matches(cap.x + 1, cap.y);
  const west = matches(cap.x - 1, cap.y);
  let mask = 0;

  if (north) {
    mask |= A4_WALL_N;
  }
  if (south) {
    mask |= A4_WALL_S;
  }
  if (east) {
    mask |= A4_WALL_E;
  }
  if (west) {
    mask |= A4_WALL_W;
  }
  if (north && east && matches(cap.x + 1, cap.y - 1)) {
    mask |= A4_WALL_NE;
  }
  if (south && east && matches(cap.x + 1, cap.y + 1)) {
    mask |= A4_WALL_SE;
  }
  if (south && west && matches(cap.x - 1, cap.y + 1)) {
    mask |= A4_WALL_SW;
  }
  if (north && west && matches(cap.x - 1, cap.y - 1)) {
    mask |= A4_WALL_NW;
  }

  return mask;
}

function isMatchingA4WallLayeredCeilingCap(
  point: { x: number; y: number },
  wallId: number,
  ceilingCapsByPoint: Map<string, RpgMakerA4WallMatrixCeilingCap>,
  matrixSize: { height: number; width: number },
  connectOutOfBounds: boolean
) {
  if (point.x < 0 || point.y < 0 || point.x >= matrixSize.width || point.y >= matrixSize.height) {
    return connectOutOfBounds;
  }

  return ceilingCapsByPoint.get(pointKey(point))?.wallId === wallId;
}

function resolveWallMatrixSize(matrix: ObservatoryWallMapMatrix) {
  return {
    height: matrix.length,
    width: Math.max(0, ...matrix.map((row) => row.length)),
  };
}

function pointKey(point: { x: number; y: number }) {
  return `${point.x}:${point.y}`;
}

export function resolveA4WallQuadrantsForBitmask(
  bitmask: number,
  rows: A4WallMiniTileRows = resolveA4WallMiniTileRows(),
  ceilingMode: RpgMakerA4WallCeilingMode = 'roof'
): ObservatoryAutotileQuadrant[] {
  const north = Boolean(bitmask & A4_WALL_N);

  if (!north) {
    return resolveA4WallCeilingQuadrantsForBitmask(bitmask, rows, ceilingMode);
  }

  return resolveA4WallFaceQuadrantsForBitmask(bitmask, rows);
}

export function resolveA4WallCeilingQuadrantsForBitmask(
  bitmask: number,
  rows: A4WallMiniTileRows = resolveA4WallMiniTileRows(),
  ceilingMode: RpgMakerA4WallCeilingMode = 'roof'
): ObservatoryAutotileQuadrant[] {
  if (ceilingMode === 'solid-partition') {
    return resolveA4WallFlatPartitionCeilingQuadrants(rows);
  }

  if (bitmask === 0) {
    return [
      { sourceX: 0, sourceY: 0, targetX: 0, targetY: 0 },
      { sourceX: 1, sourceY: 0, targetX: 1, targetY: 0 },
      { sourceX: 0, sourceY: 1, targetX: 0, targetY: 1 },
      { sourceX: 1, sourceY: 1, targetX: 1, targetY: 1 },
    ];
  }

  return A4_WALL_ROOF_QUADRANT_RULES.map((rule) => selectA4WallRoofQuadrant(bitmask, rule));
}

export function resolveA4WallFlatPartitionCeilingQuadrants(
  rows: A4WallMiniTileRows = resolveA4WallMiniTileRows()
): ObservatoryAutotileQuadrant[] {
  // Interior divider tops use Section A, but they do not expose outside roof
  // corners. Lock the full 48px cap to the horizontal trim frame from the
  // first Section A tile so repeated brick partitions form one flat run.
  return [
    { sourceX: 0, sourceY: rows.topUpper, targetX: 0, targetY: 0 },
    { sourceX: 1, sourceY: rows.topUpper, targetX: 1, targetY: 0 },
    { sourceX: 0, sourceY: rows.topLower, targetX: 0, targetY: 1 },
    { sourceX: 1, sourceY: rows.topLower, targetX: 1, targetY: 1 },
  ];
}

export function resolveA4WallCeilingModeForBlockIndex(
  blockIndex: number
): RpgMakerA4WallCeilingMode {
  return blockIndex === RPG_MAKER_A4_WALL_BRICK_BLOCK_INDEX ? 'solid-partition' : 'roof';
}

export function resolveA4WallDropShadowQuadrantsForBitmask(
  bitmask: number,
  rows: A4WallMiniTileRows = resolveA4WallMiniTileRows()
): ObservatoryAutotileQuadrant[] {
  const hasEastWall = Boolean(bitmask & A4_WALL_E);
  const extendsVertically = Boolean(bitmask & (A4_WALL_N | A4_WALL_S));

  if (hasEastWall || !extendsVertically) {
    return [];
  }

  return [
    { sourceX: 3, sourceY: rows.faceBase + 2, targetX: 2, targetY: 0 },
    { sourceX: 3, sourceY: rows.faceBase + 1, targetX: 2, targetY: 1 },
  ];
}

export function resolveA4WallFaceQuadrantsForBitmask(
  bitmask: number,
  rows: A4WallMiniTileRows = resolveA4WallMiniTileRows()
): ObservatoryAutotileQuadrant[] {
  return A4_WALL_SIDE_QUADRANT_RULES.map((rule) => selectA4WallSideQuadrant(bitmask, rule, rows));
}

export function resolveA4WallFaceStackQuadrantsForBitmask(
  bitmask: number,
  stackIndex: number,
  rows: A4WallMiniTileRows = resolveA4WallMiniTileRows()
): ObservatoryAutotileQuadrant[] {
  void stackIndex;
  return resolveA4WallFaceQuadrantsForBitmask(bitmask, rows);
}

export function resolveA4WallSolidFaceQuadrants(
  stackIndex: number,
  rows: A4WallMiniTileRows = resolveA4WallMiniTileRows(),
  faceColumn = 0
): ObservatoryAutotileQuadrant[] {
  void stackIndex;
  void faceColumn;
  return resolveA4WallFaceQuadrantsForBitmask(A4_WALL_N | A4_WALL_E | A4_WALL_S | A4_WALL_W, rows);
}

function getRoomWallBitmask(
  room: ObservatoryRoom,
  point: { x: number; y: number },
  isMatchingWallCell: (point: { x: number; y: number }) => boolean = (candidate) =>
    isVisibleWallCell(room, candidate)
) {
  let mask = 0;
  const north = isMatchingWallCell({ x: point.x, y: point.y - 1 });
  const south = isMatchingWallCell({ x: point.x, y: point.y + 1 });
  const east = isMatchingWallCell({ x: point.x + 1, y: point.y });
  const west = isMatchingWallCell({ x: point.x - 1, y: point.y });

  if (north) {
    mask |= A4_WALL_N;
  }
  if (east) {
    mask |= A4_WALL_E;
  }
  if (south) {
    mask |= A4_WALL_S;
  }
  if (west) {
    mask |= A4_WALL_W;
  }
  if (north && east && isMatchingWallCell({ x: point.x + 1, y: point.y - 1 })) {
    mask |= A4_WALL_NE;
  }
  if (south && east && isMatchingWallCell({ x: point.x + 1, y: point.y + 1 })) {
    mask |= A4_WALL_SE;
  }
  if (south && west && isMatchingWallCell({ x: point.x - 1, y: point.y + 1 })) {
    mask |= A4_WALL_SW;
  }
  if (north && west && isMatchingWallCell({ x: point.x - 1, y: point.y - 1 })) {
    mask |= A4_WALL_NW;
  }

  return mask;
}

function isVisibleWallCell(room: ObservatoryRoom, point: { x: number; y: number }) {
  const minX = room.bounds.x;
  const maxX = room.bounds.x + room.bounds.width - 1;
  const minY = room.bounds.y;
  const maxY = room.bounds.y + room.bounds.height - 1;
  const onPerimeter = point.x === minX || point.x === maxX || point.y === minY || point.y === maxY;

  if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY || !onPerimeter) {
    return false;
  }

  return !(room.wallOpenings ?? []).some(
    (opening) => opening.x === point.x && opening.y === point.y
  );
}

export function defaultMatrixWallPredicate(
  matrix: ObservatoryWallMapMatrix,
  x: number,
  y: number,
  originId: number = resolveWallMapCellId(matrix[y]?.[x])
) {
  const candidateId = resolveWallMapCellId(matrix[y]?.[x]);
  return originId > 0 && candidateId === originId;
}

function isArchitecturalWallConnection(
  matrix: ObservatoryWallMapMatrix,
  x: number,
  y: number,
  originId: number,
  isWall: (matrix: ObservatoryWallMapMatrix, x: number, y: number, originId?: number) => boolean,
  options: RpgMakerA4WallBitmaskOptions
) {
  const insideMatrix = y >= 0 && y < matrix.length && x >= 0 && x < (matrix[y]?.length ?? 0);

  if (!insideMatrix) {
    return Boolean((options.connectOutOfBounds ?? true) && originId > 0);
  }

  return isWall(matrix, x, y, originId);
}

function selectA4WallRoofQuadrant(
  bitmask: number,
  rule: A4WallRoofQuadrantRule
): ObservatoryAutotileQuadrant {
  const hasVerticalNeighbor = Boolean(bitmask & rule.verticalBit);
  const hasHorizontalNeighbor = Boolean(bitmask & rule.horizontalBit);
  const hasDiagonalNeighbor = Boolean(bitmask & rule.diagonalBit);
  const source =
    hasVerticalNeighbor && hasHorizontalNeighbor
      ? hasDiagonalNeighbor
        ? rule.fill
        : rule.inner
      : hasVerticalNeighbor
        ? rule.verticalEdge
        : hasHorizontalNeighbor
          ? rule.horizontalEdge
          : rule.outer;

  return {
    sourceX: source[0],
    sourceY: source[1],
    targetX: rule.targetX,
    targetY: rule.targetY,
  };
}

function selectA4WallSideQuadrant(
  bitmask: number,
  rule: A4WallSideQuadrantRule,
  rows: A4WallMiniTileRows
): ObservatoryAutotileQuadrant {
  const hasVerticalNeighbor = Boolean(bitmask & rule.verticalBit);
  const hasHorizontalNeighbor = Boolean(bitmask & rule.horizontalBit);
  const source =
    hasVerticalNeighbor && hasHorizontalNeighbor
      ? rule.both
      : hasVerticalNeighbor
        ? rule.verticalEdge
        : hasHorizontalNeighbor
          ? rule.horizontalEdge
          : rule.neither;

  return {
    sourceX: source[0],
    sourceY: rows.faceBase + source[1],
    targetX: rule.targetX,
    targetY: rule.targetY,
  };
}

export interface A4WallMiniTileRows {
  faceBase: number;
  faceLowerConnected: number;
  faceLowerEnd: number;
  faceUpperConnected: number;
  faceUpperEnd: number;
  topLower: number;
  topUpper: number;
}

function resolveA4WallMiniTileRows(asset?: ObservatoryAssetDefinition): A4WallMiniTileRows {
  const tileRows = Math.max(
    RPG_MAKER_A4_WALL_BLOCK_TILE_ROWS,
    asset?.autotile?.set.height ?? RPG_MAKER_A4_WALL_BLOCK_TILE_ROWS
  );
  const maxMiniRow = tileRows * 2 - 1;
  const faceBase = clampMiniTileRow(RPG_MAKER_A4_WALL_TOP_SECTION_MINI_ROWS, maxMiniRow);

  return {
    faceBase,
    faceLowerConnected: clampMiniTileRow(faceBase + 1, maxMiniRow),
    faceLowerEnd: clampMiniTileRow(faceBase + 3, maxMiniRow),
    faceUpperConnected: clampMiniTileRow(faceBase + 2, maxMiniRow),
    faceUpperEnd: clampMiniTileRow(faceBase, maxMiniRow),
    topLower: 1,
    topUpper: 0,
  };
}

function clampMiniTileRow(row: number, maxMiniRow: number) {
  return Math.max(0, Math.min(row, maxMiniRow));
}

function resolveWallMapCellId(cell: ObservatoryWallMapCell) {
  if (typeof cell === 'number') {
    return Number.isFinite(cell) ? cell : 0;
  }

  const id = cell?.id;
  return typeof id === 'number' && Number.isFinite(id) ? id : 0;
}

function resolveWallMapCellHeight(
  cell: ObservatoryWallMapCell,
  options: Pick<RpgMakerA4WallLayeredMapRenderOptions, 'defaultHeight' | 'materials'> = {}
) {
  const wallId = resolveWallMapCellId(cell);
  const explicitHeight = typeof cell === 'object' && cell ? cell.height : undefined;
  const height =
    explicitHeight ?? options.materials?.[wallId]?.height ?? options.defaultHeight ?? 1;
  return Math.max(1, Math.floor(height));
}

function parseHexColor(color: string) {
  const normalized = color.replace(/^#/u, '');

  if (!/^[\da-f]{6}$/iu.test(normalized)) {
    return undefined;
  }

  return {
    b: Number.parseInt(normalized.slice(4, 6), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    r: Number.parseInt(normalized.slice(0, 2), 16),
  };
}

function isWithinColorKeyThreshold(
  red: number,
  green: number,
  blue: number,
  color: { b: number; g: number; r: number },
  tolerance: number
) {
  const threshold = Math.max(0, Math.floor(tolerance));

  return (
    Math.abs(red - color.r) <= threshold &&
    Math.abs(green - color.g) <= threshold &&
    Math.abs(blue - color.b) <= threshold
  );
}

function frameAt(asset: ObservatoryAssetDefinition, localX: number, localY: number) {
  const autotile = asset.autotile;

  if (!autotile) {
    return asset.frame;
  }

  return (autotile.set.y + localY) * autotile.columns + autotile.set.x + localX;
}
