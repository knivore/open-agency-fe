import { describe, expect, it } from 'vitest';
import published from '../../layouts/publishedLayout.json';
import { getObservatoryFullModuleAssetRegistry } from '../assets/moduleFullAssetRegistry';
import { cloneObservatoryLayout } from './layoutEditing';
import type { ObservatoryLayoutDocument } from './layoutTypes';
import { inspectObservatoryMap } from './layoutInspection';
const assets = new Map(
  getObservatoryFullModuleAssetRegistry().assets.map((asset) => [asset.id, asset])
);
describe('live layout checks', () => {
  it('recognizes all twenty reachable workstations across the furnished floors', () => {
    const results = (published as ObservatoryLayoutDocument).world.maps.map((map) =>
      inspectObservatoryMap(map, assets)
    );
    expect(
      results.flatMap((result) => result.issues.filter((issue) => issue.severity === 'error'))
    ).toEqual([]);
    expect(results.flatMap((result) => result.disconnected)).toEqual([]);
    expect(results.flatMap((result) => result.issues)).toEqual([]);
    expect(results.reduce((count, result) => count + result.workstations, 0)).toBe(20);
    expect(results.reduce((count, result) => count + result.reachableWorkstations, 0)).toBe(20);
  });
  it('reports an overlap and missing interaction target', () => {
    const map = cloneObservatoryLayout(published as ObservatoryLayoutDocument).world.maps[0];
    const desk = map.objects.find((object) => object.blocksMovement)!;
    map.objects.push({
      ...desk,
      id: 'object:overlap',
      runtime: { targetObjectId: 'object:missing' },
    });
    const result = inspectObservatoryMap(map, assets);
    expect(result.issues.some((issue) => issue.message.includes('overlaps'))).toBe(true);
    expect(result.issues.some((issue) => issue.message.includes('target is missing'))).toBe(true);
  });
  it('detects a blocked doorway and an inaccessible workstation', () => {
    const map = cloneObservatoryLayout(published as ObservatoryLayoutDocument).world.maps[0];
    const room = map.rooms.find((candidate) => candidate.wallOpenings?.length)!;
    const door = room.wallOpenings![0];
    map.objects.push({
      id: 'object:blocked-door',
      assetId: map.objects[0].assetId,
      position: door,
      size: { width: 1, height: 1 },
      blocksMovement: true,
    });
    map.objects.push({
      id: 'object:unreachable',
      assetId: map.objects[0].assetId,
      position: { x: map.size.width - 1, y: map.size.height - 1 },
      size: { width: 1, height: 1 },
      blocksMovement: true,
      runtime: { role: 'workstation' },
    });
    const result = inspectObservatoryMap(map, assets);
    expect(result.issues.some((issue) => issue.message.includes('blocks an entrance'))).toBe(true);
    expect(
      result.issues.some(
        (issue) =>
          issue.objectId === 'object:unreachable' && issue.message.includes('cannot be reached')
      )
    ).toBe(true);
  });
});
