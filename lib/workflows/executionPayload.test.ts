import { describe, expect, it } from 'vitest';
import {
  buildExecutionWorkflowDefinition,
  normalizeWorkflowAgentDefinition,
} from '@/lib/workflows/executionPayload';
import type { WorkflowDefinition } from '@/types/workflows';

describe('execution payload workflow normalization', () => {
  it('backfills required agent role and instructions from legacy fields', () => {
    const workflow: WorkflowDefinition = {
      id: 'workflow-1',
      name: 'Workflow One',
      description: 'Workflow description',
      agent_definitions: [
        {
          id: 'workflow-1-agent-repo-reviewer',
          name: 'Repo Reviewer',
          description: 'Review repository changes and identify risks.',
          instructions: null,
          system_prompt: 'Senior repository reviewer',
          role: null,
        },
      ],
      task_definitions: [],
      metadata: {},
    };

    const executionWorkflow = buildExecutionWorkflowDefinition(workflow);

    expect(executionWorkflow.agent_definitions?.[0]).toMatchObject({
      role: 'Senior repository reviewer',
      instructions: 'Review repository changes and identify risks.',
      system_prompt: 'Senior repository reviewer',
    });
  });

  it('uses the agent name as role when system prompt duplicates instructions', () => {
    expect(
      normalizeWorkflowAgentDefinition({
        id: 'workflow-1-agent-repo-reviewer',
        name: 'Agency Repo Improvement Reviewer',
        description: 'Reviews the Agency repository and proposes one concrete improvement.',
        instructions: 'Review the Agency repository with a pragmatic engineering lens.',
        system_prompt: 'Review the Agency repository with a pragmatic engineering lens.',
        role: null,
      })
    ).toMatchObject({
      role: 'Agency Repo Improvement Reviewer',
      instructions: 'Review the Agency repository with a pragmatic engineering lens.',
    });
  });

  it('uses deterministic fallbacks when an agent has no legacy prompt fields', () => {
    expect(
      normalizeWorkflowAgentDefinition({
        id: 'agent-1',
        name: 'Agent One',
      })
    ).toMatchObject({
      name: 'Agent One',
      role: 'Agent One',
      instructions: 'Complete assigned workflow tasks as Agent One.',
      system_prompt: 'Agent One',
    });
  });
});
