'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { normalizeRunStatus } from '@/lib/workflows/runFormatting';
import { useRunsModule } from '@/components/runs/context';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);
export const RUN_GOVERNANCE_EVENT_TYPES = [
  'token.usage.recorded',
  'model.fallback.used',
  'model.fallback.failed',
  'token.budget.warning',
  'token.budget.exceeded',
  'context.health.recorded',
  'context.compaction.started',
  'context.compaction.completed',
  'context.compaction.failed',
  'supervisor.steering.requested',
  'supervisor.steering.applied',
];

function runStatusValue(status: unknown): string | null {
  return typeof status === 'string' ? status : null;
}

export function useRunDetailData(runId: string) {
  const { api, queryKeys } = useRunsModule();
  const queryClient = useQueryClient();
  const { data: session } = useSession();

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
  const governanceEventsQuery = useQuery({
    queryKey: queryKeys.runGovernanceEvents(runId),
    queryFn: () => api.logs.listRunEvents(runId, 0, RUN_GOVERNANCE_EVENT_TYPES),
    refetchInterval: () => {
      const runStatus = runStatusValue(runQuery.data?.summary.status);
      return runStatus && TERMINAL_STATUSES.has(runStatus) ? false : 5000;
    },
  });

  const nativeApprovalsQuery = useQuery({
    queryKey: queryKeys.runApprovals(runId),
    queryFn: () => api.runSessions.listRunApprovals(runId),
    refetchInterval: () => {
      const runStatus = runStatusValue(runQuery.data?.summary.status);
      return runStatus && TERMINAL_STATUSES.has(runStatus) ? false : 5000;
    },
  });

  const waitsQuery = useQuery({
    queryKey: queryKeys.runWaits(runId),
    queryFn: () => api.runSessions.listRunWaits(runId),
    refetchInterval: () => {
      const runStatus = runStatusValue(runQuery.data?.summary.status);
      return runStatus && TERMINAL_STATUSES.has(runStatus) ? false : 5000;
    },
  });

  const usageQuery = useQuery({
    queryKey: queryKeys.runUsage(runId),
    queryFn: () => api.runSessions.getRunUsage(runId),
    refetchInterval: () => {
      const runStatus = runStatusValue(runQuery.data?.summary.status);
      return runStatus && TERMINAL_STATUSES.has(runStatus) ? false : 5000;
    },
  });

  const contextUsageQuery = useQuery({
    queryKey: queryKeys.runContextUsage(runId),
    queryFn: () => api.runSessions.getRunContextUsage(runId),
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
    queryKey: runQuery.data?.summary.workflowId
      ? queryKeys.workflow(runQuery.data.summary.workflowId)
      : (['backendWorkflow', 'missing-run-workflow'] as const),
    queryFn: () => api.workflows.getWorkflow(runQuery.data!.summary.workflowId!),
    enabled: Boolean(runQuery.data?.summary.workflowId),
  });

  const refreshAll = async () => {
    await Promise.all([
      runQuery.refetch(),
      timelineQuery.refetch(),
      eventsQuery.refetch(),
      governanceEventsQuery.refetch(),
      nativeApprovalsQuery.refetch(),
      waitsQuery.refetch(),
      usageQuery.refetch(),
      contextUsageQuery.refetch(),
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
        await queryClient.invalidateQueries({
          queryKey: queryKeys.workflowRuns(runQuery.data.summary.workflowId),
        });
      }
    },
  };

  const pauseMutation = useMutation({
    mutationFn: () => api.runs.pauseRun(runId),
    ...mutationOptions,
  });
  const resumeMutation = useMutation({
    mutationFn: () => api.runs.resumeRun(runId),
    ...mutationOptions,
  });
  const cancelMutation = useMutation({
    mutationFn: () => api.runs.cancelRun(runId),
    ...mutationOptions,
  });
  const approvalDecisionMutation = useMutation({
    mutationFn: async ({
      approvalRequestId,
      action,
    }: {
      approvalRequestId: string;
      action: 'approve' | 'reject';
    }) => {
      const actorUserId =
        typeof session?.user?.id === 'string'
          ? session.user.id
          : typeof session?.user?.email === 'string'
            ? session.user.email
            : 'unknown-user';
      return action === 'approve'
        ? api.conversations.approveApprovalRequest(approvalRequestId, { user_id: actorUserId })
        : api.conversations.rejectApprovalRequest(approvalRequestId, { user_id: actorUserId });
    },
    onSuccess: async () => {
      await refreshAll();
    },
  });
  const nativeApprovalDecisionMutation = useMutation({
    mutationFn: async ({
      toolId,
      action,
      reason,
    }: {
      toolId: string;
      action: 'approve' | 'reject';
      reason?: string;
    }) =>
      action === 'approve'
        ? api.runs.approveRun(runId, toolId, reason)
        : api.runs.rejectRun(runId, toolId, reason),
    onSuccess: async () => {
      await refreshAll();
    },
  });
  const resolveWaitMutation = useMutation({
    mutationFn: ({
      waitId,
      resolutionPayload,
      resolutionKey,
    }: {
      waitId: string;
      resolutionPayload: Record<string, unknown>;
      resolutionKey: string;
    }) => api.runs.resolveRunWait(runId, waitId, resolutionPayload, resolutionKey),
    onSuccess: async () => {
      await refreshAll();
    },
  });

  return {
    runQuery,
    timelineQuery,
    eventsQuery,
    governanceEventsQuery,
    nativeApprovalsQuery,
    waitsQuery,
    usageQuery,
    contextUsageQuery,
    artifactsQuery,
    logsQuery,
    conversationContextQuery,
    workflowQuery,
    refreshAll,
    pauseMutation,
    resumeMutation,
    cancelMutation,
    approvalDecisionMutation,
    nativeApprovalDecisionMutation,
    resolveWaitMutation,
  };
}
