import { agencyApiClient } from '@/lib/api/clientInstances';
import { backendRoutes } from '@/lib/api/backend/routes';
import type {
  CreateGoalPayload,
  GoalCompletePayload,
  GoalDefinition,
  GoalEvaluatePayload,
  GoalEvidencePayload,
  GoalListResponse,
  GoalOperatorActionPayload,
  GoalOperatorDetailResponse,
  GoalOperatorViewResponse,
  GoalPlanPayload,
  GoalReplanPayload,
  UpdateGoalPayload,
} from '@/types/goals';
import type { JsonObject } from '@/types/api';

export interface GoalListQuery {
  status?: string | null;
  parent_goal_id?: string | null;
  active_only?: boolean;
}

function goalQuery(query: GoalListQuery = {}) {
  return {
    status: query.status || undefined,
    parent_goal_id: query.parent_goal_id || undefined,
    active_only: query.active_only || undefined,
  };
}

export const goalsApi = {
  listGoals(query: GoalListQuery = {}) {
    return agencyApiClient.get<GoalListResponse>(backendRoutes.goals.list(), {
      query: goalQuery(query),
    });
  },
  createGoal(payload: CreateGoalPayload) {
    return agencyApiClient.post<GoalDefinition>(backendRoutes.goals.create(), payload);
  },
  getGoal(goalId: string) {
    return agencyApiClient.get<GoalDefinition>(backendRoutes.goals.byId(goalId));
  },
  updateGoal(goalId: string, patch: UpdateGoalPayload) {
    return agencyApiClient.patch<GoalDefinition>(backendRoutes.goals.byId(goalId), patch);
  },
  getOperatorView(query: GoalListQuery = {}) {
    return agencyApiClient.get<GoalOperatorViewResponse>(backendRoutes.goals.operatorView(), {
      query: goalQuery(query),
    });
  },
  getOperatorDetail(goalId: string) {
    return agencyApiClient.get<GoalOperatorDetailResponse>(
      backendRoutes.goals.operatorDetail(goalId)
    );
  },
  applyOperatorAction(goalId: string, payload: GoalOperatorActionPayload) {
    return agencyApiClient.post<GoalDefinition>(
      backendRoutes.goals.operatorActions(goalId),
      payload
    );
  },
  planGoal(goalId: string, payload: GoalPlanPayload = {}) {
    return agencyApiClient.post<GoalDefinition>(backendRoutes.goals.plan(goalId), {
      reason: payload.reason ?? 'initial_plan',
      plan: payload.plan ?? undefined,
    });
  },
  replanGoal(goalId: string, payload: GoalReplanPayload) {
    return agencyApiClient.post<GoalDefinition>(backendRoutes.goals.replan(goalId), payload);
  },
  attachEvidence(goalId: string, payload: GoalEvidencePayload) {
    return agencyApiClient.post<GoalDefinition>(backendRoutes.goals.evidence(goalId), payload);
  },
  evaluateGoal(goalId: string, payload: GoalEvaluatePayload = {}) {
    return agencyApiClient.post<JsonObject>(backendRoutes.goals.evaluate(goalId), {
      evidence: payload.evidence ?? [],
      persist: payload.persist ?? true,
    });
  },
  listSupervisorFindings(goalId: string) {
    return agencyApiClient.get<JsonObject>(backendRoutes.goals.supervisorFindings(goalId));
  },
  recordSupervisorDecision(goalId: string, decision: JsonObject) {
    return agencyApiClient.post<GoalDefinition>(backendRoutes.goals.supervisorDecisions(goalId), {
      decision,
    });
  },
  storeSummaryMemory(goalId: string, reason = 'goal_summary') {
    return agencyApiClient.post<GoalDefinition>(backendRoutes.goals.memorySummary(goalId), {
      reason,
    });
  },
  pauseGoal(goalId: string) {
    return agencyApiClient.post<GoalDefinition>(backendRoutes.goals.pause(goalId), {});
  },
  resumeGoal(goalId: string) {
    return agencyApiClient.post<GoalDefinition>(backendRoutes.goals.resume(goalId), {});
  },
  cancelGoal(goalId: string, reason?: string | null) {
    return agencyApiClient.post<GoalDefinition>(backendRoutes.goals.cancel(goalId), {
      reason: reason ?? undefined,
    });
  },
  completeGoal(goalId: string, payload: GoalCompletePayload = {}) {
    return agencyApiClient.post<GoalDefinition>(backendRoutes.goals.complete(goalId), {
      evidence: payload.evidence ?? [],
      evaluation: payload.evaluation ?? undefined,
    });
  },
};
