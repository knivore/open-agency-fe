import type { ReactNode } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/library/shadcn/dialog';

export function Modal({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-w-2xl">
        <DialogTitle className="sr-only">Open Agency dialog</DialogTitle>
        <DialogDescription className="sr-only">
          Review the information and available actions in this dialog.
        </DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}
