import { agencyApiClient } from '@/lib/api';
import { backendRoutes } from '@/lib/api/backend/routes';
import type { DocumentIngestionInput, DocumentIngestionResult } from '@/types/documents';

const DOCUMENT_UPLOAD_TIMEOUT_MS = 180_000;

function appendIfPresent(formData: FormData, key: string, value?: string | number | null) {
  if (value !== undefined && value !== null && String(value).trim().length > 0) {
    formData.set(key, String(value));
  }
}

export const documentsApi = {
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

    return agencyApiClient.post<DocumentIngestionResult>(
      backendRoutes.documents.ingest(),
      formData,
      { timeoutMs: DOCUMENT_UPLOAD_TIMEOUT_MS }
    );
  },
};
