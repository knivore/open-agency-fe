'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const operatorWorkspaceStorageKey = 'agency:operators:workspace-id:v1';

export function useOperatorWorkspace() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryWorkspaceId = searchParams.get('workspace')?.trim() || '';
  const configuredWorkspaceId = process.env.NEXT_PUBLIC_AGENCY_OPERATOR_WORKSPACE_ID?.trim() || '';
  const [rememberedWorkspaceId, setRememberedWorkspaceId] = useState('');
  const workspaceId = queryWorkspaceId || configuredWorkspaceId || rememberedWorkspaceId;

  useEffect(() => {
    if (queryWorkspaceId) {
      window.localStorage.setItem(operatorWorkspaceStorageKey, queryWorkspaceId);
      return;
    }
    const remembered = window.localStorage.getItem(operatorWorkspaceStorageKey)?.trim();
    if (remembered) {
      // Defer hydration of the local preference so the server and first client render agree.
      const timer = window.setTimeout(() => setRememberedWorkspaceId(remembered), 0);
      return () => window.clearTimeout(timer);
    }
  }, [queryWorkspaceId]);

  const selectWorkspace = useCallback(
    (nextWorkspaceId: string) => {
      const normalized = nextWorkspaceId.trim();
      setRememberedWorkspaceId(normalized);
      if (normalized) {
        window.localStorage.setItem(operatorWorkspaceStorageKey, normalized);
      } else {
        window.localStorage.removeItem(operatorWorkspaceStorageKey);
      }
      const next = new URLSearchParams(searchParams.toString());
      if (normalized) {
        next.set('workspace', normalized);
      } else {
        next.delete('workspace');
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams]
  );

  return { workspaceId, selectWorkspace };
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(window.navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return online;
}
