import catalogGenerated from '@/modules/observatory/engine/assets/catalog.generated.json';
import registryCandidatesGenerated from '@/modules/observatory/engine/assets/registryCandidates.generated.json';
import registryOverrides from '@/modules/observatory/engine/assets/registry.overrides.json';
import type { ObservatoryAssetCategory } from '@/modules/observatory/engine/assets/assetRegistry';

export type ObservatoryAssetReviewPriority = 'high' | 'low' | 'medium';
export type ObservatoryAssetReviewStatus = 'generated' | 'needs-review' | 'reviewed';

export interface ObservatoryGeneratedAssetInventoryEntry {
  directory: string;
  extension: string;
  fileName: string;
  height?: number;
  id: string;
  path: string;
  sha256: string;
  width?: number;
}

export interface ObservatoryGeneratedAssetCandidate {
  anchor: { x: number; y: number };
  animation?: {
    endFrame: number;
    frameRate: number;
    key: string;
    repeat?: number;
    startFrame: number;
  };
  catalogPath: string;
  category: ObservatoryAssetCategory;
  frame?: number;
  height: number;
  id: string;
  label: string;
  review: {
    frameGrid: {
      columns: number;
      frameCount: number;
      rows: number;
    };
    priority: ObservatoryAssetReviewPriority;
    reasons: string[];
    status: ObservatoryAssetReviewStatus;
  };
  semanticId: string;
  source: {
    frameHeight: number;
    frameWidth: number;
    kind: 'spritesheet';
    sourcePath: string;
  };
  tags: string[];
  width: number;
}

export interface ObservatoryCuratedAssetOverride {
  animation?: {
    endFrame: number;
    frameRate: number;
    startFrame: number;
  };
  assetId: string;
  catalogPath: string;
  category: ObservatoryAssetCategory;
  collision?: {
    height: number;
    width: number;
  };
  frame?: number;
  reviewPriority: ObservatoryAssetReviewPriority;
  reviewStatus: Extract<ObservatoryAssetReviewStatus, 'needs-review' | 'reviewed'>;
  source?: {
    frameHeight?: number;
    frameWidth?: number;
  };
  tags?: string[];
}

export interface ObservatoryResolvedAssetCandidate extends ObservatoryGeneratedAssetCandidate {
  override?: ObservatoryCuratedAssetOverride;
  resolvedAssetId: string;
  reviewStatus: ObservatoryAssetReviewStatus;
}

export interface ObservatoryAssetPipelineSummary {
  generatedCandidateCount: number;
  highPriorityGeneratedCount: number;
  inventoryFileCount: number;
  reviewQueue: ObservatoryResolvedAssetCandidate[];
  reviewedOverrideCount: number;
  sourceDirectories: Array<{ directory: string; fileCount: number }>;
}

const catalog = catalogGenerated as {
  directories: Array<{ directory: string; fileCount: number }>;
  entries: ObservatoryGeneratedAssetInventoryEntry[];
  totalFileCount: number;
};

const generatedCandidates = registryCandidatesGenerated as {
  candidateCount: number;
  candidates: ObservatoryGeneratedAssetCandidate[];
};

const overrides = registryOverrides as {
  overrides: ObservatoryCuratedAssetOverride[];
};

export const observatoryGeneratedAssetInventoryEntries = catalog.entries;
export const observatoryGeneratedAssetCandidates = generatedCandidates.candidates;
export const observatoryCuratedAssetOverrides = overrides.overrides;

export function resolveObservatoryAssetCandidates(): ObservatoryResolvedAssetCandidate[] {
  const overrideByCatalogPath = new Map(
    observatoryCuratedAssetOverrides.map((override) => [override.catalogPath, override])
  );

  return observatoryGeneratedAssetCandidates.map((candidate) => {
    const override = overrideByCatalogPath.get(candidate.catalogPath);
    return {
      ...candidate,
      override,
      resolvedAssetId: override?.assetId ?? candidate.id,
      reviewStatus: override?.reviewStatus ?? candidate.review.status,
    };
  });
}

export function summarizeObservatoryAssetPipeline(): ObservatoryAssetPipelineSummary {
  const resolvedCandidates = resolveObservatoryAssetCandidates();
  const reviewQueue = resolvedCandidates.filter(
    (candidate) => candidate.reviewStatus !== 'reviewed' && candidate.review.priority === 'high'
  );

  return {
    generatedCandidateCount: generatedCandidates.candidateCount,
    highPriorityGeneratedCount: reviewQueue.length,
    inventoryFileCount: catalog.totalFileCount,
    reviewQueue,
    reviewedOverrideCount: observatoryCuratedAssetOverrides.filter(
      (override) => override.reviewStatus === 'reviewed'
    ).length,
    sourceDirectories: catalog.directories,
  };
}

export function getObservatoryAssetReviewQueue(limit = 24): ObservatoryResolvedAssetCandidate[] {
  return summarizeObservatoryAssetPipeline().reviewQueue.slice(0, limit);
}
