import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WorkflowBuilderPanel from '@/components/workflow/WorkflowBuilderPanel';
import type { AgentDefinition } from '@/types/agents';
import type { ToolDefinition } from '@/types/tools';
import type { TaskDefinition } from '@/types/workflows';
import React from 'react';

const agent: AgentDefinition = {
  id: 'agent-1',
  name: 'Research Agent',
  description: 'Finds facts.',
  instructions: 'Find facts.',
  system_prompt: '',
  role: 'researcher',
  backstory: '',
  model_profile_id: null,
  tool_ids: [],
  handoff_agent_ids: [],
  metadata: {},
};

const task: TaskDefinition = {
  id: 'task-1',
  name: 'Draft outline',
  description: 'Prepare an outline.',
  instructions: 'Create the outline.',
  expected_output: 'Outline',
  agent_id: 'agent-1',
  tool_ids: [],
  memory_ids: [],
  depends_on_task_ids: [],
  human_approval_required: false,
};

const homeTool: ToolDefinition = {
  id: 'home_assistant.turn_on',
  name: 'home_assistant_turn_on',
  description: 'Turn on a smart-home entity.',
  tags: ['catalog', 'home_assistant'],
};

const canonicalDeviceTool: ToolDefinition = {
  id: 'agency.device.command',
  name: 'agency_device_command',
  description: 'Issue a policy-checked canonical device command.',
  tags: ['catalog', 'physical_devices', 'smart_home'],
};

const speechTool: ToolDefinition = {
  id: 'agency.speech.listen',
  name: 'agency_speech_listen',
  description: 'Transcribe recorded speech into text.',
  tags: ['catalog', 'speech'],
};

function renderBuilder(overrides?: Partial<React.ComponentProps<typeof WorkflowBuilderPanel>>) {
  const updateAgentDefinition = vi.fn();

  render(
    <WorkflowBuilderPanel
      workflowId="workflow-1"
      isEditing
      behaviorProfiles={[{ id: 'profile-1', name: 'GPT Profile' }]}
      workflowCapabilityTags={[]}
      toolDefinitions={[]}
      memoryDefinitions={[]}
      visibleAgentDefinitions={[agent]}
      availableAgentDefinitions={[]}
      personaAgentDefinitions={[]}
      visibleTaskDefinitions={[]}
      effectiveEntrypointTaskId=""
      selectedTaskId={null}
      selectedTaskDetail={null}
      workflowKickoffInputs={{}}
      runtimeAdapterId="native"
      toolsUsed="NIL"
      addAgentDefinition={vi.fn()}
      addExistingAgentDefinition={vi.fn()}
      addTaskDefinition={vi.fn()}
      moveTaskDefinition={vi.fn()}
      removeAgentDefinition={vi.fn()}
      removeTaskDefinition={vi.fn()}
      onSelectTask={vi.fn()}
      setEntrypoint={vi.fn()}
      updateAgentDefinition={updateAgentDefinition}
      updateTaskDefinition={vi.fn()}
      {...overrides}
    />
  );

  return { updateAgentDefinition };
}

describe('WorkflowBuilderPanel', () => {
  it('edits agent model profile from builder mode', () => {
    const { updateAgentDefinition } = renderBuilder();

    fireEvent.change(screen.getByLabelText('Model profile'), {
      target: { value: 'profile-1' },
    });

    expect(updateAgentDefinition).toHaveBeenCalledWith(0, {
      model_profile_id: 'profile-1',
    });
  });

  it('preserves unknown selected profile options while editing', () => {
    const legacyAgent: AgentDefinition = {
      ...agent,
      model_profile_id: 'legacy-profile',
    };

    renderBuilder({
      visibleAgentDefinitions: [legacyAgent],
    });

    expect(screen.getByLabelText('Model profile')).toHaveValue('legacy-profile');
    expect(screen.getAllByText('legacy-profile').length).toBeGreaterThan(0);
  });

  it('fills an agent from the selected persona source', () => {
    const { updateAgentDefinition } = renderBuilder({
      visibleAgentDefinitions: [
        {
          ...agent,
          id: 'draft-agent-1',
          name: 'Draft Agent',
          role: '',
          instructions: '',
        },
      ],
      personaAgentDefinitions: [
        {
          ...agent,
          id: 'persona-agent-1',
          name: 'Mentor Persona Agent',
          description: 'Persona agent',
          instructions: 'Bring persona context.',
          role: 'mentor',
          model_profile_id: 'profile-1',
          tool_ids: ['tool-1'],
          metadata: {
            generated_from_persona_factory: true,
            persona_slug: 'mentor',
            persona_version_id: 'persona-version-1',
          },
        },
      ],
    });

    fireEvent.change(screen.getByLabelText('Persona source'), {
      target: { value: 'persona-agent-1' },
    });

    expect(updateAgentDefinition).toHaveBeenCalledWith(
      0,
      expect.objectContaining({
        id: 'draft-agent-1',
        name: 'Mentor Persona Agent',
        description: 'Persona agent',
        instructions: 'Bring persona context.',
        role: 'mentor',
        model_profile_id: 'profile-1',
        tool_ids: ['tool-1'],
        metadata: expect.objectContaining({
          generated_from_persona_factory: true,
          persona_slug: 'mentor',
          persona_source_agent_id: 'persona-agent-1',
        }),
      })
    );
  });

  it('uses warning cues for tasks without an assigned agent', () => {
    renderBuilder({
      visibleTaskDefinitions: [
        {
          ...task,
          agent_id: null,
        },
      ],
    });

    expect(screen.getAllByRole('button', { name: 'Select task Draft outline' })[0]).toHaveClass(
      'border-warning-200'
    );
    expect(screen.getByText('Agent: Unassigned')).toHaveClass('border-warning-200');
  });

  it('surfaces recommended tools for selected workflow capabilities', () => {
    renderBuilder({
      workflowCapabilityTags: ['home-control'],
      toolDefinitions: [speechTool, homeTool, canonicalDeviceTool],
    });

    expect(screen.getByText('Recommended for this workflow')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agency Device Command' })).toBeInTheDocument();
    expect(screen.getByText('Other workflow tools')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Home Assistant Turn on' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Smart Home Task' })).toBeInTheDocument();
  });
});
