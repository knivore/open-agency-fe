import type { JsonObject } from '@/types/api';

export type OperatorStatus =
  | 'draft'
  | 'active'
  | 'sleeping'
  | 'waiting_for_input'
  | 'waiting_for_approval'
  | 'paused'
  | 'degraded'
  | 'stopped'
  | 'archived';

export type OperatorResourceType =
  | 'agent'
  | 'persona_version'
  | 'workflow'
  | 'tool'
  | 'connector_installation'
  | 'model_profile'
  | 'runtime_adapter'
  | 'isolation_provider'
  | 'execution_host'
  | 'runtime_profile'
  | 'channel'
  | 'optional_module';

export interface OperatorPlacementPolicy extends JsonObject {
  allowed_runtime_adapter_ids: string[];
  allowed_isolation_provider_ids: string[];
  allowed_execution_host_ids: string[];
  required_host_capabilities: string[];
  preferred_execution_host_labels: string[];
  data_residency: string;
}

export interface OperatorModelRoutePolicy extends JsonObject {
  required_capabilities: string[];
  allowed_model_profile_ids: string[];
  local_first: boolean;
  cloud_fallback: boolean;
}

export interface OperatorDefinition extends JsonObject {
  id: string;
  workspace_id: string;
  name: string;
  description?: string | null;
  purpose: string;
  status: OperatorStatus;
  supervisor_agent_id?: string | null;
  standing_order_version_id?: string | null;
  default_persona_version_id?: string | null;
  evaluation_adapter_id: string;
  default_runtime_adapter_id: string;
  default_isolation_provider_id: string;
  default_runtime_profile_id?: string | null;
  default_model_profile_id?: string | null;
  execution_placement_policy: OperatorPlacementPolicy;
  model_route_policy: OperatorModelRoutePolicy;
  autonomy_policy: JsonObject;
  approval_policy: JsonObject;
  budget_policy: JsonObject;
  memory_policy: JsonObject;
  delivery_policy: JsonObject;
  health_policy: JsonObject;
  concurrency_policy: JsonObject;
  metadata: JsonObject;
  created_by_actor_id?: string | null;
  created_at: string;
  updated_at: string;
  activated_at?: string | null;
  last_evaluated_at?: string | null;
  next_evaluation_at?: string | null;
  stopped_at?: string | null;
}

export interface OperatorStandingOrder extends JsonObject {
  id?: string;
  operator_id?: string;
  version?: number;
  instructions: string;
  success_conditions: string[];
  attention_conditions: string[];
  prohibited_actions: string[];
  default_actions: string[];
  source: 'user' | 'import' | 'approved_proposal';
  change_reason?: string | null;
  created_at?: string;
  activated_at?: string | null;
}

export interface OperatorResourceBinding extends JsonObject {
  id?: string;
  operator_id?: string;
  resource_type: OperatorResourceType;
  resource_id: string;
  role: string;
  status?: 'active' | 'revoked';
  policy: JsonObject;
  metadata: JsonObject;
  granted_at?: string;
  revoked_at?: string | null;
  revocation_reason?: string | null;
}

export interface OperatorReadModel extends JsonObject {
  operator: OperatorDefinition;
  active_standing_order?: OperatorStandingOrder | null;
  resource_bindings: OperatorResourceBinding[];
}

export interface OperatorListResponse extends JsonObject {
  items: OperatorReadModel[];
  count: number;
  workspace_id: string;
}

export interface OperatorFleetSummary extends JsonObject {
  workspace_id: string;
  total: number;
  active: number;
  waiting: number;
  attention: number;
  status_counts: Record<OperatorStatus, number>;
  next_evaluation_at?: string | null;
}

export interface OperatorTrigger extends JsonObject {
  id: string;
  operator_id: string;
  trigger_type: 'heartbeat' | 'cron' | 'at' | 'event' | 'message' | 'lifecycle' | 'manual';
  enabled: boolean;
  schedule?: string | null;
  interval_seconds?: number | null;
  at?: string | null;
  timezone: string;
  active_hours?: {
    days_of_week: number[];
    start: string;
    end: string;
  } | null;
  debounce_seconds: number;
  coalesce_window_seconds: number;
  cooldown_seconds: number;
  jitter_seconds: number;
  priority: number;
  next_fire_at?: string | null;
  last_fire_at?: string | null;
  metadata: JsonObject;
}

export interface OperatorSignal extends JsonObject {
  id: string;
  workspace_id: string;
  operator_id: string;
  trigger_id?: string | null;
  signal_type: string;
  source: string;
  source_event_id?: string | null;
  payload_summary: string;
  payload_ref?: string | null;
  sensitivity: string;
  priority: number;
  status: 'pending' | 'claimed' | 'resolved';
  received_at: string;
  available_at: string;
  resolved_at?: string | null;
  resolution?: string | null;
  resolution_payload: JsonObject;
  metadata: JsonObject;
}

export interface OperatorEvaluationDecision extends JsonObject {
  decision:
    | 'no_action'
    | 'advisory'
    | 'defer'
    | 'notify'
    | 'create_goal'
    | 'continue_goal'
    | 'run_workflow'
    | 'request_input'
    | 'request_approval';
  rationale_summary: string;
  advisory_output?: string | null;
  selected_goal_id?: string | null;
  selected_workflow_id?: string | null;
  requested_action: JsonObject;
  confidence?: number | null;
}

export interface OperatorEvaluation extends JsonObject {
  id: string;
  operator_id: string;
  workspace_id: string;
  signal_ids: string[];
  status: 'queued' | 'running' | 'waiting_for_approval' | 'completed' | 'failed' | 'cancelled';
  decision?: OperatorEvaluationDecision | null;
  created_execution_ids: string[];
  approval_request_ids: string[];
  notification_ids: string[];
  evaluation_adapter_id: string;
  isolation_provider_id: string;
  execution_host_id: string;
  runtime_profile_id?: string | null;
  runtime_profile_version?: string | null;
  model_profile_id?: string | null;
  effective_policy_hash: string;
  enforcement_metadata: JsonObject;
  token_usage: Record<string, number>;
  estimated_cost: number;
  iteration_count: number;
  action_count: number;
  notification_count: number;
  shadow_mode: boolean;
  started_at?: string | null;
  completed_at?: string | null;
  failure_category?: string | null;
  metadata: JsonObject;
  created_at: string;
  updated_at: string;
}

export interface OperatorCapabilityHealth extends JsonObject {
  binding_id: string;
  resource_type: OperatorResourceType;
  resource_id: string;
  role: string;
  status: string;
  available: boolean;
  reason?: string | null;
  descriptor: JsonObject;
}

export interface OperatorNotificationReceipt extends JsonObject {
  id: string;
  status:
    | 'queued'
    | 'deferred'
    | 'delivering'
    | 'awaiting_approval'
    | 'delivered'
    | 'failed'
    | 'suppressed'
    | 'cancelled';
  delivery_class: 'silent' | 'digest' | 'normal' | 'urgent' | 'approval_required';
  content_summary: string;
  conversation_id: string;
  approval_request_id?: string | null;
  provider?: string | null;
  attempt_count: number;
  next_attempt_at?: string | null;
  delivered_at?: string | null;
  failure_summary?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OperatorGoalPortfolioItem extends JsonObject {
  id: string;
  objective: string;
  status: string;
  priority?: number;
  updated_at?: string;
  metadata?: JsonObject;
  success_criteria?: JsonObject[];
  evidence?: JsonObject[];
}

export interface OperatorProposal extends JsonObject {
  schema_version: 'agency.operator.proposal.v1';
  kind: 'AgencyOperatorProposal';
  generated_by: string;
  authoritative: false;
  requires_human_review: true;
  operator: Omit<OperatorDefinition, 'id' | 'status' | 'created_at' | 'updated_at'>;
  standing_order: OperatorStandingOrder;
  resource_bindings: OperatorResourceBinding[];
  review_warnings: string[];
}

export interface OperatorSimulation extends JsonObject {
  mode: 'dry_run';
  authoritative: false;
  persisted: false;
  shadow_mode: true;
  operator_id: string;
  workspace_id: string;
  sample_signal: JsonObject;
  candidate_decision: OperatorEvaluationDecision;
  authoritative_result: { action: 'none'; reason: string };
  comparison: {
    would_request_action: boolean;
    action_performed: false;
    matches_authoritative_result: boolean;
  };
  placement: JsonObject;
  usage: JsonObject;
  metadata: JsonObject;
}

export interface OperatorEmergencyStopResult extends JsonObject {
  workspace_id: string;
  reason: string;
  stopped_operator_ids: string[];
  already_stopped_operator_ids: string[];
  failures: Array<{ operator_id: string; failure_category: string }>;
  complete: boolean;
}

export interface OperatorCollection<T> {
  items: T[];
  count: number;
}
