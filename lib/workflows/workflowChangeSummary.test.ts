import { describe, expect, it } from 'vitest';
import { createWorkflowChangeSummary } from '@/lib/workflows/workflowChangeSummary';
import type { WorkflowDefinition } from '@/types/workflows';

const baseWorkflow: WorkflowDefinition = {
  id: 'workflow-1',
  name: 'Workflow One',
  description: 'Original workflow.',
  entrypoint: 'node-task-1',
  default_runtime_adapter_id: 'adapter-a',
  allowed_runtime_adapter_ids: ['adapter-a'],
  agent_definitions: [
    {
      id: 'agent-1',
      name: 'Agent One',
      description: 'Agent',
      instructions: 'Do work',
      system_prompt: '',
      role: 'operator',
      backstory: '',
      model_profile_id: null,
      tool_ids: ['tool-1'],
      handoff_agent_ids: [],
      metadata: {},
    },
  ],
  task_definitions: [
    {
      id: 'task-1',
      name: 'Task One',
      description: 'Do the first task.',
      instructions: 'Start here.',
      expected_output: 'Result',
      agent_id: 'agent-1',
      tool_ids: ['tool-1'],
      depends_on_task_ids: [],
      human_approval_required: false,
    },
  ],
  tool_definitions: [
    {
      id: 'tool-1',
      name: 'Tool One',
      description: 'Useful tool.',
    },
  ],
  memory_definitions: [
    {
      id: 'memory-1',
      name: 'Memory One',
      description: 'Context',
      memory_type: 'shared',
    },
  ],
  nodes: [
    { id: 'node-task-1', name: 'Task One', node_type: 'task', task_id: 'task-1', metadata: {} },
  ],
  edges: [],
  metadata: {
    execution_host: 'native',
    restart_active_executions: false,
  },
  versioning: {
    version: '1.0.0',
    revision: 1,
    is_published: false,
  },
};

describe('createWorkflowChangeSummary', () => {
  it('returns no groups when the draft matches the baseline', () => {
    const summary = createWorkflowChangeSummary(baseWorkflow, structuredClone(baseWorkflow));

    expect(summary.hasChanges).toBe(false);
    expect(summary.totalChanges).toBe(0);
    expect(summary.groups).toEqual([]);
  });

  it('summarizes changed workflow, task, and agent fields', () => {
    const summary = createWorkflowChangeSummary(baseWorkflow, {
      ...baseWorkflow,
      name: 'Workflow Two',
      agent_definitions: [
        {
          ...(baseWorkflow.agent_definitions?.[0] as NonNullable<
            WorkflowDefinition['agent_definitions']
          >[number]),
          role: 'reviewer',
        },
      ],
      task_definitions: [
        {
          ...(baseWorkflow.task_definitions?.[0] as NonNullable<
            WorkflowDefinition['task_definitions']
          >[number]),
          name: 'Task One Revised',
          human_approval_required: true,
        },
      ],
    });

    expect(summary.totalChanged).toBe(3);
    expect(summary.groups.map((group) => group.id)).toEqual(['workflow', 'tasks', 'agents']);
    expect(summary.groups.flatMap((group) => group.details)).toEqual([
      'Changed workflow setting "Workflow Two".',
      'Changed task "Task One Revised".',
      'Changed agent "Agent One".',
    ]);
  });

  it('summarizes added and removed graph-backed records', () => {
    const summary = createWorkflowChangeSummary(baseWorkflow, {
      ...baseWorkflow,
      task_definitions: [],
      metadata: {
        ...baseWorkflow.metadata,
        workflow_artifact_definitions: [
          {
            id: 'artifact-1',
            name: 'Decision memo',
            artifact_type: 'report',
            producer_task_id: 'task-1',
          },
        ],
      },
      edges: [
        {
          id: 'edge-1',
          source_node_id: 'node-task-1',
          target_node_id: 'node-task-2',
          edge_type: 'default',
          condition: null,
          metadata: {},
        },
      ],
    });

    expect(summary.totalAdded).toBe(2);
    expect(summary.totalRemoved).toBe(1);
    expect(summary.groups.flatMap((group) => group.details)).toContain('Removed task "Task One".');
    expect(summary.groups.flatMap((group) => group.details)).toContain(
      'Added artifact "Decision memo".'
    );
    expect(summary.groups.flatMap((group) => group.details)).toContain('Added edge "edge-1".');
  });
});
