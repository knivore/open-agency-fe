import type { ObservatoryLayoutDocument } from '@/modules/observatory/engine/world/layoutTypes';

export interface ObservatoryLayoutLibraryEntry {
  fileId: string;
  fileName: string;
  layout: ObservatoryLayoutDocument;
}

export interface ObservatoryLayoutLibrarySummary {
  fileId: string;
  fileName: string;
  layoutId: string;
  name: string;
  notes?: string;
  status: 'draft' | 'published';
  updatedAt?: string;
  publishedAt?: string;
  version?: number;
}

export function summarizeObservatoryLayoutLibraryEntry(
  entry: ObservatoryLayoutLibraryEntry
): ObservatoryLayoutLibrarySummary {
  const metadata = entry.layout.metadata;

  return {
    fileId: entry.fileId,
    fileName: entry.fileName,
    layoutId: metadata?.id ?? entry.layout.world.id,
    name: metadata?.name ?? entry.layout.world.name,
    notes: metadata?.notes,
    publishedAt: metadata?.publishedAt,
    status: metadata?.status ?? 'draft',
    updatedAt: metadata?.updatedAt,
    version: metadata?.version,
  };
}
