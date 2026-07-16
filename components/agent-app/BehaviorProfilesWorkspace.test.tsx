import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BehaviorProfilesWorkspace from '@/components/agent-app/BehaviorProfilesWorkspace';

const { behaviorProfilesApi, modelProfilesApi, modelProvidersApi } = vi.hoisted(() => ({
  behaviorProfilesApi: {
    listProfiles: vi.fn(),
  },
  modelProfilesApi: {
    createProfile: vi.fn(),
    updateProfile: vi.fn(),
    deleteProfile: vi.fn(),
  },
  modelProvidersApi: {
    listProviders: vi.fn(),
    listProviderModels: vi.fn(),
    createProvider: vi.fn(),
    updateProvider: vi.fn(),
    authorizeProvider: vi.fn(),
    completeAuthorizeProvider: vi.fn(),
  },
}));

vi.mock('@/lib/api/backend/behaviorProfiles', () => ({
  behaviorProfilesApi,
}));

vi.mock('@/lib/api/backend/models', () => ({
  modelProfilesApi,
  modelProvidersApi,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/components/library/shadcn/button', async () => {
  const ReactModule = await import('react');
  const Button = ReactModule.forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
    ({ children, ...props }, ref) => (
      <button ref={ref} type="button" {...props}>
        {children}
      </button>
    )
  );
  Button.displayName = 'MockButton';

  return { Button, buttonVariants: () => '' };
});

vi.mock('@/components/library/shadcn/input', () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/library/shadcn/textarea', () => ({
  Textarea: (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

vi.mock('@/components/library/shadcn/label', () => ({
  Label: ({ children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  ),
}));

function renderWorkspace() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BehaviorProfilesWorkspace />
    </QueryClientProvider>
  );
}

describe('BehaviorProfilesWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    behaviorProfilesApi.listProfiles.mockResolvedValue([
      {
        id: 'profile-1',
        name: 'Primary Profile',
        provider: 'provider-openai',
        model: 'gpt-4.1',
        description: 'General-purpose assistant profile',
        temperature: 0.2,
        maxTokens: 2000,
        topP: 0.9,
        supportsTools: true,
        supportsStructuredOutput: true,
        supportsVision: false,
        supportsStreaming: true,
      },
    ]);
    modelProvidersApi.listProviders.mockResolvedValue({
      items: [
        {
          id: 'provider-openai',
          name: 'OpenAI',
          provider_type: 'openai',
          endpoint: {
            base_url: 'https://api.openai.com/v1',
          },
          config: {
            api_key: 'sk-test',
          },
        },
      ],
    });
    modelProvidersApi.listProviderModels.mockResolvedValue({
      target_type: 'model_provider',
      target_id: 'provider-openai',
      provider_type: 'openai',
      source: 'live',
      models: [
        { id: 'gpt-4.1', name: 'GPT-4.1' },
        { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini' },
        { id: 'gpt-4o', name: 'GPT-4o' },
      ],
    });
    modelProfilesApi.createProfile.mockResolvedValue({ id: 'profile-2', name: 'Ops Profile' });
    modelProfilesApi.updateProfile.mockResolvedValue({
      id: 'profile-1',
      name: 'Primary Profile Updated',
    });
    modelProfilesApi.deleteProfile.mockResolvedValue({ deleted: true, id: 'profile-1' });
    modelProvidersApi.createProvider.mockResolvedValue({
      id: 'ollama-local',
      name: 'Ollama Local',
    });
    modelProvidersApi.updateProvider.mockResolvedValue({
      id: 'provider-openai',
      name: 'OpenAI Gateway',
    });
    modelProvidersApi.authorizeProvider.mockResolvedValue({
      auth_url: 'https://auth.openai.com/oauth/authorize?client_id=app_EMoamEEZ73f0CkXaXp7hrann',
      message: 'Open the auth_url in your browser to complete authorization.',
      pkce_verifier: 'verifier-1',
      client_id: 'app_EMoamEEZ73f0CkXaXp7hrann',
      state: 'state-1',
      redirect_uri: 'http://localhost:1455/auth/callback',
      auth_profile_id: 'default',
    });
    modelProvidersApi.completeAuthorizeProvider.mockResolvedValue({
      status: 'success',
      message: 'Tokens stored successfully',
      auth_profile_id: 'default',
      account_id: 'acct_123',
    });
    vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('adds a model preset on an existing LLM connection', async () => {
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('Primary Profile')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add Model' }));
    fireEvent.change(screen.getByLabelText('Preset name'), { target: { value: 'Ops Profile' } });
    fireEvent.change(screen.getByLabelText('LLM connection'), {
      target: { value: 'provider-openai' },
    });
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'gpt-4.1-mini' } });
    fireEvent.change(screen.getByLabelText('Temperature'), { target: { value: '0.4' } });
    fireEvent.change(screen.getByLabelText('Max tokens'), { target: { value: '4096' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add model' }));

    await waitFor(() => {
      expect(modelProfilesApi.createProfile).toHaveBeenCalledWith({
        name: 'Ops Profile',
        description: null,
        provider: 'provider-openai',
        model: 'gpt-4.1-mini',
        base_url: 'https://api.openai.com/v1',
        api_key_ref: 'sk-test',
        temperature: 0.4,
        max_tokens: 4096,
        top_p: null,
        supports_tools: true,
        supports_structured_output: false,
        supports_vision: false,
        supports_streaming: true,
        fallback_strategy: 'auto',
        fallback_policy: {
          retry_on: ['rate_limit', 'timeout', 'service_unavailable', 'network', 'auth'],
          same_provider_only: false,
          require_capability_match: true,
        },
        fallback_models: [],
      });
    });
  });

  it('applies a clear runtime preset in the add model flow', async () => {
    renderWorkspace();

    await screen.findByText('Primary Profile');
    fireEvent.click(screen.getByRole('button', { name: 'Add Model' }));

    expect(screen.getByRole('button', { name: 'Provider default runtime preset' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Balanced runtime preset' }));

    expect(screen.getByLabelText('Temperature')).toHaveValue(0.5);
    expect(screen.getByLabelText('Max tokens')).toHaveValue(4096);
    expect(screen.getByLabelText('Top p')).toHaveValue(1);
    expect(
      screen.getByText(/practical mix of consistency and variety for general assistant work/i)
    ).toBeInTheDocument();
  });

  it('blocks model creation when runtime tuning is outside the supported range', async () => {
    renderWorkspace();

    await screen.findByText('Primary Profile');
    fireEvent.click(screen.getByRole('button', { name: 'Add Model' }));
    fireEvent.change(screen.getByLabelText('Preset name'), { target: { value: 'Invalid Model' } });
    fireEvent.change(screen.getByLabelText('Temperature'), { target: { value: '2.1' } });
    fireEvent.blur(screen.getByLabelText('Temperature'));

    expect(screen.getByRole('alert')).toHaveTextContent('Temperature must be from 0 to 2.');
    expect(screen.getByRole('button', { name: 'Add model' })).toBeDisabled();
    expect(modelProfilesApi.createProfile).not.toHaveBeenCalled();
  });

  it('updates an existing model preset through the backend model profiles api', async () => {
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('Primary Profile')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit preset' }));
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Primary Profile Updated' },
    });
    fireEvent.change(screen.getByLabelText('Top p'), { target: { value: '0.8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(modelProfilesApi.updateProfile).toHaveBeenCalledWith('profile-1', {
        name: 'Primary Profile Updated',
        description: 'General-purpose assistant profile',
        provider: 'provider-openai',
        model: 'gpt-4.1',
        base_url: 'https://api.openai.com/v1',
        api_key_ref: 'sk-test',
        temperature: 0.2,
        max_tokens: 2000,
        top_p: 0.8,
        supports_tools: true,
        supports_structured_output: true,
        supports_vision: false,
        supports_streaming: true,
        fallback_strategy: 'auto',
        fallback_policy: {
          retry_on: ['rate_limit', 'timeout', 'service_unavailable', 'network', 'auth'],
          same_provider_only: false,
          require_capability_match: true,
        },
        fallback_models: [],
      });
    });
  });

  it('blocks preset updates when max tokens is not a positive whole number', async () => {
    renderWorkspace();

    await screen.findByText('Primary Profile');
    fireEvent.click(screen.getByRole('button', { name: 'Edit preset' }));
    fireEvent.change(screen.getByLabelText('Max tokens'), { target: { value: '4.5' } });
    fireEvent.blur(screen.getByLabelText('Max tokens'));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Max tokens must be a whole number from 1 to 1,000,000.'
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(modelProfilesApi.updateProfile).not.toHaveBeenCalled();
  });

  it('updates manual fallback models on an existing model preset', async () => {
    modelProvidersApi.listProviders.mockResolvedValue({
      items: [
        {
          id: 'provider-openai',
          name: 'OpenAI',
          provider_type: 'openai',
          endpoint: {
            base_url: 'https://api.openai.com/v1',
          },
          config: {
            api_key: 'sk-test',
          },
        },
        {
          id: 'provider-anthropic',
          name: 'Anthropic',
          provider_type: 'anthropic',
          endpoint: null,
          config: {
            api_key: 'anthropic-key',
          },
        },
      ],
    });
    modelProvidersApi.listProviderModels.mockImplementation(async (providerId: string) => ({
      target_type: 'model_provider',
      target_id: providerId,
      provider_type: providerId === 'provider-anthropic' ? 'anthropic' : 'openai',
      source: 'live',
      models:
        providerId === 'provider-anthropic'
          ? [
              { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
              { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku' },
            ]
          : [
              { id: 'gpt-4.1', name: 'GPT-4.1' },
              { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini' },
            ],
    }));

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('Primary Profile')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit preset' }));
    fireEvent.click(screen.getByRole('button', { name: 'manual' }));
    fireEvent.change(screen.getByLabelText('Backup 1 provider'), {
      target: { value: 'provider-anthropic' },
    });
    fireEvent.change(screen.getByLabelText('Backup 1 model'), {
      target: { value: 'claude-3-5-haiku-latest' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(modelProfilesApi.updateProfile).toHaveBeenCalledWith(
        'profile-1',
        expect.objectContaining({
          fallback_strategy: 'manual',
          fallback_policy: expect.objectContaining({
            require_capability_match: true,
          }),
          fallback_models: [{ provider: 'provider-anthropic', model: 'claude-3-5-haiku-latest' }],
        })
      );
    });
  });

  it('updates fallback policy on an existing model preset', async () => {
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('Primary Profile')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit preset' }));
    fireEvent.click(screen.getByRole('button', { name: 'manual' }));
    fireEvent.click(screen.getByLabelText(/auth/i));
    fireEvent.click(screen.getByLabelText('Same provider only'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(modelProfilesApi.updateProfile).toHaveBeenCalledWith(
        'profile-1',
        expect.objectContaining({
          fallback_policy: {
            retry_on: ['rate_limit', 'timeout', 'service_unavailable', 'network'],
            same_provider_only: true,
            require_capability_match: true,
          },
        })
      );
    });
  });

  it('updates an LLM connection and refreshes linked model preset endpoint settings', async () => {
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('Primary Profile')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit connection' }));
    fireEvent.change(screen.getByLabelText('Connection name'), {
      target: { value: 'OpenAI Gateway' },
    });
    fireEvent.change(screen.getByLabelText('Base URL'), {
      target: { value: 'https://gateway.example.com/v1' },
    });
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'gw-key' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save connection' }));

    await waitFor(() => {
      expect(modelProvidersApi.updateProvider).toHaveBeenCalledWith('provider-openai', {
        name: 'OpenAI Gateway',
        provider_type: 'openai',
        description: null,
        endpoint: { base_url: 'https://gateway.example.com/v1' },
        config: {
          api_key: 'gw-key',
          provider_family: 'openai',
        },
      });
    });
    expect(modelProfilesApi.updateProfile).toHaveBeenCalledWith('profile-1', {
      base_url: 'https://gateway.example.com/v1',
      api_key_ref: 'gw-key',
    });
  });

  it('deletes an existing model preset through the backend model profiles api', async () => {
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('Primary Profile')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete preset' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => {
      expect(modelProfilesApi.deleteProfile).toHaveBeenCalledWith('profile-1');
    });
  });

  it('adds a new LLM connection and model preset together', async () => {
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('Primary Profile')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add Model' }));
    fireEvent.click(screen.getByRole('button', { name: 'New connection' }));
    fireEvent.change(screen.getByLabelText('Provider family'), { target: { value: 'ollama' } });
    fireEvent.change(screen.getByLabelText('Connection name'), {
      target: { value: 'Ollama Local' },
    });
    expect(screen.getByLabelText('Base URL')).toHaveValue('http://host.docker.internal:11434');
    fireEvent.change(screen.getByLabelText('Preset name'), { target: { value: 'Ollama Main' } });
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'llama3:8b' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add model' }));

    await waitFor(() => {
      expect(modelProvidersApi.createProvider).toHaveBeenCalledWith({
        id: 'ollama-local',
        name: 'Ollama Local',
        provider_type: 'ollama',
        endpoint: { base_url: 'http://host.docker.internal:11434' },
        config: {
          provider_family: 'ollama',
          api_key: null,
        },
      });
    });
    expect(modelProfilesApi.createProfile).toHaveBeenCalledWith({
      name: 'Ollama Main',
      description: null,
      provider: 'ollama-local',
      model: 'llama3:8b',
      base_url: 'http://host.docker.internal:11434',
      api_key_ref: null,
      temperature: null,
      max_tokens: null,
      top_p: null,
      supports_tools: true,
      supports_structured_output: false,
      supports_vision: false,
      supports_streaming: true,
      fallback_strategy: 'auto',
      fallback_policy: {
        retry_on: ['rate_limit', 'timeout', 'service_unavailable', 'network', 'auth'],
        same_provider_only: false,
        require_capability_match: true,
      },
      fallback_models: [],
    });
  });

  it('uses a Codex model selected in the UI instead of the latest default after OAuth', async () => {
    modelProvidersApi.createProvider.mockResolvedValue({
      id: 'provider-codex',
      name: 'OpenAI Codex',
    });

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('Primary Profile')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add Model' }));
    fireEvent.click(screen.getByRole('button', { name: 'New connection' }));
    fireEvent.change(screen.getByLabelText('Provider family'), {
      target: { value: 'openai_codex' },
    });
    expect(screen.getByLabelText('Model')).toHaveValue('gpt-5.5');

    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'gpt-5.4-mini' } });
    fireEvent.click(screen.getByRole('button', { name: 'Authorize & Add' }));

    await waitFor(() => {
      expect(modelProvidersApi.authorizeProvider).toHaveBeenCalledWith(
        'provider-codex',
        expect.objectContaining({ authProfileId: 'default' })
      );
    });

    fireEvent.change(screen.getByLabelText('Redirect URL or authorization code'), {
      target: { value: 'authorization-code' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Complete & Create Model' }));

    await waitFor(() => {
      expect(modelProfilesApi.createProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'provider-codex',
          model: 'gpt-5.4-mini',
          parameters: { oauth_profile_id: 'default' },
        })
      );
    });
  });

  it('adds a DeepSeek connection with backend provider type and defaults', async () => {
    modelProvidersApi.createProvider.mockResolvedValueOnce({
      id: 'deepseek',
      name: 'DeepSeek',
    });

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('Primary Profile')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add Model' }));
    fireEvent.click(screen.getByRole('button', { name: 'New connection' }));
    fireEvent.change(screen.getByLabelText('Provider family'), { target: { value: 'deepseek' } });
    expect(screen.getByLabelText('Base URL')).toHaveValue('https://api.deepseek.com');
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'deepseek-key' } });
    fireEvent.change(screen.getByLabelText('Preset name'), { target: { value: 'DeepSeek Main' } });
    fireEvent.change(screen.getByLabelText('Model'), {
      target: { value: 'deepseek-v4-flash' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add model' }));

    await waitFor(() => {
      expect(modelProvidersApi.createProvider).toHaveBeenCalledWith({
        id: 'deepseek',
        name: 'DeepSeek',
        provider_type: 'deepseek',
        endpoint: { base_url: 'https://api.deepseek.com' },
        config: {
          provider_family: 'deepseek',
          api_key: 'deepseek-key',
        },
      });
    });
    expect(modelProfilesApi.createProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'DeepSeek Main',
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        base_url: 'https://api.deepseek.com',
        api_key_ref: 'deepseek-key',
      })
    );
  });

  it('adds a Qwen connection with DashScope defaults', async () => {
    modelProvidersApi.createProvider.mockResolvedValueOnce({
      id: 'qwen',
      name: 'Qwen',
    });

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('Primary Profile')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add Model' }));
    fireEvent.click(screen.getByRole('button', { name: 'New connection' }));
    fireEvent.change(screen.getByLabelText('Provider family'), { target: { value: 'qwen' } });
    expect(screen.getByLabelText('Base URL')).toHaveValue(
      'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
    );
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'qwen-key' } });
    fireEvent.change(screen.getByLabelText('Preset name'), { target: { value: 'Qwen Main' } });
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'qwen-plus' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add model' }));

    await waitFor(() => {
      expect(modelProvidersApi.createProvider).toHaveBeenCalledWith({
        id: 'qwen',
        name: 'Qwen',
        provider_type: 'qwen',
        endpoint: { base_url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1' },
        config: {
          provider_family: 'qwen',
          api_key: 'qwen-key',
        },
      });
    });
    expect(modelProfilesApi.createProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Qwen Main',
        provider: 'qwen',
        model: 'qwen-plus',
        base_url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
        api_key_ref: 'qwen-key',
      })
    );
  });

  it('warns when an ollama connection uses localhost in the create flow', async () => {
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('Primary Profile')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add Model' }));
    fireEvent.click(screen.getByRole('button', { name: 'New connection' }));
    fireEvent.change(screen.getByLabelText('Provider family'), { target: { value: 'ollama' } });
    fireEvent.change(screen.getByLabelText('Base URL'), {
      target: { value: 'http://localhost:11434' },
    });

    expect(
      screen.getByText(/localhost usually points at the backend container itself/i)
    ).toBeInTheDocument();
  });

  it('warns when an ollama connection uses localhost in the edit flow', async () => {
    modelProvidersApi.listProviders.mockResolvedValue({
      items: [
        {
          id: 'provider-ollama',
          name: 'Ollama',
          provider_type: 'ollama',
          endpoint: {
            base_url: 'http://localhost:11434',
          },
          config: {
            provider_family: 'ollama',
            api_key: null,
          },
        },
      ],
    });
    behaviorProfilesApi.listProfiles.mockResolvedValue([
      {
        id: 'profile-ollama',
        name: 'Ollama Profile',
        provider: 'provider-ollama',
        model: 'llama3:8b',
        description: null,
        temperature: null,
        maxTokens: null,
        topP: null,
        supportsTools: true,
        supportsStructuredOutput: false,
        supportsVision: false,
        supportsStreaming: true,
      },
    ]);

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('Ollama Profile')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit connection' }));

    expect(
      screen.getByText(/localhost usually points at the backend container itself/i)
    ).toBeInTheDocument();
  });

  it('starts OAuth from the connection card using provider auth profiles', async () => {
    modelProvidersApi.listProviders.mockResolvedValue({
      items: [
        {
          id: 'provider-codex',
          name: 'OpenAI Codex',
          provider_type: 'openai_codex',
          endpoint: {
            base_url: 'https://codex-api.openai.com/v1',
          },
          config: {
            provider_family: 'openai_codex',
            default_oauth_profile_id: 'default',
            auth_profiles: {
              default: {
                account_id: 'acct_123',
                access_token: 'token',
                expires_at: Math.floor(Date.now() / 1000) + 3600,
              },
            },
          },
        },
      ],
    });

    renderWorkspace();

    expect(await screen.findByText('OpenAI Codex connection')).toBeInTheDocument();

    expect(screen.getByText('Account acct_123')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Re-authorize OAuth' }));
    expect(screen.queryByRole('button', { name: 'Device authorization' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Browser authorization' }));

    await waitFor(() => {
      expect(modelProvidersApi.authorizeProvider).toHaveBeenCalledWith('provider-codex', {
        authProfileId: 'default',
      });
    });
  });
});
