import type { AgentDefinition } from '@/types/agents';
import type { JsonObject } from '@/types/api';
import type { ApprovalRequest } from '@/types/conversations';
import type { ExecutionEventRecord } from '@/types/runtime';
import type { ToolDefinition, ToolParameterMetadata } from '@/types/tools';
import type { User } from '@/types/users';
import { z } from 'zod';

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

export interface WorkflowMonitoringControls extends JsonObject {
  enabled: boolean;
  level: string;
  store_run_summaries: boolean;
  store_failure_summaries: boolean;
  allow_improvement_proposals: boolean;
  allow_evaluation_agent_review: boolean;
  allow_self_monitoring: boolean;
  safe_to_summarize: boolean;
  route_improvement_proposals_to_approval: boolean;
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

export interface WorkflowMonitoringProposalEvent extends ExecutionEventRecord {
  approval_requests?: ApprovalRequest[];
}

export interface WorkflowMonitoringEventsResponse extends JsonObject {
  workflow_id: string;
  monitoring: WorkflowMonitoringOperatorPayload;
  findings: ExecutionEventRecord[];
  proposals: WorkflowMonitoringProposalEvent[];
  evaluations: ExecutionEventRecord[];
  comparisons: ExecutionEventRecord[];
  approval_controls: ApprovalRequest[];
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

export interface TaskDefinition extends JsonObject {
  id: string;
  name: string;
  description: string;
  instructions?: string | null;
  expected_output?: string | null;
  agent_id?: string | null;
  tool_ids?: string[];
  depends_on_task_ids?: string[];
  human_approval_required?: boolean;
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
  allowed_runtime_adapter_ids?: string[];
  default_runtime_adapter_id?: string | null;
  versioning?: WorkflowVersionDefinition;
  metadata?: JsonObject;
  monitoring?: WorkflowMonitoringOperatorPayload;
}

export interface WorkflowWorkspaceDetail extends JsonObject {
  workflow: WorkflowDefinition;
  creator?: User;
  owners: User[];
}

export interface WorkflowEditorFormData {
  id?: string | null;
  name: string;
  description: string;
  process: string;
  inputs: string[];
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
  parameters: Record<string, string>;
}

export interface WorkflowToolOption {
  id: string;
  name: string;
  description: string;
  parameters_metadata?: Record<string, ToolParameterMetadata> | null;
}

export interface WorkflowAgentFormData {
  id?: string | null;
  name: string;
  role: string;
  instructions: string;
  backstory: string;
  temperature?: number | null;
  model_profile_id?: string | null;
  llm_override?: WorkflowAgentLlmOverride | null;
  tool_ids: string[];
  handoff_agent_ids: string[];
  tool_configs: WorkflowAgentToolConfig[];
}

export interface WorkflowTaskFormData {
  id?: string | null;
  name: string;
  description: string;
  expected_output: string;
  agent_id?: string | null;
  depends_on_task_ids: string[];
  human_approval_required?: boolean | null;
  includeTask?: boolean;
}

const WorkflowAgentToolConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  created_by: z.string().optional(),
  owned_by: z.string().optional(),
  parameters_metadata: z.record(z.string(), z.custom<ToolParameterMetadata>()).nullish(),
  parameters: z.record(z.string(), z.string()),
});

export const WorkflowAgentFormSchema = z.object({
  id: z.string().nullish(),
  name: z.string(),
  role: z.string(),
  instructions: z.string(),
  backstory: z.string(),
  temperature: z.number().min(0).max(1).nullish(),
  model_profile_id: z.string().nullish(),
  llm_override: z.object({
    provider: z.enum(['ollama', 'openai_compatible', 'openai']),
    model: z.string(),
    base_url: z.string().nullish(),
    api_key: z.string().nullish(),
  }).nullish(),
  tool_ids: z.array(z.string()).default([]),
  handoff_agent_ids: z.array(z.string()).default([]),
  tool_configs: z.array(WorkflowAgentToolConfigSchema).default([]),
});

export const WorkflowTaskFormSchema = z.object({
  id: z.string().nullish(),
  name: z.string(),
  description: z.string(),
  expected_output: z.string(),
  agent_id: z.string().nullish(),
  depends_on_task_ids: z.array(z.string()).default([]),
  human_approval_required: z.boolean().nullish(),
  includeTask: z.boolean().optional(),
});

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
