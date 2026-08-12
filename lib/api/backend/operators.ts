import { agencyApiClient } from '@/lib/api/clientInstances';
import { backendRoutes } from '@/lib/api/backend/routes';
import type {
  OperatorCapabilityHealth,
  OperatorCollection,
  OperatorEmergencyStopResult,
  OperatorEvaluation,
  OperatorFleetSummary,
  OperatorGoalPortfolioItem,
  OperatorListResponse,
  OperatorNotificationReceipt,
  OperatorProposal,
  OperatorReadModel,
  OperatorResourceBinding,
  OperatorSignal,
  OperatorSimulation,
  OperatorStandingOrder,
  OperatorTrigger,
} from '@/types/operators';
import type { JsonObject } from '@/types/api';

const workspaceQuery = (workspaceId: string) => ({ workspace_id: workspaceId });

export const operatorsApi = {
  listOperators(workspaceId: string) {
    return agencyApiClient.get<OperatorListResponse>(backendRoutes.operators.list(), {
      query: workspaceQuery(workspaceId),
    });
  },
  getSummary(workspaceId: string) {
    return agencyApiClient.get<OperatorFleetSummary>(backendRoutes.operators.summary(), {
      query: workspaceQuery(workspaceId),
    });
  },
  getOperator(workspaceId: string, operatorId: string) {
    return agencyApiClient.get<OperatorReadModel>(backendRoutes.operators.byId(operatorId), {
      query: workspaceQuery(workspaceId),
    });
  },
  proposeFromResponsibility(payload: {
    workspace_id: string;
    name: string;
    responsibility: string;
    description?: string | null;
    supervisor_agent_id?: string | null;
    default_persona_version_id?: string | null;
    default_model_profile_id?: string | null;
    resource_bindings?: OperatorResourceBinding[];
  }) {
    return agencyApiClient.post<OperatorProposal>(
      backendRoutes.operators.proposeFromResponsibility(),
      payload
    );
  },
  createOperator(payload: JsonObject) {
    return agencyApiClient.post<OperatorReadModel>(backendRoutes.operators.create(), payload);
  },
  updateDraft(workspaceId: string, operatorId: string, patch: JsonObject) {
    return agencyApiClient.patch<OperatorReadModel>(
      backendRoutes.operators.byId(operatorId),
      {
        patch,
      },
      {
        query: workspaceQuery(workspaceId),
      }
    );
  },
  createStandingOrder(
    workspaceId: string,
    operatorId: string,
    payload: Omit<OperatorStandingOrder, 'id' | 'operator_id' | 'version'>
  ) {
    return agencyApiClient.post<OperatorStandingOrder>(
      backendRoutes.operators.standingOrders(operatorId),
      payload,
      { query: workspaceQuery(workspaceId) }
    );
  },
  grantResource(workspaceId: string, operatorId: string, payload: OperatorResourceBinding) {
    return agencyApiClient.post<OperatorResourceBinding>(
      backendRoutes.operators.resourceBindings(operatorId),
      payload,
      { query: workspaceQuery(workspaceId) }
    );
  },
  listTriggers(workspaceId: string, operatorId: string) {
    return agencyApiClient.get<OperatorCollection<OperatorTrigger>>(
      backendRoutes.operators.triggers(operatorId),
      { query: workspaceQuery(workspaceId) }
    );
  },
  createTrigger(workspaceId: string, operatorId: string, payload: JsonObject) {
    return agencyApiClient.post<OperatorTrigger>(
      backendRoutes.operators.triggers(operatorId),
      payload,
      { query: workspaceQuery(workspaceId) }
    );
  },
  listSignals(workspaceId: string, operatorId: string, limit = 100) {
    return agencyApiClient.get<OperatorCollection<OperatorSignal>>(
      backendRoutes.operators.signals(operatorId),
      { query: { ...workspaceQuery(workspaceId), limit } }
    );
  },
  listEvaluations(workspaceId: string, operatorId: string, limit = 100) {
    return agencyApiClient.get<OperatorCollection<OperatorEvaluation>>(
      backendRoutes.operators.evaluations(operatorId),
      { query: { ...workspaceQuery(workspaceId), limit } }
    );
  },
  listGoals(workspaceId: string, operatorId: string) {
    return agencyApiClient.get<OperatorCollection<OperatorGoalPortfolioItem>>(
      backendRoutes.operators.goals(operatorId),
      { query: workspaceQuery(workspaceId) }
    );
  },
  listNotifications(workspaceId: string, operatorId: string, limit = 100) {
    return agencyApiClient.get<OperatorCollection<OperatorNotificationReceipt>>(
      backendRoutes.operators.notifications(operatorId),
      { query: { ...workspaceQuery(workspaceId), limit } }
    );
  },
  listCommitments(workspaceId: string, operatorId: string) {
    return agencyApiClient.get<OperatorCollection<JsonObject>>(
      backendRoutes.operators.commitments(operatorId),
      { query: workspaceQuery(workspaceId) }
    );
  },
  listAllowedWorkflows(workspaceId: string, operatorId: string) {
    return agencyApiClient.get<OperatorCollection<JsonObject>>(
      backendRoutes.operators.allowedWorkflows(operatorId),
      { query: workspaceQuery(workspaceId) }
    );
  },
  listCapabilities(workspaceId: string, operatorId: string) {
    return agencyApiClient.get<OperatorCollection<OperatorCapabilityHealth>>(
      backendRoutes.operators.capabilities(operatorId),
      { query: workspaceQuery(workspaceId) }
    );
  },
  simulate(
    workspaceId: string,
    operatorId: string,
    payload: {
      signal_type?: string;
      source?: string;
      payload_summary: string;
      sensitivity?: string;
      priority?: number;
    }
  ) {
    return agencyApiClient.post<OperatorSimulation>(
      backendRoutes.operators.simulate(operatorId),
      payload,
      { query: workspaceQuery(workspaceId) }
    );
  },
  emergencyStop(workspaceId: string, reason: string) {
    return agencyApiClient.post<OperatorEmergencyStopResult>(
      backendRoutes.operators.emergencyStop(),
      { reason },
      { query: workspaceQuery(workspaceId) }
    );
  },
  activate(workspaceId: string, operatorId: string) {
    return agencyApiClient.post(
      backendRoutes.operators.activate(operatorId),
      {},
      { query: workspaceQuery(workspaceId) }
    );
  },
  pause(workspaceId: string, operatorId: string) {
    return agencyApiClient.post(
      backendRoutes.operators.pause(operatorId),
      {},
      { query: workspaceQuery(workspaceId) }
    );
  },
  resume(workspaceId: string, operatorId: string) {
    return agencyApiClient.post(
      backendRoutes.operators.resume(operatorId),
      {},
      { query: workspaceQuery(workspaceId) }
    );
  },
  stop(workspaceId: string, operatorId: string) {
    return agencyApiClient.post(
      backendRoutes.operators.stop(operatorId),
      {},
      { query: workspaceQuery(workspaceId) }
    );
  },
  wake(workspaceId: string, operatorId: string, reason: string) {
    return agencyApiClient.post(
      backendRoutes.operators.wake(operatorId),
      { reason },
      { query: workspaceQuery(workspaceId) }
    );
  },
};
