import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RunsModuleProvider } from '@/components/runs/context';
import RunSessionRow from '@/components/runs/components/RunSessionRow';
import { Table, TableBody } from '@/components/library/shadcn/table';
import type { RunSessionSummary } from '@/types/runtime';

const { pushMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

const execution: RunSessionSummary = {
  id: 'run-1',
  workflowId: 'workflow-1',
  runtimeAdapterId: 'native',
  status: 'running',
  createdAt: '2026-05-07T00:00:00.000Z',
  startedAt: '2026-05-07T00:01:00.000Z',
  completedAt: null,
  container: {},
  error: null,
};

function renderRow(run: RunSessionSummary = execution) {
  render(
    <RunsModuleProvider
      api={{
        executionActions: {
          downloadResult: vi.fn(),
          rateResult: vi.fn(),
        },
      }}
    >
      <Table>
        <TableBody>
          <RunSessionRow execution={run} />
        </TableBody>
      </Table>
    </RunsModuleProvider>
  );
}

describe('RunSessionRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the run detail page when the row is clicked', () => {
    renderRow();

    const row = screen.getByRole('link', { name: 'Unnamed workflow' }).closest('tr');
    expect(row).not.toBeNull();
    fireEvent.click(row as HTMLTableRowElement);

    expect(pushMock).toHaveBeenCalledWith('/runs/run-1?workflowId=workflow-1&tab=runs');
  });

  it('keeps the workflow link separate from row navigation', () => {
    renderRow();

    fireEvent.click(screen.getByRole('link', { name: 'Unnamed workflow' }));

    expect(pushMock).not.toHaveBeenCalled();
  });

  it('renders an explicit details link to the run detail page', () => {
    renderRow();

    expect(screen.getByRole('link', { name: 'View run details for Unnamed workflow' })).toHaveAttribute(
      'href',
      '/runs/run-1?workflowId=workflow-1&tab=runs'
    );
  });

  it('renders the workflow name when one is provided', () => {
    render(
      <RunsModuleProvider
        api={{
          executionActions: {
            downloadResult: vi.fn(),
            rateResult: vi.fn(),
          },
        }}
      >
        <Table>
          <TableBody>
            <RunSessionRow execution={execution} workflowName="Customer Onboarding" />
          </TableBody>
        </Table>
      </RunsModuleProvider>
    );

    expect(screen.getByRole('link', { name: 'Customer Onboarding' })).toHaveAttribute(
      'href',
      '/workflows/workflow-1'
    );
    expect(screen.queryByText('run-1')).not.toBeInTheDocument();
    expect(screen.queryByText('workflow-1')).not.toBeInTheDocument();
  });
});
