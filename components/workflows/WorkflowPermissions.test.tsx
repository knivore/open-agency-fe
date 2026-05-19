import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WorkflowPermissions from '@/components/workflows/WorkflowPermissions';
import type { User } from '@/types/users';

const { getUsersByEmail } = vi.hoisted(() => ({
  getUsersByEmail: vi.fn(),
}));

const { postMock, deleteMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
  deleteMock: vi.fn(),
}));

const { successMock, errorMock } = vi.hoisted(() => ({
  successMock: vi.fn(),
  errorMock: vi.fn(),
}));

vi.mock('lodash', () => ({
  debounce: (fn: (value: string) => void) => {
    const wrapped = (value: string) => fn(value);
    wrapped.cancel = vi.fn();
    return wrapped;
  },
}));

vi.mock('@/app/api/utils/workflows', () => ({
  getUsersByEmail,
}));

vi.mock('@/lib/api', () => ({
  appApiClient: {
    post: postMock,
    delete: deleteMock,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: successMock,
    error: errorMock,
  },
}));

function renderPermissions(props?: Partial<ComponentProps<typeof WorkflowPermissions>>) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const creator: User = {
    id: 'user-1',
    name: 'Owner One',
    email: 'owner@example.com',
    image: null,
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <WorkflowPermissions
        workflowId="workflow-1"
        workflowName="Launch Workflow"
        creator={creator}
        workflowOwners={[creator]}
        onClose={vi.fn()}
        {...props}
      />
    </QueryClientProvider>
  );
}

describe('WorkflowPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUsersByEmail.mockResolvedValue([
      {
        id: 'user-2',
        name: 'Teammate Two',
        email: 'teammate@example.com',
        image: null,
      },
    ]);
    postMock.mockResolvedValue({ message: 'ok' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('looks up users by email and adds selected owners', async () => {
    const onClose = vi.fn();
    renderPermissions({ onClose });

    fireEvent.click(screen.getByRole('button', { name: /share/i }));

    const input = screen.getByPlaceholderText('Enter email to add owners');
    fireEvent.change(input, { target: { value: 'team' } });

    await waitFor(() => {
      expect(getUsersByEmail).toHaveBeenCalledWith('team');
    });

    await waitFor(() => {
      expect(screen.getByText('Teammate Two')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Teammate Two'));

    expect(screen.getByText('Teammate Two | (teammate@example.com)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/api/workflows/workflow-1/owners', ['user-2']);
    });

    expect(successMock).toHaveBeenCalledWith('Access updated successfully!', { position: 'top-right' });
    expect(onClose).toHaveBeenCalled();
  });

  it('filters out already selected users from subsequent search results', async () => {
    renderPermissions();

    fireEvent.click(screen.getByRole('button', { name: /share/i }));

    const input = screen.getByPlaceholderText('Enter email to add owners');
    fireEvent.change(input, { target: { value: 'team' } });

    await waitFor(() => {
      expect(screen.getByText('Teammate Two')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Teammate Two'));
    fireEvent.change(input, { target: { value: 'teamm' } });

    await waitFor(() => {
      expect(getUsersByEmail).toHaveBeenCalledTimes(2);
    });

    expect(screen.queryByText('Teammate Two')).not.toBeInTheDocument();
  });
});
