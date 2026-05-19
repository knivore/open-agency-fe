'use client';

import { useSyncExternalStore } from 'react';

import type { ObservatoryRuntimeVisualStore } from '@/modules/observatory/state/runtimeVisualStore';

export function useObservatoryRuntimeVisualStoreSnapshot(store: ObservatoryRuntimeVisualStore) {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
