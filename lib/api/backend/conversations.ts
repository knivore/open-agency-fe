import { agencyApiClient, getAgencyApiBaseUrl } from '@/lib/api';
import { isApiError } from '@/lib/api/errors';
import { backendRoutes } from '@/lib/api/backend/routes';
import type {
  AgentDefinition,
  ApprovalRequest,
  Conversation,
  ConversationMessage,
  MainAgent,
  ConversationPostMessageResponse,
  ConversationStreamEvent,
  CrudListResponse,
} from '@/lib/api/backend/types';

function withBaseUrl(path: string) {
  const baseUrl = getAgencyApiBaseUrl();
  return baseUrl ? `${baseUrl}${path}` : path;
}

const FALLBACK_MAIN_AGENT_ID = 'main-agent';
const CONVERSATION_LLM_REQUEST_TIMEOUT_MS = 180_000;
const MISSING_MAIN_AGENT_ROUTE_DETAILS = [
  "Conversation 'main-agent' not found",
  "Conversation 'main-agent-profile' not found",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMissingMainAgentRoute(error: unknown) {
  if (!isApiError(error) || error.status !== 404) {
    return false;
  }

  const detail =
    isRecord(error.raw) && typeof error.raw.detail === 'string'
      ? error.raw.detail
      : typeof error.message === 'string'
        ? error.message
        : '';

  return MISSING_MAIN_AGENT_ROUTE_DETAILS.some((candidate) => detail.includes(candidate));
}

function toMainAgentContract(agent: AgentDefinition): MainAgent {
  return {
    id: 'main-agent',
    name: agent.name,
    description: agent.role ?? null,
    agent_id: agent.id,
    default_workflow_id: '',
    default_model_profile_id: agent.model_profile_id ?? null,
    enabled:
      isRecord(agent.metadata) && typeof agent.metadata.enabled === 'boolean'
        ? agent.metadata.enabled
        : true,
    metadata: agent.metadata,
  };
}

export const conversationsApi = {
  listConversations() {
    return agencyApiClient.get<CrudListResponse<Conversation>>(backendRoutes.conversations.list());
  },
  async getMainAgent() {
    try {
      return await agencyApiClient.get<MainAgent>(backendRoutes.conversations.mainAgent());
    } catch (error) {
      if (!isMissingMainAgentRoute(error)) {
        throw error;
      }

      const agent = await agencyApiClient.get<AgentDefinition>(
        backendRoutes.agents.byId(FALLBACK_MAIN_AGENT_ID)
      );
      return toMainAgentContract(agent);
    }
  },
  async updateMainAgent(patch: Record<string, unknown>) {
    try {
      return await agencyApiClient.patch<MainAgent>(
        backendRoutes.conversations.updateMainAgent(),
        patch
      );
    } catch (error) {
      if (!isMissingMainAgentRoute(error)) {
        throw error;
      }

      const agentPatch: Record<string, unknown> = {};
      if (typeof patch.name === 'string') {
        agentPatch.name = patch.name;
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'description')) {
        agentPatch.role = patch.description;
      }
      if (
        typeof patch.default_model_profile_id === 'string' ||
        patch.default_model_profile_id === null
      ) {
        agentPatch.model_profile_id = patch.default_model_profile_id;
      }

      const updatedAgent = await agencyApiClient.put<AgentDefinition>(
        backendRoutes.agents.byId(FALLBACK_MAIN_AGENT_ID),
        agentPatch
      );
      return toMainAgentContract(updatedAgent);
    }
  },
  createConversation(payload: Record<string, unknown>) {
    return agencyApiClient.post<Conversation>(backendRoutes.conversations.create(), payload);
  },
  getConversation(conversationId: string) {
    return agencyApiClient.get<Conversation>(backendRoutes.conversations.byId(conversationId));
  },
  updateConversation(conversationId: string, patch: Record<string, unknown>) {
    return agencyApiClient.patch<Conversation>(
      backendRoutes.conversations.byId(conversationId),
      patch
    );
  },
  listMessages(conversationId: string, options?: { timeoutMs?: number }) {
    return agencyApiClient.get<CrudListResponse<ConversationMessage>>(
      backendRoutes.conversations.messages(conversationId),
      options
    );
  },
  postMessage(conversationId: string, payload: Record<string, unknown>) {
    return agencyApiClient.post<ConversationPostMessageResponse>(
      backendRoutes.conversations.messages(conversationId),
      payload,
      { timeoutMs: CONVERSATION_LLM_REQUEST_TIMEOUT_MS }
    );
  },
  listApprovalRequests(conversationId: string) {
    return agencyApiClient.get<CrudListResponse<ApprovalRequest>>(
      backendRoutes.conversations.approvalRequests(conversationId)
    );
  },
  approveApprovalRequest(
    approvalRequestId: string,
    payload: { user_id: string; reason?: string | null }
  ) {
    return agencyApiClient.post<
      ConversationPostMessageResponse & { approval_request: ApprovalRequest }
    >(backendRoutes.conversations.approveApprovalRequest(approvalRequestId), payload, {
      timeoutMs: CONVERSATION_LLM_REQUEST_TIMEOUT_MS,
    });
  },
  rejectApprovalRequest(
    approvalRequestId: string,
    payload: { user_id: string; reason?: string | null }
  ) {
    return agencyApiClient.post<
      ConversationPostMessageResponse & { approval_request: ApprovalRequest }
    >(backendRoutes.conversations.rejectApprovalRequest(approvalRequestId), payload, {
      timeoutMs: CONVERSATION_LLM_REQUEST_TIMEOUT_MS,
    });
  },
  requestChangesToApprovalRequest(
    approvalRequestId: string,
    payload: { user_id: string; reason?: string | null }
  ) {
    return agencyApiClient.post<
      ConversationPostMessageResponse & { approval_request: ApprovalRequest }
    >(backendRoutes.conversations.requestChangesToApprovalRequest(approvalRequestId), payload, {
      timeoutMs: CONVERSATION_LLM_REQUEST_TIMEOUT_MS,
    });
  },
  splitApprovalRequest(
    approvalRequestId: string,
    payload: { user_id: string; reason?: string | null }
  ) {
    return agencyApiClient.post<
      ConversationPostMessageResponse & { approval_request: ApprovalRequest; approval_requests?: ApprovalRequest[] }
    >(backendRoutes.conversations.splitApprovalRequest(approvalRequestId), payload, {
      timeoutMs: CONVERSATION_LLM_REQUEST_TIMEOUT_MS,
    });
  },
  getStreamUrl(conversationId: string, after?: string) {
    const basePath = backendRoutes.conversations.stream(conversationId);
    const url = new URL(
      withBaseUrl(basePath),
      typeof window === 'undefined' ? 'http://localhost' : window.location.origin
    );
    if (after) {
      url.searchParams.set('after', after);
    }
    return basePath.startsWith('http') || getAgencyApiBaseUrl()
      ? url.toString()
      : `${url.pathname}${url.search}`;
  },
  parseStreamEvent(data: string) {
    return JSON.parse(data) as ConversationStreamEvent;
  },
  async findExecutionContext(executionId: string): Promise<{
    conversation: Conversation | null;
    messages: ConversationMessage[];
    approvals: ApprovalRequest[];
  }> {
    const conversations = await this.listConversations();
    const ordered = [...conversations.items].sort((left, right) => {
      const leftTime = new Date(left.updated_at).getTime();
      const rightTime = new Date(right.updated_at).getTime();
      return rightTime - leftTime;
    });

    for (const conversation of ordered) {
      const messages = await this.listMessages(conversation.id);
      const matched = messages.items.some((message) => message.execution_id === executionId);
      if (!matched) {
        continue;
      }

      const approvals = await this.listApprovalRequests(conversation.id);
      return {
        conversation,
        messages: messages.items,
        approvals: approvals.items.filter((approval) => {
          const metadataExecutionId =
            approval.metadata && typeof approval.metadata.execution_id === 'string'
              ? approval.metadata.execution_id
              : null;
          return approval.target_id === executionId || metadataExecutionId === executionId;
        }),
      };
    }

    return {
      conversation: null,
      messages: [],
      approvals: [],
    };
  },
};
