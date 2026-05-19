import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RunsModuleProvider } from '@/components/runs/context';
import RunSessionsTable from '@/components/runs/components/RunSessionsTable';
import type { RunSessionSummary } from '@/types/runtime';

const { pushMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

function createRuns(count: number): RunSessionSummary[] {
  return Array.from({ length: count }, (_, index) => {
    const runNumber = index + 1;
    return {
      id: `run-${runNumber}`,
      workflowId: `workflow-${runNumber}`,
      runtimeAdapterId: 'native',
      status: 'completed',
      startedAt: '2026-05-07T00:01:00.000Z',
      completedAt: '2026-05-07T00:02:00.000Z',
      container: {},
      error: null,
    };
  });
}

function renderTable(count: number) {
  const runs = createRuns(count);
  const workflowNamesById = new Map(
    runs.map((run, index) => [run.workflowId as string, `Workflow ${index + 1}`])
  );

  render(
    <RunsModuleProvider
      api={{
        executionActions: {
          downloadResult: vi.fn(),
          rateResult: vi.fn(),
        },
      }}
    >
      <RunSessionsTable runs={runs} workflowNamesById={workflowNamesById} />
    </RunsModuleProvider>
  );
}

describe('RunSessionsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows up to 10 runs on each page', () => {
    renderTable(11);

    expect(screen.getByRole('link', { name: 'Workflow 1' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Workflow 10' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Workflow 11' })).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1-10 of 11 runs')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.queryByRole('link', { name: 'Workflow 1' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Workflow 11' })).toBeInTheDocument();
    expect(screen.getByText('Showing 11-11 of 11 runs')).toBeInTheDocument();
  });

  it('omits pagination controls when 10 or fewer runs are visible', () => {
    renderTable(10);

    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Showing 1-10 of 10 runs/)).not.toBeInTheDocument();
  });
});
