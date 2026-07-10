import {
  type ObservatoryAssetDefinition,
  type ObservatoryAssetRegistry,
  type ObservatoryValidatedAssetRegistry,
  validateObservatoryAssetRegistry,
} from '@/modules/observatory/engine/assets/assetRegistry';
import {
  buildObservedSurfaceVariants,
  normalizeGeneratedRegistryAsset,
  observatoryModuleAssetRegistry,
} from '@/modules/observatory/engine/assets/moduleAssetRegistry';
import { observatoryGeneratedAssetRegistryAssets } from '@/modules/observatory/engine/assets/generatedAssetRegistry';

function mergeGeneratedAndCuratedAssets(
  curatedAssets: ObservatoryAssetDefinition[]
): ObservatoryAssetDefinition[] {
  const curatedBaseAssets = curatedAssets.filter(
    (asset) =>
      !asset.tags?.includes('surface-variant') && !asset.tags?.includes('runtime-furniture')
  );
  const curatedCatalogPaths = new Set(
    curatedBaseAssets.flatMap((asset) => (asset.catalogPath ? [asset.catalogPath] : []))
  );
  const normalizedGeneratedAssets = observatoryGeneratedAssetRegistryAssets
    .filter(
      (asset) =>
        asset.tags?.includes('manifest-backed') ||
        !asset.catalogPath ||
        !curatedCatalogPaths.has(asset.catalogPath)
    )
    .map(normalizeGeneratedRegistryAsset);
  const mergedAssets = [...normalizedGeneratedAssets, ...curatedBaseAssets];

  return [...mergedAssets, ...buildObservedSurfaceVariants(mergedAssets)];
}

export const observatoryFullModuleAssetRegistry: ObservatoryAssetRegistry = {
  ...observatoryModuleAssetRegistry,
  assets: mergeGeneratedAndCuratedAssets(observatoryModuleAssetRegistry.assets),
};

export function getObservatoryFullModuleAssetRegistry(): ObservatoryValidatedAssetRegistry {
  return validateObservatoryAssetRegistry(observatoryFullModuleAssetRegistry);
}
