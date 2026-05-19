import { useWorkflowRunContext } from '../WorkflowRunProvider';
import { Alert, AlertTitle } from '../../../library/shadcn/alert';
import { Button } from '../../../library/shadcn/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../library/shadcn/card';
import WorkflowRunInputsDialog from '@/components/workflows/run/WorkflowRunInputsDialog';
import { Terminal, X } from 'lucide-react';
import AgentToolConfigurationList, {
  AgentToolConfigurationListRef,
} from '@/components/workflows/run/navbar/configs/AgentToolConfigurationList';
import { useRef } from 'react';

export default function WorkflowRunControlsPanel() {
  const { isControlsOpen, setIsControlsOpen, isRunning, output } = useWorkflowRunContext();

  const agentToolListRef = useRef<AgentToolConfigurationListRef>(null);

  if (!isControlsOpen) return null;

  return (
    <div className="absolute right-0 top-14 ml-auto w-96 px-4 py-2 h-[calc(100vh-11rem)] max-h-screen">
      <Card className="h-full shadow-md relative flex flex-col">
        <CardHeader className="pb-3 flex-shrink-0">
          <CardTitle className="pr-8">Controls</CardTitle>
          {(isRunning || (!isRunning && output)) && (
            <div className="py-2">
              {isRunning && <Running />}
              {!isRunning && output && <Success />}
            </div>
          )}
          <Button
            className="absolute top-2 right-2"
            variant="ghost"
            size="icon"
            onClick={() => setIsControlsOpen(false)}
          >
            <X />
          </Button>
        </CardHeader>
        <CardContent className="flex-grow overflow-y-auto">
          <div className="space-y-4">
            <WorkflowRunControls agentToolListRef={agentToolListRef} />
            <WorkflowRunConfigurationSection agentToolListRef={agentToolListRef} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const ControlsPanelLabel = ({ label }: { label: string }) => {
  return (
    <div className="flex justify-between items-center">
      <h3 className="font-semibold text-ellipsis overflow-hidden">{label}</h3>
    </div>
  );
};

const WorkflowRunControls = ({
  agentToolListRef,
}: {
  agentToolListRef: React.RefObject<AgentToolConfigurationListRef>;
}) => {
  const {
    isRunning,
    isStoppingWorkflow,
    isAttemptingKickoff,
    handleKickoff,
    handleStop,
    inputs,
    setInputs,
    areAgentsConfigured,
    setAgentConfigs,
  } = useWorkflowRunContext();

  const handleKickoffWithConfigs = () => {
    try {
      const configs = agentToolListRef.current?.collectAllConfigs();
      if (configs) {
        setAgentConfigs(configs);
        handleKickoff();
      }
    } catch (error) {
      console.error('Failed to collect agent configurations:', error);
    }
  };

  return (
    <div className="space-y-2">
      <ControlsPanelLabel label="Run Workflow" />
      <div className="flex gap-2">
        {Object.keys(inputs).length > 0 ? (
          <WorkflowRunInputsDialog
            inputsJson={inputs}
            isAttemptingKickoff={isAttemptingKickoff}
            isRunning={isRunning}
            handleStop={handleStop}
            onSubmit={(updatedInputs) => {
              setInputs(updatedInputs);
              handleKickoffWithConfigs();
            }}
          />
        ) : (
          <Button
            className="w-full"
            size="sm"
            color="primary"
            disabled={isRunning || isAttemptingKickoff || !areAgentsConfigured}
            onClick={handleKickoffWithConfigs}
          >
            {isAttemptingKickoff ? 'Starting Workflow...' : 'Start Workflow'}
          </Button>
        )}
        <Button
          className="w-full"
          size="sm"
          variant="outline"
          disabled={!isRunning || isStoppingWorkflow}
          onClick={handleStop}
        >
          {isStoppingWorkflow ? 'Stopping Workflow...' : 'Stop Workflow'}
        </Button>
      </div>
    </div>
  );
};

const WorkflowRunConfigurationSection = ({
  agentToolListRef,
}: {
  agentToolListRef: React.RefObject<AgentToolConfigurationListRef>;
}) => {
  return (
    <div className="space-y-2">
      <ControlsPanelLabel label="Agent Tools Configuration" />
      <p className="text-sm text-muted-foreground line-clamp-3 hover:line-clamp-none">
        Please fill out all required parameters for each agent before running the workflow.
      </p>
      <Card className="overflow-hidden">
        <CardContent className="p-4 overflow-auto max-h-96">
          <div className="w-full">
            <AgentToolConfigurationList ref={agentToolListRef} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const Running = () => {
  return (
    <Alert className="bg-secondary-300 border-secondary text-secondary p-2 py-3">
      <div className="flex justify-center gap-2">
        <Terminal className="h-5 w-5 flex-shrink-0" />
        <AlertTitle className="flex items-center text-base overflow-hidden text-ellipsis">
          Workflow is running!
          <span className="loading loading-spinner loading-md text-secondary ml-2 flex-shrink-0"></span>
        </AlertTitle>
      </div>
    </Alert>
  );
};

const Success = () => {
  return (
    <Alert className="bg-primary-50 border-primary text-primary p-2 py-3">
      <div className="flex justify-center gap-2">
        <Terminal className="h-5 w-5 flex-shrink-0" />
        <AlertTitle className="flex items-center text-base overflow-hidden text-ellipsis">
          Workflow finished processing
        </AlertTitle>
      </div>
    </Alert>
  );
};
