'use client';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../library/shadcn/button';
import HITL from '../human-in-the-loop/HITL';
import WorkflowRunInputsDialog from '@/components/workflows/run/WorkflowRunInputsDialog';
import useWorkflowKickoff from '@/hooks/useWorkflowKickoff';
import CopyToClipboardButton from '@/components/workflows/CopyToClipboardButton';
import { Toaster } from 'sonner';
import { Label } from '../library/shadcn/label';
import { Badge } from '../library/shadcn/badge';
import ImageArtifacts from '../artifacts/ImageArtifacts';
import { Alert, AlertDescription, AlertTitle } from '../library/shadcn/alert';
import { AlertCircle, Terminal } from 'lucide-react';

interface WorkflowRunPanelProps {
  workflowId: string;
  toolsUsed: string;
  workflowKickoffInputs: Record<string, string>;
  taskOrder: string[];
  runtimeAdapterId?: string | null;
}

export default function WorkflowRunPanel({
  workflowId,
  toolsUsed,
  workflowKickoffInputs,
  taskOrder,
  runtimeAdapterId,
}: WorkflowRunPanelProps) {
  const [inputs, setInputs] = useState<Record<string, string>>(() => {
    const savedInputs =
      typeof window === 'undefined' ? null : localStorage.getItem(`workflow-inputs-${workflowId}`);
    const parsedSavedInputs = savedInputs ? JSON.parse(savedInputs) : {};
    return parsedSavedInputs;
  });
  const effectiveInputs = useMemo(
    () => ({
      ...(workflowKickoffInputs || {}),
      ...inputs,
    }),
    [workflowKickoffInputs, inputs]
  );

  useEffect(() => {
    if (Object.keys(effectiveInputs).length > 0) {
      localStorage.setItem(`workflow-inputs-${workflowId}`, JSON.stringify(effectiveInputs));
    }
  }, [effectiveInputs, workflowId]);

  const {
    isAttemptingKickoff,
    isRunning,
    handleKickoff,
    handleStop,
    isStoppingWorkflow,
    output,
    error,
    processId,
  } = useWorkflowKickoff({
    workflowId,
    inputs: effectiveInputs,
    taskOrder,
    runtimeAdapterId,
    onSuccess: () => console.log('Workflow kicked off successfully!'),
    onError: (err) => console.error('Failed to kick off workflow:', err),
  });

  const handleRunClick = () => {
    handleKickoff();
  };

  const handleInputUpdate = (updatedInputs: Record<string, string>) => {
    setInputs(updatedInputs);
    handleRunClick();
  };

  return (
    <div className="flex flex-col items-center justify-end space-y-2">
      {processId && <HITL processId={processId} />}

      {Object.keys(effectiveInputs).length > 0 ? (
        <WorkflowRunInputsDialog
          inputsJson={effectiveInputs}
          isAttemptingKickoff={isAttemptingKickoff}
          isRunning={isRunning}
          handleStop={handleStop}
          onSubmit={handleInputUpdate}
        />
      ) : (
        <Button
          className="w-full"
          onClick={isRunning ? handleStop : handleRunClick}
          variant={isRunning ? 'destructive' : 'default'}
          disabled={isAttemptingKickoff || isStoppingWorkflow}
        >
          {isAttemptingKickoff ? (
            <>
              <span className="loading loading-spinner loading-sm mr-2"></span>
              Starting Workflow...
            </>
          ) : isRunning ? (
            'Stop Workflow'
          ) : isStoppingWorkflow ? (
            <span className="loading loading-spinner loading-sm mr-2"></span>
          ) : (
            'Run Workflow'
          )}
        </Button>
      )}

      <div className="w-full min-h-80 h-full">
        <DisplayInputs inputs={effectiveInputs} />
        {error && <Error error={error} />}
        {output && <Output output={output} />}
        {isRunning && <Running />}
        {processId && toolsUsed.includes('Web Browsing') && (
          <ImageArtifacts processId={processId} />
        )}
      </div>
    </div>
  );
}

const Error = ({ error }: { error: string }) => {
  return (
    <div className="mt-2 mb-6">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    </div>
  );
};

const Output = ({ output }: { output: string }) => {
  return (
    <div className="mt-2 mb-6">
      <Alert>
        <Terminal className="h-4 w-4" />
        <AlertTitle>Output</AlertTitle>
        <AlertDescription>
              <CopyToClipboardButton text={output} />
        </AlertDescription>
      </Alert>
    </div>
  );
};

const Running = () => {
  return (
    <Alert className="h-96 flex items-center justify-center bg-gray-50">
      <pre>Workflow running...</pre>
    </Alert>
  );
};

const DisplayInputs = ({ inputs }: { inputs: Record<string, string> }) => {
  if (Object.keys(inputs).length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      <Label>Kickoff Inputs</Label>
      <div className="flex flex-wrap gap-2">
        {Object.entries(inputs).map(([key, value]) => (
          <Badge key={key} variant="outline" className="select-none hover:bg-neutral-200">
            {key}: {value || 'pending'}
          </Badge>
        ))}
      </div>
      <Toaster />
    </div>
  );
};
