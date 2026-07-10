import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WorkflowTaskFocusPanel from '@/components/workflow/WorkflowTaskFocusPanel';
import type { TaskDefinition } from '@/types/workflows';

const selectedTask: TaskDefinition = {
  id: 'task-1',
  name: 'Research',
  description: 'Research the topic.',
  instructions: 'Find evidence.',
  expected_output: 'Evidence summary',
  agent_id: null,
  tool_ids: [],
  memory_ids: [],
  depends_on_task_ids: [],
  human_approval_required: false,
  metadata: {},
};

function renderPanel(task: TaskDefinition = selectedTask, onUpdateTask = vi.fn()) {
  render(
    <WorkflowTaskFocusPanel
      selectedTask={task}
      selectedAgent={null}
      modelProfiles={[{ id: 'profile-1', name: 'Balanced profile' }]}
      visibleAgentDefinitions={[]}
      toolDefinitions={[]}
      memoryDefinitions={[]}
      dependencyLinks={[]}
      dependentLinks={[]}
      isEditing
      onClearSelection={vi.fn()}
      onUpdateTask={onUpdateTask}
      onDependencyEdgeTypeChange={vi.fn()}
      onDependencyConditionChange={vi.fn()}
      onDependencyMetadataChange={vi.fn()}
      onDependentEdgeTypeChange={vi.fn()}
      onDependentConditionChange={vi.fn()}
      onDependentMetadataChange={vi.fn()}
      onSelectDependencyTask={vi.fn()}
      onSelectDependentTask={vi.fn()}
      onSelectPreviousTask={vi.fn()}
      onSelectNextTask={vi.fn()}
    />
  );
}

describe('WorkflowTaskFocusPanel', () => {
  it('updates structured task input source metadata', () => {
    const onUpdateTask = vi.fn();

    renderPanel(selectedTask, onUpdateTask);

    fireEvent.click(screen.getByRole('checkbox', { name: /Memory/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Human input/ }));

    expect(onUpdateTask).toHaveBeenNthCalledWith(1, {
      metadata: {
        task_input_sources: ['memory'],
      },
    });
    expect(onUpdateTask).toHaveBeenNthCalledWith(2, {
      metadata: {
        task_input_sources: ['human_input'],
      },
    });
  });

  it('shows declared task input sources outside edit mode', () => {
    render(
      <WorkflowTaskFocusPanel
        selectedTask={{
          ...selectedTask,
          metadata: {
            task_input_sources: ['previous_task_output', 'uploaded_documents'],
          },
        }}
        selectedAgent={null}
        dependencyLinks={[]}
        dependentLinks={[]}
        isEditing={false}
        onClearSelection={vi.fn()}
        onDependencyEdgeTypeChange={vi.fn()}
        onDependencyConditionChange={vi.fn()}
        onDependencyMetadataChange={vi.fn()}
        onDependentEdgeTypeChange={vi.fn()}
        onDependentConditionChange={vi.fn()}
        onDependentMetadataChange={vi.fn()}
        onSelectDependencyTask={vi.fn()}
        onSelectDependentTask={vi.fn()}
        onSelectPreviousTask={vi.fn()}
        onSelectNextTask={vi.fn()}
      />
    );

    expect(screen.getByText('Previous task output')).toBeInTheDocument();
    expect(screen.getByText('Uploaded documents')).toBeInTheDocument();
  });

  it('updates promoted task runtime override fields', () => {
    const onUpdateTask = vi.fn();

    renderPanel(selectedTask, onUpdateTask);

    fireEvent.change(screen.getByLabelText('Timeout seconds'), { target: { value: '90' } });
    fireEvent.change(screen.getByLabelText('Approval policy override'), {
      target: { value: 'required' },
    });

    expect(onUpdateTask).toHaveBeenNthCalledWith(1, {
      timeout_seconds: 90,
      max_retries: null,
      model_profile_id: null,
      max_tokens: null,
      approval_policy: null,
      metadata: undefined,
    });
    expect(onUpdateTask).toHaveBeenNthCalledWith(2, {
      human_approval_required: true,
      timeout_seconds: null,
      max_retries: null,
      model_profile_id: null,
      max_tokens: null,
      approval_policy: 'required',
      metadata: undefined,
    });
  });

  it('shows legacy task runtime override metadata outside edit mode', () => {
    render(
      <WorkflowTaskFocusPanel
        selectedTask={{
          ...selectedTask,
          metadata: {
            task_runtime_overrides: {
              timeout_seconds: 120,
              max_retries: 0,
              model_profile_id: 'profile-1',
              max_tokens: 4096,
              approval_policy: 'none',
            },
          },
        }}
        selectedAgent={null}
        modelProfiles={[{ id: 'profile-1', name: 'Balanced profile' }]}
        dependencyLinks={[]}
        dependentLinks={[]}
        isEditing={false}
        onClearSelection={vi.fn()}
        onDependencyEdgeTypeChange={vi.fn()}
        onDependencyConditionChange={vi.fn()}
        onDependencyMetadataChange={vi.fn()}
        onDependentEdgeTypeChange={vi.fn()}
        onDependentConditionChange={vi.fn()}
        onDependentMetadataChange={vi.fn()}
        onSelectDependencyTask={vi.fn()}
        onSelectDependentTask={vi.fn()}
        onSelectPreviousTask={vi.fn()}
        onSelectNextTask={vi.fn()}
      />
    );

    expect(screen.getByText('Timeout 120s')).toBeInTheDocument();
    expect(screen.getByText('Retries 0')).toBeInTheDocument();
    expect(screen.getByText('Model Balanced profile')).toBeInTheDocument();
    expect(screen.getByText('Max tokens 4096')).toBeInTheDocument();
    expect(screen.getByText('Approval No approval')).toBeInTheDocument();
  });
});
