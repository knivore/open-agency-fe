'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { normalizeRunStatus } from '@/lib/workflows/runFormatting';
import { useRunsModule } from '@/components/runs/context';
import { localUser } from '@/lib/identity/localUser';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);

function runStatusValue(status: unknown): string | null {
  return typeof status === 'string' ? status : null;
}

export function useRunDetailData(runId: string) {
  const { api, queryKeys } = useRunsModule();
  const queryClient = useQueryClient();

  const runQuery = useQuery({
    queryKey: queryKeys.runSession(runId),
    queryFn: () => api.runSessions.getRunSession(runId),
    refetchInterval: (query) => {
      const status = query.state.data?.summary.status;
      return status && TERMINAL_STATUSES.has(status) ? false : 5000;
    },
  });

  const timelineQuery = useQuery({
    queryKey: queryKeys.runTimeline(runId),
    queryFn: () => api.logs.getRunTimeline(runId),
    refetchInterval: (query) => {
      const status = normalizeRunStatus(query.state.data?.execution?.status);
      return TERMINAL_STATUSES.has(status) ? false : 5000;
    },
  });

  const eventsQuery = useQuery({
    queryKey: queryKeys.runEvents(runId),
    queryFn: () => api.logs.listRunEvents(runId),
    refetchInterval: () => {
      const runStatus = runStatusValue(runQuery.data?.summary.status);
      return runStatus && TERMINAL_STATUSES.has(runStatus) ? false : 5000;
    },
  });

  const artifactsQuery = useQuery({
    queryKey: queryKeys.runArtifacts(runId),
    queryFn: () => api.runSessions.listRunArtifacts(runId),
  });

  const logsQuery = useQuery({
    queryKey: queryKeys.runLogs(runId),
    queryFn: () => api.runSessions.getRunLogs(runId),
    refetchInterval: () => {
      const runStatus = runStatusValue(runQuery.data?.summary.status);
      return runStatus && TERMINAL_STATUSES.has(runStatus) ? false : 5000;
    },
  });

  const conversationContextQuery = useQuery({
    queryKey: queryKeys.runConversation(runId),
    queryFn: () => api.conversations.findExecutionContext(runId),
  });

  const workflowQuery = useQuery({
    queryKey: runQuery.data?.summary.workflowId ? queryKeys.workflow(runQuery.data.summary.workflowId) : ['backendWorkflow', 'missing-run-workflow'] as const,
    queryFn: () => api.workflows.getWorkflow(runQuery.data!.summary.workflowId!),
    enabled: Boolean(runQuery.data?.summary.workflowId),
  });

  const refreshAll = async () => {
    await Promise.all([
      runQuery.refetch(),
      timelineQuery.refetch(),
      eventsQuery.refetch(),
      artifactsQuery.refetch(),
      logsQuery.refetch(),
      conversationContextQuery.refetch(),
      workflowQuery.refetch(),
    ]);
  };

  const mutationOptions = {
    onSuccess: async () => {
      await refreshAll();
      await queryClient.invalidateQueries({ queryKey: queryKeys.agentRuns() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.activeRunSessions() });
      if (runQuery.data?.summary.workflowId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.workflowRuns(runQuery.data.summary.workflowId) });
      }
    },
  };

  const pauseMutation = useMutation({ mutationFn: () => api.runs.pauseRun(runId), ...mutationOptions });
  const resumeMutation = useMutation({ mutationFn: () => api.runs.resumeRun(runId), ...mutationOptions });
  const cancelMutation = useMutation({ mutationFn: () => api.runs.cancelRun(runId), ...mutationOptions });
  const approvalDecisionMutation = useMutation({
    mutationFn: async ({ approvalRequestId, action }: { approvalRequestId: string; action: 'approve' | 'reject' }) => {
      const actorUserId = localUser.id;
      return action === 'approve'
        ? api.conversations.approveApprovalRequest(approvalRequestId, { user_id: actorUserId })
        : api.conversations.rejectApprovalRequest(approvalRequestId, { user_id: actorUserId });
    },
    onSuccess: async () => {
      await refreshAll();
    },
  });

  return {
    runQuery,
    timelineQuery,
    eventsQuery,
    artifactsQuery,
    logsQuery,
    conversationContextQuery,
    workflowQuery,
    refreshAll,
    pauseMutation,
    resumeMutation,
    cancelMutation,
    approvalDecisionMutation,
  };
}
