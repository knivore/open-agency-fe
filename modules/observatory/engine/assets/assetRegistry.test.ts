import { describe, expect, it } from 'vitest';

import {
  OBSERVATORY_ASSET_REGISTRY_VERSION,
  filterObservatoryAssetRegistry,
  validateObservatoryAssetRegistry,
} from '@/modules/observatory/engine/assets/assetRegistry';
import {
  observatoryAssetCatalogEntries,
  observatoryAssetCatalogSummary,
} from '@/modules/observatory/engine/assets/assetCatalog';
import {
  summarizeObservatoryCatalogCoverage,
  validateObservatoryAssetCatalogEntries,
} from '@/modules/observatory/engine/assets/assetCatalogValidation';
import {
  observatoryCuratedAssetOverrides,
  observatoryGeneratedAssetCandidates,
  observatoryGeneratedAssetInventoryEntries,
  summarizeObservatoryAssetPipeline,
} from '@/modules/observatory/engine/assets/assetPipeline';
import { filterObservatoryRegistryForMap } from '@/modules/observatory/engine/assets/assetUsage';
import { getObservatoryPaletteAssets } from '@/modules/observatory/engine/assets/assetsPalette';
import { validateObservatoryCharacterActionManifest } from '@/modules/observatory/engine/assets/characterActionManifestValidation';
import { getObservatoryFullModuleAssetRegistry } from '@/modules/observatory/engine/assets/moduleFullAssetRegistry';
import sampleLayout from '@/modules/observatory/engine/world/sampleLayout.json';
import { validateObservatoryLayout } from '@/modules/observatory/engine/world/layoutValidation';

describe('observatory pixel asset registry', () => {
  it('preserves semantic, anchor, and collision metadata for valid assets', () => {
    const registry = validateObservatoryAssetRegistry({
      assetPackVersion: 'test-pack',
      assets: [
        {
          id: 'furniture:test-desk',
          anchor: { x: 0.25, y: 0.75 },
          category: 'furniture',
          collision: { height: 1, offsetX: 0.5, offsetY: 1, width: 2 },
          label: 'Test Desk',
          semanticId: 'furniture:desk:test',
          source: { kind: 'image', uri: '/test.png' },
          tags: ['test'],
        },
      ],
      registryVersion: OBSERVATORY_ASSET_REGISTRY_VERSION,
    });

    expect(registry.invalidAssets).toEqual([]);
    expect(registry.assets[0]).toMatchObject({
      anchor: { x: 0.25, y: 0.75 },
      collision: { height: 1, offsetX: 0.5, offsetY: 1, width: 2 },
      semanticId: 'furniture:desk:test',
    });
  });

  it('preserves RPG Maker autotile metadata for A2/A4 sheets', () => {
    const registry = validateObservatoryAssetRegistry({
      assetPackVersion: 'test-pack',
      assets: [
        {
          id: 'floor:test-a2',
          autotile: {
            columns: 16,
            kind: 'rpgmaker-a2-ground',
            set: { height: 3, width: 2, x: 0, y: 0 },
            tileSize: 32,
          },
          category: 'floor',
          label: 'Test A2 Floor',
          source: { frameHeight: 32, frameWidth: 32, kind: 'spritesheet', uri: '/a2.png' },
        },
      ],
      registryVersion: OBSERVATORY_ASSET_REGISTRY_VERSION,
    });

    expect(registry.invalidAssets).toEqual([]);
    expect(registry.assets[0]?.autotile).toEqual({
      columns: 16,
      kind: 'rpgmaker-a2-ground',
      set: { height: 3, width: 2, x: 0, y: 0 },
      tileSize: 32,
    });
  });

  it('rejects invalid RPG Maker autotile metadata safely', () => {
    const registry = validateObservatoryAssetRegistry({
      assetPackVersion: 'test-pack',
      assets: [
        {
          id: 'wall:bad-a4',
          autotile: {
            columns: 0,
            kind: 'rpgmaker-a4-wall',
            set: { height: 5, width: 2, x: 0, y: 0 },
            tileSize: 32,
          },
          category: 'wall',
          label: 'Bad A4 Wall',
          source: { frameHeight: 32, frameWidth: 32, kind: 'spritesheet', uri: '/a4.png' },
        },
      ],
      registryVersion: OBSERVATORY_ASSET_REGISTRY_VERSION,
    });

    expect(registry.assets).toEqual([]);
    expect(registry.invalidAssets[0]).toMatchObject({
      assetId: 'wall:bad-a4',
      reason: 'autotile.columns must be a positive integer',
    });
  });

  it('preserves character action manifests with loop windows', () => {
    const registry = validateObservatoryAssetRegistry({
      assetPackVersion: 'test-pack',
      assets: [
        {
          id: 'human:test-agent',
          characterActions: [
            {
              action: 'idle',
              direction: 'down',
              endFrame: 79,
              frameCount: 6,
              frameRate: 5,
              priority: 'office',
              row: 2,
              startFrame: 74,
            },
            {
              action: 'phone',
              endFrame: 347,
              frameCount: 12,
              frameRate: 7,
              loopEndFrame: 344,
              loopStartFrame: 339,
              priority: 'office',
              row: 7,
              startFrame: 336,
            },
          ],
          category: 'human',
          label: 'Test Agent',
          source: { frameHeight: 48, frameWidth: 48, kind: 'spritesheet', uri: '/agent.png' },
        },
      ],
      registryVersion: OBSERVATORY_ASSET_REGISTRY_VERSION,
    });

    expect(registry.invalidAssets).toEqual([]);
    expect(registry.assets[0]?.characterActions).toHaveLength(2);
    expect(registry.assets[0]?.characterActions?.[1]).toMatchObject({
      action: 'phone',
      loopEndFrame: 344,
      loopStartFrame: 339,
    });
  });

  it('rejects invalid anchor and collision metadata safely', () => {
    const registry = validateObservatoryAssetRegistry({
      assetPackVersion: 'test-pack',
      assets: [
        {
          id: 'decor:bad-anchor',
          anchor: { x: 2, y: 0.5 },
          category: 'decor',
          label: 'Bad Anchor',
          source: { kind: 'image', uri: '/bad-anchor.png' },
        },
        {
          id: 'decor:bad-collision',
          category: 'decor',
          collision: { height: 1, width: 0 },
          label: 'Bad Collision',
          source: { kind: 'image', uri: '/bad-collision.png' },
        },
      ],
      registryVersion: OBSERVATORY_ASSET_REGISTRY_VERSION,
    });

    expect(registry.assets).toEqual([]);
    expect(registry.invalidAssets.map((asset) => asset.assetId)).toEqual([
      'decor:bad-anchor',
      'decor:bad-collision',
    ]);
  });

  it('can filter a registry to current-map assets only', () => {
    const validatedLayout = validateObservatoryLayout(sampleLayout);
    const map = validatedLayout.layout?.world.maps[0];

    expect(map).toBeDefined();

    const registry = getObservatoryFullModuleAssetRegistry();
    const filteredRegistry = filterObservatoryRegistryForMap(registry, map!);
    const filteredIds = filteredRegistry.assets.map((asset) => asset.id);

    expect(filteredIds).toContain('floor:office-blue');
    expect(filteredIds).toContain('wall:office-partition');
    expect(filteredIds).toContain(
      'furniture:1-modern-office-singles-48x48:modern-office-multi-monitor-control-station'
    );
    expect(filteredIds).toContain('human:echo');
    expect(filteredIds).not.toContain('missing:asset');
    expect(filteredRegistry.assets.length).toBeLessThanOrEqual(registry.assets.length);
  });

  it('can filter a registry by an explicit allowlist', () => {
    const registry = getObservatoryFullModuleAssetRegistry();
    const filteredRegistry = filterObservatoryAssetRegistry(registry, [
      'human:atlas',
      'furniture:1-modern-office-singles-48x48:office-water-cooler',
    ]);

    expect(filteredRegistry.assets.map((asset) => asset.id)).toEqual([
      'furniture:1-modern-office-singles-48x48:office-water-cooler',
      'human:atlas',
    ]);
    expect(filteredRegistry.invalidAssets).toBe(registry.invalidAssets);
  });

  it('crops spritesheet previews to the selected frame for the builder palette', () => {
    const paletteAssets = getObservatoryPaletteAssets({ includeUnreviewed: true });
    const wallPreviews = paletteAssets
      .filter((asset) => asset.assetId.startsWith('wall:walls-1:variant-'))
      .sort((a, b) => a.assetId.localeCompare(b.assetId));

    expect(wallPreviews.map((asset) => asset.previewCrop)).toEqual([
      expect.objectContaining({ height: 48, width: 48, x: 0, y: 144 }),
      expect.objectContaining({ height: 48, width: 48, x: 96, y: 144 }),
      expect.objectContaining({ height: 48, width: 48, x: 192, y: 144 }),
      expect.objectContaining({ height: 48, width: 48, x: 288, y: 144 }),
    ]);
  });

  it('keeps furniture source canvases as the placement footprint while cropping previews', () => {
    const registry = getObservatoryFullModuleAssetRegistry();
    const terminal = registry.assets.find(
      (asset) =>
        asset.id ===
        'furniture:1-modern-office-singles-48x48:modern-office-green-circuit-board-terminal'
    );
    const terminalPreview = getObservatoryPaletteAssets({ includeUnreviewed: true }).find(
      (asset) =>
        asset.assetId ===
        'furniture:1-modern-office-singles-48x48:modern-office-green-circuit-board-terminal'
    );

    expect(terminal).toMatchObject({
      collision: {
        height: 2,
        offsetY: 1,
        width: 1,
      },
      height: 144,
      previewCrop: {
        height: 45,
        width: 36,
        x: 9,
        y: 81,
      },
      width: 96,
    });
    expect(terminalPreview?.footprint).toEqual({ height: 3, width: 2 });
    expect(terminalPreview?.previewCrop).toMatchObject({
      height: 45,
      sourceHeight: 144,
      sourceWidth: 96,
      width: 36,
      x: 9,
      y: 81,
    });
  });

  it('renders furniture at source dimensions while using crop-derived collision', () => {
    const registry = getObservatoryFullModuleAssetRegistry();
    const chair = registry.assets.find(
      (asset) =>
        asset.id === 'furniture:1-modern-office-singles-48x48:modern-office-gray-office-chair-front'
    );
    const chairPreview = getObservatoryPaletteAssets({ includeUnreviewed: true }).find(
      (asset) =>
        asset.assetId ===
        'furniture:1-modern-office-singles-48x48:modern-office-gray-office-chair-front'
    );

    expect(chair).toMatchObject({
      collision: {
        height: 2,
        offsetY: 1,
        width: 1,
      },
      height: 144,
      previewCrop: {
        height: 63,
        width: 48,
        x: 0,
        y: 75,
      },
      width: 96,
    });
    expect(chairPreview?.footprint).toEqual({ height: 3, width: 2 });
    expect(chairPreview?.previewCrop).toMatchObject({
      height: 63,
      sourceHeight: 144,
      sourceWidth: 96,
      width: 48,
      x: 0,
      y: 75,
    });
  });

  it('summarizes full catalog coverage against the live registry', () => {
    const registry = getObservatoryFullModuleAssetRegistry();
    const coverage = summarizeObservatoryCatalogCoverage(registry, observatoryAssetCatalogSummary);

    expect(coverage.catalogFileCount).toBe(observatoryAssetCatalogEntries.length);
    expect(observatoryAssetCatalogEntries.length).toBeGreaterThan(100);
    expect(
      observatoryAssetCatalogEntries.some(
        (entry) => entry.path === 'characters/Character_48x48_01.png'
      )
    ).toBe(true);
    expect(
      observatoryAssetCatalogEntries.some(
        (entry) =>
          entry.path === 'floors/Floors_1.png' && entry.width === 512 && entry.height === 384
      )
    ).toBe(true);
    expect(
      observatoryAssetCatalogEntries.some(
        (entry) =>
          entry.path === 'furnitures/1_Modern_Office_Singles_48x48/server-workbench-with-tools.png'
      )
    ).toBe(true);
    expect(coverage.registeredAssetCount).toBe(registry.assets.length);
    expect(coverage.registeredAssetCount).toBeGreaterThan(100);
    expect(coverage.coverageRatio).toBeGreaterThanOrEqual(1);
    expect(registry.assets.some((asset) => asset.id === 'floor:office-blue')).toBe(true);
    expect(registry.assets.some((asset) => asset.id === 'furniture:ops-workstation')).toBe(true);
    expect(registry.assets.some((asset) => asset.id === 'decor:planning-whiteboard')).toBe(true);
    expect(
      registry.assets.find(
        (asset) =>
          asset.id === 'furniture:1-modern-office-singles-48x48:server-workbench-with-tools'
      )?.sourceCrop
    ).toEqual({
      height: 96,
      width: 78,
      x: 12,
      y: 21,
    });
    expect(registry.assets.some((asset) => asset.id === 'generated:floors-a2-office-floors')).toBe(
      false
    );
    expect(validateObservatoryAssetCatalogEntries(observatoryAssetCatalogEntries)).toEqual([]);
  });

  it('keeps generated inventory, registry candidates, and curated overrides in sync', () => {
    const registry = getObservatoryFullModuleAssetRegistry();
    const pipeline = summarizeObservatoryAssetPipeline();
    const candidatePaths = new Set(
      observatoryGeneratedAssetCandidates.map((candidate) => candidate.catalogPath)
    );

    expect(observatoryGeneratedAssetInventoryEntries.length).toBe(
      observatoryAssetCatalogEntries.length
    );
    expect(observatoryGeneratedAssetCandidates.length).toBe(observatoryAssetCatalogEntries.length);
    expect(pipeline.inventoryFileCount).toBe(observatoryAssetCatalogEntries.length);
    expect(pipeline.generatedCandidateCount).toBe(observatoryAssetCatalogEntries.length);
    expect(pipeline.reviewedOverrideCount).toBe(observatoryCuratedAssetOverrides.length);
    expect(pipeline.highPriorityGeneratedCount).toBeGreaterThan(0);

    for (const override of observatoryCuratedAssetOverrides) {
      expect(candidatePaths.has(override.catalogPath)).toBe(true);
      expect(registry.assets.some((asset) => asset.id === override.assetId)).toBe(true);
    }
  });

  it('registers office and documented character action metadata for curated humans', () => {
    const registry = getObservatoryFullModuleAssetRegistry();
    const atlas = registry.assets.find((asset) => asset.id === 'human:atlas');

    expect(atlas?.frame).toBe(3);
    expect(atlas?.source.frameHeight).toBe(96);
    expect(atlas?.height).toBe(96);
    expect(
      atlas?.characterActions?.some(
        (action) => action.action === 'phone' && action.loopStartFrame === 339
      )
    ).toBe(true);
    expect(
      atlas?.characterActions?.some(
        (action) => action.action === 'reading' && action.loopEndFrame === 397
      )
    ).toBe(true);
    expect(
      atlas?.characterActions?.some(
        (action) => action.action === 'push-cart' && action.frameCount === 6
      )
    ).toBe(true);
    expect(
      atlas?.characterActions?.some(
        (action) => action.action === 'shoot' && action.priority === 'documented'
      )
    ).toBe(true);
  });

  it('keeps the retained five character sheets registered with deterministic action metadata', () => {
    const registry = getObservatoryFullModuleAssetRegistry();
    const retainedCharacters = registry.assets.filter(
      (asset) => asset.category === 'human' && asset.catalogPath?.startsWith('characters/')
    );
    const atlas = registry.assets.find((asset) => asset.id === 'human:atlas');

    expect(retainedCharacters.map((asset) => asset.catalogPath).sort()).toEqual([
      'characters/Character_48x48_01.png',
      'characters/Character_48x48_02.png',
      'characters/Character_48x48_03.png',
      'characters/Character_48x48_04.png',
      'characters/Character_48x48_05.png',
    ]);
    expect(atlas).toMatchObject({ category: 'human', frame: 3, height: 96 });
    expect(
      atlas?.characterActions?.some(
        (action) =>
          action.action === 'idle' && action.direction === 'down' && action.startFrame === 74
      )
    ).toBe(true);
    expect(
      atlas?.characterActions?.some(
        (action) =>
          action.action === 'phone' && action.loopStartFrame === 339 && action.loopEndFrame === 344
      )
    ).toBe(true);
  });

  it('registers local A2 floors and the active A4 wall sheet as RPG Maker autotiles', () => {
    const registry = getObservatoryFullModuleAssetRegistry();
    const floor = registry.assets.find((asset) => asset.id === 'floor:office-blue');
    const wall = registry.assets.find((asset) => asset.id === 'wall:office-partition');

    expect(floor).toMatchObject({
      source: { frameWidth: 32, frameHeight: 32 },
      autotile: {
        columns: 16,
        kind: 'rpgmaker-a2-ground',
        set: { height: 3, width: 2, x: 2, y: 3 },
        tileSize: 32,
      },
    });
    expect(wall).toMatchObject({
      source: { frameWidth: 48, frameHeight: 48 },
      autotile: {
        columns: 16,
        kind: 'rpgmaker-a4-wall',
        set: { height: 3, width: 2, x: 4, y: 0 },
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
    });
  });

  it('validates curated character action frame windows against the declared sheet structure', () => {
    const registry = getObservatoryFullModuleAssetRegistry();
    const humanAssets = registry.assets.filter((asset) => asset.category === 'human');
    const issues = humanAssets.flatMap((asset) =>
      validateObservatoryCharacterActionManifest(asset)
    );

    expect(issues).toEqual([]);
  });
});
