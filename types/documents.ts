import type { MemoryScope } from '@/types/memory';

export type DocumentMemoryScope = Exclude<MemoryScope, 'global'>;
export type DocumentUploadMode = 'vector' | 'context' | 'both';

export interface DocumentIngestionResult {
  document_id: string;
  filename: string;
  content_type?: string | null;
  storage_uri?: string | null;
  text_characters: number;
  estimated_tokens?: number;
  upload_mode?: DocumentUploadMode;
  context_attachment_id?: string | null;
  chunks_created: number;
  memory_ids: string[];
}

export interface DocumentUploadIntelligenceRecommendation {
  scope?: DocumentMemoryScope;
  workspace_id?: string | null;
  conversation_id?: string | null;
  workflow_id?: string | null;
  agent_id?: string | null;
  tags?: string[];
  chunk_size?: number;
  chunk_overlap?: number;
  governance_labels?: Record<string, string>;
}

export interface DocumentUploadIntelligenceResult {
  filename: string;
  content_type?: string | null;
  text_characters: number;
  source: 'main_agent_llm' | 'deterministic_fallback' | string;
  model_profile_id?: string | null;
  document_kind: string;
  summary: string;
  confidence: number;
  rationale?: string | null;
  recommended: DocumentUploadIntelligenceRecommendation;
  applied?: Record<string, unknown>;
}

export interface DocumentIngestionInput {
  file: File;
  scope?: DocumentMemoryScope;
  workspaceId?: string;
  conversationId?: string;
  workflowId?: string;
  agentId?: string;
  tags?: string[];
  chunkSize?: number;
  chunkOverlap?: number;
  autoIntelligence?: boolean;
  allowScopeSuggestion?: boolean;
  allowAgentSuggestion?: boolean;
  purpose?: string;
  uploadMode?: DocumentUploadMode;
}

export interface UploadedDocumentRecord {
  id: string;
  filename: string;
  content_type?: string | null;
  storage_uri?: string | null;
  text_characters: number;
  estimated_tokens: number;
  upload_mode: DocumentUploadMode;
  scope: DocumentMemoryScope;
  created_by_user_id?: string | null;
  workspace_id?: string | null;
  conversation_id?: string | null;
  workflow_id?: string | null;
  agent_id?: string | null;
  status: 'active' | 'deleted' | string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface UploadedDocumentDeleteResponse {
  deleted: boolean;
  document_id: string;
  upload_mode: DocumentUploadMode;
  document_status: 'deleted' | string;
  memory_ids: string[];
  deleted_memory_count: number;
}

export interface UploadedDocumentListInput {
  scope?: DocumentMemoryScope;
  workspaceId?: string;
  conversationId?: string;
  workflowId?: string;
  agentId?: string;
  uploadMode?: DocumentUploadMode;
  limit?: number;
}

export interface UploadedDocumentListResponse {
  items: UploadedDocumentRecord[];
}
