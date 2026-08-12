import type { JsonObject } from '@/types/api';
import type { ExecutionEventRecord } from '@/types/runtime';

export type GoalStatus =
  | 'created'
  | 'planning'
  | 'active'
  | 'waiting_for_input'
  | 'waiting_for_approval'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'abandoned';

export type GoalAutonomyMode = 'off' | 'advisory' | 'guarded' | 'high_autonomy';

export interface GoalDefinition extends JsonObject {
  id: string;
  objective: string;
  status: GoalStatus;
  priority: string;
  owner_actor?: string | null;
  parent_goal_id?: string | null;
  success_criteria: JsonObject[];
  constraints: JsonObject;
  execution_ids: string[];
  evidence: JsonObject[];
  evaluation?: JsonObject | null;
  deadline_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  metadata: JsonObject;
}

export interface GoalListResponse extends JsonObject {
  items: GoalDefinition[];
  filters?: JsonObject;
}

export interface GoalOperatorSummary extends JsonObject {
  goal: GoalDefinition;
  goal_id?: string;
  objective?: string;
  status?: GoalStatus;
  status_label: string;
  autonomy: GoalAutonomyMode | string;
  priority?: string;
  deadline_at?: string | null;
  owner_actor?: string | null;
  current_plan?: JsonObject | null;
  active_plan_version?: number | null;
  active_executions?: JsonObject[];
  blocked: boolean;
  stale: boolean;
  blocked_reason?: JsonObject | string | null;
  blockers?: JsonObject[];
  pending_approvals?: JsonObject[];
  pending_approval_count?: number;
  automatic_actions?: JsonObject[];
  automatic_action_count?: number;
  flags?: Record<string, boolean>;
  active_execution_count: number;
  linked_execution_count?: number;
  next_supervisor_action?: JsonObject | null;
  success_criteria_count?: number;
  evidence_count?: number;
  evaluation_status?: string | null;
  updated_at?: string;
  created_at?: string;
}

export interface GoalOperatorViewResponse extends JsonObject {
  items: GoalOperatorSummary[];
  count: number;
  filters?: JsonObject;
  summary: {
    blocked_count: number;
    stale_count: number;
    failing_count: number;
    pending_approval_count: number;
    automatic_action_count: number;
  };
}

export interface GoalOperatorDetailResponse extends GoalOperatorSummary {
  goal: GoalDefinition;
  timeline: JsonObject[];
  evidence: JsonObject[];
  artifacts: Record<string, JsonObject[]>;
  approvals: JsonObject[];
  memory: JsonObject;
  evaluation?: JsonObject | null;
  supervisor: {
    findings: JsonObject[];
    decisions: JsonObject[];
    supervisor_actions: JsonObject[];
    operator_actions: JsonObject[];
    approval_requests: JsonObject[];
  };
  executions: Record<string, JsonObject>;
  events: Record<string, ExecutionEventRecord[]>;
  operator_actions: Record<string, boolean>;
}

export interface CreateGoalPayload extends JsonObject {
  objective: string;
  status?: GoalStatus;
  priority?: string;
  owner_actor?: string | null;
  parent_goal_id?: string | null;
  success_criteria?: JsonObject[];
  constraints?: JsonObject;
  deadline_at?: string | null;
  metadata?: JsonObject;
}

export interface UpdateGoalPayload extends JsonObject {
  objective?: string;
  status?: GoalStatus;
  priority?: string;
  owner_actor?: string | null;
  parent_goal_id?: string | null;
  success_criteria?: JsonObject[];
  constraints?: JsonObject;
  execution_ids?: string[];
  evidence?: JsonObject[];
  evaluation?: JsonObject | null;
  deadline_at?: string | null;
  completed_at?: string | null;
  metadata?: JsonObject;
}

export interface GoalPlanPayload extends JsonObject {
  plan?: JsonObject | null;
  reason?: string;
}

export interface GoalReplanPayload extends JsonObject {
  plan?: JsonObject | null;
  reason: string;
}

export interface GoalEvidencePayload extends JsonObject {
  evidence: JsonObject[];
}

export interface GoalEvaluatePayload extends JsonObject {
  evidence?: JsonObject[];
  persist?: boolean;
}

export interface GoalCompletePayload extends JsonObject {
  evidence?: JsonObject[];
  evaluation?: JsonObject | null;
}

export interface GoalOperatorActionPayload extends JsonObject {
  action:
    | 'pause'
    | 'resume'
    | 'cancel'
    | 'adjust_autonomy'
    | 'update_success_criteria'
    | 'reassign';
  reason?: string | null;
  autonomy?: GoalAutonomyMode | null;
  owner_actor?: string | null;
  success_criteria?: JsonObject[];
  metadata?: JsonObject | null;
}
