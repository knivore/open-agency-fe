import { agencyApiClient, appApiClient } from '@/lib/api/clientInstances';
import { toAgentRun } from '@/lib/api/backend/agentTransforms';
import { currentUserHeaders } from '@/lib/api/backend/identity';
import { backendRoutes } from '@/lib/api/backend/routes';
import type { AgentRun, ExecutionRecord } from '@/types/runtime';
import type { CrudListResponse, DeleteResponse } from '@/types/api';
import type {
  WorkflowDefinition,
  MainAgentMonitorCommandCenterResponse,
  WorkflowMonitoringEventsResponse,
  WorkflowMonitoringOperatorPayload,
  WorkflowMonitoringProposalDispatchResponse,
  WorkflowMonitoringUpdateResponse,
  WorkflowGovernanceBundleResponse,
  WorkflowGovernanceActionResponse,
  WorkflowGovernanceDocumentSuggestResponse,
  WorkflowGovernanceReviewQueueResponse,
  WorkflowPersonaAgentVersionActionResponse,
  WorkflowAgentPromotionRequest,
  WorkflowAgentPromotionResponse,
  WorkflowPersonaVersionNoticesResponse,
  WorkflowRuntimeGovernanceOperatorPayload,
  WorkflowRuntimeGovernanceUpdateResponse,
  WorkflowSharedMemoryOperatorPayload,
  WorkflowSharedMemoryUpdateResponse,
  WorkflowSteeringApprovalRequest,
  WorkflowSteeringApprovalResponse,
  WorkflowVersionRecord,
  WorkflowVersionsResponse,
} from '@/types/workflows';
import type { AuthUser } from '@/types/auth';
import type { BackendUser } from '@/lib/api/backend/users';
import type {
  WorkflowMemoryLinkCreateResponse,
  WorkflowMemoryLinkDeleteResponse,
  WorkflowMemoryLinkPayload,
  WorkflowMemoryLinksResponse,
} from '@/types/memory';

export const workflowsApi = {
  listWorkflows(user?: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<CrudListResponse<WorkflowDefinition>>(
      backendRoutes.workflows.list(),
      {
        headers: user ? currentUserHeaders(user, internalApiKey) : undefined,
      }
    );
  },
  getWorkflow(workflowId: string) {
    return agencyApiClient.get<WorkflowDefinition>(backendRoutes.workflows.byId(workflowId));
  },
  // Workflow writes stay behind BFF routes when the frontend must delegate the
  // signed-in session rather than relying on a direct browser-to-backend call.
  createWorkflow(payload: WorkflowDefinition | Record<string, unknown>) {
    return appApiClient
      .post<{ data: WorkflowDefinition }>('/api/workflows', payload)
      .then((response) => response.data);
  },
  updateWorkflow(workflowId: string, patch: Record<string, unknown>) {
    return appApiClient.put<WorkflowDefinition>(`/api/workflows/${workflowId}`, patch);
  },
  deleteWorkflow(workflowId: string) {
    return appApiClient.delete<DeleteResponse | { message?: string; status?: number }>(
      `/api/workflows/${workflowId}`
    );
  },
  cloneWorkflow(workflowId: string) {
    return appApiClient
      .post<{ data: WorkflowDefinition }>(`/api/workflows/${workflowId}`, {})
      .then((response) => response.data);
  },
  // Workflow version history is a canonical backend read and does not need a
  // frontend BFF hop when the browser already has backend credentials.
  listWorkflowVersions(workflowId: string) {
    return agencyApiClient.get<WorkflowVersionsResponse>(
      backendRoutes.workflows.versions(workflowId)
    );
  },
  getWorkflowVersion(workflowId: string, revision: number) {
    return agencyApiClient.get<WorkflowVersionRecord>(
      backendRoutes.workflows.version(workflowId, revision)
    );
  },
  getWorkflowMonitoring(workflowId: string) {
    return agencyApiClient.get<WorkflowMonitoringOperatorPayload>(
      backendRoutes.workflows.monitoring(workflowId)
    );
  },
  listWorkflowMonitoringEvents(workflowId: string) {
    return appApiClient.get<WorkflowMonitoringEventsResponse>(
      `/api/workflows/${workflowId}/monitoring/events`
    );
  },
  updateWorkflowMonitoring(workflowId: string, patch: Record<string, unknown>) {
    return appApiClient.patch<WorkflowMonitoringUpdateResponse>(
      `/api/workflows/${workflowId}/monitoring`,
      patch
    );
  },
  dispatchMonitoringProposalToMainAgent(
    workflowId: string,
    proposalEventId: string,
    payload: Record<string, unknown> = {}
  ) {
    return appApiClient.post<WorkflowMonitoringProposalDispatchResponse>(
      `/api/workflows/${workflowId}/monitoring/proposals/${proposalEventId}/dispatch`,
      payload
    );
  },
  createWorkflowSteeringApproval(workflowId: string, payload: WorkflowSteeringApprovalRequest) {
    return appApiClient.post<WorkflowSteeringApprovalResponse>(
      `/api/workflows/${workflowId}/steering-approvals`,
      payload
    );
  },
  getWorkflowGovernanceReviewQueue(workflowId: string, limit?: number) {
    const params = new URLSearchParams();
    if (typeof limit === 'number') {
      params.set('limit', String(limit));
    }
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return appApiClient.get<WorkflowGovernanceReviewQueueResponse>(
      `/api/workflows/${workflowId}/governance/review-queue${suffix}`
    );
  },
  suggestWorkflowGovernanceDocuments(
    workflowId: string,
    recordKind: string,
    recordId: string,
    limit?: number
  ) {
    const params = new URLSearchParams({
      record_kind: recordKind,
      record_id: recordId,
    });
    if (typeof limit === 'number') {
      params.set('limit', String(limit));
    }
    return appApiClient.get<WorkflowGovernanceDocumentSuggestResponse>(
      `/api/workflows/${workflowId}/governance/document-suggest?${params.toString()}`
    );
  },
  executeWorkflowGovernanceBundle(
    workflowId: string,
    recordKind: string,
    recordId: string,
    payload: Record<string, unknown> = {}
  ) {
    return appApiClient.post<WorkflowGovernanceBundleResponse>(
      `/api/workflows/${workflowId}/governance/bundle/${encodeURIComponent(recordKind)}/${encodeURIComponent(recordId)}`,
      payload
    );
  },
  attachWorkflowGovernanceEvidence(
    workflowId: string,
    recordKind: string,
    recordId: string,
    payload: Record<string, unknown>
  ) {
    return appApiClient.post<WorkflowGovernanceActionResponse>(
      `/api/workflows/${workflowId}/governance/action/${encodeURIComponent(recordKind)}/${encodeURIComponent(recordId)}/attach-evidence`,
      payload
    );
  },
  requestWorkflowGovernanceApproval(workflowId: string, recordKind: string, recordId: string) {
    return appApiClient.post<WorkflowGovernanceActionResponse>(
      `/api/workflows/${workflowId}/governance/action/${encodeURIComponent(recordKind)}/${encodeURIComponent(recordId)}/request-approval`,
      {}
    );
  },
  resolveWorkflowGovernanceRecord(workflowId: string, recordKind: string, recordId: string) {
    return appApiClient.post<WorkflowGovernanceActionResponse>(
      `/api/workflows/${workflowId}/governance/action/${encodeURIComponent(recordKind)}/${encodeURIComponent(recordId)}/resolve`,
      {}
    );
  },
  dismissWorkflowGovernanceRecord(workflowId: string, recordKind: string, recordId: string) {
    return appApiClient.post<WorkflowGovernanceActionResponse>(
      `/api/workflows/${workflowId}/governance/action/${encodeURIComponent(recordKind)}/${encodeURIComponent(recordId)}/dismiss`,
      {}
    );
  },
  reopenWorkflowGovernanceRecord(workflowId: string, recordKind: string, recordId: string) {
    return appApiClient.post<WorkflowGovernanceActionResponse>(
      `/api/workflows/${workflowId}/governance/action/${encodeURIComponent(recordKind)}/${encodeURIComponent(recordId)}/reopen`,
      {}
    );
  },
  getWorkflowRuntimeGovernance(workflowId: string) {
    return appApiClient.get<WorkflowRuntimeGovernanceOperatorPayload>(
      `/api/workflows/${workflowId}/runtime-governance`
    );
  },
  listWorkflowPersonaVersionNotices(workflowId: string) {
    return appApiClient.get<WorkflowPersonaVersionNoticesResponse>(
      `/api/workflows/${workflowId}/persona-version-notices`
    );
  },
  useLatestPersonaAgent(workflowId: string, agentId: string) {
    return appApiClient.post<WorkflowPersonaAgentVersionActionResponse>(
      `/api/workflows/${workflowId}/persona-agents/${agentId}/use-latest`,
      {}
    );
  },
  keepCurrentPersonaAgent(workflowId: string, agentId: string) {
    return appApiClient.post<WorkflowPersonaAgentVersionActionResponse>(
      `/api/workflows/${workflowId}/persona-agents/${agentId}/keep-current`,
      {}
    );
  },
  promoteWorkflowAgent(
    workflowId: string,
    agentId: string,
    payload: WorkflowAgentPromotionRequest = {}
  ) {
    return appApiClient.post<WorkflowAgentPromotionResponse>(
      `/api/workflows/${workflowId}/agents/${agentId}/promote`,
      payload
    );
  },
  updateWorkflowRuntimeGovernance(workflowId: string, patch: Record<string, unknown>) {
    return appApiClient.patch<WorkflowRuntimeGovernanceUpdateResponse>(
      `/api/workflows/${workflowId}/runtime-governance`,
      patch
    );
  },
  getWorkflowSharedMemory(workflowId: string) {
    return appApiClient.get<WorkflowSharedMemoryOperatorPayload>(
      `/api/workflows/${workflowId}/shared-memory`
    );
  },
  updateWorkflowSharedMemory(workflowId: string, patch: Record<string, unknown>) {
    return appApiClient.patch<WorkflowSharedMemoryUpdateResponse>(
      `/api/workflows/${workflowId}/shared-memory`,
      patch
    );
  },
  listWorkflowMemoryLinks(workflowId: string) {
    return appApiClient.get<WorkflowMemoryLinksResponse>(
      `/api/workflows/${workflowId}/memory-links`
    );
  },
  addWorkflowMemoryLink(workflowId: string, payload: WorkflowMemoryLinkPayload) {
    return appApiClient.post<WorkflowMemoryLinkCreateResponse>(
      `/api/workflows/${workflowId}/memory-links`,
      payload
    );
  },
  deleteWorkflowMemoryLink(workflowId: string, linkId: string) {
    return appApiClient.delete<WorkflowMemoryLinkDeleteResponse>(
      `/api/workflows/${workflowId}/memory-links/${linkId}`
    );
  },
  validateWorkflow(payload: WorkflowDefinition | Record<string, unknown>) {
    return agencyApiClient.post<Record<string, unknown>>(
      backendRoutes.workflows.validate(),
      payload
    );
  },
  listWorkflowExecutions(workflowId: string) {
    return agencyApiClient.get<CrudListResponse<ExecutionRecord>>(
      backendRoutes.workflows.executions(workflowId)
    );
  },
  async listWorkflowRuns(workflowId: string): Promise<AgentRun[]> {
    const response = await this.listWorkflowExecutions(workflowId);
    return response.items.map(toAgentRun);
  },
};

export const mainAgentMonitorApi = {
  getCommandCenter() {
    return appApiClient.get<MainAgentMonitorCommandCenterResponse>('/api/main-agent/monitor');
  },
  updateRoutes(patch: Record<string, unknown>) {
    return appApiClient.patch<MainAgentMonitorCommandCenterResponse>(
      '/api/main-agent/monitor',
      patch
    );
  },
};

export const backendWorkflowsApi = {
  listWorkflowWebhookEndpoints(workflowId: string, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<{ items: unknown[] }>(
      `${backendRoutes.workflows.byId(workflowId)}/webhook-endpoints`,
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  createWorkflowWebhookEndpoint(
    workflowId: string,
    payload: Record<string, unknown>,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.post<Record<string, unknown>>(
      `${backendRoutes.workflows.byId(workflowId)}/webhook-endpoints`,
      payload,
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  getWorkflowWebhookTrigger(workflowId: string, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<Record<string, unknown>>(
      `${backendRoutes.workflows.byId(workflowId)}/webhook-trigger`,
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  createWorkflowWebhookTrigger(
    workflowId: string,
    payload: Record<string, unknown>,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.post<Record<string, unknown>>(
      `${backendRoutes.workflows.byId(workflowId)}/webhook-trigger`,
      payload,
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  listWorkflows(user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<CrudListResponse<WorkflowDefinition>>(
      backendRoutes.workflows.list(),
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  getWorkflow(workflowId: string, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<WorkflowDefinition>(backendRoutes.workflows.byId(workflowId), {
      headers: currentUserHeaders(user, internalApiKey),
    });
  },
  createWorkflow(
    payload: WorkflowDefinition | Record<string, unknown>,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.post<WorkflowDefinition>(backendRoutes.workflows.create(), payload, {
      headers: currentUserHeaders(user, internalApiKey),
    });
  },
  updateWorkflow(
    workflowId: string,
    patch: Record<string, unknown>,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.put<WorkflowDefinition>(
      backendRoutes.workflows.byId(workflowId),
      patch,
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  validateWorkflow(
    payload: WorkflowDefinition | Record<string, unknown>,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.post<Record<string, unknown>>(
      backendRoutes.workflows.validate(),
      payload,
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  deleteWorkflow(workflowId: string, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.delete<DeleteResponse>(backendRoutes.workflows.byId(workflowId), {
      headers: currentUserHeaders(user, internalApiKey),
    });
  },
  listWorkflowVersions(workflowId: string, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<WorkflowVersionsResponse>(
      backendRoutes.workflows.versions(workflowId),
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  getWorkflowVersion(
    workflowId: string,
    revision: number,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.get<WorkflowVersionRecord>(
      backendRoutes.workflows.version(workflowId, revision),
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  getWorkflowMonitoring(workflowId: string, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<WorkflowMonitoringOperatorPayload>(
      backendRoutes.workflows.monitoring(workflowId),
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  listWorkflowPersonaVersionNotices(
    workflowId: string,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.get<WorkflowPersonaVersionNoticesResponse>(
      backendRoutes.workflows.personaVersionNotices(workflowId),
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  useLatestPersonaAgent(
    workflowId: string,
    agentId: string,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.post<WorkflowPersonaAgentVersionActionResponse>(
      backendRoutes.workflows.personaAgentUseLatest(workflowId, agentId),
      {},
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  keepCurrentPersonaAgent(
    workflowId: string,
    agentId: string,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.post<WorkflowPersonaAgentVersionActionResponse>(
      backendRoutes.workflows.personaAgentKeepCurrent(workflowId, agentId),
      {},
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  promoteWorkflowAgent(
    workflowId: string,
    agentId: string,
    payload: WorkflowAgentPromotionRequest,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.post<WorkflowAgentPromotionResponse>(
      backendRoutes.workflows.agentPromote(workflowId, agentId),
      payload,
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  listWorkflowMonitoringEvents(workflowId: string, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<WorkflowMonitoringEventsResponse>(
      backendRoutes.workflows.monitoringEvents(workflowId),
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  updateMonitoringControls(
    workflowId: string,
    patch: Record<string, unknown>,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.patch<WorkflowMonitoringUpdateResponse>(
      backendRoutes.workflows.monitoring(workflowId),
      patch,
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  dispatchMonitoringProposalToMainAgent(
    workflowId: string,
    proposalEventId: string,
    payload: Record<string, unknown>,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.post<WorkflowMonitoringProposalDispatchResponse>(
      backendRoutes.workflows.monitoringProposalDispatch(workflowId, proposalEventId),
      payload,
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  createWorkflowSteeringApproval(
    workflowId: string,
    payload: WorkflowSteeringApprovalRequest,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.post<WorkflowSteeringApprovalResponse>(
      backendRoutes.workflows.steeringApprovals(workflowId),
      payload,
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  getMainAgentMonitorCommandCenter(user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<MainAgentMonitorCommandCenterResponse>(
      backendRoutes.mainAgentMonitor.commandCenter(),
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  updateMainAgentMonitorRoutes(
    patch: Record<string, unknown>,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.patch<MainAgentMonitorCommandCenterResponse>(
      backendRoutes.mainAgentMonitor.routes(),
      patch,
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  getWorkflowGovernanceReviewQueue(
    workflowId: string,
    user: AuthUser,
    internalApiKey?: string | null,
    limit?: number
  ) {
    const route = backendRoutes.workflows.governanceReviewQueue(workflowId);
    const params = typeof limit === 'number' ? `?limit=${encodeURIComponent(String(limit))}` : '';
    return agencyApiClient.get<WorkflowGovernanceReviewQueueResponse>(`${route}${params}`, {
      headers: currentUserHeaders(user, internalApiKey),
    });
  },
  suggestWorkflowGovernanceDocuments(
    workflowId: string,
    recordKind: string,
    recordId: string,
    user: AuthUser,
    internalApiKey?: string | null,
    limit?: number
  ) {
    const params = new URLSearchParams({
      record_kind: recordKind,
      record_id: recordId,
    });
    if (typeof limit === 'number') {
      params.set('limit', String(limit));
    }
    return agencyApiClient.get<WorkflowGovernanceDocumentSuggestResponse>(
      `${backendRoutes.workflows.governanceDocumentSuggest(workflowId)}?${params.toString()}`,
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  executeWorkflowGovernanceBundle(
    workflowId: string,
    recordKind: string,
    recordId: string,
    payload: Record<string, unknown>,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.post<WorkflowGovernanceBundleResponse>(
      backendRoutes.workflows.governanceBundle(workflowId, recordKind, recordId),
      payload,
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  attachWorkflowGovernanceEvidence(
    workflowId: string,
    recordKind: string,
    recordId: string,
    payload: Record<string, unknown>,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.post<WorkflowGovernanceActionResponse>(
      backendRoutes.workflows.governanceActionAttachEvidence(workflowId, recordKind, recordId),
      payload,
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  requestWorkflowGovernanceApproval(
    workflowId: string,
    recordKind: string,
    recordId: string,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.post<WorkflowGovernanceActionResponse>(
      backendRoutes.workflows.governanceActionRequestApproval(workflowId, recordKind, recordId),
      {},
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  resolveWorkflowGovernanceRecord(
    workflowId: string,
    recordKind: string,
    recordId: string,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.post<WorkflowGovernanceActionResponse>(
      backendRoutes.workflows.governanceActionResolve(workflowId, recordKind, recordId),
      {},
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  dismissWorkflowGovernanceRecord(
    workflowId: string,
    recordKind: string,
    recordId: string,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.post<WorkflowGovernanceActionResponse>(
      backendRoutes.workflows.governanceActionDismiss(workflowId, recordKind, recordId),
      {},
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  reopenWorkflowGovernanceRecord(
    workflowId: string,
    recordKind: string,
    recordId: string,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.post<WorkflowGovernanceActionResponse>(
      backendRoutes.workflows.governanceActionReopen(workflowId, recordKind, recordId),
      {},
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  getWorkflowRuntimeGovernance(workflowId: string, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<WorkflowRuntimeGovernanceOperatorPayload>(
      backendRoutes.workflows.runtimeGovernance(workflowId),
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  updateWorkflowRuntimeGovernance(
    workflowId: string,
    patch: Record<string, unknown>,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.patch<WorkflowRuntimeGovernanceUpdateResponse>(
      backendRoutes.workflows.runtimeGovernance(workflowId),
      patch,
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  getWorkflowSharedMemory(workflowId: string, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<WorkflowSharedMemoryOperatorPayload>(
      backendRoutes.workflows.sharedMemory(workflowId),
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  updateWorkflowSharedMemory(
    workflowId: string,
    patch: Record<string, unknown>,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.patch<WorkflowSharedMemoryUpdateResponse>(
      backendRoutes.workflows.sharedMemory(workflowId),
      patch,
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  listWorkflowMemoryLinks(workflowId: string, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<WorkflowMemoryLinksResponse>(
      backendRoutes.workflows.memoryLinks(workflowId),
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  addWorkflowMemoryLink(
    workflowId: string,
    payload: WorkflowMemoryLinkPayload,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.post<WorkflowMemoryLinkCreateResponse>(
      backendRoutes.workflows.memoryLinks(workflowId),
      payload,
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  deleteWorkflowMemoryLink(
    workflowId: string,
    linkId: string,
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.delete<WorkflowMemoryLinkDeleteResponse>(
      backendRoutes.workflows.memoryLinkById(workflowId, linkId),
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  cloneWorkflow(workflowId: string, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.post<WorkflowDefinition>(
      backendRoutes.workflows.clone(workflowId),
      {},
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  listOwners(workflowId: string, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.get<CrudListResponse<BackendUser>>(
      `${backendRoutes.workflows.byId(workflowId)}/owners`,
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  addOwners(
    workflowId: string,
    ownerIds: string[],
    user: AuthUser,
    internalApiKey?: string | null
  ) {
    return agencyApiClient.post<{ owner_ids: string[]; workflow: WorkflowDefinition }>(
      `${backendRoutes.workflows.byId(workflowId)}/owners`,
      { owner_ids: ownerIds },
      {
        headers: currentUserHeaders(user, internalApiKey),
      }
    );
  },
  removeOwner(workflowId: string, ownerId: string, user: AuthUser, internalApiKey?: string | null) {
    return agencyApiClient.delete<{ owner_ids: string[]; workflow: WorkflowDefinition }>(
      `${backendRoutes.workflows.byId(workflowId)}/owners`,
      {
        headers: currentUserHeaders(user, internalApiKey),
        body: { owner_id: ownerId },
      }
    );
  },
};
