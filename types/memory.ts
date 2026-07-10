import type { JsonObject } from '@/types/api';

export type MemoryScope = 'user' | 'workspace' | 'conversation' | 'workflow' | 'global';
export const MEMORY_TYPES = [
  'fact',
  'preference',
  'decision',
  'task_commitment',
  'daily_summary',
  'run_summary',
  'context_pack',
  'archive',
] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];
export type MemoryStatus = 'active' | 'archived' | 'superseded';
export type MemoryExclusionTargetType =
  | 'global'
  | 'workflow'
  | 'agent'
  | 'task'
  | 'conversation'
  | 'run';

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
  memory_type?: MemoryType | null;
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
  memory_type?: MemoryType[];
  tags?: string[];
  status?: MemoryStatus[];
  source_conversation_id?: string;
  source_execution_id?: string;
  summary_date_from?: string;
  summary_date_to?: string;
  q?: string;
  limit?: number;
}

export interface MemoryCatalogQuery {
  scope?: MemoryScope | '';
  workflow_id?: string;
  agent_id?: string;
  conversation_id?: string;
  target_type?: MemoryExclusionTargetType;
  target_id?: string;
  q?: string;
  include_sensitive?: boolean;
  status?: MemoryStatus[];
  limit_per_group?: number;
}

export interface MemoryExclusion extends JsonObject {
  id: string;
  memoryId: string;
  targetType: MemoryExclusionTargetType;
  targetId?: string | null;
  reason?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface MemoryExclusionListQuery {
  memory_id?: string;
  target_type?: MemoryExclusionTargetType;
  target_id?: string;
}

export interface MemoryExclusionListResponse extends JsonObject {
  items: MemoryExclusion[];
}

export interface MemoryExclusionPayload extends JsonObject {
  targetType?: MemoryExclusionTargetType;
  target_type?: MemoryExclusionTargetType;
  targetId?: string | null;
  target_id?: string | null;
  reason?: string | null;
}

export interface MemoryExclusionDeleteResponse extends JsonObject {
  deleted: boolean;
  memory_id: string;
  exclusion_id: string;
}

export type MemoryCatalogGroupKey =
  | 'manual'
  | 'compact_packs'
  | 'conversation_summaries'
  | 'documents'
  | 'run_summaries';

export type MemoryTypeTabId =
  | 'all'
  | 'preferences'
  | 'facts'
  | 'decisions'
  | 'task_commitments'
  | 'conversation'
  | 'files'
  | 'compact_packs'
  | 'run_summaries';

export interface MemoryTypeTabDefinition {
  id: MemoryTypeTabId;
  label: string;
  description: string;
  memoryTypes: MemoryType[];
  catalogGroups: MemoryCatalogGroupKey[];
}

export const MEMORY_TYPE_TABS: MemoryTypeTabDefinition[] = [
  {
    id: 'all',
    label: 'All',
    description:
      'Every linkable memory resource across manual memory, files, summaries, and compact packs.',
    memoryTypes: [],
    catalogGroups: [],
  },
  {
    id: 'preferences',
    label: 'Preferences',
    description: 'Stable preferences, such as "user prefers concise updates."',
    memoryTypes: ['preference'],
    catalogGroups: ['manual'],
  },
  {
    id: 'facts',
    label: 'Facts',
    description: 'Durable knowledge, such as "workspace uses Postgres for memory records."',
    memoryTypes: ['fact'],
    catalogGroups: ['manual'],
  },
  {
    id: 'decisions',
    label: 'Decisions',
    description: 'Chosen directions, such as "use memory links in workflow metadata for now."',
    memoryTypes: ['decision'],
    catalogGroups: ['manual'],
  },
  {
    id: 'task_commitments',
    label: 'Task Commitments',
    description:
      'Obligations, promised actions, or task cues that should influence future execution.',
    memoryTypes: ['task_commitment'],
    catalogGroups: ['manual'],
  },
  {
    id: 'conversation',
    label: 'Conversation',
    description:
      'Conversation summaries and conversation-scoped recall for prior discussion context.',
    memoryTypes: ['daily_summary'],
    catalogGroups: ['conversation_summaries'],
  },
  {
    id: 'files',
    label: 'Files',
    description: 'Uploaded documents and extracted file chunks available for retrieval.',
    memoryTypes: ['archive'],
    catalogGroups: ['documents'],
  },
  {
    id: 'compact_packs',
    label: 'Compact Packs',
    description: 'Compacted conversation or workflow handoff packs for reuse in other contexts.',
    memoryTypes: ['context_pack'],
    catalogGroups: ['compact_packs'],
  },
  {
    id: 'run_summaries',
    label: 'Run Summaries',
    description: 'Execution summaries written by workflow runs for future operational recall.',
    memoryTypes: ['run_summary'],
    catalogGroups: ['run_summaries'],
  },
];

export const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  fact: 'Fact',
  preference: 'Preference',
  decision: 'Decision',
  task_commitment: 'Task Commitment',
  daily_summary: 'Conversation Summary',
  run_summary: 'Run Summary',
  context_pack: 'Compact Pack',
  archive: 'File Memory',
};

export const MEMORY_TYPE_DESCRIPTIONS: Record<MemoryType, string> = {
  fact: MEMORY_TYPE_TABS.find((tab) => tab.id === 'facts')?.description ?? '',
  preference: MEMORY_TYPE_TABS.find((tab) => tab.id === 'preferences')?.description ?? '',
  decision: MEMORY_TYPE_TABS.find((tab) => tab.id === 'decisions')?.description ?? '',
  task_commitment: MEMORY_TYPE_TABS.find((tab) => tab.id === 'task_commitments')?.description ?? '',
  daily_summary: MEMORY_TYPE_TABS.find((tab) => tab.id === 'conversation')?.description ?? '',
  run_summary: MEMORY_TYPE_TABS.find((tab) => tab.id === 'run_summaries')?.description ?? '',
  context_pack: MEMORY_TYPE_TABS.find((tab) => tab.id === 'compact_packs')?.description ?? '',
  archive: MEMORY_TYPE_TABS.find((tab) => tab.id === 'files')?.description ?? '',
};

export function memoryTypeLabel(memoryType: MemoryType | null | undefined) {
  return memoryType ? MEMORY_TYPE_LABELS[memoryType] : 'Untyped';
}

export function memoryTypeDescription(memoryType: MemoryType | null | undefined) {
  return memoryType
    ? MEMORY_TYPE_DESCRIPTIONS[memoryType]
    : 'Legacy memory without an explicit type.';
}

export type MemoryCatalogRefType = 'memory' | 'memory_collection';
export type WorkflowMemoryLinkTargetType = 'workflow' | 'agent' | 'task';
export type WorkflowMemoryLinkAccessMode = 'read' | 'read_write';

export interface MemoryCatalogItem extends JsonObject {
  id: string;
  refType: MemoryCatalogRefType;
  label: string;
  summary?: string | null;
  preview: string;
  memoryType?: MemoryType | null;
  source?: string | null;
  scope: MemoryScope;
  status: MemoryStatus | 'mixed';
  tags: string[];
  sensitive: boolean;
  mode?: string | null;
  conversationId?: string | null;
  workflowId?: string | null;
  agentId?: string | null;
  documentId?: string | null;
  documentFilename?: string | null;
  memoryIds: string[];
  chunkCount: number;
  embedded: boolean;
  canLink: boolean;
  blockedReason?: string | null;
  excluded: boolean;
  exclusionReason?: string | null;
  excludedFor: MemoryExclusion[];
  updatedAt?: string;
}

export interface MemoryCatalogGroup extends JsonObject {
  key: MemoryCatalogGroupKey;
  label: string;
  count: number;
  items: MemoryCatalogItem[];
}

export interface MemoryCatalogResponse extends JsonObject {
  groups: MemoryCatalogGroup[];
}

export interface WorkflowMemoryLink extends JsonObject {
  id: string;
  workflowId: string;
  targetType: WorkflowMemoryLinkTargetType;
  targetId?: string | null;
  refType: MemoryCatalogRefType;
  refId: string;
  memoryIds: string[];
  accessMode: WorkflowMemoryLinkAccessMode;
  label?: string | null;
  createdAt?: string | null;
  createdBy?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export interface WorkflowMemoryLinksResponse extends JsonObject {
  workflowId: string;
  items: WorkflowMemoryLink[];
}

export interface WorkflowMemoryLinkPayload extends JsonObject {
  targetType: WorkflowMemoryLinkTargetType;
  refType: MemoryCatalogRefType;
  refId: string;
  target_type?: WorkflowMemoryLinkTargetType;
  targetId?: string | null;
  target_id?: string | null;
  ref_type?: MemoryCatalogRefType;
  ref_id?: string;
  accessMode?: WorkflowMemoryLinkAccessMode;
  access_mode?: WorkflowMemoryLinkAccessMode;
  label?: string | null;
}

export interface WorkflowMemoryLinkCreateResponse extends JsonObject {
  workflow: JsonObject;
  link: WorkflowMemoryLink;
  items: WorkflowMemoryLink[];
}

export interface WorkflowMemoryLinkDeleteResponse extends JsonObject {
  deleted: boolean;
  workflowId: string;
  linkId: string;
}

export interface MemoryWritePayload {
  memory: Partial<MemoryRecord> & Pick<MemoryRecord, 'scope' | 'content'>;
  confirmed?: boolean;
}

export interface MemoryUpdatePayload {
  patch: Partial<MemoryRecord>;
  confirmed?: boolean;
}

export interface MemoryDocumentDeleteResponse extends JsonObject {
  deleted: boolean;
  document_id: string;
  memory_ids: string[];
  deleted_count: number;
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

export type CompactBackfillMode =
  | 'brief'
  | 'handoff'
  | 'memory'
  | 'workflow'
  | 'technical'
  | 'archive'
  | 'custom';
export type CompactBackfillStrategy = 'deterministic' | 'llm' | 'auto';
export type CompactBackfillSourceRange =
  | 'full'
  | 'selected'
  | 'since_last_compact'
  | 'older_than_recent';
export type CompactBackfillScope = 'conversation' | 'user' | 'workspace' | 'workflow';

export interface CompactBackfillPayload extends JsonObject {
  conversation_id?: string | null;
  user_id?: string | null;
  workspace_id?: string | null;
  workflow_id?: string | null;
  mode?: CompactBackfillMode;
  strategy?: CompactBackfillStrategy;
  token_budget?: number;
  source_range?: CompactBackfillSourceRange;
  recent_message_limit?: number;
  scope?: CompactBackfillScope;
  limit?: number;
  dry_run?: boolean;
  confirmed?: boolean;
  skip_existing?: boolean;
  supersede_previous?: boolean;
  idempotency_key?: string | null;
  model_profile_id?: string | null;
  custom_keep?: string[] | null;
  custom_drop?: string[] | null;
}

export interface CompactBackfillProgressEvent extends JsonObject {
  step: string;
  status: 'started' | 'completed' | 'skipped' | 'failed' | string;
  message: string;
  metadata?: JsonObject;
}

export interface CompactBackfillProgress extends JsonObject {
  completed_steps: number;
  failed_steps: number;
  events: CompactBackfillProgressEvent[];
}

export interface CompactBackfillResultItem extends JsonObject {
  conversation_id: string;
  status: string;
  reason?: string;
  memory_id?: string | null;
  mode?: CompactBackfillMode;
  scope?: CompactBackfillScope;
  source_range?: CompactBackfillSourceRange;
  idempotency_key?: string | null;
  source_message_count?: number;
  estimated_source_tokens?: number;
  estimated_compact_tokens?: number;
  sensitive?: boolean;
  progress?: CompactBackfillProgress;
}

export interface CompactBackfillResult extends JsonObject {
  status: string;
  processed: number;
  created: number;
  skipped: number;
  failed: number;
  filters?: JsonObject;
  results: CompactBackfillResultItem[];
  progress: CompactBackfillProgress;
}
