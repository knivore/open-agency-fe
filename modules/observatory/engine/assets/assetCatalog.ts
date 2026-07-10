import catalogGenerated from './catalog.generated.json';

export interface ObservatoryAssetCatalogDirectorySummary {
  directory: string;
  fileCount: number;
}

export interface ObservatoryAssetCatalogEntry {
  animationFrameCrop?: {
    height: number;
    width: number;
    x: number;
    y: number;
  };
  directory: string;
  extension: string;
  fileName: string;
  id: string;
  path: string;
  sha256: string;
  width?: number;
  height?: number;
}

interface ObservatoryGeneratedCatalog {
  directories: ObservatoryAssetCatalogDirectorySummary[];
  entries: ObservatoryAssetCatalogEntry[];
  generatedAt: string;
  totalFileCount: number;
}

// Keep one generated JSON source of truth instead of shipping a second multi-megabyte
// TypeScript copy of the same catalog in the open-source frontend bundle.
const catalog = catalogGenerated as ObservatoryGeneratedCatalog;

export const observatoryAssetCatalogEntries = catalog.entries;

export const observatoryAssetCatalogSummary = {
  directories: catalog.directories,
  totalFileCount: observatoryAssetCatalogEntries.length,
};
