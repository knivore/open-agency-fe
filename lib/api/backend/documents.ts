import { agencyApiClient } from '@/lib/api/clientInstances';
import { backendRoutes } from '@/lib/api/backend/routes';
import type {
  DocumentIngestionInput,
  DocumentIngestionResult,
  DocumentUploadIntelligenceResult,
  UploadedDocumentDeleteResponse,
  UploadedDocumentListInput,
  UploadedDocumentListResponse,
  UploadedDocumentRecord,
} from '@/types/documents';

const DOCUMENT_UPLOAD_TIMEOUT_MS = 180_000;

function appendIfPresent(formData: FormData, key: string, value?: string | number | null) {
  if (value !== undefined && value !== null && String(value).trim().length > 0) {
    formData.set(key, String(value));
  }
}

export const documentsApi = {
  listDocuments(input: UploadedDocumentListInput = {}) {
    return agencyApiClient.get<UploadedDocumentListResponse>(backendRoutes.documents.list(), {
      query: {
        scope: input.scope || undefined,
        workspace_id: input.workspaceId || undefined,
        conversation_id: input.conversationId || undefined,
        workflow_id: input.workflowId || undefined,
        agent_id: input.agentId || undefined,
        upload_mode: input.uploadMode || undefined,
        limit: input.limit ?? 50,
      },
    });
  },
  getDocument(documentId: string) {
    return agencyApiClient.get<UploadedDocumentRecord>(backendRoutes.documents.byId(documentId));
  },
  deleteDocument(documentId: string) {
    return agencyApiClient.delete<UploadedDocumentDeleteResponse>(
      backendRoutes.documents.byId(documentId)
    );
  },
  ingestDocument(input: DocumentIngestionInput) {
    const formData = new FormData();
    formData.set('file', input.file);
    appendIfPresent(formData, 'scope', input.scope ?? 'user');
    appendIfPresent(formData, 'workspace_id', input.workspaceId);
    appendIfPresent(formData, 'conversation_id', input.conversationId);
    appendIfPresent(formData, 'workflow_id', input.workflowId);
    appendIfPresent(formData, 'agent_id', input.agentId);
    appendIfPresent(formData, 'tags', input.tags?.join(','));
    appendIfPresent(formData, 'chunk_size', input.chunkSize);
    appendIfPresent(formData, 'chunk_overlap', input.chunkOverlap);
    appendIfPresent(formData, 'auto_intelligence', input.autoIntelligence ? 'true' : undefined);
    appendIfPresent(
      formData,
      'allow_scope_suggestion',
      input.allowScopeSuggestion ? 'true' : undefined
    );
    appendIfPresent(
      formData,
      'allow_agent_suggestion',
      input.allowAgentSuggestion ? 'true' : undefined
    );
    appendIfPresent(formData, 'purpose', input.purpose);
    appendIfPresent(formData, 'upload_mode', input.uploadMode);

    return agencyApiClient.post<DocumentIngestionResult>(
      backendRoutes.documents.ingest(),
      formData,
      { timeoutMs: DOCUMENT_UPLOAD_TIMEOUT_MS }
    );
  },
  analyzeUpload(input: DocumentIngestionInput) {
    const formData = new FormData();
    formData.set('file', input.file);
    appendIfPresent(formData, 'scope', input.scope ?? 'user');
    appendIfPresent(formData, 'workspace_id', input.workspaceId);
    appendIfPresent(formData, 'conversation_id', input.conversationId);
    appendIfPresent(formData, 'workflow_id', input.workflowId);
    appendIfPresent(formData, 'agent_id', input.agentId);
    appendIfPresent(formData, 'tags', input.tags?.join(','));
    appendIfPresent(formData, 'chunk_size', input.chunkSize);
    appendIfPresent(formData, 'chunk_overlap', input.chunkOverlap);
    appendIfPresent(formData, 'purpose', input.purpose);

    return agencyApiClient.post<DocumentUploadIntelligenceResult>(
      backendRoutes.documents.intelligence(),
      formData,
      { timeoutMs: DOCUMENT_UPLOAD_TIMEOUT_MS }
    );
  },
};
