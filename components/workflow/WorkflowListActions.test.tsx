import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WorkflowListActions from '@/components/workflow/WorkflowListActions';
import type { WorkflowDefinition } from '@/types/workflows';

const { downloadWorkflowExportPackageMock, launchWorkflow, pushMock, toastSuccessMock } =
  vi.hoisted(() => ({
    downloadWorkflowExportPackageMock: vi.fn(),
    launchWorkflow: vi.fn(),
    pushMock: vi.fn(),
    toastSuccessMock: vi.fn(),
  }));

vi.mock('@/lib/workflows/workflowExport', () => ({
  downloadWorkflowExportPackage: downloadWorkflowExportPackageMock,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/lib/workflows/useWorkflowRunLauncher', () => ({
  useWorkflowRunLauncher: () => ({
    preferredRuntimeAdapterId: 'native',
    launchMutation: { isPending: false },
    launchWorkflow,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    promise: (promise: Promise<unknown>) => promise,
    success: toastSuccessMock,
  },
}));

const workflow = {
  id: 'workflow-1',
  name: 'Review workflow',
  description: 'Reviews a change.',
} as WorkflowDefinition;

function renderActions() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <WorkflowListActions workflow={workflow} runtimeAdapters={[]} />
    </QueryClientProvider>
  );
}

describe('WorkflowListActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    launchWorkflow.mockResolvedValue({ id: 'run-1' });
    downloadWorkflowExportPackageMock.mockReturnValue(true);
  });

  it('does not start a quick run until the side-effect warning is confirmed', async () => {
    renderActions();

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Actions for Review workflow' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Quick run' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('external services');
    expect(launchWorkflow).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Start run' }));
    await waitFor(() => expect(launchWorkflow).toHaveBeenCalledOnce());
  });

  it('exposes run, export, and delete actions from the compact row menu', () => {
    renderActions();

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Actions for Review workflow' }));

    expect(screen.getByRole('menuitem', { name: 'Quick run' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Export workflow' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete workflow' })).toBeInTheDocument();
  });

  it('downloads the workflow export from the row menu', () => {
    renderActions();

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Actions for Review workflow' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export workflow' }));

    expect(downloadWorkflowExportPackageMock).toHaveBeenCalledWith(workflow, {
      availableModelProfiles: [],
      availableTools: [],
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('Workflow export downloaded.', {
      position: 'top-right',
    });
  });
});
