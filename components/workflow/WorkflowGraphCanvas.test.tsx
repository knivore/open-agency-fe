import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import WorkflowGraphCanvas from '@/components/workflow/WorkflowGraphCanvas';
import type {
  GraphDocument,
  GraphRuntimeEvent,
  GraphSelection,
  GraphToolbarAction,
} from '@/modules/react-flow-graph/types';
import type {
  GraphEdgeLabelRendererProps,
  GraphRuntimeEventRendererProps,
  GraphToolbarRendererProps,
} from '@/modules/react-flow-graph/GraphCanvas';
import type { WorkflowDefinition } from '@/types/workflows';

vi.mock('@/modules/react-flow-graph/GraphCanvas', async (importOriginal) => {
  const React = await import('react');
  const actual = await importOriginal<typeof import('@/modules/react-flow-graph/GraphCanvas')>();

  return {
    ...actual,
    default: function MockGraphCanvas({
      document,
      className,
      toolbarActions = [],
      onToolbarAction,
      onGraphChange,
      onSelectionChange,
      onNodeOpen,
      onRemoveNode,
      runtimeEvents,
      renderRuntimeEvent,
      renderEdgeLabel,
      renderToolbar,
      getRuntimeEventRunHref,
      emptyContent,
      validationIssues = [],
      showMiniMap = false,
      focusNodeId = null,
      focusNodeRevision = 0,
    }: {
      document: GraphDocument;
      className?: string;
      toolbarActions?: GraphToolbarAction[];
      runtimeEvents?: GraphRuntimeEvent[];
      emptyContent?: ReactNode;
      validationIssues?: Array<{ id: string; message: string; severity: string }>;
      showMiniMap?: boolean;
      focusNodeId?: string | null;
      focusNodeRevision?: number;
      renderRuntimeEvent?: (props: GraphRuntimeEventRendererProps) => ReactNode;
      renderEdgeLabel?: (props: GraphEdgeLabelRendererProps) => ReactNode;
      renderToolbar?: (props: GraphToolbarRendererProps) => ReactNode;
      getRuntimeEventRunHref?: (event: GraphRuntimeEvent) => string | null;
      onGraphChange?: (document: GraphDocument) => void;
      onSelectionChange?: (selection: GraphSelection) => void;
      onNodeOpen?: (node: GraphDocument['nodes'][number]) => void;
      onRemoveNode?: (
        node: GraphDocument['nodes'][number],
        document: GraphDocument
      ) => GraphDocument | false | void;
      onToolbarAction?: (
        action: GraphToolbarAction,
        document: GraphDocument
      ) => GraphDocument | void;
    }) {
      const [currentDocument, setCurrentDocument] = React.useState(document);
      React.useEffect(() => setCurrentDocument(document), [document]);
      const handleToolbarAction = (action: GraphToolbarAction) => {
        const nextDocument = onToolbarAction?.(action, currentDocument);
        if (nextDocument) {
          setCurrentDocument(nextDocument);
        }
      };

      return (
        <div data-testid="graph-canvas" className={className}>
          <span>Graph nodes: {currentDocument.nodes.length}</span>
          {showMiniMap ? <span>Graph minimap enabled</span> : null}
          {focusNodeId ? (
            <span>
              Focus node: {focusNodeId} rev {focusNodeRevision}
            </span>
          ) : null}
          <span>Graph issue count: {validationIssues.length}</span>
          {validationIssues.map((issue) => (
            <span key={issue.id}>{issue.message}</span>
          ))}
          {currentDocument.nodes.length === 0 ? <div>{emptyContent}</div> : null}
          {currentDocument.nodes.map((node) => (
            <div key={node.id}>
              <span>{node.label}</span>
              <span>
                {node.label} position: {node.position?.x ?? 0}, {node.position?.y ?? 0}
              </span>
              {node.description ? <span>{node.description}</span> : null}
              {Array.isArray(node.data?.toolNames)
                ? node.data.toolNames.map((toolName) =>
                    typeof toolName === 'string' ? <span key={toolName}>{toolName}</span> : null
                  )
                : null}
              {Array.isArray(node.data?.toolCues)
                ? node.data.toolCues.map((toolCue) =>
                    typeof toolCue === 'string' ? <span key={toolCue}>{toolCue}</span> : null
                  )
                : null}
              {typeof node.data?.agentName === 'string' ? (
                <span>Agent owner: {node.data.agentName}</span>
              ) : null}
              {typeof node.data?.dependencyCount === 'number' && node.data.dependencyCount > 0 ? (
                <span>
                  {node.data.dependencyCount}{' '}
                  {node.data.dependencyCount === 1 ? 'dependency' : 'dependencies'}
                </span>
              ) : null}
              {typeof node.data?.downstreamCount === 'number' && node.data.downstreamCount > 0 ? (
                <span>
                  {node.data.downstreamCount}{' '}
                  {node.data.downstreamCount === 1 ? 'next task' : 'next tasks'}
                </span>
              ) : null}
              {Array.isArray(node.data?.memoryIds) && node.data.memoryIds.length > 0 ? (
                <span>Task memories: {node.data.memoryIds.join(', ')}</span>
              ) : null}
              {Array.isArray(node.data?.toolIds) && node.data.toolIds.length > 0 ? (
                <span>Task tools: {node.data.toolIds.join(', ')}</span>
              ) : null}
              {node.data?.humanApprovalRequired === true ? (
                <>
                  <span>Needs approval</span>
                  <span>Approval gate</span>
                  <span>Required before downstream work</span>
                </>
              ) : null}
              {typeof node.data?.toolCount === 'number' ? (
                <span>{node.data.toolCount} tool</span>
              ) : null}
              {typeof node.data?.memoryType === 'string' ? (
                <span>{node.data.memoryType} memory</span>
              ) : null}
              {typeof node.data?.artifactType === 'string' ? (
                <span>{node.data.artifactType} artifact</span>
              ) : null}
              {typeof node.data?.producerTaskName === 'string' ? (
                <span>Produced by: {node.data.producerTaskName}</span>
              ) : null}
              {typeof node.data?.monitoringPolicyLabel === 'string' ? (
                <span>{node.data.monitoringPolicyLabel}</span>
              ) : null}
              {typeof node.data?.pendingSupervisorRequestCount === 'number' ? (
                <span>{node.data.pendingSupervisorRequestCount} steer</span>
              ) : null}
              {typeof node.data?.appliedSupervisorSteeringCount === 'number' ? (
                <span>{node.data.appliedSupervisorSteeringCount} applied</span>
              ) : null}
              {typeof node.data?.governanceTokenLabel === 'string' ? (
                <span>{node.data.governanceTokenLabel} tok</span>
              ) : null}
              {typeof node.data?.governanceContextStatus === 'string' ? (
                <span>ctx {node.data.governanceContextStatus}</span>
              ) : null}
              {typeof node.data?.runtimeFailureCount === 'number' ? (
                <span>
                  {node.data.runtimeFailureCount} failure
                  {node.data.runtimeFailureCount === 1 ? '' : 's'}
                </span>
              ) : null}
              {typeof node.data?.runtimeFailureClusterCount === 'number' ? (
                <span>{node.data.runtimeFailureClusterCount} failure groups</span>
              ) : null}
              {typeof node.data?.runtimeStepCount === 'number' ? (
                <span>
                  {node.data.runtimeStepCount} step
                  {node.data.runtimeStepCount === 1 ? '' : 's'}
                </span>
              ) : null}
              {typeof node.data?.runtimeToolCallCount === 'number' ? (
                <span>
                  {node.data.runtimeToolCallCount} tool call
                  {node.data.runtimeToolCallCount === 1 ? '' : 's'}
                </span>
              ) : null}
              {typeof node.data?.runtimeBlockedToolCount === 'number' ? (
                <span>{node.data.runtimeBlockedToolCount} blocked</span>
              ) : null}
              {typeof node.data?.runtimeMissingCredentialCount === 'number' ? (
                <span>{node.data.runtimeMissingCredentialCount} credential</span>
              ) : null}
              {typeof node.data?.runtimeMemoryContextCount === 'number' ? (
                <span>{node.data.runtimeMemoryContextCount} context</span>
              ) : null}
              {typeof node.data?.runtimeStaleMemoryCount === 'number' ? (
                <span>{node.data.runtimeStaleMemoryCount} stale</span>
              ) : null}
              {typeof node.data?.runtimeMissingMemoryCount === 'number' ? (
                <span>{node.data.runtimeMissingMemoryCount} missing</span>
              ) : null}
              {typeof node.data?.runtimeMemoryAuthCount === 'number' ? (
                <span>{node.data.runtimeMemoryAuthCount} auth</span>
              ) : null}
              {typeof node.data?.runtimeMemoryPermissionCount === 'number' ? (
                <span>{node.data.runtimeMemoryPermissionCount} permission</span>
              ) : null}
              {typeof node.data?.runtimeAverageDurationLabel === 'string' ? (
                <span>avg {node.data.runtimeAverageDurationLabel}</span>
              ) : null}
              {typeof node.data?.runtimeLatestFailureSummary === 'string' ? (
                <span>Latest failure: {node.data.runtimeLatestFailureSummary}</span>
              ) : null}
              {typeof node.data?.runtimeLatestStepSummary === 'string' ? (
                <span>Latest step: {node.data.runtimeLatestStepSummary}</span>
              ) : null}
              {typeof node.data?.runtimeLatestMemoryContextSummary === 'string' ? (
                <span>Retrieved context: {node.data.runtimeLatestMemoryContextSummary}</span>
              ) : null}
              {typeof node.data?.runtimeLatestStaleMemorySummary === 'string' ? (
                <span>Stale memory: {node.data.runtimeLatestStaleMemorySummary}</span>
              ) : null}
              {typeof node.data?.runtimeLatestMissingMemorySummary === 'string' ? (
                <span>Missing memory: {node.data.runtimeLatestMissingMemorySummary}</span>
              ) : null}
              {typeof node.data?.runtimeLatestMemoryAuthSummary === 'string' ? (
                <span>Memory auth: {node.data.runtimeLatestMemoryAuthSummary}</span>
              ) : null}
              {typeof node.data?.runtimeLatestMemoryPermissionSummary === 'string' ? (
                <span>Memory permission: {node.data.runtimeLatestMemoryPermissionSummary}</span>
              ) : null}
              {typeof node.data?.runtimeRepeatedFailureLabel === 'string' ? (
                <span>Repeated failure: {node.data.runtimeRepeatedFailureLabel}</span>
              ) : null}
              {typeof node.data?.runtimeLatestMissingCredentialSummary === 'string' ? (
                <span>Missing credential: {node.data.runtimeLatestMissingCredentialSummary}</span>
              ) : null}
              {typeof node.data?.runtimeLatestBlockedToolSummary === 'string' ? (
                <span>Blocked tool: {node.data.runtimeLatestBlockedToolSummary}</span>
              ) : null}
              {typeof node.data?.taskName === 'string' && node.type === 'workflow.approval' ? (
                <>
                  <span>Approval for</span>
                  <span>{node.data.taskName}</span>
                </>
              ) : null}
              {typeof node.data?.runtimeNodeControlLabel === 'string' ? (
                <span>
                  Node runtime control: {node.label} {node.data.runtimeNodeControlLabel}
                </span>
              ) : null}
              {typeof node.data?.supervisorSteeringActionLabel === 'string' ? (
                <span>
                  Supervisor action: {node.label} {node.data.supervisorSteeringActionLabel}
                </span>
              ) : null}
              <button type="button" onClick={() => onNodeOpen?.(node)}>
                Open {node.label}
              </button>
              <button
                type="button"
                onClick={() => onSelectionChange?.({ nodeIds: [node.id], edgeIds: [] })}
              >
                Select {node.label}
              </button>
              <button
                type="button"
                onClick={() => {
                  const projectedDocument = onRemoveNode?.(node, currentDocument);
                  if (projectedDocument === false) {
                    return;
                  }
                  const nextDocument =
                    projectedDocument && 'nodes' in projectedDocument
                      ? projectedDocument
                      : {
                          ...currentDocument,
                          nodes: currentDocument.nodes.filter(
                            (candidate) => candidate.id !== node.id
                          ),
                          edges: currentDocument.edges.filter(
                            (edge) => edge.source !== node.id && edge.target !== node.id
                          ),
                        };
                  setCurrentDocument(nextDocument);
                  onGraphChange?.(nextDocument);
                }}
              >
                Remove {node.label}
              </button>
            </div>
          ))}
          {currentDocument.edges.map((edge) => (
            <div key={edge.id} data-testid={`graph-edge-${edge.id}`}>
              {renderEdgeLabel?.({
                edge,
                selected: false,
                validationIssues: [],
                onOpen: () => undefined,
              })}
            </div>
          ))}
          {renderToolbar
            ? renderToolbar({ actions: toolbarActions, onAction: handleToolbarAction })
            : toolbarActions.map((action) => (
                <button key={action.id} type="button" onClick={() => handleToolbarAction(action)}>
                  {action.label}
                </button>
              ))}
          {runtimeEvents?.map((event, index) => (
            <div key={event.id}>{renderRuntimeEvent?.({ event, isCurrent: index === 0 })}</div>
          ))}
          {runtimeEvents?.map((event) => {
            const href = getRuntimeEventRunHref?.(event);

            return href ? (
              <a key={`run-link-${event.id}`} href={href} aria-label="View run details">
                View run
              </a>
            ) : null;
          })}
        </div>
      );
    },
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
  },
}));

const workflow: WorkflowDefinition = {
  id: 'workflow-1',
  name: 'Workflow One',
  description: '',
  agent_definitions: [],
  task_definitions: [],
  tool_definitions: [],
  nodes: [],
  edges: [],
};

describe('WorkflowGraphCanvas', () => {
  it('uses a taller default canvas for workflow editing', () => {
    render(<WorkflowGraphCanvas workflow={workflow} />);

    expect(screen.getByTestId('graph-canvas')).toHaveClass('h-[34rem]');
    expect(screen.getByTestId('graph-canvas')).toHaveClass('sm:h-[42rem]');
    expect(screen.getByTestId('graph-canvas')).toHaveClass('lg:h-170');
    expect(screen.getByTestId('graph-canvas')).toHaveClass('lg:min-h-120');
  });

  it('guides users when the workflow graph is empty', () => {
    render(<WorkflowGraphCanvas workflow={workflow} />);

    expect(screen.getByText('Start with a task or agent')).toBeInTheDocument();
    expect(screen.getByText(/Use Add Task or Add Agent/)).toBeInTheDocument();
  });

  it('marks task and agent nodes as steerable when supervisor steering is enabled', () => {
    render(
      <WorkflowGraphCanvas
        workflow={{
          ...workflow,
          agent_definitions: [
            {
              id: 'agent-1',
              name: 'Decision Coach',
              description: 'Guide decisions.',
            },
          ],
          task_definitions: [
            {
              id: 'task-1',
              name: 'Review recommendation',
              description: 'Check the decision.',
              agent_id: 'agent-1',
            },
          ],
        }}
        runtimeControls={{
          canRequestSteering: true,
          onRequestSteering: vi.fn(),
        }}
      />
    );

    expect(screen.getByText('Supervisor action: Review recommendation Steer')).toBeInTheDocument();
    expect(screen.getByText('Supervisor action: Decision Coach Steer')).toBeInTheDocument();
  });

  it('opens approval gates as task selection and artifacts as artifact selection', () => {
    const onSelectTask = vi.fn();
    const onSelectApproval = vi.fn();
    const onSelectArtifact = vi.fn();

    render(
      <WorkflowGraphCanvas
        workflow={{
          ...workflow,
          task_definitions: [
            {
              id: 'task-1',
              name: 'Review recommendation',
              description: 'Check the decision.',
              human_approval_required: true,
            },
          ],
          metadata: {
            workflow_artifact_definitions: [
              {
                id: 'artifact-1',
                name: 'Decision memo',
                artifact_type: 'report',
                producer_task_id: 'task-1',
              },
            ],
          },
        }}
        onSelectTask={onSelectTask}
        onSelectApproval={onSelectApproval}
        onSelectArtifact={onSelectArtifact}
      />
    );

    expect(screen.getByText('Human approval gate for Review recommendation.')).toBeInTheDocument();
    expect(screen.getByText('Approval for')).toBeInTheDocument();
    expect(screen.getAllByText('Review recommendation').length).toBeGreaterThan(0);
    expect(screen.getByText('Approval gate')).toBeInTheDocument();
    expect(screen.getByText('Required before downstream work')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Approval required' }));
    expect(onSelectApproval).toHaveBeenCalledWith('task-1');
    expect(onSelectTask).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Open Decision memo' }));
    expect(onSelectArtifact).toHaveBeenCalledWith('artifact-1');
  });

  it('renders a derived relationship edge from approval gates to their owning task nodes', () => {
    render(
      <WorkflowGraphCanvas
        workflow={{
          ...workflow,
          task_definitions: [
            {
              id: 'task-1',
              name: 'Review recommendation',
              description: 'Check the decision.',
              human_approval_required: true,
            },
          ],
        }}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Open Requires approval connection settings' })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Select Review recommendation' }));

    expect(
      screen.getByRole('button', { name: 'Open Requires approval connection settings' })
    ).toHaveClass('ring-2');
  });

  it('surfaces task order, ownership, tools, memory, approvals, outputs, and runtime state on the graph', () => {
    render(
      <WorkflowGraphCanvas
        includeAgents
        includeTools
        includeMemories
        workflow={{
          ...workflow,
          agent_definitions: [
            {
              id: 'agent-1',
              name: 'Planner Agent',
              role: 'Planning',
              tool_ids: ['tool-1'],
              memory_ids: ['memory-1'],
            },
          ],
          task_definitions: [
            {
              id: 'task-1',
              name: 'Gather context',
              description: 'Collect the relevant context.',
              agent_id: 'agent-1',
            },
            {
              id: 'task-2',
              name: 'Draft plan',
              description: 'Draft the plan.',
              agent_id: 'agent-1',
              tool_ids: ['tool-1'],
              memory_ids: ['memory-1'],
              depends_on_task_ids: ['task-1'],
              human_approval_required: true,
            },
          ],
          tool_definitions: [
            {
              id: 'tool-1',
              name: 'catalog.search',
              display_name: 'Catalog Search',
              description: 'Search the catalog.',
            },
          ],
          memory_definitions: [
            {
              id: 'memory-1',
              name: 'Project memory',
              memory_type: 'workflow',
              scope: 'workflow',
            },
          ],
          metadata: {
            workflow_artifact_definitions: [
              {
                id: 'artifact-1',
                name: 'Plan output',
                artifact_type: 'report',
                producer_task_id: 'task-2',
              },
            ],
          },
        }}
        runtimeEvents={[
          {
            id: 'task-2-failed',
            type: 'task.failed',
            timestamp: '2026-01-01T00:00:00.000Z',
            nodeId: 'workflow-task-task-2',
            status: 'failed',
            payload: {
              runId: 'run-1',
              error: 'Plan draft failed validation.',
            },
          },
        ]}
      />
    );

    expect(screen.getAllByText('Agent owner: Planner Agent').length).toBeGreaterThan(0);
    expect(screen.getByText('1 dependency')).toBeInTheDocument();
    expect(screen.getByText('1 next task')).toBeInTheDocument();
    expect(screen.getAllByText('Task tools: tool-1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Task memories: memory-1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Needs approval').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Approval gate').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Required before downstream work').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Catalog Search').length).toBeGreaterThan(0);
    expect(screen.getAllByText('workflow memory').length).toBeGreaterThan(0);
    expect(screen.getAllByText('report artifact').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Produced by: Draft plan').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Show graph execution timeline' }));

    expect(
      screen.getByText('Latest failure: error: Plan draft failed validation.')
    ).toBeInTheDocument();
  });

  it('hides routine edge labels when the workflow graph is dense', () => {
    const nodes = Array.from({ length: 18 }, (_, index) => ({
      id: `workflow-task-${index + 1}`,
      type: 'workflow.task',
      label: `Task ${index + 1}`,
    }));
    const edges = nodes.slice(1).map((node, index) => ({
      id: `edge-${index + 1}`,
      source: nodes[index].id,
      target: node.id,
      type: 'workflow.dependency',
    }));

    render(
      <WorkflowGraphCanvas
        workflow={workflow}
        document={{
          schemaVersion: '1.0',
          nodes,
          edges,
        }}
      />
    );

    expect(
      screen.queryAllByRole('button', { name: 'Open Dependency connection settings' })
    ).toHaveLength(0);
    expect(screen.queryAllByText('Dep')).toHaveLength(0);
    expect(screen.getAllByText('Dependency')).toHaveLength(1);
    expect(screen.getByText('Graph minimap enabled')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Jump to workflow graph node' }), {
      target: { value: 'workflow-task-10' },
    });

    expect(screen.getByText('Focus node: workflow-task-10 rev 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Detailed' }));

    expect(
      screen.getAllByRole('button', { name: 'Open Dependency connection settings' })
    ).toHaveLength(edges.length);

    fireEvent.click(screen.getByRole('button', { name: 'Clean' }));

    expect(
      screen.queryAllByRole('button', { name: 'Open Dependency connection settings' })
    ).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Select Task 1' }));

    expect(screen.getByRole('button', { name: 'Open Dependency connection settings' })).toHaveClass(
      'ring-2'
    );
    expect(screen.getByText('Selected: Task 1')).toBeInTheDocument();
    expect(screen.getByText('1 downstream')).toBeInTheDocument();
  });

  it('persists the workflow graph density preference per workflow', () => {
    const persistedWorkflow = {
      ...workflow,
      id: 'workflow-density-preference',
    };
    window.localStorage.removeItem('agency.workflowGraphDensity:workflow-density-preference');

    const { unmount } = render(<WorkflowGraphCanvas workflow={persistedWorkflow} />);

    fireEvent.click(screen.getByRole('button', { name: 'Detailed' }));
    expect(screen.getByRole('button', { name: 'Detailed' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    unmount();
    render(<WorkflowGraphCanvas workflow={persistedWorkflow} />);

    expect(screen.getByRole('button', { name: 'Detailed' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    window.localStorage.removeItem('agency.workflowGraphDensity:workflow-density-preference');
  });

  it('passes missing-resource warnings into the graph canvas', () => {
    render(
      <WorkflowGraphCanvas
        workflow={{
          ...workflow,
          task_definitions: [
            {
              id: 'task-1',
              name: 'Search',
              description: 'Search for evidence.',
              agent_id: 'agent-missing',
              tool_ids: [],
              depends_on_task_ids: [],
              human_approval_required: false,
            },
          ],
        }}
      />
    );

    expect(screen.getByTestId('graph-canvas')).toHaveTextContent('Graph issue count: 2');
    expect(
      screen.getByText('Edge source "workflow-agent-agent-missing" does not exist.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Task "Search" is assigned to missing agent "agent-missing".')
    ).toBeInTheDocument();
  });

  it('passes blocked approval warnings into the graph canvas', () => {
    render(
      <WorkflowGraphCanvas
        workflow={{
          ...workflow,
          agent_definitions: [
            {
              id: 'agent-1',
              name: 'Reviewer',
              role: 'Review work',
            },
          ],
          task_definitions: [
            {
              id: 'task-1',
              name: 'Review',
              description: 'Review the evidence.',
              agent_id: 'agent-1',
              tool_ids: [],
              depends_on_task_ids: [],
              human_approval_required: true,
            },
          ],
        }}
        runtimeEvents={[
          {
            id: 'approval-waiting-1',
            type: 'approval.waiting_for_approval',
            timestamp: '2026-01-01T00:00:00.000Z',
            status: 'waiting',
            nodeId: 'workflow-approval-task-1',
          },
        ]}
      />
    );

    expect(screen.getByTestId('graph-canvas')).toHaveTextContent('Graph issue count: 1');
    expect(
      screen.getByText('Task "Review" is blocked waiting for human approval.')
    ).toBeInTheDocument();
  });

  it('creates a tool group node without opening its drawer', () => {
    const onSelectTool = vi.fn();

    render(
      <WorkflowGraphCanvas
        workflow={workflow}
        includeTools
        toolDefinitions={[
          {
            id: 'catalog-tool',
            name: 'catalog.search',
            display_name: 'Catalog Search',
            description: 'Searches the catalog.',
          },
        ]}
        onSelectTool={onSelectTool}
      />
    );

    expect(screen.getByText('Graph nodes: 0')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Add Tool/ }));

    expect(screen.getByText('Graph nodes: 1')).toBeInTheDocument();
    expect(onSelectTool).not.toHaveBeenCalled();
  });

  it('keeps task creation generic while applying capability-aware starter nodes', () => {
    render(
      <WorkflowGraphCanvas
        workflow={{
          ...workflow,
          metadata: {
            workflow_capability_tags: ['home-control'],
          },
        }}
      />
    );

    expect(screen.queryByRole('button', { name: /Add Smart Home Task/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Add Task/ }));

    expect(screen.getByText('Graph nodes: 1')).toBeInTheDocument();
    expect(screen.getByText('Smart Home control task 1')).toBeInTheDocument();
  });

  it('selects newly added task and artifact nodes for immediate editing', () => {
    const onSelectTask = vi.fn();
    const onSelectArtifact = vi.fn();

    render(
      <WorkflowGraphCanvas
        workflow={workflow}
        onSelectTask={onSelectTask}
        onSelectArtifact={onSelectArtifact}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^Add Task/ }));
    expect(onSelectTask).toHaveBeenCalledWith(expect.stringMatching(/^task-/));

    fireEvent.click(screen.getByRole('button', { name: /^Add Artifact/ }));
    expect(onSelectArtifact).toHaveBeenCalledWith(expect.stringMatching(/^artifact-/));
  });

  it('creates common agentic template task nodes from the task template menu', () => {
    render(<WorkflowGraphCanvas workflow={workflow} />);

    expect(screen.queryByRole('button', { name: /Add Validation Task/ })).not.toBeInTheDocument();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Choose task template' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Validation/ }));

    expect(screen.getByText('Graph nodes: 1')).toBeInTheDocument();
    expect(screen.getByText('Validation task 1')).toBeInTheDocument();
    expect(screen.getByText(/Verify that the workflow output/)).toBeInTheDocument();
  });

  it('shows selected tool names on tool group nodes', () => {
    render(
      <WorkflowGraphCanvas
        workflow={{
          ...workflow,
          metadata: {
            workflow_graph_tool_nodes: [
              {
                id: 'tools-test',
                toolIds: ['catalog-tool'],
                agentId: null,
              },
            ],
          },
        }}
        includeTools
        toolDefinitions={[
          {
            id: 'catalog-tool',
            name: 'catalog.search',
            display_name: 'Catalog Search',
            description: 'Searches the catalog.',
            tool_type: 'mcp',
            tags: ['connector'],
            security: {
              requires_approval: true,
              requires_credentials: true,
              health_status: 'degraded',
              auth_status: 'missing',
              allow_network: true,
              allow_filesystem: true,
              sandbox_required: true,
            },
            implementation: {
              config: {
                provider: 'catalog',
              },
            },
          },
        ]}
      />
    );

    expect(screen.getAllByText('Catalog Search').length).toBeGreaterThan(0);
    expect(screen.getByText('MCP tool')).toBeInTheDocument();
    expect(screen.getByText('Provider: catalog')).toBeInTheDocument();
    expect(screen.getByText('Health: degraded')).toBeInTheDocument();
    expect(screen.getByText('Credential needed')).toBeInTheDocument();
    expect(screen.getByText('Auth: missing')).toBeInTheDocument();
    expect(screen.getByText('Approval required')).toBeInTheDocument();
    expect(screen.getByText('Permissions: filesystem, network, sandboxed')).toBeInTheDocument();
    expect(screen.getByText('1 tool')).toBeInTheDocument();
  });

  it('keeps selected tool names visible after adding another tool group node', () => {
    render(
      <WorkflowGraphCanvas
        workflow={{
          ...workflow,
          metadata: {
            workflow_graph_tool_nodes: [
              {
                id: 'tools-test',
                toolIds: ['catalog-tool'],
                agentId: null,
              },
            ],
          },
        }}
        includeTools
        toolDefinitions={[
          {
            id: 'catalog-tool',
            name: 'catalog.search',
            display_name: 'Catalog Search',
            description: 'Searches the catalog.',
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^Add Tool/ }));

    expect(screen.getByText('Graph nodes: 2')).toBeInTheDocument();
    expect(screen.getAllByText('Catalog Search').length).toBeGreaterThan(0);
    expect(screen.getByText('1 tool')).toBeInTheDocument();
  });

  it('removes graph nodes from the canvas', () => {
    const onWorkflowChange = vi.fn();

    render(
      <WorkflowGraphCanvas
        workflow={{
          ...workflow,
          metadata: {
            workflow_graph_tool_nodes: [
              {
                id: 'tools-test',
                toolIds: ['catalog-tool'],
                toolNames: ['Catalog Search'],
                agentId: null,
              },
            ],
          },
        }}
        includeTools
        toolDefinitions={[
          {
            id: 'catalog-tool',
            name: 'catalog.search',
            display_name: 'Catalog Search',
            description: 'Searches the catalog.',
          },
        ]}
        onWorkflowChange={onWorkflowChange}
      />
    );

    expect(screen.getByText('Graph nodes: 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Tools' }));

    expect(screen.getByText('Graph nodes: 0')).toBeInTheDocument();
    expect(onWorkflowChange).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          workflow_graph_tool_nodes: [],
        },
      })
    );
  });

  it('annotates monitored graph nodes with exclusions and steering requests', () => {
    render(
      <WorkflowGraphCanvas
        workflow={{
          ...workflow,
          agent_definitions: [
            {
              id: 'agent-1',
              name: 'Researcher',
              role: 'Find evidence',
            },
          ],
          task_definitions: [
            {
              id: 'task-1',
              name: 'Search',
              description: 'Search for evidence.',
              agent_id: 'agent-1',
            },
          ],
          monitoring: {
            enabled: true,
            level: 'standard',
            exempted: false,
            visible_to_main_agent: true,
            mutable_by_main_agent: true,
            default_enabled: true,
            is_main_agent_default_workflow: false,
            status_label: 'Standard',
            controls: {
              enabled: true,
              level: 'standard',
              store_run_summaries: true,
              store_failure_summaries: true,
              allow_improvement_proposals: true,
              allow_evaluation_agent_review: true,
              allow_self_monitoring: false,
              safe_to_summarize: true,
              route_improvement_proposals_to_approval: true,
              supervise_token_usage: true,
              supervise_context_health: true,
              supervise_subagents: true,
              supervise_tool_failures: true,
              excluded_subagent_ids: ['agent-1'],
              excluded_task_ids: [],
              allowed_steering_actions: ['request_human_review'],
              auto_apply_steering_actions: [],
            },
          },
        }}
        runtimeEvents={[
          {
            id: 'steering-1',
            type: 'supervisor.steering.requested',
            timestamp: '2026-01-01T00:00:00.000Z',
            nodeId: 'workflow-agent-agent-1',
            metadata: {
              agentId: 'agent-1',
            },
          },
          {
            id: 'applied-1',
            type: 'supervisor.steering.applied',
            timestamp: '2026-01-01T00:00:01.000Z',
            nodeId: 'workflow-agent-agent-1',
            metadata: {
              agentId: 'agent-1',
            },
          },
          {
            id: 'step-1',
            type: 'agent.step.completed',
            timestamp: '2026-01-01T00:00:02.000Z',
            nodeId: 'workflow-task-task-1',
            payload: {
              summary: 'Researcher completed task Search.',
            },
            metadata: {
              taskId: 'task-1',
              agentId: 'agent-1',
            },
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show graph execution timeline' }));

    expect(screen.getByText('Excluded from supervision')).toBeInTheDocument();
    expect(screen.getByText('Assigned agent excluded')).toBeInTheDocument();
    expect(screen.getByText('1 steer')).toBeInTheDocument();
    expect(screen.getByText('1 applied')).toBeInTheDocument();
    expect(screen.getAllByText('1 step')).toHaveLength(2);
    expect(
      screen.getAllByText('Latest step: summary: Researcher completed task Search.')
    ).toHaveLength(2);
  });

  it('hides the timeline by default and shows the latest run first when opened', () => {
    const { container } = render(
      <WorkflowGraphCanvas
        workflow={workflow}
        runtimeEvents={[
          {
            id: 'run-older',
            type: 'run.created',
            timestamp: '2026-01-01T00:00:00.000Z',
            payload: {
              runId: 'execution-older',
            },
            metadata: {
              startedAt: '2026-01-01T00:00:00.000Z',
            },
          },
          {
            id: 'run-latest',
            type: 'run.created',
            timestamp: '2026-01-02T00:00:00.000Z',
            payload: {
              runId: 'execution-latest',
            },
            metadata: {
              startedAt: '2026-01-02T00:00:00.000Z',
            },
          },
        ]}
      />
    );

    const toolbar = screen.getByText('Graph view').parentElement?.parentElement;

    expect(toolbar).toHaveTextContent('Edge pill opens details');
    expect(toolbar).toHaveTextContent('Static link');
    expect(toolbar).toHaveTextContent('Live transfer');
    expect(toolbar).toHaveTextContent('Waiting');
    expect(toolbar).toHaveTextContent('Failed');
    expect(toolbar).toHaveTextContent('Completed');
    expect(toolbar).toHaveTextContent('2 timeline events hidden');
    expect(screen.queryByLabelText('Runtime run filter')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show graph execution timeline' }));

    const runFilter = screen.getByLabelText('Runtime run filter');
    expect(runFilter).toHaveValue('execution-latest');
    expect(screen.getByText('Execution timeline')).toBeInTheDocument();
    expect(toolbar).toHaveTextContent('2 Jan 2026');
    expect(toolbar).not.toHaveTextContent('execution-latest');

    fireEvent.change(runFilter, { target: { value: 'execution-older' } });
    expect(runFilter).toHaveValue('execution-older');

    fireEvent.click(screen.getByRole('button', { name: 'Hide graph execution timeline' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show graph execution timeline' }));

    expect(screen.getByLabelText('Runtime run filter')).toHaveValue('execution-older');
    expect(screen.getByText('Workflow One')).toBeInTheDocument();
    expect(container.querySelector('.pointer-events-none.absolute.right-3.top-3')).toBeNull();
  });

  it('can hide the runtime run filter for single-run contexts', () => {
    render(
      <WorkflowGraphCanvas
        workflow={workflow}
        hideRuntimeRunFilter
        runtimeEvents={[
          {
            id: 'run-1',
            type: 'run.created',
            timestamp: '2026-01-01T00:00:00.000Z',
            payload: {
              runId: 'execution-1',
            },
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show graph execution timeline' }));

    expect(screen.queryByLabelText('Runtime run filter')).not.toBeInTheDocument();
  });

  it('shows a compact summary for the latest runtime run', () => {
    render(
      <WorkflowGraphCanvas
        workflow={{
          ...workflow,
          task_definitions: [
            {
              id: 'task-1',
              name: 'Research',
              description: 'Gather evidence.',
            },
            {
              id: 'task-2',
              name: 'Draft',
              description: 'Write the decision.',
            },
          ],
        }}
        runtimeEvents={[
          {
            id: 'task-completed-1',
            type: 'task.completed',
            timestamp: '2026-01-01T00:00:00.000Z',
            nodeId: 'workflow-task-task-1',
            status: 'completed',
            metadata: {
              runId: 'run-latest',
              taskId: 'task-1',
            },
          },
          {
            id: 'task-failed-1',
            type: 'task.failed',
            timestamp: '2026-01-01T00:00:02.000Z',
            nodeId: 'workflow-task-task-2',
            status: 'failed',
            payload: {
              error: 'Draft failed',
            },
            metadata: {
              runId: 'run-latest',
              taskId: 'task-2',
            },
          },
          {
            id: 'artifact-1',
            type: 'artifact.created',
            timestamp: '2026-01-01T00:00:04.000Z',
            payload: {
              artifactId: 'artifact-1',
            },
            metadata: {
              runId: 'run-latest',
            },
          },
          {
            id: 'run-completed-1',
            type: 'run.completed',
            timestamp: '2026-01-01T00:00:05.000Z',
            payload: {
              output: 'Final decision',
              runId: 'run-latest',
            },
            metadata: {
              metrics: {
                total_tokens: 2500,
              },
            },
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show graph execution timeline' }));

    const summary = screen.getByLabelText('Run summary');
    expect(within(summary).getByText('1 completed')).toBeInTheDocument();
    expect(within(summary).getByText('1 failed')).toBeInTheDocument();
    expect(within(summary).getByText('1 output')).toBeInTheDocument();
    expect(within(summary).getByText('1 artifact')).toBeInTheDocument();
    expect(within(summary).getByText('2.5K tok')).toBeInTheDocument();
    expect(within(summary).getByText('5.0s')).toBeInTheDocument();
    expect(
      within(summary).getByText('Next Review failed tasks, Review outputs')
    ).toBeInTheDocument();
  });

  it('links graph runtime timeline to the run detail page', () => {
    render(
      <WorkflowGraphCanvas
        workflow={workflow}
        runtimeEvents={[
          {
            id: 'run-1',
            type: 'run.running',
            timestamp: '2026-01-01T00:00:00.000Z',
            graphId: 'workflow-5085e49a-6fa3-4d8b-968d-1f243243e92a',
            payload: {
              runId: 'e89af189-3a94-4440-8e52-41c014ee033f',
            },
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show graph execution timeline' }));

    expect(screen.getByRole('link', { name: 'View run details' })).toHaveAttribute(
      'href',
      '/runs/e89af189-3a94-4440-8e52-41c014ee033f?workflowId=workflow-5085e49a-6fa3-4d8b-968d-1f243243e92a&tab=runs'
    );
  });

  it('renders graph runtime control actions when parent handlers are available', () => {
    const onResumeRun = vi.fn();
    const onApproveTool = vi.fn();
    const onRejectTool = vi.fn();

    render(
      <WorkflowGraphCanvas
        workflow={workflow}
        runtimeControls={{
          runId: 'run-1',
          status: 'waiting_for_approval',
          approvalToolId: 'tool-click',
          approvalLabel: 'Click tool',
          onResumeRun,
          onApproveTool,
          onRejectTool,
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Resume run' }));
    fireEvent.click(screen.getByRole('button', { name: 'Approve tool' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reject tool' }));

    expect(onResumeRun).toHaveBeenCalledWith('run-1');
    expect(onApproveTool).toHaveBeenCalledWith('run-1', 'tool-click');
    expect(onRejectTool).toHaveBeenCalledWith('run-1', 'tool-click');
  });

  it('hides graph approval actions when the run is no longer waiting for approval', () => {
    render(
      <WorkflowGraphCanvas
        workflow={workflow}
        runtimeControls={{
          runId: 'run-1',
          status: 'failed',
          approvalToolId: 'tool-click',
          approvalLabel: 'Click tool',
          onApproveTool: vi.fn(),
          onRejectTool: vi.fn(),
        }}
      />
    );

    expect(screen.queryByRole('button', { name: 'Approve tool' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reject tool' })).not.toBeInTheDocument();
  });

  it('marks the paused task node with a node-level resume control', () => {
    render(
      <WorkflowGraphCanvas
        workflow={{
          ...workflow,
          task_definitions: [
            {
              id: 'task-1',
              name: 'Review plan',
              description: 'Review the generated plan.',
            },
          ],
        }}
        runtimeEvents={[
          {
            id: 'run-paused-1',
            type: 'run.paused',
            timestamp: '2026-01-01T00:00:00.000Z',
            nodeId: 'workflow-task-task-1',
            status: 'paused',
            payload: {
              runId: 'run-1',
            },
          },
        ]}
        runtimeControls={{
          runId: 'run-1',
          status: 'paused',
          onResumeRun: vi.fn(),
        }}
      />
    );

    expect(
      screen.getByText('Node runtime control: Review plan Resume paused run')
    ).toBeInTheDocument();
  });

  it('marks failed task nodes with a node-level retry control', () => {
    render(
      <WorkflowGraphCanvas
        workflow={{
          ...workflow,
          task_definitions: [
            {
              id: 'task-1',
              name: 'Review plan',
              description: 'Review the generated plan.',
            },
          ],
        }}
        runtimeEvents={[
          {
            id: 'run-failed-1',
            type: 'agent.step.failed',
            timestamp: '2026-01-01T00:00:00.000Z',
            nodeId: 'workflow-task-task-1',
            status: 'failed',
            payload: {
              runId: 'run-1',
              error: 'Task failed',
            },
          },
        ]}
        runtimeControls={{
          runId: 'run-1',
          status: 'failed',
          onRetryTask: vi.fn(),
        }}
      />
    );

    expect(
      screen.getByText('Node runtime control: Review plan Retry failed task')
    ).toBeInTheDocument();
  });

  it('marks blocked tool pause points with a node-level retry control', () => {
    render(
      <WorkflowGraphCanvas
        workflow={{
          ...workflow,
          task_definitions: [
            {
              id: 'task-1',
              name: 'Review plan',
              description: 'Review the generated plan.',
            },
          ],
        }}
        runtimeEvents={[
          {
            id: 'tool-blocked-1',
            type: 'tool.call.failed',
            timestamp: '2026-01-01T00:00:00.000Z',
            status: 'blocked',
            payload: {
              runId: 'run-1',
              taskId: 'task-1',
              toolId: 'tool-search',
              error: 'Tool blocked by policy.',
            },
          },
        ]}
        runtimeControls={{
          runId: 'run-1',
          status: 'failed',
          onRetryTask: vi.fn(),
        }}
      />
    );

    expect(
      screen.getByText('Node runtime control: Review plan Blocked tool pause point: retry task')
    ).toBeInTheDocument();
  });

  it('marks missing context pause points with a node-level retry control', () => {
    render(
      <WorkflowGraphCanvas
        workflow={{
          ...workflow,
          task_definitions: [
            {
              id: 'task-1',
              name: 'Review plan',
              description: 'Review the generated plan.',
            },
          ],
        }}
        runtimeEvents={[
          {
            id: 'context-missing-1',
            type: 'context.retrieval.failed',
            timestamp: '2026-01-01T00:00:00.000Z',
            status: 'blocked',
            payload: {
              runId: 'run-1',
              taskId: 'task-1',
              error: 'Missing context pack.',
            },
          },
        ]}
        runtimeControls={{
          runId: 'run-1',
          status: 'failed',
          onRetryTask: vi.fn(),
        }}
      />
    );

    expect(
      screen.getByText('Node runtime control: Review plan Missing context pause point: retry task')
    ).toBeInTheDocument();
  });

  it('marks failed guardrail pause points with a node-level retry control', () => {
    render(
      <WorkflowGraphCanvas
        workflow={{
          ...workflow,
          task_definitions: [
            {
              id: 'task-1',
              name: 'Review plan',
              description: 'Review the generated plan.',
            },
          ],
        }}
        runtimeEvents={[
          {
            id: 'guardrail-failed-1',
            type: 'agent.guardrail.failed',
            timestamp: '2026-01-01T00:00:00.000Z',
            status: 'failed',
            payload: {
              runId: 'run-1',
              taskId: 'task-1',
              error: 'Guardrail check failed.',
            },
          },
        ]}
        runtimeControls={{
          runId: 'run-1',
          status: 'failed',
          onRetryTask: vi.fn(),
        }}
      />
    );

    expect(
      screen.getByText('Node runtime control: Review plan Guardrail pause point: retry task')
    ).toBeInTheDocument();
  });

  it('marks checkpoint resume target task nodes with a node-level resume control', () => {
    render(
      <WorkflowGraphCanvas
        workflow={{
          ...workflow,
          task_definitions: [
            {
              id: 'task-1',
              name: 'Review plan',
              description: 'Review the generated plan.',
            },
          ],
        }}
        runtimeControls={{
          runId: 'run-1',
          status: 'failed',
          checkpointResumeTaskId: 'task-1',
          onResumeFromCheckpoint: vi.fn(),
        }}
      />
    );

    expect(
      screen.getByText('Node runtime control: Review plan Resume from checkpoint')
    ).toBeInTheDocument();
  });

  it('marks approval gates with node-level native approval controls', () => {
    render(
      <WorkflowGraphCanvas
        workflow={{
          ...workflow,
          task_definitions: [
            {
              id: 'task-1',
              name: 'Approve command',
              description: 'Approve the command before execution.',
              human_approval_required: true,
            },
          ],
        }}
        runtimeEvents={[
          {
            id: 'approval-waiting-1',
            type: 'approval.waiting_for_approval',
            timestamp: '2026-01-01T00:00:00.000Z',
            nodeId: 'workflow-approval-task-1',
            status: 'waiting',
            payload: {
              runId: 'run-1',
              toolId: 'tool-click',
            },
            metadata: {
              taskId: 'task-1',
            },
          },
        ]}
        runtimeControls={{
          runId: 'run-1',
          status: 'waiting_for_approval',
          approvalToolId: 'tool-click',
          approvalLabel: 'Click tool',
          onApproveTool: vi.fn(),
          onRejectTool: vi.fn(),
        }}
      />
    );

    expect(
      screen.getByText('Node runtime control: Approval required Approve or reject Click tool')
    ).toBeInTheDocument();
  });

  it('annotates graph nodes with compact token and context badges', () => {
    render(
      <WorkflowGraphCanvas
        workflow={{
          ...workflow,
          agent_definitions: [
            {
              id: 'agent-1',
              name: 'Researcher',
              role: 'Find evidence',
            },
          ],
          task_definitions: [
            {
              id: 'task-1',
              name: 'Search',
              description: 'Search for evidence.',
              agent_id: 'agent-1',
            },
          ],
        }}
        agentObservabilityMetrics={[
          {
            agent_id: 'agent-1',
            total_tokens: 1800,
            context_health: {
              latest: {
                status: 'warning',
              },
            },
          },
        ]}
        runtimeEvents={[
          {
            id: 'usage-1',
            type: 'token.usage.recorded',
            timestamp: '2026-01-01T00:00:00.000Z',
            nodeId: 'workflow-task-task-1',
            metadata: {
              source: 'workflowExecutionEvent',
              taskId: 'task-1',
              agentId: 'agent-1',
              metrics: {
                total_tokens: 2500,
              },
            },
          },
          {
            id: 'context-1',
            type: 'context.health.recorded',
            timestamp: '2026-01-01T00:00:01.000Z',
            nodeId: 'workflow-task-task-1',
            payload: {
              status: 'critical',
            },
            metadata: {
              source: 'workflowExecutionEvent',
              taskId: 'task-1',
              agentId: 'agent-1',
              sequence: 2,
            },
          },
        ]}
      />
    );

    expect(screen.getByText('1.8K tok')).toBeInTheDocument();
    expect(screen.getByText('ctx warning')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show graph execution timeline' }));

    expect(screen.getAllByText('2.5K tok').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('ctx critical')).toBeInTheDocument();
  });

  it('annotates graph nodes with runtime failure, tool call, and duration evidence', () => {
    render(
      <WorkflowGraphCanvas
        workflow={{
          ...workflow,
          agent_definitions: [
            {
              id: 'agent-1',
              name: 'Researcher',
              role: 'Find evidence',
            },
          ],
          task_definitions: [
            {
              id: 'task-1',
              name: 'Search',
              description: 'Search for evidence.',
              agent_id: 'agent-1',
              tool_ids: ['search-tool'],
            },
          ],
        }}
        runtimeEvents={[
          {
            id: 'tool-1',
            type: 'tool.call.completed',
            timestamp: '2026-01-01T00:00:00.000Z',
            nodeId: 'workflow-task-task-1',
            status: 'succeeded',
            metadata: {
              source: 'workflowExecutionEvent',
              taskId: 'task-1',
              toolId: 'search-tool',
              durationMs: 1000,
            },
          },
          {
            id: 'task-failed-1',
            type: 'task.failed',
            timestamp: '2026-01-01T00:00:02.000Z',
            nodeId: 'workflow-task-task-1',
            status: 'failed',
            payload: {
              error: 'Search provider timed out',
            },
            metadata: {
              source: 'workflowExecutionEvent',
              taskId: 'task-1',
              durationMs: 3000,
            },
          },
          {
            id: 'task-failed-2',
            type: 'task.failed',
            timestamp: '2026-01-01T00:00:03.000Z',
            nodeId: 'workflow-task-task-1',
            status: 'failed',
            payload: {
              error: 'Search provider timed out',
            },
            metadata: {
              source: 'workflowExecutionEvent',
              taskId: 'task-1',
              durationMs: 2000,
            },
          },
          {
            id: 'task-failed-3',
            type: 'task.failed',
            timestamp: '2026-01-01T00:00:04.000Z',
            nodeId: 'workflow-task-task-1',
            status: 'failed',
            payload: {
              error: 'Search quota exceeded',
            },
            metadata: {
              source: 'workflowExecutionEvent',
              taskId: 'task-1',
              durationMs: 4000,
            },
          },
        ]}
      />
    );

    expect(screen.queryByText('3 failures')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show graph execution timeline' }));

    expect(screen.getByText('3 failures')).toBeInTheDocument();
    expect(screen.getByText('2 failure groups')).toBeInTheDocument();
    expect(screen.getByText('1 tool call')).toBeInTheDocument();
    expect(screen.getByText('avg 2.5s')).toBeInTheDocument();
    expect(screen.getByText('Latest failure: error: Search quota exceeded')).toBeInTheDocument();
    expect(
      screen.getByText('Repeated failure: 2x error: Search provider timed out')
    ).toBeInTheDocument();
  });

  it('annotates tool nodes with blocked and missing-credential runtime states', () => {
    render(
      <WorkflowGraphCanvas
        includeTools
        workflow={{
          ...workflow,
          agent_definitions: [
            {
              id: 'agent-1',
              name: 'Researcher',
              role: 'Find evidence',
              tool_ids: ['search-tool'],
            },
          ],
          task_definitions: [
            {
              id: 'task-1',
              name: 'Search',
              description: 'Search for evidence.',
              agent_id: 'agent-1',
              tool_ids: ['search-tool'],
            },
          ],
          tool_definitions: [
            {
              id: 'search-tool',
              name: 'Search Tool',
              description: 'Search provider.',
            },
          ],
        }}
        runtimeEvents={[
          {
            id: 'tool-blocked-1',
            type: 'tool.call.failed',
            timestamp: '2026-01-01T00:00:00.000Z',
            status: 'blocked',
            payload: {
              error: 'Missing credential for Search API',
              toolId: 'search-tool',
            },
            metadata: {
              source: 'workflowExecutionEvent',
              taskId: 'task-1',
              toolId: 'search-tool',
            },
          },
        ]}
      />
    );

    expect(screen.queryByText('1 blocked')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show graph execution timeline' }));

    expect(screen.getByText('1 blocked')).toBeInTheDocument();
    expect(screen.getByText('1 credential')).toBeInTheDocument();
    expect(
      screen.getByText('Missing credential: error: Missing credential for Search API')
    ).toBeInTheDocument();
  });

  it('annotates memory nodes with retrieved runtime context evidence', () => {
    render(
      <WorkflowGraphCanvas
        includeMemories
        workflow={{
          ...workflow,
          task_definitions: [
            {
              id: 'task-1',
              name: 'Use memory',
              description: 'Use memory context.',
              memory_ids: ['memory-1'],
            },
          ],
          memory_definitions: [
            {
              id: 'memory-1',
              name: 'Decision memory',
              memory_type: 'workflow',
              scope: 'workflow',
            },
          ],
        }}
        runtimeEvents={[
          {
            id: 'memory-1',
            type: 'memory.retrieved',
            timestamp: '2026-01-01T00:00:00.000Z',
            status: 'succeeded',
            payload: {
              memoryId: 'memory-1',
              summary: 'Retrieved decision context.',
            },
            metadata: {
              source: 'workflowExecutionEvent',
              taskId: 'task-1',
            },
          },
        ]}
      />
    );

    expect(screen.queryByText('1 context')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show graph execution timeline' }));

    expect(screen.getByText('1 context')).toBeInTheDocument();
    expect(
      screen.getByText('Retrieved context: summary: Retrieved decision context.')
    ).toBeInTheDocument();
  });

  it('annotates memory nodes with stale, missing, auth, and permission runtime warnings', () => {
    render(
      <WorkflowGraphCanvas
        includeMemories
        workflow={{
          ...workflow,
          memory_definitions: [
            {
              id: 'memory-1',
              name: 'Decision memory',
              memory_type: 'workflow',
              scope: 'workflow',
            },
          ],
        }}
        runtimeEvents={[
          {
            id: 'memory-stale',
            type: 'memory.retrieval.warning',
            timestamp: '2026-01-01T00:00:00.000Z',
            status: 'warning',
            payload: {
              memoryId: 'memory-1',
              message: 'Stale memory snapshot is older than the run.',
            },
          },
          {
            id: 'memory-missing',
            type: 'memory.retrieval.failed',
            timestamp: '2026-01-01T00:00:01.000Z',
            status: 'failed',
            payload: {
              memoryId: 'memory-1',
              error: 'Missing memory record memory-1.',
            },
          },
          {
            id: 'memory-auth',
            type: 'memory.retrieval.failed',
            timestamp: '2026-01-01T00:00:02.000Z',
            status: 'failed',
            payload: {
              memoryId: 'memory-1',
              error: 'Authentication required for memory source.',
            },
          },
          {
            id: 'memory-permission',
            type: 'memory.retrieval.failed',
            timestamp: '2026-01-01T00:00:03.000Z',
            status: 'failed',
            payload: {
              memoryId: 'memory-1',
              error: 'Permission denied for sensitive memory.',
            },
          },
        ]}
      />
    );

    expect(screen.queryByText('1 stale')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show graph execution timeline' }));

    expect(screen.getByText('1 stale')).toBeInTheDocument();
    expect(screen.getByText('1 missing')).toBeInTheDocument();
    expect(screen.getByText('1 auth')).toBeInTheDocument();
    expect(screen.getByText('1 permission')).toBeInTheDocument();
    expect(
      screen.getByText('Stale memory: message: Stale memory snapshot is older than the run.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Missing memory: error: Missing memory record memory-1.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Memory auth: error: Authentication required for memory source.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Memory permission: error: Permission denied for sensitive memory.')
    ).toBeInTheDocument();
  });
});
