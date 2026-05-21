import type { ButtonHTMLAttributes, ReactNode } from 'react';
import React, { createContext, useContext } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WorkflowDetailWorkspace from '@/components/workflow/WorkflowDetailWorkspace';

const {
  agentsApi,
  behaviorProfilesApi,
  conversationsApi,
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
  runsApi: {
    listRunsForWorkflow: vi.fn(),
    executeWorkflow: vi.fn(),
  },
  runtimeAdaptersApi: {
    listRuntimeAdapters: vi.fn(),
  },
  schedulesApi: {
    listSchedules: vi.fn(),
    createSchedule: vi.fn(),
    patchSchedule: vi.fn(),
    enableSchedule: vi.fn(),
    disableSchedule: vi.fn(),
    triggerNow: vi.fn(),
  },
  toolsApi: {
    listTools: vi.fn(),
  },
  workflowsApi: {
    getWorkflow: vi.fn(),
    listWorkflowMonitoringEvents: vi.fn(),
    updateWorkflow: vi.fn(),
    updateWorkflowMonitoring: vi.fn(),
    publishWorkflow: vi.fn(),
    unpublishWorkflow: vi.fn(),
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

vi.mock('@/lib/api/backend', () => ({
  agentsApi,
  behaviorProfilesApi,
  conversationsApi,
  runsApi,
  runtimeAdaptersApi,
  schedulesApi,
  toolsApi,
  workflowsApi,
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    promise: vi.fn(),
  },
}));

vi.mock('@/components/agent-app/StatePanels', () => ({
  LoadingCard: ({ title }: { title: string }) => <div>{title} loading</div>,
  ErrorAlert: ({ title, message }: { title: string; message: string }) => (
    <div>
      {title}: {message}
    </div>
  ),
  EmptyCard: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('@/components/workflow/WorkflowDetailHeader', () => ({
  default: ({
    workflowName,
    restartActiveExecutions,
    isPublished,
    onRestartActiveExecutionsChange,
    onPublish,
  }: {
    workflowName: string;
    restartActiveExecutions: boolean;
    isPublished: boolean;
    onRestartActiveExecutionsChange: (checked: boolean) => void;
    onPublish: () => void;
  }) => (
    <div>
      <div>Header: {workflowName}</div>
      <label htmlFor="restart-active-executions">Restart active runs</label>
      <input
        id="restart-active-executions"
        type="checkbox"
        checked={restartActiveExecutions}
        onChange={(event) => onRestartActiveExecutionsChange(event.currentTarget.checked)}
      />
      <button type="button" onClick={onPublish}>
        {isPublished ? 'Unpublish' : 'Publish'}
      </button>
    </div>
  ),
}));

vi.mock('@/components/workflow/WorkflowDetailStatus', () => ({
  default: () => <div>Status Panel</div>,
}));

vi.mock('@/components/workflow/WorkflowMetadataEditor', () => ({
  default: ({
    restartActiveExecutions,
    onRestartActiveExecutionsChange,
    onSave,
  }: {
    restartActiveExecutions: boolean;
    onRestartActiveExecutionsChange: (checked: boolean) => void;
    onSave: () => void;
  }) => (
    <div>
      <div>Metadata Editor</div>
      <label htmlFor="metadata-restart-active-executions">Metadata Restart active runs</label>
      <input
        id="metadata-restart-active-executions"
        type="checkbox"
        checked={restartActiveExecutions}
        onChange={(event) => onRestartActiveExecutionsChange(event.currentTarget.checked)}
      />
      <button type="button" onClick={onSave}>
        Save Changes
      </button>
    </div>
  ),
}));

vi.mock('@/components/workflow/WorkflowBuilderPanel', () => ({
  default: ({
    selectedTaskId,
    runtimeAdapterId,
  }: {
    selectedTaskId?: string | null;
    runtimeAdapterId?: string | null;
  }) => (
    <div>
      Builder Panel: {selectedTaskId || 'none'}
      <span>Builder runtime adapter: {runtimeAdapterId || 'none'}</span>
    </div>
  ),
}));

vi.mock('@/components/workflow/WorkflowRunsPanel', () => ({
  default: () => <div>Runs Panel</div>,
}));

vi.mock('@/components/workflow/WorkflowTaskFocusPanel', () => ({
  default: ({
    selectedTask,
    workflowId,
  }: {
    selectedTask: { name: string };
    workflowId?: string;
  }) => (
    <div>
      Task Focus: {selectedTask.name}
      {workflowId ? <span>Task documents</span> : null}
    </div>
  ),
}));

const TabsContext = createContext<string>('builder');

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
  TabsTrigger: ({ children, value }: { children: ReactNode; value: string }) => (
    <button type="button" data-value={value}>
      {children}
    </button>
  ),
  TabsContent: ({ children, value }: { children: ReactNode; value: string }) => {
    const activeValue = useContext(TabsContext);
    return activeValue === value ? <div>{children}</div> : null;
  },
}));

vi.mock('@/components/library/shadcn/button', () => ({
  Button: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/library/shadcn/accordion', () => ({
  Accordion: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionTrigger: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  AccordionContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

function renderWorkspace() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

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
    schedulesApi.enableSchedule.mockResolvedValue({ id: 'schedule-1', enabled: true });
    schedulesApi.disableSchedule.mockResolvedValue({ id: 'schedule-1', enabled: false });
    schedulesApi.triggerNow.mockResolvedValue({
      schedule: { id: 'schedule-1', enabled: true },
      execution_id: 'run-schedule-1',
      triggered_at: '2026-05-16T00:00:00Z',
    });
    behaviorProfilesApi.listProfiles.mockResolvedValue([]);
    agentsApi.listAgents.mockResolvedValue({ items: [] });
    toolsApi.listTools.mockResolvedValue({ items: [] });
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
    workflowsApi.updateWorkflow.mockResolvedValue({ msg: 'success', status: 200 });
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
    workflowsApi.publishWorkflow.mockResolvedValue({
      id: 'workflow-1',
      versioning: {
        is_published: true,
      },
    });
    workflowsApi.unpublishWorkflow.mockResolvedValue({
      id: 'workflow-1',
      versioning: {
        is_published: false,
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
    vi.clearAllMocks();
  });

  it('respects URL-driven edit mode and selected task state', async () => {
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('Header: Workflow One')).toBeInTheDocument();
    });

    expect(screen.getByText('Metadata Editor')).toBeInTheDocument();
    expect(screen.getByText('Builder Panel: task-b')).toBeInTheDocument();
    expect(screen.getByText('Task Focus: Task B')).toBeInTheDocument();
  });

  it('shows task document ingestion surfaces outside edit mode', async () => {
    currentSearch = 'task=task-b';

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('Header: Workflow One')).toBeInTheDocument();
    });

    expect(screen.queryByText('Workflow documents')).not.toBeInTheDocument();
    expect(screen.queryByText('Uploaded workflow documents')).not.toBeInTheDocument();
    expect(screen.getByText('Task documents')).toBeInTheDocument();
  });

  it('saves the restart active runs setting from edit mode', async () => {
    renderWorkspace();

    await screen.findByText('Metadata Editor');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Metadata Restart active runs' }));
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

    const select = await screen.findByLabelText('Runtime adapter for this run');
    expect(select).toHaveValue('native');
    expect(screen.getByText('Builder runtime adapter: native')).toBeInTheDocument();
  });

  it('updates the main-agent self-monitoring control', async () => {
    currentSearch = 'mode=edit';

    renderWorkspace();

    await screen.findByText('Monitor this main-agent workflow');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Monitor this main-agent workflow' }));

    await waitFor(() => {
      expect(workflowsApi.updateWorkflowMonitoring).toHaveBeenCalledWith('workflow-1', {
        allow_self_monitoring: true,
      });
    });
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

    await screen.findByText('Monitor this workflow');
    expect(
      screen.queryByRole('checkbox', { name: 'Monitor this main-agent workflow' })
    ).not.toBeInTheDocument();
  });

  it('disables workflow monitoring with a default exemption reason', async () => {
    currentSearch = 'mode=edit';

    renderWorkspace();

    await screen.findByText('Monitor this workflow');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Monitor this workflow' }));

    await waitFor(() => {
      expect(workflowsApi.updateWorkflowMonitoring).toHaveBeenCalledWith('workflow-1', {
        enabled: false,
        reason: 'Human-managed workflow; do not monitor automatically.',
      });
    });
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

  it('saves the selected runtime adapter from the workflow detail panel', async () => {
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
    currentSearch = 'mode=edit';

    renderWorkspace();

    const select = await screen.findByLabelText('Runtime adapter for this run');
    fireEvent.change(select, { target: { value: 'adapter-a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Runtime Settings' }));

    await waitFor(() => {
      expect(workflowsApi.updateWorkflow).toHaveBeenCalledWith(
        'workflow-1',
        expect.objectContaining({
          default_runtime_adapter_id: 'adapter-a',
          allowed_runtime_adapter_ids: ['native', 'adapter-a'],
          metadata: expect.objectContaining({ execution_host: 'local' }),
        })
      );
    });
    expect(runsApi.executeWorkflow).not.toHaveBeenCalled();
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

  it('publishes without restarting active runs by default', async () => {
    currentSearch = '';

    renderWorkspace();

    await screen.findByText('Header: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(workflowsApi.publishWorkflow).toHaveBeenCalledWith('workflow-1', {
        restart_active_executions: false,
      });
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Unpublish' })).toBeInTheDocument();
    });
  });

  it('sends restart_active_executions when checked before publishing', async () => {
    currentSearch = '';

    renderWorkspace();

    await screen.findByText('Header: Workflow One');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Restart active runs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(workflowsApi.publishWorkflow).toHaveBeenCalledWith('workflow-1', {
        restart_active_executions: true,
      });
    });
  });

  it('uses the saved restart active runs setting when publishing', async () => {
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
      metadata: {
        restart_active_executions: true,
      },
    });
    currentSearch = '';

    renderWorkspace();

    await screen.findByText('Header: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(workflowsApi.publishWorkflow).toHaveBeenCalledWith('workflow-1', {
        restart_active_executions: true,
      });
    });
  });

  it('unpublishes when the workflow is already published', async () => {
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
        revision: 2,
        is_published: true,
      },
      metadata: {},
    });
    currentSearch = '';

    renderWorkspace();

    await screen.findByText('Header: Workflow One');
    fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }));

    await waitFor(() => {
      expect(workflowsApi.unpublishWorkflow).toHaveBeenCalledWith('workflow-1', {
        restart_active_executions: false,
      });
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
    });
    expect(workflowsApi.publishWorkflow).not.toHaveBeenCalled();
  });
});
