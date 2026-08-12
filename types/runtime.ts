import type { ModelProfileDefinition } from '@/types/integrations';
import type { JsonObject } from '@/types/api';
import type { ExecutionHost, WorkflowDefinition } from '@/types/workflows';

export type RunStatus =
  | 'created'
  | 'queued'
  | 'running'
  | 'waiting_for_input'
  | 'waiting_for_approval'
  | 'waiting_for_event'
  | 'sleeping'
  | 'paused'
  | 'cancelling'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ExecutionStatus = RunStatus;

export interface RuntimeAdapterDefinition extends JsonObject {
  id: string;
  name: string;
  adapter_type: string;
  description?: string | null;
  capabilities?: string[];
  version?: string | null;
  config_schema?: JsonObject;
  framework_hints?: JsonObject;
}

export interface ExecutionRecord extends JsonObject {
  id: string;
  workflow_id?: string;
  runtime_adapter_id?: string;
  runtime_revision_id?: string | null;
  runtime_fingerprint?: string | null;
  status?: ExecutionStatus;
  trigger_type?: string;
  trigger_payload?: JsonObject;
  input_payload?: JsonObject;
  output_payload?: JsonObject | null;
  error?: string | null;
  created_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
  worker_id?: string | null;
  last_heartbeat_at?: string | null;
  container_id?: string | null;
  container_name?: string | null;
  container_image?: string | null;
  container_status?: string | null;
  container_started_at?: string | null;
  container_ended_at?: string | null;
  container_exit_code?: number | null;
  current_node_id?: string | null;
  replacement_of_execution_id?: string | null;
  restart_reason?: string | null;
  metadata?: JsonObject;
}

export interface ExecutionStateSnapshot extends JsonObject {
  paused: boolean;
  cancelled: boolean;
  current_node_id?: string | null;
  node_outputs?: JsonObject;
}

export interface ExecutionDetailResponse extends JsonObject {
  execution: ExecutionRecord;
  state: ExecutionStateSnapshot;
  runtime?: RunRuntimeDetails;
  replacement?: RunReplacementDetails;
}

export interface RuntimeRevisionRecord extends JsonObject {
  id: string;
  adapter_id?: string | null;
  fingerprint?: string | null;
  image?: string | null;
  status?: string | null;
  created_at?: string | null;
  invalidated_at?: string | null;
  metadata?: JsonObject;
}

export interface RunContainerInfo extends JsonObject {
  containerId?: string | null;
  containerName?: string | null;
  image?: string | null;
  status?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  exitCode?: number | null;
}

export interface RunRuntimeDetails extends JsonObject {
  runtime_revision?: RuntimeRevisionRecord | null;
  container?: {
    container_id?: string | null;
    container_name?: string | null;
    image?: string | null;
    status?: string | null;
    started_at?: string | null;
    ended_at?: string | null;
    exit_code?: number | null;
  } | null;
  diagnostics?: JsonObject;
}

export interface RunReplacementDetails extends JsonObject {
  restart_reason?: string | null;
  replaces_execution?: ExecutionRecord | null;
  replaced_by_executions?: ExecutionRecord[];
}

export interface ExecutionArtifact extends JsonObject {
  id: string;
  execution_id: string;
  artifact_type?: string;
  name?: string;
  content_json?: JsonObject | null;
  content_text?: string | null;
  uri?: string | null;
  media_type?: string | null;
  size_bytes?: number | null;
  created_at?: string | null;
  metadata?: JsonObject;
}

export interface ExecutionEventRecord extends JsonObject {
  id: string;
  execution_id: string;
  workflow_id?: string | null;
  agent_id?: string | null;
  task_id?: string | null;
  tool_call_id?: string | null;
  model_request_id?: string | null;
  parent_event_id?: string | null;
  trace_id?: string | null;
  span_id?: string | null;
  event_type: string;
  timestamp?: string;
  sequence: number;
  actor_type?: string;
  actor?: string | null;
  source?: string | null;
  status?: string | null;
  payload?: JsonObject;
  payload_sha256?: string | null;
  metrics?: JsonObject;
  redacted_fields?: string[];
  metadata?: JsonObject;
}

export interface ExecutionApprovalRequest extends JsonObject {
  id: string;
  execution_id: string;
  event_id?: string | null;
  tool_id?: string | null;
  status: string;
  request_payload?: JsonObject | null;
  response_payload?: JsonObject | null;
  requested_at?: string | null;
  responded_at?: string | null;
  responded_by?: string | null;
}

export interface ExecutionWaitRecord extends JsonObject {
  id: string;
  execution_id: string;
  kind: 'input' | 'approval' | 'event' | 'sleep' | string;
  status: 'pending' | 'resolved' | 'expired' | 'cancelled' | string;
  idempotency_key: string;
  correlation_key?: string | null;
  checkpoint?: JsonObject;
  request_payload?: JsonObject;
  policy?: JsonObject;
  resolution_payload?: JsonObject | null;
  wake_at?: string | null;
  deadline_at?: string | null;
  created_at?: string | null;
  metadata?: JsonObject;
}

export interface ExecutionUsageResponse extends JsonObject {
  execution_id: string;
  workflow_id?: string | null;
  source?: string;
  token_usage?: JsonObject;
  budget_warnings?: JsonObject[];
  updated_at?: string | null;
}

export interface ExecutionContextUsageResponse extends JsonObject {
  execution_id: string;
  workflow_id?: string | null;
  source?: string;
  context_health?: JsonObject;
  latest_context_health?: JsonObject;
  context_compaction?: JsonObject;
  latest_compaction?: JsonObject;
  compaction_records?: JsonObject[];
  updated_at?: string | null;
}

export interface ExecutionTimelineResponse extends JsonObject {
  execution: ExecutionRecord;
  events: ExecutionEventRecord[];
  execution_duration_ms?: number | null;
}

export interface RunSessionSummary extends JsonObject {
  id: string;
  workflowId?: string | null;
  runtimeAdapterId?: string | null;
  runtimeRevisionId?: string | null;
  runtimeFingerprint?: string | null;
  status: RunStatus | 'unknown';
  triggerType?: string | null;
  createdAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  updatedAt?: string | null;
  createdBy?: string | null;
  workerId?: string | null;
  lastHeartbeatAt?: string | null;
  currentNodeId?: string | null;
  container?: RunContainerInfo;
  replacementOfExecutionId?: string | null;
  restartReason?: string | null;
  inputPayload?: JsonObject | null;
  outputPayload?: JsonObject | null;
  metadata?: JsonObject;
  error?: string | null;
}

export interface RuntimeLogLine extends JsonObject {
  timestamp?: string | null;
  sequence?: number;
  event_type?: string;
  level?: 'info' | 'warn' | 'error' | string;
  agent_id?: string | null;
  agent_name?: string | null;
  task_id?: string | null;
  message?: string;
  text: string;
}

export interface AgentRuntimeLogGroup extends JsonObject {
  agent_id?: string | null;
  agent_name?: string | null;
  logs: RuntimeLogLine[];
}

export interface RunLogEntry extends JsonObject {
  containerId?: string | null;
  container_id?: string | null;
  execution_id?: string | null;
  logs: string;
  workflow_logs?: RuntimeLogLine[];
  agent_logs?: AgentRuntimeLogGroup[];
  raw_container_logs?: string;
  message?: string;
}

export interface RunAgentPresence extends JsonObject {
  id: string;
  name?: string | null;
  status?: string | null;
  taskId?: string | null;
  metadata?: JsonObject;
}

export interface RunTaskPresence extends JsonObject {
  id: string;
  name?: string | null;
  status?: string | null;
  agentId?: string | null;
  metadata?: JsonObject;
}

export interface RunApprovalSummary extends JsonObject {
  id: string;
  status?: string | null;
  toolId?: string | null;
  summary?: string | null;
  metadata?: JsonObject;
}

export interface RunResourceUsage extends JsonObject {
  cpuPercent?: number | null;
  memoryBytes?: number | null;
  memoryPercent?: number | null;
  metadata?: JsonObject;
}

export interface RunSessionDetail extends JsonObject {
  summary: RunSessionSummary;
  state: ExecutionStateSnapshot;
  runtime?: {
    revision?: RuntimeRevisionRecord | null;
    container?: RunContainerInfo;
    diagnostics?: JsonObject;
  };
  replacement?: {
    restartReason?: string | null;
    replacesExecution?: RunSessionSummary | null;
    replacedByExecutions?: RunSessionSummary[];
  };
  events: ExecutionEventRecord[];
  timeline?: ExecutionTimelineResponse | null;
  artifacts: ExecutionArtifact[];
  logs?: RunLogEntry | null;
  agents?: RunAgentPresence[];
  tasks?: RunTaskPresence[];
  approvals?: RunApprovalSummary[];
  resourceUsage?: RunResourceUsage | null;
}

export type RunViewMode = 'list' | 'office';

export interface WorkflowRun extends RunSessionSummary {}

export type AgentRun = RunSessionSummary;
export type AgentRuntimeStatus = RunSessionSummary['status'];

export interface CreateExecutionPayload {
  workflowId: string;
  input?: Record<string, unknown>;
  trigger?: Record<string, unknown>;
  runtimeAdapterId?: string;
  executionHost?: ExecutionHost;
  goal_id?: string | null;
  workflow_definition?: WorkflowDefinition;
  model_profiles?: ModelProfileDefinition[];
}

export interface ApprovalRequestPayload {
  toolId: string;
  reason?: string;
}

export interface ScheduleDefinition extends JsonObject {
  id: string;
  name?: string;
  workflow_id?: string;
  enabled?: boolean;
  trigger_type?: string;
  trigger_config?: JsonObject;
  input_template?: JsonObject;
  runtime_adapter_override?: string | null;
  max_concurrent_executions?: number;
  timezone?: string;
  next_fire_at?: string | null;
  last_fire_at?: string | null;
  metadata?: JsonObject;
}

export interface ScheduleTriggerNowResponse extends JsonObject {
  schedule: ScheduleDefinition;
  execution_id: string;
  triggered_at: string;
  metadata?: JsonObject;
}

/**
 * The backend A2A protocol adapters currently return plain dict payloads.
 * This model reflects the observed task payload from `execution_to_a2a_task`.
 */
export interface A2ATaskResponse extends JsonObject {
  id: string;
  status: string;
  input?: JsonObject;
  output?: JsonObject | null;
  error?: string | null;
  created_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
  metadata?: JsonObject;
}
