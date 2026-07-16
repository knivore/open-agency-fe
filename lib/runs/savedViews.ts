'use client';

import { useSyncExternalStore } from 'react';
import type { RunsStatusFilter } from '@/components/runs/hooks/useRunsWorkspace';

const savedRunViewsStorageKey = 'agency:runs:saved-views:v1';
const savedRunViewsChangeEvent = 'agency:runs:saved-views-change';
const emptySavedRunViews: SavedRunView[] = [];

export interface SavedRunView {
  id: string;
  label: string;
  search: string;
  status: RunsStatusFilter;
}

let savedRunViewsCache: SavedRunView[] | null = null;

function normalizeSavedRunViews(value: unknown): SavedRunView[] {
  if (!value || typeof value !== 'object') {
    return [];
  }
  const items = (value as { items?: unknown }).items;
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is SavedRunView => {
      if (!item || typeof item !== 'object') {
        return false;
      }
      const candidate = item as Partial<SavedRunView>;
      return (
        typeof candidate.id === 'string' &&
        typeof candidate.label === 'string' &&
        typeof candidate.search === 'string' &&
        typeof candidate.status === 'string'
      );
    })
    .slice(0, 12);
}

export function readSavedRunViews() {
  if (typeof window === 'undefined') {
    return emptySavedRunViews;
  }
  if (savedRunViewsCache) {
    return savedRunViewsCache;
  }

  try {
    const raw = window.localStorage.getItem(savedRunViewsStorageKey);
    savedRunViewsCache = normalizeSavedRunViews(raw ? JSON.parse(raw) : null);
  } catch {
    savedRunViewsCache = [];
  }
  return savedRunViewsCache;
}

function publishSavedRunViews(items: SavedRunView[]) {
  savedRunViewsCache = items;
  window.localStorage.setItem(savedRunViewsStorageKey, JSON.stringify({ items }));
  window.dispatchEvent(new Event(savedRunViewsChangeEvent));
}

export function createSavedRunView(search: string, status: RunsStatusFilter): SavedRunView {
  const normalizedSearch = search.trim();
  const statusLabel = status === 'all' ? 'All statuses' : status.replaceAll('_', ' ');
  return {
    id: crypto.randomUUID(),
    label: normalizedSearch ? `${statusLabel} · ${normalizedSearch}` : statusLabel,
    search: normalizedSearch,
    status,
  };
}

export function saveRunView(view: SavedRunView) {
  const duplicate = readSavedRunViews().find(
    (item) => item.search === view.search && item.status === view.status
  );
  if (duplicate) {
    return duplicate;
  }
  publishSavedRunViews([view, ...readSavedRunViews()].slice(0, 12));
  return view;
}

export function removeSavedRunView(viewId: string) {
  publishSavedRunViews(readSavedRunViews().filter((view) => view.id !== viewId));
}

export function clearSavedRunViews() {
  if (typeof window !== 'undefined') {
    publishSavedRunViews([]);
  }
}

function subscribeToSavedRunViews(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== savedRunViewsStorageKey) {
      return;
    }
    savedRunViewsCache = null;
    onStoreChange();
  };
  const handleLocalChange = () => onStoreChange();

  window.addEventListener('storage', handleStorage);
  window.addEventListener(savedRunViewsChangeEvent, handleLocalChange);
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(savedRunViewsChangeEvent, handleLocalChange);
  };
}

export function useSavedRunViews() {
  return useSyncExternalStore(
    subscribeToSavedRunViews,
    readSavedRunViews,
    () => emptySavedRunViews
  );
}
