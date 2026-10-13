import { getObservatoryFullModuleAssetRegistry } from '../assets/moduleFullAssetRegistry';
import { findObservatoryCollisionSafePlacement } from '../../generation/proceduralLayoutRules';
import { cloneObservatoryLayout, type ObservatoryLayoutEditResult } from './layoutEditing';
import type { ObservatoryLayoutDocument, ObservatoryMap, ObservatoryObject } from './layoutTypes';
import type { ObservatoryGridPoint } from './grid';
import { observatoryAssetPlacement, observatoryObjectVisibleBounds } from './objectGeometry';
import type { ObservatoryAssetDefinition } from '../assets/assetRegistry';

export const officePresetOptions = [
  { id: 'desktop', label: 'Desktop workstation' },
  { id: 'laptop', label: 'Laptop workstation' },
  { id: 'dual', label: 'Dual-monitor workstation' },
  { id: 'meeting', label: 'Four-seat meeting table' },
  { id: 'lab', label: 'Engineering workbench' },
] as const;
export type OfficePresetId = (typeof officePresetOptions)[number]['id'];
export type OfficePresetStyle = 'beige' | 'white';
const prefix = 'furniture:1-modern-office-singles-48x48:';

export function createOfficeAssetAssembly(
  asset: ObservatoryAssetDefinition,
  point: ObservatoryGridPoint,
  assets: Map<string, ObservatoryAssetDefinition>,
  tileSize = 48
): ObservatoryObject[] {
  const object: ObservatoryObject = {
    ...observatoryAssetPlacement(asset, tileSize),
    id: 'preview:asset',
    assetId: asset.id,
    position: point,
  };
  const finish = completeOfficeDeskFront(object, assets, tileSize);
  return finish ? [object, finish] : [object];
}

export function completeOfficeDeskFront(
  desk: ObservatoryObject,
  assets: Map<string, ObservatoryAssetDefinition>,
  tileSize = 48
): ObservatoryObject | null {
  const finishes: Record<string, string> = {
    'modern-office-wide-beige-desk-front': 'modern-office-wide-beige-platform-with-drawer',
    'modern-office-wide-beige-table-front': 'modern-office-wide-beige-platform-front',
    'modern-office-wide-white-desk-front': 'modern-office-wide-white-platform-front',
    'modern-office-wide-gray-desk-front': 'modern-office-wide-gray-platform-front',
    'modern-office-wide-tan-desk-front': 'modern-office-wide-tan-platform-front',
  };
  const finishId = finishes[desk.assetId.replace(prefix, '')];
  const asset = finishId ? assets.get(prefix + finishId) : undefined;
  if (!asset?.sourceCrop) return null;
  const crop = asset.sourceCrop;
  const visible = observatoryObjectVisibleBounds(desk, assets.get(desk.assetId), tileSize);
  const scale = visible.width / 96;
  // These wide sprites are complementary end pieces. Draw only the missing
  // right apron/leg so their overlapping tabletops do not cover desk equipment.
  const sourceCrop = {
    x: crop.x + crop.width - 48,
    y: crop.y + crop.height - 12,
    width: 48,
    height: 12,
  };
  return {
    id: `${desk.id}:front-finish`,
    assetId: asset.id,
    roomId: desk.roomId,
    position: { ...desk.position },
    size: { width: 1, height: 1 },
    blocksMovement: false,
    render: {
      sourceCrop,
      sizePx: { width: (asset.width ?? 96) * scale, height: (asset.height ?? 144) * scale },
      offsetPx: {
        x:
          visible.x +
          visible.width -
          48 * scale -
          desk.position.x * tileSize -
          sourceCrop.x * scale,
        y:
          visible.y +
          visible.height -
          12 * scale -
          desk.position.y * tileSize -
          sourceCrop.y * scale,
      },
      depth: (desk.render?.depth ?? 18) + 0.01,
    },
    runtime: { role: 'surface-trim', targetObjectId: desk.id },
  };
}

export function createOfficePreset(
  preset: OfficePresetId,
  style: OfficePresetStyle,
  point: ObservatoryGridPoint,
  tileSize = 48
): ObservatoryObject[] {
  const assets = getObservatoryFullModuleAssetRegistry().assets;
  const parts: ObservatoryObject[] = [];
  const add = (
    name: string,
    dx: number,
    dy: number,
    px = 0,
    py = 0,
    root = false,
    seat = false
  ) => {
    const asset = assets.find((entry) => entry.id === prefix + name);
    if (!asset) throw new Error(`Preset asset missing: ${name}`);
    const placement = observatoryAssetPlacement(asset, tileSize);
    parts.push({
      ...placement,
      id: `preset:part-${parts.length}`,
      assetId: asset.id,
      position: { x: point.x + dx, y: point.y + dy },
      blocksMovement: root,
      render: {
        ...placement.render,
        depth: root ? 18 : seat ? 24 : 26,
        offsetPx: {
          x: (placement.render.offsetPx?.x ?? 0) + px,
          y: (placement.render.offsetPx?.y ?? 0) + py,
        },
      },
      runtime: root
        ? { role: preset === 'meeting' ? 'planning-surface' : 'workstation' }
        : { targetObjectId: 'preset:part-0', ...(seat ? { role: 'workstation-seat' } : {}) },
    });
  };
  if (preset === 'meeting') {
    add('large-wood-table-vertical', 0, 0, 0, 0, true);
    for (const y of [0, 1]) {
      add('modern-office-gray-office-chair-side-right', -1, y, 0, y === 0 ? -18 : 0, false, true);
      add('modern-office-gray-office-chair-side-left', 2, y, -18, y === 0 ? -18 : 0, false, true);
    }
  } else if (preset === 'lab') {
    add('modern-office-wide-gray-desk-front', 0, 0, 0, 0, true);
    add('dual-monitor-workstation-wide', 0, 0, 0, -18);
    add('modern-office-gray-office-chair-front', 0, 1, 24, 6, false, true);
  } else {
    add(`modern-office-wide-${style}-desk-front`, 0, 0, 0, 0, true);
    if (preset === 'desktop') {
      add('blue-screen-monitor-front', 0, 0, 24, -12);
      add('low-keyboard-dark', 0, 0, 24, 27);
    } else if (preset === 'laptop') add('compact-gray-laptop', 0, 0, 27, 3);
    else add('dual-monitor-workstation-wide', 0, 0, 0, -18);
    add('modern-office-gray-office-chair-front', 0, 1, 24, 6, false, true);
  }
  const finish = completeOfficeDeskFront(
    parts[0],
    new Map(assets.map((asset) => [asset.id, asset])),
    tileSize
  );
  if (finish) parts.push(finish);
  return parts;
}

export function observatoryObjectGroup(
  map: ObservatoryMap,
  objectId: string,
  wholeSetup = true
): ObservatoryObject[] {
  const selected = map.objects.find((object) => object.id === objectId);
  if (!selected) return [];
  if (!wholeSetup) return [selected];
  let root = selected;
  const seen = new Set([root.id]);
  // Existing layouts already link seats and tabletop props to their workstation.
  // Follow those links instead of adding an incompatible editor-only schema.
  while (root.runtime?.targetObjectId) {
    const parent = map.objects.find((object) => object.id === root.runtime?.targetObjectId);
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id);
    root = parent;
  }
  const ids = new Set([root.id]);
  let previousSize = 0;
  while (previousSize !== ids.size) {
    previousSize = ids.size;
    map.objects.forEach((object) => {
      if (object.runtime?.targetObjectId && ids.has(object.runtime.targetObjectId))
        ids.add(object.id);
    });
  }
  return map.objects.filter((object) => ids.has(object.id));
}

export function assemblyPlacementIssue(
  map: ObservatoryMap,
  objects: ObservatoryObject[],
  ignoredIds: string[] = []
): string | null {
  const occupied = map.objects.filter((object) => !ignoredIds.includes(object.id));
  for (const object of objects) {
    const size = object.size ?? { width: 1, height: 1 };
    const { x, y } = object.position;
    if (x < 0 || y < 0 || x + size.width > map.size.width || y + size.height > map.size.height)
      return 'The whole setup must fit inside this floor.';
    const room = map.rooms.find((candidate) => candidate.id === object.roomId);
    if (
      room &&
      (x < room.bounds.x ||
        y < room.bounds.y ||
        x + size.width > room.bounds.x + room.bounds.width ||
        y + size.height > room.bounds.y + room.bounds.height)
    )
      return `The whole setup must fit inside ${room.name}.`;
    if (object.blocksMovement !== false) {
      const safe = findObservatoryCollisionSafePlacement(
        { ...map, objects: occupied },
        size,
        object.position
      );
      if (!safe || safe.x !== x || safe.y !== y)
        return 'Furniture overlaps a wall, doorway, or another blocking object.';
    }
    occupied.push(object);
  }
  return null;
}

function result(
  layout: ObservatoryLayoutDocument,
  message: string,
  changed: boolean,
  selectedObjectId?: string
): ObservatoryLayoutEditResult {
  if (changed)
    layout.metadata = { ...layout.metadata, status: 'draft', updatedAt: new Date().toISOString() };
  return {
    layout,
    changed,
    message,
    selectedObjectId,
    issues: changed ? [] : [{ path: 'objects', reason: message }],
  };
}

function copyWithIds(map: ObservatoryMap, objects: ObservatoryObject[]) {
  const used = new Set(map.objects.map((object) => object.id));
  const ids = new Map<string, string>();
  const idPrefix = `object:setup-${map.id.replace(/:/g, '-')}-`;
  let sequence = 1;
  objects.forEach((object) => {
    while (used.has(`${idPrefix}${sequence}`)) sequence++;
    const id = `${idPrefix}${sequence++}`;
    used.add(id);
    ids.set(object.id, id);
  });
  return objects.map((object) => ({
    ...object,
    id: ids.get(object.id)!,
    runtime: object.runtime
      ? {
          ...object.runtime,
          ...(object.runtime.targetObjectId
            ? {
                targetObjectId:
                  ids.get(object.runtime.targetObjectId) ?? object.runtime.targetObjectId,
              }
            : {}),
        }
      : undefined,
  }));
}

export function placeOfficeAssembly(
  layout: ObservatoryLayoutDocument,
  mapId: string,
  objects: ObservatoryObject[],
  roomId?: string
): ObservatoryLayoutEditResult {
  const next = cloneObservatoryLayout(layout);
  const map = next.world.maps.find((candidate) => candidate.id === mapId);
  if (!map) return result(layout, 'Floor not found.', false);
  const placed = copyWithIds(
    map,
    objects.map((object) => ({ ...object, roomId: roomId ?? object.roomId }))
  );
  const issue = assemblyPlacementIssue(map, placed);
  if (issue) return result(layout, issue, false);
  map.objects.push(...placed);
  return result(next, `Placed ${placed.length} parts together.`, true, placed[0]?.id);
}

export function moveOfficeAssembly(
  layout: ObservatoryLayoutDocument,
  mapId: string,
  objectId: string,
  point: ObservatoryGridPoint,
  wholeSetup = true
): ObservatoryLayoutEditResult {
  const next = cloneObservatoryLayout(layout);
  const map = next.world.maps.find((candidate) => candidate.id === mapId);
  const selected = map?.objects.find((object) => object.id === objectId);
  if (!map || !selected) return result(layout, 'Object not found on this floor.', false);
  const group = observatoryObjectGroup(map, objectId, wholeSetup);
  const moved = group.map((object) => ({
    ...object,
    position: {
      x: object.position.x + point.x - selected.position.x,
      y: object.position.y + point.y - selected.position.y,
    },
  }));
  if (wholeSetup) {
    const ids = new Set(group.map((object) => object.id));
    const root =
      moved.find(
        (object) => !object.runtime?.targetObjectId || !ids.has(object.runtime.targetObjectId)
      ) ?? moved[0];
    const room =
      root &&
      map.rooms.find(
        (candidate) =>
          root.position.x >= candidate.bounds.x &&
          root.position.y >= candidate.bounds.y &&
          root.position.x < candidate.bounds.x + candidate.bounds.width &&
          root.position.y < candidate.bounds.y + candidate.bounds.height
      );
    moved.forEach((object) => {
      object.roomId = room?.id;
    });
  }
  const issue = assemblyPlacementIssue(
    map,
    moved,
    group.map((object) => object.id)
  );
  if (issue) return result(layout, issue, false);
  const replacements = new Map(moved.map((object) => [object.id, object]));
  map.objects = map.objects.map((object) => replacements.get(object.id) ?? object);
  return result(
    next,
    `Moved ${group.length} part${group.length === 1 ? '' : 's'}.`,
    true,
    objectId
  );
}

export function duplicateOfficeAssembly(
  layout: ObservatoryLayoutDocument,
  mapId: string,
  objectId: string,
  wholeSetup = true
): ObservatoryLayoutEditResult {
  const map = layout.world.maps.find((candidate) => candidate.id === mapId);
  if (!map) return result(layout, 'Floor not found.', false);
  const group = observatoryObjectGroup(map, objectId, wholeSetup);
  const offsets: ObservatoryGridPoint[] = [];
  for (let y = -map.size.height; y < map.size.height; y++)
    for (let x = -map.size.width; x < map.size.width; x++) if (x || y) offsets.push({ x, y });
  offsets.sort((a, b) => Math.abs(a.x) + Math.abs(a.y) - Math.abs(b.x) - Math.abs(b.y));
  for (const delta of offsets) {
    const placed = group.map((object) => ({
      ...object,
      position: { x: object.position.x + delta.x, y: object.position.y + delta.y },
    }));
    if (!assemblyPlacementIssue(map, placed)) return placeOfficeAssembly(layout, mapId, placed);
  }
  return result(
    layout,
    'No room for the complete setup. Move furniture or choose another room.',
    false
  );
}

export function deleteOfficeAssembly(
  layout: ObservatoryLayoutDocument,
  mapId: string,
  objectId: string,
  wholeSetup = true
): ObservatoryLayoutEditResult {
  const next = cloneObservatoryLayout(layout);
  const map = next.world.maps.find((candidate) => candidate.id === mapId);
  if (!map) return result(layout, 'Floor not found.', false);
  const ids = new Set(observatoryObjectGroup(map, objectId, wholeSetup).map((object) => object.id));
  if (!ids.size) return result(layout, 'Object not found.', false);
  map.objects = map.objects.filter((object) => !ids.has(object.id));
  // Agents and surviving props must never retain a deleted interaction target.
  for (const object of [...map.objects, ...map.agents])
    if (object.runtime?.targetObjectId && ids.has(object.runtime.targetObjectId))
      delete object.runtime.targetObjectId;
  return result(next, `Deleted ${ids.size} parts.`, true);
}
