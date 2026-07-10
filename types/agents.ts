import type { JsonObject } from '@/types/api';
import type {
  ModelFallbackPolicy,
  ModelFallbackStrategy,
  ModelFallbackTarget,
} from '@/types/integrations';

export interface AgentDefinition extends JsonObject {
  id: string;
  name: string;
  description?: string | null;
  instructions?: string | null;
  system_prompt?: string | null;
  role?: string | null;
  objective?: string | null;
  backstory?: string | null;
  model_profile_id?: string | null;
  tool_ids?: string[];
  toolIds?: string[];
  memory_ids?: string[];
  memoryIds?: string[];
  handoff_agent_ids?: string[];
  handoffAgentIds?: string[];
  guardrails?: AgentGuardrailDefinition[];
  metadata?: JsonObject;
}

export interface AgentGuardrailDefinition extends JsonObject {
  id: string;
  name: string;
  description?: string | null;
  mode?: 'input' | 'output' | 'tool' | 'policy' | 'other';
  config?: JsonObject;
}

export interface AgentConfig extends JsonObject {
  instructions?: string | null;
  systemPrompt?: string | null;
  modelProfileId?: string | null;
  toolIds: string[];
  handoffAgentIds: string[];
  metadata?: JsonObject;
}

export interface Agent extends JsonObject {
  id: string;
  name: string;
  description?: string | null;
  role?: string | null;
  backstory?: string | null;
  config: AgentConfig;
}

export interface BehaviorTuningProfile extends JsonObject {
  id: string;
  name: string;
  provider: string;
  model: string;
  description?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  topP?: number | null;
  supportsTools?: boolean;
  supportsStructuredOutput?: boolean;
  supportsVision?: boolean;
  supportsStreaming?: boolean;
  fallbackStrategy?: ModelFallbackStrategy;
  fallbackModels?: ModelFallbackTarget[];
  fallbackPolicy?: ModelFallbackPolicy;
  parameters?: JsonObject;
}

export interface AgentImportSource extends JsonObject {
  source_type: 'upload' | 'text' | 'url';
  filename?: string | null;
  url?: string | null;
  sha256: string;
}

export interface AgentImportWarning extends JsonObject {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  field?: string | null;
}

export interface AgentImportConflict extends JsonObject {
  conflict_type: 'id' | 'name';
  existing_agent_id: string;
  existing_agent_name: string;
  message: string;
}

export interface AgentImportToolSuggestion extends JsonObject {
  tool_id: string;
  exists: boolean;
  requires_review: boolean;
  high_risk: boolean;
  reason: string;
}

export interface AgentImportHandoffSuggestion extends JsonObject {
  agent_id: string;
  exists: boolean;
  matched_agent_id?: string | null;
  requires_review: boolean;
  reason: string;
}

export interface AgentImportLLMSuggestedTool extends JsonObject {
  tool_id: string;
  confidence: number;
  rationale: string;
}

export interface AgentImportLLMSuggestedHandoff extends JsonObject {
  agent_id: string;
  confidence: number;
  rationale: string;
}

export interface AgentImportLLMNormalizedOutput extends JsonObject {
  agent: AgentDefinition;
  suggested_tool_mappings: AgentImportLLMSuggestedTool[];
  suggested_handoff_mappings: AgentImportLLMSuggestedHandoff[];
  warnings: AgentImportWarning[];
  assumptions: string[];
}

export interface AgentImportProposal extends JsonObject {
  source: AgentImportSource;
  detected_format: string;
  agent: AgentDefinition;
  suggested_tool_ids: AgentImportToolSuggestion[];
  suggested_handoff_agent_ids: AgentImportHandoffSuggestion[];
  warnings: AgentImportWarning[];
  conflicts: AgentImportConflict[];
  requires_review: boolean;
}

export interface AgentImportCommitResult extends JsonObject {
  status: 'created' | 'updated';
  agent: AgentDefinition;
  warnings: AgentImportWarning[];
}

export interface AgentImportBatchError extends JsonObject {
  index: number;
  source_filename?: string | null;
  source_url?: string | null;
  code: string;
  message: string;
}

export interface AgentImportBatchPreviewResult extends JsonObject {
  proposals: AgentImportProposal[];
  errors: AgentImportBatchError[];
}

export interface AgentImportBatchCommitResult extends JsonObject {
  results: AgentImportCommitResult[];
  errors: AgentImportBatchError[];
}
