'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Globe2, Save, Workflow } from 'lucide-react';
import { Badge } from '@/components/library/shadcn/badge';
import { Button } from '@/components/library/shadcn/button';
import { Input } from '@/components/library/shadcn/input';
import { Label } from '@/components/library/shadcn/label';
import { agencyApiClient } from '@/lib/api/clientInstances';
import { getAgencyApiBaseUrl } from '@/lib/api/config';
import type { ModelProfileDefinition } from '@/types/integrations';
import OpenVoiceSettingsCard from '@/components/profile/OpenVoiceSettingsCard';
import StandaloneThemeToggle from '@/components/theme/StandaloneThemeToggle';
import SetupConfigurationGuide from '@/modules/onboarding/components/SetupConfigurationGuide';

type SetupStatus = {
  ready: boolean;
  next_path: string;
  blockers: string[];
  database: {
    configured: boolean;
    reachable: boolean;
    detail: string | null;
  };
  users: {
    count: number;
    has_admin: boolean;
    auth_bootstrap_supported: boolean;
    recommended_bootstrap: string;
  };
  models: {
    has_usable_model_profiles: boolean;
    bootstrap_configured: boolean;
  };
  main_agent: {
    configured: boolean;
  };
  openvoice: {
    optional: true;
    ready: boolean;
    supports_cloning: boolean;
    runtime_installed: boolean;
    checkpoints_installed: boolean;
    default_voice: string;
  };
};

type ModelProfilesResponse = {
  items: ModelProfileDefinition[];
};

type TunnelProvider = 'auto' | 'none' | 'ngrok' | 'cloudflare';

type TunnelPreference = {
  provider: TunnelProvider;
  custom_domain: string | null;
  source: string;
  updated_at: string;
  current_public_url: string | null;
  requirements: {
    restart_required: boolean;
    custom_domain_requires_provider_setup: boolean;
    ngrok: {
      requires_reserved_domain_and_dns: boolean;
      requires_paid_plan_for_custom_domain: boolean;
    };
    cloudflare: {
      requires_managed_tunnel_token: boolean;
      requires_published_application_route: boolean;
      managed_tunnel_token_configured: boolean;
    };
  };
};

const STATUS_URL = `${getAgencyApiBaseUrl()}/setup/status`;
const BOOTSTRAP_URL = `${getAgencyApiBaseUrl()}/auth/bootstrap`;
// These requests go through agencyApiClient, which already applies the
// configured `/backend` prefix for same-origin Docker deployments.
const SETUP_MODEL_PROFILE_URL = '/setup/model-profile';
const SETUP_MAIN_AGENT_URL = '/setup/main-agent';
const SETUP_RECOMMENDED_AGENTS_URL = '/setup/recommended-agents';
const MODEL_PROFILES_URL = '/model-profiles';
const TUNNEL_PREFERENCE_URL = '/setup/tunnel-preference';
const CREATE_NEW_PROFILE_VALUE = '__create_new_profile__';

const BLOCKER_LABELS: Record<string, string> = {
  database_not_configured: 'Configure the backend database connection.',
  database_unreachable: 'Start the backend database and make it reachable.',
  no_users: 'Create the local admin user.',
  no_admin_user: 'Create the local admin user.',
  no_model_profiles: 'Choose and configure at least one model provider/profile.',
  main_agent_not_configured:
    'Finish main-agent setup so Open Agency has a default runtime entrypoint.',
};

type StepState = 'complete' | 'current' | 'locked';

function stepTone(state: StepState) {
  if (state === 'complete') {
    return 'border-(--agency-success-border) bg-(--agency-success-bg) text-(--agency-success-text)';
  }
  if (state === 'current') {
    return 'border-primary/25 bg-(--agency-active-bg) text-(--agency-shell-text)';
  }
  return 'border-(--agency-shell-border) bg-muted/35 text-(--agency-shell-muted)';
}

const setupSelectClassName =
  'flex h-10 w-full rounded-lg border border-input bg-(--agency-input-bg) px-3 py-2 text-sm text-(--agency-shell-text) shadow-(--agency-input-shadow) outline-none focus:border-primary focus:ring-2 focus:ring-ring/25';

async function loadStatus(): Promise<SetupStatus> {
  const response = await fetch(STATUS_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load setup status (${response.status}).`);
  }
  return (await response.json()) as SetupStatus;
}

export default function LocalSetupPage() {
  const router = useRouter();
  const { status: sessionStatus } = useSession();
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [availableProfiles, setAvailableProfiles] = useState<ModelProfileDefinition[]>([]);
  const [selectedProfileValue, setSelectedProfileValue] = useState(CREATE_NEW_PROFILE_VALUE);
  const [tunnelPreference, setTunnelPreference] = useState<TunnelPreference | null>(null);
  const [tunnelProvider, setTunnelProvider] = useState<TunnelProvider>('auto');
  const [tunnelCustomDomain, setTunnelCustomDomain] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [provider, setProvider] = useState<'openai' | 'ollama'>('openai');
  const [model, setModel] = useState('gpt-4.1-mini');
  const [providerApiKey, setProviderApiKey] = useState('');
  const [providerBaseUrl, setProviderBaseUrl] = useState('');
  const [agentName, setAgentName] = useState('Main Agent');
  const [setupRecommendedAgents, setSetupRecommendedAgents] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [isSavingTunnel, setIsSavingTunnel] = useState(false);

  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const nextStatus = await loadStatus();
      setSetupStatus(nextStatus);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load setup status.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshProfiles = useCallback(
    async (nextStatus: SetupStatus | null = setupStatus) => {
      if (sessionStatus !== 'authenticated') {
        return;
      }

      setIsLoadingProfiles(true);
      try {
        const response = await agencyApiClient.get<ModelProfilesResponse>(MODEL_PROFILES_URL);
        const profiles = Array.isArray(response.items) ? response.items : [];
        setAvailableProfiles(profiles);
        setSelectedProfileValue((current) => {
          if (profiles.length === 0) {
            return CREATE_NEW_PROFILE_VALUE;
          }
          if (
            current !== CREATE_NEW_PROFILE_VALUE &&
            profiles.some((profile) => profile.id === current)
          ) {
            return current;
          }
          if (nextStatus?.blockers.includes('main_agent_not_configured')) {
            return profiles[0].id;
          }
          return current;
        });
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load model profiles.');
      } finally {
        setIsLoadingProfiles(false);
      }
    },
    [sessionStatus, setupStatus]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadInitialSetupState() {
      try {
        const [statusResult, preferenceResult] = await Promise.allSettled([
          loadStatus(),
          agencyApiClient.get<TunnelPreference>(TUNNEL_PREFERENCE_URL),
        ]);

        if (cancelled) {
          return;
        }

        // Status and tunnel readiness are independent; one failure must not erase
        // useful state from the other setup boundary.
        const errors: string[] = [];
        if (statusResult.status === 'fulfilled') {
          setSetupStatus(statusResult.value);
        } else {
          setSetupStatus(null);
          errors.push(
            statusResult.reason instanceof Error
              ? statusResult.reason.message
              : 'Failed to load setup status.'
          );
        }

        if (preferenceResult.status === 'fulfilled') {
          const preference = preferenceResult.value;
          setTunnelPreference(preference);
          setTunnelProvider(preference.provider);
          setTunnelCustomDomain(preference.custom_domain ?? '');
        } else {
          errors.push(
            preferenceResult.reason instanceof Error
              ? preferenceResult.reason.message
              : 'Failed to load tunnel preference.'
          );
        }

        setErrorMessage(errors.length ? errors.join(' ') : null);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialSetupState();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (sessionStatus !== 'authenticated' || !setupStatus || setupStatus.ready) {
      return;
    }

    let cancelled = false;
    const activeSetupStatus = setupStatus;

    async function loadProfilesForSetup() {
      try {
        const response = await agencyApiClient.get<ModelProfilesResponse>(MODEL_PROFILES_URL);
        const profiles = Array.isArray(response.items) ? response.items : [];

        if (cancelled) {
          return;
        }

        setAvailableProfiles(profiles);
        setSelectedProfileValue((current) => {
          if (profiles.length === 0) {
            return CREATE_NEW_PROFILE_VALUE;
          }
          if (
            current !== CREATE_NEW_PROFILE_VALUE &&
            profiles.some((profile) => profile.id === current)
          ) {
            return current;
          }
          if (activeSetupStatus.blockers.includes('main_agent_not_configured')) {
            return profiles[0].id;
          }
          return current;
        });
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Failed to load model profiles.'
          );
        }
      }
    }

    void loadProfilesForSetup();

    return () => {
      cancelled = true;
    };
  }, [sessionStatus, setupStatus]);

  const canBootstrapAdmin = Boolean(
    setupStatus?.users.auth_bootstrap_supported &&
    (setupStatus.blockers.includes('no_users') || setupStatus.blockers.includes('no_admin_user'))
  );
  const canConfigureRuntime = Boolean(
    sessionStatus === 'authenticated' &&
    setupStatus &&
    !setupStatus.ready &&
    !canBootstrapAdmin &&
    (setupStatus.blockers.includes('no_model_profiles') ||
      setupStatus.blockers.includes('main_agent_not_configured'))
  );
  const selectedExistingProfile =
    availableProfiles.find((profile) => profile.id === selectedProfileValue) ?? null;
  const shouldCreateNewProfile =
    availableProfiles.length === 0 || selectedProfileValue === CREATE_NEW_PROFILE_VALUE;
  const customDomainEnabled = tunnelProvider === 'ngrok' || tunnelProvider === 'cloudflare';

  const handleBootstrap = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const response = await fetch(BOOTSTRAP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          display_name: displayName.trim() || null,
          email,
          password,
        }),
      });

      const payload = (await response.json()) as { detail?: unknown };
      if (!response.ok) {
        const detail = typeof payload.detail === 'string' ? payload.detail : 'Bootstrap failed.';
        throw new Error(detail);
      }

      // Reuse the normal credentials flow so the frontend session shape stays
      // aligned with the rest of the app once the local admin exists.
      const signInResult = await signIn('credentials', {
        email,
        password,
        callbackUrl: '/setup',
        redirect: false,
      });

      if (!signInResult || signInResult.error) {
        setInfoMessage('Local admin created. Sign in to continue setup.');
      } else {
        setInfoMessage('Local admin created. Continuing setup…');
      }
      setPassword('');
      setConfirmPassword('');
      await refreshStatus();
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Bootstrap failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRuntimeSetup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      let modelProfileId = selectedExistingProfile?.id ?? '';
      if (shouldCreateNewProfile) {
        const modelPayload = (await agencyApiClient.post<{ id: string }>(SETUP_MODEL_PROFILE_URL, {
          provider,
          model,
          api_key: provider === 'openai' ? providerApiKey : undefined,
          base_url: provider === 'ollama' ? providerBaseUrl || 'http://localhost:11434' : undefined,
        })) as { id: string };
        modelProfileId = modelPayload.id;
      } else if (!modelProfileId) {
        throw new Error('Choose an existing model profile or create a new one.');
      }
      await agencyApiClient.post(SETUP_MAIN_AGENT_URL, {
        model_profile_id: modelProfileId,
        agent_name: agentName.trim() || 'Main Agent',
      });
      if (setupRecommendedAgents) {
        await agencyApiClient.post(SETUP_RECOMMENDED_AGENTS_URL, {
          include_coder: true,
          include_embedding: true,
          include_evaluation: true,
        });
      }

      setInfoMessage(
        setupRecommendedAgents
          ? 'Runtime is configured. The main agent and recommended supporting agents are ready.'
          : 'Runtime is configured. Open Agency is ready.'
      );
      await refreshStatus();
      await refreshProfiles();
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Setup failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTunnelPreferenceSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingTunnel(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const preference = await agencyApiClient.put<TunnelPreference>(TUNNEL_PREFERENCE_URL, {
        provider: tunnelProvider,
        custom_domain: customDomainEnabled ? tunnelCustomDomain.trim() || null : null,
      });
      setTunnelPreference(preference);
      setTunnelProvider(preference.provider);
      setTunnelCustomDomain(preference.custom_domain ?? '');
      setInfoMessage(
        'Tunnel preference saved. It will take precedence the next time Open Agency starts or restarts.'
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to save the tunnel preference.'
      );
    } finally {
      setIsSavingTunnel(false);
    }
  };

  const statusList = setupStatus?.blockers ?? null;
  const hasAdmin = Boolean(setupStatus?.users.has_admin);
  const hasModelProfile = Boolean(setupStatus?.models.has_usable_model_profiles);
  const hasMainAgent = Boolean(setupStatus?.main_agent.configured);
  const isReady = Boolean(setupStatus?.ready);
  const databaseReachable = Boolean(setupStatus?.database.reachable);
  const databaseDetail = setupStatus?.database.detail ?? null;

  const adminStepState: StepState = hasAdmin ? 'complete' : 'current';
  const runtimeStepState: StepState =
    hasModelProfile && hasMainAgent ? 'complete' : hasAdmin ? 'current' : 'locked';
  const finishStepState: StepState = isReady
    ? 'complete'
    : hasAdmin && hasModelProfile && hasMainAgent
      ? 'current'
      : 'locked';

  return (
    <div className="agency-gradient-soft min-h-dvh bg-(--agency-shell-bg) px-4 py-8 text-(--agency-shell-text) sm:py-10">
      <StandaloneThemeToggle className="fixed right-4 top-4 z-20 sm:right-6 sm:top-6" />
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="agency-card rounded-2xl border p-6 backdrop-blur sm:p-8">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-neutral-500 dark:text-cyan-300">
              Local setup
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-(--agency-shell-text) sm:text-4xl">
              Turn this backend into your local Open Agency install
            </h1>
            <p className="mt-4 text-base leading-7 text-neutral-600 dark:text-slate-300">
              Create your local admin, connect one runnable model, then finish setting up the
              default main agent. When these are done, Open Agency will stop routing you back here.
            </p>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            <div className={`rounded-[22px] border px-4 py-4 ${stepTone(adminStepState)}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em]">Step 1</p>
              <p className="mt-2 text-base font-semibold">Create local admin</p>
              <p className="mt-1 text-sm">
                {hasAdmin ? 'Completed' : 'Required before anything else.'}
              </p>
            </div>
            <div className={`rounded-[22px] border px-4 py-4 ${stepTone(runtimeStepState)}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em]">Step 2</p>
              <p className="mt-2 text-base font-semibold">Connect model + agent</p>
              <p className="mt-1 text-sm">
                {hasModelProfile && hasMainAgent
                  ? 'Model profile and main agent are configured.'
                  : hasAdmin
                    ? 'Choose OpenAI or Ollama, then create the default agent.'
                    : 'Locked until the admin account exists.'}
              </p>
            </div>
            <div className={`rounded-[22px] border px-4 py-4 ${stepTone(finishStepState)}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em]">Step 3</p>
              <p className="mt-2 text-base font-semibold">Enter Open Agency</p>
              <p className="mt-1 text-sm">
                {isReady
                  ? 'Setup complete. Default landing moves to workflows.'
                  : 'The app becomes ready once all blockers are cleared.'}
              </p>
              {isReady && sessionStatus === 'authenticated' ? (
                <Button asChild size="sm" className="mt-3 md:hidden">
                  <Link href="/workflows">Open workflows</Link>
                </Button>
              ) : null}
            </div>
          </div>

          {isLoading ? (
            <div className="mt-10 rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 px-5 py-6 text-sm text-neutral-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              Loading setup status…
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-100">
              {errorMessage}
            </div>
          ) : null}

          {infoMessage ? (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100">
              {infoMessage}
            </div>
          ) : null}

          {canBootstrapAdmin ? (
            <form
              className="mt-10 space-y-5 rounded-3xl border border-neutral-200 bg-neutral-50 p-6 dark:border-white/10 dark:bg-[#0c1624]"
              onSubmit={handleBootstrap}
            >
              <div>
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-slate-100">
                  Step 1: Create the local admin
                </h2>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-slate-300">
                  This account becomes the local operator for this install. After sign-in, the same
                  screen continues directly into runtime setup.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="display-name">Admin name</Label>
                  <Input
                    id="display-name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Local Admin"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="admin@example.com"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="At least 8 characters"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Repeat the password"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating admin…' : 'Create local admin'}
                </Button>
                <Button type="button" variant="outline" onClick={() => void refreshStatus()}>
                  Refresh status
                </Button>
              </div>
            </form>
          ) : null}

          {!canBootstrapAdmin && !isLoading && setupStatus ? (
            <div className="mt-10 rounded-3xl border border-neutral-200 bg-neutral-50 p-6 dark:border-white/10 dark:bg-[#0c1624]">
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-slate-100">
                {isReady ? 'Open Agency is ready' : 'Step 1 is complete'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-slate-300">
                {isReady
                  ? 'Setup is complete. Continue to workflows, or stay here to review public tunnel settings.'
                  : 'The local admin exists. Stay on this page to finish model and main-agent setup, or sign in first if this browser session is not authenticated yet.'}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button asChild>
                  {isReady && sessionStatus === 'authenticated' ? (
                    <Link href="/workflows">Open workflows</Link>
                  ) : (
                    <Link href="/login?callbackUrl=/setup">Sign in</Link>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => void refreshStatus()}>
                  Refresh status
                </Button>
              </div>
            </div>
          ) : null}

          {canConfigureRuntime ? (
            <form
              className="mt-10 space-y-5 rounded-3xl border border-neutral-200 bg-neutral-50 p-6 dark:border-white/10 dark:bg-[#0c1624]"
              onSubmit={handleRuntimeSetup}
            >
              <div>
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-slate-100">
                  Step 2: Connect the runtime
                </h2>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-slate-300">
                  Use an existing model profile or create a new one, then bind it to the default
                  main agent in one pass. Keep the quick setup option enabled if you also want the
                  recommended supporting agents provisioned now.
                </p>
              </div>

              {availableProfiles.length ? (
                <div className="space-y-2">
                  <Label htmlFor="model-profile-choice">Model profile</Label>
                  <select
                    id="model-profile-choice"
                    className={setupSelectClassName}
                    value={selectedProfileValue}
                    onChange={(event) => setSelectedProfileValue(event.target.value)}
                  >
                    {availableProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name} ({profile.model})
                      </option>
                    ))}
                    <option value={CREATE_NEW_PROFILE_VALUE}>Create a new model profile</option>
                  </select>
                  <p className="text-sm leading-6 text-neutral-600 dark:text-slate-300">
                    Reuse an existing runtime profile when you already trust its provider and model
                    settings. Create a new one only when you actually need a different runtime path.
                  </p>
                </div>
              ) : null}

              {selectedExistingProfile ? (
                <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 text-sm text-neutral-700 dark:border-cyan-500/15 dark:bg-[#0f1a2b] dark:text-slate-200">
                  <p className="font-medium text-neutral-900 dark:text-slate-100">
                    Selected existing profile
                  </p>
                  <p className="mt-2">{selectedExistingProfile.name}</p>
                  <p className="mt-1 text-neutral-600 dark:text-slate-300">
                    Provider: <code>{selectedExistingProfile.provider}</code>
                  </p>
                  <p className="mt-1 text-neutral-600 dark:text-slate-300">
                    Model: <code>{selectedExistingProfile.model}</code>
                  </p>
                </div>
              ) : null}

              {shouldCreateNewProfile ? (
                <>
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="provider">Provider</Label>
                      <select
                        id="provider"
                        className={setupSelectClassName}
                        value={provider}
                        onChange={(event) => {
                          const nextProvider =
                            event.target.value === 'ollama' ? 'ollama' : 'openai';
                          setProvider(nextProvider);
                          setModel(nextProvider === 'ollama' ? 'llama3.1:8b' : 'gpt-4.1-mini');
                        }}
                      >
                        <option value="openai">OpenAI</option>
                        <option value="ollama">Ollama</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="model">Model</Label>
                      <Input
                        id="model"
                        value={model}
                        onChange={(event) => setModel(event.target.value)}
                        placeholder={provider === 'ollama' ? 'llama3.1:8b' : 'gpt-4.1-mini'}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    {provider === 'openai' ? (
                      <div className="space-y-2">
                        <Label htmlFor="provider-api-key">API key</Label>
                        <Input
                          id="provider-api-key"
                          type="password"
                          value={providerApiKey}
                          onChange={(event) => setProviderApiKey(event.target.value)}
                          placeholder="sk-..."
                          required
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="provider-base-url">Base URL</Label>
                        <Input
                          id="provider-base-url"
                          value={providerBaseUrl}
                          onChange={(event) => setProviderBaseUrl(event.target.value)}
                          placeholder="http://localhost:11434"
                        />
                        <p className="text-sm leading-6 text-neutral-600 dark:text-slate-300">
                          Keep Ollama running locally before you finish setup. The launcher starts
                          Open Agency services, but it does not install Ollama for you.
                        </p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="agent-name">Agent name</Label>
                      <Input
                        id="agent-name"
                        value={agentName}
                        onChange={(event) => setAgentName(event.target.value)}
                        placeholder="Main Agent"
                        required
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="agent-name">Agent name</Label>
                  <Input
                    id="agent-name"
                    value={agentName}
                    onChange={(event) => setAgentName(event.target.value)}
                    placeholder="Main Agent"
                    required
                  />
                </div>
              )}

              {isLoadingProfiles ? (
                <div className="rounded-2xl border border-dashed border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600 dark:border-white/10 dark:bg-[#0f1a2b] dark:text-slate-300">
                  Loading available model profiles…
                </div>
              ) : null}

              <label className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-4 text-sm text-neutral-700 dark:border-cyan-500/15 dark:bg-[#0f1a2b] dark:text-slate-200">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-neutral-300"
                  checked={setupRecommendedAgents}
                  onChange={(event) => setSetupRecommendedAgents(event.target.checked)}
                />
                <span>
                  <span className="block font-medium text-neutral-900 dark:text-slate-100">
                    Optional: add recommended supporting agents
                  </span>
                  <span className="mt-1 block text-neutral-600 dark:text-slate-300">
                    Also provision the default Coder, Embedding, and Evaluation agents so you do not
                    need the older aggregate setup command later.
                  </span>
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Configuring Open Agency…' : 'Finish Open Agency setup'}
                </Button>
                <Button type="button" variant="outline" onClick={() => void refreshStatus()}>
                  Refresh status
                </Button>
                <Button type="button" variant="outline" onClick={() => void refreshProfiles()}>
                  Refresh profiles
                </Button>
              </div>
            </form>
          ) : null}

          {sessionStatus === 'authenticated' ? (
            <div className="mt-10">
              <OpenVoiceSettingsCard id="setup-openvoice" context="setup" />
            </div>
          ) : null}
        </section>

        <aside className="agency-card rounded-2xl border p-6 sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-amber-700 dark:text-amber-300">
            Readiness
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-neutral-900 dark:text-slate-100">
            {isReady ? 'Ready to use' : 'What is left'}
          </h2>
          <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-slate-300">
            {isReady ? (
              <>All required local services and runtime settings are configured.</>
            ) : (
              <>
                Open Agency switches its default landing page from <code>/setup</code> to{' '}
                <code>/workflows</code> once these blockers are gone.
              </>
            )}
          </p>

          <div className="mt-8 space-y-3">
            {statusList === null ? (
              <div className="rounded-xl border border-(--agency-warning-border) bg-(--agency-warning-bg) px-4 py-3 text-sm text-(--agency-warning-text)">
                Readiness is unknown because the local setup status could not be loaded. Refresh the
                status before changing setup configuration.
              </div>
            ) : statusList.length ? (
              statusList.map((blocker) => (
                <div
                  key={blocker}
                  className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 dark:border-white/10 dark:bg-[#0b1322] dark:text-slate-200"
                >
                  {BLOCKER_LABELS[blocker] ?? blocker}
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100">
                Setup is complete. You can continue into Open Agency.
              </div>
            )}
          </div>

          {isReady ? (
            <div className="mt-6 rounded-3xl border border-primary/20 bg-(--agency-active-bg) p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Workflow className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-(--agency-shell-text)">
                    Build your first workflow
                  </p>
                  <p className="mt-1 text-sm leading-6 text-(--agency-shell-muted)">
                    The required setup is complete. Start with one agent and one task; the Main
                    Agent can help explain or assemble the rest.
                  </p>
                </div>
              </div>
              <ol className="mt-4 space-y-2 text-sm">
                <li className="flex items-center gap-2 text-(--agency-success-text)">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Model connected
                </li>
                <li className="flex items-center gap-2 text-(--agency-success-text)">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Main Agent ready
                </li>
                <li className="flex items-center gap-2 font-medium text-(--agency-shell-text)">
                  <span className="flex size-4 items-center justify-center rounded-full border border-primary text-[0.65rem] text-primary">
                    3
                  </span>
                  Create and run a small workflow
                </li>
              </ol>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild>
                  <Link href="/workflows">Create first workflow</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/assistant">Ask the Main Agent</Link>
                </Button>
              </div>
            </div>
          ) : null}

          <div className="mt-8 space-y-4 rounded-3xl bg-white p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border dark:border-white/10 dark:bg-[#0b1322] dark:shadow-none">
            <div>
              <p className="text-sm font-medium text-neutral-900 dark:text-slate-100">
                Backend database
              </p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-slate-300">
                {setupStatus ? (databaseReachable ? 'Reachable' : 'Not ready yet') : 'Unknown'}
              </p>
              {databaseDetail ? (
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-slate-400">
                  {databaseDetail}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-900 dark:text-slate-100">
                Local admin
              </p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-slate-300">
                {setupStatus ? (hasAdmin ? 'Created' : 'Still required') : 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-900 dark:text-slate-100">
                Model provider
              </p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-slate-300">
                {setupStatus ? (hasModelProfile ? 'Configured' : 'Still required') : 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-900 dark:text-slate-100">Main agent</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-slate-300">
                {setupStatus ? (hasMainAgent ? 'Configured' : 'Still required') : 'Unknown'}
              </p>
            </div>
          </div>

          <div className="mt-8">
            <SetupConfigurationGuide
              statusKnown={Boolean(setupStatus)}
              tunnelKnown={Boolean(tunnelPreference)}
              databaseReady={databaseReachable}
              adminReady={hasAdmin}
              modelReady={hasModelProfile}
              mainAgentReady={hasMainAgent}
              openVoiceReady={Boolean(setupStatus?.openvoice?.ready)}
              tunnelProvider={tunnelProvider}
            />
          </div>

          <form
            id="public-tunnel"
            className="mt-8 border-t border-neutral-200 pt-8 dark:border-white/10"
            onSubmit={handleTunnelPreferenceSave}
          >
            <div className="flex items-center gap-2 text-neutral-900 dark:text-slate-100">
              <Globe2 className="h-5 w-5" aria-hidden="true" />
              <h3 className="text-lg font-semibold">Public tunnel</h3>
              <Badge variant="secondary">Optional</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-slate-300">
              Open Agency starts with a public tunnel by default when one is available. Use the
              current public URL below as the backend base URL for webhook callbacks and external
              integrations.
            </p>

            <div className="mt-5 space-y-2">
              <Label htmlFor="tunnel-provider">Tunnel provider</Label>
              <select
                id="tunnel-provider"
                className={setupSelectClassName}
                value={tunnelProvider}
                disabled={sessionStatus !== 'authenticated'}
                onChange={(event) => {
                  const nextProvider = event.target.value as TunnelProvider;
                  setTunnelProvider(nextProvider);
                  if (nextProvider === 'auto' || nextProvider === 'none') {
                    setTunnelCustomDomain('');
                  }
                }}
              >
                <option value="auto">Automatic recommendation</option>
                <option value="none">Local only</option>
                <option value="cloudflare">Cloudflare Tunnel</option>
                <option value="ngrok">ngrok</option>
              </select>
            </div>

            <div className="mt-4 space-y-2">
              <Label htmlFor="tunnel-custom-domain">Custom domain</Label>
              <Input
                id="tunnel-custom-domain"
                value={tunnelCustomDomain}
                disabled={!customDomainEnabled || sessionStatus !== 'authenticated'}
                onChange={(event) => setTunnelCustomDomain(event.target.value)}
                placeholder="agency.example.com"
              />
              <p className="text-xs leading-5 text-neutral-500 dark:text-slate-400">
                Leave blank to use the provider-assigned URL.
              </p>
            </div>

            {tunnelProvider === 'ngrok' && tunnelCustomDomain ? (
              <p className="mt-4 text-xs leading-5 text-amber-800 dark:text-amber-200">
                The hostname must already be reserved in ngrok and pointed at ngrok with the
                required DNS CNAME. Custom domains require an ngrok paid plan.
              </p>
            ) : null}

            {tunnelProvider === 'cloudflare' && tunnelCustomDomain ? (
              <p className="mt-4 text-xs leading-5 text-amber-800 dark:text-amber-200">
                The hostname must already be a published application route on a managed Cloudflare
                Tunnel.
                {tunnelPreference?.requirements.cloudflare.managed_tunnel_token_configured
                  ? ' A managed tunnel token is configured.'
                  : ' Set AGENCY_CLOUDFLARE_TUNNEL_TOKEN before restarting Open Agency.'}
              </p>
            ) : null}

            {tunnelPreference?.current_public_url ? (
              <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-400/25 dark:bg-sky-500/10">
                <p className="text-xs font-medium uppercase text-neutral-500 dark:text-slate-400">
                  Current tunnel URL
                </p>
                <a
                  className="mt-1 block break-all text-sm text-sky-700 underline dark:text-sky-300"
                  href={tunnelPreference.current_public_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {tunnelPreference.current_public_url}
                </a>
                <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-slate-300">
                  For integration setup, use this as the public Open Agency backend base URL.
                  Personal API tokens and account-specific setup details live on{' '}
                  <Link
                    className="font-medium text-sky-700 underline dark:text-sky-300"
                    href="/profile"
                  >
                    your profile
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-600 dark:border-white/10 dark:bg-[#0f1a2b] dark:text-slate-300">
                No public tunnel URL has been reported yet. After Open Agency starts with a tunnel,
                the current backend URL will appear here and on your profile.
              </div>
            )}

            <div className="mt-5">
              {sessionStatus === 'authenticated' ? (
                <Button type="submit" disabled={isSavingTunnel}>
                  <Save data-icon="inline-start" aria-hidden="true" />
                  {isSavingTunnel ? 'Saving…' : 'Save tunnel preference'}
                </Button>
              ) : (
                <Button asChild type="button" variant="outline">
                  <Link href="/login?callbackUrl=/setup">Sign in to manage tunnel</Link>
                </Button>
              )}
            </div>
          </form>

          {isReady ? (
            <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100">
              <p className="font-medium">Open Agency is ready.</p>
              <p className="mt-2 leading-6">
                Continue into the product now. Tunnel changes saved above take effect the next time
                Open Agency starts or restarts.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {sessionStatus === 'authenticated' ? (
                  <Button asChild>
                    <Link href="/workflows">Open workflows</Link>
                  </Button>
                ) : (
                  <Button asChild>
                    <Link href="/login?callbackUrl=/workflows">Sign in</Link>
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
