import type { GraphReadDtoDocument } from '@/modules/sigma-graph/adapters/graphReadDto';

export type AgencyGraphDocumentResponse = GraphReadDtoDocument;

export type AgencyGraphExpansionPreset =
  | 'workflow'
  | 'workflow_run'
  | 'agent'
  | 'tool'
  | 'memory'
  | 'entity'
  | 'task';

export interface AgencyGraphNeighborhoodParams {
  labels?: string;
  relationshipTypes?: string;
  depth?: number;
  limit?: number;
  includeDeleted?: boolean;
  includeOperationalCoverage?: boolean;
  incidentLimit?: number;
  recentRunLimit?: number;
  workflowRunLimit?: number;
}

export interface AgencyGraphExpansionParams extends AgencyGraphNeighborhoodParams {
  preset?: AgencyGraphExpansionPreset;
}
