import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {AgentDefinition} from '@/types/agents';
import type {IntegrationProvider} from '@/types/integrations';
import CapabilityStudio from './CapabilityStudio';
import {CapabilityDraftGuard, useCapabilityDraftGuard} from './CapabilityDraftGuard';

const api = vi.hoisted(() => ({
  listAgents: vi.fn(),
  getAgent: vi.fn(),
  updateAgent: vi.fn(),
  getMainAgent: vi.fn(),
}));
vi.mock('@/lib/api/backend/agents', () => ({agentsApi: api}));
vi.mock('@/lib/api/backend/conversations', () => ({conversationsApi: api}));

const worker: AgentDefinition = {
  id: 'worker',
  name: 'Research assistant',
  tool_ids: ['read', 'unavailable'],
};
const providers = ['read', 'write', 'generated'].map(
  (id): IntegrationProvider => ({
    id,
    name: id,
    categoryId: 'custom',
    kind: 'tool',
    status: 'available',
    description: 'Operation ' + id,
    configFields: [],
    credentialStatus: {managedByBackend: true, writeSupported: false, refs: [], message: ''},
    actions: {canSaveConfig: false, canEnableDisable: false, canTestConnection: true},
    raw: {
      id,
      name: id,
      description: 'Operation ' + id,
      tags: id === 'generated' ? ['generated_tool'] : [],
      security: {read_only: id === 'read', requires_approval: id === 'write'},
    },
  })
);
const leaveStudio = vi.fn();

function WorkspaceNavigation() {
  const {navigate} = useCapabilityDraftGuard();
  return <button onClick={() => navigate(leaveStudio)}>Switch workspace tab</button>;
}

function setup() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
        })
      }
    >
      <CapabilityDraftGuard>
        <WorkspaceNavigation/>
        <CapabilityStudio
          providers={providers}
          actions={null}
          selectedId={null}
          onSelect={vi.fn()}
          renderDetails={() => null}
        />
      </CapabilityDraftGuard>
    </QueryClientProvider>
  );
}

describe('specialist access in Capability Studio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/integrations?integration-tab=custom');
    api.listAgents.mockResolvedValue({
      items: [
        {id: 'main', name: 'Harness', tool_ids: ['read', 'write', 'generated']},
        worker,
        {id: 'other', name: 'Other', tool_ids: []},
      ],
    });
    api.getMainAgent.mockResolvedValue({agent_id: 'main'});
    api.getAgent.mockResolvedValue({...worker, tool_ids: ['read', 'unavailable', 'concurrent']});
    api.updateAgent.mockImplementation(async (id, patch) => ({...worker, id, ...patch}));
  });
  it('keeps the harness out of specialist editing and requires review for new generated grants', async () => {
    setup();
    const select = await screen.findByLabelText('Specialist agent');
    expect(within(select).queryByRole('option', {name: 'Harness'})).not.toBeInTheDocument();
    expect(screen.getByText('All enabled capabilities')).toBeVisible();
    expect(screen.getByRole('checkbox', {name: 'Assign generated'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Save access'})).toBeDisabled();
    expect(screen.getByText('unavailable (unavailable)')).toBeVisible();
  });
  it('saves only explicit changes and preserves unavailable and concurrent grants', async () => {
    setup();
    await screen.findByLabelText('Specialist agent');
    fireEvent.change(screen.getByLabelText('Search capabilities'), {target: {value: 'write'}});
    fireEvent.click(screen.getByRole('checkbox', {name: 'Assign write'}));
    fireEvent.click(screen.getByRole('button', {name: 'Save access'}));
    await waitFor(() =>
      expect(api.updateAgent).toHaveBeenCalledWith('worker', {
        tool_ids: ['read', 'unavailable', 'concurrent', 'write'],
      })
    );
    expect(api.updateAgent.mock.calls[0][1]).not.toHaveProperty('security');
    expect(api.updateAgent.mock.calls[0][1]).not.toHaveProperty('metadata');
  });
  it('rechecks the current main-agent identity immediately before a save', async () => {
    setup();
    await screen.findByLabelText('Specialist agent');
    api.getMainAgent.mockResolvedValue({agent_id: 'worker'});
    fireEvent.click(screen.getByRole('checkbox', {name: 'Assign write'}));
    fireEvent.click(screen.getByRole('button', {name: 'Save access'}));
    expect(
      await screen.findByText('Main-agent access is harness managed. Refresh to continue.')
    ).toBeVisible();
    expect(api.updateAgent).not.toHaveBeenCalled();
  });
  it('keeps drafts on server rejection and cancels them without writing', async () => {
    api.updateAgent.mockRejectedValue(new Error('Existing approval policy denied this change.'));
    setup();
    await screen.findByLabelText('Specialist agent');
    fireEvent.click(screen.getByRole('checkbox', {name: 'Assign write'}));
    fireEvent.click(screen.getByRole('button', {name: 'Save access'}));
    expect(await screen.findByText('Existing approval policy denied this change.')).toBeVisible();
    expect(screen.getByRole('checkbox', {name: 'Assign write'})).toBeChecked();
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(screen.getByRole('checkbox', {name: 'Assign write'})).not.toBeChecked();
    expect(api.updateAgent).toHaveBeenCalledTimes(1);
  });
  it('confirms before switching specialists with an unsaved draft', async () => {
    setup();
    const select = await screen.findByLabelText('Specialist agent');
    fireEvent.click(screen.getByRole('checkbox', {name: 'Assign write'}));
    fireEvent.change(select, {target: {value: 'other'}});
    expect(
      await screen.findByRole('alertdialog', {name: 'Discard unsaved access changes?'})
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', {name: 'Keep editing'}));
    expect(select).toHaveValue('worker');
    expect(screen.getByRole('checkbox', {name: 'Assign write'})).toBeChecked();
    expect(api.updateAgent).not.toHaveBeenCalled();
  });
  it('locks assignments when the harness identity cannot be verified', async () => {
    api.getMainAgent.mockRejectedValue(new Error('Profile unavailable'));
    setup();
    expect(await screen.findByText('Agent access unavailable')).toBeVisible();
    expect(screen.getByRole('checkbox', {name: 'Assign write'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Save access'})).toBeDisabled();
  });
  it('guards workspace navigation until the user explicitly discards the draft', async () => {
    setup();
    await screen.findByLabelText('Specialist agent');
    fireEvent.click(screen.getByRole('checkbox', {name: 'Assign write'}));
    fireEvent.click(screen.getByRole('button', {name: 'Switch workspace tab'}));
    expect(
      await screen.findByRole('alertdialog', {name: 'Discard unsaved access changes?'})
    ).toBeVisible();
    expect(leaveStudio).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: 'Keep editing'}));
    expect(screen.getByRole('checkbox', {name: 'Assign write'})).toBeChecked();
    fireEvent.click(screen.getByRole('button', {name: 'Switch workspace tab'}));
    fireEvent.click(screen.getByRole('button', {name: 'Discard and continue'}));
    expect(leaveStudio).toHaveBeenCalledTimes(1);
    expect(api.updateAgent).not.toHaveBeenCalled();
  });
});
