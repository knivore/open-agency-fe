import type { JsonObject } from '@/types/api';

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
  handoff_agent_ids?: string[];
  handoffAgentIds?: string[];
  metadata?: JsonObject;
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
  parameters?: JsonObject;
}
