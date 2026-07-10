import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GraphCanvas from './GraphCanvas';
import type { GraphDocument } from './types';

const { mockFitView, mockReactFlowProps } = vi.hoisted(() => ({
  mockFitView: vi.fn(),
  mockReactFlowProps: vi.fn(),
}));

vi.mock('@xyflow/react', async () => {
  const React = await import('react');

  return {
    Background: () => null,
    BaseEdge: () => null,
    ConnectionMode: {
      Loose: 'loose',
      Strict: 'strict',
    },
    Controls: () => null,
    EdgeLabelRenderer: ({ children }: { children: ReactNode }) => <>{children}</>,
    Handle: () => null,
    MiniMap: () => null,
    Position: {
      Bottom: 'bottom',
      Left: 'left',
      Right: 'right',
      Top: 'top',
    },
    ReactFlow: ({
      children,
      onInit,
      fitViewOptions,
    }: {
      children?: ReactNode;
      onInit?: (instance: unknown) => void;
      fitViewOptions?: unknown;
    }) => {
      mockReactFlowProps({ fitViewOptions });
      React.useEffect(() => {
        onInit?.({
          fitView: mockFitView,
          getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
          setCenter: vi.fn(),
          setViewport: vi.fn(),
        });
      }, [onInit]);

      return <div data-testid="react-flow">{children}</div>;
    },
    ReactFlowProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    applyEdgeChanges: (_changes: unknown, edges: unknown[]) => edges,
    applyNodeChanges: (_changes: unknown, nodes: unknown[]) => nodes,
    getBezierPath: () => ['M0,0', 0, 0, 0, 0],
  };
});

const document: GraphDocument = {
  schemaVersion: 'graph.document.v1',
  id: 'graph-1',
  nodes: [
    {
      id: 'node-1',
      type: 'task',
      label: 'Task 1',
      position: { x: 0, y: 0 },
    },
  ],
  edges: [],
};

describe('GraphCanvas', () => {
  beforeEach(() => {
    mockFitView.mockClear();
    mockReactFlowProps.mockClear();
  });

  it('passes supplied fit view options to React Flow', () => {
    render(<GraphCanvas document={document} fitViewOptions={{ padding: 0.12, maxZoom: 0.95 }} />);

    expect(mockReactFlowProps).toHaveBeenCalledWith({
      fitViewOptions: { padding: 0.12, maxZoom: 0.95 },
    });
  });

  it('keeps runtime timeline wheel gestures out of the graph viewport', () => {
    render(
      <GraphCanvas
        document={document}
        runtimeEvents={[
          {
            id: 'event-1',
            type: 'task.started',
            timestamp: '2026-01-01T00:00:00.000Z',
            nodeId: 'node-1',
            status: 'running',
          },
        ]}
      />
    );

    const timeline = screen.getByLabelText('Graph runtime timeline');

    // XYFlow consumes wheel and drag gestures unless overlay chrome opts out.
    // The runtime event list must scroll on hover without first focusing the panel.
    expect(timeline).toHaveClass('nowheel');
    expect(timeline).toHaveClass('nopan');
    expect(timeline).toHaveClass('h-[calc(100%-8rem)]');
  });

  it('renders a runtime run details link in the timeline header', () => {
    render(
      <GraphCanvas
        document={document}
        runtimeEvents={[
          {
            id: 'event-1',
            type: 'run.running',
            timestamp: '2026-01-01T00:00:00.000Z',
            graphId: 'workflow-1',
            payload: {
              runId: 'run-1',
            },
            status: 'running',
          },
        ]}
        getRuntimeEventRunHref={(event) =>
          typeof event.payload?.runId === 'string'
            ? `/runs/${event.payload.runId}?workflowId=${event.graphId}&tab=runs`
            : null
        }
      />
    );

    expect(screen.getByRole('link', { name: 'View run details' })).toHaveAttribute(
      'href',
      '/runs/run-1?workflowId=workflow-1&tab=runs'
    );
  });

  it('focuses the viewport on the current runtime event target during playback', async () => {
    vi.useFakeTimers();

    try {
      render(
        <GraphCanvas
          document={document}
          runtimeEvents={[
            {
              id: 'event-1',
              type: 'task.started',
              timestamp: '2026-01-01T00:00:00.000Z',
              nodeId: 'node-1',
              status: 'running',
            },
            {
              id: 'event-2',
              type: 'task.completed',
              timestamp: '2026-01-01T00:00:01.000Z',
              nodeId: 'node-1',
              status: 'completed',
            },
          ]}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Play runtime replay' }));

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(mockFitView).toHaveBeenCalledWith({
        nodes: [{ id: 'node-1' }],
        padding: 0.55,
        duration: 320,
        maxZoom: 1.25,
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
