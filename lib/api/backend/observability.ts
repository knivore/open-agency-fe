import { agencyApiClient } from '@/lib/api/clientInstances';
import { backendRoutes } from '@/lib/api/backend/routes';
import type { ExecutionTimelineResponse } from '@/types/runtime';
import type {
  AgencyGraphDocumentResponse,
  AgencyGraphNeighborhoodParams,
} from '@/lib/agency-graph/types';

export interface ObservabilityProjectionGraphResponse {
  available: boolean;
  reason: string | null;
  graph: AgencyGraphDocumentResponse;
}

export interface ObservabilityModelUsageFilters {
  workflowId?: string;
  agentId?: string;
  executionId?: string;
  provider?: string;
  model?: string;
}

export interface ObservabilityContextHealthSummary {
  event_count?: number;
  status_counts?: Record<string, number>;
  critical_count?: number;
  latest?: Record<string, unknown> | null;
}

export interface ObservabilityBudgetSummary {
  event_count?: number;
  warning_count?: number;
  exceeded_count?: number;
  latest?: Record<string, unknown> | null;
}

export interface ObservabilityCompactionSummary {
  event_count?: number;
  status_counts?: Record<string, number>;
  latest?: Record<string, unknown> | null;
}

export interface ObservabilityAgentMetrics {
  agent_id: string;
  execution_count?: number;
  llm_request_count?: number;
  tool_success_count?: number;
  tool_failure_count?: number;
  total_tokens?: number;
  estimated_cost?: number;
  context_health?: ObservabilityContextHealthSummary;
  budget?: ObservabilityBudgetSummary;
  compaction?: ObservabilityCompactionSummary;
}

export interface ObservabilityWorkflowMetrics {
  workflow_id: string;
  execution_count?: number;
  completed_count?: number;
  failed_count?: number;
  average_duration_ms?: number;
  event_count?: number;
  total_tokens?: number;
  estimated_cost?: number;
  context_health?: ObservabilityContextHealthSummary;
  budget?: ObservabilityBudgetSummary;
  compaction?: ObservabilityCompactionSummary;
}

export interface ObservabilityModelUsageItem {
  provider: string;
  model: string;
  request_count?: number;
  input_tokens?: number;
  output_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  estimated_cost?: number;
  estimated_token_count?: number;
  fallback_count?: number;
  fallback_rate?: number;
  fallback_primary_models?: Record<string, number>;
  currency?: string | null;
}

export interface ObservabilityModelFallbackFailure {
  event_id?: string;
  execution_id?: string;
  workflow_id?: string | null;
  agent_id?: string | null;
  task_id?: string | null;
  timestamp?: string;
  primary_provider?: string | null;
  primary_model?: string | null;
  attempts?: unknown[];
  error?: string | null;
}

export interface ObservabilityModelFallbackSummary {
  fallback_count?: number;
  fallback_failure_count?: number;
  fallback_rate?: number;
  fallback_primary_models?: Record<string, number>;
  recent_failures?: ObservabilityModelFallbackFailure[];
}

export interface ObservabilityModelUsageResponse {
  items: ObservabilityModelUsageItem[];
  fallback_summary?: ObservabilityModelFallbackSummary;
  filters?: Record<string, unknown>;
  system?: Record<string, unknown>;
}

function projectionGraphQuery(params: AgencyGraphNeighborhoodParams = {}) {
  return {
    depth: params.depth,
    limit: params.limit,
    include_deleted: params.includeDeleted,
    include_operational_coverage: params.includeOperationalCoverage,
    recent_run_limit: params.recentRunLimit,
    workflow_run_limit: params.workflowRunLimit,
    incident_limit: params.incidentLimit,
  };
}

function modelUsageQuery(filters: ObservabilityModelUsageFilters = {}) {
  return {
    workflow_id: filters.workflowId,
    agent_id: filters.agentId,
    execution_id: filters.executionId,
    provider: filters.provider,
    model: filters.model,
  };
}

export const observabilityApi = {
  getExecutionTimeline(executionId: string) {
    return agencyApiClient.get<ExecutionTimelineResponse>(
      backendRoutes.observability.executionTimeline(executionId)
    );
  },
  getExecutionProjectionGraph(executionId: string, params: AgencyGraphNeighborhoodParams = {}) {
    return agencyApiClient.get<ObservabilityProjectionGraphResponse>(
      backendRoutes.observability.executionGraph(executionId),
      { query: projectionGraphQuery(params) }
    );
  },
  getAgentMetrics(agentId: string) {
    return agencyApiClient.get<ObservabilityAgentMetrics>(
      backendRoutes.observability.agentMetrics(agentId)
    );
  },
  getWorkflowMetrics(workflowId: string) {
    return agencyApiClient.get<ObservabilityWorkflowMetrics>(
      backendRoutes.observability.workflowMetrics(workflowId)
    );
  },
  getWorkflowProjectionGraph(workflowId: string, params: AgencyGraphNeighborhoodParams = {}) {
    return agencyApiClient.get<ObservabilityProjectionGraphResponse>(
      backendRoutes.observability.workflowGraph(workflowId),
      { query: projectionGraphQuery(params) }
    );
  },
  getModelUsage(filters: ObservabilityModelUsageFilters = {}) {
    return agencyApiClient.get<ObservabilityModelUsageResponse>(
      backendRoutes.observability.modelUsage(),
      {
        query: modelUsageQuery(filters),
      }
    );
  },
};
