import type {
  ObservatoryAssetCatalogDirectorySummary,
  ObservatoryAssetCatalogEntry,
} from '@/modules/observatory/engine/assets/assetCatalog';
import type { ObservatoryValidatedAssetRegistry } from '@/modules/observatory/engine/assets/assetRegistry';

export interface ObservatoryAssetCatalogCoverage {
  catalogFileCount: number;
  coverageRatio: number;
  registeredAssetCount: number;
  sourceDirectoryCounts: ObservatoryAssetCatalogDirectorySummary[];
}

export interface ObservatoryAssetCatalogIssue {
  id: string;
  reason: string;
}

export function summarizeObservatoryCatalogCoverage(
  registry: ObservatoryValidatedAssetRegistry,
  catalog: { directories: ObservatoryAssetCatalogDirectorySummary[]; totalFileCount: number }
): ObservatoryAssetCatalogCoverage {
  const registeredAssetCount = registry.assets.length;

  return {
    catalogFileCount: catalog.totalFileCount,
    coverageRatio: catalog.totalFileCount > 0 ? registeredAssetCount / catalog.totalFileCount : 0,
    registeredAssetCount,
    sourceDirectoryCounts: catalog.directories,
  };
}

export function validateObservatoryAssetCatalogEntries(
  entries: ObservatoryAssetCatalogEntry[]
): ObservatoryAssetCatalogIssue[] {
  const issues: ObservatoryAssetCatalogIssue[] = [];
  const seenIds = new Set<string>();
  const seenPaths = new Set<string>();

  for (const entry of entries) {
    if (seenIds.has(entry.id)) {
      issues.push({ id: entry.id, reason: 'duplicate catalog id' });
    }

    if (seenPaths.has(entry.path)) {
      issues.push({ id: entry.id, reason: `duplicate catalog path ${entry.path}` });
    }

    if (!entry.path.includes('/')) {
      issues.push({ id: entry.id, reason: 'catalog path must include a source directory' });
    }

    if (!/^[a-f0-9]{64}$/.test(entry.sha256)) {
      issues.push({ id: entry.id, reason: 'catalog sha256 must be a lowercase hex digest' });
    }

    if (!entry.directory || !entry.path.startsWith(`${entry.directory}/`)) {
      issues.push({ id: entry.id, reason: 'catalog directory must match path prefix' });
    }

    if (!entry.fileName || !entry.path.endsWith(entry.fileName)) {
      issues.push({ id: entry.id, reason: 'catalog fileName must match path suffix' });
    }

    if (!entry.extension || !entry.fileName.toLowerCase().endsWith(entry.extension)) {
      issues.push({ id: entry.id, reason: 'catalog extension must match fileName suffix' });
    }

    if (entry.width !== undefined && (!Number.isInteger(entry.width) || entry.width <= 0)) {
      issues.push({
        id: entry.id,
        reason: 'catalog width must be a positive integer when present',
      });
    }

    if (entry.height !== undefined && (!Number.isInteger(entry.height) || entry.height <= 0)) {
      issues.push({
        id: entry.id,
        reason: 'catalog height must be a positive integer when present',
      });
    }

    seenIds.add(entry.id);
    seenPaths.add(entry.path);
  }

  return issues;
}
