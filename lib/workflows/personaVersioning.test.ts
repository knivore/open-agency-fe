import { describe, expect, it } from 'vitest';
import {
  applyPersonaAgentSnapshot,
  isPersonaAgentFieldFromSnapshot,
  isPersonaAgentFieldOverridden,
  markPersonaAgentFieldOverrides,
  personaVersionNoticesForWorkflow,
} from '@/lib/workflows/personaVersioning';
import type { AgentDefinition } from '@/types/agents';
import type { PersonaDefinition } from '@/types/personas';
import type { WorkflowDefinition } from '@/types/workflows';

const persona: PersonaDefinition = {
  id: 'persona-1',
  slug: 'audit-manager',
  name: 'Audit Manager',
  status: 'published',
  current_version_id: 'version-2',
  published_agent_id: 'persona-agent-audit-manager',
  published_workflow_id: null,
  metadata: {},
};

function workflowWithPersonaVersion(
  personaVersionId: string | null,
  metadata: Record<string, unknown> = {}
): WorkflowDefinition {
  return {
    id: 'workflow-1',
    name: 'Workflow',
    entrypoint: 'task-1',
    agent_definitions: [
      {
        id: 'persona-agent-audit-manager',
        name: 'audit-manager',
        metadata: {
          generated_from_persona_factory: true,
          persona_id: persona.id,
          persona_slug: persona.slug,
          persona_version_id: personaVersionId ?? undefined,
          ...metadata,
        },
      },
    ],
    task_definitions: [],
  };
}

describe('personaVersionNoticesForWorkflow', () => {
  it('marks workflow persona agents as outdated when a newer persona version is published', () => {
    const notices = personaVersionNoticesForWorkflow(workflowWithPersonaVersion('version-1'), [
      persona,
    ]);

    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      agentId: 'persona-agent-audit-manager',
      personaSlug: 'audit-manager',
      currentPersonaVersionId: 'version-2',
      workflowPersonaVersionId: 'version-1',
      status: 'outdated',
    });
  });

  it('marks workflow persona agents as current when they match the published version', () => {
    const notices = personaVersionNoticesForWorkflow(workflowWithPersonaVersion('version-2'), [
      persona,
    ]);

    expect(notices[0]?.status).toBe('current');
  });

  it('marks an accepted older workflow snapshot as pinned until another persona version is published', () => {
    const notices = personaVersionNoticesForWorkflow(
      workflowWithPersonaVersion('version-1', {
        persona_version_pin_accepted_for: 'version-2',
      }),
      [persona]
    );

    expect(notices[0]?.status).toBe('pinned');
  });
});

describe('applyPersonaAgentSnapshot', () => {
  const blankAgent: AgentDefinition = {
    id: 'workflow-agent-1',
    name: 'Draft Agent',
    description: '',
    instructions: '',
    role: '',
    model_profile_id: null,
    tool_ids: [],
    handoff_agent_ids: [],
    metadata: {},
  };
  const personaAgent: AgentDefinition = {
    id: 'persona-agent-1',
    name: 'Persona Agent',
    description: 'Persona description',
    instructions: 'Persona instructions',
    system_prompt: 'Persona system prompt',
    role: 'Persona role',
    backstory: 'Persona backstory',
    model_profile_id: 'profile-1',
    tool_ids: ['tool-1'],
    memory_ids: ['memory-1'],
    handoff_agent_ids: ['agent-next'],
    metadata: {
      generated_from_persona_factory: true,
      persona_id: 'persona-1',
      persona_slug: 'persona',
      persona_version_id: 'version-1',
    },
  };

  it('records persona-filled fields when applying a persona agent snapshot', () => {
    const nextAgent = applyPersonaAgentSnapshot(blankAgent, personaAgent);

    expect(nextAgent).toMatchObject({
      name: 'Persona Agent',
      description: 'Persona description',
      instructions: 'Persona instructions',
      role: 'Persona role',
      tool_ids: ['tool-1'],
      memory_ids: ['memory-1'],
      handoff_agent_ids: ['agent-next'],
      metadata: {
        persona_source_agent_id: 'persona-agent-1',
        persona_field_overrides: [],
      },
    });
    expect(isPersonaAgentFieldFromSnapshot(nextAgent, 'description')).toBe(true);
    expect(isPersonaAgentFieldOverridden(nextAgent, 'description')).toBe(false);
  });

  it('preserves marked manual overrides when refreshing a persona snapshot', () => {
    const firstSnapshot = applyPersonaAgentSnapshot(blankAgent, personaAgent);
    const manuallyEdited = markPersonaAgentFieldOverrides(
      {
        ...firstSnapshot,
        description: 'Workflow-specific description',
      },
      ['description']
    );
    const refreshed = applyPersonaAgentSnapshot(
      manuallyEdited,
      {
        ...personaAgent,
        description: 'Updated persona description',
        instructions: 'Updated persona instructions',
      },
      { preserveOverrides: true }
    );

    expect(refreshed.description).toBe('Workflow-specific description');
    expect(refreshed.instructions).toBe('Updated persona instructions');
    expect(isPersonaAgentFieldOverridden(refreshed, 'description')).toBe(true);
  });
});
