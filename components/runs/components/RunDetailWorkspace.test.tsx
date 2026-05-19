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
    expect(select).toHaveValue('native');
    expect(screen.getByRole('button', { name: 'Run Again With native' })).toBeInTheDocument();
  });

  it('reruns with the adapter selected in the run detail UI', async () => {
    const { api } = renderWorkspace();

    const select = await screen.findByLabelText('Runtime adapter for the next run');
    fireEvent.change(select, { target: { value: 'crewai' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run Again With crewai' }));

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
    expect(screen.getByText('node-1')).toBeInTheDocument();
  });

  it('shows run events in the story view by default with structured payload details', async () => {
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
    expect(screen.getAllByText('Inspect repository signals')).toHaveLength(2);
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Story' })).toHaveAttribute('aria-pressed', 'true');
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
    expect(screen.getAllByText(/Thought not available in a readable format/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Failed to parse LLM response')).not.toBeInTheDocument();
    expect(screen.getAllByText('Top Improvement Idea')).toHaveLength(1);
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

    expect(await screen.findByRole('heading', { name: 'Final output artifact' })).toBeInTheDocument();
    expect(screen.getAllByText('final_output.txt').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('No final output has been reported for this run yet.')).not.toBeInTheDocument();
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
    expect(completed.compareDocumentPosition(started) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Rows' }));
    const rowText = screen.getAllByRole('row').map((row) => row.textContent ?? '').join('\n');
    expect(rowText.indexOf('execution.completed')).toBeLessThan(rowText.indexOf('execution.started'));
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
