'use client';

import React, { createContext, useContext } from 'react';
import { agentsApi } from '@/lib/api/backend/agents';
import { conversationsApi } from '@/lib/api/backend/conversations';
import { executionActionsAdapter } from '@/lib/api/backend/executionActionsAdapter';
import { logsApi } from '@/lib/api/backend/logs';
import { runSessionsApi } from '@/lib/api/backend/runSessions';
import { runsApi } from '@/lib/api/backend/runs';
import { runtimeAdaptersApi } from '@/lib/api/backend/runtimeAdapters';
import { runtimeMetricsApi } from '@/lib/api/backend/runtimeMetrics';
import { workflowsApi } from '@/lib/api/backend/workflows';
import { queryKeys } from '@/lib/react-query/queryKeys';
import type { RunsModuleApi, RunsModuleQueryKeys } from '@/components/runs/contracts';

const defaultApi: RunsModuleApi = {
  runSessions: runSessionsApi,
  logs: logsApi,
  conversations: conversationsApi,
  runs: runsApi,
  runtimeAdapters: runtimeAdaptersApi,
  runtimeMetrics: runtimeMetricsApi,
  agents: agentsApi,
  workflows: workflowsApi,
  executionActions: executionActionsAdapter,
};

const defaultQueryKeys: RunsModuleQueryKeys = {
  activeRunSessions: () => queryKeys.backendActiveRunSessions(),
  runSession: (runId) => queryKeys.backendRunSession(runId),
  runTimeline: (runId) => queryKeys.backendRunTimeline(runId),
  runEvents: (runId) => queryKeys.backendRunEvents(runId),
  runGovernanceEvents: (runId) => queryKeys.backendRunGovernanceEvents(runId),
  runApprovals: (runId) => queryKeys.backendRunApprovals(runId),
  runUsage: (runId) => queryKeys.backendRunUsage(runId),
  runContextUsage: (runId) => queryKeys.backendRunContextUsage(runId),
  runArtifacts: (runId) => ['backendRunArtifacts', runId] as const,
  runLogs: (runId) => queryKeys.backendRunLogs(runId),
  runConversation: (runId) => queryKeys.backendRunConversation(runId),
  mainAgent: () => ['runsMainAgent'] as const,
  agentCatalog: () => ['runsAgentCatalog'] as const,
  runtimeMetrics: () => ['runsRuntimeMetrics'] as const,
  workflow: (workflowId) => queryKeys.backendWorkflow(workflowId),
  agentRuns: () => queryKeys.backendAgentRuns(),
  workflowRuns: (workflowId) => queryKeys.backendWorkflowRuns(workflowId),
};

type RunsModuleContextValue = {
  api: RunsModuleApi;
  queryKeys: RunsModuleQueryKeys;
};

const RunsModuleContext = createContext<RunsModuleContextValue>({
  api: defaultApi,
  queryKeys: defaultQueryKeys,
});

export function RunsModuleProvider({
  children,
  api,
  queryKeys: customQueryKeys,
}: {
  children: React.ReactNode;
  api?: Partial<RunsModuleApi>;
  queryKeys?: Partial<RunsModuleQueryKeys>;
}) {
  const value: RunsModuleContextValue = {
    api: {
      ...defaultApi,
      ...api,
    },
    queryKeys: {
      ...defaultQueryKeys,
      ...customQueryKeys,
    },
  };

  return <RunsModuleContext.Provider value={value}>{children}</RunsModuleContext.Provider>;
}

export function useRunsModule() {
  return useContext(RunsModuleContext);
}
