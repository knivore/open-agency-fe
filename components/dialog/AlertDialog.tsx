import { useState } from 'react';

import {
  AlertDialog as ShadcnAlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../library/shadcn/alert-dialog';
import { Button } from '../library/shadcn/button';

export interface AlertDialogProps {
  trigger?: React.ReactNode;
  title: string;
  description: string;
  cancelText?: string;
  confirmText?: string;
  variant?: 'default' | 'destructive';
  onConfirm?: () => void;
  onCancel?: () => void;
}

const AlertDialog: React.FC<AlertDialogProps> = ({
  trigger,
  title,
  description,
  cancelText = 'Cancel',
  confirmText = 'Continue',
  variant = 'default',
  onConfirm,
  onCancel,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleConfirm = () => {
    setIsOpen(false);
    onConfirm?.();
  };

  const handleCancel = () => {
    setIsOpen(false);
    onCancel?.();
  };

  return (
    <ShadcnAlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        {trigger || (
          <Button variant={variant === 'destructive' ? 'destructive' : 'outline'}>
            {confirmText}
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={variant === 'destructive' ? 'bg-destructive hover:bg-destructive/90' : ''}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </ShadcnAlertDialog>
  );
};

export default AlertDialog;
