'use client';

import { useCallback, useEffect, useState } from 'react';

export function useUnsavedChangesGuard(enabled: boolean, onNavigate?: (href: string) => void) {
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !onNavigate) return;
    // Inline editors leave the sidebar available. Capture same-tab app links
    // before Next navigation unmounts the draft; in-page and new-tab links stay usable.
    const handleLink = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.hasAttribute('download') ||
        (link.target && link.target !== '_self')
      )
        return;
      const next = new URL(link.href, window.location.href);
      if (
        next.origin !== window.location.origin ||
        (next.pathname === window.location.pathname && next.search === window.location.search)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      onNavigate(next.pathname + next.search + next.hash);
    };
    document.addEventListener('click', handleLink, true);
    return () => document.removeEventListener('click', handleLink, true);
  }, [enabled, onNavigate]);
}

/** Share the discard decision without moving feature drafts or mutations into UI. */
export function useDraftDiscardGuard({
  dirty,
  busy = false,
  onDiscard,
  onNavigate,
}: {
  dirty: boolean;
  busy?: boolean;
  onDiscard: () => void;
  onNavigate: (href: string) => void;
}) {
  const [leaveAction, setLeaveAction] = useState<(() => void) | null>(null);
  const requestLeave = useCallback(
    (action: () => void) => {
      if (busy) return;
      if (dirty) setLeaveAction(() => action);
      else action();
    },
    [busy, dirty]
  );
  useUnsavedChangesGuard(dirty || busy, (href) => requestLeave(() => onNavigate(href)));
  return {
    requestLeave,
    open: leaveAction !== null,
    onOpenChange: (open: boolean) => {
      if (!open) setLeaveAction(null);
    },
    onConfirm: () => {
      if (busy) return;
      onDiscard();
      setLeaveAction(null);
      leaveAction?.();
    },
  };
}
