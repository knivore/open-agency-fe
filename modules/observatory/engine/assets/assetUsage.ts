import {
  filterObservatoryAssetRegistry,
  type ObservatoryValidatedAssetRegistry,
} from '@/modules/observatory/engine/assets/assetRegistry';
import type { ObservatoryMap } from '@/modules/observatory/engine/world/layoutTypes';

export function collectObservatoryMapAssetIds(map: ObservatoryMap): Set<string> {
  const assetIds = new Set<string>();

  if (map.defaultFloorAssetId) {
    assetIds.add(map.defaultFloorAssetId);
  }

  for (const room of map.rooms) {
    if (room.floorAssetId) {
      assetIds.add(room.floorAssetId);
    }
    for (const override of room.floorAssetOverrides ?? []) {
      assetIds.add(override.assetId);
    }
    if (room.wallAssetId) {
      assetIds.add(room.wallAssetId);
    }
    for (const override of room.wallAssetOverrides ?? []) {
      assetIds.add(override.assetId);
    }
  }

  for (const object of map.objects) {
    assetIds.add(object.assetId);
  }

  for (const agent of map.agents) {
    assetIds.add(agent.assetId);
  }

  return assetIds;
}

export function filterObservatoryRegistryForMap(
  registry: ObservatoryValidatedAssetRegistry,
  map: ObservatoryMap
): ObservatoryValidatedAssetRegistry {
  const assetIds = collectObservatoryMapAssetIds(map);

  for (const asset of registry.assets) {
    if (asset.tags?.includes('runtime-overlay')) {
      assetIds.add(asset.id);
    }
  }

  return filterObservatoryAssetRegistry(registry, assetIds);
}
