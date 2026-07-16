import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { createContext, useContext } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WorkflowDetailWorkspace from '@/components/workflow/WorkflowDetailWorkspace';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { workflowGraphToolListSelectionId } from '@/lib/workflows/workflowGraphAdapter';
import type { GraphEdge, GraphRuntimeEvent } from '@/modules/react-flow-graph/types';
import type { WorkflowDefinition } from '@/types/workflows';

const {
  agentsApi,
  behaviorProfilesApi,
  conversationsApi,
  credentialsApi,
  logsApi,
  memoriesApi,
  observabilityApi,
  runsApi,
  runtimeAdaptersApi,
  schedulesApi,
  toolsApi,
  workflowsApi,
  replaceMock,
  pushMock,
} = vi.hoisted(() => ({
  agentsApi: {
    listAgents: vi.fn(),
  },
  behaviorProfilesApi: {
    listProfiles: vi.fn(),
  },
  conversationsApi: {
    approveApprovalRequest: vi.fn(),
    rejectApprovalRequest: vi.fn(),
    requestChangesToApprovalRequest: vi.fn(),
    splitApprovalRequest: vi.fn(),
  },
  credentialsApi: {
    listCredentials: vi.fn(),
    getConnectorCredentialCapabilities: vi.fn(),
  },
  logsApi: {
    listRunEvents: vi.fn(),
  },
  memoriesApi: {
    listMemories: vi.fn(),
    listMemoryCatalog: vi.fn(),
    deleteDocumentMemories: vi.fn(),
  },
  observabilityApi: {
    getWorkflowMetrics: vi.fn(),
    getModelUsage: vi.fn(),
    getAgentMetrics: vi.fn(),
  },
  runsApi: {
    listRunsForWorkflow: vi.fn(),
    executeWorkflow: vi.fn(),
    resumeRun: vi.fn(),
    retryTask: vi.fn(),
    resumeFromCheckpoint: vi.fn(),
    approveRun: vi.fn(),
    rejectRun: vi.fn(),
  },
  runtimeAdaptersApi: {
    listRuntimeAdapters: vi.fn(),
  },
  schedulesApi: {
    listSchedules: vi.fn(),
    createSchedule: vi.fn(),
    patchSchedule: vi.fn(),
    deleteSchedule: vi.fn(),
    enableSchedule: vi.fn(),
    disableSchedule: vi.fn(),
    triggerNow: vi.fn(),
  },
  toolsApi: {
    listTools: vi.fn(),
  },
  workflowsApi: {
    getWorkflow: vi.fn(),
    getWorkflowRuntimeGovernance: vi.fn(),
    listWorkflowMonitoringEvents: vi.fn(),
    getWorkflowGovernanceReviewQueue: vi.fn(),
    suggestWorkflowGovernanceDocuments: vi.fn(),
    executeWorkflowGovernanceBundle: vi.fn(),
    createWorkflowSteeringApproval: vi.fn(),
    getWorkflowSharedMemory: vi.fn(),
    listWorkflowMemoryLinks: vi.fn(),
    addWorkflowMemoryLink: vi.fn(),
    deleteWorkflowMemoryLink: vi.fn(),
    updateWorkflow: vi.fn(),
    validateWorkflow: vi.fn(),
    updateWorkflowRuntimeGovernance: vi.fn(),
    updateWorkflowMonitoring: vi.fn(),
    listWorkflowPersonaVersionNotices: vi.fn(),
    listWorkflowVersions: vi.fn(),
    useLatestPersonaAgent: vi.fn(),
    keepCurrentPersonaAgent: vi.fn(),
    promoteWorkflowAgent: vi.fn(),
  },
  replaceMock: vi.fn(),
  pushMock: vi.fn(),
}));

let currentSearch = 'mode=edit&task=task-b';

vi.mock('next/navigation', () => ({
  usePathname: () => '/workflows/workflow-1',
  useRouter: () => ({
    replace: replaceMock,
    push: pushMock,
  }),
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        id: 'user-1',
        email: 'user@example.com',
        name: 'User One',
      },
    },
  }),
}));

vi.mock('@/lib/api/backend/agents', () => ({
  agentsApi,
}));

vi.mock('@/lib/api/backend/behaviorProfiles', () => ({
  behaviorProfilesApi,
}));

vi.mock('@/lib/api/backend/conversations', () => ({
  conversationsApi,
}));

vi.mock('@/lib/api/backend/credentials', () => ({
  credentialsApi,
}));

vi.mock('@/lib/api/backend/logs', () => ({
  logsApi,
}));

vi.mock('@/lib/api/backend/memory', () => ({
  memoriesApi,
}));

vi.mock('@/lib/api/backend/observability', () => ({
  observabilityApi,
}));

vi.mock('@/lib/api/backend/runs', () => ({
  runsApi,
}));

vi.mock('@/lib/api/backend/runtimeAdapters', () => ({
  runtimeAdaptersApi,
}));

vi.mock('@/lib/api/backend/schedules', () => ({
  schedulesApi,
}));

vi.mock('@/lib/api/backend/tools', () => ({
  toolsApi,
}));

vi.mock('@/lib/api/backend/workflows', () => ({
  workflowsApi,
}));

vi.mock('@/components/workflow/WorkflowGovernancePanel', () => ({
  default: () => <div>Governance Panel</div>,
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    promise: vi.fn((promise: Promise<unknown>) => promise),
  },
}));

vi.mock('@/components/agent-app/StatePanels', () => ({
  LoadingCard: ({ title }: { title: string }) => <div>{title} loading</div>,
  ErrorAlert: ({
    title,
    message,
    onRetry,
  }: {
    title: string;
    message: string;
    onRetry?: () => void;
  }) => (
    <div>
      {title}: {message}
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  ),
  EmptyCard: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('@/components/workflow/WorkflowDetailHeader', () => ({
  default: ({ workflowName, onExecute }: { workflowName: string; onExecute: () => void }) => (
    <div>
      <div>Header: {workflowName}</div>
      <button type="button" onClick={onExecute}>
        Run Workflow
      </button>
    </div>
  ),
}));

vi.mock('@/components/workflow/WorkflowDetailStatus', () => ({
  default: () => <div>Status Panel</div>,
}));

vi.mock('@/components/workflow/WorkflowMetadataEditor', () => ({
  default: ({
    defaultRuntimeAdapterId,
    restartActiveExecutions,
    runtimeAdapters,
    onDefaultRuntimeAdapterChange,
    onRestartActiveExecutionsChange,
    onSave,
  }: {
    defaultRuntimeAdapterId: string;
    restartActiveExecutions: boolean;
    runtimeAdapters: Array<{ id: string; name: string }>;
    onDefaultRuntimeAdapterChange: (value: string) => void;
    onRestartActiveExecutionsChange: (checked: boolean) => void;
    onSave: () => void;
  }) => (
    <div>
      <div>Metadata Editor</div>
      <label htmlFor="metadata-default-runtime-adapter">Default runtime adapter</label>
      <select
        id="metadata-default-runtime-adapter"
        value={defaultRuntimeAdapterId}
        onChange={(event) => onDefaultRuntimeAdapterChange(event.currentTarget.value)}
      >
        <option value="">No default adapter</option>
        {runtimeAdapters.map((adapter) => (
          <option key={adapter.id} value={adapter.id}>
            {adapter.name}
          </option>
        ))}
      </select>
      <label htmlFor="metadata-active-run-behavior">Metadata Active run behavior</label>
      <select
        id="metadata-active-run-behavior"
        value={restartActiveExecutions ? 'restart' : 'keep'}
        onChange={(event) =>
          onRestartActiveExecutionsChange(event.currentTarget.value === 'restart')
        }
      >
        <option value="keep">Active runs stay current</option>
        <option value="restart">Active runs restart</option>
      </select>
      <button type="button" onClick={onSave}>
        Save Changes
      </button>
    </div>
  ),
}));

vi.mock('@/components/workflow/WorkflowBuilderPanel', () => ({
  default: ({
    selectedTaskId,
    selectedTaskDetail,
    runtimeAdapterId,
    memoryDefinitions = [],
  }: {
    selectedTaskId?: string | null;
    selectedTaskDetail?: ReactNode;
    runtimeAdapterId?: string | null;
    memoryDefinitions?: Array<{ id: string }>;
  }) => (
    <div>
      Builder Panel: {selectedTaskId || 'none'}
      <span>Builder runtime adapter: {runtimeAdapterId || 'none'}</span>
      <span>Builder memories: {memoryDefinitions.length}</span>
      {selectedTaskDetail}
    </div>
  ),
}));

vi.mock('@/components/workflow/WorkflowGraphCanvas', () => ({
  default: ({
    workflow,
    workflowValidationIssues = [],
    runtimeEvents = [],
    agentObservabilityMetrics = [],
    memoryLinkCountsByTarget = {},
    toolDefinitions = [],
    onWorkflowChange,
    onSelectApproval,
    onSelectAgent,
    onSelectTool,
    onSelectMemory,
    onSelectArtifact,
    onSelectEdge,
    onStartEditing,
    onSaveWorkflow,
    onRunWorkflow,
    runtimeControls,
    saveWorkflowDisabled,
    runWorkflowDisabled,
  }: {
    workflow: WorkflowDefinition;
    workflowValidationIssues?: string[];
    runtimeEvents?: GraphRuntimeEvent[];
    agentObservabilityMetrics?: Array<{ agent_id: string; total_tokens?: number }>;
    memoryLinkCountsByTarget?: Record<string, number>;
    onWorkflowChange?: (workflow: WorkflowDefinition) => void;
    onSelectApproval?: (taskId: string | null) => void;
    onSelectAgent?: (agentId: string | null) => void;
    toolDefinitions?: Array<{ id: string; display_name?: string; name?: string }>;
    onSelectTool?: (toolId: string | null, toolIds?: string[], toolNodeId?: string | null) => void;
    onSelectMemory?: (memoryId: string | null) => void;
    onSelectArtifact?: (artifactId: string | null) => void;
    onSelectEdge?: (edge: GraphEdge | null) => void;
    onStartEditing?: () => void;
    onSaveWorkflow?: () => void;
    onRunWorkflow?: () => void;
    runtimeControls?: {
      runId?: string | null;
      approvalToolId?: string | null;
      checkpointResumeTaskId?: string | null;
      canRequestSteering?: boolean;
      onResumeRun?: (runId: string) => void;
      onRetryTask?: (runId: string, taskId: string) => void;
      onResumeFromCheckpoint?: (runId: string) => void;
      onApproveTool?: (runId: string, toolId: string) => void;
      onRejectTool?: (runId: string, toolId: string) => void;
      onRequestSteering?: (target: { taskId?: string | null; agentId?: string | null }) => void;
    };
    saveWorkflowDisabled?: boolean;
    runWorkflowDisabled?: boolean;
  }) => (
    <div>
      {(() => {
        const workflowGraphToolNodes = Array.isArray(workflow.metadata?.workflow_graph_tool_nodes)
          ? (workflow.metadata.workflow_graph_tool_nodes as Array<{
              id?: string;
              toolIds?: string[];
            }>)
          : [];
        const firstWorkflowToolNode = workflowGraphToolNodes[0];
        const selectedToolIds =
          firstWorkflowToolNode?.toolIds && firstWorkflowToolNode.toolIds.length > 0
            ? firstWorkflowToolNode.toolIds
            : workflow.tool_definitions?.[0]?.id
              ? [workflow.tool_definitions[0].id]
              : ['tool-1'];
        const selectedToolId = selectedToolIds[0] ?? 'tool-1';
        const selectedToolNodeId = firstWorkflowToolNode?.id ?? 'workflow-tool-tools-test';

        return (
          <>
            Graph Canvas: {workflow.name || workflow.id}
            <span>Graph validation issues: {workflowValidationIssues.length}</span>
            <span>Graph runtime events: {runtimeEvents.length}</span>
            <span>Graph agent metrics: {agentObservabilityMetrics.length}</span>
            <span>
              Graph memory link targets:{' '}
              {Object.entries(memoryLinkCountsByTarget)
                .map(([target, count]) => `${target}=${count}`)
                .join(', ')}
            </span>
            <span>
              Graph agents:{' '}
              {(workflow.agent_definitions ?? []).map((agent) => agent.name || agent.id).join(', ')}
            </span>
            <span>
              Graph tasks:{' '}
              {(workflow.task_definitions ?? []).map((task) => task.name || task.id).join(', ')}
            </span>
            <span>
              Graph tools:{' '}
              {(workflow.tool_definitions ?? [])
                .map((tool) => tool.display_name || tool.name || tool.id)
                .join(', ')}
            </span>
            <span>
              Graph available tools:{' '}
              {toolDefinitions.map((tool) => tool.display_name || tool.name || tool.id).join(', ')}
            </span>
            <span>
              Graph memories:{' '}
              {(workflow.memory_definitions ?? [])
                .map((memory) => memory.name || memory.id)
                .join(', ')}
            </span>
            <button
              type="button"
              onClick={() =>
                onWorkflowChange?.({
                  ...workflow,
                  task_definitions: (workflow.task_definitions ?? []).map((task) =>
                    task.id === 'task-b'
                      ? {
                          ...task,
                          name: 'Graph Edited Task',
                          description: 'Edited from graph.',
                          depends_on_task_ids: [],
                        }
                      : task
                  ),
                  edges: [],
                })
              }
            >
              Apply Graph Edit
            </button>
            <button
              type="button"
              onClick={() =>
                onWorkflowChange?.({
                  ...workflow,
                  agent_definitions: [
                    ...(workflow.agent_definitions ?? []),
                    {
                      id: 'graph-agent-full',
                      name: 'Graph Full Agent',
                      description: 'Created from graph.',
                      instructions: 'Own the graph-created workflow path.',
                      system_prompt: '',
                      role: 'graph operator',
                      backstory: '',
                      model_profile_id: null,
                      tool_ids: ['graph-tool-full'],
                      memory_ids: ['graph-memory-full'],
                      handoff_agent_ids: [],
                      metadata: {},
                    },
                  ],
                  task_definitions: [
                    ...(workflow.task_definitions ?? []),
                    {
                      id: 'graph-task-full',
                      name: 'Graph Full Task',
                      description: 'Created and configured from graph.',
                      instructions: 'Use graph-owned resources and approval policy.',
                      expected_output: 'Graph-produced output',
                      agent_id: 'graph-agent-full',
                      tool_ids: ['graph-tool-full'],
                      memory_ids: ['graph-memory-full'],
                      depends_on_task_ids: ['task-b'],
                      human_approval_required: true,
                      timeout_seconds: 120,
                      max_retries: 1,
                      model_profile_id: 'profile-graph',
                      max_tokens: 2048,
                      approval_policy: 'required',
                    },
                  ],
                  tool_definitions: [
                    ...(workflow.tool_definitions ?? []),
                    {
                      id: 'graph-tool-full',
                      name: 'graph.full_tool',
                      display_name: 'Graph Full Tool',
                      description: 'Created from graph.',
                    },
                  ],
                  memory_definitions: [
                    ...(workflow.memory_definitions ?? []),
                    {
                      id: 'graph-memory-full',
                      name: 'Graph Full Memory',
                      memory_type: 'workflow',
                      scope: 'workflow',
                    },
                  ],
                  edges: [
                    ...(workflow.edges ?? []),
                    {
                      id: 'edge-task-b-graph-task-full',
                      source_node_id: 'node-task-b',
                      target_node_id: 'node-graph-task-full',
                      edge_type: 'dependency',
                      condition: null,
                      metadata: {},
                    },
                  ],
                  metadata: {
                    ...(workflow.metadata ?? {}),
                    restart_active_executions: true,
                    workflow_artifact_definitions: [
                      {
                        id: 'graph-artifact-full',
                        name: 'Graph Full Artifact',
                        artifact_type: 'report',
                        producer_task_id: 'graph-task-full',
                      },
                    ],
                  },
                })
              }
            >
              Apply Full Graph Workflow Edit
            </button>
            <button type="button" disabled={saveWorkflowDisabled} onClick={onSaveWorkflow}>
              Graph Save Workflow
            </button>
            <button type="button" disabled={runWorkflowDisabled} onClick={onRunWorkflow}>
              Graph Run Workflow
            </button>
            {runtimeControls?.runId && runtimeControls.onResumeRun ? (
              <button
                type="button"
                onClick={() => runtimeControls.onResumeRun?.(runtimeControls.runId as string)}
              >
                Graph Resume Run
              </button>
            ) : null}
            {runtimeControls?.runId && runtimeControls.onRetryTask ? (
              <button
                type="button"
                onClick={() =>
                  runtimeControls.onRetryTask?.(runtimeControls.runId as string, 'task-b')
                }
              >
                Graph Retry Task
              </button>
            ) : null}
            {runtimeControls?.runId && runtimeControls.onResumeFromCheckpoint ? (
              <button
                type="button"
                onClick={() =>
                  runtimeControls.onResumeFromCheckpoint?.(runtimeControls.runId as string)
                }
              >
                Graph Resume Checkpoint
              </button>
            ) : null}
            {runtimeControls?.runId &&
            runtimeControls.approvalToolId &&
            runtimeControls.onApproveTool ? (
              <button
                type="button"
                onClick={() =>
                  runtimeControls.onApproveTool?.(
                    runtimeControls.runId as string,
                    runtimeControls.approvalToolId as string
                  )
                }
              >
                Graph Approve Tool
              </button>
            ) : null}
            {runtimeControls?.canRequestSteering && runtimeControls.onRequestSteering ? (
              <button
                type="button"
                onClick={() => runtimeControls.onRequestSteering?.({ taskId: 'task-b' })}
              >
                Graph Steer Task
              </button>
            ) : null}
            <button type="button" onClick={onStartEditing}>
              Graph Edit Workflow
            </button>
            <button type="button" onClick={() => onSelectApproval?.('task-b')}>
              Select Approval Gate
            </button>
            <button type="button" onClick={() => onSelectAgent?.('agent-1')}>
              Select Graph Agent
            </button>
            <button type="button" onClick={() => onSelectTool?.(selectedToolId)}>
              Select Graph Tool
            </button>
            <button
              type="button"
              onClick={() =>
                onSelectTool?.(
                  workflowGraphToolListSelectionId,
                  selectedToolIds,
                  selectedToolNodeId
                )
              }
            >
              Open Graph Tool List
            </button>
            <button type="button" onClick={() => onSelectMemory?.('memory-1')}>
              Select Graph Memory
            </button>
            <button type="button" onClick={() => onSelectArtifact?.('artifact-1')}>
              Select Graph Artifact
            </button>
            <button
              type="button"
              onClick={() =>
                onSelectEdge?.({
                  id: 'mock-edge-task-a-task-b',
                  source: 'workflow-task-task-a',
                  target: 'workflow-task-task-b',
                  type: 'workflow.dependency',
                  data: {
                    sourceTaskId: 'task-a',
                    targetTaskId: 'task-b',
                    edgeType: 'default',
                  },
                })
              }
            >
              Select Graph Edge
            </button>
            <button
              type="button"
              onClick={() =>
                onSelectEdge?.({
                  id: 'mock-edge-agent-1-task-b',
                  source: 'workflow-agent-agent-1',
                  target: 'workflow-task-task-b',
                  type: 'workflow.assignment',
                  data: {
                    agentId: 'agent-1',
                    taskId: 'task-b',
                  },
                })
              }
            >
              Select Assignment Edge
            </button>
          </>
        );
      })()}
    </div>
  ),
}));

vi.mock('@/components/workflow/WorkflowRunsPanel', () => ({
  default: () => <div>Runs Panel</div>,
}));

vi.mock('@/components/workflow/WorkflowTaskFocusPanel', () => ({
  default: ({
    selectedTask,
    memoryDefinitions = [],
  }: {
    selectedTask: { name: string };
    memoryDefinitions?: Array<{ id: string }>;
  }) => (
    <div>
      Task Focus: {selectedTask.name}
      <span>Task focus memories: {memoryDefinitions.length}</span>
    </div>
  ),
}));

const TabsContext = createContext<string>('builder');

vi.mock('@/components/library/shadcn/accordion', () => ({
  Accordion: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionTrigger: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

vi.mock('@/components/library/shadcn/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect }: { children: ReactNode; onSelect?: () => void }) => (
    <button type="button" onClick={onSelect}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/library/shadcn/tabs', () => ({
  Tabs: ({
    value,
    children,
  }: {
    value: string;
    onValueChange?: (value: string) => void;
    children: ReactNode;
  }) => <TabsContext.Provider value={value}>{children}</TabsContext.Provider>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({
    children,
    value,
    ...props
  }: {
    children: ReactNode;
    value: string;
    [key: string]: unknown;
  }) => (
    <button type="button" data-value={value} {...props}>
      {children}
    </button>
  ),
  TabsContent: ({ children, value }: { children: ReactNode; value: string }) => {
    const activeValue = useContext(TabsContext);
    return activeValue === value ? <div>{children}</div> : null;
  },
}));

vi.mock('@/components/library/shadcn/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode; asChild?: boolean }) => <>{children}</>,
}));

vi.mock('@/components/library/shadcn/button', () => ({
  buttonVariants: () => '',
  Button: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function renderWorkspace(queryClient = createTestQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <WorkflowDetailWorkspace workflowId="workflow-1" />
    </QueryClientProvider>
  );
}

describe('WorkflowDetailWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearch = 'mode=edit&task=task-b';

    workflowsApi.getWorkflow.mockResolvedValue({
      id: 'workflow-1',
      name: 'Workflow One',
      description: 'Workflow description',
      entrypoint: 'node-task-a',
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
      monitoring: {
        enabled: true,
        level: 'standard',
        exempted: false,
        visible_to_main_agent: true,
        mutable_by_main_agent: true,
        default_enabled: true,

        is_main_agent_default_workflow: true,
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
          configured: false,
          run_total_tokens: null,
          workflow_total_tokens: null,
          agent_total_tokens: null,
          warn_ratio: 0.8,
          hard_ratio: 1,
          action: 'warn_only',
        },
        context_compaction: {
          enabled: true,
          persist_context_pack: false,
          persist_context_pack_source: 'global_default',
          preserve_recent_messages: 1,
          oversized_message_tokens: 600,
          min_estimated_tokens_saved: 50,
          max_summary_chars: 5000,
        },
      },
    });
    workflowsApi.getWorkflowRuntimeGovernance.mockResolvedValue({
      workflow_id: 'workflow-1',
      token_budget: {
        configured: false,
        run_total_tokens: null,
        workflow_total_tokens: null,
        agent_total_tokens: null,
        warn_ratio: 0.8,
        hard_ratio: 1,
        action: 'warn_only',
      },
      context_compaction: {
        enabled: true,
        persist_context_pack: false,
        persist_context_pack_source: 'global_default',
        preserve_recent_messages: 1,
        oversized_message_tokens: 600,
        min_estimated_tokens_saved: 50,
        max_summary_chars: 5000,
      },
    });
    workflowsApi.listWorkflowMonitoringEvents.mockResolvedValue({
      workflow_id: 'workflow-1',
      monitoring: {
        enabled: true,
        level: 'standard',
        exempted: false,
        visible_to_main_agent: true,
        mutable_by_main_agent: true,
        default_enabled: true,

        is_main_agent_default_workflow: true,
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
      findings: [],
      proposals: [],
      evaluations: [],
      comparisons: [],
      approval_controls: [],
    });
    runsApi.listRunsForWorkflow.mockResolvedValue([]);
    schedulesApi.listSchedules.mockResolvedValue({ items: [] });
    schedulesApi.createSchedule.mockResolvedValue({ id: 'schedule-1', enabled: true });
    schedulesApi.patchSchedule.mockResolvedValue({ id: 'schedule-1', enabled: true });
    schedulesApi.deleteSchedule.mockResolvedValue({ id: 'schedule-1' });
    schedulesApi.enableSchedule.mockResolvedValue({ id: 'schedule-1', enabled: true });
    schedulesApi.disableSchedule.mockResolvedValue({ id: 'schedule-1', enabled: false });
    schedulesApi.triggerNow.mockResolvedValue({
      schedule: { id: 'schedule-1', enabled: true },
      execution_id: 'run-schedule-1',
      triggered_at: '2026-05-16T00:00:00Z',
    });
    logsApi.listRunEvents.mockResolvedValue({ items: [] });
    memoriesApi.listMemories.mockResolvedValue({ items: [] });
    memoriesApi.listMemoryCatalog.mockResolvedValue({ groups: [] });
    observabilityApi.getWorkflowMetrics.mockResolvedValue({
      workflow_id: 'workflow-1',
      total_tokens: 0,
      estimated_cost: 0,
      context_health: { latest: null },
      budget: { warning_count: 0, exceeded_count: 0 },
      compaction: { event_count: 0 },
    });
    observabilityApi.getModelUsage.mockResolvedValue({ items: [] });
    observabilityApi.getAgentMetrics.mockImplementation(async (agentId: string) => ({
      agent_id: agentId,
      total_tokens: 0,
      context_health: { latest: null },
    }));
    behaviorProfilesApi.listProfiles.mockResolvedValue([]);
    agentsApi.listAgents.mockResolvedValue({ items: [] });
    toolsApi.listTools.mockResolvedValue({ items: [] });
    credentialsApi.listCredentials.mockResolvedValue({ items: [] });
    credentialsApi.getConnectorCredentialCapabilities.mockResolvedValue({ connectors: {} });
    runtimeAdaptersApi.listRuntimeAdapters.mockResolvedValue({
      items: [
        {
          id: 'native',
          name: 'Native Runtime',
          adapter_type: 'native',
        },
        {
          id: 'adapter-a',
          name: 'Adapter A',
          adapter_type: 'test',
        },
      ],
    });
    runsApi.executeWorkflow.mockResolvedValue({
      id: 'run-1',
      status: 'created',
    });
    runsApi.resumeRun.mockResolvedValue({});
    runsApi.retryTask.mockResolvedValue({});
    runsApi.resumeFromCheckpoint.mockResolvedValue({});
    runsApi.approveRun.mockResolvedValue({});
    runsApi.rejectRun.mockResolvedValue({});
    workflowsApi.updateWorkflow.mockImplementation(
      async (_workflowId: string, payload: unknown) => ({
        ...(payload as WorkflowDefinition),
        id: 'workflow-1',
      })
    );
    workflowsApi.validateWorkflow.mockResolvedValue({
      validation_errors: [],
      validation_warnings: [],
    });
    workflowsApi.createWorkflowSteeringApproval.mockResolvedValue({
      workflow_id: 'workflow-1',
      approval: { id: 'steering-1', target_task_id: 'task-b' },
      approval_request: { id: 'approval-steering-1' },
      created: true,
    });
    workflowsApi.listWorkflowVersions.mockResolvedValue({ items: [] });
    workflowsApi.listWorkflowPersonaVersionNotices.mockResolvedValue({ items: [] });
    workflowsApi.useLatestPersonaAgent.mockResolvedValue({
      workflow: { id: 'workflow-1', name: 'Workflow One' },
      notice: null,
    });
    workflowsApi.keepCurrentPersonaAgent.mockResolvedValue({
      workflow: { id: 'workflow-1', name: 'Workflow One' },
      notice: null,
    });
    workflowsApi.promoteWorkflowAgent.mockResolvedValue({
      workflow: { id: 'workflow-1', name: 'Workflow One' },
      agent: { id: 'catalog-agent-1', name: 'Agent One' },
      workflow_updated: true,
      promotion: {
        source_workflow_id: 'workflow-1',
        source_workflow_name: 'Workflow One',
        source_agent_id: 'agent-1',
        global_agent_id: 'catalog-agent-1',
        replaced_workflow_agent: true,
      },
    });
    workflowsApi.getWorkflowSharedMemory.mockResolvedValue({
      enabled: false,
      operator_enabled: false,
      effective_enabled: false,
      memory_filters: {},
      limit_per_layer: {},
      agent_scope: 'workflow',
      agents: [],
    });
    workflowsApi.listWorkflowMemoryLinks.mockResolvedValue({
      workflowId: 'workflow-1',
      items: [],
    });
    workflowsApi.addWorkflowMemoryLink.mockResolvedValue({
      workflow: { id: 'workflow-1', name: 'Workflow One' },
      link: {
        id: 'link-1',
        workflowId: 'workflow-1',
        targetType: 'workflow',
        targetId: null,
        refType: 'memory',
        refId: 'memory-record-1',
        memoryIds: ['memory-record-1'],
        accessMode: 'read',
      },
      items: [],
    });
    workflowsApi.deleteWorkflowMemoryLink.mockResolvedValue({
      deleted: true,
      workflowId: 'workflow-1',
      linkId: 'link-1',
    });
    workflowsApi.updateWorkflowMonitoring.mockResolvedValue({
      workflow: {
        id: 'workflow-1',
        name: 'Workflow One',
        metadata: {
          main_agent_monitoring: {
            allow_self_monitoring: true,
          },
        },
        monitoring: {
          enabled: true,
          level: 'standard',
          exempted: false,
          visible_to_main_agent: true,
          mutable_by_main_agent: true,
          default_enabled: true,

          is_main_agent_default_workflow: true,
          status_label: 'standard_monitoring',
          controls: {
            enabled: true,
            level: 'standard',
            store_run_summaries: false,
            store_failure_summaries: false,
            allow_improvement_proposals: false,
            allow_evaluation_agent_review: false,
            allow_self_monitoring: true,
            safe_to_summarize: false,
            route_improvement_proposals_to_approval: false,
            approval_conversation_id: null,
          },
        },
      },
      monitoring: {
        enabled: true,
        level: 'standard',
        exempted: false,
        visible_to_main_agent: true,
        mutable_by_main_agent: true,
        default_enabled: true,

        is_main_agent_default_workflow: true,
        status_label: 'standard_monitoring',
        controls: {
          enabled: true,
          level: 'standard',
          store_run_summaries: false,
          store_failure_summaries: false,
          allow_improvement_proposals: false,
          allow_evaluation_agent_review: false,
          allow_self_monitoring: true,
          safe_to_summarize: false,
          route_improvement_proposals_to_approval: false,
          approval_conversation_id: null,
        },
      },
    });
    conversationsApi.approveApprovalRequest.mockResolvedValue({
      approval_request: {
        id: 'approval-monitor-1',
        approval_type: 'workflow_update',
        status: 'approved',
        target_type: 'workflow',
        target_id: 'workflow-1',
        requested_by_agent_id: 'main-agent',
        conversation_id: 'conversation-1',
        origin_message_id: 'message-1',
        summary: 'Improve validation evidence',
        created_at: '2026-05-18T00:00:00Z',
        updated_at: '2026-05-18T00:00:00Z',
      },
      message: {
        id: 'message-result',
        conversation_id: 'conversation-1',
        role: 'assistant',
        message_type: 'approval_result',
        content: {},
        created_at: '2026-05-18T00:00:00Z',
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('respects URL-driven edit mode and selected task state', async () => {
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('Header: Workflow One')).toBeInTheDocument();
    });

    expect(screen.getByText('Metadata Editor')).toBeInTheDocument();
    expect(screen.getByText('Graph Canvas: Workflow One')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Builder' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Runs' })).not.toBeInTheDocument();
    expect(screen.getByText('Task Focus: Task B')).toBeInTheDocument();
  });

  it('does not read raw agent list response cache as workflow agent definitions', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.backendAgents(), { items: [] });

    renderWorkspace(queryClient);

    await waitFor(() => {
      expect(screen.getByText('Header: Workflow One')).toBeInTheDocument();
    });
    expect(agentsApi.listAgents).toHaveBeenCalled();
  });

  it('passes workflow memories into the graph selected task panel', async () => {
    workflowsApi.getWorkflow.mockResolvedValue({
      id: 'workflow-1',
      name: 'Workflow One',
      description: 'Workflow description',
      entrypoint: 'node-task-b',
      default_runtime_adapter_id: 'adapter-a',
      allowed_runtime_adapter_ids: ['adapter-a'],
      memory_definitions: [
        {
          id: 'memory-1',
          name: 'Research Memory',
          description: 'Reusable research context.',
          memory_type: 'fact',
          scope: 'workflow',
        },
      ],
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
          tool_ids: [],
          memory_ids: ['memory-1'],
          handoff_agent_ids: [],
          metadata: {},
        },
      ],
      task_definitions: [
        {
          id: 'task-b',
          name: 'Task B',
          description: 'Second task',
          instructions: 'Continue here',
          expected_output: 'Continued',
          agent_id: 'agent-1',
          tool_ids: [],
          memory_ids: ['memory-1'],
          depends_on_task_ids: [],
          human_approval_required: false,
        },
      ],
      nodes: [{ id: 'node-task-b', name: 'Task B', node_type: 'task', task_id: 'task-b' }],
      edges: [],
      tool_definitions: [],
      versioning: {
        version: '1.0.0',
        revision: 1,
        is_published: false,
      },
      metadata: {},
    });
    workflowsApi.updateWorkflowRuntimeGovernance.mockResolvedValue({
      workflow: {
        id: 'workflow-1',
        name: 'Workflow One',
        metadata: {
          runtime_governance: {
            token_budget: {
              run_total_tokens: 1200,
              action: 'compact_context',
            },
            context_compaction: {
              persist_context_pack: true,
            },
          },
        },
        runtime_governance: {
          workflow_id: 'workflow-1',
          token_budget: {
            configured: true,
            run_total_tokens: 1200,
            workflow_total_tokens: null,
            agent_total_tokens: null,
            warn_ratio: 0.8,
            hard_ratio: 1,
            action: 'compact_context',
          },
          context_compaction: {
            enabled: true,
            persist_context_pack: true,
            persist_context_pack_source: 'workflow',
            preserve_recent_messages: 1,
            oversized_message_tokens: 600,
            min_estimated_tokens_saved: 50,
            max_summary_chars: 5000,
          },
        },
        is_published: false,
      },
      runtime_governance: {
        workflow_id: 'workflow-1',
        token_budget: {
          configured: true,
          run_total_tokens: 1200,
          workflow_total_tokens: null,
          agent_total_tokens: null,
          warn_ratio: 0.8,
          hard_ratio: 1,
          action: 'compact_context',
        },
        context_compaction: {
          enabled: true,
          persist_context_pack: true,
          persist_context_pack_source: 'workflow',
          preserve_recent_messages: 1,
          oversized_message_tokens: 600,
          min_estimated_tokens_saved: 50,
          max_summary_chars: 5000,
        },
      },
    });

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');

    expect(screen.getByText('Task focus memories: 1')).toBeInTheDocument();
  });

  it('promotes a selected workflow agent into the global catalog', async () => {
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('Header: Workflow One')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Select Graph Agent' }));
    fireEvent.click(screen.getByRole('button', { name: 'Promote to global' }));

    const globalAgentIdInput = await screen.findByLabelText('Global agent ID');
    fireEvent.change(globalAgentIdInput, { target: { value: 'catalog-agent-1' } });
    fireEvent.click(
      screen.getByLabelText(
        'Replace this workflow agent with the promoted global agent identity after promotion.'
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Promote and replace' }));

    await waitFor(() => {
      expect(workflowsApi.promoteWorkflowAgent).toHaveBeenCalledWith('workflow-1', 'agent-1', {
        global_agent_id: 'catalog-agent-1',
        replace_workflow_agent: true,
      });
    });
  });

  it('renders the graph surface as the only workflow editor surface', async () => {
    currentSearch = '';

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('Header: Workflow One')).toBeInTheDocument();
    });

    expect(screen.getByText('Graph Canvas: Workflow One')).toBeInTheDocument();
    expect(screen.queryByText('Builder Panel: task-b')).not.toBeInTheDocument();
    expect(screen.queryByText('Runs Panel')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Builder' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Runs' })).not.toBeInTheDocument();
  });

  it('can enter edit mode from the graph tab', async () => {
    currentSearch = 'tab=graph';

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Graph Edit Workflow' }));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/workflows/workflow-1?mode=edit', {
        scroll: false,
      });
    });
  });

  it('shows a draft change summary for graph edits before saving', async () => {
    currentSearch = 'mode=edit&tab=graph';

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');
    expect(screen.getByText('Draft Change Summary')).toBeInTheDocument();
    expect(screen.getByText('No draft changes since the last saved workflow.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Apply Graph Edit' }));

    await waitFor(() => {
      expect(screen.getByText('Changed task "Graph Edited Task".')).toBeInTheDocument();
    });
    expect(
      screen.queryByText('No draft changes since the last saved workflow.')
    ).not.toBeInTheDocument();
  });

  it('can fill a graph agent from a published persona source', async () => {
    currentSearch = 'mode=edit&tab=graph';
    agentsApi.listAgents.mockResolvedValue({
      items: [
        {
          id: 'persona-agent-1',
          name: 'Mentor Persona Agent',
          description: 'Persona agent',
          instructions: 'Bring persona context.',
          system_prompt: '',
          role: 'mentor',
          backstory: '',
          model_profile_id: null,
          tool_ids: [],
          handoff_agent_ids: [],
          metadata: {
            generated_from_persona_factory: true,
            persona_slug: 'mentor',
            persona_version_id: 'persona-version-1',
          },
        },
      ],
    });

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Select Graph Agent' }));

    const personaSourceSelect = await screen.findByLabelText('Persona source');
    await waitFor(() => {
      expect(
        Array.from((personaSourceSelect as HTMLSelectElement).options).some((option) =>
          /Mentor Persona Agent/.test(option.textContent ?? '')
        )
      ).toBe(true);
    });
    fireEvent.change(personaSourceSelect, { target: { value: 'persona-agent-1' } });

    await waitFor(() => {
      expect(screen.getByText('Graph agents: Mentor Persona Agent')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Mentor Persona Agent' })).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Role')).toHaveValue('mentor');
    expect(screen.getAllByText('From persona').length).toBeGreaterThan(0);

    const descriptionFields = screen.getAllByLabelText('Description');
    fireEvent.change(descriptionFields[descriptionFields.length - 1], {
      target: { value: 'Workflow-specific mentor description.' },
    });

    await waitFor(() => {
      expect(screen.getByText('Overridden')).toBeInTheDocument();
    });
  });

  it('updates persona-backed graph agents while preserving or replacing overrides intentionally', async () => {
    currentSearch = 'mode=edit&tab=graph';
    workflowsApi.getWorkflow.mockResolvedValue({
      id: 'workflow-1',
      name: 'Workflow One',
      description: 'Workflow description',
      entrypoint: 'node-task-b',
      default_runtime_adapter_id: 'adapter-a',
      allowed_runtime_adapter_ids: ['adapter-a'],
      agent_definitions: [
        {
          id: 'agent-1',
          name: 'Mentor Snapshot',
          description: 'Workflow-specific mentor description.',
          instructions: 'Old persona instructions.',
          system_prompt: '',
          role: 'old mentor',
          backstory: '',
          model_profile_id: null,
          tool_ids: [],
          handoff_agent_ids: [],
          metadata: {
            generated_from_persona_factory: true,
            persona_slug: 'mentor',
            persona_id: 'persona-1',
            persona_version_id: 'persona-version-old',
            persona_source_agent_id: 'persona-agent-latest',
            persona_snapshot_fields: [
              'name',
              'description',
              'instructions',
              'system_prompt',
              'role',
              'backstory',
              'model_profile_id',
              'tool_ids',
              'memory_ids',
              'handoff_agent_ids',
            ],
            persona_field_overrides: ['description'],
          },
        },
      ],
      task_definitions: [
        {
          id: 'task-b',
          name: 'Task B',
          description: 'Second task',
          instructions: 'Continue here',
          expected_output: 'Continued',
          agent_id: 'agent-1',
          tool_ids: [],
          depends_on_task_ids: [],
          human_approval_required: false,
        },
      ],
      nodes: [
        { id: 'node-task-b', name: 'Task B', node_type: 'task', task_id: 'task-b', metadata: {} },
      ],
      edges: [],
      tool_definitions: [],
      versioning: {
        version: '1.0.0',
        revision: 1,
        is_published: false,
      },
      metadata: {},
    });
    agentsApi.listAgents.mockResolvedValue({
      items: [
        {
          id: 'persona-agent-latest',
          name: 'Mentor Latest',
          description: 'Latest persona description.',
          instructions: 'Latest persona instructions.',
          system_prompt: '',
          role: 'latest mentor',
          backstory: '',
          model_profile_id: null,
          tool_ids: [],
          handoff_agent_ids: [],
          metadata: {
            generated_from_persona_factory: true,
            persona_id: 'persona-1',
            persona_slug: 'mentor',
            persona_version_id: 'persona-version-new',
          },
        },
      ],
    });
    workflowsApi.listWorkflowPersonaVersionNotices.mockResolvedValue({
      workflow_id: 'workflow-1',
      workflow_name: 'Workflow One',
      count: 1,
      has_updates: true,
      items: [
        {
          workflow_id: 'workflow-1',
          workflow_name: 'Workflow One',
          agent_id: 'agent-1',
          agent_name: 'Mentor Snapshot',
          persona_id: 'persona-1',
          persona_slug: 'mentor',
          persona_name: 'Mentor',
          status: 'outdated',
          message: 'A newer persona package is available.',
          persona_version_id: 'persona-version-old',
          persona_version: 'old',
          current_persona_version_id: 'persona-version-new',
          current_persona_version: 'new',
          published_agent_id: 'persona-agent-latest',
        },
      ],
    });

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Select Graph Agent' }));

    await screen.findByRole('heading', { name: 'Mentor Snapshot' });
    fireEvent.click(screen.getByRole('button', { name: 'Use latest persona' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Mentor Latest' })).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Role')).toHaveValue('latest mentor');
    const preservedDescriptionFields = screen.getAllByLabelText('Description');
    expect(preservedDescriptionFields[preservedDescriptionFields.length - 1]).toHaveValue(
      'Workflow-specific mentor description.'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Replace all fields' }));

    await waitFor(() => {
      const replacedDescriptionFields = screen.getAllByLabelText('Description');
      expect(replacedDescriptionFields[replacedDescriptionFields.length - 1]).toHaveValue(
        'Latest persona description.'
      );
    });
  });

  it('creates a new graph agent directly from a persona selection', async () => {
    currentSearch = 'mode=edit&tab=graph';
    agentsApi.listAgents.mockResolvedValue({
      items: [
        {
          id: 'persona-agent-1',
          name: 'Mentor Persona Agent',
          description: 'Persona agent',
          instructions: 'Bring persona context.',
          system_prompt: '',
          role: 'mentor',
          backstory: '',
          model_profile_id: null,
          tool_ids: [],
          handoff_agent_ids: [],
          metadata: {
            generated_from_persona_factory: true,
            persona_slug: 'mentor',
            persona_version_id: 'persona-version-1',
          },
        },
      ],
    });

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');
    const personaCreateSelect = await screen.findByLabelText('Persona agent');
    fireEvent.change(personaCreateSelect, { target: { value: 'persona-agent-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Persona Agent' }));

    await waitFor(() => {
      expect(screen.getByText('Graph agents: Agent One, Mentor Persona Agent')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'Mentor Persona Agent' })).toBeInTheDocument();
  });

  it('passes edit validation issues into the graph tab and blocks running invalid drafts', async () => {
    currentSearch = 'mode=edit&tab=graph';
    workflowsApi.getWorkflow.mockResolvedValue({
      id: 'workflow-1',
      name: 'Workflow One',
      description: 'Workflow description',
      entrypoint: 'node-task-a',
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
          tool_ids: [],
          handoff_agent_ids: [],
          metadata: {},
        },
      ],
      task_definitions: [
        {
          id: 'task-a',
          name: 'Task A',
          description: '',
          instructions: 'Start here',
          expected_output: 'Started',
          agent_id: 'agent-1',
          tool_ids: [],
          depends_on_task_ids: [],
          human_approval_required: false,
        },
      ],
      nodes: [
        { id: 'node-task-a', name: 'Task A', node_type: 'task', task_id: 'task-a', metadata: {} },
      ],
      edges: [],
      tool_definitions: [],
      versioning: {
        version: '1.0.0',
        revision: 1,
        is_published: false,
      },
      metadata: {},
    });

    renderWorkspace();

    await screen.findByText('Header: Workflow One');
    expect(screen.getByText('Graph validation issues: 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Run Workflow' }));

    expect(runsApi.executeWorkflow).not.toHaveBeenCalled();
  });

  it('shows selected task resource warnings in the graph drawer', async () => {
    currentSearch = 'mode=edit&task=task-b';
    workflowsApi.getWorkflow.mockResolvedValue({
      id: 'workflow-1',
      name: 'Workflow One',
      description: 'Workflow description',
      entrypoint: 'node-task-a',
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
          agent_id: 'agent-missing',
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
      memory_definitions: [],
      versioning: {
        version: '1.0.0',
        revision: 1,
        is_published: false,
      },
      metadata: {},
    });

    renderWorkspace();

    await screen.findByText('Header: Workflow One');
    expect(screen.getByText('Resource warnings')).toBeInTheDocument();
    expect(
      screen.getByText('Task "Task B" is assigned to missing agent "agent-missing".')
    ).toBeInTheDocument();
  });

  it('shows selected task blocked approval warnings in the graph drawer', async () => {
    currentSearch = 'task=task-b';
    workflowsApi.getWorkflow.mockResolvedValue({
      id: 'workflow-1',
      name: 'Workflow One',
      description: 'Workflow description',
      entrypoint: 'node-task-a',
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
          human_approval_required: true,
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
      memory_definitions: [],
      versioning: {
        version: '1.0.0',
        revision: 1,
        is_published: false,
      },
      metadata: {},
    });
    runsApi.listRunsForWorkflow.mockResolvedValue([
      {
        id: 'run-approval-1',
        workflowId: 'workflow-1',
        status: 'waiting_for_approval',
        currentNodeId: 'node-task-b',
        updatedAt: '2026-05-21T00:00:02.000Z',
      },
    ]);

    renderWorkspace();

    await screen.findByText('Header: Workflow One');
    expect(screen.getByText('Resource warnings')).toBeInTheDocument();
    expect(
      screen.getByText('Task "Task B" is blocked waiting for human approval.')
    ).toBeInTheDocument();
  });

  it('opens approval gates in an approval-specific graph drawer tied to their task', async () => {
    currentSearch = 'tab=graph';

    renderWorkspace();

    await screen.findByText('Header: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Select Approval Gate' }));

    expect(
      await screen.findByRole('dialog', { name: 'Selected Approval Gate' })
    ).toBeInTheDocument();
    expect(screen.getByText('Approval node')).toBeInTheDocument();
    expect(screen.getByText('Linked to Task B')).toBeInTheDocument();
    expect(
      screen.getByText(
        'This approval node is owned by the task and connected with a Requires approval edge. Move the approval node to improve graph layout; update the task approval setting below to add or remove the gate.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Task Focus: Task B')).toBeInTheDocument();

    currentSearch = 'tab=graph&task=task-b';
    fireEvent.click(screen.getByRole('button', { name: 'Focus linked task' }));

    expect(await screen.findByRole('dialog', { name: 'Selected Task' })).toBeInTheDocument();
    expect(screen.getByText('No approval gate')).toBeInTheDocument();
  });

  it('opens an approval gate from an approval-backed task drawer', async () => {
    currentSearch = 'mode=edit&tab=graph&task=task-b';
    const loadDefaultWorkflow = workflowsApi.getWorkflow.getMockImplementation();
    workflowsApi.getWorkflow.mockImplementation(async () => {
      const workflow = (await loadDefaultWorkflow?.('workflow-1')) as WorkflowDefinition;
      return {
        ...workflow,
        task_definitions: (workflow.task_definitions ?? []).map((task) =>
          task.id === 'task-b' ? { ...task, human_approval_required: true } : task
        ),
      };
    });

    renderWorkspace();

    expect(await screen.findByRole('dialog', { name: 'Selected Task' })).toBeInTheDocument();
    expect(screen.getByText('Requires human approval')).toBeInTheDocument();
    expect(
      screen.getByText(
        'This task has a visible approval node connected by a Requires approval edge.'
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Focus approval gate' }));

    expect(
      await screen.findByRole('dialog', { name: 'Selected Approval Gate' })
    ).toBeInTheDocument();
    expect(screen.getByText('Linked to Task B')).toBeInTheDocument();
  });

  it('resumes paused workflow runs from graph runtime controls', async () => {
    currentSearch = 'tab=graph';
    runsApi.listRunsForWorkflow.mockResolvedValue([
      {
        id: 'run-paused-1',
        workflowId: 'workflow-1',
        status: 'paused',
        currentNodeId: 'node-task-b',
        updatedAt: '2026-05-21T00:00:02.000Z',
      },
    ]);

    renderWorkspace();

    fireEvent.click(await screen.findByRole('button', { name: 'Graph Resume Run' }));

    await waitFor(() => {
      expect(runsApi.resumeRun).toHaveBeenCalledWith('run-paused-1');
    });
  });

  it('retries failed task nodes from graph runtime controls', async () => {
    currentSearch = 'tab=graph';
    runsApi.listRunsForWorkflow.mockResolvedValue([
      {
        id: 'run-failed-1',
        workflowId: 'workflow-1',
        status: 'failed',
        currentNodeId: 'node-task-b',
        updatedAt: '2026-05-21T00:00:02.000Z',
      },
    ]);
    logsApi.listRunEvents.mockResolvedValue({
      items: [
        {
          id: 'event-failed-task-b',
          execution_id: 'run-failed-1',
          workflow_id: 'workflow-1',
          event_type: 'agent.step.failed',
          timestamp: '2026-05-21T00:00:03.000Z',
          sequence: 1,
          task_id: 'task-b',
          status: 'failed',
          payload: {
            error: 'Task failed',
          },
        },
      ],
    });

    renderWorkspace();

    fireEvent.click(await screen.findByRole('button', { name: 'Graph Retry Task' }));

    await waitFor(() => {
      expect(runsApi.retryTask).toHaveBeenCalledWith(
        'run-failed-1',
        'task-b',
        'Retried from failed graph task node.'
      );
    });
  });

  it('resumes failed workflow runs from the latest graph checkpoint', async () => {
    currentSearch = 'tab=graph';
    runsApi.listRunsForWorkflow.mockResolvedValue([
      {
        id: 'run-checkpoint-1',
        workflowId: 'workflow-1',
        status: 'failed',
        currentNodeId: 'node-task-b',
        updatedAt: '2026-05-21T00:00:02.000Z',
        outputPayload: {
          node_outputs: {
            'node-task-a': 'Task A output',
          },
        },
      },
    ]);

    renderWorkspace();

    fireEvent.click(await screen.findByRole('button', { name: 'Graph Resume Checkpoint' }));

    await waitFor(() => {
      expect(runsApi.resumeFromCheckpoint).toHaveBeenCalledWith(
        'run-checkpoint-1',
        'Resumed from latest graph checkpoint.'
      );
    });
  });

  it('saves workflow changes applied from the graph tab', async () => {
    currentSearch = 'mode=edit&tab=graph';

    renderWorkspace();

    await screen.findByText('Header: Workflow One');
    expect(screen.getByText('Graph tasks: Task A, Task B')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Apply Graph Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Graph Save Workflow' }));

    await waitFor(() => {
      expect(workflowsApi.updateWorkflow).toHaveBeenCalledWith(
        'workflow-1',
        expect.objectContaining({
          task_definitions: expect.arrayContaining([
            expect.objectContaining({
              id: 'task-b',
              name: 'Graph Edited Task',
              description: 'Edited from graph.',
              depends_on_task_ids: [],
            }),
          ]),
          edges: [],
        })
      );
    });
  });

  it('persists selected graph node review notes in workflow metadata', async () => {
    currentSearch = 'mode=edit&tab=graph&task=task-b';

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');
    fireEvent.change(screen.getByLabelText('Review Note'), {
      target: { value: 'Needs SME review before saving.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Graph Save Workflow' }));

    await waitFor(() => {
      expect(workflowsApi.updateWorkflow).toHaveBeenCalledWith(
        'workflow-1',
        expect.objectContaining({
          metadata: expect.objectContaining({
            workflow_graph_review_notes: expect.arrayContaining([
              expect.objectContaining({
                target_type: 'task',
                target_id: 'task-b',
                note: 'Needs SME review before saving.',
                updated_at: expect.any(String),
                updated_by: 'user-1',
              }),
            ]),
          }),
        })
      );
    });
  });

  it('creates, updates, and saves a workflow entirely from graph controls', async () => {
    currentSearch = 'mode=edit&tab=graph';
    workflowsApi.updateWorkflow.mockImplementation(async (_workflowId, nextWorkflow) => {
      const saved = {
        ...(nextWorkflow as WorkflowDefinition),
        id: 'workflow-1',
      };
      workflowsApi.getWorkflow.mockResolvedValue(saved);
      return saved;
    });

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Apply Full Graph Workflow Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Graph Save Workflow' }));

    let savedWorkflow: WorkflowDefinition | undefined;
    await waitFor(() => {
      expect(workflowsApi.updateWorkflow).toHaveBeenCalled();
      savedWorkflow = workflowsApi.updateWorkflow.mock.calls.at(-1)?.[1] as WorkflowDefinition;
      expect(savedWorkflow.task_definitions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'graph-task-full',
            name: 'Graph Full Task',
            agent_id: 'graph-agent-full',
            tool_ids: ['graph-tool-full'],
            memory_ids: ['graph-memory-full'],
            depends_on_task_ids: ['task-b'],
            human_approval_required: true,
            timeout_seconds: 120,
            max_retries: 1,
            model_profile_id: 'profile-graph',
            max_tokens: 2048,
            approval_policy: 'required',
          }),
        ])
      );
    });

    expect(savedWorkflow?.agent_definitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'graph-agent-full',
          name: 'Graph Full Agent',
          tool_ids: ['graph-tool-full'],
          memory_ids: ['graph-memory-full'],
        }),
      ])
    );
    expect(savedWorkflow?.tool_definitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'graph-tool-full',
          display_name: 'Graph Full Tool',
        }),
      ])
    );
    expect(savedWorkflow?.memory_definitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'graph-memory-full',
          name: 'Graph Full Memory',
          memory_type: 'workflow',
          scope: 'workflow',
        }),
      ])
    );
    expect(savedWorkflow?.metadata).toEqual(
      expect.objectContaining({
        restart_active_executions: true,
      })
    );
  });

  it('keeps runtime streams, monitoring events, and observability metrics out of graph save payloads', async () => {
    currentSearch = 'tab=graph';
    runsApi.listRunsForWorkflow.mockResolvedValue([
      {
        id: 'run-separate-1',
        workflowId: 'workflow-1',
        status: 'running',
        currentNodeId: 'node-task-b',
        updatedAt: '2026-05-21T00:00:02.000Z',
      },
    ]);
    logsApi.listRunEvents.mockResolvedValue({
      items: [
        {
          id: 'execution-event-separate-1',
          execution_id: 'run-separate-1',
          workflow_id: 'workflow-1',
          task_id: 'task-b',
          event_type: 'task.failed',
          timestamp: '2026-05-21T00:00:03.000Z',
          sequence: 3,
          payload: {
            error: 'Runtime stream should stay render-only.',
          },
        },
      ],
    });
    workflowsApi.listWorkflowMonitoringEvents.mockResolvedValue({
      workflow_id: 'workflow-1',
      monitoring: {
        enabled: true,
        level: 'standard',
        exempted: false,
        visible_to_main_agent: true,
        mutable_by_main_agent: true,
        default_enabled: true,
        is_main_agent_default_workflow: true,
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
      findings: [
        { id: 'monitoring-finding-separate-1', summary: 'Keep monitoring data separate.' },
      ],
      proposals: [],
      evaluations: [],
      comparisons: [],
      approval_controls: [],
    });
    observabilityApi.getWorkflowMetrics.mockResolvedValue({
      workflow_id: 'workflow-1',
      total_tokens: 98765,
      estimated_cost: 12.34,
      context_health: {
        latest: {
          status: 'warning',
        },
      },
      budget: {
        warning_count: 2,
        exceeded_count: 1,
      },
      compaction: {
        event_count: 4,
      },
    });
    observabilityApi.getModelUsage.mockResolvedValue({
      items: [
        {
          provider: 'openai',
          model: 'gpt-separate-save',
          total_tokens: 4321,
        },
      ],
    });
    observabilityApi.getAgentMetrics.mockResolvedValue({
      agent_id: 'agent-1',
      total_tokens: 12345,
      context_health: {
        latest: {
          status: 'warning',
        },
      },
    });

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');
    await waitFor(() => {
      expect(screen.getByText(/Graph runtime events: [1-9]/)).toBeInTheDocument();
    });
    expect(screen.getByText('Graph agent metrics: 1')).toBeInTheDocument();
    expect(logsApi.listRunEvents).toHaveBeenCalledWith('run-separate-1');
    expect(observabilityApi.getWorkflowMetrics).toHaveBeenCalledWith('workflow-1');
    expect(workflowsApi.listWorkflowMonitoringEvents).toHaveBeenCalledWith('workflow-1');

    fireEvent.click(screen.getByRole('button', { name: 'Graph Edit Workflow' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply Graph Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Graph Save Workflow' }));

    await waitFor(() => {
      expect(workflowsApi.updateWorkflow).toHaveBeenCalled();
    });

    const savedWorkflow = workflowsApi.updateWorkflow.mock.calls.at(-1)?.[1] as WorkflowDefinition;
    expect(savedWorkflow.task_definitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'task-b',
          name: 'Graph Edited Task',
        }),
      ])
    );
    expect(savedWorkflow.metadata).toEqual(
      expect.objectContaining({
        execution_host: 'local',
        restart_active_executions: false,
      })
    );
    expect(savedWorkflow.monitoring).toEqual(
      expect.objectContaining({
        status_label: 'standard_monitoring',
      })
    );

    const serializedSavePayload = JSON.stringify(savedWorkflow);
    expect(serializedSavePayload).not.toContain('run-separate-1');
    expect(serializedSavePayload).not.toContain('execution-event-separate-1');
    expect(serializedSavePayload).not.toContain('Runtime stream should stay render-only');
    expect(serializedSavePayload).not.toContain('monitoring-finding-separate-1');
    expect(serializedSavePayload).not.toContain('Keep monitoring data separate');
    expect(serializedSavePayload).not.toContain('gpt-separate-save');
    expect(serializedSavePayload).not.toContain('98765');
    expect(serializedSavePayload).not.toContain('12345');
  });

  it('saves connector bindings from the graph tool drawer', async () => {
    currentSearch = 'mode=edit&tab=graph';
    toolsApi.listTools.mockResolvedValue({
      items: [
        {
          id: 'tool-discord-send',
          name: 'Discord Send Message',
          description: 'Send a message to Discord.',
          tool_type: 'python_function',
          input_schema: { type: 'object' },
          output_schema: { type: 'object' },
          implementation: {
            target: 'app.tools.discord',
            callable_name: 'send_message',
            config: { provider: 'discord' },
          },
          security: {},
          tags: ['connector'],
        },
        {
          id: 'tool-format-summary',
          name: 'Format Summary',
          description: 'Format a summary for handoff.',
          tool_type: 'python_function',
          input_schema: { type: 'object' },
          output_schema: { type: 'object' },
          implementation: {
            target: 'app.tools.formatter',
            callable_name: 'format_summary',
            config: {},
          },
          security: {},
          tags: [],
        },
      ],
    });
    credentialsApi.listCredentials.mockResolvedValue({
      items: [
        {
          id: 'credential-discord-support',
          name: 'Support Discord Bot',
          provider: 'discord-bot',
          metadata: {
            purpose: 'support_delivery',
            guild_id: 'guild-456',
            channel_id: 'channel-123',
          },
        },
        {
          id: 'credential-telegram-support',
          name: 'Support Telegram Bot',
          provider: 'telegram-bot',
          metadata: {
            chat_id: 'telegram-chat-123',
          },
        },
      ],
    });
    credentialsApi.getConnectorCredentialCapabilities.mockResolvedValue({
      connectors: {
        'discord-bot': {
          backendKey: 'discord-bot',
          displayName: 'Discord',
          targetScopeMetadata: [
            { key: 'guild_id', label: 'Guild ID', required: false },
            { key: 'channel_id', label: 'Channel ID', required: true },
          ],
        },
        'telegram-bot': {
          backendKey: 'telegram-bot',
          displayName: 'Telegram',
          targetScopeMetadata: [{ key: 'chat_id', label: 'Chat ID', required: true }],
        },
      },
    });

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Open Graph Tool List' }));

    await screen.findByText('Discord Send Message');
    await screen.findByText('Format Summary');
    expect(screen.getAllByText('Tool connector binding')).toHaveLength(1);
    expect(screen.getAllByLabelText('Provider').at(-1)).toHaveValue('Discord');
    const credentialSelect = screen.getAllByLabelText('Credential').at(-1) as HTMLSelectElement;
    const credentialOptions = Array.from(credentialSelect.options).map(
      (option) => option.textContent ?? ''
    );
    expect(credentialOptions.some((option) => option.includes('Support Discord Bot'))).toBe(true);
    expect(credentialOptions.some((option) => option.includes('Support Telegram Bot'))).toBe(false);
    fireEvent.change(credentialSelect, {
      target: { value: 'credential-discord-support' },
    });
    expect(screen.getAllByLabelText('Purpose').at(-1)).toHaveValue('support_delivery');
    expect(screen.getAllByLabelText('Guild ID').at(-1)).toHaveValue('guild-456');
    expect(screen.getAllByLabelText('Channel ID').at(-1)).toHaveValue('channel-123');
    fireEvent.click(screen.getByRole('button', { name: 'Save binding' }));
    fireEvent.click(screen.getByRole('button', { name: 'Graph Save Workflow' }));

    await waitFor(() => {
      expect(workflowsApi.updateWorkflow).toHaveBeenCalledWith(
        'workflow-1',
        expect.objectContaining({
          tool_definitions: expect.arrayContaining([
            expect.objectContaining({
              id: 'tool-discord-send',
              security: expect.objectContaining({
                connector_bindings: [
                  expect.objectContaining({
                    provider: 'discord-bot',
                    credential_id: 'credential-discord-support',
                    purpose: 'support_delivery',
                    target_scope: {
                      guild_id: 'guild-456',
                      channel_id: 'channel-123',
                    },
                  }),
                ],
              }),
            }),
          ]),
        })
      );
    });
  });

  it('lets the generic HTTP request tool show and save a connector binding without a preset provider hint', async () => {
    currentSearch = 'mode=edit&tab=graph';
    toolsApi.listTools.mockResolvedValue({
      items: [
        {
          id: 'agency.http.request',
          name: 'send_http_request',
          display_name: 'Send HTTP Request',
          description: 'Send an HTTP request.',
          tool_type: 'python_function',
          input_schema: { type: 'object' },
          output_schema: { type: 'object' },
          implementation: {
            target: 'app.tools.http',
            callable_name: 'send_http_request',
            config: {},
          },
          security: {},
          tags: ['connector'],
        },
        {
          id: 'tool-format-summary',
          name: 'Format Summary',
          description: 'Format a summary for handoff.',
          tool_type: 'python_function',
          input_schema: { type: 'object' },
          output_schema: { type: 'object' },
          implementation: {
            target: 'app.tools.formatter',
            callable_name: 'format_summary',
            config: {},
          },
          security: {},
          tags: [],
        },
      ],
    });
    credentialsApi.listCredentials.mockResolvedValue({
      items: [
        {
          id: 'credential-discord-support',
          name: 'Support Discord Bot',
          provider: 'discord-bot',
          metadata: {
            purpose: 'request_delivery',
            guild_id: 'guild-456',
            channel_id: 'channel-123',
          },
        },
      ],
    });
    credentialsApi.getConnectorCredentialCapabilities.mockResolvedValue({
      connectors: {
        'discord-bot': {
          backendKey: 'discord-bot',
          displayName: 'Discord',
          targetScopeMetadata: [
            { key: 'guild_id', label: 'Guild ID', required: false },
            { key: 'channel_id', label: 'Channel ID', required: true },
          ],
        },
      },
    });

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Open Graph Tool List' }));

    await screen.findByText('Send HTTP Request');
    expect(screen.getAllByText('Tool connector binding')).toHaveLength(1);

    const providerSelect = screen.getByLabelText('Provider') as HTMLSelectElement;
    expect(providerSelect).toHaveValue('');
    fireEvent.change(providerSelect, {
      target: { value: 'discord-bot' },
    });

    const credentialSelect = screen.getByLabelText('Credential') as HTMLSelectElement;
    await waitFor(() => {
      expect(credentialSelect).toHaveValue('credential-discord-support');
    });
    expect(screen.getByLabelText('Guild ID')).toHaveValue('guild-456');
    expect(screen.getByLabelText('Channel ID')).toHaveValue('channel-123');
    expect(screen.getByLabelText('Purpose')).toHaveValue('request_delivery');
    fireEvent.click(screen.getByRole('button', { name: 'Save binding' }));
    fireEvent.click(screen.getByRole('button', { name: 'Graph Save Workflow' }));

    await waitFor(() => {
      expect(workflowsApi.updateWorkflow).toHaveBeenCalledWith(
        'workflow-1',
        expect.objectContaining({
          tool_definitions: expect.arrayContaining([
            expect.objectContaining({
              id: 'agency.http.request',
              security: expect.objectContaining({
                connector_bindings: [
                  expect.objectContaining({
                    provider: 'discord-bot',
                    credential_id: 'credential-discord-support',
                    purpose: 'request_delivery',
                  }),
                ],
              }),
            }),
          ]),
        })
      );
    });
  });

  it('shows provider-specific setup guidance when a connector tool has no credentials', async () => {
    currentSearch = 'mode=edit&tab=graph';
    toolsApi.listTools.mockResolvedValue({
      items: [
        {
          id: 'tool-discord-send',
          name: 'Discord Send Message',
          description: 'Send a message to Discord.',
          tool_type: 'python_function',
          input_schema: { type: 'object' },
          output_schema: { type: 'object' },
          implementation: {
            target: 'app.tools.discord',
            callable_name: 'send_message',
            config: { provider: 'discord' },
          },
          security: {},
          tags: ['connector'],
        },
      ],
    });
    credentialsApi.listCredentials.mockResolvedValue({ items: [] });
    credentialsApi.getConnectorCredentialCapabilities.mockResolvedValue({
      connectors: {
        'discord-bot': {
          backendKey: 'discord-bot',
          displayName: 'Discord',
          providerAliases: ['discord'],
          targetScopeMetadata: [{ key: 'channel_id', label: 'Channel ID', required: true }],
        },
      },
    });

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Open Graph Tool List' }));

    await screen.findByText('Discord Send Message');
    expect(screen.getAllByLabelText('Provider').at(-1)).toHaveValue('Discord');
    expect(screen.getByText('No Discord credentials are saved yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set up Discord' })).toHaveAttribute(
      'href',
      '/integrations?integration-tab=communications&integration-connector=communications-discord'
    );
    expect(screen.getByRole('button', { name: 'Save binding' })).toBeDisabled();
  });

  it('does not render workflow-level connector defaults in metadata', async () => {
    currentSearch = 'mode=edit&tab=graph';

    renderWorkspace();

    await screen.findByText('Header: Workflow One');

    expect(screen.queryByText('Workflow Connector Default')).not.toBeInTheDocument();
    expect(screen.queryByText('Workflow Connector Fallback')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save workflow default' })).not.toBeInTheDocument();
  });

  it('runs workflows from the graph tab and replays the latest execution without leaving the graph', async () => {
    currentSearch = 'tab=graph';
    runsApi.listRunsForWorkflow.mockResolvedValueOnce([]).mockResolvedValue([
      {
        id: 'run-1',
        workflowId: 'workflow-1',
        status: 'running',
        currentNodeId: 'node-task-b',
        updatedAt: '2026-05-21T00:00:02.000Z',
      },
    ]);
    logsApi.listRunEvents.mockResolvedValue({
      items: [
        {
          id: 'execution-event-run-1',
          execution_id: 'run-1',
          workflow_id: 'workflow-1',
          task_id: 'task-b',
          event_type: 'task.started',
          timestamp: '2026-05-21T00:00:03.000Z',
          sequence: 1,
          payload: {
            input: { topic: 'graph run' },
          },
        },
      ],
    });

    renderWorkspace();

    await screen.findByText('Header: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Graph Run Workflow' }));

    await waitFor(() => {
      expect(runsApi.executeWorkflow).toHaveBeenCalledWith('workflow-1', 'adapter-a', 'local');
    });
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByText('Graph Canvas: Workflow One')).toBeInTheDocument();
    await waitFor(() => {
      expect(logsApi.listRunEvents).toHaveBeenCalledWith('run-1');
    });
    expect(screen.getByText(/Graph runtime events: [1-9]/)).toBeInTheDocument();
  });

  it('blocks graph runs when backend validation returns errors', async () => {
    currentSearch = 'tab=graph';
    workflowsApi.validateWorkflow.mockResolvedValue({
      validation_errors: [
        {
          code: 'entrypoint.missing',
          message: 'Entrypoint node does not exist',
          severity: 'error',
        },
      ],
      validation_warnings: [],
    });

    renderWorkspace();

    await screen.findByText('Header: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Graph Run Workflow' }));

    await waitFor(() => {
      expect(workflowsApi.validateWorkflow).toHaveBeenCalled();
    });
    expect(runsApi.executeWorkflow).not.toHaveBeenCalled();
    expect(screen.getByText('Backend workflow validation failed')).toBeInTheDocument();
    expect(screen.getByText(/Entrypoint node does not exist/)).toBeInTheDocument();
  });

  it('keeps save errors visible with a retry affordance', async () => {
    currentSearch = 'mode=edit&tab=graph';
    workflowsApi.updateWorkflow.mockRejectedValue(new Error('Backend save rejected'));

    renderWorkspace();

    await screen.findByText('Header: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Graph Save Workflow' }));

    await waitFor(() => {
      expect(screen.getByText(/Failed to save workflow/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Backend save rejected/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('passes workflow run activity into the graph runtime overlay', async () => {
    currentSearch = 'tab=graph';
    runsApi.listRunsForWorkflow.mockResolvedValue([
      {
        id: 'run-activity-1',
        workflowId: 'workflow-1',
        status: 'running',
        currentNodeId: 'node-task-b',
        updatedAt: '2026-05-21T00:00:02.000Z',
      },
    ]);

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');
    expect(screen.getByText('Graph runtime events: 4')).toBeInTheDocument();
  });

  it('passes execution event payloads into the graph runtime overlay', async () => {
    currentSearch = 'tab=graph';
    runsApi.listRunsForWorkflow.mockResolvedValue([
      {
        id: 'run-activity-1',
        workflowId: 'workflow-1',
        status: 'running',
        currentNodeId: 'node-task-b',
        updatedAt: '2026-05-21T00:00:02.000Z',
      },
    ]);
    logsApi.listRunEvents.mockResolvedValue({
      items: [
        {
          id: 'execution-event-task-b-started',
          execution_id: 'run-activity-1',
          workflow_id: 'workflow-1',
          task_id: 'task-b',
          event_type: 'task.started',
          timestamp: '2026-05-21T00:00:03.000Z',
          sequence: 3,
          payload: {
            input: { topic: 'runtime graph' },
          },
        },
      ],
    });

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');
    await waitFor(() => {
      expect(screen.getByText('Graph runtime events: 8')).toBeInTheDocument();
    });
    expect(logsApi.listRunEvents).toHaveBeenCalledWith('run-activity-1');
  });

  it('opens graph agents in the side drawer and edits profile without tool access controls', async () => {
    currentSearch = 'mode=edit&tab=graph';
    behaviorProfilesApi.listProfiles.mockResolvedValue([{ id: 'profile-1', name: 'GPT Profile' }]);

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Select Graph Agent' }));

    expect(screen.getByRole('heading', { name: 'Agent One' })).toBeInTheDocument();
    expect(screen.queryByText('Tool Access')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Instructions')).toHaveValue('Do work');
    fireEvent.change(screen.getByLabelText('Instructions'), {
      target: { value: 'Follow the updated graph-mode instructions.' },
    });
    fireEvent.change(screen.getByLabelText('Model profile'), { target: { value: 'profile-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Graph Save Workflow' }));

    await waitFor(() => {
      expect(workflowsApi.updateWorkflow).toHaveBeenCalledWith(
        'workflow-1',
        expect.objectContaining({
          agent_definitions: expect.arrayContaining([
            expect.objectContaining({
              id: 'agent-1',
              instructions: 'Follow the updated graph-mode instructions.',
              model_profile_id: 'profile-1',
              tool_ids: [],
            }),
          ]),
        })
      );
    });
  });

  it('edits persisted agent guardrails from the graph agent drawer', async () => {
    currentSearch = 'mode=edit&tab=graph';

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Select Graph Agent' }));

    expect(screen.getByRole('heading', { name: 'Agent One' })).toBeInTheDocument();
    expect(
      screen.getByText('No guardrails are configured for this workflow agent.')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add guardrail' }));
    fireEvent.change(screen.getAllByLabelText('Name').at(-1) as HTMLElement, {
      target: { value: 'Approval boundary' },
    });
    fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'tool' } });
    fireEvent.change(screen.getAllByLabelText('Description').at(-1) as HTMLElement, {
      target: { value: 'Require approval before risky tool use.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Graph Save Workflow' }));

    await waitFor(() => {
      expect(workflowsApi.updateWorkflow).toHaveBeenCalledWith(
        'workflow-1',
        expect.objectContaining({
          agent_definitions: expect.arrayContaining([
            expect.objectContaining({
              id: 'agent-1',
              guardrails: [
                expect.objectContaining({
                  name: 'Approval boundary',
                  mode: 'tool',
                  description: 'Require approval before risky tool use.',
                }),
              ],
            }),
          ]),
        })
      );
    });
  });

  it('uses catalog groups for selected graph agent memory assignment', async () => {
    currentSearch = 'mode=edit&tab=graph';
    workflowsApi.listWorkflowMemoryLinks.mockResolvedValue({
      workflowId: 'workflow-1',
      items: [
        {
          id: 'agent-link-existing',
          workflowId: 'workflow-1',
          targetType: 'agent',
          targetId: 'agent-1',
          refType: 'memory',
          refId: 'agent-memory-existing',
          memoryIds: ['agent-memory-existing'],
          accessMode: 'read',
          label: 'Existing agent memory',
        },
      ],
    });
    memoriesApi.listMemoryCatalog.mockResolvedValue({
      groups: [
        {
          key: 'compact_packs',
          label: 'Compact Packs',
          count: 1,
          items: [
            {
              id: 'agent-memory-1',
              refType: 'memory',
              label: 'Agent handoff pack',
              summary: 'Operational handoff context.',
              preview: 'Operational handoff context.',
              memoryType: 'context_pack',
              source: 'conversation_compact',
              scope: 'workflow',
              status: 'active',
              tags: [],
              sensitive: false,
              mode: 'handoff',
              memoryIds: ['agent-memory-1'],
              chunkCount: 1,
              embedded: true,
              canLink: true,
              excluded: false,
              excludedFor: [],
            },
          ],
        },
      ],
    });

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Select Graph Agent' }));

    expect((await screen.findAllByText('Memory Access')).length).toBeGreaterThan(0);
    expect(screen.getByText('Existing agent memory')).toBeInTheDocument();
    expect(await screen.findByText('Agent handoff pack')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => {
      expect(workflowsApi.addWorkflowMemoryLink).toHaveBeenCalledWith(
        'workflow-1',
        expect.objectContaining({
          targetType: 'agent',
          targetId: 'agent-1',
          refType: 'memory',
          refId: 'agent-memory-1',
        })
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => {
      expect(workflowsApi.deleteWorkflowMemoryLink).toHaveBeenCalledWith(
        'workflow-1',
        'agent-link-existing'
      );
    });
  });

  it('opens graph tool nodes in the side drawer', async () => {
    currentSearch = 'mode=edit&tab=graph';
    workflowsApi.getWorkflow.mockResolvedValue({
      id: 'workflow-1',
      name: 'Workflow One',
      description: 'Workflow description',
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
          description: 'Uses the webhook tool.',
          instructions: 'Send the webhook.',
          expected_output: 'Posted',
          agent_id: 'agent-1',
          tool_ids: ['tool-1'],
          depends_on_task_ids: [],
          human_approval_required: false,
        },
      ],
      nodes: [],
      edges: [],
      tool_definitions: [
        {
          id: 'tool-1',
          name: 'search_tool',
          display_name: 'Search Tool',
          description: 'Searches documents.',
          tool_type: 'workflow',
          security: {
            connector_bindings: [
              {
                provider: 'discord-bot',
                credential_id: 'credential-discord-support',
                purpose: 'delivery',
              },
            ],
          },
        },
      ],
      versioning: {
        version: '1.0.0',
        revision: 1,
        is_published: false,
      },
      metadata: {},
    });

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Select Graph Tool' }));

    expect(screen.getByRole('heading', { name: '1 workflow tools' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Equipped tools' })).toBeInTheDocument();
    expect(screen.getByText('Available tools')).toBeInTheDocument();
    expect(screen.getAllByText('Search Tool').length).toBeGreaterThan(0);
    expect(
      screen.getByRole('button', { name: 'Remove access from Agent One' })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove access from Agent One' }));

    fireEvent.click(screen.getByRole('button', { name: 'Graph Save Workflow' }));

    await waitFor(() => {
      expect(workflowsApi.updateWorkflow).toHaveBeenCalledWith(
        'workflow-1',
        expect.objectContaining({
          agent_definitions: expect.arrayContaining([
            expect.objectContaining({
              id: 'agent-1',
              tool_ids: [],
            }),
          ]),
          tool_definitions: expect.arrayContaining([
            expect.objectContaining({
              id: 'tool-1',
              security: expect.objectContaining({
                connector_bindings: expect.arrayContaining([
                  expect.objectContaining({
                    provider: 'discord-bot',
                    credential_id: 'credential-discord-support',
                  }),
                ]),
              }),
            }),
          ]),
        })
      );
    });
  });

  it('opens a node-specific graph tool drawer with search and linked-agent actions', async () => {
    currentSearch = 'mode=edit&tab=graph';
    workflowsApi.getWorkflow.mockResolvedValue({
      id: 'workflow-1',
      name: 'Workflow One',
      description: 'Workflow description',
      entrypoint: null,
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
          tool_ids: [],
          handoff_agent_ids: [],
          metadata: {},
        },
      ],
      task_definitions: [],
      nodes: [],
      edges: [],
      tool_definitions: [],
      versioning: {
        version: '1.0.0',
        revision: 1,
        is_published: false,
      },
      metadata: {
        workflow_graph_tool_nodes: [
          {
            id: 'tools-test',
            toolIds: [],
            agentId: 'agent-1',
          },
        ],
      },
    });
    toolsApi.listTools.mockResolvedValue({
      items: [
        {
          id: 'run-command',
          name: 'run_command',
          display_name: 'Run Command',
          description: 'Run one approved shell command.',
          tool_type: 'shell_command',
        },
        {
          id: 'analyze-screenshot',
          name: 'analyze_screenshot',
          display_name: 'Analyze Screenshot',
          description: 'Capture the current page screenshot.',
          tool_type: 'python_function',
        },
      ],
    });

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Open Graph Tool List' }));

    expect(screen.getByRole('heading', { name: 'Agent One tools' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Equipped tools' })).toBeInTheDocument();
    expect(screen.getByText('Available tools')).toBeInTheDocument();
    expect(
      screen.getByText(/Graph available tools: Run Command, Analyze Screenshot/)
    ).toBeInTheDocument();
    expect(screen.getByText('Run Command')).toBeInTheDocument();
    expect(screen.getByText('shell command')).toBeInTheDocument();
    expect(screen.getByText('python function')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Add to Agent One' })).toHaveLength(2);

    fireEvent.change(screen.getByRole('textbox', { name: 'Search tools' }), {
      target: { value: 'shell' },
    });

    expect(screen.getByText('Run Command')).toBeInTheDocument();
    expect(screen.queryByText('Analyze Screenshot')).not.toBeInTheDocument();
  });

  it('removes tool-node access and persists the cleared tool-node record', async () => {
    currentSearch = 'mode=edit&tab=graph';
    workflowsApi.getWorkflow.mockResolvedValue({
      id: 'workflow-1',
      name: 'Workflow One',
      description: 'Workflow description',
      entrypoint: null,
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
      tool_definitions: [
        {
          id: 'tool-1',
          name: 'send_webhook',
          display_name: 'Send Webhook',
          description: 'Send a webhook.',
          tool_type: 'workflow',
          security: {
            connector_bindings: [
              {
                provider: 'discord-bot',
                credential_id: 'credential-discord-support',
                purpose: 'delivery',
              },
            ],
          },
        },
      ],
      task_definitions: [
        {
          id: 'task-1',
          name: 'Task One',
          description: 'Uses the webhook tool.',
          instructions: 'Send the webhook.',
          expected_output: 'Posted',
          agent_id: 'agent-1',
          tool_ids: ['tool-1'],
          depends_on_task_ids: [],
          human_approval_required: false,
        },
      ],
      nodes: [],
      edges: [],
      versioning: {
        version: '1.0.0',
        revision: 1,
        is_published: false,
      },
      metadata: {
        workflow_graph_tool_nodes: [
          {
            id: 'tools-test',
            toolIds: ['tool-1'],
            toolNames: ['Send Webhook'],
            agentId: 'agent-1',
          },
        ],
      },
    });
    toolsApi.listTools.mockResolvedValue({
      items: [
        {
          id: 'tool-1',
          name: 'send_webhook',
          display_name: 'Send Webhook',
          description: 'Send a webhook.',
          tool_type: 'workflow',
        },
      ],
    });

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Open Graph Tool List' }));

    expect(
      screen.getByRole('button', { name: 'Remove access from Agent One' })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove access from Agent One' }));

    expect(screen.getByRole('button', { name: 'Add to Agent One' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Graph Save Workflow' }));

    await waitFor(() => {
      expect(workflowsApi.updateWorkflow).toHaveBeenCalledWith(
        'workflow-1',
        expect.objectContaining({
          agent_definitions: expect.arrayContaining([
            expect.objectContaining({
              id: 'agent-1',
              tool_ids: [],
            }),
          ]),
          task_definitions: expect.arrayContaining([
            expect.objectContaining({
              id: 'task-1',
              tool_ids: [],
            }),
          ]),
          metadata: expect.objectContaining({
            workflow_graph_tool_nodes: [
              expect.objectContaining({
                id: 'tools-test',
                toolIds: [],
                agentId: 'agent-1',
              }),
            ],
          }),
          tool_definitions: expect.arrayContaining([
            expect.objectContaining({
              id: 'tool-1',
              security: expect.objectContaining({
                connector_bindings: [],
              }),
            }),
          ]),
        })
      );
    });
  });

  it('saves tool parameters from a linked graph tool node', async () => {
    currentSearch = 'mode=edit&tab=graph';
    workflowsApi.getWorkflow.mockResolvedValue({
      id: 'workflow-1',
      name: 'Workflow One',
      description: 'Workflow description',
      entrypoint: null,
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
      task_definitions: [],
      nodes: [],
      edges: [],
      tool_definitions: [
        {
          id: 'tool-1',
          name: 'send_http_request',
          display_name: 'Send HTTP Request',
          description: 'Send an outbound HTTP request.',
          tool_type: 'workflow',
          input_schema: {
            type: 'object',
            required: ['url'],
            properties: {
              url: {
                type: 'string',
                description: 'Destination URL.',
              },
              timeout: {
                type: 'number',
                description: 'Timeout in seconds.',
              },
            },
          },
        },
      ],
      versioning: {
        version: '1.0.0',
        revision: 1,
        is_published: false,
      },
      metadata: {
        workflow_graph_tool_nodes: [
          {
            id: 'tools-test',
            toolIds: ['tool-1'],
            agentId: 'agent-1',
          },
        ],
      },
    });
    toolsApi.listTools.mockResolvedValue({
      items: [
        {
          id: 'tool-1',
          name: 'send_http_request',
          display_name: 'Send HTTP Request',
          description: 'Send an outbound HTTP request.',
          tool_type: 'workflow',
          input_schema: {
            type: 'object',
            required: ['url'],
            properties: {
              url: {
                type: 'string',
              },
              timeout: {
                type: 'number',
              },
            },
          },
        },
      ],
    });

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Open Graph Tool List' }));

    fireEvent.change(screen.getByRole('textbox', { name: /url \*/i }), {
      target: { value: 'https://example.com/hooks/release' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: /timeout/i }), {
      target: { value: '30' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save parameters' }));
    fireEvent.click(screen.getByRole('button', { name: 'Graph Save Workflow' }));

    await waitFor(() => {
      expect(workflowsApi.updateWorkflow).toHaveBeenCalledWith(
        'workflow-1',
        expect.objectContaining({
          agent_definitions: expect.arrayContaining([
            expect.objectContaining({
              id: 'agent-1',
              metadata: expect.objectContaining({
                runtime_config: expect.objectContaining({
                  tool_configs: expect.arrayContaining([
                    expect.objectContaining({
                      id: 'tool-1',
                      parameters: expect.objectContaining({
                        url: 'https://example.com/hooks/release',
                        timeout: 30,
                      }),
                    }),
                  ]),
                }),
              }),
            }),
          ]),
        })
      );
    });
  });

  it('uses connector binding or manual parameters as exclusive HTTP request setup paths', async () => {
    currentSearch = 'mode=edit&tab=graph';
    workflowsApi.getWorkflow.mockResolvedValue({
      id: 'workflow-1',
      name: 'Workflow One',
      description: 'Workflow description',
      entrypoint: null,
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
          tool_ids: ['agency.http.request'],
          handoff_agent_ids: [],
          metadata: {
            runtime_config: {
              tool_configs: [
                {
                  id: 'agency.http.request',
                  name: 'Send HTTP Request',
                  description: 'Send an outbound HTTP request.',
                  parameters: {
                    url: 'https://old.example.com',
                  },
                },
              ],
            },
          },
        },
      ],
      task_definitions: [],
      nodes: [],
      edges: [],
      tool_definitions: [
        {
          id: 'agency.http.request',
          name: 'send_http_request',
          display_name: 'Send HTTP Request',
          description: 'Send an outbound HTTP request.',
          tool_type: 'workflow',
          input_schema: {
            type: 'object',
            required: ['url'],
            properties: {
              url: {
                type: 'string',
                'x-agency-filled-by': 'user_or_agent',
              },
            },
          },
          security: {},
        },
      ],
      versioning: {
        version: '1.0.0',
        revision: 1,
        is_published: false,
      },
      metadata: {
        workflow_graph_tool_nodes: [
          {
            id: 'tools-test',
            toolIds: ['agency.http.request'],
            agentId: 'agent-1',
          },
        ],
      },
    });
    toolsApi.listTools.mockResolvedValue({
      items: [
        {
          id: 'agency.http.request',
          name: 'send_http_request',
          display_name: 'Send HTTP Request',
          description: 'Send an outbound HTTP request.',
          tool_type: 'workflow',
          input_schema: {
            type: 'object',
            required: ['url'],
            properties: {
              url: {
                type: 'string',
                'x-agency-filled-by': 'user_or_agent',
              },
            },
          },
          security: {},
          tags: ['connector'],
        },
      ],
    });
    credentialsApi.listCredentials.mockResolvedValue({
      items: [
        {
          id: 'credential-discord-support',
          name: 'Support Discord Bot',
          provider: 'discord-bot',
          metadata: {
            purpose: 'request_delivery',
            channel_id: 'channel-123',
          },
        },
      ],
    });
    credentialsApi.getConnectorCredentialCapabilities.mockResolvedValue({
      connectors: {
        'discord-bot': {
          backendKey: 'discord-bot',
          displayName: 'Discord',
          targetScopeMetadata: [{ key: 'channel_id', label: 'Channel ID', required: true }],
        },
      },
    });

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Open Graph Tool List' }));
    expect(screen.getByRole('button', { name: 'Fill tool parameters' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /url \*/i })).toHaveValue('https://old.example.com');

    fireEvent.click(screen.getByRole('button', { name: 'Use webhook credentials' }));
    expect(screen.queryByRole('textbox', { name: /url \*/i })).not.toBeInTheDocument();
    expect(screen.getByText('Filled by agent at runtime')).toBeInTheDocument();
    expect(screen.getByText(/these values are expected from the agent/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Provider')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Provider'), {
      target: { value: 'discord-bot' },
    });
    await waitFor(() => {
      expect(screen.getByLabelText('Purpose')).toHaveValue('request_delivery');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save binding' }));
    fireEvent.click(screen.getByRole('button', { name: 'Graph Save Workflow' }));

    await waitFor(() => {
      expect(workflowsApi.updateWorkflow).toHaveBeenCalledWith(
        'workflow-1',
        expect.objectContaining({
          agent_definitions: expect.arrayContaining([
            expect.objectContaining({
              id: 'agent-1',
              metadata: expect.objectContaining({
                runtime_config: {},
              }),
            }),
          ]),
        })
      );
    });
  });

  it('shows only base_folder for write text file parameter setup', async () => {
    currentSearch = 'mode=edit&tab=graph';
    workflowsApi.getWorkflow.mockResolvedValue({
      id: 'workflow-1',
      name: 'Workflow One',
      description: 'Workflow description',
      entrypoint: null,
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
          tool_ids: ['agency.file.write-text'],
          handoff_agent_ids: [],
          metadata: {},
        },
      ],
      task_definitions: [],
      nodes: [],
      edges: [],
      tool_definitions: [
        {
          id: 'agency.file.write-text',
          name: 'write_text_file',
          display_name: 'Write Text File',
          description: 'Write text to a file.',
          tool_type: 'workflow',
          input_schema: {
            type: 'object',
            properties: {
              base_folder: { type: 'string', 'x-agency-filled-by': 'user' },
              filename: { type: 'string', 'x-agency-filled-by': 'agent' },
              content: { type: 'string', 'x-agency-filled-by': 'agent' },
              mode: { type: 'string', 'x-agency-filled-by': 'agent' },
            },
          },
        },
      ],
      versioning: {
        version: '1.0.0',
        revision: 1,
        is_published: false,
      },
      metadata: {
        workflow_graph_tool_nodes: [
          {
            id: 'tools-test',
            toolIds: ['agency.file.write-text'],
            agentId: 'agent-1',
          },
        ],
      },
    });
    toolsApi.listTools.mockResolvedValue({
      items: [
        {
          id: 'agency.file.write-text',
          name: 'write_text_file',
          display_name: 'Write Text File',
          description: 'Write text to a file.',
          tool_type: 'workflow',
          input_schema: {
            type: 'object',
            properties: {
              base_folder: { type: 'string', 'x-agency-filled-by': 'user' },
              filename: { type: 'string', 'x-agency-filled-by': 'agent' },
              content: { type: 'string', 'x-agency-filled-by': 'agent' },
              mode: { type: 'string', 'x-agency-filled-by': 'agent' },
            },
          },
        },
      ],
    });

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Open Graph Tool List' }));

    expect(screen.getByText(/base_folder/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /filename/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /content/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /mode/i })).not.toBeInTheDocument();
    expect(screen.getByText('Filled by agent at runtime')).toBeInTheDocument();
    expect(screen.getByText(/content/i)).toBeInTheDocument();
    expect(
      screen.getByText((content, element) => content === 'mode' && element?.tagName === 'P')
    ).toBeInTheDocument();
  });

  it('opens graph memory nodes in the side drawer', async () => {
    currentSearch = 'mode=edit&tab=graph';
    workflowsApi.getWorkflow.mockResolvedValue({
      id: 'workflow-1',
      name: 'Workflow One',
      description: 'Workflow description',
      memory_definitions: [
        {
          id: 'memory-1',
          name: 'Research Memory',
          description: 'Workflow memory context.',
          memory_type: 'workflow',
          scope: 'workflow',
        },
      ],
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
          tool_ids: [],
          memory_ids: ['memory-1'],
          handoff_agent_ids: [],
          metadata: {},
        },
      ],
      task_definitions: [
        {
          id: 'task-b',
          name: 'Task B',
          description: 'Second task',
          instructions: 'Continue here',
          expected_output: 'Continued',
          agent_id: 'agent-1',
          tool_ids: [],
          memory_ids: ['memory-1'],
          depends_on_task_ids: [],
          human_approval_required: false,
        },
      ],
      nodes: [],
      edges: [],
      tool_definitions: [],
      versioning: {
        version: '1.0.0',
        revision: 1,
        is_published: false,
      },
      metadata: {},
    });

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Select Graph Memory' }));

    expect(screen.getByRole('heading', { name: 'Memory List' })).toBeInTheDocument();
    expect(screen.getByText('Current Selection')).toBeInTheDocument();
    expect(screen.getAllByText('Research Memory').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Upload file' })).toBeInTheDocument();
    expect(screen.queryByText('Linked Agents')).not.toBeInTheDocument();
    expect(screen.queryByText('Linked Tasks')).not.toBeInTheDocument();
  });

  it('manages backend memory access from the selected memory node drawer', async () => {
    currentSearch = 'mode=edit&tab=graph';
    workflowsApi.getWorkflow.mockResolvedValue({
      id: 'workflow-1',
      name: 'Workflow One',
      description: 'Workflow description',
      memory_definitions: [
        {
          id: 'memory-1',
          name: 'Customer Memory',
          description: 'Selected workflow context.',
          memory_type: 'preference',
          scope: 'workflow',
          metadata: {
            catalog_ref_type: 'memory',
            catalog_ref_id: 'memory-record-1',
          },
        },
      ],
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
          tool_ids: [],
          handoff_agent_ids: [],
          metadata: {},
        },
      ],
      task_definitions: [
        {
          id: 'task-b',
          name: 'Task B',
          description: 'Second task',
          instructions: 'Continue here',
          expected_output: 'Continued',
          agent_id: 'agent-1',
          tool_ids: [],
          depends_on_task_ids: [],
          human_approval_required: false,
        },
      ],
      nodes: [
        {
          id: 'node-agent-1',
          name: 'Agent One',
          node_type: 'agent',
          agent_id: 'agent-1',
          metadata: {},
        },
        {
          id: 'node-task-b',
          name: 'Task B',
          node_type: 'task',
          task_id: 'task-b',
          metadata: {},
        },
      ],
      edges: [],
      tool_definitions: [],
      versioning: {
        version: '1.0.0',
        revision: 1,
        is_published: false,
      },
      metadata: {},
    });
    workflowsApi.listWorkflowMemoryLinks.mockResolvedValue({
      workflowId: 'workflow-1',
      items: [
        {
          id: 'link-workflow',
          workflowId: 'workflow-1',
          targetType: 'workflow',
          targetId: null,
          refType: 'memory',
          refId: 'memory-record-1',
          memoryIds: ['memory-record-1'],
          accessMode: 'read',
          label: 'Customer Memory',
        },
      ],
    });

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Select Graph Memory' }));

    expect(await screen.findByText('Access Targets')).toBeInTheDocument();
    expect(screen.getAllByText('Workflow One').length).toBeGreaterThan(0);

    const selectedMemoryDialog = screen.getByRole('dialog', { name: 'Selected Memory' });
    const agentAccessTargetButton = within(selectedMemoryDialog)
      .getByText('Agent One')
      .closest('button');
    expect(agentAccessTargetButton).not.toBeNull();

    fireEvent.click(agentAccessTargetButton as HTMLButtonElement);
    await waitFor(() => {
      expect(workflowsApi.addWorkflowMemoryLink).toHaveBeenCalledWith(
        'workflow-1',
        expect.objectContaining({
          targetType: 'agent',
          targetId: 'agent-1',
          refType: 'memory',
          refId: 'memory-record-1',
        })
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remove access' }));
    await waitFor(() => {
      expect(workflowsApi.deleteWorkflowMemoryLink).toHaveBeenCalledWith(
        'workflow-1',
        'link-workflow'
      );
    });
  });

  it('opens graph artifact nodes in the side drawer', async () => {
    currentSearch = 'mode=edit&tab=graph';
    workflowsApi.getWorkflow.mockResolvedValue({
      id: 'workflow-1',
      name: 'Workflow One',
      description: 'Workflow description',
      agent_definitions: [],
      task_definitions: [
        {
          id: 'task-b',
          name: 'Task B',
          description: 'Second task',
          instructions: 'Continue here',
          expected_output: 'Continued',
          agent_id: null,
          tool_ids: [],
          depends_on_task_ids: [],
          human_approval_required: false,
        },
      ],
      nodes: [],
      edges: [],
      tool_definitions: [],
      versioning: {
        version: '1.0.0',
        revision: 1,
        is_published: false,
      },
      metadata: {
        workflow_artifact_definitions: [
          {
            id: 'artifact-1',
            name: 'Final report',
            description: 'Decision summary.',
            artifact_type: 'report',
            media_type: 'text/markdown',
            producer_task_id: 'task-b',
          },
        ],
      },
    });

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Select Graph Artifact' }));

    expect(screen.getByRole('heading', { name: 'Artifact Output' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Final report');
    expect(screen.getByLabelText('Type')).toHaveValue('report');
    expect(screen.getByLabelText('Media Type')).toHaveValue('text/markdown');
    expect(screen.getByLabelText('Producer Task')).toHaveValue('task-b');
  });

  it('shows catalog memories for a selected graph memory node by memory type', async () => {
    currentSearch = 'mode=edit&tab=graph';
    workflowsApi.getWorkflow.mockResolvedValue({
      id: 'workflow-1',
      name: 'Workflow One',
      description: 'Workflow description',
      memory_definitions: [
        {
          id: 'memory-1',
          name: 'Research Memory',
          description: 'Workflow memory context.',
          memory_type: 'workflow',
          scope: 'workflow',
        },
      ],
      agent_definitions: [],
      task_definitions: [],
      nodes: [],
      edges: [],
      tool_definitions: [],
      versioning: {
        version: '1.0.0',
        revision: 1,
        is_published: false,
      },
      metadata: {},
    });
    workflowsApi.listWorkflowMemoryLinks.mockResolvedValue({
      workflowId: 'workflow-1',
      items: [
        {
          id: 'link-existing',
          workflowId: 'workflow-1',
          targetType: 'workflow',
          targetId: null,
          refType: 'memory',
          refId: 'memory-record-existing',
          memoryIds: ['memory-record-existing'],
          accessMode: 'read',
          label: 'Existing memory',
        },
      ],
    });
    memoriesApi.listMemoryCatalog.mockResolvedValue({
      groups: [
        {
          key: 'manual',
          label: 'Manual',
          count: 1,
          items: [
            {
              id: 'memory-record-1',
              refType: 'memory',
              label: 'Customer preference',
              summary: 'Prefers concise updates.',
              preview: 'Prefers concise updates.',
              memoryType: 'preference',
              source: 'manual',
              scope: 'workflow',
              status: 'active',
              tags: [],
              sensitive: false,
              memoryIds: ['memory-record-1'],
              chunkCount: 1,
              embedded: true,
              canLink: true,
              excluded: false,
              excludedFor: [],
            },
          ],
        },
      ],
    });

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Select Graph Memory' }));

    expect(await screen.findByRole('heading', { name: 'Memory List' })).toBeInTheDocument();
    expect(await screen.findByText('Customer preference')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preferences 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Task Commitments 1' })).toHaveAttribute(
      'title',
      'Obligations, promised actions, or task cues that should influence future execution.'
    );
    expect(screen.getByRole('button', { name: 'Files 0' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    fireEvent.click(screen.getByRole('button', { name: 'Graph Save Workflow' }));
    await waitFor(() => {
      expect(workflowsApi.updateWorkflow).toHaveBeenCalledWith(
        'workflow-1',
        expect.objectContaining({
          memory_definitions: expect.arrayContaining([
            expect.objectContaining({
              id: 'memory-1',
              name: 'Customer preference',
              memory_type: 'preference',
              metadata: expect.objectContaining({
                catalog_ref_type: 'memory',
                catalog_ref_id: 'memory-record-1',
                catalog_memory_type: 'preference',
                catalog_sensitive: false,
                catalog_embedded: true,
              }),
            }),
          ]),
        })
      );
    });
  });

  it('opens graph dependency edges in the side drawer and edits conditions', async () => {
    currentSearch = 'mode=edit&tab=graph';

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Select Graph Edge' }));

    expect(screen.getByRole('heading', { name: 'Selected connection' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Make conditional' }));

    const conditionInput = await screen.findByLabelText('Condition');
    await waitFor(() => {
      expect(conditionInput).toHaveFocus();
    });
    fireEvent.change(conditionInput, {
      target: { value: 'taskA.completed === true' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Graph Save Workflow' }));

    await waitFor(() => {
      expect(workflowsApi.updateWorkflow).toHaveBeenCalledWith(
        'workflow-1',
        expect.objectContaining({
          edges: expect.arrayContaining([
            expect.objectContaining({
              source_node_id: 'node-task-a',
              target_node_id: 'node-task-b',
              edge_type: 'conditional',
              condition: 'taskA.completed === true',
            }),
          ]),
        })
      );
    });
  });

  it('opens graph assignment edges in the side drawer and edits the task assignment', async () => {
    currentSearch = 'mode=edit&tab=graph';

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Select Assignment Edge' }));

    expect(screen.getByRole('heading', { name: 'Selected connection' })).toBeInTheDocument();
    expect(screen.getByLabelText('Assigned agent')).toHaveValue('agent-1');

    fireEvent.click(screen.getByRole('button', { name: 'Remove assignment' }));
    fireEvent.click(screen.getByRole('button', { name: 'Graph Save Workflow' }));

    await waitFor(() => {
      expect(workflowsApi.updateWorkflow).toHaveBeenCalledWith(
        'workflow-1',
        expect.objectContaining({
          task_definitions: expect.arrayContaining([
            expect.objectContaining({
              id: 'task-b',
              agent_id: null,
            }),
          ]),
        })
      );
    });
  });

  it('prioritizes graph assignment edges over an already selected graph task', async () => {
    currentSearch = 'mode=edit&tab=graph&task=task-b';

    renderWorkspace();

    await screen.findByText('Graph Canvas: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Select Assignment Edge' }));

    expect(screen.getByRole('heading', { name: 'Selected connection' })).toBeInTheDocument();
    expect(screen.getByLabelText('Assigned agent')).toHaveValue('agent-1');
    expect(screen.queryByLabelText('Task name')).not.toBeInTheDocument();
  });

  it('shows workflow and task document ingestion surfaces outside edit mode', async () => {
    currentSearch = 'task=task-b';

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('Header: Workflow One')).toBeInTheDocument();
    });

    expect(screen.queryByText('Workflow documents')).not.toBeInTheDocument();
    expect(screen.getByText('Uploaded workflow documents')).toBeInTheDocument();
    expect(screen.queryByText('Task documents')).not.toBeInTheDocument();
    expect(screen.queryByText('Uploaded task documents')).not.toBeInTheDocument();
  });

  it('saves the restart active runs setting from edit mode', async () => {
    renderWorkspace();

    await screen.findByText('Metadata Editor');
    fireEvent.change(screen.getByRole('combobox', { name: 'Metadata Active run behavior' }), {
      target: { value: 'restart' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(workflowsApi.updateWorkflow).toHaveBeenCalledWith(
        'workflow-1',
        expect.objectContaining({
          metadata: expect.objectContaining({
            restart_active_executions: true,
          }),
        })
      );
    });
  });

  it('autosaves workflow settings in edit mode', async () => {
    currentSearch = 'mode=edit';
    workflowsApi.updateWorkflow.mockImplementation(async (_workflowId, nextWorkflow) => {
      const savedWorkflow = {
        ...(nextWorkflow as WorkflowDefinition),
        agent_definitions: ((nextWorkflow as WorkflowDefinition).agent_definitions ?? []).map(
          (agent) => {
            const savedAgent = { ...agent };
            delete savedAgent.memory_ids;
            return savedAgent;
          }
        ),
        task_definitions: ((nextWorkflow as WorkflowDefinition).task_definitions ?? []).map(
          (task) => {
            const savedTask = { ...task };
            delete savedTask.memory_ids;
            return savedTask;
          }
        ),
      };
      workflowsApi.getWorkflow.mockResolvedValue(savedWorkflow);
      return nextWorkflow;
    });

    renderWorkspace();

    await screen.findByText('Metadata Editor');
    fireEvent.change(screen.getByRole('combobox', { name: 'Metadata Active run behavior' }), {
      target: { value: 'restart' },
    });

    expect(workflowsApi.updateWorkflow).not.toHaveBeenCalled();

    await waitFor(
      () => {
        expect(workflowsApi.updateWorkflow).toHaveBeenCalledWith(
          'workflow-1',
          expect.objectContaining({
            metadata: expect.objectContaining({
              restart_active_executions: true,
            }),
          })
        );
      },
      { timeout: 2500 }
    );

    await new Promise((resolve) => window.setTimeout(resolve, 1700));
    expect(workflowsApi.updateWorkflow).toHaveBeenCalledTimes(1);
  });

  it('prefers native for a run when the workflow allows it', async () => {
    workflowsApi.getWorkflow.mockResolvedValue({
      id: 'workflow-1',
      name: 'Workflow One',
      description: 'Workflow description',
      entrypoint: 'node-task-a',
      default_runtime_adapter_id: 'adapter-a',
      allowed_runtime_adapter_ids: ['adapter-a', 'native'],
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
      ],
      nodes: [
        { id: 'node-task-a', name: 'Task A', node_type: 'task', task_id: 'task-a', metadata: {} },
      ],
      edges: [],
      tool_definitions: [],
      versioning: {
        version: '1.0.0',
        revision: 1,
        is_published: false,
      },
      metadata: {},
    });
    currentSearch = 'mode=edit';

    renderWorkspace();

    const select = await screen.findByLabelText('Default runtime adapter');
    expect(select).toHaveValue('native');
    expect(screen.getByText('Graph Canvas: Workflow One')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Save Runtime Settings' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(workflowsApi.updateWorkflow).toHaveBeenCalledWith(
        'workflow-1',
        expect.objectContaining({
          default_runtime_adapter_id: 'native',
          allowed_runtime_adapter_ids: ['native'],
        })
      );
    });
  });

  it('updates the main-agent self-monitoring control', async () => {
    currentSearch = 'mode=edit';

    renderWorkspace();

    await screen.findByText('Main agent monitoring');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Monitor this main-agent workflow' }));

    await waitFor(() => {
      expect(workflowsApi.updateWorkflowMonitoring).toHaveBeenCalledWith('workflow-1', {
        enabled: true,
        allow_self_monitoring: true,
      });
    });
  });

  it('updates workflow runtime governance controls', async () => {
    currentSearch = 'mode=edit';

    renderWorkspace();

    const runTokenLimit = await screen.findByLabelText('Run token limit');
    fireEvent.change(runTokenLimit, { target: { value: '1200' } });
    fireEvent.blur(runTokenLimit);

    await waitFor(() => {
      expect(workflowsApi.updateWorkflowRuntimeGovernance).toHaveBeenCalledWith('workflow-1', {
        tokenBudget: {
          runTotalTokens: 1200,
        },
      });
    });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Persist context pack' }));

    await waitFor(() => {
      expect(workflowsApi.updateWorkflowRuntimeGovernance).toHaveBeenCalledWith('workflow-1', {
        contextCompaction: {
          persistContextPack: true,
        },
      });
    });

    const maxRetries = screen.getByLabelText('Max retries');
    fireEvent.change(maxRetries, { target: { value: '2' } });
    fireEvent.blur(maxRetries);

    await waitFor(() => {
      expect(workflowsApi.updateWorkflowRuntimeGovernance).toHaveBeenCalledWith('workflow-1', {
        executionPolicy: {
          maxRetries: 2,
        },
      });
    });
  });

  it('restores backend defaults after clearing a compaction numeric control', async () => {
    currentSearch = 'mode=edit';
    workflowsApi.updateWorkflowRuntimeGovernance.mockResolvedValue({
      workflow: {
        id: 'workflow-1',
      },
      runtime_governance: {
        workflow_id: 'workflow-1',
        token_budget: {
          configured: false,
          run_total_tokens: null,
          workflow_total_tokens: null,
          agent_total_tokens: null,
          warn_ratio: 0.8,
          hard_ratio: 1,
          action: 'warn_only',
        },
        context_compaction: {
          enabled: true,
          persist_context_pack: false,
          persist_context_pack_source: 'global_default',
          preserve_recent_messages: 1,
          oversized_message_tokens: 600,
          min_estimated_tokens_saved: 50,
          max_summary_chars: 5000,
        },
      },
    });

    renderWorkspace();

    const preserveRecent = await screen.findByLabelText('Preserve recent');
    fireEvent.change(preserveRecent, { target: { value: '' } });
    fireEvent.blur(preserveRecent);

    await waitFor(() => {
      expect(workflowsApi.updateWorkflowRuntimeGovernance).toHaveBeenCalledWith('workflow-1', {
        contextCompaction: {
          preserveRecentMessages: null,
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('1')).toBeInTheDocument();
    });
    expect(screen.getByText('Using defaults')).toBeInTheDocument();
    expect(screen.getByText('Global default')).toBeInTheDocument();
  });

  it('loads workflow observability with scoped usage filters', async () => {
    currentSearch = 'tab=graph';
    observabilityApi.getWorkflowMetrics.mockResolvedValue({
      workflow_id: 'workflow-1',
      total_tokens: 2400,
      estimated_cost: 0.045,
      context_health: {
        latest: {
          status: 'normal',
        },
      },
      budget: {
        warning_count: 1,
        exceeded_count: 0,
      },
      compaction: {
        event_count: 2,
      },
    });
    observabilityApi.getModelUsage.mockResolvedValue({
      items: [
        {
          provider: 'openai',
          model: 'gpt-4.1-mini',
          total_tokens: 1800,
        },
      ],
    });
    observabilityApi.getAgentMetrics.mockResolvedValue({
      agent_id: 'agent-1',
      total_tokens: 1200,
      context_health: {
        latest: {
          status: 'normal',
        },
      },
    });

    renderWorkspace();

    expect(await screen.findByText('Governance observability')).toBeInTheDocument();
    expect(observabilityApi.getWorkflowMetrics).toHaveBeenCalledWith('workflow-1');
    expect(observabilityApi.getModelUsage).toHaveBeenCalledWith({ workflowId: 'workflow-1' });
    expect(observabilityApi.getAgentMetrics).toHaveBeenCalledWith('agent-1');
    expect(screen.getByText('gpt-4.1-mini')).toBeInTheDocument();
    expect(screen.getByText('agent-1')).toBeInTheDocument();
    expect(screen.getByText('Graph agent metrics: 1')).toBeInTheDocument();
  });

  it('hides self-monitoring control for non-main-agent workflows', async () => {
    workflowsApi.getWorkflow.mockResolvedValue({
      id: 'workflow-1',
      name: 'Workflow One',
      description: 'Workflow description',
      entrypoint: 'node-task-a',
      default_runtime_adapter_id: 'adapter-a',
      allowed_runtime_adapter_ids: ['adapter-a'],
      agent_definitions: [],
      task_definitions: [],
      nodes: [],
      edges: [],
      tool_definitions: [],
      versioning: {
        version: '1.0.0',
        revision: 1,
        is_published: false,
      },
      metadata: {},
      monitoring: {
        enabled: true,
        level: 'standard',
        exempted: false,
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
    });
    currentSearch = 'mode=edit';

    renderWorkspace();

    await screen.findByText('Main agent monitoring');
    expect(
      screen.queryByRole('checkbox', { name: 'Monitor this main-agent workflow' })
    ).not.toBeInTheDocument();
  });

  it('disables workflow monitoring with a default exemption reason', async () => {
    currentSearch = 'mode=edit';

    renderWorkspace();

    await screen.findByText('Main agent monitoring');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Monitor this workflow' }));

    await waitFor(() => {
      expect(workflowsApi.updateWorkflowMonitoring).toHaveBeenCalledWith('workflow-1', {
        enabled: false,
        reason: 'Human-managed workflow; do not monitor automatically.',
      });
    });
  });

  it('renders workflow monitoring as read-only outside workflow edit mode', async () => {
    currentSearch = '';

    renderWorkspace();

    await screen.findByText('Main agent monitoring');
    expect(screen.getByText('Monitor workflow')).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: 'Monitor this workflow' })
    ).not.toBeInTheDocument();
    expect(workflowsApi.updateWorkflowMonitoring).not.toHaveBeenCalled();
  });

  it('saves an exemption reason when monitoring is disabled', async () => {
    workflowsApi.getWorkflow.mockResolvedValue({
      id: 'workflow-1',
      name: 'Workflow One',
      description: 'Workflow description',
      entrypoint: 'node-task-a',
      default_runtime_adapter_id: 'adapter-a',
      allowed_runtime_adapter_ids: ['adapter-a'],
      agent_definitions: [],
      task_definitions: [],
      nodes: [],
      edges: [],
      tool_definitions: [],
      versioning: {
        version: '1.0.0',
        revision: 1,
        is_published: false,
      },
      metadata: {},
      monitoring: {
        enabled: false,
        level: 'off',
        exempted: true,
        reason: 'Existing reason',
        visible_to_main_agent: true,
        mutable_by_main_agent: true,
        default_enabled: true,

        is_main_agent_default_workflow: true,
        status_label: 'exempt',
        controls: {
          enabled: false,
          level: 'off',
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
    });
    currentSearch = 'mode=edit';

    renderWorkspace();

    const reasonInput = await screen.findByLabelText('Exemption reason');
    fireEvent.change(reasonInput, { target: { value: 'Human managed during launch' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save reason' }));

    await waitFor(() => {
      expect(workflowsApi.updateWorkflowMonitoring).toHaveBeenCalledWith('workflow-1', {
        enabled: false,
        reason: 'Human managed during launch',
      });
    });
  });

  it('shows pending monitor proposals and approves them from workflow detail', async () => {
    workflowsApi.listWorkflowMonitoringEvents.mockResolvedValue({
      workflow_id: 'workflow-1',
      monitoring: {
        enabled: true,
        level: 'standard',
        exempted: false,
        visible_to_main_agent: true,
        mutable_by_main_agent: true,
        default_enabled: true,

        is_main_agent_default_workflow: true,
        status_label: 'standard_monitoring',
        controls: {
          enabled: true,
          level: 'standard',
          store_run_summaries: false,
          store_failure_summaries: false,
          allow_improvement_proposals: true,
          allow_evaluation_agent_review: true,
          allow_self_monitoring: false,
          safe_to_summarize: false,
          route_improvement_proposals_to_approval: true,
          approval_conversation_id: 'conversation-1',
        },
      },
      findings: [],
      proposals: [
        {
          id: 'proposal-event-1',
          execution_id: 'execution-1',
          workflow_id: 'workflow-1',
          event_type: 'monitor.improvement.proposed',
          sequence: 2,
          payload: {
            proposed_change: {
              summary: 'Require validation evidence in the final task.',
            },
            finding: {
              evidence: [{ execution_id: 'execution-1', event_id: 'finding-1' }],
            },
            risk: 'Low',
          },
          approval_requests: [
            {
              id: 'approval-monitor-1',
              approval_type: 'workflow_update',
              status: 'pending',
              target_type: 'workflow',
              target_id: 'workflow-1',
              requested_by_agent_id: 'main-agent',
              conversation_id: 'conversation-1',
              origin_message_id: 'message-1',
              summary: 'Require validation evidence in the final task.',
              diff_summary: 'Update the final task expected output.',
              proposed_payload: {},
              metadata: { source: 'main_agent_monitor' },
              created_at: '2026-05-18T00:00:00Z',
              updated_at: '2026-05-18T00:00:00Z',
            },
          ],
        },
      ],
      evaluations: [],
      comparisons: [],
      approval_controls: [],
    });
    currentSearch = 'mode=edit';

    renderWorkspace();

    await screen.findByText('Require validation evidence in the final task.');
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => {
      expect(conversationsApi.approveApprovalRequest).toHaveBeenCalledWith('approval-monitor-1', {
        user_id: 'user-1',
        reason: 'Approved from workflow monitoring panel.',
      });
    });
  });

  it('requests main-agent steering from a graph task node', async () => {
    currentSearch = 'mode=edit';

    renderWorkspace();

    fireEvent.click(await screen.findByRole('button', { name: 'Graph Steer Task' }));

    await waitFor(() => {
      expect(workflowsApi.createWorkflowSteeringApproval).toHaveBeenCalledWith(
        'workflow-1',
        expect.objectContaining({
          recommendedAction: 'request_replan',
          targetTaskId: 'task-b',
          reason: 'Graph node steering requested for task "Task B".',
          requestApproval: true,
          metadata: expect.objectContaining({
            source: 'workflow_graph_node',
            workflow_detail_mode: 'edit',
          }),
          operatorParameters: expect.objectContaining({
            instructions: expect.stringContaining('Review and steer task "Task B"'),
          }),
        })
      );
    });
  });

  it('sends the preferred runtime adapter when starting a run', async () => {
    workflowsApi.getWorkflow.mockResolvedValue({
      id: 'workflow-1',
      name: 'Workflow One',
      description: 'Workflow description',
      entrypoint: 'node-task-a',
      default_runtime_adapter_id: 'native',
      allowed_runtime_adapter_ids: ['native', 'adapter-a'],
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
      ],
      nodes: [
        { id: 'node-task-a', name: 'Task A', node_type: 'task', task_id: 'task-a', metadata: {} },
      ],
      edges: [],
      tool_definitions: [],
      versioning: {
        version: '1.0.0',
        revision: 1,
        is_published: false,
      },
      metadata: {},
    });
    currentSearch = '';

    renderWorkspace();

    await screen.findByText('Header: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Run Workflow' }));

    await waitFor(() => {
      expect(runsApi.executeWorkflow).toHaveBeenCalledWith('workflow-1', 'native', 'local');
    });
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByText('Graph Canvas: Workflow One')).toBeInTheDocument();
  });

  it('patches schedule settings from the workflow detail panel', async () => {
    currentSearch = 'mode=edit';
    schedulesApi.listSchedules.mockResolvedValue({
      items: [
        {
          id: 'schedule-1',
          name: 'Morning Review',
          workflow_id: 'workflow-1',
          enabled: true,
          trigger_type: 'cron',
          trigger_config: { cron: '0 7 * * *' },
          timezone: 'Asia/Singapore',
          max_concurrent_executions: 1,
          next_fire_at: '2026-05-16T23:00:00Z',
          last_fire_at: null,
        },
      ],
    });

    renderWorkspace();

    await screen.findByText('cron 0 7 * * *');
    expect(screen.queryByText('Morning Review')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit cron' }));
    fireEvent.change(screen.getByLabelText('Cron expression'), { target: { value: '30 8 * * *' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save cron' }));

    await waitFor(() => {
      expect(schedulesApi.patchSchedule).toHaveBeenCalledWith('schedule-1', {
        trigger_type: 'cron',
        trigger_config: { cron: '30 8 * * *' },
      });
    });
  });

  it('creates a workflow schedule from edit mode', async () => {
    currentSearch = 'mode=edit';

    renderWorkspace();

    await screen.findByText(
      'No schedules are attached to this workflow. Use Set schedule to create one.'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Set schedule' }));
    fireEvent.change(screen.getByLabelText('Cron expression'), { target: { value: '15 9 * * *' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create schedule' }));

    await waitFor(() => {
      expect(schedulesApi.createSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          workflow_id: 'workflow-1',
          enabled: true,
          trigger_type: 'cron',
          trigger_config: { cron: '15 9 * * *' },
        })
      );
    });
  });

  it('removes an existing workflow schedule from edit mode', async () => {
    currentSearch = 'mode=edit';
    schedulesApi.listSchedules.mockResolvedValue({
      items: [
        {
          id: 'schedule-1',
          name: 'Morning Review',
          workflow_id: 'workflow-1',
          enabled: true,
          trigger_type: 'cron',
          trigger_config: { cron: '0 7 * * *' },
          timezone: 'Asia/Singapore',
          max_concurrent_executions: 1,
          next_fire_at: '2026-05-16T23:00:00Z',
          last_fire_at: null,
        },
      ],
    });

    renderWorkspace();

    await screen.findByText('cron 0 7 * * *');
    fireEvent.click(screen.getByRole('button', { name: 'Remove schedule' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(schedulesApi.deleteSchedule).toHaveBeenCalledWith('schedule-1');
    });
  });

  it('shows active run behavior as read-only metadata outside edit mode', async () => {
    currentSearch = '';

    renderWorkspace();

    await screen.findByText('Header: Workflow One');

    expect(screen.getAllByText('Active runs stay current').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Running executions continue unchanged. Future runs use the saved workflow.')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Update active run behavior/i })
    ).not.toBeInTheDocument();
  });
});
