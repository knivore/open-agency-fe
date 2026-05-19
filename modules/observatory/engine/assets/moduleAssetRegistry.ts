import type { StaticImageData } from 'next/image';

import characterAtlas from '@/modules/observatory/assets/characters/Character_48x48_01.png';
import characterByte from '@/modules/observatory/assets/characters/Character_48x48_02.png';
import characterClio from '@/modules/observatory/assets/characters/Character_48x48_03.png';
import characterDelta from '@/modules/observatory/assets/characters/Character_48x48_04.png';
import characterEcho from '@/modules/observatory/assets/characters/Character_48x48_05.png';
import floorTiles from '@/modules/observatory/assets/floors/Floors_1.png';
import agentLaptop from '@/modules/observatory/assets/furnitures/1_Modern_Office_Singles_48x48/compact-gray-laptop.png';
import planningWhiteboard from '@/modules/observatory/assets/furnitures/1_Modern_Office_Singles_48x48/planning-whiteboard-chart.png';
import opsWorkstationFront from '@/modules/observatory/assets/furnitures/1_Modern_Office_Singles_48x48/server-workbench-with-tools.png';
import wallTiles from '@/modules/observatory/assets/walls/Walls_1.png';
import {
  OBSERVATORY_ASSET_REGISTRY_VERSION,
  validateObservatoryAssetRegistry,
  type ObservatoryAssetDefinition,
  type ObservatoryCharacterActionDefinition,
  type ObservatoryCharacterDirection,
  type ObservatoryCharacterActionName,
  type ObservatoryAssetRegistry,
  type ObservatoryValidatedAssetRegistry,
} from '@/modules/observatory/engine/assets/assetRegistry';
import { observatoryRuntimeFurnitureAssets } from '@/modules/observatory/engine/assets/runtimeFurnitureAssets';

type ImportedRasterAsset = StaticImageData | string;

function uri(asset: ImportedRasterAsset) {
  return typeof asset === 'string' ? asset : asset.src;
}

const characterSheetColumns = 56;
const fourDirectionOrder: ObservatoryCharacterDirection[] = ['right', 'up', 'left', 'down'];
const defaultCharacterFrame = 3;
const characterFrameHeight = 96;
const premadeCharacterPathPattern = /^characters\/Character_48x48_\d+\.png$/;
const officeFloorSheet1Names = [
  'Charcoal Slate',
  'Sage Grid',
  'Steel Blue Grid',
  'Sandstone Plain',
  'Mist Blueprint Grid',
  'Warm Ivory Grid',
  'Sky Blueprint Grid',
  'Pale Ochre Grid',
  'Cream Diamond',
  'Aqua Square',
  'Blue Steel Diamond',
  'Sage Lattice',
  'Pool Diamond',
  'Champagne Diamond',
  'Teal Lattice',
  'Slate Diamond',
  'Ivory Diamond',
];
const officeWallSheetNames = [
  'Lavender Stone Wall',
  'Silver Stone Wall',
  'Brown Brick Wall',
  'White Grid Wall',
];

function frameAt(row: number, column: number) {
  return (row - 1) * characterSheetColumns + column;
}

function directionalCharacterActions(
  action: ObservatoryCharacterActionName,
  row: number,
  frameCount: number,
  options: Pick<ObservatoryCharacterActionDefinition, 'frameRate' | 'playOnce' | 'priority'> = {}
): ObservatoryCharacterActionDefinition[] {
  return fourDirectionOrder.map((direction, directionIndex) => {
    const startFrame = frameAt(row, directionIndex * frameCount);
    return {
      action,
      direction,
      endFrame: startFrame + frameCount - 1,
      frameCount,
      row,
      startFrame,
      ...options,
    };
  });
}

function twoDirectionCharacterActions(
  action: ObservatoryCharacterActionName,
  row: number,
  frameCount: number,
  options: Pick<ObservatoryCharacterActionDefinition, 'frameRate' | 'playOnce' | 'priority'> = {}
): ObservatoryCharacterActionDefinition[] {
  return (['right', 'left'] as const).map((direction, directionIndex) => {
    const startFrame = frameAt(row, directionIndex * frameCount);
    return {
      action,
      direction,
      endFrame: startFrame + frameCount - 1,
      frameCount,
      row,
      startFrame,
      ...options,
    };
  });
}

function singleAction(
  action: ObservatoryCharacterActionName,
  row: number,
  frameCount: number,
  options: Pick<
    ObservatoryCharacterActionDefinition,
    'frameRate' | 'loopEndFrame' | 'loopStartFrame' | 'playOnce' | 'priority'
  > = {}
): ObservatoryCharacterActionDefinition {
  return {
    action,
    endFrame: frameAt(row, frameCount - 1),
    frameCount,
    row,
    startFrame: frameAt(row, 0),
    ...options,
  };
}

function characterActions(): ObservatoryCharacterActionDefinition[] {
  return [
    ...directionalCharacterActions('face', 1, 1, { frameRate: 1, priority: 'office' }),
    ...directionalCharacterActions('idle', 2, 6, { frameRate: 5, priority: 'office' }),
    ...directionalCharacterActions('walk', 3, 6, { frameRate: 8, priority: 'office' }),
    singleAction('sleep', 4, 6, { frameRate: 4, priority: 'office' }),
    ...twoDirectionCharacterActions('sit', 5, 6, { frameRate: 4, priority: 'office' }),
    ...twoDirectionCharacterActions('high-chair-sit', 6, 6, { frameRate: 4, priority: 'office' }),
    singleAction('phone', 7, 12, {
      frameRate: 7,
      loopEndFrame: frameAt(7, 8),
      loopStartFrame: frameAt(7, 3),
      priority: 'office',
    }),
    singleAction('reading', 8, 12, {
      frameRate: 6,
      loopEndFrame: frameAt(8, 5),
      loopStartFrame: frameAt(8, 0),
      priority: 'office',
    }),
    ...directionalCharacterActions('push-cart', 9, 6, { frameRate: 8, priority: 'office' }),
    ...directionalCharacterActions('pick-up', 10, 12, {
      frameRate: 9,
      playOnce: true,
      priority: 'office',
    }),
    ...directionalCharacterActions('gift', 11, 10, {
      frameRate: 8,
      playOnce: true,
      priority: 'office',
    }),
    ...directionalCharacterActions('lift', 12, 14, {
      frameRate: 9,
      playOnce: true,
      priority: 'office',
    }),
    ...directionalCharacterActions('throw', 13, 14, {
      frameRate: 9,
      playOnce: true,
      priority: 'documented',
    }),
    ...directionalCharacterActions('hit', 14, 6, {
      frameRate: 8,
      playOnce: true,
      priority: 'documented',
    }),
    ...directionalCharacterActions('punch', 15, 6, {
      frameRate: 8,
      playOnce: true,
      priority: 'documented',
    }),
    ...directionalCharacterActions('stab', 16, 6, {
      frameRate: 8,
      playOnce: true,
      priority: 'documented',
    }),
    ...directionalCharacterActions('grab-gun', 17, 4, {
      frameRate: 7,
      playOnce: true,
      priority: 'documented',
    }),
    ...directionalCharacterActions('gun-idle', 18, 6, { frameRate: 5, priority: 'documented' }),
    ...directionalCharacterActions('shoot', 19, 3, {
      frameRate: 9,
      playOnce: true,
      priority: 'documented',
    }),
    ...directionalCharacterActions('hurt', 20, 3, {
      frameRate: 6,
      playOnce: true,
      priority: 'documented',
    }),
  ];
}

function characterSheet() {
  return {
    columns: characterSheetColumns,
    directionOrder: fourDirectionOrder,
  };
}

function buildRuntimeCuratedAssets(
  curatedAssets: ObservatoryAssetDefinition[]
): ObservatoryAssetDefinition[] {
  return [...curatedAssets, ...buildObservedSurfaceVariants(curatedAssets)];
}

export function normalizeGeneratedRegistryAsset(
  asset: ObservatoryAssetDefinition
): ObservatoryAssetDefinition {
  if (asset.catalogPath === 'walls/Walls_1.png' && asset.source.kind === 'spritesheet') {
    return {
      ...asset,
      autotile: {
        columns: 16,
        kind: 'rpgmaker-a4-wall',
        set: { x: 0, y: 0, width: 2, height: 3 },
        sourceLayout: {
          blockCount: 4,
          blockWidth: 96,
          colorKey: '#1a1c2c',
          faceY: 144,
          topY: 0,
          x: 0,
        },
        tileSize: asset.source.frameWidth ?? 48,
      },
      tags: Array.from(new Set([...(asset.tags ?? []), 'rpgmaker-a4', 'builder-hidden'])),
    };
  }

  if (
    asset.category !== 'human' ||
    asset.source.kind !== 'spritesheet' ||
    !asset.catalogPath ||
    !premadeCharacterPathPattern.test(asset.catalogPath)
  ) {
    return asset;
  }

  return {
    ...asset,
    characterActions: asset.characterActions ?? characterActions(),
    characterSheet: asset.characterSheet ?? characterSheet(),
    frame: defaultCharacterFrame,
    height: characterFrameHeight,
    source: {
      ...asset.source,
      frameHeight: characterFrameHeight,
    },
    tags: Array.from(new Set([...(asset.tags ?? []), 'character-action-sheet'])),
  };
}

export function buildObservedSurfaceVariants(
  assets: ObservatoryAssetDefinition[]
): ObservatoryAssetDefinition[] {
  const variants: ObservatoryAssetDefinition[] = [];

  const floorSheet1 = assets.find(
    (asset) => asset.catalogPath === 'floors/Floors_1.png' && asset.category === 'floor'
  );
  const wallSheet = assets.find(
    (asset) => asset.catalogPath === 'walls/Walls_1.png' && asset.category === 'wall'
  );

  if (floorSheet1) {
    variants.push(
      ...createObservedFloorVariants(
        floorSheet1,
        'office-floors-1',
        observedFloorPositions(17),
        officeFloorSheet1Names
      )
    );
  }

  if (wallSheet) {
    variants.push(
      ...createObservedWallVariants(
        wallSheet,
        'walls-1',
        observedWallSheetPositions(),
        officeWallSheetNames
      )
    );
  }

  return variants;
}

function createObservedFloorVariants(
  sheetAsset: ObservatoryAssetDefinition,
  variantPrefix: string,
  positions: Array<{ x: number; y: number }>,
  labels: string[]
): ObservatoryAssetDefinition[] {
  if (sheetAsset.source.kind !== 'spritesheet') {
    return [];
  }

  const columns = sheetAsset.autotile?.columns ?? 16;
  const tileSize = sheetAsset.autotile?.tileSize ?? sheetAsset.source.frameWidth ?? 32;

  return positions.map((position, index) => ({
    id: `floor:${variantPrefix}:variant-${String(index + 1).padStart(2, '0')}`,
    catalogPath: sheetAsset.catalogPath,
    category: 'floor',
    label:
      labels[index] ??
      `${sheetAsset.label.replace(/ Tile$/u, '').replace(/ Floor$/u, '')} Variant ${String(index + 1).padStart(2, '0')}`,
    source: sheetAsset.source,
    frame: position.y * columns + position.x,
    width: tileSize,
    height: tileSize,
    autotile: {
      columns,
      kind: 'rpgmaker-a2-ground',
      set: {
        x: position.x,
        y: position.y,
        width: 2,
        height: 3,
      },
      tileSize,
    },
    semanticId: `floor:${variantPrefix}:variant-${String(index + 1).padStart(2, '0')}`,
    tags: Array.from(
      new Set([...(sheetAsset.tags ?? []), 'surface-variant', 'builder-surface-variant'])
    ).filter((tag) => tag !== 'builder-hidden'),
  }));
}

function createObservedWallVariants(
  sheetAsset: ObservatoryAssetDefinition,
  variantPrefix: string,
  positions: Array<{ x: number; y: number }>,
  labels: string[]
): ObservatoryAssetDefinition[] {
  if (sheetAsset.source.kind !== 'spritesheet') {
    return [];
  }

  const columns = sheetAsset.autotile?.columns ?? 16;
  const tileSize = sheetAsset.autotile?.tileSize ?? sheetAsset.source.frameWidth ?? 32;
  const setHeight = sheetAsset.autotile?.set.height ?? 5;

  return positions.map((position, index) => ({
    id: `wall:${variantPrefix}:variant-${String(index + 1).padStart(2, '0')}`,
    catalogPath: sheetAsset.catalogPath,
    category: 'wall',
    label:
      labels[index] ??
      `${sheetAsset.label.replace(/ Wall$/u, '')} Variant ${String(index + 1).padStart(2, '0')}`,
    source: sheetAsset.source,
    frame: position.y * columns + position.x,
    width: tileSize,
    height: tileSize,
    autotile: {
      columns,
      kind: 'rpgmaker-a4-wall',
      set: {
        x: position.x,
        y: position.y,
        width: 2,
        height: setHeight,
      },
      sourceLayout: sheetAsset.autotile?.sourceLayout,
      tileSize,
    },
    semanticId: `wall:${variantPrefix}:variant-${String(index + 1).padStart(2, '0')}`,
    tags: Array.from(
      new Set([...(sheetAsset.tags ?? []), 'surface-variant', 'builder-surface-variant'])
    ).filter((tag) => tag !== 'builder-hidden'),
  }));
}

function observedFloorPositions(count: number) {
  const positions: Array<{ x: number; y: number }> = [];
  const rowSpecs = [
    { columns: 8, y: 0 },
    { columns: 8, y: 3 },
    { columns: 1, y: 6 },
  ];

  for (const row of rowSpecs) {
    for (let column = 0; column < row.columns && positions.length < count; column += 1) {
      positions.push({ x: column * 2, y: row.y });
    }
  }

  return positions;
}

function observedWallSheetPositions() {
  const positions: Array<{ x: number; y: number }> = [];

  for (let column = 0; column < 4; column += 1) {
    positions.push({ x: column * 2, y: 0 });
  }

  return positions;
}

export const observatoryModuleAssetRegistry: ObservatoryAssetRegistry = {
  registryVersion: OBSERVATORY_ASSET_REGISTRY_VERSION,
  assetPackVersion: 'observatory-office-pack-v1',
  assets: buildRuntimeCuratedAssets([
    ...observatoryRuntimeFurnitureAssets,
    {
      id: 'floor:office-blue',
      catalogPath: 'floors/Floors_1.png',
      category: 'floor',
      label: 'Office Blue Floor Tile',
      source: {
        kind: 'spritesheet',
        uri: uri(floorTiles),
        frameWidth: 32,
        frameHeight: 32,
      },
      frame: 50,
      width: 32,
      height: 32,
      autotile: {
        columns: 16,
        kind: 'rpgmaker-a2-ground',
        set: { x: 2, y: 3, width: 2, height: 3 },
        tileSize: 32,
      },
      semanticId: 'floor:office:blue-tile',
      tags: ['office-pack', 'tile', 'floor', 'rpgmaker-a2', 'builder-hidden'],
    },
    {
      id: 'floor:office-gray',
      catalogPath: 'floors/Floors_1.png',
      category: 'floor',
      label: 'Office Gray Floor Tile',
      source: {
        kind: 'spritesheet',
        uri: uri(floorTiles),
        frameWidth: 32,
        frameHeight: 32,
      },
      frame: 8,
      width: 32,
      height: 32,
      autotile: {
        columns: 16,
        kind: 'rpgmaker-a2-ground',
        set: { x: 8, y: 0, width: 2, height: 3 },
        tileSize: 32,
      },
      semanticId: 'floor:office:gray-tile',
      tags: ['office-pack', 'tile', 'floor', 'gray', 'rpgmaker-a2', 'builder-hidden'],
    },
    {
      id: 'wall:office-partition',
      catalogPath: 'walls/Walls_1.png',
      category: 'wall',
      label: 'Brown Brick Office Divider',
      source: {
        kind: 'spritesheet',
        uri: uri(wallTiles),
        frameWidth: 48,
        frameHeight: 48,
      },
      frame: 4,
      width: 48,
      height: 48,
      autotile: {
        columns: 16,
        kind: 'rpgmaker-a4-wall',
        set: { x: 4, y: 0, width: 2, height: 3 },
        sourceLayout: {
          blockCount: 4,
          blockWidth: 96,
          colorKey: '#1a1c2c',
          faceY: 144,
          topY: 0,
          x: 0,
        },
        tileSize: 48,
      },
      semanticId: 'wall:office:partition',
      tags: ['office-pack', 'tile', 'wall', 'rpgmaker-a4', 'builder-hidden'],
    },
    {
      id: 'wall:office-exterior',
      catalogPath: 'walls/Walls_1.png',
      category: 'wall',
      label: 'White Grid Building Perimeter',
      source: {
        kind: 'spritesheet',
        uri: uri(wallTiles),
        frameWidth: 48,
        frameHeight: 48,
      },
      frame: 6,
      width: 48,
      height: 48,
      autotile: {
        columns: 16,
        kind: 'rpgmaker-a4-wall',
        set: { x: 6, y: 0, width: 2, height: 3 },
        sourceLayout: {
          blockCount: 4,
          blockWidth: 96,
          colorKey: '#1a1c2c',
          faceY: 144,
          topY: 0,
          x: 0,
        },
        tileSize: 48,
      },
      semanticId: 'wall:office:exterior',
      tags: ['office-pack', 'tile', 'wall', 'exterior', 'rpgmaker-a4', 'builder-hidden'],
    },
    {
      id: 'furniture:ops-workstation',
      catalogPath: 'furnitures/1_Modern_Office_Singles_48x48/server-workbench-with-tools.png',
      category: 'furniture',
      label: 'Server Workbench With Tools',
      source: {
        kind: 'image',
        uri: uri(opsWorkstationFront),
      },
      width: 96,
      height: 144,
      anchor: { x: 0, y: 0 },
      collision: { width: 2, height: 2 },
      semanticId: 'furniture:desk:ops-workstation',
      tags: ['office-pack', 'desk', 'runtime', 'server', 'workbench', 'workstation'],
    },
    {
      id: 'decor:planning-whiteboard',
      catalogPath: 'furnitures/1_Modern_Office_Singles_48x48/planning-whiteboard-chart.png',
      category: 'decor',
      label: 'Planning Whiteboard',
      source: {
        kind: 'image',
        uri: uri(planningWhiteboard),
      },
      width: 96,
      height: 144,
      anchor: { x: 0, y: 0 },
      collision: { width: 2, height: 2 },
      semanticId: 'decor:planning:whiteboard',
      tags: ['office-pack', 'planning', 'whiteboard'],
    },
    {
      id: 'decor:agent-laptop',
      catalogPath: 'furnitures/1_Modern_Office_Singles_48x48/compact-gray-laptop.png',
      category: 'decor',
      label: 'Agent Laptop',
      source: {
        kind: 'image',
        uri: uri(agentLaptop),
      },
      width: 48,
      height: 48,
      anchor: { x: 0, y: 0 },
      semanticId: 'decor:workstation:agent-laptop',
      tags: ['office-pack', 'dynamic', 'laptop', 'work-device'],
    },
    {
      id: 'human:atlas',
      catalogPath: 'characters/Character_48x48_01.png',
      category: 'human',
      label: 'Atlas Character',
      source: {
        kind: 'spritesheet',
        uri: uri(characterAtlas),
        frameWidth: 48,
        frameHeight: characterFrameHeight,
      },
      frame: defaultCharacterFrame,
      characterActions: characterActions(),
      characterSheet: characterSheet(),
      width: 48,
      height: characterFrameHeight,
      anchor: { x: 0.5, y: 0.5 },
      semanticId: 'human:agent:atlas',
      tags: ['office-pack', 'agent', 'character'],
    },
    {
      id: 'human:byte',
      catalogPath: 'characters/Character_48x48_02.png',
      category: 'human',
      label: 'Byte Character',
      source: {
        kind: 'spritesheet',
        uri: uri(characterByte),
        frameWidth: 48,
        frameHeight: characterFrameHeight,
      },
      frame: defaultCharacterFrame,
      characterActions: characterActions(),
      characterSheet: characterSheet(),
      width: 48,
      height: characterFrameHeight,
      anchor: { x: 0.5, y: 0.5 },
      semanticId: 'human:agent:byte',
      tags: ['office-pack', 'agent', 'character'],
    },
    {
      id: 'human:clio',
      catalogPath: 'characters/Character_48x48_03.png',
      category: 'human',
      label: 'Clio Character',
      source: {
        kind: 'spritesheet',
        uri: uri(characterClio),
        frameWidth: 48,
        frameHeight: characterFrameHeight,
      },
      frame: defaultCharacterFrame,
      characterActions: characterActions(),
      characterSheet: characterSheet(),
      width: 48,
      height: characterFrameHeight,
      anchor: { x: 0.5, y: 0.5 },
      semanticId: 'human:agent:clio',
      tags: ['office-pack', 'agent', 'character'],
    },
    {
      id: 'human:delta',
      catalogPath: 'characters/Character_48x48_04.png',
      category: 'human',
      label: 'Delta Character',
      source: {
        kind: 'spritesheet',
        uri: uri(characterDelta),
        frameWidth: 48,
        frameHeight: characterFrameHeight,
      },
      frame: defaultCharacterFrame,
      characterActions: characterActions(),
      characterSheet: characterSheet(),
      width: 48,
      height: characterFrameHeight,
      anchor: { x: 0.5, y: 0.5 },
      semanticId: 'human:agent:delta',
      tags: ['office-pack', 'agent', 'character'],
    },
    {
      id: 'human:echo',
      catalogPath: 'characters/Character_48x48_05.png',
      category: 'human',
      label: 'Echo Character',
      source: {
        kind: 'spritesheet',
        uri: uri(characterEcho),
        frameWidth: 48,
        frameHeight: characterFrameHeight,
      },
      frame: defaultCharacterFrame,
      characterActions: characterActions(),
      characterSheet: characterSheet(),
      width: 48,
      height: characterFrameHeight,
      anchor: { x: 0.5, y: 0.5 },
      semanticId: 'human:agent:echo',
      tags: ['office-pack', 'agent', 'character'],
    },
  ]),
};

export function getObservatoryModuleAssetRegistry(): ObservatoryValidatedAssetRegistry {
  return validateObservatoryAssetRegistry(observatoryModuleAssetRegistry);
}
