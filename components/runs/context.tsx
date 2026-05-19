'use client';

import { createContext, useContext } from 'react';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { agentsApi, conversationsApi, executionActionsAdapter, logsApi, runSessionsApi, runsApi, runtimeAdaptersApi, runtimeMetricsApi, workflowsApi } from '@/components/runs/api';
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
