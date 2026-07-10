import { agencyApiClient } from '@/lib/api/clientInstances';
import { currentUserHeaders } from '@/lib/api/backend/identity';
import { backendRoutes } from '@/lib/api/backend/routes';
import type {
  AgencyGraphDocumentResponse,
  AgencyGraphExpansionParams,
  AgencyGraphNeighborhoodParams,
} from '@/lib/agency-graph/types';
import type { AuthUser } from '@/types/auth';

function neighborhoodQuery(params: AgencyGraphNeighborhoodParams = {}) {
  return {
    labels: params.labels,
    relationship_types: params.relationshipTypes,
    depth: params.depth,
    limit: params.limit,
    include_deleted: params.includeDeleted,
    include_operational_coverage: params.includeOperationalCoverage,
    recent_run_limit: params.recentRunLimit,
    workflow_run_limit: params.workflowRunLimit,
    incident_limit: params.incidentLimit,
  };
}

function expansionQuery(params: AgencyGraphExpansionParams = {}) {
  return {
    ...neighborhoodQuery(params),
    preset: params.preset,
  };
}

function boundedNeighborhoodQuery(params: AgencyGraphNeighborhoodParams = {}) {
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

export const graphReadApi = {
  getStatus(user?: AuthUser) {
    return agencyApiClient.get<Record<string, unknown>>(backendRoutes.graphRead.status(), {
      headers: user ? currentUserHeaders(user) : undefined,
    });
  },
  getNodeNeighborhood(nodeId: string, params: AgencyGraphNeighborhoodParams = {}, user?: AuthUser) {
    return agencyApiClient.get<AgencyGraphDocumentResponse>(
      backendRoutes.graphRead.neighborhood(nodeId),
      {
        query: neighborhoodQuery(params),
        headers: user ? currentUserHeaders(user) : undefined,
      }
    );
  },
  expandNode(nodeId: string, params: AgencyGraphExpansionParams = {}, user?: AuthUser) {
    return agencyApiClient.get<AgencyGraphDocumentResponse>(
      backendRoutes.graphRead.expand(nodeId),
      {
        query: expansionQuery(params),
        headers: user ? currentUserHeaders(user) : undefined,
      }
    );
  },
  getWorkflowNeighborhood(
    workflowId: string,
    params: AgencyGraphNeighborhoodParams = {},
    user?: AuthUser
  ) {
    return agencyApiClient.get<AgencyGraphDocumentResponse>(
      backendRoutes.graphRead.workflowNeighborhood(workflowId),
      {
        query: boundedNeighborhoodQuery(params),
        headers: user ? currentUserHeaders(user) : undefined,
      }
    );
  },
  getRunNeighborhood(runId: string, params: AgencyGraphNeighborhoodParams = {}, user?: AuthUser) {
    return agencyApiClient.get<AgencyGraphDocumentResponse>(
      backendRoutes.graphRead.runNeighborhood(runId),
      {
        query: boundedNeighborhoodQuery(params),
        headers: user ? currentUserHeaders(user) : undefined,
      }
    );
  },
  getAgentNeighborhood(
    agentId: string,
    params: AgencyGraphNeighborhoodParams = {},
    user?: AuthUser
  ) {
    return agencyApiClient.get<AgencyGraphDocumentResponse>(
      backendRoutes.graphRead.agentNeighborhood(agentId),
      {
        query: boundedNeighborhoodQuery(params),
        headers: user ? currentUserHeaders(user) : undefined,
      }
    );
  },
  getMemoryNeighborhood(
    memoryId: string,
    params: AgencyGraphNeighborhoodParams = {},
    user?: AuthUser
  ) {
    return agencyApiClient.get<AgencyGraphDocumentResponse>(
      backendRoutes.graphRead.memoryNeighborhood(memoryId),
      {
        query: boundedNeighborhoodQuery(params),
        headers: user ? currentUserHeaders(user) : undefined,
      }
    );
  },
  getEntityNeighborhood(
    entityId: string,
    params: AgencyGraphNeighborhoodParams = {},
    user?: AuthUser
  ) {
    return agencyApiClient.get<AgencyGraphDocumentResponse>(
      backendRoutes.graphRead.entityNeighborhood(entityId),
      {
        query: boundedNeighborhoodQuery(params),
        headers: user ? currentUserHeaders(user) : undefined,
      }
    );
  },
};
