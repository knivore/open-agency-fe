import {useState, useSyncExternalStore} from 'react';
import {useQuery} from '@tanstack/react-query';
import {appApiClient} from '@/lib/api/clientInstances';

export type LocalTarget = 'chrome' | 'apps';
export type LocalAccessStatus = {
  status: string;
  pending_action?: string | null;
  platform?: 'windows' | 'macos' | null;
};
export const localAccessQueryKey = ['local-access'];

// Integrations and device setup share the same owner-authorized status and cache.
// A successful transport probe never counts as an approved connection.
export function useLocalAccess() {
  return useQuery({
    queryKey: localAccessQueryKey,
    queryFn: () => appApiClient.get<Record<LocalTarget, LocalAccessStatus>>('/api/local-access'),
    refetchInterval: 5000,
  });
}

export function localConnectionLabel(status?: string) {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'offline':
      return 'Offline';
    case 'stopped':
      return 'Stopped';
    case 'not_paired':
      return 'Not connected';
    default:
      return 'Checking connection';
  }
}

export type DesktopPlatform = 'windows' | 'macos';

// Platform is a static browser snapshot. The server fallback keeps hydration
// deterministic; an explicit selection always takes precedence over detection.
const subscribePlatform = () => () => {
};
const desktopPlatformSnapshot = (): DesktopPlatform =>
  /Mac/i.test(navigator.platform) ? 'macos' : 'windows';
const serverPlatformSnapshot = (): DesktopPlatform => 'windows';

export function useDesktopPlatform() {
  const detected = useSyncExternalStore(
    subscribePlatform,
    desktopPlatformSnapshot,
    serverPlatformSnapshot
  );
  const [selection, setSelection] = useState<DesktopPlatform | null>(null);
  return [selection ?? detected, setSelection] as const;
}
