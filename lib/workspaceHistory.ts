'use client';

import { useSyncExternalStore } from 'react';

const workspaceHistoryStorageKey = 'agency:workspace-history:v1';
const workspaceHistoryChangeEvent = 'agency:workspace-history-change';
const emptyWorkspaceHistory: WorkspaceHistoryItem[] = [];

export interface WorkspaceHistoryItem {
  path: string;
  label: string;
  description?: string;
  visitedAt: string;
}

let workspaceHistoryCache: WorkspaceHistoryItem[] | null = null;

function normalizeWorkspaceHistory(value: unknown): WorkspaceHistoryItem[] {
  if (!value || typeof value !== 'object') {
    return [];
  }

  const items = (value as { items?: unknown }).items;
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is WorkspaceHistoryItem => {
      if (!item || typeof item !== 'object') {
        return false;
      }
      const candidate = item as Partial<WorkspaceHistoryItem>;
      return (
        typeof candidate.path === 'string' &&
        typeof candidate.label === 'string' &&
        typeof candidate.visitedAt === 'string'
      );
    })
    .slice(0, 8);
}

export function readWorkspaceHistory(): WorkspaceHistoryItem[] {
  if (typeof window === 'undefined') {
    return emptyWorkspaceHistory;
  }

  if (workspaceHistoryCache) {
    return workspaceHistoryCache;
  }

  try {
    const raw = window.localStorage.getItem(workspaceHistoryStorageKey);
    workspaceHistoryCache = normalizeWorkspaceHistory(raw ? JSON.parse(raw) : null);
  } catch {
    workspaceHistoryCache = [];
  }
  return workspaceHistoryCache;
}

function publishWorkspaceHistory(items: WorkspaceHistoryItem[]) {
  workspaceHistoryCache = items;
  window.localStorage.setItem(workspaceHistoryStorageKey, JSON.stringify({ items }));
  window.dispatchEvent(new Event(workspaceHistoryChangeEvent));
}

export function rememberWorkspaceItem(
  item: Omit<WorkspaceHistoryItem, 'visitedAt'> & { visitedAt?: string }
) {
  if (typeof window === 'undefined' || !item.path.startsWith('/')) {
    return;
  }

  const nextItem: WorkspaceHistoryItem = {
    ...item,
    visitedAt: item.visitedAt ?? new Date().toISOString(),
  };
  const nextItems = [
    nextItem,
    ...readWorkspaceHistory().filter((existing) => existing.path !== item.path),
  ].slice(0, 8);
  publishWorkspaceHistory(nextItems);
}

export function clearWorkspaceHistory() {
  if (typeof window === 'undefined') {
    return;
  }
  publishWorkspaceHistory([]);
}

function subscribeToWorkspaceHistory(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== workspaceHistoryStorageKey) {
      return;
    }
    workspaceHistoryCache = null;
    onStoreChange();
  };
  const handleLocalChange = () => onStoreChange();

  window.addEventListener('storage', handleStorage);
  window.addEventListener(workspaceHistoryChangeEvent, handleLocalChange);
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(workspaceHistoryChangeEvent, handleLocalChange);
  };
}

export function useWorkspaceHistory() {
  return useSyncExternalStore(
    subscribeToWorkspaceHistory,
    readWorkspaceHistory,
    () => emptyWorkspaceHistory
  );
}
