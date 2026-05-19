import type {
  Agent,
  ApprovalRequest,
  Conversation,
  ConversationMessage,
  CrudListResponse,
  ExecutionArtifact,
  ExecutionEventRecord,
  ExecutionTimelineResponse,
  RuntimeAdapterDefinition,
  RunLogEntry,
  RunSessionDetail,
  RunSessionSummary,
  WorkflowDefinition,
  MainAgent,
} from '@/lib/api/backend/types';
import type { ExecutionHost } from '@/types/workflows';

export interface RunsModuleApi {
  runSessions: {
    listRunSessions(): Promise<RunSessionSummary[]>;
    getRunSession(runId: string): Promise<RunSessionDetail>;
    listRunArtifacts(runId: string): Promise<CrudListResponse<ExecutionArtifact>>;
    getRunLogs(runId: string, tailLines?: number): Promise<RunLogEntry>;
  };
  logs: {
    getRunTimeline(runId: string): Promise<ExecutionTimelineResponse>;
    listRunEvents(runId: string, afterSequence?: number): Promise<CrudListResponse<ExecutionEventRecord>>;
  };
  conversations: {
    getMainAgent(): Promise<MainAgent>;
    findExecutionContext(executionId: string): Promise<{
      conversation: Conversation | null;
      messages: ConversationMessage[];
      approvals: ApprovalRequest[];
    }>;
    approveApprovalRequest(approvalRequestId: string, payload: { user_id: string; reason?: string | null }): Promise<unknown>;
    rejectApprovalRequest(approvalRequestId: string, payload: { user_id: string; reason?: string | null }): Promise<unknown>;
  };
  runs: {
    executeWorkflow(
      workflowId: string,
      runtimeAdapterId?: string | null,
      executionHost?: ExecutionHost | null
    ): Promise<RunSessionSummary>;
    pauseRun(runId: string): Promise<unknown>;
    resumeRun(runId: string): Promise<unknown>;
    cancelRun(runId: string): Promise<unknown>;
  };
  runtimeAdapters: {
    listRuntimeAdapters(): Promise<{ items: RuntimeAdapterDefinition[] }>;
  };
  runtimeMetrics: {
    getRuntimeMetrics(): Promise<Record<string, unknown>>;
  };
  agents: {
    listAgentCatalog(): Promise<Agent[]>;
  };
  workflows: {
    getWorkflow(workflowId: string): Promise<WorkflowDefinition>;
  };
  executionActions: {
    downloadResult(runId: string): Promise<unknown>;
    rateResult(runId: string, rating: 'positive' | 'negative'): Promise<unknown>;
  };
}

export interface RunsModuleQueryKeys {
  activeRunSessions(): readonly unknown[];
  runSession(runId: string): readonly unknown[];
  runTimeline(runId: string): readonly unknown[];
  runEvents(runId: string): readonly unknown[];
  runArtifacts(runId: string): readonly unknown[];
  runLogs(runId: string): readonly unknown[];
  runConversation(runId: string): readonly unknown[];
  mainAgent(): readonly unknown[];
  agentCatalog(): readonly unknown[];
  runtimeMetrics(): readonly unknown[];
  workflow(workflowId: string): readonly unknown[];
  agentRuns(): readonly unknown[];
  workflowRuns(workflowId: string): readonly unknown[];
}
