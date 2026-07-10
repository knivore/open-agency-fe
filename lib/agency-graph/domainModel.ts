import type {
  SigmaGraphDocument,
  SigmaGraphEdge,
  SigmaGraphJsonObject,
  SigmaGraphNode,
} from '@/modules/sigma-graph/types';

export const agencyGraphNodeTypes = [
  'User',
  'Workflow',
  'WorkflowVersion',
  'Schedule',
  'Run',
  'WorkflowRun',
  'StepRun',
  'Agent',
  'Task',
  'Tool',
  'ToolCall',
  'ModelProvider',
  'Model',
  'ModelRequest',
  'RuntimeRevision',
  'RuntimeContainer',
  'ExecutionEvent',
  'ContainerEvent',
  'Artifact',
  'Memory',
  'ContextPack',
  'Conversation',
  'Message',
  'Document',
  'DocumentChunk',
  'Entity',
  'Decision',
  'Constraint',
  'OpenQuestion',
  'Error',
  'Finding',
  'ApprovalRequest',
  'Integration',
  'Credential',
] as const;

export type AgencyGraphNodeType = (typeof agencyGraphNodeTypes)[number];

export const agencyGraphRelationshipTypes = [
  'CREATED_BY',
  'STARTED',
  'TRIGGERED',
  'PARTICIPATED_IN',
  'ASSIGNED_TO',
  'DEPENDS_ON',
  'CALLED_TOOL',
  'USED_MODEL',
  'USED_PROVIDER',
  'USED_RUNTIME',
  'CREATED_CONTAINER',
  'EMITTED_EVENT',
  'FOLLOWED_BY',
  'PARENT_OF',
  'FAILED_WITH',
  'PRODUCED_ARTIFACT',
  'OCCURRED_IN',
  'HAS_STEP_RUN',
  'CREATED_MEMORY',
  'DERIVED_FROM',
  'SOURCE_EXECUTION',
  'SOURCE_CONVERSATION',
  'SOURCE_DOCUMENT',
  'HAS_CHUNK',
  'MENTIONS',
  'SUPPORTS_DECISION',
  'CONSTRAINS',
  'RAISED_QUESTION',
  'SUPERSEDES',
  'AVAILABLE_TO',
  'HAS_APPROVAL',
  'USES_INTEGRATION',
] as const;

export type AgencyGraphRelationshipType = (typeof agencyGraphRelationshipTypes)[number];

export const agencyGraphMetadataKeys = [
  'source_system',
  'source_endpoint',
  'projection_mode',
  'projection_available',
  'generated_at',
  'root_type',
  'root_id',
  'truncated',
  'limit',
  'confidence',
] as const;

export type AgencyGraphMetadataKey = (typeof agencyGraphMetadataKeys)[number];

export const agencyGraphHealthMetadataKeys = [
  'status',
  'severity',
  'last_seen_at',
  'stale',
  'missing_embedding',
  'sensitive',
  'deleted',
  'cost_estimate',
  'token_count',
] as const;

export type AgencyGraphHealthMetadataKey = (typeof agencyGraphHealthMetadataKeys)[number];

const agencyGraphNodeTypeSet = new Set<string>(agencyGraphNodeTypes);
const agencyGraphRelationshipTypeSet = new Set<string>(agencyGraphRelationshipTypes);

export interface AgencyGraphInvariantIssue {
  path: string;
  reason: string;
}

export interface AgencyGraphSourceMetadata {
  source_system?: string;
  source_endpoint?: string;
  source_record_id?: string;
  projection_mode?: string;
}

export function isAgencyGraphNodeType(value: string): value is AgencyGraphNodeType {
  return agencyGraphNodeTypeSet.has(value);
}

export function isAgencyGraphRelationshipType(value: string): value is AgencyGraphRelationshipType {
  return agencyGraphRelationshipTypeSet.has(value);
}

export function sourceMetadata(source: AgencyGraphSourceMetadata): SigmaGraphJsonObject {
  return compactObject({
    source_system: source.source_system,
    source_endpoint: source.source_endpoint,
    source_record_id: source.source_record_id,
    projection_mode: source.projection_mode,
  });
}

export function canonicalGraphMetadata(metadata: Record<string, unknown>): SigmaGraphJsonObject {
  return compactObject({
    source_system: metadata.source_system,
    source_endpoint: metadata.source_endpoint,
    projection_mode: metadata.projection_mode,
    projection_available: metadata.projection_available,
    generated_at: metadata.generated_at || new Date().toISOString(),
    root_type: metadata.root_type,
    root_id: metadata.root_id,
    truncated: metadata.truncated,
    limit: metadata.limit,
    confidence: metadata.confidence,
    ...metadata,
  });
}

export function validateAgencyGraphInvariants(
  document: SigmaGraphDocument
): AgencyGraphInvariantIssue[] {
  const issues: AgencyGraphInvariantIssue[] = [];
  const nodeIds = new Set<string>();

  document.nodes.forEach((node, index) => {
    validateNode(node, index, issues);
    nodeIds.add(node.id);
  });

  document.edges.forEach((edge, index) => {
    validateEdge(edge, index, nodeIds, issues);
  });

  validateIsoDate(document.metadata?.generated_at, 'metadata.generated_at', issues);

  return issues;
}

function validateNode(node: SigmaGraphNode, index: number, issues: AgencyGraphInvariantIssue[]) {
  const path = `nodes[${index}]`;
  if (!node.id.trim()) {
    issues.push({ path: `${path}.id`, reason: 'must be stable and non-empty' });
  }
  if (!node.label.trim()) {
    issues.push({ path: `${path}.label`, reason: 'must be non-empty' });
  }
  if (!isAgencyGraphNodeType(node.type)) {
    issues.push({ path: `${path}.type`, reason: `must be a canonical Agency Graph node type` });
  }
  if (!hasSourceMetadata(node.metadata)) {
    issues.push({
      path: `${path}.metadata`,
      reason: 'must include source metadata such as source_system or projection_mode',
    });
  }
  validateIsoDate(node.startedAt, `${path}.startedAt`, issues);
  validateIsoDate(node.endedAt, `${path}.endedAt`, issues);
}

function validateEdge(
  edge: SigmaGraphEdge,
  index: number,
  nodeIds: Set<string>,
  issues: AgencyGraphInvariantIssue[]
) {
  const path = `edges[${index}]`;
  if (!edge.id.trim()) {
    issues.push({ path: `${path}.id`, reason: 'must be stable and non-empty' });
  }
  if (!nodeIds.has(edge.source)) {
    issues.push({ path: `${path}.source`, reason: 'must reference an existing node' });
  }
  if (!nodeIds.has(edge.target)) {
    issues.push({ path: `${path}.target`, reason: 'must reference an existing node' });
  }
  if (!isAgencyGraphRelationshipType(edge.type)) {
    issues.push({
      path: `${path}.type`,
      reason: `must be a canonical Agency Graph relationship type`,
    });
  }
  if (!hasSourceMetadata(edge.metadata)) {
    issues.push({
      path: `${path}.metadata`,
      reason: 'must include source metadata such as source_system or projection_mode',
    });
  }
  validateIsoDate(edge.startedAt, `${path}.startedAt`, issues);
  validateIsoDate(edge.endedAt, `${path}.endedAt`, issues);
}

function hasSourceMetadata(metadata: SigmaGraphJsonObject | undefined) {
  return Boolean(
    metadata?.source_system ||
    metadata?.source ||
    metadata?.sourceRecordId ||
    metadata?.source_record_id ||
    metadata?.projection_mode
  );
}

function validateIsoDate(value: unknown, path: string, issues: AgencyGraphInvariantIssue[]) {
  if (value === undefined || value === null || value === '') {
    return;
  }
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    issues.push({ path, reason: 'must be an ISO 8601 timestamp string' });
  }
}

function compactObject(value: Record<string, unknown>): SigmaGraphJsonObject {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined && item !== null && item !== '')
      .map(([key, item]) => [key, jsonValue(item)])
  );
}

function jsonValue(value: unknown): SigmaGraphJsonObject[string] {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
    return value as SigmaGraphJsonObject[string];
  }
  if (Array.isArray(value)) {
    return value.map(jsonValue);
  }
  if (value && typeof value === 'object') {
    return compactObject(value as Record<string, unknown>);
  }
  return String(value);
}
