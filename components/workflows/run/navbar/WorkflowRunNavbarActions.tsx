import { useWorkflowRunContext } from '../WorkflowRunProvider';

import { Button } from '../../../library/shadcn/button';
import { Settings2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../library/shadcn/tooltip';

export default function WorkflowRunNavbarActions() {
  const { isControlsOpen, setIsControlsOpen } = useWorkflowRunContext();

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        <NavButton
          icon={Settings2}
          tooltip="Settings"
          onClick={() => setIsControlsOpen(!isControlsOpen)}
        />
      </div>
    </TooltipProvider>
  );
}

const NavButton = ({
  icon: Icon,
  tooltip,
  onClick,
  disabled,
}: {
  icon: any;
  tooltip: string;
  onClick?: () => void;
  disabled?: boolean;
}) => (
  <Tooltip delayDuration={0}>
    <TooltipTrigger asChild>
      <Button
        className="border-none shadow-md"
        size="icon"
        variant="outline"
        onClick={onClick}
        disabled={disabled}
      >
        <Icon />
      </Button>
    </TooltipTrigger>
    <TooltipContent side="bottom" sideOffset={0}>
      <p>{tooltip}</p>
    </TooltipContent>
  </Tooltip>
);
