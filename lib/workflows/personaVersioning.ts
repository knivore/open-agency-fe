import type { AgentDefinition } from '@/types/agents';
import type { PersonaDefinition } from '@/types/personas';
import type { WorkflowDefinition, WorkflowPersonaVersionNotice } from '@/types/workflows';

export interface PersonaAgentVersionNotice {
  agentId: string;
  agentName: string;
  personaId: string;
  personaSlug: string;
  personaName: string;
  currentPersonaVersionId: string | null;
  workflowPersonaVersionId: string | null;
  publishedAgentId: string | null;
  status: 'current' | 'outdated' | 'pinned' | 'unpublished' | 'missing';
  message?: string | null;
  currentPersonaVersion?: string | null;
  workflowPersonaVersion?: string | null;
}

export const personaAgentSnapshotFields = [
  'name',
  'role',
  'description',
  'instructions',
  'system_prompt',
  'backstory',
  'model_profile_id',
  'tool_ids',
  'memory_ids',
  'handoff_agent_ids',
  'guardrails',
] as const;

export type PersonaAgentSnapshotField = (typeof personaAgentSnapshotFields)[number];

const personaAgentSnapshotFieldSet = new Set<string>(personaAgentSnapshotFields);

function metadataString(metadata: AgentDefinition['metadata'] | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function metadataStringArray(metadata: AgentDefinition['metadata'] | undefined, key: string) {
  const value = metadata?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function normalizeSnapshotFields(values: string[]) {
  return values.filter((value): value is PersonaAgentSnapshotField =>
    personaAgentSnapshotFieldSet.has(value)
  );
}

export function personaAgentSnapshotFieldsForAgent(agent: AgentDefinition) {
  return normalizeSnapshotFields(metadataStringArray(agent.metadata, 'persona_snapshot_fields'));
}

export function personaAgentOverrideFieldsForAgent(agent: AgentDefinition) {
  return normalizeSnapshotFields(metadataStringArray(agent.metadata, 'persona_field_overrides'));
}

export function isPersonaAgentFieldFromSnapshot(
  agent: AgentDefinition,
  field: PersonaAgentSnapshotField
) {
  return personaAgentSnapshotFieldsForAgent(agent).includes(field);
}

export function isPersonaAgentFieldOverridden(
  agent: AgentDefinition,
  field: PersonaAgentSnapshotField
) {
  return personaAgentOverrideFieldsForAgent(agent).includes(field);
}

export function personaMetadataForAgent(agent: AgentDefinition) {
  const personaId = metadataString(agent.metadata, 'persona_id');
  const personaSlug = metadataString(agent.metadata, 'persona_slug');
  const personaVersionId = metadataString(agent.metadata, 'persona_version_id');
  const generatedFromPersonaFactory = agent.metadata?.generated_from_persona_factory === true;

  if (!personaId && !personaSlug && !generatedFromPersonaFactory) {
    return null;
  }

  return {
    personaId,
    personaSlug,
    personaVersionId,
    generatedFromPersonaFactory,
  };
}

export function findPersonaSourceAgent(agent: AgentDefinition, personaAgents: AgentDefinition[]) {
  const sourceAgentId =
    metadataString(agent.metadata, 'persona_source_agent_id') ??
    metadataString(agent.metadata, 'published_agent_id');
  if (sourceAgentId) {
    const sourceAgent = personaAgents.find((candidate) => candidate.id === sourceAgentId);
    if (sourceAgent) {
      return sourceAgent;
    }
  }

  const metadata = personaMetadataForAgent(agent);
  if (!metadata) {
    return null;
  }

  return (
    personaAgents.find((candidate) => {
      const candidateMetadata = personaMetadataForAgent(candidate);
      if (!candidateMetadata) {
        return false;
      }

      return Boolean(
        (metadata.personaId && candidateMetadata.personaId === metadata.personaId) ||
        (metadata.personaSlug && candidateMetadata.personaSlug === metadata.personaSlug)
      );
    }) ?? null
  );
}

export function applyPersonaAgentSnapshot(
  agent: AgentDefinition,
  personaAgent: AgentDefinition,
  options: { preserveOverrides?: boolean } = {}
): AgentDefinition {
  const overrideFields = options.preserveOverrides ? personaAgentOverrideFieldsForAgent(agent) : [];
  const nextAgent: AgentDefinition = {
    ...agent,
    metadata: {
      ...(agent.metadata ?? {}),
      ...(personaAgent.metadata ?? {}),
      generated_from_persona_factory: true,
      persona_source_agent_id: personaAgent.id,
      persona_snapshot_fields: [...personaAgentSnapshotFields],
      persona_field_overrides: overrideFields,
    },
  };

  if (!overrideFields.includes('name')) {
    nextAgent.name = personaAgent.name;
  }
  if (!overrideFields.includes('description')) {
    nextAgent.description = personaAgent.description ?? '';
  }
  if (!overrideFields.includes('instructions')) {
    nextAgent.instructions = personaAgent.instructions ?? personaAgent.description ?? '';
  }
  if (!overrideFields.includes('system_prompt')) {
    nextAgent.system_prompt = personaAgent.system_prompt ?? personaAgent.role ?? '';
  }
  if (!overrideFields.includes('role')) {
    nextAgent.role = personaAgent.role ?? '';
  }
  if (!overrideFields.includes('backstory')) {
    nextAgent.backstory = personaAgent.backstory ?? '';
  }
  if (!overrideFields.includes('model_profile_id')) {
    nextAgent.model_profile_id = personaAgent.model_profile_id ?? null;
  }
  if (!overrideFields.includes('tool_ids')) {
    nextAgent.tool_ids = [...(personaAgent.tool_ids ?? personaAgent.toolIds ?? [])];
  }
  if (!overrideFields.includes('memory_ids')) {
    nextAgent.memory_ids = [...(personaAgent.memory_ids ?? personaAgent.memoryIds ?? [])];
  }
  if (!overrideFields.includes('handoff_agent_ids')) {
    nextAgent.handoff_agent_ids = [
      ...(personaAgent.handoff_agent_ids ?? personaAgent.handoffAgentIds ?? []),
    ];
  }
  if (!overrideFields.includes('guardrails')) {
    nextAgent.guardrails = [...(personaAgent.guardrails ?? [])];
  }

  return nextAgent;
}

export function markPersonaAgentFieldOverrides(
  agent: AgentDefinition,
  fields: PersonaAgentSnapshotField[]
): AgentDefinition {
  const snapshotFields = personaAgentSnapshotFieldsForAgent(agent);
  if (snapshotFields.length === 0) {
    return agent;
  }

  const overrideFields = new Set(personaAgentOverrideFieldsForAgent(agent));
  for (const field of fields) {
    if (snapshotFields.includes(field)) {
      overrideFields.add(field);
    }
  }

  return {
    ...agent,
    metadata: {
      ...(agent.metadata ?? {}),
      persona_field_overrides: Array.from(overrideFields),
    },
  };
}

export function personaVersionNoticeForAgent(
  agent: AgentDefinition,
  personas: PersonaDefinition[]
): PersonaAgentVersionNotice | null {
  const metadata = personaMetadataForAgent(agent);
  if (!metadata) {
    return null;
  }

  const persona = personas.find(
    (candidate) =>
      (metadata.personaId && candidate.id === metadata.personaId) ||
      (metadata.personaSlug && candidate.slug === metadata.personaSlug)
  );

  if (!persona) {
    return {
      agentId: agent.id,
      agentName: agent.name || agent.id,
      personaId: metadata.personaId || '',
      personaSlug: metadata.personaSlug || metadata.personaId || agent.name || agent.id,
      personaName: metadata.personaSlug || metadata.personaId || agent.name || agent.id,
      currentPersonaVersionId: '',
      workflowPersonaVersionId: metadata.personaVersionId,
      publishedAgentId: null,
      status: 'missing',
    };
  }

  if (persona.status !== 'published' || !persona.current_version_id) {
    return {
      agentId: agent.id,
      agentName: agent.name || agent.id,
      personaId: persona.id,
      personaSlug: persona.slug,
      personaName: persona.name,
      currentPersonaVersionId: persona.current_version_id || '',
      workflowPersonaVersionId: metadata.personaVersionId,
      publishedAgentId: persona.published_agent_id ?? null,
      status: 'unpublished',
    };
  }

  const acceptedPinForVersion = metadataString(agent.metadata, 'persona_version_pin_accepted_for');
  const versionStatus =
    metadata.personaVersionId === persona.current_version_id ||
    acceptedPinForVersion === persona.current_version_id
      ? acceptedPinForVersion === persona.current_version_id &&
        metadata.personaVersionId !== persona.current_version_id
        ? 'pinned'
        : 'current'
      : 'outdated';

  return {
    agentId: agent.id,
    agentName: agent.name || agent.id,
    personaId: persona.id,
    personaSlug: persona.slug,
    personaName: persona.name,
    currentPersonaVersionId: persona.current_version_id,
    workflowPersonaVersionId: metadata.personaVersionId,
    publishedAgentId: persona.published_agent_id ?? null,
    status: versionStatus,
  };
}

export function normalizeBackendPersonaVersionNotice(
  notice: WorkflowPersonaVersionNotice
): PersonaAgentVersionNotice {
  return {
    agentId: notice.agent_id,
    agentName: notice.agent_name,
    personaId: notice.persona_id,
    personaSlug: notice.persona_slug,
    personaName: notice.persona_name,
    currentPersonaVersionId: notice.current_persona_version_id ?? null,
    workflowPersonaVersionId: notice.persona_version_id ?? null,
    publishedAgentId: notice.published_agent_id ?? null,
    status: notice.status,
    message: notice.message ?? null,
    currentPersonaVersion: notice.current_persona_version ?? null,
    workflowPersonaVersion: notice.persona_version ?? null,
  };
}

export function normalizeBackendPersonaVersionNotices(
  notices: WorkflowPersonaVersionNotice[] | null | undefined
) {
  return (notices ?? []).map(normalizeBackendPersonaVersionNotice);
}

export function personaVersionNoticesForWorkflow(
  workflow: Pick<WorkflowDefinition, 'agent_definitions'> | null | undefined,
  personas: PersonaDefinition[]
) {
  return (workflow?.agent_definitions ?? [])
    .map((agent) => personaVersionNoticeForAgent(agent, personas))
    .filter((notice): notice is PersonaAgentVersionNotice => Boolean(notice));
}

export function shortPersonaVersionId(versionId: string | null | undefined) {
  return versionId ? versionId.slice(0, 8) : 'unknown';
}
