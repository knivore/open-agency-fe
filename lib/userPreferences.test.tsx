import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAgencyUserPreferences } from '@/lib/userPreferences';

describe('useAgencyUserPreferences', () => {
  beforeEach(() => {
    window.localStorage.removeItem('agency:user-preferences:v1');
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'agency:user-preferences:v1',
        newValue: null,
      })
    );
  });

  it('hydrates browser preferences and publishes updates without an effect-state cascade', async () => {
    const { result } = renderHook(() => useAgencyUserPreferences());

    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    act(() => result.current.setShowDiagnostics(true));

    await waitFor(() => expect(result.current.preferences.showDiagnostics).toBe(true));
    expect(JSON.parse(window.localStorage.getItem('agency:user-preferences:v1') ?? '{}')).toEqual({
      showDiagnostics: true,
      assistantLauncherMode: 'dock',
      assistantLauncherIcon: 'bot',
    });
  });

  it('persists assistant placement and identity preferences', async () => {
    const { result } = renderHook(() => useAgencyUserPreferences());

    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    act(() => result.current.setAssistantLauncherMode('floating'));
    act(() => result.current.setAssistantLauncherIcon('sparkles'));

    await waitFor(() =>
      expect(result.current.preferences).toMatchObject({
        assistantLauncherMode: 'floating',
        assistantLauncherIcon: 'sparkles',
      })
    );
  });
});
