import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useWorkflowEditorDraft } from '@/components/workflow/useWorkflowEditorDraft';
import type { AgentDefinition } from '@/types/agents';
import type { WorkflowDefinition } from '@/types/workflows';

const workflowFixture: WorkflowDefinition = {
  id: 'workflow-1',
  name: 'Edge Validation Workflow',
  description: 'Workflow for testing edge validation',
  entrypoint: 'node-task-a',
  default_runtime_adapter_id: 'adapter-a',
  allowed_runtime_adapter_ids: ['adapter-a'],
  agent_definitions: [
    {
      id: 'agent-1',
      name: 'Agent One',
      description: 'Primary agent',
      instructions: 'Do the work',
      system_prompt: '',
      role: 'operator',
      backstory: '',
      model_profile_id: null,
      tool_ids: [],
      handoff_agent_ids: [],
      metadata: {},
    },
  ],
  task_definitions: [
    {
      id: 'task-a',
      name: 'Task A',
      description: 'First task',
      instructions: 'Start here',
      expected_output: 'Started',
      agent_id: 'agent-1',
      tool_ids: [],
      depends_on_task_ids: [],
      human_approval_required: false,
    },
    {
      id: 'task-b',
      name: 'Task B',
      description: 'Second task',
      instructions: 'Continue here',
      expected_output: 'Continued',
      agent_id: 'agent-1',
      tool_ids: [],
      depends_on_task_ids: ['task-a'],
      human_approval_required: false,
    },
  ],
  nodes: [
    { id: 'node-task-a', name: 'Task A', node_type: 'task', task_id: 'task-a', metadata: {} },
    { id: 'node-task-b', name: 'Task B', node_type: 'task', task_id: 'task-b', metadata: {} },
  ],
  edges: [
    {
      id: 'edge-a-b',
      source_node_id: 'node-task-a',
      target_node_id: 'node-task-b',
      edge_type: 'default',
      condition: null,
      metadata: {},
    },
  ],
  tool_definitions: [],
  versioning: {
    version: '1.0.0',
    revision: 1,
    is_published: false,
  },
  metadata: {},
};

describe('useWorkflowEditorDraft', () => {
  it('adds the default runtime adapter to the allowed adapter draft when the backend data is inconsistent', () => {
    const { result } = renderHook(() =>
      useWorkflowEditorDraft({
        workflow: {
          ...workflowFixture,
          default_runtime_adapter_id: 'adapter-a',
          allowed_runtime_adapter_ids: [],
        },
        workflowId: workflowFixture.id,
      })
    );

    act(() => {
      result.current.actions.startEditing();
    });

    expect(result.current.state.defaultRuntimeAdapterId).toBe('adapter-a');
    expect(result.current.state.allowedRuntimeAdapterIds).toEqual(['adapter-a']);
    expect(result.current.derived.draftValidationIssues).not.toContain(
      'The default runtime adapter must also be allowed for this workflow.'
    );
    expect(result.current.derived.hasUnsavedChanges).toBe(true);
  });

  it('flags invalid edge metadata JSON and missing conditional edge conditions', () => {
    const { result } = renderHook(() =>
      useWorkflowEditorDraft({
        workflow: workflowFixture,
        workflowId: workflowFixture.id,
      })
    );

    act(() => {
      result.current.actions.startEditing();
    });

    act(() => {
      result.current.actions.updateEdgeMetadata('task-a', 'task-b', {
        edgeType: 'conditional',
        condition: '',
        metadataJson: '{"priority":',
      });
    });

    expect(result.current.derived.invalidEdgeConditionByTaskPair['task-a->task-b']).toBe(
      'is required when edge type is conditional.'
    );
    expect(result.current.derived.invalidEdgeMetadataByTaskPair['task-a->task-b']).toBe(
      'must be valid JSON.'
    );
    expect(result.current.derived.draftValidationIssues).toEqual(
      expect.arrayContaining([
        'Edge condition for "Task A" -> "Task B" is required when edge type is conditional.',
        'Edge metadata for "Task A" -> "Task B" must be valid JSON.',
      ])
    );
  });

  it('preserves edge type, condition, and metadata in the derived workflow preview', () => {
    const { result } = renderHook(() =>
      useWorkflowEditorDraft({
        workflow: workflowFixture,
        workflowId: workflowFixture.id,
      })
    );

    act(() => {
      result.current.actions.startEditing();
      result.current.actions.updateEdgeMetadata('task-a', 'task-b', {
        edgeType: 'success',
        condition: 'taskA.completed === true',
        metadataJson: JSON.stringify({ priority: 'high', retries: 2 }, null, 2),
      });
    });

    const previewEdge = result.current.derived.workflowPreview?.edges?.find(
      (edge) => edge.source_node_id === 'node-task-a' && edge.target_node_id === 'node-task-b'
    );

    expect(previewEdge).toMatchObject({
      edge_type: 'success',
      condition: 'taskA.completed === true',
      metadata: {
        priority: 'high',
        retries: 2,
      },
    });
  });

  it('tracks restart active runs as a saved workflow metadata setting', () => {
    const { result } = renderHook(() =>
      useWorkflowEditorDraft({
        workflow: {
          ...workflowFixture,
          metadata: {
            restart_active_executions: true,
          },
        },
        workflowId: workflowFixture.id,
      })
    );

    act(() => {
      result.current.actions.startEditing();
    });

    expect(result.current.state.restartActiveExecutions).toBe(true);

    act(() => {
      result.current.actions.setRestartActiveExecutions(false);
    });

    expect(result.current.derived.hasUnsavedChanges).toBe(true);
    expect(result.current.derived.workflowPreview?.metadata).toMatchObject({
      restart_active_executions: false,
    });
  });

  it('keeps metadata changes applied from graph workflow edits in the preview', () => {
    const { result } = renderHook(() =>
      useWorkflowEditorDraft({
        workflow: workflowFixture,
        workflowId: workflowFixture.id,
      })
    );

    act(() => {
      result.current.actions.startEditing();
    });

    act(() => {
      result.current.actions.applyWorkflowDefinition({
        ...workflowFixture,
        metadata: {
          ...(workflowFixture.metadata ?? {}),
          workflow_graph_tool_nodes: [
            {
              id: 'tools-test',
              toolIds: [],
              agentId: null,
            },
          ],
        },
      });
    });

    expect(result.current.derived.hasUnsavedChanges).toBe(true);
    expect(result.current.derived.workflowPreview?.metadata).toMatchObject({
      workflow_graph_tool_nodes: [
        {
          id: 'tools-test',
          toolIds: [],
          agentId: null,
        },
      ],
    });
  });

  it('adds an existing catalog agent to the workflow draft without duplicating it', () => {
    const catalogAgent: AgentDefinition = {
      id: 'agent-catalog-1',
      name: 'Catalog Agent',
      description: 'Reusable agent',
      instructions: 'Use catalog instructions',
      system_prompt: 'catalog role',
      role: 'researcher',
      backstory: '',
      model_profile_id: 'profile-1',
      tool_ids: ['tool-1'],
      handoff_agent_ids: ['agent-1'],
      metadata: { source: 'catalog' },
    };
    const { result } = renderHook(() =>
      useWorkflowEditorDraft({
        workflow: workflowFixture,
        workflowId: workflowFixture.id,
      })
    );

    act(() => {
      result.current.actions.startEditing();
      result.current.actions.addExistingAgentDefinition(catalogAgent);
      result.current.actions.addExistingAgentDefinition(catalogAgent);
    });

    const matchingAgents = result.current.state.agentDefinitions.filter(
      (agent) => agent.id === catalogAgent.id
    );
    expect(matchingAgents).toHaveLength(1);
    expect(matchingAgents[0]).toMatchObject({
      name: 'Catalog Agent',
      tool_ids: ['tool-1'],
      handoff_agent_ids: ['agent-1'],
      metadata: {
        source: 'catalog',
        added_from_agent_catalog: true,
      },
    });
  });

  it('applies workflow definitions from graph edits to the active draft', () => {
    const { result } = renderHook(() =>
      useWorkflowEditorDraft({
        workflow: workflowFixture,
        workflowId: workflowFixture.id,
      })
    );

    act(() => {
      result.current.actions.startEditing();
      result.current.actions.applyWorkflowDefinition({
        ...workflowFixture,
        task_definitions: [
          workflowFixture.task_definitions?.[0] as NonNullable<
            WorkflowDefinition['task_definitions']
          >[number],
          {
            ...(workflowFixture.task_definitions?.[1] as NonNullable<
              WorkflowDefinition['task_definitions']
            >[number]),
            name: 'Graph Updated Task',
            agent_id: null,
            depends_on_task_ids: [],
          },
        ],
        nodes: [
          workflowFixture.nodes?.[0] as NonNullable<WorkflowDefinition['nodes']>[number],
          {
            ...(workflowFixture.nodes?.[1] as NonNullable<WorkflowDefinition['nodes']>[number]),
            metadata: {
              position: { x: 360, y: 240 },
            },
          },
        ],
        edges: [],
      });
    });

    expect(result.current.state.taskDefinitions[1]).toMatchObject({
      name: 'Graph Updated Task',
      agent_id: null,
      depends_on_task_ids: [],
    });
    expect(
      result.current.derived.workflowPreview?.nodes?.find((node) => node.task_id === 'task-b')
        ?.metadata?.position
    ).toEqual({ x: 360, y: 240 });
    expect(result.current.derived.hasUnsavedChanges).toBe(true);
  });

  it('keeps the structured builder draft editable after graph edits', () => {
    const { result } = renderHook(() =>
      useWorkflowEditorDraft({
        workflow: workflowFixture,
        workflowId: workflowFixture.id,
      })
    );

    act(() => {
      result.current.actions.startEditing();
      result.current.actions.applyWorkflowDefinition({
        ...workflowFixture,
        task_definitions: [
          workflowFixture.task_definitions?.[0] as NonNullable<
            WorkflowDefinition['task_definitions']
          >[number],
          {
            ...(workflowFixture.task_definitions?.[1] as NonNullable<
              WorkflowDefinition['task_definitions']
            >[number]),
            name: 'Graph Updated Task',
          },
        ],
      });
    });

    act(() => {
      result.current.actions.updateTaskDefinition(1, {
        description: 'Structured builder still edits the graph-updated draft.',
      });
    });

    expect(result.current.state.taskDefinitions[1]).toMatchObject({
      name: 'Graph Updated Task',
      description: 'Structured builder still edits the graph-updated draft.',
    });
    expect(result.current.derived.workflowPreview?.task_definitions?.[1]).toMatchObject({
      name: 'Graph Updated Task',
      description: 'Structured builder still edits the graph-updated draft.',
    });
  });

  it('creates capability-aware starter tasks from workflow metadata tags', () => {
    const { result } = renderHook(() =>
      useWorkflowEditorDraft({
        workflow: {
          ...workflowFixture,
          metadata: {
            workflow_capability_tags: ['home-control'],
          },
        },
        workflowId: workflowFixture.id,
      })
    );

    act(() => {
      result.current.actions.startEditing();
      result.current.actions.addTaskDefinition();
    });

    const createdTask = result.current.state.taskDefinitions.at(-1);
    expect(createdTask).toMatchObject({
      name: 'Smart Home control task 3',
      description: expect.stringContaining('through Smart Home'),
      expected_output: 'Structured smart-home status or safe action result',
    });
  });
});
