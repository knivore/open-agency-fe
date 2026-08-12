import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GoalDetailWorkspace from './GoalDetailWorkspace';
import GoalsWorkspace from './GoalsWorkspace';

const mocks = vi.hoisted(() => ({
  goalsApi: {
    getOperatorView: vi.fn(),
    getOperatorDetail: vi.fn(),
    createGoal: vi.fn(),
    applyOperatorAction: vi.fn(),
    evaluateGoal: vi.fn(),
  },
  runsApi: {
    pauseRun: vi.fn(),
    resumeRun: vi.fn(),
    cancelRun: vi.fn(),
    resolveRunWait: vi.fn(),
    approveRun: vi.fn(),
    rejectRun: vi.fn(),
  },
  runSessionsApi: {
    listRunWaits: vi.fn(),
    listRunApprovals: vi.fn(),
  },
}));

vi.mock('@/lib/api/backend/goals', () => ({ goalsApi: mocks.goalsApi }));
vi.mock('@/lib/api/backend/runs', () => ({ runsApi: mocks.runsApi }));
vi.mock('@/lib/api/backend/runSessions', () => ({ runSessionsApi: mocks.runSessionsApi }));

const goal = {
  id: 'goal-1',
  objective: 'Keep the local service healthy',
  status: 'active',
  priority: 'high',
  owner_actor: 'owner-1',
  parent_goal_id: null,
  success_criteria: [{ id: 'criterion-1', description: 'Health evidence is recorded.' }],
  constraints: { autonomy: 'guarded' },
  execution_ids: ['run-1'],
  evidence: [{ id: 'evidence-1', description: 'Health probe passed.' }],
  evaluation: null,
  deadline_at: null,
  completed_at: null,
  created_at: '2026-07-20T01:00:00Z',
  updated_at: '2026-07-20T02:00:00Z',
  metadata: {},
};

const summary = {
  goal,
  goal_id: goal.id,
  objective: goal.objective,
  status: goal.status,
  status_label: 'Active',
  autonomy: 'guarded',
  priority: 'high',
  active_executions: [],
  active_execution_count: 1,
  linked_execution_count: 1,
  blocked: false,
  stale: false,
  blockers: [],
  pending_approvals: [],
  pending_approval_count: 0,
  automatic_actions: [],
  automatic_action_count: 0,
  flags: {},
  success_criteria_count: 1,
  evidence_count: 1,
  created_at: goal.created_at,
  updated_at: goal.updated_at,
};

const detail = {
  ...summary,
  current_plan: { version: 1, steps: [{ id: 'step-1', status: 'active', action: 'monitor' }] },
  active_plan_version: 1,
  timeline: [{ type: 'goal', timestamp: goal.created_at, summary: 'Goal created' }],
  evidence: goal.evidence,
  artifacts: { 'run-1': [] },
  approvals: [],
  memory: { memory_ids: [] },
  evaluation: null,
  supervisor: {
    findings: [],
    decisions: [],
    supervisor_actions: [],
    operator_actions: [],
    approval_requests: [],
  },
  executions: {
    'run-1': {
      id: 'run-1',
      workflow_id: 'workflow-1',
      runtime_adapter_id: 'native',
      status: 'waiting_for_input',
      updated_at: '2026-07-20T02:00:00Z',
    },
  },
  events: { 'run-1': [] },
  operator_actions: { pause: true, resume: false, cancel: true, adjust_autonomy: true },
};

function renderWithQuery(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Goal supervision workspaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.goalsApi.getOperatorView.mockResolvedValue({
      items: [summary],
      count: 1,
      summary: {
        blocked_count: 0,
        stale_count: 0,
        failing_count: 0,
        pending_approval_count: 0,
        automatic_action_count: 0,
      },
    });
    mocks.goalsApi.getOperatorDetail.mockResolvedValue(detail);
    mocks.goalsApi.applyOperatorAction.mockResolvedValue(goal);
    mocks.goalsApi.evaluateGoal.mockResolvedValue({ sufficient: true });
    mocks.runSessionsApi.listRunWaits.mockResolvedValue({
      items: [
        {
          id: 'wait-1',
          execution_id: 'run-1',
          kind: 'input',
          status: 'pending',
          idempotency_key: 'wait-key',
          request_payload: { prompt: 'Choose a recovery branch.' },
          checkpoint: { current_node_id: 'node-2' },
          policy: { response_schema: { type: 'string' } },
        },
      ],
      count: 1,
    });
    mocks.runSessionsApi.listRunApprovals.mockResolvedValue({
      items: [
        {
          id: 'approval-1',
          execution_id: 'run-1',
          tool_id: 'tool-1',
          status: 'pending',
          request_payload: { summary: 'Open a draft PR.' },
        },
      ],
      count: 1,
    });
    mocks.runsApi.resolveRunWait.mockResolvedValue({});
    mocks.runsApi.approveRun.mockResolvedValue({});
  });

  it('renders the durable goal fleet with supervision state', async () => {
    renderWithQuery(<GoalsWorkspace />);

    expect(await screen.findByText('Keep the local service healthy')).toBeInTheDocument();
    expect(screen.getByText('1 active / 1 linked runs · deadline Not set')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Inspect/ })).toHaveAttribute('href', '/goals/goal-1');
  });

  it('resolves linked-run input and approvals from the goal view', async () => {
    renderWithQuery(<GoalDetailWorkspace goalId="goal-1" />);

    expect(await screen.findByText('Waiting for input')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Provide requested input'), {
      target: { value: 'Use the safe branch.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit and resume' }));
    await waitFor(() =>
      expect(mocks.runsApi.resolveRunWait).toHaveBeenCalledWith(
        'run-1',
        'wait-1',
        { response: 'Use the safe branch.', source: 'goal_view' },
        'goal-view:run-1:wait-1'
      )
    );

    fireEvent.click(screen.getByRole('button', { name: /Approve/ }));
    await waitFor(() =>
      expect(mocks.runsApi.approveRun).toHaveBeenCalledWith(
        'run-1',
        'tool-1',
        'Decision from goal supervision.'
      )
    );
  });
});
