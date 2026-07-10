import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LocalSetupPage from '@/modules/onboarding/app/LocalSetupPage';

const { getMock, postMock, putMock, refreshMock, replaceMock, signInMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  putMock: vi.fn(),
  refreshMock: vi.fn(),
  replaceMock: vi.fn(),
  signInMock: vi.fn(),
}));

let sessionStatus: 'authenticated' | 'unauthenticated' | 'loading' = 'unauthenticated';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: refreshMock,
    replace: replaceMock,
  }),
}));

vi.mock('next-auth/react', () => ({
  signIn: signInMock,
  useSession: () => ({
    status: sessionStatus,
  }),
}));

vi.mock('@/lib/api/clientInstances', () => ({
  agencyApiClient: {
    get: getMock,
    post: postMock,
    put: putMock,
  },
}));

vi.mock('@/lib/api/config', () => ({
  getAgencyApiBaseUrl: () => 'http://backend.test',
}));

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function setupStatus(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    ready: false,
    next_path: '/setup',
    blockers: ['no_users', 'no_admin_user'],
    database: {
      configured: true,
      reachable: true,
      detail: null,
    },
    users: {
      count: 0,
      has_admin: false,
      auth_bootstrap_supported: true,
      recommended_bootstrap: 'local_admin_setup',
    },
    models: {
      has_usable_model_profiles: false,
      bootstrap_configured: false,
    },
    main_agent: {
      configured: false,
    },
    ...overrides,
  };
}

function tunnelPreference(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    provider: 'auto',
    custom_domain: null,
    source: 'launcher-default',
    updated_at: '2026-06-24T00:00:00Z',
    current_public_url: null,
    requirements: {
      restart_required: true,
      custom_domain_requires_provider_setup: false,
      ngrok: {
        requires_reserved_domain_and_dns: false,
        requires_paid_plan_for_custom_domain: false,
      },
      cloudflare: {
        requires_managed_tunnel_token: false,
        requires_published_application_route: false,
        managed_tunnel_token_configured: false,
      },
    },
    ...overrides,
  };
}

describe('LocalSetupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStatus = 'unauthenticated';
    getMock.mockImplementation((path: string) => {
      if (path === '/setup/tunnel-preference') {
        return Promise.resolve(tunnelPreference());
      }
      return Promise.resolve({ items: [] });
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the first-admin step when no admin exists', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(setupStatus())));

    render(<LocalSetupPage />);

    expect(
      await screen.findByRole('heading', {
        name: 'Turn this backend into your local Agency install',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Step 1: Create the local admin' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create local admin' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Step 2: Connect the runtime' })
    ).not.toBeInTheDocument();
  });

  it('bootstraps the first local admin and signs in to continue setup', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(setupStatus()))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(
        jsonResponse(
          setupStatus({
            blockers: ['no_model_profiles', 'main_agent_not_configured'],
            users: {
              count: 1,
              has_admin: true,
              auth_bootstrap_supported: false,
              recommended_bootstrap: 'signin_and_continue_setup',
            },
          })
        )
      );
    vi.stubGlobal('fetch', fetchMock);
    signInMock.mockResolvedValue({ error: null });

    render(<LocalSetupPage />);

    fireEvent.change(await screen.findByLabelText('Admin name'), {
      target: { value: 'Local Admin' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'change-me-123' },
    });
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'change-me-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create local admin' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://backend.test/auth/bootstrap',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            display_name: 'Local Admin',
            email: 'admin@example.com',
            password: 'change-me-123',
          }),
        })
      );
    });

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith('credentials', {
        email: 'admin@example.com',
        password: 'change-me-123',
        callbackUrl: '/setup',
        redirect: false,
      });
    });

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalled();
    });
  });

  it('shows runtime setup for authenticated users after admin bootstrap', async () => {
    sessionStatus = 'authenticated';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          setupStatus({
            blockers: ['no_model_profiles', 'main_agent_not_configured'],
            users: {
              count: 1,
              has_admin: true,
              auth_bootstrap_supported: false,
              recommended_bootstrap: 'signin_and_continue_setup',
            },
          })
        )
      )
    );

    render(<LocalSetupPage />);

    expect(
      await screen.findByRole('heading', { name: 'Step 2: Connect the runtime' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Provider')).toBeInTheDocument();
    expect(screen.getByLabelText('Model')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish Agency setup' })).toBeInTheDocument();
  });

  it('configures the model profile and main agent, then redirects once ready', async () => {
    sessionStatus = 'authenticated';
    getMock.mockImplementation((path: string) => {
      if (path === '/setup/tunnel-preference') {
        return Promise.resolve(tunnelPreference());
      }
      return Promise.resolve({ items: [] });
    });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse(
            setupStatus({
              blockers: ['no_model_profiles', 'main_agent_not_configured'],
              users: {
                count: 1,
                has_admin: true,
                auth_bootstrap_supported: false,
                recommended_bootstrap: 'signin_and_continue_setup',
              },
            })
          )
        )
        .mockResolvedValueOnce(
          jsonResponse(
            setupStatus({
              ready: true,
              next_path: '/workflows',
              blockers: [],
              users: {
                count: 1,
                has_admin: true,
                auth_bootstrap_supported: false,
                recommended_bootstrap: 'signin_and_continue_setup',
              },
              models: {
                has_usable_model_profiles: true,
                bootstrap_configured: false,
              },
              main_agent: {
                configured: true,
              },
            })
          )
        )
    );
    postMock
      .mockResolvedValueOnce({ id: 'setup-profile-openai' })
      .mockResolvedValueOnce({ id: 'main-agent-profile' })
      .mockResolvedValueOnce({
        coder_agent_id: 'coder',
        embedding_agent_id: 'embedding',
        evaluation_agent_id: 'evaluation',
      });

    render(<LocalSetupPage />);

    fireEvent.change(await screen.findByLabelText('API key'), {
      target: { value: 'sk-test-setup' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Finish Agency setup' }));

    await waitFor(() => {
      expect(postMock).toHaveBeenNthCalledWith(1, 'http://backend.test/setup/model-profile', {
        provider: 'openai',
        model: 'gpt-4.1-mini',
        api_key: 'sk-test-setup',
        base_url: undefined,
      });
    });

    await waitFor(() => {
      expect(postMock).toHaveBeenNthCalledWith(2, 'http://backend.test/setup/main-agent', {
        model_profile_id: 'setup-profile-openai',
        agent_name: 'Main Agent',
      });
    });

    await waitFor(() => {
      expect(postMock).toHaveBeenNthCalledWith(3, 'http://backend.test/setup/recommended-agents', {
        include_coder: true,
        include_embedding: true,
        include_evaluation: true,
      });
    });

    expect(await screen.findByText('Agency is ready.')).toBeInTheDocument();
  });

  it('reuses an existing model profile when one already exists', async () => {
    sessionStatus = 'authenticated';
    getMock.mockImplementation((path: string) => {
      if (path === '/setup/tunnel-preference') {
        return Promise.resolve(tunnelPreference());
      }
      return Promise.resolve({
        items: [
          {
            id: 'existing-profile',
            name: 'Existing Profile',
            provider: 'setup-provider-openai',
            model: 'gpt-4.1-mini',
          },
        ],
      });
    });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse(
            setupStatus({
              blockers: ['main_agent_not_configured'],
              users: {
                count: 1,
                has_admin: true,
                auth_bootstrap_supported: false,
                recommended_bootstrap: 'signin_and_continue_setup',
              },
              models: {
                has_usable_model_profiles: true,
                bootstrap_configured: false,
              },
            })
          )
        )
        .mockResolvedValueOnce(
          jsonResponse(
            setupStatus({
              ready: true,
              next_path: '/workflows',
              blockers: [],
              users: {
                count: 1,
                has_admin: true,
                auth_bootstrap_supported: false,
                recommended_bootstrap: 'signin_and_continue_setup',
              },
              models: {
                has_usable_model_profiles: true,
                bootstrap_configured: false,
              },
              main_agent: {
                configured: true,
              },
            })
          )
        )
    );
    postMock.mockResolvedValueOnce({ id: 'main-agent-profile' }).mockResolvedValueOnce({
      coder_agent_id: 'coder',
      embedding_agent_id: 'embedding',
      evaluation_agent_id: 'evaluation',
    });

    render(<LocalSetupPage />);

    expect(await screen.findByLabelText('Model profile')).toBeInTheDocument();
    expect(screen.queryByLabelText('API key')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Finish Agency setup' }));

    await waitFor(() => {
      expect(postMock).toHaveBeenNthCalledWith(1, 'http://backend.test/setup/main-agent', {
        model_profile_id: 'existing-profile',
        agent_name: 'Main Agent',
      });
    });

    expect(postMock).not.toHaveBeenCalledWith(
      'http://backend.test/setup/model-profile',
      expect.anything()
    );
  });

  it('saves a browser tunnel preference with a custom domain', async () => {
    sessionStatus = 'authenticated';
    putMock.mockResolvedValue(
      tunnelPreference({
        provider: 'cloudflare',
        custom_domain: 'agency.example.com',
        source: 'browser',
        requirements: {
          ...tunnelPreference().requirements,
          custom_domain_requires_provider_setup: true,
          cloudflare: {
            requires_managed_tunnel_token: true,
            requires_published_application_route: true,
            managed_tunnel_token_configured: true,
          },
        },
      })
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          setupStatus({
            blockers: ['main_agent_not_configured'],
            users: {
              count: 1,
              has_admin: true,
              auth_bootstrap_supported: false,
              recommended_bootstrap: 'signin_and_continue_setup',
            },
            models: {
              has_usable_model_profiles: true,
              bootstrap_configured: false,
            },
          })
        )
      )
    );

    render(<LocalSetupPage />);

    fireEvent.change(await screen.findByLabelText('Tunnel provider'), {
      target: { value: 'cloudflare' },
    });
    fireEvent.change(screen.getByLabelText('Custom domain'), {
      target: { value: 'agency.example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save tunnel preference' }));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith('/setup/tunnel-preference', {
        provider: 'cloudflare',
        custom_domain: 'agency.example.com',
      });
    });
    expect(
      await screen.findByText(/will take precedence the next time Agency starts or restarts/i)
    ).toBeInTheDocument();
  });

  it('shows the active tunnel URL and points users to profile setup details', async () => {
    getMock.mockImplementation((path: string) => {
      if (path === '/setup/tunnel-preference') {
        return Promise.resolve(
          tunnelPreference({
            current_public_url: 'https://agency.trycloudflare.com',
          })
        );
      }
      return Promise.resolve({ items: [] });
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(setupStatus())));

    render(<LocalSetupPage />);

    expect(await screen.findByText('https://agency.trycloudflare.com')).toBeInTheDocument();
    expect(screen.getByText(/use this as the public Agency backend base URL/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'your profile' })).toHaveAttribute('href', '/profile');
  });
});
