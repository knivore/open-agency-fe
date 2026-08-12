import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OperatorCreateWorkspace from './OperatorCreateWorkspace';
import OperatorDetailWorkspace from './OperatorDetailWorkspace';
import OperatorsWorkspace from './OperatorsWorkspace';

const mocks = vi.hoisted(() => ({
  operatorsApi: {
    listOperators: vi.fn(),
    getSummary: vi.fn(),
    getOperator: vi.fn(),
    listEvaluations: vi.fn(),
    listCapabilities: vi.fn(),
    listGoals: vi.fn(),
    listNotifications: vi.fn(),
    listSignals: vi.fn(),
    listCommitments: vi.fn(),
    listTriggers: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
    wake: vi.fn(),
    activate: vi.fn(),
    emergencyStop: vi.fn(),
    simulate: vi.fn(),
    proposeFromResponsibility: vi.fn(),
    createOperator: vi.fn(),
    createTrigger: vi.fn(),
  },
  agentsApi: { listAgents: vi.fn() },
  personasApi: { listPersonas: vi.fn() },
  workflowsApi: { listWorkflows: vi.fn() },
  toolsApi: { listTools: vi.fn() },
  connectorsApi: { listConnectorInstallations: vi.fn() },
  modelProfilesApi: { listProfiles: vi.fn() },
}));

vi.mock('@/lib/api/backend/operators', () => ({ operatorsApi: mocks.operatorsApi }));
vi.mock('@/lib/api/backend/agents', () => ({ agentsApi: mocks.agentsApi }));
vi.mock('@/lib/api/backend/personas', () => ({ personasApi: mocks.personasApi }));
vi.mock('@/lib/api/backend/workflows', () => ({ workflowsApi: mocks.workflowsApi }));
vi.mock('@/lib/api/backend/tools', () => ({ toolsApi: mocks.toolsApi }));
vi.mock('@/lib/api/backend/connectors', () => ({ connectorsApi: mocks.connectorsApi }));
vi.mock('@/lib/api/backend/models', () => ({ modelProfilesApi: mocks.modelProfilesApi }));
vi.mock('./useOperatorWorkspace', () => ({
  useOperatorWorkspace: () => ({ workspaceId: 'workspace-1', selectWorkspace: vi.fn() }),
  useOnlineStatus: () => true,
}));

const operator = {
  id: 'operator-1',
  workspace_id: 'workspace-1',
  name: 'Engineering Operator',
  description: 'Supervises bounded engineering work.',
  purpose: 'Monitor approved engineering work and prepare evidence-backed draft outcomes.',
  status: 'sleeping',
  supervisor_agent_id: 'agent-1',
  standing_order_version_id: 'order-1',
  default_persona_version_id: null,
  evaluation_adapter_id: 'agency_native',
  default_runtime_adapter_id: 'native',
  default_isolation_provider_id: 'agency_container',
  default_runtime_profile_id: null,
  default_model_profile_id: null,
  execution_placement_policy: {
    allowed_runtime_adapter_ids: [],
    allowed_isolation_provider_ids: [],
    allowed_execution_host_ids: [],
    required_host_capabilities: [],
    preferred_execution_host_labels: [],
    data_residency: 'workspace',
  },
  model_route_policy: {
    required_capabilities: [],
    allowed_model_profile_ids: [],
    local_first: false,
    cloud_fallback: true,
  },
  autonomy_policy: { mode: 'shadow' },
  approval_policy: { require_approval_for: ['external_write'] },
  budget_policy: { max_cost: 1, max_actions: 1 },
  memory_policy: {},
  delivery_policy: {},
  health_policy: {},
  concurrency_policy: {},
  metadata: {},
  created_at: '2026-07-17T01:00:00Z',
  updated_at: '2026-07-17T02:00:00Z',
  last_evaluated_at: '2026-07-17T02:00:00Z',
  next_evaluation_at: '2026-07-17T03:00:00Z',
};

const readModel = {
  operator,
  active_standing_order: {
    instructions: 'Inspect approved changes and remain silent when no useful action exists.',
    success_conditions: ['Evidence recorded'],
    attention_conditions: ['Approval needed'],
    prohibited_actions: ['Do not deploy'],
    default_actions: ['Inspect approved context'],
    source: 'approved_proposal',
  },
  resource_bindings: [
    {
      resource_type: 'agent',
      resource_id: 'agent-1',
      role: 'supervisor',
      policy: {},
      metadata: {},
    },
  ],
};

const evaluation = {
  id: 'evaluation-1',
  operator_id: 'operator-1',
  workspace_id: 'workspace-1',
  signal_ids: ['signal-1'],
  status: 'completed',
  decision: {
    decision: 'no_action',
    rationale_summary: 'The observed change already satisfies the standing order.',
    requested_action: {},
  },
  created_execution_ids: [],
  approval_request_ids: [],
  notification_ids: [],
  evaluation_adapter_id: 'agency_native',
  isolation_provider_id: 'agency_container',
  execution_host_id: 'local',
  effective_policy_hash: 'policy-hash',
  enforcement_metadata: {},
  token_usage: {},
  estimated_cost: 0,
  iteration_count: 1,
  action_count: 0,
  notification_count: 0,
  shadow_mode: false,
  completed_at: '2026-07-17T02:00:00Z',
  created_at: '2026-07-17T02:00:00Z',
  updated_at: '2026-07-17T02:00:00Z',
};

function renderWithQuery(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Open Agency Operator workspaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.operatorsApi.listOperators.mockResolvedValue({
      items: [readModel],
      count: 1,
      workspace_id: 'workspace-1',
    });
    mocks.operatorsApi.getSummary.mockResolvedValue({
      workspace_id: 'workspace-1',
      total: 1,
      active: 1,
      waiting: 0,
      attention: 0,
      status_counts: { sleeping: 1 },
      next_evaluation_at: operator.next_evaluation_at,
    });
    mocks.operatorsApi.getOperator.mockResolvedValue(readModel);
    mocks.operatorsApi.listEvaluations.mockResolvedValue({ items: [evaluation], count: 1 });
    mocks.operatorsApi.listCapabilities.mockResolvedValue({
      items: [
        {
          binding_id: 'binding-1',
          resource_type: 'agent',
          resource_id: 'agent-1',
          role: 'supervisor',
          status: 'active',
          available: true,
          descriptor: {},
        },
      ],
      count: 1,
    });
    mocks.operatorsApi.listGoals.mockResolvedValue({ items: [], count: 0 });
    mocks.operatorsApi.listNotifications.mockResolvedValue({ items: [], count: 0 });
    mocks.operatorsApi.listSignals.mockResolvedValue({
      items: [
        {
          id: 'signal-1',
          operator_id: 'operator-1',
          workspace_id: 'workspace-1',
          signal_type: 'heartbeat',
          source: 'scheduler',
          payload_summary: 'Routine heartbeat found one already-resolved change.',
          sensitivity: 'internal',
          priority: 50,
          status: 'resolved',
          received_at: '2026-07-17T02:00:00Z',
          available_at: '2026-07-17T02:00:00Z',
          resolution_payload: {},
          metadata: {},
        },
      ],
      count: 1,
    });
    mocks.operatorsApi.listCommitments.mockResolvedValue({ items: [], count: 0 });
    mocks.operatorsApi.listTriggers.mockResolvedValue({ items: [], count: 0 });
    mocks.agentsApi.listAgents.mockResolvedValue({ items: [], count: 0 });
    mocks.personasApi.listPersonas.mockResolvedValue({ items: [], count: 0 });
    mocks.workflowsApi.listWorkflows.mockResolvedValue({ items: [], count: 0 });
    mocks.toolsApi.listTools.mockResolvedValue({ items: [], count: 0 });
    mocks.connectorsApi.listConnectorInstallations.mockResolvedValue({ items: [] });
    mocks.modelProfilesApi.listProfiles.mockResolvedValue({ items: [], count: 0 });
  });

  it('renders a no-action evaluation as a first-class fleet decision', async () => {
    renderWithQuery(<OperatorsWorkspace />);
    expect((await screen.findAllByText('Engineering Operator')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('no action')).length).toBeGreaterThan(0);
    expect(
      screen.getByText('The observed change already satisfies the standing order.')
    ).toBeInTheDocument();
  });

  it('connects the wake signal to the evaluation rationale and evidence state', async () => {
    renderWithQuery(<OperatorDetailWorkspace operatorId="operator-1" />);
    expect(await screen.findByText('Decision lineage')).toBeInTheDocument();
    expect(
      screen.getByText('Routine heartbeat found one already-resolved change.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('The observed change already satisfies the standing order.')
    ).toBeInTheDocument();
    expect(screen.getByText('No execution dispatched.')).toBeInTheDocument();
    expect(screen.getByText('No approval requested.')).toBeInTheDocument();
  });

  it('generates a conservative proposal without inferring capabilities', async () => {
    mocks.operatorsApi.proposeFromResponsibility.mockResolvedValue({
      schema_version: 'agency.operator.proposal.v1',
      kind: 'AgencyOperatorProposal',
      generated_by: 'agency.operator.conservative.v1',
      authoritative: false,
      requires_human_review: true,
      operator: { ...operator, workspace_id: 'workspace-1', status: undefined },
      standing_order: readModel.active_standing_order,
      resource_bindings: [],
      review_warnings: ['No capability is inferred automatically.'],
    });
    renderWithQuery(<OperatorCreateWorkspace />);
    fireEvent.change(screen.getByLabelText('Operator name'), {
      target: { value: 'Research Operator' },
    });
    fireEvent.change(screen.getByLabelText('Ongoing responsibility'), {
      target: { value: 'Monitor approved research inputs and prepare evidence-backed briefs.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Generate conservative proposal' }));
    await waitFor(() => expect(mocks.operatorsApi.proposeFromResponsibility).toHaveBeenCalled());
    expect((await screen.findAllByText('Capabilities')).length).toBeGreaterThan(0);
    expect(screen.getByText(/No capability is inferred automatically/i)).toBeInTheDocument();
  });
});
