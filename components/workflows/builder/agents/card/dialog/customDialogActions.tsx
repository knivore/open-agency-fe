import { Button } from '../../../../../library/shadcn/button';
import { Toggle } from '../../../../../library/shadcn/toggle';
import { Trash2, X, Wand2 } from 'lucide-react';
import AlertDialog from '../../../../../dialog/AlertDialog';
import type { WorkflowAgentFormData } from '@/types/workflows';

interface CustomDialogActionsProps {
  onClose: () => void;
  onDelete?: () => Promise<void>;
  isDeleteDisabled?: boolean;
  isAdvance: boolean;
  setIsAdvance: (isAdvance: boolean) => void;
  agent?: WorkflowAgentFormData;
  onRewriteWithAI: () => Promise<void>;
  isRewriting?: boolean;
  showAIVersion: boolean;
  rewrittenValues: Partial<WorkflowAgentFormData>;
  onToggleChange: (checked: boolean) => void;
}

export const CustomDialogActions = ({
  onClose,
  onDelete = () => Promise.resolve(),
  isDeleteDisabled = false,
  isAdvance,
  setIsAdvance,
  agent,
  onRewriteWithAI,
  isRewriting = false,
  showAIVersion,
  rewrittenValues,
  onToggleChange,
}: CustomDialogActionsProps) => {
  const handleClose = () => {
    onClose();
  };

  return (
    <div className="flex flex-col">
      <div className="absolute right-4 top-4 flex flex-row items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="gap-1 h-10"
          onClick={onRewriteWithAI}
          disabled={isRewriting || !agent}
        >
          <Wand2 className="h-4 w-4" />
          {isRewriting ? '...' : 'Rewrite with AI'}
        </Button>

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
            <Button variant="ghost" size="icon" disabled={isDeleteDisabled}>
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
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {Object.keys(rewrittenValues).length > 0 && (
        <div className="absolute right-4 top-16 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Original</span>
          <div className="relative inline-block w-11 h-5">
            <input
              type="checkbox"
              checked={showAIVersion}
              onChange={(e) => onToggleChange(e.target.checked)}
              className="peer appearance-none w-11 h-5 bg-slate-100 rounded-full checked:bg-slate-800 cursor-pointer transition-colors duration-300"
            />
            <span className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform duration-300 peer-checked:translate-x-6"></span>
          </div>
          <span className="text-sm text-muted-foreground">Rewritten </span>
        </div>
      )}
    </div>
  );
};
