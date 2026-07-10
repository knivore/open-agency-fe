import { agencyApiClient } from '@/lib/api/clientInstances';
import { backendRoutes } from '@/lib/api/backend/routes';
import type { CrudListResponse, DeleteResponse } from '@/types/api';
import type {
  PersonaApproveResult,
  PersonaBulkReviewResult,
  PersonaDefinition,
  PersonaDistillationItem,
  PersonaDistillPayload,
  PersonaDistillResult,
  PersonaGraphContextResult,
  PersonaGraphContextPreset,
  PersonaGovernanceCatalog,
  PersonaItemCatalog,
  PersonaNormalizeResult,
  PersonaPackage,
  PersonaPublishResult,
  PersonaRunDetail,
  PersonaRunBulkReviewResult,
  PersonaRunSourceClassificationResult,
  PersonaRunSourceDetail,
  PersonaRunSourceMap,
  PersonaRunSourceRedistillResult,
  PersonaSource,
  PersonaSourceClassificationPatch,
  PersonaVersion,
  PersonaWorkflowUsagesResponse,
} from '@/types/personas';

export const personasApi = {
  listPersonas(query: { includeArchived?: boolean } = {}) {
    return agencyApiClient.get<CrudListResponse<PersonaDefinition>>(backendRoutes.personas.list(), {
      query: { include_archived: query.includeArchived ?? undefined },
    });
  },
  createPersona(payload: {
    name: string;
    slug?: string | null;
    description?: string | null;
    workspace_id?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    return agencyApiClient.post<PersonaDefinition>(backendRoutes.personas.create(), payload);
  },
  updatePersona(personaId: string, patch: Record<string, unknown>) {
    return agencyApiClient.patch<PersonaDefinition>(backendRoutes.personas.byId(personaId), {
      patch,
    });
  },
  archivePersona(personaId: string) {
    return agencyApiClient.delete<DeleteResponse>(backendRoutes.personas.byId(personaId));
  },
  listVersions(personaId: string) {
    return agencyApiClient.get<CrudListResponse<PersonaVersion>>(
      backendRoutes.personas.versions(personaId)
    );
  },
  listWorkflowUsages(personaId: string) {
    return agencyApiClient.get<PersonaWorkflowUsagesResponse>(
      backendRoutes.personas.workflowUsages(personaId)
    );
  },
  getGraphContext(
    personaId: string,
    query: { query?: string; preset?: PersonaGraphContextPreset; limit?: number } = {}
  ) {
    return agencyApiClient.get<PersonaGraphContextResult>(
      backendRoutes.personas.graphContext(personaId),
      { query }
    );
  },
  rollbackVersion(personaId: string, versionId: string) {
    return agencyApiClient.post<PersonaPublishResult>(
      backendRoutes.personas.rollbackVersion(personaId, versionId),
      {}
    );
  },
  listSources(personaId: string) {
    return agencyApiClient.get<CrudListResponse<PersonaSource>>(
      backendRoutes.personas.sources(personaId)
    );
  },
  getGovernanceLabels() {
    return agencyApiClient.get<PersonaGovernanceCatalog>(backendRoutes.personas.governanceLabels());
  },
  getItemTypes() {
    return agencyApiClient.get<PersonaItemCatalog>(backendRoutes.personas.itemTypes());
  },
  distill(payload: PersonaDistillPayload) {
    return agencyApiClient.post<PersonaDistillResult>(backendRoutes.personas.distill(), payload);
  },
  getRun(runId: string) {
    return agencyApiClient.get<PersonaRunDetail>(backendRoutes.personas.runById(runId));
  },
  listRuns(
    query: {
      persona_id?: string;
      status?: string;
      created_by_user_id?: string;
      workspace_id?: string;
    } = {}
  ) {
    return agencyApiClient.get<CrudListResponse<PersonaRunDetail['run']>>(
      backendRoutes.personas.runs(),
      { query }
    );
  },
  listRunItems(
    runId: string,
    query: {
      source_key?: string;
      item_type?: string;
      memory_layer?: string;
      review_status?: string;
      needs_review?: boolean;
      min_confidence?: number;
      max_confidence?: number;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    return agencyApiClient.get<CrudListResponse<PersonaDistillationItem>>(
      backendRoutes.personas.runItems(runId),
      { query }
    );
  },
  getRunSourceMap(runId: string) {
    return agencyApiClient.get<PersonaRunSourceMap>(backendRoutes.personas.runSourceMap(runId));
  },
  getRunSource(
    runId: string,
    sourceKey: string,
    query: {
      item_type?: string;
      memory_layer?: string;
      review_status?: string;
      needs_review?: boolean;
      min_confidence?: number;
      max_confidence?: number;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    return agencyApiClient.get<PersonaRunSourceDetail>(
      backendRoutes.personas.runSource(runId, sourceKey),
      { query }
    );
  },
  updateRunSourceClassification(
    runId: string,
    sourceKey: string,
    payload: PersonaSourceClassificationPatch
  ) {
    return agencyApiClient.patch<PersonaRunSourceClassificationResult>(
      backendRoutes.personas.runSourceClassification(runId, sourceKey),
      payload
    );
  },
  redistillRunSource(runId: string, sourceKey: string, payload: { limit?: number } = {}) {
    return agencyApiClient.post<PersonaRunSourceRedistillResult>(
      backendRoutes.personas.redistillRunSource(runId, sourceKey),
      payload
    );
  },
  updateItem(itemId: string, patch: Partial<PersonaDistillationItem>) {
    return agencyApiClient.patch<PersonaDistillationItem>(backendRoutes.personas.item(itemId), {
      patch,
    });
  },
  approveItem(itemId: string) {
    return agencyApiClient.post<PersonaDistillationItem>(
      backendRoutes.personas.approveItem(itemId),
      {}
    );
  },
  rejectItem(itemId: string, reason?: string | null) {
    return agencyApiClient.post<PersonaDistillationItem>(
      backendRoutes.personas.rejectItem(itemId),
      { reason: reason ?? null }
    );
  },
  bulkReviewItems(payload: {
    item_ids: string[];
    action: 'approve' | 'reject';
    reason?: string | null;
  }) {
    return agencyApiClient.post<PersonaBulkReviewResult>(
      backendRoutes.personas.bulkReviewItems(),
      payload
    );
  },
  bulkReviewRunItems(
    runId: string,
    payload: {
      action: 'approve' | 'reject';
      reason?: string | null;
      filters?: {
        source_key?: string;
        item_type?: string;
        memory_layer?: string;
        review_status?: string;
        needs_review?: boolean;
        min_confidence?: number;
        max_confidence?: number;
      };
      limit?: number;
    }
  ) {
    return agencyApiClient.post<PersonaRunBulkReviewResult>(
      backendRoutes.personas.bulkReviewRunItems(runId),
      payload
    );
  },
  previewBulkReviewRunItems(
    runId: string,
    payload: {
      action: 'approve' | 'reject';
      filters?: {
        source_key?: string;
        item_type?: string;
        memory_layer?: string;
        review_status?: string;
        needs_review?: boolean;
        min_confidence?: number;
        max_confidence?: number;
      };
      limit?: number;
    }
  ) {
    return agencyApiClient.post<PersonaRunBulkReviewResult>(
      backendRoutes.personas.previewBulkReviewRunItems(runId),
      payload
    );
  },
  normalizeRun(runId: string) {
    return agencyApiClient.post<PersonaNormalizeResult>(
      backendRoutes.personas.normalizeRun(runId),
      {}
    );
  },
  synthesizeRun(runId: string) {
    return agencyApiClient.post<PersonaDistillResult>(
      backendRoutes.personas.synthesizeRun(runId),
      {}
    );
  },
  updateRunPackage(runId: string, personaPackage: PersonaPackage) {
    return agencyApiClient.patch<PersonaRunDetail['run']>(
      backendRoutes.personas.runPackage(runId),
      { package: personaPackage }
    );
  },
  approveRun(runId: string, payload: { version?: string | null } = {}) {
    return agencyApiClient.post<PersonaApproveResult>(
      backendRoutes.personas.approveRun(runId),
      payload
    );
  },
  publishRun(runId: string) {
    return agencyApiClient.post<PersonaPublishResult>(backendRoutes.personas.publishRun(runId), {});
  },
};
