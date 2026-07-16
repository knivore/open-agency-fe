import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LocalSignInSettingsCard from '@/components/profile/LocalSignInSettingsCard';

const { signOut, updateLocalCredentials } = vi.hoisted(() => ({
  signOut: vi.fn(),
  updateLocalCredentials: vi.fn(),
}));

vi.mock('next-auth/react', () => ({ signOut }));
vi.mock('@/lib/api/backend/users', () => ({
  usersApi: { updateLocalCredentials },
}));

const user = {
  id: 'user-1',
  email: 'owner@example.com',
  display_name: 'Owner One',
  status: 'active' as const,
  roles: ['admin'],
  local_credentials_enabled: true,
  metadata: {},
};

function renderCard() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LocalSignInSettingsCard user={user} />
    </QueryClientProvider>
  );
}

describe('LocalSignInSettingsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateLocalCredentials.mockResolvedValue({
      user: { ...user, email: 'new-owner@example.com' },
      reauthentication_required: true,
      revoked_sessions: 1,
    });
    signOut.mockResolvedValue(undefined);
  });

  it('updates the local login and signs out after the backend revokes sessions', async () => {
    renderCard();

    fireEvent.change(screen.getByLabelText('Login email'), {
      target: { value: 'new-owner@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'old-password' },
    });
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'new-password' },
    });
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'new-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update sign-in and sign out' }));

    await waitFor(() => {
      expect(updateLocalCredentials).toHaveBeenCalledWith({
        email: 'new-owner@example.com',
        current_password: 'old-password',
        new_password: 'new-password',
      });
    });
    await waitFor(() => {
      expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/login?callbackUrl=%2Fprofile' });
    });
  });

  it('blocks mismatched password confirmation', () => {
    renderCard();

    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'old-password' },
    });
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'new-password' },
    });
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'different-password' },
    });

    expect(screen.getByText('The new passwords do not match.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update sign-in and sign out' })).toBeDisabled();
    expect(updateLocalCredentials).not.toHaveBeenCalled();
  });
});
