'use client';

import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { CircleDotDashed } from 'lucide-react';
import ConfirmActionDialog from '@/components/app-shell/ConfirmActionDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/library/shadcn/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/library/shadcn/sheet';
import { cn } from '@/lib/utils';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';

type AppOverlaySize = 'sm' | 'md' | 'lg' | 'xl';

interface AppOverlayFrameProps {
  title: string;
  description?: string;
  titleNode?: ReactNode;
  descriptionNode?: ReactNode;
  icon?: ReactNode;
  dirty?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  bodyClassName?: string;
}

const dialogSizeClass: Record<AppOverlaySize, string> = {
  sm: 'sm:max-w-lg',
  md: 'sm:max-w-2xl',
  lg: 'sm:max-w-4xl',
  xl: 'sm:max-w-6xl',
};

function AppOverlayFrame({
  title,
  description,
  titleNode,
  descriptionNode,
  icon,
  dirty = false,
  children,
  footer,
  bodyClassName,
}: AppOverlayFrameProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-(--agency-shell-border) bg-(--agency-shell-panel-strong) px-5 py-4 pr-14 sm:px-6">
        <div className="flex items-start gap-3">
          {icon ? (
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-(--agency-shell-border) bg-(--agency-row-hover) text-(--agency-shell-muted)">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {titleNode ?? (
                <h2 className="text-lg font-semibold tracking-tight text-(--agency-shell-text)">
                  {title}
                </h2>
              )}
              {dirty ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-300/25 dark:bg-amber-400/10 dark:text-amber-100">
                  <CircleDotDashed className="size-3" aria-hidden="true" />
                  Unsaved changes
                </span>
              ) : null}
            </div>
            {description
              ? (descriptionNode ?? (
                  <p className="mt-1 text-sm leading-6 text-(--agency-shell-muted)">
                    {description}
                  </p>
                ))
              : null}
          </div>
        </div>
      </div>
      {/* Flex-column bodies must overflow here instead of shrinking and clipping their sections. */}
      <div
        className={cn(
          'min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 [&>*]:shrink-0',
          bodyClassName
        )}
      >
        {children}
      </div>
      {footer ? (
        <div className="shrink-0 border-t border-(--agency-shell-border) bg-(--agency-shell-panel-strong)/96 px-5 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:px-6">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            {footer}
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface AppOverlayBehaviorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dirty?: boolean;
  busy?: boolean;
  onDiscard?: () => void;
}

function useAppOverlayBehavior({
  open,
  onOpenChange,
  dirty = false,
  busy = false,
  onDiscard,
}: AppOverlayBehaviorProps) {
  const [discardConfirmationOpen, setDiscardConfirmationOpen] = useState(false);
  useUnsavedChangesGuard(open && dirty);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (busy) return;
      if (!nextOpen && dirty) {
        setDiscardConfirmationOpen(true);
        return;
      }
      onOpenChange(nextOpen);
    },
    [busy, dirty, onOpenChange]
  );

  const discardDialog = (
    <ConfirmActionDialog
      trigger={null}
      open={discardConfirmationOpen}
      onOpenChange={setDiscardConfirmationOpen}
      title="Discard unsaved changes?"
      description="Your edits have not been saved. Closing now will permanently discard them."
      cancelLabel="Continue editing"
      confirmLabel="Discard changes"
      destructive
      onConfirm={() => {
        onDiscard?.();
        setDiscardConfirmationOpen(false);
        onOpenChange(false);
      }}
    />
  );

  return { handleOpenChange, discardDialog };
}

interface AppDialogProps extends AppOverlayFrameProps, AppOverlayBehaviorProps {
  size?: AppOverlaySize;
  contentClassName?: string;
}

export function AppDialog({
  open,
  onOpenChange,
  dirty = false,
  busy = false,
  onDiscard,
  size = 'md',
  contentClassName,
  ...frameProps
}: AppDialogProps) {
  const { handleOpenChange, discardDialog } = useAppOverlayBehavior({
    open,
    onOpenChange,
    dirty,
    busy,
    onDiscard,
  });

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          closeButtonDisabled={busy}
          className={cn(
            'flex h-dvh max-h-dvh w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-auto sm:max-h-[min(92dvh,60rem)] sm:w-[calc(100%-2rem)] sm:rounded-xl sm:border',
            dialogSizeClass[size],
            contentClassName
          )}
        >
          <AppOverlayFrame
            {...frameProps}
            dirty={dirty}
            titleNode={
              <DialogTitle className="text-lg font-semibold tracking-tight text-(--agency-shell-text)">
                {frameProps.title}
              </DialogTitle>
            }
            descriptionNode={
              frameProps.description ? (
                <DialogDescription className="mt-1 text-sm leading-6 text-(--agency-shell-muted)">
                  {frameProps.description}
                </DialogDescription>
              ) : undefined
            }
          />
        </DialogContent>
      </Dialog>
      {discardDialog}
    </>
  );
}

interface AppDrawerProps extends AppOverlayFrameProps, AppOverlayBehaviorProps {
  side?: 'left' | 'right';
  width?: AppOverlaySize;
  contentClassName?: string;
  hideOverlay?: boolean;
}

export function AppDrawer({
  open,
  onOpenChange,
  dirty = false,
  busy = false,
  onDiscard,
  side = 'right',
  width = 'md',
  contentClassName,
  hideOverlay = false,
  ...frameProps
}: AppDrawerProps) {
  const { handleOpenChange, discardDialog } = useAppOverlayBehavior({
    open,
    onOpenChange,
    dirty,
    busy,
    onDiscard,
  });

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side={side}
          hideOverlay={hideOverlay}
          closeButtonDisabled={busy}
          className={cn(
            'flex w-full max-w-none flex-col gap-0 border-(--agency-shell-border) bg-(--agency-shell-panel-strong) p-0 text-(--agency-shell-text)',
            dialogSizeClass[width],
            contentClassName
          )}
        >
          <AppOverlayFrame
            {...frameProps}
            dirty={dirty}
            titleNode={
              <SheetTitle className="text-lg font-semibold tracking-tight text-(--agency-shell-text)">
                {frameProps.title}
              </SheetTitle>
            }
            descriptionNode={
              frameProps.description ? (
                <SheetDescription className="mt-1 text-sm leading-6 text-(--agency-shell-muted)">
                  {frameProps.description}
                </SheetDescription>
              ) : undefined
            }
          />
        </SheetContent>
      </Sheet>
      {discardDialog}
    </>
  );
}
