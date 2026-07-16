'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, LoaderCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/library/shadcn/alert-dialog';
import { buttonVariants } from '@/components/library/shadcn/button';

interface ConfirmActionDialogProps {
  trigger: ReactNode | null;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel?: string;
  pending?: boolean;
  destructive?: boolean;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function ConfirmActionDialog({
  trigger,
  title,
  description,
  confirmLabel,
  pendingLabel,
  pending = false,
  destructive = false,
  cancelLabel = 'Keep current state',
  onConfirm,
  open,
  onOpenChange,
}: ConfirmActionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger !== null ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent
        className={
          destructive
            ? 'border-rose-300/70 shadow-[0_24px_80px_rgba(127,29,29,0.18)] dark:border-rose-300/25'
            : undefined
        }
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-start gap-3">
            {destructive ? (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-300/25 dark:bg-rose-400/10 dark:text-rose-200">
                <AlertTriangle className="size-4" aria-hidden="true" />
              </span>
            ) : null}
            <span className="pt-1">{title}</span>
          </AlertDialogTitle>
          <AlertDialogDescription className={destructive ? 'sm:pl-12' : undefined}>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: destructive ? 'destructive' : 'default' })}
            disabled={pending}
            onClick={() => void onConfirm()}
          >
            {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
            {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
