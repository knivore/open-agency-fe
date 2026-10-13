import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WorkspaceDirectory from './WorkspaceDirectory';

const alpha = { id: 'alpha', label: 'Alpha', group: 'Primary' };
const beta = { id: 'beta', label: 'Beta', group: 'Specialists' };

describe('WorkspaceDirectory', () => {
  it('keeps a filtered selection and delegates a new selection to the feature guard', () => {
    const onSelect = vi.fn();
    render(
      <WorkspaceDirectory
        label="Test directory"
        title="Items"
        entries={[beta]}
        selected={alpha}
        onSelect={onSelect}
        search={{ label: 'Find item', value: '', onChange: vi.fn() }}
        selectionLabel="Inspect item"
      />
    );
    const selection = screen.getByLabelText('Inspect item');
    expect(selection).toHaveValue('alpha');
    expect(screen.getByRole('option', { name: 'Alpha · Current selection' })).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.change(selection, { target: { value: 'beta' } });
    expect(onSelect).toHaveBeenCalledWith('beta');
    expect(selection).toHaveValue('alpha');
  });
  it('supports independent instances and disables selection and searching while busy', () => {
    const props = {
      label: 'Directory',
      title: 'Items',
      entries: [alpha],
      selected: alpha,
      onSelect: vi.fn(),
      search: { label: 'Find item', value: '', onChange: vi.fn() },
      selectionLabel: 'Inspect item',
      disabled: true,
    };
    render(
      <>
        <WorkspaceDirectory {...props} />
        <WorkspaceDirectory {...props} />
      </>
    );
    const selectors = screen.getAllByLabelText('Inspect item');
    expect(selectors[0].id).not.toBe(selectors[1].id);
    selectors.forEach((selector) => expect(selector).toBeDisabled());
    screen.getAllByRole('searchbox').forEach((search) => expect(search).toBeDisabled());
    screen
      .getAllByRole('button', { name: 'Alpha' })
      .forEach((button) => expect(button).toBeDisabled());
  });
});
