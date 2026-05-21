import type { MemoryScope } from '@/types/memory';

export type DocumentMemoryScope = Exclude<MemoryScope, 'global'>;

export interface DocumentIngestionResult {
  document_id: string;
  filename: string;
  content_type?: string | null;
  storage_uri?: string | null;
  text_characters: number;
  chunks_created: number;
  memory_ids: string[];
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
}
