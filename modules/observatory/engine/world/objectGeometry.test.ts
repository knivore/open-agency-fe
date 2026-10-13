import { describe, expect, it } from 'vitest';
import {
  observatoryAssetPlacement,
  observatoryObjectVisibleBounds,
  scaleObservatoryObject,
} from './objectGeometry';
import type { ObservatoryAssetDefinition } from '../assets/assetRegistry';
import type { ObservatoryObject } from './layoutTypes';
import { getObservatoryFullModuleAssetRegistry } from '../assets/moduleFullAssetRegistry';
import { getObservatoryPaletteAssets } from '../assets/assetsPalette';

const desk: ObservatoryAssetDefinition = {
  id: 'furniture:desk',
  label: 'Wide Beige Desk Front',
  category: 'furniture',
  width: 96,
  height: 144,
  source: { kind: 'image', uri: '/desk.png' },
  sourceCrop: { x: 0, y: 48, width: 96, height: 57 },
};

describe('crop-aware office geometry', () => {
  it('shows pantry cabinet floor depth consistently in the palette and placed geometry', () => {
    const assets = getObservatoryFullModuleAssetRegistry().assets;
    const palette = getObservatoryPaletteAssets();
    for (const [id, width] of [
      ['decor:pantry-kitchenette', 3],
      ['decor:pantry-fridge', 1],
    ] as const) {
      const asset = assets.find((asset) => asset.id === id)!;
      const placement = observatoryAssetPlacement(asset);
      expect(placement.size).toEqual({ width, height: 1 });
      expect(palette.find((asset) => asset.assetId === id)?.footprint).toEqual(placement.size);
      const bounds = observatoryObjectVisibleBounds(
        { id: 'fixture', assetId: id, position: { x: 4, y: 4 }, ...placement },
        asset
      );
      expect(bounds.y + bounds.height).toBe(5 * 48);
    }
  });
  it('places the visible sprite at the grid origin rather than reserving its padding', () => {
    const placement = observatoryAssetPlacement(desk);
    const object: ObservatoryObject = {
      id: 'object:desk',
      assetId: desk.id,
      position: { x: 2, y: 3 },
      ...placement,
    };
    expect(placement.size).toEqual({ width: 2, height: 2 });
    expect(placement.blocksMovement).toBe(true);
    expect(observatoryObjectVisibleBounds(object, desk)).toEqual({
      x: 96,
      y: 144,
      width: 96,
      height: 57,
    });
  });
  it('scales proportionally and preserves the visible anchor, including custom offsets', () => {
    const object: ObservatoryObject = {
      id: 'object:desk',
      assetId: desk.id,
      position: { x: 2, y: 3 },
      ...observatoryAssetPlacement(desk),
    };
    object.render!.offsetPx!.x = 6;
    const scaled = { ...object, ...scaleObservatoryObject(object, desk, 0.5) };
    expect(scaled.render?.sizePx).toEqual({ width: 48, height: 72 });
    expect(observatoryObjectVisibleBounds(scaled, desk)).toEqual({
      x: 102,
      y: 144,
      width: 48,
      height: 28.5,
    });
    const reset = { ...scaled, ...scaleObservatoryObject(scaled, desk, 1) };
    expect(observatoryObjectVisibleBounds(reset, desk)).toEqual(
      observatoryObjectVisibleBounds(object, desk)
    );
  });
  it('makes tabletop props pass-through without making complete workbenches pass-through', () => {
    expect(
      observatoryAssetPlacement({
        ...desk,
        label: 'Anglepoise Desk Lamp',
        sourceCrop: { x: 0, y: 51, width: 45, height: 51 },
      })
    ).toMatchObject({ blocksMovement: false, size: { width: 1, height: 2 } });
    expect(
      observatoryAssetPlacement({ ...desk, label: 'Server Workbench With Tools' }).blocksMovement
    ).toBe(true);
  });
});
