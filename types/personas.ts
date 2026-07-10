import type { AgentDefinition } from '@/types/agents';
import type { JsonObject } from '@/types/api';
import type { WorkflowPersonaVersionNotice } from '@/types/workflows';

export type PersonaStatus = 'draft' | 'in_review' | 'approved' | 'published' | 'archived';
export type PersonaVersionStatus = 'draft' | 'approved' | 'published' | 'archived';
export type PersonaSourceType =
  | 'document'
  | 'memory'
  | 'conversation'
  | 'upload'
  | 'url'
  | 'manual';
export type PersonaDistillationStatus =
  | 'queued'
  | 'running'
  | 'needs_review'
  | 'completed'
  | 'failed';
export type PersonaItemReviewStatus =
  | 'draft'
  | 'needs_review'
  | 'approved'
  | 'rejected'
  | 'superseded';
export type PersonaItemType =
  | 'domain_knowledge'
  | 'procedure'
  | 'decision_pattern'
  | 'writing_style'
  | 'tool_usage'
  | 'workflow'
  | 'example'
  | 'guardrail'
  | 'social_context'
  | 'source_reference';
export type PersonaMemoryLayer =
  | 'semantic'
  | 'procedural'
  | 'episodic'
  | 'persona'
  | 'tool'
  | 'social';
export type PersonaDistillationMode = 'deterministic' | 'llm' | 'hybrid';
export type PersonaLLMModelSource = 'main_agent' | 'model_profile' | 'model';
export type PersonaGraphContextPreset = 'persona_lineage' | 'persona_capability_map';

export interface PersonaDefinition extends JsonObject {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  status: PersonaStatus;
  created_by_user_id?: string | null;
  workspace_id?: string | null;
  current_version_id?: string | null;
  published_agent_id?: string | null;
  published_workflow_id?: string | null;
  metadata: JsonObject;
  created_at?: string;
  updated_at?: string;
}

export interface PersonaVersion extends JsonObject {
  id: string;
  persona_id: string;
  version: string;
  status: PersonaVersionStatus;
  package: PersonaPackage;
  generated_from_run_id?: string | null;
  approved_by_user_id?: string | null;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PersonaSource extends JsonObject {
  id: string;
  persona_id: string;
  source_type: PersonaSourceType;
  source_id?: string | null;
  filename?: string | null;
  content_sha256?: string | null;
  storage_uri?: string | null;
  metadata: JsonObject;
  created_at?: string;
  updated_at?: string;
}

export interface PersonaDistillationRun extends JsonObject {
  id: string;
  persona_id: string;
  status: PersonaDistillationStatus;
  distillation_mode?: PersonaDistillationMode;
  llm_model_source?: PersonaLLMModelSource | null;
  resolved_model_provider?: string | null;
  resolved_model?: string | null;
  resolved_model_profile_id?: string | null;
  model_profile_id?: string | null;
  input_source_ids: string[];
  output_package: PersonaPackage;
  warnings: JsonObject[];
  errors: JsonObject[];
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PersonaPackageItem extends JsonObject {
  title?: string;
  name?: string;
  content?: string;
  description?: string;
  confidence?: number;
  source_refs?: JsonObject[];
  distillation_item_id?: string;
  item_type?: PersonaItemType;
  memory_layer?: PersonaMemoryLayer;
  review_status?: PersonaItemReviewStatus;
  needs_review?: boolean;
}

export interface PersonaPackagePersona extends JsonObject {
  summary?: string;
  communication_style?: string[];
  preferences?: string[];
  escalation_style?: string;
  response_style?: string;
}

export interface PersonaMemoryLayers extends JsonObject {
  semantic?: PersonaPackageItem[];
  episodic?: PersonaPackageItem[];
  procedural?: PersonaPackageItem[];
  persona?: PersonaPackageItem[];
  tool?: PersonaPackageItem[];
  social?: PersonaPackageItem[];
}

export interface PersonaPackage extends JsonObject {
  schema_version: number;
  persona: PersonaPackagePersona;
  governance?: JsonObject;
  knowledge: PersonaPackageItem[];
  decision_patterns: PersonaPackageItem[];
  workflows: PersonaPackageItem[];
  tools: JsonObject[];
  guardrails: PersonaPackageItem[];
  examples: PersonaPackageItem[];
  memory_layers: PersonaMemoryLayers;
  runtime: JsonObject;
  provenance: JsonObject;
}

export interface PersonaDistillationItem extends JsonObject {
  id: string;
  run_id: string;
  persona_id: string;
  source_memory_id?: string | null;
  item_type: PersonaItemType;
  memory_layer: PersonaMemoryLayer;
  title: string;
  content: string;
  structured_payload: JsonObject;
  confidence: number;
  needs_review: boolean;
  review_status: PersonaItemReviewStatus;
  metadata: JsonObject;
  created_at?: string;
  updated_at?: string;
}

export interface PersonaGovernanceCatalog extends JsonObject {
  defaults: Record<string, string>;
  allowed_values: Record<string, string[]>;
  validation_rules: string[];
}

export interface PersonaItemCatalog extends JsonObject {
  item_types: PersonaItemType[];
  memory_layers: PersonaMemoryLayer[];
  review_statuses: PersonaItemReviewStatus[];
  source_classifications: string[];
  document_kinds: string[];
  distillation_modes?: PersonaDistillationMode[];
  llm_model_sources?: PersonaLLMModelSource[];
  model_profiles?: Array<{
    id: string;
    name: string;
    provider: string;
    model: string;
    supports_structured_output?: boolean;
  }>;
  operational_settings?: {
    default_distillation_mode?: PersonaDistillationMode;
    default_llm_model_source?: PersonaLLMModelSource;
    llm_distillation_enabled?: boolean;
    hybrid_distillation_enabled?: boolean;
  };
}

export interface PersonaDistillPayload extends JsonObject {
  persona_id?: string | null;
  name?: string | null;
  description?: string | null;
  source_memory_ids: string[];
  distillation_mode?: PersonaDistillationMode | null;
  llm_model_source?: PersonaLLMModelSource | null;
  model_profile_id?: string | null;
  llm_model_provider?: string | null;
  llm_model?: string | null;
  persona_type?: string | null;
  capability_mode?: string | null;
  consent_status?: string | null;
  source_basis?: string | null;
  sensitivity_level?: string | null;
  visibility?: string | null;
}

export interface PersonaDistillResult extends JsonObject {
  persona: PersonaDefinition;
  run: PersonaDistillationRun;
  sources: PersonaSource[];
  items: PersonaDistillationItem[];
}

export interface PersonaRunDetail extends PersonaDistillResult {}

export interface PersonaNormalizeResult extends PersonaDistillResult {
  normalization: JsonObject;
}

export interface PersonaBulkReviewResult extends JsonObject {
  action: 'approve' | 'reject';
  count: number;
  items: PersonaDistillationItem[];
}

export interface PersonaRunBulkReviewResult extends PersonaBulkReviewResult {
  run_id: string;
  matched_count: number;
  reviewable_count: number;
  limit: number;
  has_more: boolean;
  filters: JsonObject;
}

export interface PersonaRunSourceMapEntry extends JsonObject {
  key: string;
  label: string;
  memory_id?: string | null;
  document_id?: string | null;
  filename?: string | null;
  content_sha256?: string | null;
  storage_uri?: string | null;
  upload_mode?: string | null;
  chunk_index?: number | null;
  chunk_count?: number | null;
  document_kind: string;
  classification: string;
  source_intelligence_review_status?: string | null;
  upload_intelligence_source?: string | null;
  source_ref: JsonObject;
  item_count: number;
  needs_review_count: number;
  approved_count: number;
  rejected_count: number;
  review_statuses: Record<string, number>;
  item_types: Record<string, number>;
  memory_layers: Record<string, number>;
  distillers: string[];
  vector_tags: string[];
  extraction_targets: string[];
  content_roles: string[];
  review_flags: string[];
  item_ids: string[];
}

export interface PersonaRunSourceMap extends JsonObject {
  run_id: string;
  persona_id: string;
  source_count: number;
  item_count: number;
  needs_review_count: number;
  items: PersonaRunSourceMapEntry[];
}

export interface PersonaRunSourceDetail extends JsonObject {
  run_id: string;
  persona_id: string;
  source: PersonaRunSourceMapEntry;
  items: PersonaDistillationItem[];
  total: number;
  filtered_count: number;
  limit: number;
  offset: number;
  filters: JsonObject;
  counts: JsonObject;
}

export interface PersonaSourceClassificationPatch extends JsonObject {
  classification?: string | null;
  document_kind?: string | null;
  content_roles?: string[] | null;
  extraction_targets?: string[] | null;
  memory_layers?: string[] | null;
  vector_tags?: string[] | null;
  confidence?: number | null;
  rationale?: string | null;
}

export interface PersonaRunSourceClassificationResult extends JsonObject {
  run_id: string;
  persona_id: string;
  source_key: string;
  classification: JsonObject;
  updated_memory_ids: string[];
  updated_item_count: number;
  source_detail: PersonaRunSourceDetail;
}

export interface PersonaRunSourceRedistillResult extends JsonObject {
  run_id: string;
  persona_id: string;
  source_key: string;
  superseded_count: number;
  created_count: number;
  superseded_items: PersonaDistillationItem[];
  items: PersonaDistillationItem[];
  source_detail: PersonaRunSourceDetail;
}

export interface PersonaGraphContextNode extends JsonObject {
  id: string;
  type?: string;
  labels?: string[];
  properties?: JsonObject;
}

export interface PersonaGraphContextEdge extends JsonObject {
  id: string;
  source: string;
  target: string;
  type: string;
  properties?: JsonObject;
}

export interface PersonaGraphContextResult extends JsonObject {
  persona: PersonaDefinition;
  status: string;
  policy?: JsonObject;
  prompt: string;
  graph: {
    nodes: PersonaGraphContextNode[];
    edges: PersonaGraphContextEdge[];
    meta?: JsonObject;
  };
}

export interface PersonaApproveResult extends JsonObject {
  persona: PersonaDefinition;
  run: PersonaDistillationRun;
  persona_version: PersonaVersion;
}

export interface PersonaPublishResult extends JsonObject {
  persona: PersonaDefinition;
  persona_version: PersonaVersion;
  agent: AgentDefinition;
  memory_ids: string[];
}

export interface PersonaWorkflowUsagesResponse extends JsonObject {
  persona_id: string;
  persona_slug: string;
  current_persona_version_id?: string | null;
  published_agent_id?: string | null;
  items: WorkflowPersonaVersionNotice[];
  count: number;
  outdated_count: number;
}
