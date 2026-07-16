'use client';

import { useSyncExternalStore } from 'react';

// Local until the backend exposes user preferences; keep this schema versioned so migration is
// explicit when preferences become account-scoped instead of browser-scoped.
const userPreferencesStorageKey = 'agency:user-preferences:v1';
const userPreferencesChangeEvent = 'agency:user-preferences-change';

export interface AgencyUserPreferences {
  showDiagnostics: boolean;
  assistantLauncherMode: 'floating' | 'dock' | 'hidden';
  assistantLauncherIcon: 'bot' | 'sparkles' | 'initial';
}

export const defaultAgencyUserPreferences: AgencyUserPreferences = {
  showDiagnostics: false,
  assistantLauncherMode: 'dock',
  assistantLauncherIcon: 'bot',
};

let userPreferencesCache: AgencyUserPreferences | null = null;

function normalizePreferences(value: unknown): AgencyUserPreferences {
  if (!value || typeof value !== 'object') {
    return defaultAgencyUserPreferences;
  }

  const candidate = value as Partial<AgencyUserPreferences>;
  const assistantLauncherMode = ['floating', 'dock', 'hidden'].includes(
    candidate.assistantLauncherMode ?? ''
  )
    ? candidate.assistantLauncherMode!
    : defaultAgencyUserPreferences.assistantLauncherMode;
  const assistantLauncherIcon = ['bot', 'sparkles', 'initial'].includes(
    candidate.assistantLauncherIcon ?? ''
  )
    ? candidate.assistantLauncherIcon!
    : defaultAgencyUserPreferences.assistantLauncherIcon;
  return {
    showDiagnostics: candidate.showDiagnostics === true,
    assistantLauncherMode,
    assistantLauncherIcon,
  };
}

export function readAgencyUserPreferences(): AgencyUserPreferences {
  if (typeof window === 'undefined') {
    return defaultAgencyUserPreferences;
  }

  if (userPreferencesCache) {
    return userPreferencesCache;
  }

  try {
    const raw = window.localStorage.getItem(userPreferencesStorageKey);
    userPreferencesCache = normalizePreferences(raw ? JSON.parse(raw) : null);
  } catch {
    userPreferencesCache = defaultAgencyUserPreferences;
  }
  return userPreferencesCache;
}

function writeAgencyUserPreferences(preferences: AgencyUserPreferences) {
  userPreferencesCache = preferences;
  window.localStorage.setItem(userPreferencesStorageKey, JSON.stringify(preferences));
  window.dispatchEvent(
    new CustomEvent<AgencyUserPreferences>(userPreferencesChangeEvent, {
      detail: preferences,
    })
  );
}

function subscribeToAgencyUserPreferences(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== userPreferencesStorageKey) {
      return;
    }
    userPreferencesCache = null;
    onStoreChange();
  };
  const handleLocalChange = () => onStoreChange();

  window.addEventListener('storage', handleStorage);
  window.addEventListener(userPreferencesChangeEvent, handleLocalChange);
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(userPreferencesChangeEvent, handleLocalChange);
  };
}

function subscribeToHydration() {
  return () => undefined;
}

export function useAgencyUserPreferences() {
  const preferences = useSyncExternalStore(
    subscribeToAgencyUserPreferences,
    readAgencyUserPreferences,
    () => defaultAgencyUserPreferences
  );
  // The server snapshot stays false so local preferences never cause a hydration mismatch.
  const isLoaded = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false
  );

  const updatePreferences = (patch: Partial<AgencyUserPreferences>) => {
    writeAgencyUserPreferences({ ...readAgencyUserPreferences(), ...patch });
  };

  return {
    isLoaded,
    preferences,
    setShowDiagnostics: (showDiagnostics: boolean) => updatePreferences({ showDiagnostics }),
    setAssistantLauncherMode: (
      assistantLauncherMode: AgencyUserPreferences['assistantLauncherMode']
    ) => updatePreferences({ assistantLauncherMode }),
    setAssistantLauncherIcon: (
      assistantLauncherIcon: AgencyUserPreferences['assistantLauncherIcon']
    ) => updatePreferences({ assistantLauncherIcon }),
    updatePreferences,
  };
}
