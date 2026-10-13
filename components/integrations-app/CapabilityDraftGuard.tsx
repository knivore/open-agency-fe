'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import ConfirmActionDialog from '../app-shell/ConfirmActionDialog';

const DraftContext = createContext<{
  setDirty: (dirty: boolean) => void;
  navigate: (action: () => void) => void;
}>({
  setDirty: () => {},
  navigate: (action: () => void) => action(),
});
export const useCapabilityDraftGuard = () => useContext(DraftContext);

export function CapabilityDraftGuard({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  // Tab changes unmount the editor without triggering beforeunload. Keep the
  // explicit Save/Cancel contract instead of silently losing the access draft.
  const navigate = useCallback(
    (action: () => void) => {
      if (dirty) setPending(() => action);
      else action();
    },
    [dirty]
  );
  const value = useMemo(() => ({ setDirty, navigate }), [navigate]);
  return (
    <DraftContext.Provider value={value}>
      {children}
      <ConfirmActionDialog
        trigger={null}
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title="Discard unsaved access changes?"
        description="Save your specialist selections first, or discard them to leave Capability Studio."
        confirmLabel="Discard and continue"
        cancelLabel="Keep editing"
        onConfirm={() => {
          const action = pending;
          setPending(null);
          setDirty(false);
          action?.();
        }}
      />
    </DraftContext.Provider>
  );
}
