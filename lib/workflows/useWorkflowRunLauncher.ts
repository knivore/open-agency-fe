'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { runsApi, runtimeAdaptersApi, workflowsApi } from '@/lib/api/backend';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { resolveWorkflowExecutionHost } from '@/lib/workflows/executionPayload';
import { preferredRunRuntimeAdapterId, resolveRunnableAdapters } from '@/lib/workflows/runtimeAdapterSelection';
import type { CrudListResponse } from '@/types/api';
import type { RuntimeAdapterDefinition } from '@/types/runtime';
import type { ExecutionHost, WorkflowDefinition } from '@/types/workflows';

type WorkflowRunRecord = {
  id: string;
};

interface UseWorkflowRunLauncherOptions<TRun extends WorkflowRunRecord = WorkflowRunRecord> {
  workflowId: string;
  workflow?: WorkflowDefinition;
  runtimeAdapters?: RuntimeAdapterDefinition[];
  getWorkflow?: (workflowId: string) => Promise<WorkflowDefinition>;
  listRuntimeAdapters?: () => Promise<CrudListResponse<RuntimeAdapterDefinition>>;
  executeWorkflow?: (workflowId: string, runtimeAdapterId?: string | null, executionHost?: ExecutionHost | null) => Promise<TRun>;
  redirectTo?: (runId: string) => string;
  additionalInvalidationKeys?: (run: TRun) => readonly (readonly unknown[])[];
}

export function useWorkflowRunLauncher<TRun extends WorkflowRunRecord = WorkflowRunRecord>({
  workflowId,
  workflow,
  runtimeAdapters,
  getWorkflow = workflowsApi.getWorkflow,
  listRuntimeAdapters = runtimeAdaptersApi.listRuntimeAdapters,
  executeWorkflow = runsApi.executeWorkflow as unknown as (
    workflowId: string,
    runtimeAdapterId?: string | null,
    executionHost?: ExecutionHost | null
  ) => Promise<TRun>,
  redirectTo,
  additionalInvalidationKeys,
}: UseWorkflowRunLauncherOptions<TRun>) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const workflowQuery = useQuery({
    queryKey: queryKeys.backendWorkflow(workflowId),
    queryFn: () => getWorkflow(workflowId),
    enabled: Boolean(workflowId) && !workflow,
  });
  const runtimeAdaptersQuery = useQuery({
    queryKey: queryKeys.backendRuntimeAdapters(),
    queryFn: () => listRuntimeAdapters(),
    enabled: Boolean(workflowId) && !runtimeAdapters,
  });

  const resolvedWorkflow = workflow ?? workflowQuery.data;
  const resolvedRuntimeAdapters = runtimeAdapters ?? runtimeAdaptersQuery.data?.items ?? [];
  const runnableRuntimeAdapters = resolveRunnableAdapters(
    resolvedRuntimeAdapters,
    resolvedWorkflow?.allowed_runtime_adapter_ids,
    resolvedWorkflow?.default_runtime_adapter_id,
  );
  const preferredRuntimeAdapterId = preferredRunRuntimeAdapterId(
    runnableRuntimeAdapters,
    resolvedWorkflow?.default_runtime_adapter_id,
  );

  const launchMutation = useMutation({
    mutationFn: async (
      options?: string | null | { runtimeAdapterId?: string | null; executionHost?: ExecutionHost | null }
    ) => {
      if (!workflowId) {
        throw new Error('Workflow id is required to start a run.');
      }

      const nextWorkflow = resolvedWorkflow ?? await getWorkflow(workflowId);
      const nextRuntimeAdapters = resolvedRuntimeAdapters.length > 0
        ? resolvedRuntimeAdapters
        : (await listRuntimeAdapters()).items ?? [];
      const nextRunnableAdapters = resolveRunnableAdapters(
        nextRuntimeAdapters,
        nextWorkflow.allowed_runtime_adapter_ids,
        nextWorkflow.default_runtime_adapter_id,
      );
      const requestedRuntimeAdapterId = options && typeof options === 'object' ? options.runtimeAdapterId : options;
      const requestedExecutionHost = options && typeof options === 'object' ? options.executionHost : null;
      const nextRuntimeAdapterId = requestedRuntimeAdapterId
        || preferredRunRuntimeAdapterId(nextRunnableAdapters, nextWorkflow.default_runtime_adapter_id)
        || null;
      const nextExecutionHost = requestedExecutionHost ?? resolveWorkflowExecutionHost(nextWorkflow);

      const run = await executeWorkflow(workflowId, nextRuntimeAdapterId, nextExecutionHost);
      const invalidationKeys: Array<readonly unknown[]> = [
        queryKeys.backendAgentRuns(),
        queryKeys.backendWorkflowRuns(workflowId),
        queryKeys.backendRun(run.id),
      ];

      if (additionalInvalidationKeys) {
        invalidationKeys.push(...additionalInvalidationKeys(run));
      }

      await Promise.all(invalidationKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));

      if (redirectTo) {
        router.push(redirectTo(run.id));
      }

      return run;
    },
  });

  return {
    workflowQuery,
    runtimeAdaptersQuery,
    runnableRuntimeAdapters,
    preferredRuntimeAdapterId,
    launchMutation,
    launchWorkflow: launchMutation.mutateAsync,
  };
}
