import {useState} from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it} from 'vitest';
import type {IntegrationProvider} from '@/types/integrations';
import CapabilityCatalog from './CapabilityCatalog';

function provider(index: number): IntegrationProvider {
  const id = `agency.memory.op-${String(index).padStart(2, '0')}`;
  return {
    id,
    name: `Memory ${index}`,
    categoryId: 'custom',
    kind: 'tool',
    status: 'available',
    description: 'Use this memory in a workflow with documents.',
    configFields: [],
    credentialStatus: {managedByBackend: true, writeSupported: false, refs: [], message: ''},
    actions: {canSaveConfig: false, canEnableDisable: false, canTestConnection: true},
    raw: {
      id,
      name: `Memory ${index}`,
      description: 'Read memory',
      security: {read_only: index !== 1, requires_approval: index === 1},
      input_schema: {properties: {memory_id: {type: 'string'}}},
    },
  };
}

function Harness({providers}: { providers: IntegrationProvider[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <CapabilityCatalog
      providers={providers}
      actions={null}
      selectedId={selectedId}
      onSelect={setSelectedId}
      renderDetails={(item) => <p>Contract for {item.id}</p>}
    />
  );
}

describe('capability browsing', () => {
  beforeEach(() => window.history.replaceState({}, '', '/integrations?integration-tab=custom'));
  it('counts unique tools and limits even a single large family to 12 operations per page', () => {
    const providers = Array.from({length: 25}, (_, index) => provider(index));
    render(<Harness providers={[...providers, providers[0]]}/>);
    expect(screen.getByText('25 tool operations')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Browse Memory & knowledge'}));
    expect(screen.getAllByRole('button', {name: /^Inspect/})).toHaveLength(12);
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Next'}));
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Next'}));
    expect(screen.getAllByRole('button', {name: /^Inspect/})).toHaveLength(1);
    expect(screen.getByRole('button', {name: 'Next'})).toBeDisabled();
  });
  it('filters by access and restores focus after closing operation details', async () => {
    render(<Harness providers={[provider(0), provider(1)]}/>);
    fireEvent.click(screen.getByRole('button', {name: 'Filters'}));
    fireEvent.change(screen.getByLabelText('Access level'), {target: {value: 'approval'}});
    expect(screen.getAllByRole('button', {name: /^Inspect/})).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', {name: 'Inspect Memory 1'}));
    expect(screen.getByRole('dialog', {name: 'Memory 1'})).toBeVisible();
    fireEvent.click(screen.getByRole('button', {name: 'Close'}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Inspect Memory 1'})).toHaveFocus()
    );
  });
  it('restores parameter searches from a direct link and resets filters to the overview', () => {
    window.history.replaceState(
      {},
      '',
      '/integrations?integration-tab=custom&integration-search-custom=memory_id&capability-access=read'
    );
    render(<Harness providers={[provider(0), provider(1)]}/>);
    expect(screen.getByLabelText('Search capabilities')).toHaveValue('memory_id');
    expect(screen.getAllByRole('button', {name: /^Inspect/})).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', {name: 'Family overview'}));
    expect(screen.getByRole('button', {name: 'Browse Memory & knowledge'})).toBeVisible();
    expect(window.location.search).toBe('?integration-tab=custom');
  });
});
