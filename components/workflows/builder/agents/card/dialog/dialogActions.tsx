import AlertDialog from '../../../../../dialog/AlertDialog';
import { Button } from '../../../../../library/shadcn/button';
import { Toggle } from '../../../../../library/shadcn/toggle';
import { Trash2, X } from 'lucide-react';

interface DialogActionsProps {
  onClose: () => void;
  onDelete?: () => Promise<void>;
  isDeleteDisabled?: boolean;
  isAdvance: boolean;
  setIsAdvance: (isAdvance: boolean) => void;
}

export const DialogActions = ({
                                onClose,
                                onDelete = () => Promise.resolve(),
                                isDeleteDisabled = false,
                                isAdvance,
                                setIsAdvance,
                              }: DialogActionsProps) => {
  return (
    <div className="absolute right-4 top-4 flex flex-row items-center gap-1">
      <Toggle
        variant="outline"
        size="sm"
        className="w-fit h-10 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        onClick={() => setIsAdvance(!isAdvance)}
      >
        {isAdvance ? 'Simple' : 'Advance'}
      </Toggle>
      <AlertDialog
        trigger={
          <Button variant="ghost" size="icon">
            <Trash2 className="h-4 w-4" />
          </Button>
        }
        title="Delete Agent"
        description="Are you sure you want to delete this agent? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={onDelete}
      />
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};
