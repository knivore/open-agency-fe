import { describe, expect, it } from 'vitest';

import {
  clearObservatoryLayoutStorage,
  exportObservatoryLayoutJson,
  importObservatoryLayoutJson,
  OBSERVATORY_DRAFT_LAYOUT_STORAGE_KEY,
  OBSERVATORY_LAYOUT_STORAGE_KEY,
  OBSERVATORY_PUBLISHED_LAYOUT_STORAGE_KEY,
  publishObservatoryLayoutToStorage,
  readObservatoryDraftLayoutFromStorage,
  readObservatoryLayoutFromStorage,
  readObservatoryPublishedLayoutFromStorage,
  readObservatoryViewerLayoutFromStorage,
  writeObservatoryDraftLayoutToStorage,
  writeObservatoryLayoutToStorage,
} from '@/modules/observatory/engine/world/layoutPersistence';
import { validateObservatoryLayout } from '@/modules/observatory/engine/world/layoutValidation';
import type { ObservatoryLayoutDocument } from '@/modules/observatory/engine/world/layoutTypes';
import sampleLayout from '@/modules/observatory/engine/world/sampleLayout.json';

function layout() {
  const validation = validateObservatoryLayout(sampleLayout);
  if (!validation.layout) {
    throw new Error('Sample layout must be valid for layout persistence tests.');
  }

  return validation.layout as ObservatoryLayoutDocument;
}

function memoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe('observatory pixel layout persistence', () => {
  it('writes, reads, and clears a valid layout', () => {
    const storage = memoryStorage();
    const writeResult = writeObservatoryLayoutToStorage(storage, layout());

    expect(writeResult.issues).toEqual([]);
    expect(readObservatoryLayoutFromStorage(storage).layout?.world.id).toBe(
      'world:observatory-mvp'
    );

    clearObservatoryLayoutStorage(storage);
    expect(readObservatoryLayoutFromStorage(storage)).toEqual({ issues: [] });
  });

  it('uses the stable browser storage key', () => {
    expect(OBSERVATORY_DRAFT_LAYOUT_STORAGE_KEY).toBe('observatory:layout:draft:v1');
    expect(OBSERVATORY_PUBLISHED_LAYOUT_STORAGE_KEY).toBe('observatory:layout:published:v1');
    expect(OBSERVATORY_LAYOUT_STORAGE_KEY).toBe(OBSERVATORY_DRAFT_LAYOUT_STORAGE_KEY);
  });

  it('separates draft and published layout storage', () => {
    const storage = memoryStorage();
    const draftResult = writeObservatoryDraftLayoutToStorage(storage, layout());
    const publishResult = publishObservatoryLayoutToStorage(storage, layout(), {
      notes: 'First production layout',
      publishedBy: 'test-runner',
    });

    expect(draftResult.issues).toEqual([]);
    expect(publishResult.issues).toEqual([]);
    expect(readObservatoryDraftLayoutFromStorage(storage).layout?.metadata?.status).toBe('draft');
    expect(readObservatoryPublishedLayoutFromStorage(storage).layout?.metadata?.status).toBe(
      'published'
    );
    expect(
      readObservatoryPublishedLayoutFromStorage(storage).layout?.metadata?.publishedAt
    ).toBeTruthy();
    expect(readObservatoryPublishedLayoutFromStorage(storage).layout?.metadata?.version).toBe(1);
    expect(readObservatoryPublishedLayoutFromStorage(storage).layout?.metadata?.publishedBy).toBe(
      'test-runner'
    );
    expect(readObservatoryPublishedLayoutFromStorage(storage).layout?.metadata?.notes).toBe(
      'First production layout'
    );
  });

  it('exports and imports validated layout JSON as a draft by default', () => {
    const exported = exportObservatoryLayoutJson(layout());

    expect(exported.issues).toEqual([]);
    expect(exported.json).toContain('"schemaVersion": 1');

    const imported = importObservatoryLayoutJson(exported.json!);

    expect(imported.issues).toEqual([]);
    expect(imported.layout?.metadata?.status).toBe('draft');
    expect(imported.layout?.world.id).toBe('world:observatory-mvp');
  });

  it('reports invalid imported JSON without throwing', () => {
    const imported = importObservatoryLayoutJson('{not-json');

    expect(imported.layout).toBeUndefined();
    expect(imported.parseError).toBeTruthy();
    expect(imported.issues[0]?.path).toBe('layout');
  });

  it('viewer storage consumes only published layouts', () => {
    const storage = memoryStorage();

    expect(readObservatoryViewerLayoutFromStorage(storage).hasPublishedLayout).toBe(false);

    writeObservatoryDraftLayoutToStorage(storage, layout());
    expect(readObservatoryViewerLayoutFromStorage(storage).layout).toBeUndefined();
    expect(readObservatoryViewerLayoutFromStorage(storage).hasPublishedLayout).toBe(false);

    publishObservatoryLayoutToStorage(storage, layout());
    expect(readObservatoryViewerLayoutFromStorage(storage).layout?.metadata?.status).toBe(
      'published'
    );
    expect(readObservatoryViewerLayoutFromStorage(storage).hasPublishedLayout).toBe(true);
  });
});
