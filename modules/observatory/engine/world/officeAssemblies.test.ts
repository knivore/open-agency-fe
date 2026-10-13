import { describe, expect, it } from 'vitest';
import published from '../../layouts/publishedLayout.json';
import type { ObservatoryLayoutDocument } from './layoutTypes';
import { cloneObservatoryLayout, createBlankObservatoryLayout } from './layoutEditing';
import {
  createOfficePreset,
  createOfficeAssetAssembly,
  deleteOfficeAssembly,
  duplicateOfficeAssembly,
  moveOfficeAssembly,
  observatoryObjectGroup,
  officePresetOptions,
  placeOfficeAssembly,
} from './officeAssemblies';
import { getObservatoryFullModuleAssetRegistry } from '../assets/moduleFullAssetRegistry';

function fixture() {
  const layout = cloneObservatoryLayout(published as ObservatoryLayoutDocument);
  const map = layout.world.maps[0];
  map.objects = [];
  map.agents = [];
  map.rooms = [
    {
      id: 'room',
      name: 'Office',
      kind: 'workspace',
      bounds: { x: 0, y: 0, width: 24, height: 16 },
    },
  ];
  return layout;
}
describe('office assemblies', () => {
  it('completes a wide desk placed directly from the asset palette', () => {
    const assets = new Map(
      getObservatoryFullModuleAssetRegistry().assets.map((asset) => [asset.id, asset])
    );
    const desk = assets.get(
      'furniture:1-modern-office-singles-48x48:modern-office-wide-white-desk-front'
    )!;
    const parts = createOfficeAssetAssembly(desk, { x: 4, y: 4 }, assets);
    expect(parts).toHaveLength(2);
    expect(parts[1].runtime).toEqual({ role: 'surface-trim', targetObjectId: parts[0].id });
    expect(parts[1].render?.sourceCrop?.width).toBe(48);
    expect(placeOfficeAssembly(fixture(), 'map:level-1', parts, 'room').changed).toBe(true);
  });
  it.each(officePresetOptions)('places the complete $label with valid parent links', ({ id }) => {
    const layout = fixture();
    const map = layout.world.maps[0];
    const result = placeOfficeAssembly(
      layout,
      map.id,
      createOfficePreset(id, 'white', { x: 4, y: 4 }),
      'room'
    );
    expect(result.changed).toBe(true);
    expect(
      observatoryObjectGroup(result.layout.world.maps[0], result.selectedObjectId!).length
    ).toBeGreaterThan(1);
    expect(map.objects).toHaveLength(0);
  });
  it('moves all linked parts atomically and rolls back an invalid move', () => {
    const layout = fixture();
    const mapId = layout.world.maps[0].id;
    const placed = placeOfficeAssembly(
      layout,
      mapId,
      createOfficePreset('desktop', 'beige', { x: 4, y: 4 }),
      'room'
    );
    const moved = moveOfficeAssembly(placed.layout, mapId, placed.selectedObjectId!, {
      x: 7,
      y: 4,
    });
    expect(moved.changed).toBe(true);
    expect(moved.layout.world.maps[0].objects.map((object) => object.position.x)).toEqual([
      7, 7, 7, 7, 7,
    ]);
    const invalid = moveOfficeAssembly(moved.layout, mapId, placed.selectedObjectId!, {
      x: -1,
      y: 4,
    });
    expect(invalid.changed).toBe(false);
    expect(invalid.layout).toEqual(moved.layout);
  });
  it('places and clears only the selected floor while preserving map order', () => {
    const layout = fixture();
    const first = JSON.stringify(layout.world.maps[0]);
    const second = layout.world.maps[1];
    second.objects = [];
    second.agents = [];
    second.rooms = [
      {
        id: 'room:second',
        name: 'Second office',
        kind: 'workspace',
        bounds: { x: 0, y: 0, width: 24, height: 16 },
      },
    ];
    const placed = placeOfficeAssembly(
      layout,
      second.id,
      createOfficePreset('desktop', 'white', { x: 4, y: 4 }),
      'room:second'
    );
    expect(placed.changed).toBe(true);
    expect(JSON.stringify(placed.layout.world.maps[0])).toBe(first);
    expect(placed.layout.world.maps.map((map) => map.id)).toEqual(
      layout.world.maps.map((map) => map.id)
    );
    const blank = createBlankObservatoryLayout(placed.layout, second.id);
    expect(JSON.stringify(blank.world.maps[0])).toBe(first);
    expect(blank.world.maps[1].objects).toEqual([]);
    expect(blank.world.maps[1].rooms).toEqual([]);
  });
  it('rewires duplicates and clears agent targets when deleting a setup', () => {
    const layout = fixture();
    const mapId = layout.world.maps[0].id;
    const placed = placeOfficeAssembly(
      layout,
      mapId,
      createOfficePreset('laptop', 'beige', { x: 4, y: 4 }),
      'room'
    );
    const duplicate = duplicateOfficeAssembly(placed.layout, mapId, placed.selectedObjectId!);
    expect(duplicate.changed).toBe(true);
    const group = observatoryObjectGroup(
      duplicate.layout.world.maps[0],
      duplicate.selectedObjectId!
    );
    expect(group).toHaveLength(4);
    expect(group[1].runtime?.targetObjectId).toBe(group[0].id);
    duplicate.layout.world.maps[0].agents.push({
      id: 'agent',
      name: 'Agent',
      assetId: 'agent:default',
      position: { x: 1, y: 3 },
      status: 'idle',
      runtime: { targetObjectId: group[0].id },
    });
    const deleted = deleteOfficeAssembly(duplicate.layout, mapId, group[1].id);
    expect(deleted.layout.world.maps[0].objects).toHaveLength(4);
    expect(deleted.layout.world.maps[0].agents[0].runtime?.targetObjectId).toBeUndefined();
    expect(deleted.layout.world.maps[1]).toEqual(layout.world.maps[1]);
  });
});
