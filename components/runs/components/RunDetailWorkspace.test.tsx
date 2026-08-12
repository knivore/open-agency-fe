import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RunsModuleProvider } from '@/components/runs/context';
import RunDetailWorkspace, { ArtifactCard } from '@/components/runs/components/RunDetailWorkspace';

const { pushMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  useSearchParams: () => new URLSearchParams('workflowId=workflow-1&tab=runs'),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        id: 'dev-user',
        email: 'dev@example.com',
      },
    },
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    promise: <T,>(promise: Promise<T>) => promise,
  },
}));

vi.mock('@/components/runs/hooks/useRunPresence', () => ({
  useRunPresence: () => ({
    tasks: [],
    agents: [],
  }),
}));

vi.mock('@/components/workflow/WorkflowGraphCanvas', () => ({
  default: ({ readOnly, runtimeEvents }: { readOnly?: boolean; runtimeEvents?: unknown[] }) => (
    <div data-testid="workflow-graph-canvas">
      {readOnly ? 'Read-only graph' : 'Editable graph'} · {runtimeEvents?.length ?? 0} events
    </div>
  ),
}));

function createRunsModuleApi() {
  return {
    runSessions: {
      listRunSessions: vi.fn(),
      getRunSession: vi.fn().mockResolvedValue({
        summary: {
          id: 'run-1',
          workflowId: 'workflow-1',
          runtimeAdapterId: 'crewai',
          status: 'completed',
          createdAt: '2026-05-07T00:00:00.000Z',
          startedAt: '2026-05-07T00:01:00.000Z',
          completedAt: '2026-05-07T00:02:00.000Z',
          container: {},
        },
        state: {
          paused: false,
          cancelled: false,
          node_outputs: {},
        },
        runtime: {
          diagnostics: {},
        },
        replacement: {
          replacedByExecutions: [],
        },
      }),
      listRunApprovals: vi.fn().mockResolvedValue({ items: [] }),
      listRunWaits: vi.fn().mockResolvedValue({ items: [] }),
      getRunUsage: vi.fn().mockResolvedValue({
        execution_id: 'run-1',
        workflow_id: 'workflow-1',
        token_usage: {
          total: {
            prompt_tokens: 20,
            completion_tokens: 5,
            total_tokens: 25,
            estimated_cost: 0.0001,
            currency: 'USD',
          },
        },
        budget_warnings: [],
        updated_at: '2026-05-07T00:02:00.000Z',
      }),
      getRunContextUsage: vi.fn().mockResolvedValue({
        execution_id: 'run-1',
        workflow_id: 'workflow-1',
        latest_context_health: {
          status: 'normal',
          estimated_total_context_tokens: 100,
          context_window: 1000,
        },
        latest_compaction: {},
        compaction_records: [],
        updated_at: '2026-05-07T00:02:00.000Z',
      }),
      listRunArtifacts: vi.fn().mockResolvedValue({ items: [] }),
      getRunLogs: vi.fn().mockResolvedValue({ logs: '' }),
    },
    logs: {
      getRunTimeline: vi.fn().mockResolvedValue({
        execution: {
          status: 'completed',
        },
        events: [],
      }),
      listRunEvents: vi.fn().mockResolvedValue({ items: [] }),
    },
    conversations: {
      getMainAgent: vi.fn().mockResolvedValue({
        id: 'main-agent',
        name: 'Main Agent',
        agent_id: 'main-agent',
        default_workflow_id: 'workflow-main',
      }),
      findExecutionContext: vi.fn().mockResolvedValue({
        conversation: null,
        messages: [],
        approvals: [],
      }),
      approveApprovalRequest: vi.fn(),
      rejectApprovalRequest: vi.fn(),
    },
    runs: {
      executeWorkflow: vi.fn().mockResolvedValue({
        id: 'run-2',
        status: 'created',
      }),
      pauseRun: vi.fn(),
      resumeRun: vi.fn(),
      cancelRun: vi.fn(),
      approveRun: vi.fn(),
      rejectRun: vi.fn(),
      resolveRunWait: vi.fn(),
    },
    runtimeAdapters: {
      listRuntimeAdapters: vi.fn().mockResolvedValue({
        items: [
          {
            id: 'native',
            name: 'Native Runtime',
            adapter_type: 'native',
          },
          {
            id: 'crewai',
            name: 'CrewAI',
            adapter_type: 'framework',
          },
        ],
      }),
    },
    workflows: {
      getWorkflow: vi.fn().mockResolvedValue({
        id: 'workflow-1',
        name: 'Workflow One',
        allowed_runtime_adapter_ids: ['native', 'crewai'],
        default_runtime_adapter_id: 'crewai',
        agent_definitions: [],
        task_definitions: [],
      }),
    },
    executionActions: {
      downloadResult: vi.fn(),
      rateResult: vi.fn(),
    },
  };
}

function renderWorkspace(api = createRunsModuleApi()) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <RunsModuleProvider api={api}>
        <RunDetailWorkspace runId="run-1" />
      </RunsModuleProvider>
    </QueryClientProvider>
  );

  return { api, queryClient };
}

describe('RunDetailWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('prefers native in the rerun selector when the workflow allows it', async () => {
    renderWorkspace();

    const select = await screen.findByLabelText('Runtime adapter for the next run');
    expect(await screen.findByRole('heading', { name: 'Workflow One' })).toBeInTheDocument();
    expect(screen.getByText('Run run-1')).toBeInTheDocument();
    expect(select).toHaveValue('native');
    expect(screen.getByRole('button', { name: 'Run Again With native' })).toBeInTheDocument();
  });

  it('renders the observability timeline graph as read-only', async () => {
    renderWorkspace();

    const timelineTab = await screen.findByRole('tab', { name: 'Timeline' });
    fireEvent.mouseDown(timelineTab);
    fireEvent.click(timelineTab);

    expect(await screen.findByTestId('workflow-graph-canvas')).toHaveTextContent('Read-only graph');
  });

  it('shows persistent cycle state and lets an operator pause a sleeping run', async () => {
    const api = createRunsModuleApi();
    api.runSessions.getRunSession.mockResolvedValue({
      summary: {
        id: 'run-1',
        workflowId: 'workflow-1',
        runtimeAdapterId: 'native',
        status: 'sleeping',
        metadata: {
          active_wait: {
            wait_id: 'wait-cycle-4',
            kind: 'sleep',
            wake_at: '2026-07-13T12:00:00.000Z',
          },
          persistent_cycle: {
            enabled: true,
            phase: 'sleeping',
            cycle_number: 3,
            next_cycle_number: 4,
            next_wake_at: '2026-07-13T12:00:00.000Z',
            consecutive_failures: 1,
            no_progress_cycles: 2,
            usage: { total_tokens: 1250, estimated_cost: 0.42, runtime_seconds: 95 },
            history: [
              {
                cycle_number: 3,
                status: 'completed',
                completed_at: '2026-07-13T11:00:00.000Z',
              },
            ],
          },
        },
        container: {},
      },
      state: { paused: false, cancelled: false, node_outputs: {} },
      runtime: { diagnostics: {} },
      replacement: { replacedByExecutions: [] },
    });
    api.runSessions.listRunWaits.mockResolvedValue({
      items: [
        {
          id: 'wait-cycle-4',
          execution_id: 'run-1',
          kind: 'sleep',
          status: 'pending',
          idempotency_key: 'persistent-cycle:4',
          request_payload: { reason: 'cycle_completed', next_cycle_number: 4 },
          checkpoint: { last_cycle_output: { final_output: 'healthy' } },
          policy: { max_total_tokens: 5000 },
          wake_at: '2026-07-13T12:00:00.000Z',
        },
      ],
    });

    renderWorkspace(api);

    expect(await screen.findByRole('heading', { name: 'Persistent monitor' })).toBeInTheDocument();
    expect(screen.getByText('Sleeping between monitor cycles')).toBeInTheDocument();
    expect(screen.getByText('1 failures · 2 repeated')).toBeInTheDocument();
    expect(screen.getByText('1,250 tokens · US$0.42')).toBeInTheDocument();
    expect(screen.getByText('Recent cycle outcomes')).toBeInTheDocument();
    expect(screen.getByText(/cycle_completed/)).toBeInTheDocument();
    expect(screen.getByText(/last_cycle_output/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Wake now' }));
    await waitFor(() =>
      expect(api.runs.resolveRunWait).toHaveBeenCalledWith(
        'run-1',
        'wait-cycle-4',
        { source: 'operator_wake_now' },
        expect.stringMatching(/^operator:/)
      )
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    await waitFor(() => expect(api.runs.pauseRun).toHaveBeenCalledWith('run-1'));
  });

  it('jumps from the evidence navigator to the selected evidence tab', async () => {
    renderWorkspace();

    const timelineShortcut = await screen.findByRole('button', { name: 'Timeline' });
    fireEvent.click(timelineShortcut);

    expect(screen.getByRole('tab', { name: 'Timeline' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByTestId('workflow-graph-canvas')).toHaveTextContent('Read-only graph');
  });

  it('hides the runtime error section when a run has no error', async () => {
    renderWorkspace();

    await screen.findByRole('heading', { name: 'Workflow One' });
    expect(screen.queryByRole('heading', { name: 'Runtime Error' })).not.toBeInTheDocument();
  });

  it('uses linked message workflow name when the workflow record only has an id label', async () => {
    const api = createRunsModuleApi();
    api.runSessions.getRunSession.mockResolvedValue({
      summary: {
        id: 'run-1',
        workflowId: 'workflow-1',
        runtimeAdapterId: 'native',
        status: 'completed',
        createdAt: '2026-05-07T00:00:00.000Z',
        startedAt: '2026-05-07T00:01:00.000Z',
        completedAt: '2026-05-07T00:02:00.000Z',
        container: {},
      },
      state: {
        paused: false,
        cancelled: false,
        node_outputs: {},
      },
      runtime: {
        diagnostics: {},
      },
      replacement: {
        replacedByExecutions: [],
      },
    });
    api.workflows.getWorkflow.mockResolvedValue({
      id: 'workflow-1',
      name: 'workflow-1',
      allowed_runtime_adapter_ids: ['native'],
      default_runtime_adapter_id: 'native',
      agent_definitions: [],
      task_definitions: [],
    });
    api.conversations.findExecutionContext.mockResolvedValue({
      conversation: null,
      approvals: [],
      messages: [
        {
          id: 'message-1',
          conversation_id: 'conversation-1',
          role: 'user',
          message_type: 'text',
          execution_id: 'run-1',
          content: JSON.stringify({
            workflow: 'Payload Workflow Name',
            input: {
              goal: 'Test',
            },
          }),
          created_at: '2026-05-07T00:00:00.000Z',
        },
      ],
    });

    renderWorkspace(api);

    expect(
      await screen.findByRole('heading', { name: 'Payload Workflow Name' })
    ).toBeInTheDocument();
    expect(screen.getByText('Run run-1')).toBeInTheDocument();
  });

  it('uses nested event message workflow name when workflow details are id-only', async () => {
    const api = createRunsModuleApi();
    api.workflows.getWorkflow.mockResolvedValue({
      id: 'workflow-1',
      name: 'workflow-1',
      allowed_runtime_adapter_ids: ['native'],
      default_runtime_adapter_id: 'native',
      agent_definitions: [],
      task_definitions: [],
    });
    api.logs.listRunEvents.mockResolvedValue({
      items: [
        {
          id: 'event-1',
          execution_id: 'run-1',
          workflow_id: 'workflow-1',
          event_type: 'llm.request.created',
          timestamp: '2026-05-07T00:00:00.000Z',
          sequence: 1,
          payload: {
            messages: [
              {
                role: 'user',
                content: JSON.stringify({
                  workflow: 'Nested Event Workflow',
                  input: {
                    goal: 'Test',
                  },
                }),
              },
            ],
          },
        },
      ],
    });

    renderWorkspace(api);

    expect(
      await screen.findByRole('heading', { name: 'Nested Event Workflow' })
    ).toBeInTheDocument();
    expect(screen.getByText('Run run-1')).toBeInTheDocument();
  });

  it('reruns with the adapter selected in the run detail UI', async () => {
    const { api } = renderWorkspace();

    const select = await screen.findByLabelText('Runtime adapter for the next run');
    fireEvent.change(select, { target: { value: 'crewai' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run Again With crewai' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(api.runs.executeWorkflow).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Start rerun' }));

    await waitFor(() => {
      expect(api.runs.executeWorkflow).toHaveBeenCalledWith('workflow-1', 'crewai', 'local');
    });
    expect(pushMock).toHaveBeenCalledWith('/runs/run-2?workflowId=workflow-1&tab=runs');
  });

  it('renders native runtime output payloads as canonical run outputs', async () => {
    const api = createRunsModuleApi();
    api.runSessions.getRunSession.mockResolvedValue({
      summary: {
        id: 'run-1',
        workflowId: 'workflow-1',
        runtimeAdapterId: 'native',
        status: 'completed',
        createdAt: '2026-05-07T00:00:00.000Z',
        startedAt: '2026-05-07T00:01:00.000Z',
        completedAt: '2026-05-07T00:02:00.000Z',
        container: {},
        outputPayload: {
          final_output: '**Final answer**\n- Ship it.',
          node_outputs: {
            'node-1': 'Draft answer',
          },
        },
      },
      state: {
        paused: false,
        cancelled: false,
        node_outputs: {
          'node-1': 'Draft answer',
        },
      },
      runtime: {
        diagnostics: {},
      },
      replacement: {
        replacedByExecutions: [],
      },
    });
    renderWorkspace(api);

    expect(await screen.findByText('Run Outputs')).toBeInTheDocument();
    expect(screen.getByText('Primary output')).toBeInTheDocument();
    expect(screen.getByText('Final answer')).toBeInTheDocument();
    expect(screen.getByText('Node outputs')).toBeInTheDocument();
    expect(
      screen.getByText('1 intermediate node output hidden from the main result.')
    ).toBeInTheDocument();
    expect(screen.queryByText('node-1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show diagnostics' }));

    expect(screen.getByText('node-1')).toBeInTheDocument();
  });

  it('renders JSON-shaped output strings as structured run output fields', async () => {
    const api = createRunsModuleApi();
    api.runSessions.getRunSession.mockResolvedValue({
      summary: {
        id: 'run-1',
        workflowId: 'workflow-1',
        runtimeAdapterId: 'native',
        status: 'completed',
        createdAt: '2026-05-07T00:00:00.000Z',
        startedAt: '2026-05-07T00:01:00.000Z',
        completedAt: '2026-05-07T00:02:00.000Z',
        container: {},
        outputPayload: {
          content: `\`\`\`json\n${JSON.stringify({
            status: 'blocked_not_sent',
            final_text: 'Voice delivery is blocked until credentials are present.\nRetry later.',
          })
            .replace(/"/g, '\\"')
            .replace(/\\n/g, '\n')}\n\`\`\``,
        },
      },
      state: {
        paused: false,
        cancelled: false,
        node_outputs: {},
      },
      runtime: {
        diagnostics: {},
      },
      replacement: {
        replacedByExecutions: [],
      },
    });
    renderWorkspace(api);

    expect(await screen.findByText('Run Outputs')).toBeInTheDocument();
    expect(screen.getAllByText('Status').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('blocked_not_sent')).toBeInTheDocument();
    expect(screen.getByText('Final Text')).toBeInTheDocument();
    expect(
      screen.getByText(/Voice delivery is blocked until credentials are present\./)
    ).toBeInTheDocument();
  });

  it('shows run events in the story view without exposing raw details for internal task events', async () => {
    const api = createRunsModuleApi();
    api.logs.listRunEvents.mockResolvedValue({
      items: [
        {
          id: 'event-1',
          execution_id: 'run-1',
          workflow_id: 'workflow-1',
          event_type: 'task.started',
          sequence: 1,
          timestamp: '2026-05-07T00:01:00.000Z',
          actor_type: 'agent',
          actor: 'Repo Reviewer',
          task_id: 'task-1',
          payload: {
            task_name: 'Inspect repository signals',
          },
        },
      ],
    });
    renderWorkspace(api);

    expect(await screen.findByText('task.started')).toBeInTheDocument();
    expect(screen.getByText('Repo Reviewer')).toBeInTheDocument();
    expect(screen.getByText('Inspect repository signals')).toBeInTheDocument();
    expect(screen.queryByText('Details')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Story' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('formats agent output into readable paragraphs in the story view', async () => {
    const api = createRunsModuleApi();
    api.logs.listRunEvents.mockResolvedValue({
      items: [
        {
          id: 'event-1',
          execution_id: 'run-1',
          workflow_id: 'workflow-1',
          event_type: 'agent.message.created',
          sequence: 2,
          timestamp: '2026-05-07T00:01:30.000Z',
          actor_type: 'agent',
          actor: 'Open Agency Decision Coach',
          task_id: 'task-2',
          payload: {
            content:
              'Discord delivery failed. I did not retry with changed content.\nExact failure:\n- HTTP status: 404\n- Response body: {"detail":"Credential not found"}\nPayload summary sent:\nOutcome: kept open-agency as execution system of record and open-agency-fe as selective auth/request-shaping boundary.\nEvidence: workflow decision memo and journal update confirm current split.',
          },
        },
      ],
    });
    renderWorkspace(api);

    expect(await screen.findByText('Agent update')).toBeInTheDocument();
    expect(screen.getByText('Open Agency Decision Coach')).toBeInTheDocument();
    expect(
      screen.getAllByText(
        (_, node) =>
          node?.textContent?.includes(
            'Discord delivery failed. I did not retry with changed content.'
          ) ?? false
      ).length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('HTTP status: 404').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(/workflow decision memo and journal update confirm current split/i).length
    ).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.getByText('No additional payload fields.')).toBeInTheDocument();
  });

  it('renders runtime governance token and context summaries', async () => {
    const api = createRunsModuleApi();
    api.logs.listRunEvents.mockImplementation((_runId, _afterSequence, eventTypes) =>
      Promise.resolve({
        items:
          Array.isArray(eventTypes) && eventTypes.length > 0
            ? [
                {
                  id: 'governance-event-fallback',
                  execution_id: 'run-1',
                  workflow_id: 'workflow-1',
                  event_type: 'model.fallback.used',
                  sequence: 6,
                  timestamp: '2026-05-07T00:01:20.000Z',
                  actor_type: 'agent',
                  agent_id: 'agent-1',
                  task_id: 'task-1',
                  payload: {
                    used: true,
                    primary_provider: 'fake',
                    primary_model: 'primary-model',
                    fallback_provider: 'fallback',
                    fallback_model: 'backup-model',
                    fallback_index: 1,
                  },
                },
                {
                  id: 'governance-event-fallback-failed',
                  execution_id: 'run-1',
                  workflow_id: 'workflow-1',
                  event_type: 'model.fallback.failed',
                  sequence: 8,
                  timestamp: '2026-05-07T00:01:40.000Z',
                  actor_type: 'agent',
                  agent_id: 'agent-1',
                  task_id: 'task-1',
                  payload: {
                    attempts: [{ model: 'primary-model' }, { model: 'backup-model' }],
                    error: 'backup-model timed out',
                  },
                },
                {
                  id: 'governance-event-1',
                  execution_id: 'run-1',
                  workflow_id: 'workflow-1',
                  event_type: 'context.compaction.completed',
                  sequence: 7,
                  timestamp: '2026-05-07T00:01:30.000Z',
                  actor_type: 'system',
                  agent_id: 'agent-1',
                  task_id: 'task-1',
                  payload: {
                    estimated_tokens_saved: 800,
                  },
                },
              ]
            : [],
      })
    );
    api.runSessions.getRunUsage.mockResolvedValue({
      execution_id: 'run-1',
      workflow_id: 'workflow-1',
      token_usage: {
        total: {
          prompt_tokens: 1_200,
          completion_tokens: 300,
          total_tokens: 1_500,
          estimated_cost: 0.0123,
          currency: 'USD',
          fallback_count: 1,
        },
        fallback_count: 1,
        model_fallbacks: [
          {
            used: true,
            primary_provider: 'fake',
            primary_model: 'primary-model',
            fallback_provider: 'fallback',
            fallback_model: 'backup-model',
            fallback_index: 1,
            agent_id: 'agent-1',
            task_id: 'task-1',
            model_request_id: 'request-1',
            event_id: 'governance-event-fallback',
            updated_at: '2026-05-07T00:01:20.000Z',
          },
        ],
        by_agent: {
          'agent-1': {
            prompt_tokens: 900,
            completion_tokens: 200,
            total_tokens: 1_100,
            estimated_cost: 0.009,
            currency: 'USD',
          },
        },
        by_task: {
          'task-1': {
            prompt_tokens: 300,
            completion_tokens: 100,
            total_tokens: 400,
            estimated_cost: 0.0033,
            currency: 'USD',
          },
        },
        by_model: {
          'fake:fake-model': {
            prompt_tokens: 1_200,
            completion_tokens: 300,
            total_tokens: 1_500,
            estimated_cost: 0.0123,
            currency: 'USD',
          },
        },
      },
      budget_warnings: [
        {
          scope: 'run',
          used_tokens: 1_500,
          budget_tokens: 2_000,
          status: 'warning',
          action: 'warn_only',
        },
      ],
      updated_at: '2026-05-07T00:02:00.000Z',
    });
    api.runSessions.getRunContextUsage.mockResolvedValue({
      execution_id: 'run-1',
      workflow_id: 'workflow-1',
      latest_context_health: {
        status: 'warning',
        estimated_total_context_tokens: 7_500,
        context_window: 10_000,
      },
      latest_compaction: {
        compacted: true,
        estimated_tokens_saved: 800,
      },
      compaction_records: [{ compacted: true }],
      updated_at: '2026-05-07T00:02:00.000Z',
    });

    renderWorkspace(api);

    expect(await screen.findByText('Runtime Governance')).toBeInTheDocument();
    expect(screen.getAllByText('1,500').length).toBeGreaterThan(1);
    expect(screen.getAllByText('warning').length).toBeGreaterThan(1);
    expect(screen.getByText('Compacted')).toBeInTheDocument();
    expect(screen.getByText('Agent Usage')).toBeInTheDocument();
    expect(screen.getAllByText('agent-1').length).toBeGreaterThan(0);
    expect(screen.getByText('Task Usage')).toBeInTheDocument();
    expect(screen.getAllByText('task-1').length).toBeGreaterThan(0);
    expect(screen.getByText('Model Usage')).toBeInTheDocument();
    expect(screen.getByText('fake:fake-model')).toBeInTheDocument();
    expect(screen.getAllByText('Model Fallbacks').length).toBeGreaterThan(0);
    expect(screen.getAllByText('fake:primary-model').length).toBeGreaterThan(0);
    expect(screen.getAllByText('fallback:backup-model').length).toBeGreaterThan(0);
    expect(screen.getByText('Budget Warning History')).toBeInTheDocument();
    expect(screen.getByText(/Budget warning: run used 1,500 \/ 2,000 tokens./)).toBeInTheDocument();
    expect(screen.getByText('Governance Event Timeline')).toBeInTheDocument();
    expect(
      screen.getByText('Switched to fallback:backup-model after fake:primary-model failed.')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/2 fallback attempts failed. backup-model timed out/)
    ).toBeInTheDocument();
    expect(screen.getByText('Compaction completed')).toBeInTheDocument();
    expect(screen.getByText('Saved 800 tokens')).toBeInTheDocument();
    expect(api.logs.listRunEvents).toHaveBeenCalledWith(
      'run-1',
      0,
      expect.arrayContaining(['token.budget.warning', 'context.compaction.completed'])
    );
  });

  it('renders delegated and human-held native approval activity', async () => {
    const api = createRunsModuleApi();
    api.runSessions.getRunSession.mockResolvedValue({
      summary: {
        id: 'run-1',
        workflowId: 'workflow-1',
        runtimeAdapterId: 'native',
        status: 'waiting_for_approval',
        workerId: null,
        metadata: {
          active_wait: { wait_id: 'wait-approval-1', kind: 'approval' },
          pending_approval: {
            tool_id: 'tool-click',
            approval_metadata: { tool_name: 'click', task_id: 'task-2' },
          },
        },
        container: {},
      },
      state: { paused: false, cancelled: false, node_outputs: {} },
      runtime: { diagnostics: {} },
      replacement: { replacedByExecutions: [] },
    });
    api.logs.listRunEvents.mockResolvedValue({
      items: [
        {
          id: 'approval-requested-1',
          execution_id: 'run-1',
          workflow_id: 'workflow-1',
          event_type: 'approval.requested',
          sequence: 1,
          timestamp: '2026-05-07T00:01:00.000Z',
          actor_type: 'system',
          agent_id: 'agent-1',
          task_id: 'task-1',
          payload: {
            tool_id: 'tool-safe',
            tool_name: 'Safe Tool',
            risk_labels: ['requires_approval'],
            local_privileged_execution: false,
            arguments: { text: 'approve me' },
          },
        },
        {
          id: 'approval-granted-1',
          execution_id: 'run-1',
          workflow_id: 'workflow-1',
          event_type: 'approval.granted',
          sequence: 2,
          timestamp: '2026-05-07T00:01:10.000Z',
          actor_type: 'system',
          agent_id: 'agent-1',
          task_id: 'task-1',
          payload: {
            tool_id: 'tool-safe',
            tool_name: 'Safe Tool',
            reason: 'Main-agent delegated HITL approval.',
            decision_metadata: {
              mode: 'delegated',
              delegate: 'main_agent',
              risk_labels: ['requires_approval'],
            },
          },
        },
        {
          id: 'approval-requested-2',
          execution_id: 'run-1',
          workflow_id: 'workflow-1',
          event_type: 'approval.requested',
          sequence: 3,
          timestamp: '2026-05-07T00:02:00.000Z',
          actor_type: 'system',
          agent_id: 'agent-2',
          task_id: 'task-2',
          payload: {
            tool_id: 'tool-click',
            tool_name: 'click',
            risk_labels: ['browser', 'mutation', 'local_privileged_execution'],
            local_privileged_execution: true,
          },
        },
      ],
    });
    api.runSessions.listRunApprovals.mockResolvedValue({
      items: [
        {
          id: 'run-1:tool-safe',
          execution_id: 'run-1',
          event_id: 'approval-requested-1',
          tool_id: 'tool-safe',
          status: 'approved',
          request_payload: {
            arguments: { text: 'approve me' },
            approval_metadata: {
              tool_name: 'Safe Tool',
              risk_labels: ['requires_approval'],
            },
          },
          response_payload: {
            granted: true,
            reason: 'Main-agent delegated HITL approval.',
            metadata: {
              mode: 'delegated',
              delegate: 'main_agent',
            },
          },
          requested_at: '2026-05-07T00:01:00.000Z',
          responded_at: '2026-05-07T00:01:10.000Z',
          responded_by: 'main_agent',
        },
        {
          id: 'run-1:tool-click',
          execution_id: 'run-1',
          event_id: 'approval-requested-2',
          tool_id: 'tool-click',
          status: 'pending',
          request_payload: {
            arguments: { x: 42, token: '[REDACTED]' },
            approval_metadata: {
              tool_name: 'click',
              risk_labels: ['browser', 'mutation', 'local_privileged_execution'],
              local_privileged_execution: true,
            },
          },
          response_payload: {},
          requested_at: '2026-05-07T00:02:00.000Z',
          responded_at: null,
          responded_by: null,
        },
      ],
    });

    renderWorkspace(api);

    expect(
      await screen.findByRole('heading', { name: 'Approval required for click' })
    ).toBeInTheDocument();
    expect(screen.getByText('Worker released')).toBeInTheDocument();
    expect(screen.getByText(/Wait wait-approval-1/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve and resume' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject and resume' })).toBeInTheDocument();

    const approvalsTab = await screen.findByRole('tab', { name: 'Approvals, 1 pending' });
    fireEvent.pointerDown(approvalsTab);
    fireEvent.mouseDown(approvalsTab);
    fireEvent.click(approvalsTab);

    expect(await screen.findByText('Native runtime approvals')).toBeInTheDocument();
    expect(screen.getByText('Safe Tool')).toBeInTheDocument();
    expect(screen.getByText('Main agent delegated')).toBeInTheDocument();
    expect(screen.getByText('Responded by: main_agent')).toBeInTheDocument();
    expect(screen.getByText('click')).toBeInTheDocument();
    expect(screen.getByText('Human-held')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => {
      expect(api.runs.approveRun).toHaveBeenCalledWith('run-1', 'tool-click', undefined);
    });
  });

  it('does not offer approval actions for an event-only approval that is no longer active', async () => {
    const api = createRunsModuleApi();
    api.runSessions.getRunSession.mockResolvedValue({
      summary: {
        id: 'run-1',
        workflowId: 'workflow-1',
        runtimeAdapterId: 'native',
        status: 'waiting_for_approval',
        metadata: {
          pending_approval: {
            tool_id: 'tool-stale',
            approval_metadata: { tool_name: 'Stale Tool' },
          },
        },
        container: {},
      },
      state: { paused: false, cancelled: false, node_outputs: {} },
      runtime: { diagnostics: {} },
      replacement: { replacedByExecutions: [] },
    });
    api.logs.listRunEvents.mockResolvedValue({
      items: [
        {
          id: 'approval-requested-stale',
          execution_id: 'run-1',
          workflow_id: 'workflow-1',
          event_type: 'approval.requested',
          sequence: 1,
          payload: { tool_id: 'tool-stale', tool_name: 'Stale Tool' },
        },
      ],
    });

    renderWorkspace(api);

    expect(await screen.findByRole('button', { name: 'Review approvals (1)' })).toBeInTheDocument();
    const approvalsTab = screen.getByRole('tab', { name: 'Approvals, 1 pending' });
    fireEvent.pointerDown(approvalsTab);
    fireEvent.mouseDown(approvalsTab);
    fireEvent.click(approvalsTab);

    expect(await screen.findByText('Stale Tool')).toBeInTheDocument();
    expect(
      screen.getByText(/the backend no longer has an active request to approve or reject/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
  });

  it('renders LLM thoughts and final output as readable story content', async () => {
    const api = createRunsModuleApi();
    api.logs.listRunEvents.mockResolvedValue({
      items: [
        {
          id: 'event-1',
          execution_id: 'run-1',
          workflow_id: 'workflow-1',
          event_type: 'llm.request.created',
          sequence: 1,
          timestamp: '2026-05-07T00:01:00.000Z',
          actor_type: 'agent',
          actor: 'Repo Reviewer',
          payload: {
            thought: null,
            thought_parse_error: true,
          },
        },
        {
          id: 'event-2',
          execution_id: 'run-1',
          workflow_id: 'workflow-1',
          event_type: 'llm.response.created',
          sequence: 2,
          timestamp: '2026-05-07T00:02:00.000Z',
          actor_type: 'agent',
          actor: 'Repo Reviewer',
          payload: {
            text: '**Top Improvement Idea**\n- Add repo-health CI.',
            output: '**Top Improvement Idea**\n- Add repo-health CI.',
            thought: null,
            thought_parse_error: true,
          },
        },
        {
          id: 'event-3',
          execution_id: 'run-1',
          workflow_id: 'workflow-1',
          event_type: 'execution.completed',
          sequence: 3,
          timestamp: '2026-05-07T00:03:00.000Z',
          actor_type: 'system',
          actor: 'system',
          payload: {
            error: null,
            output: {
              final_output: 'Final Output\n**Daily Brief**\n- Add repo-health CI.',
            },
          },
        },
      ],
    });
    renderWorkspace(api);

    expect(await screen.findByRole('heading', { name: 'Final output' })).toBeInTheDocument();
    expect(screen.getAllByText('Daily Brief').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.queryByText(/Thought not available in a readable format/)
    ).not.toBeInTheDocument();
    screen.getAllByRole('button', { name: 'Details' }).forEach((button) => {
      fireEvent.click(button);
    });
    expect(
      screen.getAllByText(/Thought not available in a readable format/).length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Failed to parse LLM response')).not.toBeInTheDocument();
    expect(screen.getAllByText('Top Improvement Idea').length).toBeGreaterThanOrEqual(1);
  });

  it('prefers readable request messages over the parser-miss summary for llm requests', async () => {
    const api = createRunsModuleApi();
    api.logs.listRunEvents.mockResolvedValue({
      items: [
        {
          id: 'event-1',
          execution_id: 'run-1',
          workflow_id: 'workflow-1',
          event_type: 'llm.request.created',
          sequence: 1,
          timestamp: '2026-05-07T00:01:00.000Z',
          actor_type: 'agent',
          actor: 'Open Agency Decision Coach',
          payload: {
            thought: null,
            thought_parse_error: true,
            messages: [
              {
                role: 'system',
                content:
                  'You are the workflow reviewer. Summarize the user-visible outcome in concise paragraphs.',
              },
              {
                role: 'user',
                content:
                  'Review the Discord delivery failure and explain the likely cause plus the next best action.',
              },
            ],
          },
        },
      ],
    });
    renderWorkspace(api);

    expect(
      await screen.findByText(
        'Review the Discord delivery failure and explain the likely cause plus the next best action.'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'Prompt sent to the model. Intermediate thought was not returned in a readable format.'
      )
    ).not.toBeInTheDocument();
  });

  it('promotes the final output artifact when completion payload has no output text', async () => {
    const api = createRunsModuleApi();
    api.logs.listRunEvents.mockResolvedValue({
      items: [
        {
          id: 'event-1',
          execution_id: 'run-1',
          workflow_id: 'workflow-1',
          event_type: 'artifact.created',
          sequence: 1,
          timestamp: '2026-05-07T00:02:00.000Z',
          actor_type: 'system',
          actor: 'system',
          payload: {
            name: 'final_output.txt',
            uri: 'execution://run-1/final_output',
          },
        },
        {
          id: 'event-2',
          execution_id: 'run-1',
          workflow_id: 'workflow-1',
          event_type: 'execution.completed',
          sequence: 2,
          timestamp: '2026-05-07T00:03:00.000Z',
          actor_type: 'system',
          actor: 'system',
          payload: {
            error: null,
          },
        },
      ],
    });
    renderWorkspace(api);

    expect(
      await screen.findByRole('heading', { name: 'Final output artifact' })
    ).toBeInTheDocument();
    expect(screen.getAllByText('final_output.txt').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.queryByText('No final output has been reported for this run yet.')
    ).not.toBeInTheDocument();
  });

  it('orders run events from latest to earliest in story and rows views', async () => {
    const api = createRunsModuleApi();
    api.logs.listRunEvents.mockResolvedValue({
      items: [
        {
          id: 'event-1',
          execution_id: 'run-1',
          workflow_id: 'workflow-1',
          event_type: 'execution.started',
          sequence: 1,
          timestamp: '2026-05-07T00:01:00.000Z',
          actor_type: 'system',
          actor: 'system',
          payload: {},
        },
        {
          id: 'event-2',
          execution_id: 'run-1',
          workflow_id: 'workflow-1',
          event_type: 'execution.completed',
          sequence: 2,
          timestamp: '2026-05-07T00:03:00.000Z',
          actor_type: 'system',
          actor: 'system',
          payload: {},
        },
      ],
    });
    renderWorkspace(api);

    const completed = await screen.findByText('Execution completed');
    const started = screen.getByText('Execution started');
    expect(
      completed.compareDocumentPosition(started) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Rows' }));
    const rowText = screen
      .getAllByRole('row')
      .map((row) => row.textContent ?? '')
      .join('\n');
    expect(rowText.indexOf('execution.completed')).toBeLessThan(
      rowText.indexOf('execution.started')
    );
  });

  it('shows inline text content for execution artifacts', async () => {
    render(
      <ArtifactCard
        artifact={{
          id: 'artifact-1',
          execution_id: 'run-1',
          artifact_type: 'text',
          name: 'final_output.txt',
          uri: 'execution://run-1/final_output',
          media_type: 'text/plain',
          size_bytes: 24,
          content_text: '**Final answer**\n- Done.',
        }}
      />
    );

    expect(screen.getByText('final_output.txt')).toBeInTheDocument();
    expect(screen.getByText('Final answer')).toBeInTheDocument();
    expect(screen.getByText('24 bytes')).toBeInTheDocument();
  });

  it('keeps rows available as the backup event view', async () => {
    const api = createRunsModuleApi();
    api.logs.listRunEvents.mockResolvedValue({
      items: [
        {
          id: 'event-1',
          execution_id: 'run-1',
          workflow_id: 'workflow-1',
          event_type: 'task.started',
          sequence: 1,
          timestamp: '2026-05-07T00:01:00.000Z',
          actor_type: 'agent',
          actor: 'Repo Reviewer',
          task_id: 'task-1',
          payload: {
            task_name: 'Inspect repository signals',
          },
        },
      ],
    });
    renderWorkspace(api);

    fireEvent.click(await screen.findByRole('button', { name: 'Rows' }));

    expect(screen.getByRole('columnheader', { name: 'Seq' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rows' })).toHaveAttribute('aria-pressed', 'true');
  });
});
