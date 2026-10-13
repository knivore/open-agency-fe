import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ToolAssignmentControls from './ToolAssignmentControls';

function Harness({ disabled = false, readOnly = false, isMainAgent = false }) {
  const [ids, setIds] = useState(['legacy-unavailable', 'agency.memory.list']);
  return (
    <>
      <output aria-label="Selected IDs">{ids.join(',')}</output>
      <ToolAssignmentControls
        readOnly={readOnly}
        isMainAgent={isMainAgent}
        disabled={disabled}
        onChange={setIds}
        toolIds={ids}
        tools={[
          {
            id: 'agency.memory.list',
            name: 'Read memories',
            description: 'Read durable context.',
            security: { read_only: true },
          },
          {
            id: 'agency.browser.inspect',
            name: 'Inspect browser',
            description: 'Read a page.',
            input_schema: { properties: { mode: { enum: ['snapshot', 'console', 'network'] } } },
            security: { read_only: true },
          },
          {
            id: 'agency.browser.click',
            name: 'Click browser',
            description: 'Click a page control.',
            security: { requires_approval: true },
          },
        ]}
      />
    </>
  );
}

describe('specialist capability selection', () => {
  it('applies bulk changes only to the search and access matches while preserving other grants', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Search capabilities'), {
      target: { value: 'browser' },
    });
    fireEvent.change(screen.getByLabelText('Access level'), { target: { value: 'read' } });
    fireEvent.click(screen.getByRole('button', { name: 'Select matching (1)' }));
    expect(screen.getByLabelText('Selected IDs')).toHaveTextContent(
      'legacy-unavailable,agency.memory.list,agency.browser.inspect'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear matching' }));
    expect(screen.getByLabelText('Selected IDs')).toHaveTextContent(
      'legacy-unavailable,agency.memory.list'
    );
    expect(screen.getByText('1 unavailable assigned tools')).toBeInTheDocument();
  });
  it('shows assigned tools only and prevents changes while saving', () => {
    render(<Harness disabled />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Assigned only' }));
    expect(screen.getByText('1 matching tools')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear matching' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'No tools' })).toBeDisabled();
  });
  it('browses all main-agent operations without changing explicit assignments', () => {
    render(<Harness readOnly isMainAgent />);
    expect(screen.getByText('3 available')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Select matching/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search capabilities'), {
      target: { value: 'browser' },
    });
    expect(screen.getByText('2 matching tools')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search capabilities'), {
      target: { value: 'console' },
    });
    expect(screen.getByText('1 matching tools')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Browser & local apps/ }));
    expect(screen.getByText('Actions: snapshot, console, network')).toBeVisible();
    expect(screen.getByLabelText('Selected IDs')).toHaveTextContent(
      'legacy-unavailable,agency.memory.list'
    );
  });
  it('limits specialist browsing to assigned operations and retains unavailable IDs', () => {
    render(<Harness readOnly />);
    expect(screen.getByText('1 matching tools')).toBeInTheDocument();
    expect(screen.getByText('1 unavailable assigned tools')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Browser & local apps/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search capabilities'), {
      target: { value: 'browser' },
    });
    expect(screen.getByText('0 matching tools')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'No tools' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Selected IDs')).toHaveTextContent(
      'legacy-unavailable,agency.memory.list'
    );
  });
});
