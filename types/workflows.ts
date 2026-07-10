import type { AgentDefinition } from '@/types/agents';
import type { JsonObject, JsonValue } from '@/types/api';
import type { ApprovalRequest } from '@/types/conversations';
import type { ExecutionEventRecord } from '@/types/runtime';
import type { ToolDefinition, ToolParameterMetadata } from '@/types/tools';
import { z } from 'zod';

export type WorkflowCapabilityTag = 'home-control' | 'vision' | 'voice';

export interface WorkflowNodeDefinition extends JsonObject {
  id: string;
  name: string;
  node_type: string;
  agent_id?: string | null;
  task_id?: string | null;
  tool_id?: string | null;
  config?: JsonObject;
  metadata?: JsonObject;
}

export interface WorkflowEdgeDefinition extends JsonObject {
  id: string;
  source_node_id: string;
  target_node_id: string;
  edge_type?: string;
  condition?: string | null;
  metadata?: JsonObject;
}

export interface WorkflowVersionDefinition extends JsonObject {
  version: string;
  revision: number;
  parent_version?: string | null;
  is_published?: boolean;
  labels?: string[];
}

export interface WorkflowVersionRecord extends JsonObject {
  id?: string;
  workflow_id: string;
  revision: number;
  version: string;
  status?: string | null;
  labels?: string[];
  parent_version?: string | null;
  is_published?: boolean;
  is_current?: boolean;
  definition: WorkflowDefinition;
  created_at?: string | null;
  published_at?: string | null;
  provenance?: JsonObject | null;
}

export interface WorkflowVersionsResponse extends JsonObject {
  items: WorkflowVersionRecord[];
}

export interface WorkflowMonitoringControls extends JsonObject {
  enabled: boolean;
  level: string;
  store_run_summaries: boolean;
  store_failure_summaries: boolean;
  allow_improvement_proposals: boolean;
  allow_evaluation_agent_review: boolean;
  allow_self_monitoring: boolean;
  delegate_hitl_to_main_agent?: boolean;
  safe_to_summarize: boolean;
  route_improvement_proposals_to_approval: boolean;
  route_steering_requests_to_approval?: boolean;
  supervise_token_usage?: boolean;
  supervise_context_health?: boolean;
  supervise_subagents?: boolean;
  supervise_tool_failures?: boolean;
  excluded_subagent_ids?: string[];
  excluded_task_ids?: string[];
  allowed_steering_actions?: string[] | null;
  auto_apply_steering_actions?: string[];
  approval_conversation_id?: string | null;
}

export interface WorkflowMonitoringOperatorPayload extends JsonObject {
  enabled: boolean;
  level: string;
  exempted: boolean;
  reason?: string | null;
  visible_to_main_agent: boolean;
  mutable_by_main_agent: boolean;
  default_enabled: boolean;
  is_main_agent_default_workflow: boolean;
  status_label: string;
  controls: WorkflowMonitoringControls;
  exemption?: JsonObject;
  operator_actions?: JsonObject;
}

export interface WorkflowMonitoringUpdateResponse extends JsonObject {
  workflow: WorkflowDefinition;
  monitoring: WorkflowMonitoringOperatorPayload;
}

export type WorkflowRuntimeTokenBudgetAction =
  | 'warn_only'
  | 'compact_context'
  | 'pause_execution'
  | 'fail_execution';

export interface WorkflowRuntimeTokenBudgetControls extends JsonObject {
  configured: boolean;
  run_total_tokens?: number | null;
  workflow_total_tokens?: number | null;
  agent_total_tokens?: number | null;
  warn_ratio: number;
  hard_ratio: number;
  action: WorkflowRuntimeTokenBudgetAction | string;
}

export interface WorkflowRuntimeContextCompactionControls extends JsonObject {
  enabled: boolean;
  persist_context_pack: boolean;
  persist_context_pack_source?: string | null;
  preserve_recent_messages: number;
  oversized_message_tokens: number;
  min_estimated_tokens_saved: number;
  max_summary_chars: number;
}

export interface WorkflowRuntimeGovernanceOperatorPayload extends JsonObject {
  workflow_id: string;
  token_budget: WorkflowRuntimeTokenBudgetControls;
  context_compaction: WorkflowRuntimeContextCompactionControls;
  execution_policy?: {
    configured: boolean;
    max_runtime_seconds?: number | null;
    max_retries?: number | null;
    concurrency_limit?: number | null;
    approval_mode?: 'task_policy' | 'before_run' | 'all_tasks' | string | null;
    effective_concurrency_limit?: number | null;
  };
  operator_actions?: JsonObject;
}

export interface WorkflowRuntimeGovernanceUpdateResponse extends JsonObject {
  workflow: WorkflowDefinition;
  runtime_governance: WorkflowRuntimeGovernanceOperatorPayload;
}

export interface WorkflowMonitoringProposalEvent extends ExecutionEventRecord {
  approval_requests?: ApprovalRequest[];
  dispatches?: Array<{
    message_id: string;
    conversation_id: string;
    created_at: string;
    operator_note?: string | null;
  }>;
}

export interface WorkflowMonitoringEventsResponse extends JsonObject {
  workflow_id: string;
  monitoring: WorkflowMonitoringOperatorPayload;
  findings: ExecutionEventRecord[];
  proposals: WorkflowMonitoringProposalEvent[];
  evaluations: ExecutionEventRecord[];
  comparisons: ExecutionEventRecord[];
  steering_requests?: ExecutionEventRecord[];
  steering_applied?: ExecutionEventRecord[];
  approval_controls: ApprovalRequest[];
}

export interface WorkflowMonitoringProposalDispatchResponse extends JsonObject {
  workflow_id: string;
  proposal_event_id: string;
  conversation_id: string;
  conversation?: JsonObject;
  message?: JsonObject;
  assistant_message?: JsonObject;
  stream_url?: string;
}

export interface WorkflowSteeringApprovalRequest extends JsonObject {
  recommendedAction: string;
  reason: string;
  title?: string | null;
  executionId?: string | null;
  targetTaskId?: string | null;
  targetAgentId?: string | null;
  operatorParameters?: JsonObject;
  evidence?: JsonObject;
  policy?: JsonObject;
  metadata?: JsonObject;
  requestApproval?: boolean;
}

export interface WorkflowSteeringApprovalResponse extends JsonObject {
  workflow_id?: string;
  conversation_id?: string;
  workflow?: WorkflowDefinition;
  approval?: JsonObject;
  approval_request?: ApprovalRequest;
  created?: boolean;
}

export interface WorkflowGovernanceAuditPayload extends JsonObject {
  status?: string;
  reason?: string | null;
  approval_request?: JsonObject | null;
}

export interface WorkflowGovernanceQueueItem extends JsonObject {
  record_kind: 'improvement_proposal' | 'steering_approval' | string;
  record_id: string;
  title?: string | null;
  status: string;
  priority: 'repair' | 'approval' | 'evidence' | 'review' | 'resolved' | string;
  audit_status?: string | null;
  audit_reason?: string | null;
  approval_request_id?: string | null;
  approval_request?: JsonObject | null;
  evidence_link_count: number;
  evidence_links: JsonObject[];
  activity?: JsonObject[];
  record: JsonObject;
  next_actions: string[];
}

export interface WorkflowGovernanceDocumentSuggestion extends JsonObject {
  document: JsonObject;
  score: number;
  matched_terms: string[];
  summary: {
    headline?: string | null;
    document_kind?: string | null;
    tags?: string[];
    linked_to_record?: boolean;
    linked_to_workflow?: boolean;
  };
  reason: string;
}

export interface WorkflowGovernanceDocumentSuggestResponse extends JsonObject {
  workflow_id: string;
  record_kind: string;
  record_id: string;
  record: JsonObject;
  items: WorkflowGovernanceDocumentSuggestion[];
  count: number;
  total_count: number;
}

export interface WorkflowGovernanceBundleResponse extends JsonObject {
  workflow_id: string;
  record_kind: string;
  record_id: string;
  record: JsonObject;
  dry_run: boolean;
  options: JsonObject;
  suggestions: WorkflowGovernanceDocumentSuggestResponse;
  planned_steps: JsonObject[];
  applied_steps: JsonObject[];
}

export interface WorkflowGovernanceActionResponse extends JsonObject {
  workflow_id: string;
  action: string;
  record_kind?: string | null;
  record_id?: string | null;
  document_id?: string | null;
  result: JsonObject;
}

export interface WorkflowGovernanceReviewQueueResponse extends JsonObject {
  workflow_id: string;
  workflow_name: string;
  summary: {
    proposal_count: number;
    steering_approval_count: number;
    actionable_count: number;
    orphaned_approval_count: number;
    remediation_candidate_count: number;
  };
  items: WorkflowGovernanceQueueItem[];
  proposals: WorkflowGovernanceQueueItem[];
  steering_approvals: WorkflowGovernanceQueueItem[];
  orphaned_approvals: JsonObject[];
  recommendations: Array<{
    action: string;
    reason: string;
    count: number;
  }>;
  remediation_preview: JsonObject;
  operator_actions?: JsonObject;
}

export interface MainAgentMonitorCommandCenterResponse extends JsonObject {
  settings: JsonObject;
  runtime: JsonObject;
  active_profile?: JsonObject | null;
  notification_route: JsonObject;
  summary: {
    workflow_count: number;
    monitored_workflow_count: number;
    exempt_workflow_count: number;
    strict_workflow_count: number;
    pending_approval_count: number;
    pending_repo_write_request_count: number;
    recent_finding_count: number;
    recent_proposal_count: number;
    recent_steering_request_count: number;
  };
  workflows: Array<{
    workflow: Pick<WorkflowDefinition, 'id' | 'name' | 'description' | 'versioning'>;
    monitoring: WorkflowMonitoringOperatorPayload;
  }>;
  pending_approvals: ApprovalRequest[];
  repo_write_requests: Array<ApprovalRequest & { repo_write_permission?: JsonObject | null }>;
  findings: Array<ExecutionEventRecord & { workflow?: { id: string; name: string } }>;
  proposals: Array<ExecutionEventRecord & { workflow?: { id: string; name: string } }>;
  steering_requests: Array<ExecutionEventRecord & { workflow?: { id: string; name: string } }>;
  operator_actions?: JsonObject;
}

export interface WorkflowSharedMemoryAgentState extends JsonObject {
  agent_id: string;
  name: string;
  enabled: boolean;
  scope?: string | null;
}

export interface WorkflowSharedMemoryOperatorPayload extends JsonObject {
  workflow_id: string;
  enabled: boolean;
  limit_per_layer: Record<string, number>;
  agent_states: WorkflowSharedMemoryAgentState[];
  memory_filters?: JsonObject;
}

export interface WorkflowSharedMemoryUpdateResponse extends JsonObject {
  workflow: WorkflowDefinition;
  shared_memory: WorkflowSharedMemoryOperatorPayload;
}

export type WorkflowPersonaVersionStatus = 'current' | 'outdated' | 'pinned';

export interface WorkflowPersonaVersionNotice extends JsonObject {
  workflow_id: string;
  workflow_name: string;
  agent_id: string;
  agent_name: string;
  persona_id: string;
  persona_slug: string;
  persona_name: string;
  status: WorkflowPersonaVersionStatus;
  message: string;
  persona_version_id?: string | null;
  persona_version?: string | null;
  current_persona_version_id?: string | null;
  current_persona_version?: string | null;
  published_agent_id?: string | null;
  pin_accepted_for?: string | null;
  pin_decision?: string | null;
  operator_actions?: JsonObject;
}

export interface WorkflowPersonaVersionNoticesResponse extends JsonObject {
  workflow_id: string;
  workflow_name: string;
  items: WorkflowPersonaVersionNotice[];
  count: number;
  has_updates: boolean;
}

export interface WorkflowPersonaAgentVersionActionResponse extends JsonObject {
  workflow: WorkflowDefinition;
  agent: AgentDefinition;
  persona: JsonObject;
  usage?: WorkflowPersonaVersionNotice | null;
  persona_version_notices: WorkflowPersonaVersionNotice[];
}

export interface WorkflowAgentPromotionRequest extends JsonObject {
  global_agent_id?: string | null;
  replace_workflow_agent?: boolean;
}

export interface WorkflowAgentPromotionResponse extends JsonObject {
  workflow: WorkflowDefinition;
  agent: AgentDefinition;
  workflow_updated: boolean;
  promotion: {
    source_workflow_id: string;
    source_workflow_name: string;
    source_agent_id: string;
    global_agent_id: string;
    replaced_workflow_agent: boolean;
  };
}

export interface TaskDefinition extends JsonObject {
  id: string;
  name: string;
  description: string;
  instructions?: string | null;
  expected_output?: string | null;
  agent_id?: string | null;
  tool_ids?: string[];
  memory_ids?: string[];
  depends_on_task_ids?: string[];
  human_approval_required?: boolean;
  timeout_seconds?: number | null;
  max_retries?: number | null;
  model_profile_id?: string | null;
  max_tokens?: number | null;
  approval_policy?: 'none' | 'required' | 'on_failure' | null;
}

export interface Task extends JsonObject {
  id: string;
  name: string;
  description: string;
  instructions?: string | null;
  expectedOutput?: string | null;
  agentId?: string | null;
  toolIds: string[];
  dependsOnTaskIds: string[];
  humanApprovalRequired: boolean;
}

export interface WorkflowDefinition extends JsonObject {
  id: string;
  name: string;
  description?: string | null;
  nodes?: WorkflowNodeDefinition[];
  edges?: WorkflowEdgeDefinition[];
  entrypoint?: string;
  agent_definitions?: AgentDefinition[];
  task_definitions?: TaskDefinition[];
  tool_definitions?: ToolDefinition[];
  memory_definitions?: WorkflowMemoryDefinition[];
  allowed_runtime_adapter_ids?: string[];
  default_runtime_adapter_id?: string | null;
  max_runtime_seconds?: number | null;
  max_retries?: number | null;
  concurrency_limit?: number | null;
  approval_mode?: 'task_policy' | 'before_run' | 'all_tasks' | null;
  versioning?: WorkflowVersionDefinition;
  metadata?: JsonObject;
  monitoring?: WorkflowMonitoringOperatorPayload;
  runtime_governance?: WorkflowRuntimeGovernanceOperatorPayload;
}

export interface WorkflowMemoryDefinition extends JsonObject {
  id: string;
  name: string;
  description?: string | null;
  memory_type?: string | null;
  scope?: string | null;
  metadata?: JsonObject;
}

export interface WorkflowArtifactDefinition extends JsonObject {
  id: string;
  name: string;
  description?: string | null;
  artifact_type?: string | null;
  media_type?: string | null;
  producer_task_id?: string | null;
  metadata?: JsonObject;
}

export const workflowMemoryDefinitionsMetadataKey = 'workflow_memory_definitions';
export const workflowArtifactDefinitionsMetadataKey = 'workflow_artifact_definitions';

function isWorkflowMemoryDefinition(value: unknown): value is WorkflowMemoryDefinition {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as { id?: unknown }).id === 'string' &&
    typeof (value as { name?: unknown }).name === 'string'
  );
}

function isWorkflowArtifactDefinition(value: unknown): value is WorkflowArtifactDefinition {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as { id?: unknown }).id === 'string' &&
    typeof (value as { name?: unknown }).name === 'string'
  );
}

export function workflowMemoryDefinitionsFor(
  workflow: Pick<WorkflowDefinition, 'memory_definitions' | 'metadata'> | null | undefined
): WorkflowMemoryDefinition[] {
  if (Array.isArray(workflow?.memory_definitions)) {
    return workflow.memory_definitions.filter(isWorkflowMemoryDefinition);
  }

  const metadataDefinitions = workflow?.metadata?.[workflowMemoryDefinitionsMetadataKey];
  return Array.isArray(metadataDefinitions)
    ? metadataDefinitions.filter(isWorkflowMemoryDefinition)
    : [];
}

export function workflowArtifactDefinitionsFor(
  workflow: Pick<WorkflowDefinition, 'metadata'> | null | undefined
): WorkflowArtifactDefinition[] {
  const metadataDefinitions = workflow?.metadata?.[workflowArtifactDefinitionsMetadataKey];
  return Array.isArray(metadataDefinitions)
    ? metadataDefinitions.filter(isWorkflowArtifactDefinition)
    : [];
}

export type WorkflowAgentLlmProvider = 'ollama' | 'openai_compatible' | 'openai';
export type ExecutionHost = 'local' | 'docker';

export interface WorkflowAgentLlmOverride {
  provider: WorkflowAgentLlmProvider;
  model: string;
  base_url?: string | null;
  api_key?: string | null;
}

export interface WorkflowAgentRuntimeConfig {
  tool_configs: Array<Pick<WorkflowAgentToolConfig, 'id' | 'parameters'>>;
  model_profile_id?: string | null;
  llm_override?: WorkflowAgentLlmOverride | null;
}

export interface WorkflowExecutionStartPayload {
  workflow: WorkflowDefinition;
  inputs: Record<string, string>;
  runBy: string;
  taskOrder?: string[];
  runtimeAdapterId?: string | null;
  executionHost?: ExecutionHost | null;
  agentConfigs?: Record<string, WorkflowAgentRuntimeConfig>;
}

export interface WorkflowRunStatus {
  status: string;
  result?: string;
}

export interface WorkflowRunInputs {
  [key: string]: string;
}

export interface WorkflowAgentToolConfig {
  id: string;
  name: string;
  description: string;
  created_by?: string;
  owned_by?: string;
  parameters_metadata?: Record<string, ToolParameterMetadata> | null;
  parameters: Record<string, JsonValue>;
}

export const WorkflowEditorFormSchema = z.object({
  id: z.string().nullish(),
  name: z.string(),
  description: z.string(),
  process: z.string().default('sequential'),
  inputs: z.array(z.string()).default([]),
});

export type Workflow = WorkflowDefinition;
export type WorkflowNode = WorkflowNodeDefinition;
export type WorkflowEdge = WorkflowEdgeDefinition;
