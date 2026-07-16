import { describe, expect, it } from 'vitest';
import { assessWorkflowReadiness } from '@/components/workflow/WorkflowReadinessPanel';
import type { WorkflowDefinition } from '@/types/workflows';

const readyWorkflow: WorkflowDefinition = {
  id: 'workflow-ready',
  name: 'Ready workflow',
  description: 'Processes a clear test task.',
  entrypoint: 'task-1',
  default_runtime_adapter_id: 'native',
  allowed_runtime_adapter_ids: ['native'],
  agent_definitions: [{ id: 'agent-1', name: 'Agent one' }],
  task_definitions: [
    {
      id: 'task-1',
      name: 'Task one',
      description: 'Do the work.',
      agent_id: 'agent-1',
    },
  ],
};

function assess(overrides: Partial<Parameters<typeof assessWorkflowReadiness>[0]> = {}) {
  return assessWorkflowReadiness({
    workflow: readyWorkflow,
    visibleTaskDefinitions: readyWorkflow.task_definitions ?? [],
    effectiveEntrypointTaskId: 'task-1',
    isEditing: false,
    hasUnsavedChanges: false,
    draftValidationIssues: [],
    backendValidationErrors: [],
    backendValidationWarnings: [],
    ...overrides,
  });
}

describe('assessWorkflowReadiness', () => {
  it('reports a complete workflow as ready', () => {
    const assessment = assess();

    expect(assessment.status).toBe('ready');
    expect(assessment.blockerCount).toBe(0);
    expect(assessment.checks.every((item) => item.status === 'ready')).toBe(true);
  });

  it('blocks workflows with no executable task or runtime', () => {
    const assessment = assess({
      workflow: {
        ...readyWorkflow,
        task_definitions: [],
        default_runtime_adapter_id: null,
      },
      visibleTaskDefinitions: [],
      effectiveEntrypointTaskId: '',
    });

    expect(assessment.status).toBe('blocked');
    expect(assessment.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'execution-path', status: 'blocked' }),
        expect.objectContaining({ id: 'runtime', status: 'blocked' }),
      ])
    );
  });

  it('identifies unassigned tasks and invalid agent references', () => {
    const tasks = [
      { id: 'task-1', name: 'One', description: 'One', agent_id: null },
      { id: 'task-2', name: 'Two', description: 'Two', agent_id: 'missing-agent' },
    ];
    const assessment = assess({
      workflow: { ...readyWorkflow, task_definitions: tasks },
      visibleTaskDefinitions: tasks,
    });

    expect(assessment.checks.find((item) => item.id === 'agents')).toMatchObject({
      status: 'blocked',
      description: '1 unassigned and 1 invalid agent reference.',
    });
  });

  it('keeps unsaved drafts and backend warnings non-blocking', () => {
    const assessment = assess({
      isEditing: true,
      hasUnsavedChanges: true,
      backendValidationWarnings: ['Model fallback is not configured.'],
    });

    expect(assessment.status).toBe('attention');
    expect(assessment.blockerCount).toBe(0);
    expect(assessment.attentionCount).toBe(2);
  });
});
