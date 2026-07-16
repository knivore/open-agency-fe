import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProfilePage from '@/app/(protected)/profile/page';

const { apiTokensApi, profileApi, signOut, usersApi } = vi.hoisted(() => ({
  apiTokensApi: {
    listTokens: vi.fn(),
    listScopes: vi.fn(),
    createToken: vi.fn(),
    revokeToken: vi.fn(),
  },
  profileApi: {
    getApiTokenCapability: vi.fn(() => ({
      readSupported: true,
      writeSupported: true,
      plannedRoutes: ['/api-tokens', '/api-tokens/scopes'],
      message: 'Automation keys are enabled.',
    })),
    getPublicEndpointInfo: vi.fn(),
    getOpenVoiceStatus: vi.fn(),
    updateOpenVoiceSettings: vi.fn(),
    installOpenVoiceCheckpoints: vi.fn(),
    testOpenVoice: vi.fn(),
  },
  usersApi: {
    getCurrentUser: vi.fn(),
    updateCurrentUserProfile: vi.fn(),
    updateLocalCredentials: vi.fn(),
  },
  signOut: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  signOut,
  useSession: () => ({
    status: 'authenticated',
    data: {
      user: {
        id: 'user-1',
        email: 'owner@example.com',
        name: 'Owner One',
        authMode: 'nextauth',
      },
    },
  }),
}));

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string; src: string }) => <span aria-label={alt} role="img" />,
}));

vi.mock('@/lib/api/backend/apiTokens', () => ({
  apiTokensApi,
}));

vi.mock('@/lib/api/backend/profile', () => ({
  profileApi,
}));

vi.mock('@/lib/api/backend/users', () => ({
  usersApi,
  getBackendUserProfilePreferences: (user?: {
    display_name?: string | null;
    metadata?: Record<string, unknown>;
  }) => {
    const candidate = user?.metadata?.profile_preferences;
    const preferences =
      candidate && typeof candidate === 'object' ? (candidate as Record<string, unknown>) : {};
    return {
      displayName:
        typeof preferences.display_name === 'string'
          ? preferences.display_name
          : (user?.display_name ?? null),
      timezone: typeof preferences.timezone === 'string' ? preferences.timezone : null,
    };
  },
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ProfilePage />
    </QueryClientProvider>
  );
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();

    usersApi.getCurrentUser.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
      display_name: 'Owner One',
      status: 'active',
      avatar_url: null,
      local_credentials_enabled: true,
      metadata: {
        profile_preferences: {
          display_name: 'Owner One',
          timezone: 'Asia/Singapore',
        },
      },
    });

    usersApi.updateCurrentUserProfile.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
      display_name: 'Owner Preferred',
      status: 'active',
      avatar_url: null,
      metadata: {
        profile_preferences: {
          display_name: 'Owner Preferred',
          timezone: 'Asia/Singapore',
        },
      },
    });

    profileApi.getOpenVoiceStatus.mockResolvedValue({
      optional: true,
      ready: true,
      supports_cloning: true,
      runtime: { installed: true, root: '/opt/openvoice', revision: '74a1d147b17a8c3' },
      checkpoints: { directory: '/data/checkpoints', installed: true, missing_files: [] },
      settings: { default_voice: 'friendly', language: 'English' },
      available_voices: ['friendly', 'cheerful'],
    });

    apiTokensApi.listTokens.mockResolvedValue({
      items: [
        {
          id: 'token-1',
          owner_user_id: 'user-1',
          name: 'Existing automation',
          prefix: 'agt_abcd',
          last4: '1234',
          scopes: ['workflows:run'],
          revoked_at: null,
          last_used_at: '2026-05-07T06:00:00.000Z',
        },
        {
          id: 'session-token-1',
          owner_user_id: 'user-1',
          name: 'Local auth session',
          prefix: 'agt_session',
          last4: 'abcd',
          scopes: ['workflows:run'],
          revoked_at: null,
          last_used_at: '2026-05-07T06:30:00.000Z',
          metadata: { issued_by: 'local_auth', session: true },
        },
      ],
    });

    apiTokensApi.listScopes.mockResolvedValue({
      items: [
        {
          id: 'workflows:run',
          label: 'Workflows run',
          description: 'Start workflow executions.',
          category: 'workflows',
        },
        {
          id: 'workflows:read',
          label: 'Workflows read',
          description: 'Read workflow definitions and workflow metadata.',
          category: 'workflows',
        },
      ],
    });

    apiTokensApi.createToken.mockResolvedValue({
      id: 'token-2',
      owner_user_id: 'user-1',
      name: 'Nightly runner',
      prefix: 'agt_efgh',
      last4: '5678',
      scopes: ['workflows:run'],
      revoked_at: null,
      last_used_at: null,
      token: 'agt_secret_token',
    });

    apiTokensApi.revokeToken.mockResolvedValue({
      id: 'token-1',
      owner_user_id: 'user-1',
      name: 'Existing automation',
      prefix: 'agt_abcd',
      last4: '1234',
      scopes: ['workflows:run'],
      revoked_at: '2026-05-07T07:00:00.000Z',
      last_used_at: '2026-05-07T06:00:00.000Z',
    });

    profileApi.getPublicEndpointInfo.mockResolvedValue({
      provider: 'cloudflare',
      custom_domain: null,
      source: 'launcher',
      updated_at: '2026-06-24T00:00:00Z',
      current_public_url: 'https://agency.trycloudflare.com',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders backend identity and automation keys without local auth sessions', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Existing automation')).toBeInTheDocument();
    });

    expect(screen.getByText('Owner One')).toBeInTheDocument();
    expect(screen.getByText('owner@example.com')).toBeInTheDocument();
    expect(screen.getAllByText('workflows:run').length).toBeGreaterThan(0);
    expect(screen.getByText('Backend identity synced')).toBeInTheDocument();
    expect(screen.getByText('Integration Setup Details')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage tunnel' })).toHaveAttribute(
      'href',
      '/setup#public-tunnel'
    );
    expect(screen.getByText('Personal settings')).toBeInTheDocument();
    expect(screen.getByText('Local sign-in')).toBeInTheDocument();
    expect(screen.getByText('Browser preferences')).toBeInTheDocument();
    expect(screen.getByText('This browser')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Automation keys' })).toBeInTheDocument();
    expect(screen.queryByText('Local auth session')).not.toBeInTheDocument();
    expect(screen.getByText('https://agency.trycloudflare.com')).toBeInTheDocument();
    expect(
      screen.getByText(
        'https://agency.trycloudflare.com/integrations/conversations/adapters/<provider>/webhook'
      )
    ).toBeInTheDocument();
  });

  it('saves account-scoped personal settings', async () => {
    renderPage();

    const displayNameInput = await screen.findByLabelText('Display name');
    expect(screen.getByLabelText('Time zone')).toHaveValue('Asia/Singapore');
    fireEvent.change(displayNameInput, { target: { value: 'Owner Preferred' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save personal settings' }));

    await waitFor(() => {
      expect(usersApi.updateCurrentUserProfile).toHaveBeenCalledWith({
        display_name: 'Owner Preferred',
        timezone: 'Asia/Singapore',
      });
    });
    expect(await screen.findByText('Personal settings saved')).toBeInTheDocument();
  });

  it('stores the diagnostics workspace preference from the profile page', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText('Show diagnostics workspace')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Show diagnostics workspace'));

    await waitFor(() => {
      expect(screen.getByText('Diagnostics visible')).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: 'Open Diagnostics' })).toHaveAttribute(
      'href',
      '/operations/diagnostics'
    );
    expect(window.localStorage.getItem('agency:user-preferences:v1')).toContain(
      '"showDiagnostics":true'
    );
  });

  it('falls back to bundled scopes when the backend scope list fails', async () => {
    apiTokensApi.listScopes.mockRejectedValueOnce(new Error('scope endpoint unavailable'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Workflows run')).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        'Scope definitions are maintained by the backend. Read scopes allow viewing resources, while write scopes allow creating and changing them.'
      )
    ).toBeInTheDocument();
  });

  it('creates an automation key from the selected scopes and reveals it once', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText('Automation key name')).toBeInTheDocument();
    });

    const tokenNameInput = screen.getByLabelText('Automation key name');
    fireEvent.change(tokenNameInput, { target: { value: 'Nightly runner' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create automation key' }));

    await waitFor(() => {
      expect(apiTokensApi.createToken).toHaveBeenCalledWith({
        name: 'Nightly runner',
        scopes: ['workflows:run'],
      });
    });

    expect(
      screen.getByText('Copy this automation key now. It will not be shown again.')
    ).toBeInTheDocument();
    expect(screen.getByText('agt_secret_token')).toBeInTheDocument();
  });

  it('revokes an issued automation key from the table', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Existing automation')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));

    await waitFor(() => {
      expect(apiTokensApi.revokeToken).toHaveBeenCalledWith('token-1');
    });
  });
});
