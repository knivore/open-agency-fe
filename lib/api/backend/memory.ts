import { agencyApiClient } from '@/lib/api/clientInstances';
import { backendRoutes } from '@/lib/api/backend/routes';
import type { CrudListResponse, DeleteResponse } from '@/types/api';
import type {
  CompactBackfillPayload,
  CompactBackfillResult,
  DailySummaryBackfillPayload,
  DailySummaryBackfillResult,
  DailySummaryRunPayload,
  DailySummaryRunResult,
  MemoryEmbeddingBackfillPayload,
  MemoryEmbeddingBackfillResult,
  MemoryCatalogQuery,
  MemoryCatalogResponse,
  MemoryExclusion,
  MemoryExclusionDeleteResponse,
  MemoryExclusionListQuery,
  MemoryExclusionListResponse,
  MemoryExclusionPayload,
  MemoryDocumentDeleteResponse,
  MemoryListQuery,
  MemoryRecord,
  MemoryUpdatePayload,
  MemoryWritePayload,
} from '@/types/memory';

export const memoriesApi = {
  listMemories(query: MemoryListQuery = {}) {
    return agencyApiClient.get<CrudListResponse<MemoryRecord>>(backendRoutes.memories.list(), {
      query: {
        scope: query.scope || undefined,
        user_id: query.user_id || undefined,
        workspace_id: query.workspace_id || undefined,
        conversation_id: query.conversation_id || undefined,
        workflow_id: query.workflow_id || undefined,
        agent_id: query.agent_id || undefined,
        source: query.source || undefined,
        memory_type: query.memory_type?.length ? query.memory_type : undefined,
        tags: query.tags?.length ? query.tags : undefined,
        status: query.status?.length ? query.status : undefined,
        source_conversation_id: query.source_conversation_id || undefined,
        source_execution_id: query.source_execution_id || undefined,
        summary_date_from: query.summary_date_from || undefined,
        summary_date_to: query.summary_date_to || undefined,
        q: query.q || undefined,
        limit: query.limit ?? 50,
      },
    });
  },
  listMemoryCatalog(query: MemoryCatalogQuery = {}) {
    return agencyApiClient.get<MemoryCatalogResponse>(backendRoutes.memories.catalog(), {
      query: {
        scope: query.scope || undefined,
        workflow_id: query.workflow_id || undefined,
        agent_id: query.agent_id || undefined,
        conversation_id: query.conversation_id || undefined,
        target_type: query.target_type || undefined,
        target_id: query.target_id || undefined,
        q: query.q || undefined,
        include_sensitive: query.include_sensitive ?? undefined,
        status: query.status?.length ? query.status : undefined,
        limit_per_group: query.limit_per_group ?? 20,
      },
    });
  },
  listMemoryExclusions(query: MemoryExclusionListQuery = {}) {
    return agencyApiClient.get<MemoryExclusionListResponse>(backendRoutes.memories.exclusions(), {
      query: {
        memory_id: query.memory_id || undefined,
        target_type: query.target_type || undefined,
        target_id: query.target_id || undefined,
      },
    });
  },
  addMemoryExclusion(memoryId: string, payload: MemoryExclusionPayload) {
    return agencyApiClient.post<MemoryExclusion>(
      backendRoutes.memories.exclusionsByMemoryId(memoryId),
      payload
    );
  },
  deleteMemoryExclusion(memoryId: string, exclusionId: string) {
    return agencyApiClient.delete<MemoryExclusionDeleteResponse>(
      backendRoutes.memories.exclusionById(memoryId, exclusionId)
    );
  },
  createMemory(payload: MemoryWritePayload) {
    return agencyApiClient.post<MemoryRecord>(backendRoutes.memories.create(), payload);
  },
  backfillEmbeddings(payload: MemoryEmbeddingBackfillPayload = {}) {
    return agencyApiClient.post<MemoryEmbeddingBackfillResult>(
      backendRoutes.memories.backfillEmbeddings(),
      payload
    );
  },
  runDailySummaries(payload: DailySummaryRunPayload) {
    return agencyApiClient.post<DailySummaryRunResult>(
      backendRoutes.memories.runDailySummaries(),
      payload
    );
  },
  backfillDailySummaries(payload: DailySummaryBackfillPayload) {
    return agencyApiClient.post<DailySummaryBackfillResult>(
      backendRoutes.memories.backfillDailySummaries(),
      payload
    );
  },
  backfillCompactPacks(payload: CompactBackfillPayload) {
    return agencyApiClient.post<CompactBackfillResult>(
      backendRoutes.memories.backfillCompactPacks(),
      payload
    );
  },
  updateMemory(memoryId: string, payload: MemoryUpdatePayload) {
    return agencyApiClient.patch<MemoryRecord>(backendRoutes.memories.byId(memoryId), payload);
  },
  deleteMemory(memoryId: string) {
    return agencyApiClient.delete<DeleteResponse>(backendRoutes.memories.byId(memoryId));
  },
  deleteDocumentMemories(documentId: string, query: MemoryListQuery = {}) {
    return agencyApiClient.delete<MemoryDocumentDeleteResponse>(
      backendRoutes.memories.documentById(documentId),
      {
        query: {
          scope: query.scope || undefined,
          user_id: query.user_id || undefined,
          workspace_id: query.workspace_id || undefined,
          conversation_id: query.conversation_id || undefined,
          workflow_id: query.workflow_id || undefined,
          agent_id: query.agent_id || undefined,
          tags: query.tags?.length ? query.tags : undefined,
        },
      }
    );
  },
};
