import { getWorkflowRunStatus, startWorkflowById, stopWorkflowRun } from '@/app/api/utils/workflows';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { VerboseOutput } from '@/types/domain/verbose';
import type { ExecutionHost, WorkflowExecutionStartPayload } from '@/types/workflows';

type UseWorkflowKickoffProps = {
  workflowId: string;
  inputs?: Record<string, string>;
  taskOrder: string[];
  agentConfigs?: WorkflowExecutionStartPayload['agentConfigs'] | null;
  runtimeAdapterId?: string | null;
  executionHost?: ExecutionHost | null;
  onError?: (error: Error) => void;
  onSuccess?: () => void;
  enableDetailedLogs?: boolean;
};

export type UseWorkflowKickoffReturn = {
  error: string | null;
  handleKickoff: () => Promise<void>;
  handleStop: () => Promise<void>;
  isAttemptingKickoff: boolean;
  isStoppingWorkflow: boolean;
  isRunning: boolean;
  output: string | null;
  processId: string | null;
  verboseOutput: VerboseOutput[];
};

export default function useWorkflowKickoff({
  workflowId,
  inputs = {},
  taskOrder,
  agentConfigs,
  runtimeAdapterId,
  executionHost,
  onError,
  enableDetailedLogs = false,
}: UseWorkflowKickoffProps): UseWorkflowKickoffReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [processId, setProcessId] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verboseOutput, setVerboseOutput] = useState<VerboseOutput[]>([]);

  const kickoffMutation = useMutation({
    mutationFn: () => startWorkflowById(
      workflowId,
      inputs,
      taskOrder,
      agentConfigs ?? {},
      runtimeAdapterId,
      executionHost
    ),
    onMutate: () => {
      setOutput(null);
      setVerboseOutput([]);
      setError(null);
    },
    onSuccess: (data) => {
      setVerboseOutput([]);
      setIsRunning(true);
      setProcessId(data.process_id);
      setOutput(data.output || null);
      setError(null);
    },
    onError: (error) => {
      setIsRunning(false);
      setProcessId(null);
      setError(error.message);
      onError?.(new Error(error.message));
    },
  });

  const stopMutation = useMutation({
    mutationFn: (nextProcessId: string) => stopWorkflowRun(nextProcessId),
    onSuccess: () => {
      setIsRunning(false);
      setProcessId(null);
      setOutput('Workflow stopped manually');
    },
    onError: () => {
      setError('Failed to stop workflow, please try again.');
    },
  });

  const handleKickoff = async () => {
    toast.promise(kickoffMutation.mutateAsync(), {
      loading: 'Kicking off workflow...',
      success: () => 'Workflow kicked off successfully!',
      error: () => 'Failed to kick off workflow, please try again.',
      position: 'top-right',
    });
  };

  const handleStop = async () => {
    if (!processId) return;

    toast.promise(stopMutation.mutateAsync(processId), {
      loading: 'Stopping workflow...',
      success: () => 'Workflow stopped successfully!',
      error: () => 'Failed to stop workflow, please try again.',
      position: 'top-right',
    });
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;

    const checkStatus = async () => {
      if (!processId || !isRunning) {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = undefined;
        }
        return;
      }

      try {
        const status = await getWorkflowRunStatus(processId);

        if (status.status === 'completed') {
          setIsRunning(false);
          setOutput(status.result || 'Task completed successfully');
          setTimeout(() => setProcessId(null), 5000);
        } else if (status.status === 'failed') {
          setIsRunning(false);
          setError(status.result || 'Task failed');
          setProcessId(null);
          onError?.(new Error(status.result || 'Task failed'));
        }
      } catch {
        setIsRunning(false);
        setError('Failed to check task status');
        setProcessId(null);
        onError?.(new Error('Failed to check task status'));
      }
    };

    if (isRunning && processId) {
      intervalId = setInterval(checkStatus, 3000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isRunning, processId, onError]);

  useEffect(() => {
    let eventSource: EventSource | undefined;

    const setupEventSource = (nextProcessId: string) => {
      if (!enableDetailedLogs || !nextProcessId || !kickoffMutation.isSuccess) return;

      eventSource = new EventSource(`/api/workflows/process/${nextProcessId}/verbose`);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setVerboseOutput((prev) => [...prev, data]);
      };

      eventSource.onerror = () => {
        eventSource?.close();
      };

      eventSource.addEventListener('close', () => {
        eventSource?.close();
      });
    };

    if (processId && enableDetailedLogs && kickoffMutation.isSuccess) {
      setupEventSource(processId);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [processId, enableDetailedLogs, kickoffMutation.isSuccess]);

  return {
    error,
    handleKickoff,
    handleStop,
    isAttemptingKickoff: kickoffMutation.isPending,
    isStoppingWorkflow: stopMutation.isPending,
    isRunning,
    output,
    processId,
    verboseOutput,
  };
}
