import type { JsonObject } from '@/types/api';

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
  stream_url?: string;
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

export type ConversationStreamEvent =
  | ConversationEventMessageCreated
  | ConversationEventApproval
  | ConversationEventIdle
  | ConversationEventError;
