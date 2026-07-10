import { validateObservatoryLayout } from '@/modules/observatory/engine/world/layoutValidation';
import type {
  ObservatoryLayoutDocument,
  ObservatoryLayoutIssue,
  ObservatoryValidatedLayout,
} from '@/modules/observatory/engine/world/layoutTypes';

export const OBSERVATORY_DRAFT_LAYOUT_STORAGE_KEY = 'observatory:layout:draft:v1';
export const OBSERVATORY_PUBLISHED_LAYOUT_STORAGE_KEY = 'observatory:layout:published:v1';
export const OBSERVATORY_LAYOUT_STORAGE_KEY = OBSERVATORY_DRAFT_LAYOUT_STORAGE_KEY;

export interface ObservatoryLayoutParseResult extends ObservatoryValidatedLayout {
  parseError?: string;
}

export interface ObservatoryLayoutStorageResult extends ObservatoryLayoutParseResult {
  storageError?: string;
}

export interface ObservatoryLayoutExportResult extends ObservatoryValidatedLayout {
  json?: string;
}

export interface ObservatoryLayoutImportOptions {
  status?: 'draft' | 'published';
}

export interface ObservatoryLayoutPublishOptions {
  notes?: string;
  publishedBy?: string;
}

export interface ObservatoryViewerLayoutResult extends ObservatoryLayoutStorageResult {
  hasPublishedLayout: boolean;
}

export function serializeObservatoryLayout(layout: ObservatoryLayoutDocument): string {
  return JSON.stringify(layout, null, 2);
}

export function parseObservatoryLayoutJson(json: string): ObservatoryLayoutParseResult {
  try {
    return validateObservatoryLayout(JSON.parse(json));
  } catch (error) {
    return {
      issues: [jsonParseIssue(error)],
      parseError: error instanceof Error ? error.message : 'Invalid JSON',
    };
  }
}

export function exportObservatoryLayoutJson(
  layout: ObservatoryLayoutDocument
): ObservatoryLayoutExportResult {
  const validation = validateObservatoryLayout(layout);

  if (!validation.layout) {
    return validation;
  }

  return {
    ...validation,
    json: serializeObservatoryLayout(validation.layout),
  };
}

export function importObservatoryLayoutJson(
  json: string,
  options: ObservatoryLayoutImportOptions = {}
): ObservatoryLayoutParseResult {
  const result = parseObservatoryLayoutJson(json);

  if (!result.layout) {
    return result;
  }

  return {
    ...result,
    layout: markObservatoryLayoutStatus(result.layout, options.status ?? 'draft'),
  };
}

export function readObservatoryLayoutFromStorage(
  storage: Pick<Storage, 'getItem'>,
  key = OBSERVATORY_LAYOUT_STORAGE_KEY
): ObservatoryLayoutStorageResult {
  try {
    const stored = storage.getItem(key);

    if (!stored) {
      return { issues: [] };
    }

    return parseObservatoryLayoutJson(stored);
  } catch (error) {
    return {
      issues: [storageIssue(error, 'read')],
      storageError: error instanceof Error ? error.message : 'Unable to read layout storage',
    };
  }
}

export function writeObservatoryLayoutToStorage(
  storage: Pick<Storage, 'setItem'>,
  layout: ObservatoryLayoutDocument,
  key = OBSERVATORY_LAYOUT_STORAGE_KEY
): ObservatoryLayoutStorageResult {
  const validation = validateObservatoryLayout(layout);

  if (!validation.layout) {
    return validation;
  }

  try {
    storage.setItem(key, serializeObservatoryLayout(validation.layout));
    return validation;
  } catch (error) {
    return {
      layout: validation.layout,
      issues: [storageIssue(error, 'write')],
      storageError: error instanceof Error ? error.message : 'Unable to write layout storage',
    };
  }
}

export function clearObservatoryLayoutStorage(
  storage: Pick<Storage, 'removeItem'>,
  key = OBSERVATORY_LAYOUT_STORAGE_KEY
) {
  storage.removeItem(key);
}

export function readObservatoryDraftLayoutFromStorage(storage: Pick<Storage, 'getItem'>) {
  return readObservatoryLayoutFromStorage(storage, OBSERVATORY_DRAFT_LAYOUT_STORAGE_KEY);
}

export function writeObservatoryDraftLayoutToStorage(
  storage: Pick<Storage, 'setItem'>,
  layout: ObservatoryLayoutDocument
) {
  return writeObservatoryLayoutToStorage(
    storage,
    markObservatoryLayoutStatus(layout, 'draft'),
    OBSERVATORY_DRAFT_LAYOUT_STORAGE_KEY
  );
}

export function readObservatoryPublishedLayoutFromStorage(storage: Pick<Storage, 'getItem'>) {
  return readObservatoryLayoutFromStorage(storage, OBSERVATORY_PUBLISHED_LAYOUT_STORAGE_KEY);
}

export function readObservatoryViewerLayoutFromStorage(
  storage: Pick<Storage, 'getItem'>
): ObservatoryViewerLayoutResult {
  const result = readObservatoryPublishedLayoutFromStorage(storage);

  return {
    ...result,
    hasPublishedLayout: Boolean(result.layout),
  };
}

export function writeObservatoryPublishedLayoutToStorage(
  storage: Pick<Storage, 'setItem'>,
  layout: ObservatoryLayoutDocument,
  options: ObservatoryLayoutPublishOptions = {}
) {
  return writeObservatoryLayoutToStorage(
    storage,
    markObservatoryLayoutStatus(layout, 'published', options),
    OBSERVATORY_PUBLISHED_LAYOUT_STORAGE_KEY
  );
}

export function publishObservatoryLayoutToStorage(
  storage: Pick<Storage, 'setItem'>,
  layout: ObservatoryLayoutDocument,
  options: ObservatoryLayoutPublishOptions = {}
) {
  return writeObservatoryPublishedLayoutToStorage(storage, layout, options);
}

export function markObservatoryLayoutStatus(
  layout: ObservatoryLayoutDocument,
  status: 'draft' | 'published',
  options: ObservatoryLayoutPublishOptions = {}
): ObservatoryLayoutDocument {
  const timestamp = new Date().toISOString();
  const currentVersion = layout.metadata?.version ?? 0;
  const version = status === 'published' ? currentVersion + 1 : currentVersion || undefined;

  return {
    ...layout,
    metadata: {
      ...layout.metadata,
      id: layout.metadata?.id ?? layout.world.id,
      name: layout.metadata?.name ?? layout.world.name,
      createdAt: layout.metadata?.createdAt ?? timestamp,
      updatedAt: timestamp,
      status,
      ...(version ? { version } : {}),
      ...(status === 'published'
        ? {
            publishedAt: timestamp,
            ...(options.notes ? { notes: options.notes } : {}),
            ...(options.publishedBy ? { publishedBy: options.publishedBy } : {}),
          }
        : {}),
    },
  };
}

function jsonParseIssue(error: unknown): ObservatoryLayoutIssue {
  return {
    path: 'layout',
    reason: error instanceof Error ? `invalid JSON: ${error.message}` : 'invalid JSON',
  };
}

function storageIssue(error: unknown, operation: 'read' | 'write'): ObservatoryLayoutIssue {
  return {
    path: 'storage',
    reason:
      error instanceof Error
        ? `layout storage ${operation} failed: ${error.message}`
        : `layout storage ${operation} failed`,
  };
}
