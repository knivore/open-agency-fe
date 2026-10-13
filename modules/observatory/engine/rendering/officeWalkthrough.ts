import type { ObservatoryAssetDefinition } from '../assets/assetRegistry';
import type { ObservatoryMap } from '../world/layoutTypes';
import {
  pickObservatoryRoomRoamPoint,
  resolveObservatoryObjectInteraction,
} from './agentBehaviorTargets';

export interface OfficeWalkthroughProgress {
  status: 'walking' | 'interacting' | 'complete' | 'stopped' | 'blocked';
  completed: number;
  total: number;
  label: string;
  agentId: string;
  point?: { x: number; y: number };
}
export function createOfficeWalkthroughStops(map: ObservatoryMap) {
  return map.rooms.flatMap((room) => {
    const stations = map.objects.filter(
      (object) => object.roomId === room.id && object.runtime?.role === 'workstation'
    );
    if (stations.length)
      return stations.map((object, index) => ({
        roomId: room.id,
        objectId: object.id as string | undefined,
        label: `${room.name} · workstation ${index + 1}`,
      }));
    const surface = map.objects.find(
      (object) => object.roomId === room.id && object.runtime?.role === 'planning-surface'
    );
    return [{ roomId: room.id, objectId: surface?.id, label: room.name }];
  });
}

export function resolveOfficeWalkthroughStop(
  map: ObservatoryMap,
  stop: ReturnType<typeof createOfficeWalkthroughStops>[number],
  from: { x: number; y: number },
  assets: Map<string, ObservatoryAssetDefinition>,
  tileSize: number,
  occupiedPoints: Array<{ x: number; y: number }> = [],
  occupiedFootPositions: Array<{ x: number; y: number }> = []
) {
  const object = map.objects.find((candidate) => candidate.id === stop.objectId);
  if (object)
    return resolveObservatoryObjectInteraction(map, object, {
      assetsById: assets,
      fromPoint: from,
      tileSize,
      occupiedPoints,
      occupiedFootPositions,
    });
  const room = map.rooms.find((candidate) => candidate.id === stop.roomId);
  const point =
    room &&
    pickObservatoryRoomRoamPoint(map, room, {
      assetsById: assets,
      fromPoint: from,
      seed: stop.roomId,
      occupiedPoints,
      occupiedFootPositions,
      tileSize,
    });
  return point
    ? {
        point,
        direction: 'down' as const,
        action: 'idle' as const,
        offsetPx: { x: 0, y: 0 },
        objectId: '',
      }
    : null;
}
