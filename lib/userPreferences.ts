'use client';

import { useEffect, useState } from 'react';

// Local until the backend exposes user preferences; keep this schema versioned so migration is
// explicit when preferences become account-scoped instead of browser-scoped.
const userPreferencesStorageKey = 'agency:user-preferences:v1';

export interface AgencyUserPreferences {
  showDiagnostics: boolean;
}

export const defaultAgencyUserPreferences: AgencyUserPreferences = {
  showDiagnostics: false,
};

function normalizePreferences(value: unknown): AgencyUserPreferences {
  if (!value || typeof value !== 'object') {
    return defaultAgencyUserPreferences;
  }

  const candidate = value as Partial<AgencyUserPreferences>;
  return {
    showDiagnostics: candidate.showDiagnostics === true,
  };
}

export function readAgencyUserPreferences(): AgencyUserPreferences {
  if (typeof window === 'undefined') {
    return defaultAgencyUserPreferences;
  }

  try {
    const raw = window.localStorage.getItem(userPreferencesStorageKey);
    return normalizePreferences(raw ? JSON.parse(raw) : null);
  } catch {
    return defaultAgencyUserPreferences;
  }
}

function writeAgencyUserPreferences(preferences: AgencyUserPreferences) {
  window.localStorage.setItem(userPreferencesStorageKey, JSON.stringify(preferences));
  window.dispatchEvent(
    new CustomEvent<AgencyUserPreferences>('agency:user-preferences-change', {
      detail: preferences,
    })
  );
}

export function useAgencyUserPreferences() {
  const [preferences, setPreferences] = useState<AgencyUserPreferences>(
    defaultAgencyUserPreferences
  );
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setPreferences(readAgencyUserPreferences());
    setIsLoaded(true);

    const handleStorage = (event: StorageEvent) => {
      if (event.key === userPreferencesStorageKey) {
        setPreferences(readAgencyUserPreferences());
      }
    };
    const handleLocalChange = (event: Event) => {
      setPreferences(normalizePreferences((event as CustomEvent<AgencyUserPreferences>).detail));
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('agency:user-preferences-change', handleLocalChange);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('agency:user-preferences-change', handleLocalChange);
    };
  }, []);

  const updatePreferences = (patch: Partial<AgencyUserPreferences>) => {
    setPreferences((current) => {
      const next = { ...current, ...patch };
      writeAgencyUserPreferences(next);
      return next;
    });
  };

  return {
    isLoaded,
    preferences,
    setShowDiagnostics: (showDiagnostics: boolean) => updatePreferences({ showDiagnostics }),
    updatePreferences,
  };
}
