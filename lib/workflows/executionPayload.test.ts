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

  it('omits read-only operator payloads from execution workflow definitions', () => {
    const workflow: WorkflowDefinition = {
      id: 'workflow-1',
      name: 'Workflow One',
      agent_definitions: [],
      task_definitions: [],
      metadata: {},
      monitoring: {
        enabled: true,
        level: 'standard',
        exempted: false,
        reason: null,
        visible_to_main_agent: true,
        mutable_by_main_agent: true,
        default_enabled: true,
        is_main_agent_default_workflow: false,
        status_label: 'standard_monitoring',
        controls: {
          enabled: true,
          level: 'standard',
          store_run_summaries: false,
          store_failure_summaries: false,
          allow_improvement_proposals: false,
          allow_evaluation_agent_review: false,
          allow_self_monitoring: false,
          safe_to_summarize: false,
          route_improvement_proposals_to_approval: false,
          approval_conversation_id: null,
        },
      },
      runtime_governance: {
        workflow_id: 'workflow-1',
        token_budget: {
          configured: true,
          run_total_tokens: 100000,
          workflow_total_tokens: null,
          agent_total_tokens: null,
          warn_ratio: 0.8,
          hard_ratio: 1,
          action: 'compact_context',
        },
        context_compaction: {
          enabled: true,
          persist_context_pack: false,
          persist_context_pack_source: 'workflow',
          preserve_recent_messages: 3,
          oversized_message_tokens: 600,
          min_estimated_tokens_saved: 50,
          max_summary_chars: 5000,
        },
      },
    };

    const executionWorkflow = buildExecutionWorkflowDefinition(workflow);

    expect(executionWorkflow).not.toHaveProperty('monitoring');
    expect(executionWorkflow).not.toHaveProperty('runtime_governance');
  });
});
