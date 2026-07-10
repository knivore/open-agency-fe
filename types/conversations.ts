import type { JsonObject } from '@/types/api';
import type { MemoryRecord } from '@/types/memory';

export type ConversationStatus = 'open' | 'archived' | 'blocked';
export type ConversationChannelType = 'web' | 'api' | 'telegram' | 'discord' | 'whatsapp' | 'other';
export type ConversationRole = 'user' | 'assistant' | 'system' | 'tool';
export type ConversationMessageType =
  | 'user_text'
  | 'assistant_text'
  | 'tool_call'
  | 'tool_result'
  | 'execution_started'
  | 'execution_progress'
  | 'execution_completed'
  | 'approval_request'
  | 'approval_result'
  | 'workflow_proposal'
  | 'workflow_update_proposal'
  | 'system_note';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type ApprovalType =
  | 'workflow_execution'
  | 'workflow_create'
  | 'workflow_update'
  | 'agent_update'
  | 'tool_create'
  | 'tool_update'
  | 'tool_execute'
  | 'other';

export interface Conversation extends JsonObject {
  id: string;
  title?: string | null;
  status: ConversationStatus;
  created_by_user_id?: string | null;
  main_agent_profile_id?: string | null;
  channel_type: ConversationChannelType;
  channel_thread_id?: string | null;
  channel_user_id?: string | null;
  channel_display_name?: string | null;
  workspace_id?: string | null;
  metadata?: JsonObject;
  created_at: string;
  updated_at: string;
}

export interface MainAgent extends JsonObject {
  id: string;
  name: string;
  description?: string | null;
  agent_id: string;
  default_workflow_id: string;
  default_model_profile_id?: string | null;
  enabled?: boolean;
  policy?: JsonObject;
  metadata?: JsonObject;
  created_at?: string;
  updated_at?: string;
}

export interface ConversationMessage extends JsonObject {
  id: string;
  conversation_id: string;
  role: ConversationRole;
  message_type: ConversationMessageType;
  content?: JsonObject;
  plain_text?: string | null;
  external_message_id?: string | null;
  execution_id?: string | null;
  approval_request_id?: string | null;
  tool_call_id?: string | null;
  metadata?: JsonObject;
  created_at: string;
}

export interface ApprovalRequest extends JsonObject {
  id: string;
  approval_type: ApprovalType;
  status: ApprovalStatus;
  target_type: string;
  target_id?: string | null;
  requested_by_agent_id: string;
  requested_by_profile_id?: string | null;
  conversation_id: string;
  origin_message_id: string;
  summary: string;
  diff_summary?: string | null;
  proposed_payload?: JsonObject | null;
  decision_reason?: string | null;
  approved_by_user_id?: string | null;
  metadata?: JsonObject;
  created_at: string;
  updated_at: string;
}

export interface ConversationPostMessageResponse extends JsonObject {
  message: ConversationMessage;
  assistant_message?: ConversationMessage;
  approval_request?: ApprovalRequest;
  execution?: JsonObject;
  execution_result_message?: ConversationMessage;
  workflow?: JsonObject;
  agent?: JsonObject;
  stream_url?: string;
}

export type ConversationCompactMode =
  | 'brief'
  | 'handoff'
  | 'memory'
  | 'workflow'
  | 'technical'
  | 'archive'
  | 'custom';
export type ConversationCompactStrategy = 'deterministic' | 'llm' | 'auto';
export type ConversationCompactSourceRange =
  | 'full'
  | 'selected'
  | 'since_last_compact'
  | 'older_than_recent';
export type ConversationCompactScope = 'conversation' | 'user' | 'workspace' | 'workflow';

export interface ConversationCompactProgressEvent extends JsonObject {
  step: string;
  status: 'started' | 'completed' | 'skipped' | 'failed' | string;
  message: string;
  metadata?: JsonObject;
}

export interface ConversationCompactProgress extends JsonObject {
  completed_steps: number;
  failed_steps: number;
  events: ConversationCompactProgressEvent[];
}

export interface ConversationCompactPayload extends JsonObject {
  mode: ConversationCompactMode;
  token_budget: number;
  format?: 'markdown' | 'json' | 'markdown_json';
  source_range: ConversationCompactSourceRange;
  source_message_start_id?: string | null;
  source_message_end_id?: string | null;
  recent_message_limit?: number;
  scope?: ConversationCompactScope;
  workflow_id?: string | null;
  persist?: boolean;
  confirmed?: boolean;
  supersede_previous?: boolean;
  idempotency_key?: string | null;
  strategy?: ConversationCompactStrategy;
  model_profile_id?: string | null;
  custom_keep?: string[] | null;
  custom_drop?: string[] | null;
}

export interface ConversationCompactResponse extends JsonObject {
  status: 'preview' | 'created' | 'existing' | string;
  memory_id?: string | null;
  mode: ConversationCompactMode;
  format?: string;
  scope: ConversationCompactScope;
  source_range: ConversationCompactSourceRange;
  idempotency_key?: string | null;
  content: string;
  summary?: string | null;
  structured?: JsonObject | null;
  source_message_count: number;
  estimated_source_tokens: number;
  estimated_compact_tokens: number;
  sensitive: boolean;
  warnings: string[];
  progress?: ConversationCompactProgress;
}

export interface ConversationCompactPackListResponse extends JsonObject {
  items: MemoryRecord[];
}

export type ConversationContextUsageStatus =
  | 'normal'
  | 'warning'
  | 'critical'
  | 'overflow'
  | 'unknown';

export interface ConversationContextUsage extends JsonObject {
  conversation_id: string;
  message_count: number;
  prompt_message_count: number;
  estimated_context_tokens: number;
  context_window?: number | null;
  remaining_context_tokens?: number | null;
  usage_ratio?: number | null;
  usage_percent?: number | null;
  status: ConversationContextUsageStatus;
  compact_recommended: boolean;
  thresholds?: {
    warning_ratio?: number;
    critical_ratio?: number;
  };
  estimate_method?: string;
  model_profile?: {
    id: string;
    name: string;
    provider: string;
    model: string;
    max_tokens?: number | null;
    context_window?: number | null;
  } | null;
}

export interface ConversationEventMessageCreated extends JsonObject {
  id: string;
  conversation_id: string;
  event_type: 'message.created';
  occurred_at: string;
  message: ConversationMessage;
}

export interface ConversationEventApproval extends JsonObject {
  id: string;
  conversation_id: string;
  event_type: 'approval.requested' | 'approval.resolved';
  occurred_at: string;
  approval: ApprovalRequest;
}

export interface ConversationEventIdle extends JsonObject {
  id: string;
  conversation_id: string;
  event_type: 'conversation.idle';
  occurred_at: string;
}

export interface ConversationEventError extends JsonObject {
  id: string;
  conversation_id: string;
  event_type: 'error';
  occurred_at: string;
  error: { detail?: string };
}

export type ConversationActivityEventType =
  | 'turn.started'
  | 'turn.completed'
  | 'turn.failed'
  | 'turn.cancelled'
  | 'context.loading'
  | 'context.loaded'
  | 'context.compacting'
  | 'context.compacted'
  | 'memory.searching'
  | 'memory.found'
  | 'memory.writing'
  | 'planner.started'
  | 'planner.step'
  | 'planner.completed'
  | 'tool_call.started'
  | 'tool_call.progress'
  | 'tool_call.completed'
  | 'tool_call.failed'
  | 'workflow.proposed'
  | 'workflow.running'
  | 'workflow.completed'
  | 'approval.requested'
  | 'approval.resolved'
  | 'assistant.draft_delta'
  | 'assistant.summary'
  | 'assistant.finalizing'
  | 'artifact.created'
  | 'file.generated'
  | 'handoff.started'
  | 'handoff.completed';

export type ConversationActivityStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ConversationActivityVisibility = 'user' | 'debug' | 'internal';

export interface ConversationActivityEvent extends JsonObject {
  id: string;
  conversation_id: string;
  turn_id: string;
  event_type: ConversationActivityEventType;
  occurred_at: string;
  title?: string;
  detail?: string;
  status?: ConversationActivityStatus;
  message_id?: string;
  tool_call_id?: string;
  execution_id?: string;
  approval_request_id?: string;
  artifact_id?: string;
  text_delta?: string;
  visibility?: ConversationActivityVisibility;
  metadata?: JsonObject;
}

export type ConversationStreamEvent =
  | ConversationEventMessageCreated
  | ConversationEventApproval
  | ConversationEventIdle
  | ConversationEventError
  | ConversationActivityEvent;
