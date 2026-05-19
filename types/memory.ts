import type { JsonObject } from '@/types/api';

export type MemoryScope = 'user' | 'workspace' | 'conversation' | 'workflow' | 'global';
export type MemoryKind =
  | 'fact'
  | 'preference'
  | 'decision'
  | 'task_commitment'
  | 'daily_summary'
  | 'run_summary'
  | 'archive';
export type MemoryStatus = 'active' | 'archived' | 'superseded';

export interface MemoryRecord extends JsonObject {
  id: string;
  scope: MemoryScope;
  content: string;
  summary?: string | null;
  tags: string[];
  sensitive: boolean;
  created_by_user_id?: string | null;
  workspace_id?: string | null;
  conversation_id?: string | null;
  workflow_id?: string | null;
  agent_id?: string | null;
  source?: string | null;
  memory_kind?: MemoryKind | null;
  status?: MemoryStatus | null;
  importance?: number | null;
  summary_date?: string | null;
  archived_window_start?: string | null;
  archived_window_end?: string | null;
  source_conversation_id?: string | null;
  source_execution_id?: string | null;
  supersedes_memory_id?: string | null;
  metadata?: JsonObject;
  embedding?: number[] | null;
  embedding_model_profile_id?: string | null;
  embedding_model?: string | null;
  embedding_dimensions?: number | null;
  embedded_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MemoryListQuery {
  scope?: MemoryScope | '';
  user_id?: string;
  workspace_id?: string;
  conversation_id?: string;
  workflow_id?: string;
  agent_id?: string;
  source?: string;
  memory_kind?: MemoryKind[];
  status?: MemoryStatus[];
  source_conversation_id?: string;
  source_execution_id?: string;
  summary_date_from?: string;
  summary_date_to?: string;
  q?: string;
  limit?: number;
}

export interface MemoryWritePayload {
  memory: Partial<MemoryRecord> & Pick<MemoryRecord, 'scope' | 'content'>;
  confirmed?: boolean;
}

export interface MemoryUpdatePayload {
  patch: Partial<MemoryRecord>;
  confirmed?: boolean;
}

export interface MemoryEmbeddingBackfillPayload {
  limit?: number;
  force?: boolean;
}

export interface MemoryEmbeddingBackfillResult extends JsonObject {
  updated: number;
  skipped: number;
  failed: number;
  embedding_model_profile_id?: string | null;
}

export interface DailySummaryRunPayload {
  target_date?: string;
  timezone?: string;
  conversation_id?: string;
  dry_run?: boolean;
}

export interface DailySummaryBackfillPayload {
  start_date: string;
  end_date: string;
  timezone?: string;
  conversation_id?: string;
  dry_run?: boolean;
}

export interface DailySummaryRunResult extends JsonObject {
  status: string;
  target_date?: string | null;
  timezone?: string | null;
  processed?: number;
  created?: number;
  skipped?: number;
  failed?: number;
  eligible_conversation_ids?: string[];
  failures?: JsonObject[];
}

export interface DailySummaryBackfillResult extends JsonObject {
  status: string;
  start_date: string;
  end_date: string;
  created: number;
  processed: number;
  skipped: number;
  failed: number;
  runs: DailySummaryRunResult[];
}
