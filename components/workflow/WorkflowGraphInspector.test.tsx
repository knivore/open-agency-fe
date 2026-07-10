import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import WorkflowGraphInspector from '@/components/workflow/WorkflowGraphInspector';
import {
  workflowGraphEdgeTypes,
  workflowGraphNodeTypes,
} from '@/lib/workflows/workflowGraphAdapter';
import type { GraphDocument, GraphEdge, GraphNode } from '@/modules/react-flow-graph/types';

const agentNode: GraphNode = {
  id: 'workflow-agent-agent-1',
  type: workflowGraphNodeTypes.agent,
  label: 'Researcher',
  data: {
    agentId: 'agent-1',
    instructions: 'Find reliable evidence.',
    role: 'Research',
    toolIds: ['tool-1'],
  },
};

const taskNode: GraphNode = {
  id: 'workflow-task-task-1',
  type: workflowGraphNodeTypes.task,
  label: 'Search',
  description: 'Search for evidence.',
  data: {
    taskId: 'task-1',
    agentId: null,
    instructions: 'Find evidence.',
    expectedOutput: 'Evidence list.',
    toolIds: [],
    humanApprovalRequired: false,
  },
};

const dependencyEdge: GraphEdge = {
  id: 'edge-1',
  source: 'workflow-task-task-1',
  target: 'workflow-task-task-2',
  type: workflowGraphEdgeTypes.dependency,
  metadata: {
    reason: 'sequence',
  },
};

const conditionalEdge: GraphEdge = {
  ...dependencyEdge,
  type: workflowGraphEdgeTypes.condition,
  label: '',
};

const document: GraphDocument = {
  schemaVersion: 'graph.document.v1',
  id: 'workflow-1',
  nodes: [agentNode, taskNode],
  edges: [],
};

function renderInspector(overrides: Partial<ComponentProps<typeof WorkflowGraphInspector>>) {
  const props = {
    document,
    readOnly: false,
    onClose: vi.fn(),
    onUpdateDocument: vi.fn(),
    onUpdateNode: vi.fn(),
    onUpdateEdge: vi.fn(),
    ...overrides,
  };

  render(<WorkflowGraphInspector {...props} />);
  return props;
}

describe('WorkflowGraphInspector', () => {
  it('updates editable task fields through graph node changes', () => {
    const props = renderInspector({ node: taskNode });

    fireEvent.change(screen.getByLabelText('Instructions'), {
      target: { value: 'Find primary sources.' },
    });

    expect(props.onUpdateNode).toHaveBeenCalledWith(
      expect.objectContaining({
        id: taskNode.id,
        data: expect.objectContaining({
          instructions: 'Find primary sources.',
        }),
      })
    );
  });

  it('updates task assignment through a graph document change', () => {
    const props = renderInspector({ node: taskNode });

    fireEvent.change(screen.getByLabelText('Assigned agent'), {
      target: { value: 'agent-1' },
    });

    expect(props.onUpdateDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({
            id: taskNode.id,
            data: expect.objectContaining({ agentId: 'agent-1' }),
          }),
        ]),
        edges: expect.arrayContaining([
          expect.objectContaining({
            source: agentNode.id,
            target: taskNode.id,
            type: workflowGraphEdgeTypes.assignment,
          }),
        ]),
      })
    );
  });

  it('updates editable agent fields through graph node changes', () => {
    const props = renderInspector({ node: agentNode });

    fireEvent.change(screen.getByLabelText('Role'), {
      target: { value: 'Synthesize findings' },
    });
    fireEvent.change(screen.getByLabelText('Instructions'), {
      target: { value: 'Prefer primary sources.' },
    });

    expect(props.onUpdateNode).toHaveBeenCalledWith(
      expect.objectContaining({
        id: agentNode.id,
        data: expect.objectContaining({
          role: 'Synthesize findings',
        }),
      })
    );
    expect(props.onUpdateNode).toHaveBeenCalledWith(
      expect.objectContaining({
        id: agentNode.id,
        data: expect.objectContaining({
          instructions: 'Prefer primary sources.',
        }),
      })
    );
  });

  it('updates task-flow edge fields through graph edge changes', () => {
    const props = renderInspector({ edge: dependencyEdge });

    fireEvent.change(screen.getByLabelText('Condition'), {
      target: { value: 'ready' },
    });

    expect(props.onUpdateEdge).toHaveBeenCalledWith(
      expect.objectContaining({
        id: dependencyEdge.id,
        label: 'ready',
      })
    );
  });

  it('updates task-flow edge metadata after valid JSON edits', () => {
    const props = renderInspector({ edge: dependencyEdge });

    fireEvent.change(screen.getByLabelText('Metadata JSON'), {
      target: { value: '{\n  "retries": 2,\n  "priority": "high"\n}' },
    });
    fireEvent.blur(screen.getByLabelText('Metadata JSON'));

    expect(props.onUpdateEdge).toHaveBeenCalledWith(
      expect.objectContaining({
        id: dependencyEdge.id,
        metadata: {
          retries: 2,
          priority: 'high',
        },
      })
    );
  });

  it('shows local workflow validation messages for editable fields', () => {
    renderInspector({
      node: {
        ...taskNode,
        label: '',
        description: '',
      },
    });

    expect(screen.getByText('Each task must have a name.')).toBeInTheDocument();
    expect(screen.getByText('Task "task-1" must have a description.')).toBeInTheDocument();
  });

  it('keeps invalid edge metadata local until it can be parsed', () => {
    const props = renderInspector({ edge: conditionalEdge });

    expect(
      screen.getByText('Condition is required when edge type is conditional.')
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Metadata JSON'), {
      target: { value: '{invalid' },
    });
    fireEvent.blur(screen.getByLabelText('Metadata JSON'));

    expect(screen.getByText('Metadata must be valid JSON.')).toBeInTheDocument();
    expect(props.onUpdateEdge).not.toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.any(Object),
      })
    );
  });
});
