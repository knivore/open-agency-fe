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
  status_label: string;
  autonomy: GoalAutonomyMode | string;
  blocked: boolean;
  stale: boolean;
  active_execution_count: number;
  latest_finding?: JsonObject | null;
  next_supervisor_action?: string | null;
  operator_actions?: JsonObject;
}

export interface GoalOperatorViewResponse extends JsonObject {
  items: GoalOperatorSummary[];
  filters?: JsonObject;
  counts?: JsonObject;
}

export interface GoalOperatorDetailResponse extends JsonObject {
  goal: GoalDefinition;
  plan?: JsonObject | null;
  executions: JsonObject[];
  evidence: JsonObject[];
  artifacts: JsonObject[];
  approvals: JsonObject[];
  memory: JsonObject[];
  evaluation?: JsonObject | null;
  findings: ExecutionEventRecord[];
  decisions: JsonObject[];
  timeline: JsonObject[];
  operator_actions?: JsonObject;
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
