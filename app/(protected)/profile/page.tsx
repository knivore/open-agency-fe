'use client';

import { apiTokensApi } from '@/lib/api/backend/apiTokens';
import { profileApi, type TunnelProvider } from '@/lib/api/backend/profile';
import { getBackendUserProfilePreferences, usersApi } from '@/lib/api/backend/users';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { useAgencyUserPreferences } from '@/lib/userPreferences';
import { useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { Checkbox } from '@/components/library/shadcn/checkbox';
import { Badge } from '@/components/library/shadcn/badge';
import { Button } from '@/components/library/shadcn/button';
import { Card, CardContent, CardHeader } from '@/components/library/shadcn/card';
import { Input } from '@/components/library/shadcn/input';
import { Label } from '@/components/library/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/library/shadcn/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/library/shadcn/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/library/shadcn/table';
import PageHeader from '@/components/app-shell/PageHeader';
import { FieldFeedback, FormField, FormSection } from '@/components/app-shell/FormSection';
import OpenVoiceSettingsCard from '@/components/profile/OpenVoiceSettingsCard';
import LocalSignInSettingsCard from '@/components/profile/LocalSignInSettingsCard';
import PersonalProfileSettingsCard from '@/components/profile/PersonalProfileSettingsCard';
import {
  AlertCircle,
  BotMessageSquare,
  Check,
  ChevronDown,
  CircleUserRound,
  Copy,
  EyeOff,
  Globe2,
  Key,
  LoaderCircle,
  PanelRight,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import type { AuthUser } from '@/types/auth';
import type { ApiTokenDefinition, ApiTokenScopeDefinition } from '@/types/apiTokens';

const FALLBACK_TOKEN_SCOPES: ApiTokenScopeDefinition[] = [
  {
    id: 'agents:read',
    label: 'Agents read',
    description: 'Read agent definitions and related agent metadata.',
    category: 'agents',
  },
  {
    id: 'agents:write',
    label: 'Agents write',
    description: 'Create, update, or delete agent definitions.',
    category: 'agents',
  },
  {
    id: 'workflows:read',
    label: 'Workflows read',
    description: 'Read workflow definitions and workflow metadata.',
    category: 'workflows',
  },
  {
    id: 'workflows:write',
    label: 'Workflows write',
    description: 'Create, update, publish, clone, or delete workflows.',
    category: 'workflows',
  },
  {
    id: 'workflows:run',
    label: 'Workflows run',
    description: 'Start workflow executions.',
    category: 'workflows',
  },
  {
    id: 'executions:read',
    label: 'Executions read',
    description: 'Read execution state, events, artifacts, and run history.',
    category: 'executions',
  },
  {
    id: 'executions:write',
    label: 'Executions write',
    description: 'Create executions and control execution lifecycle actions.',
    category: 'executions',
  },
  {
    id: 'integrations:read',
    label: 'Integrations read',
    description: 'Read integration catalog, connector configuration, and health metadata.',
    category: 'integrations',
  },
  {
    id: 'integrations:write',
    label: 'Integrations write',
    description: 'Create or update integration, connector, and credential-backed configuration.',
    category: 'integrations',
  },
  {
    id: 'models:read',
    label: 'Models read',
    description: 'Read model provider and model profile definitions.',
    category: 'models',
  },
  {
    id: 'models:write',
    label: 'Models write',
    description: 'Create or update model providers and model profiles.',
    category: 'models',
  },
  {
    id: 'tools:read',
    label: 'Tools read',
    description: 'Read backend tool definitions and tool catalog metadata.',
    category: 'tools',
  },
  {
    id: 'tools:write',
    label: 'Tools write',
    description: 'Create, update, validate, or test backend tool definitions.',
    category: 'tools',
  },
  {
    id: 'schedules:read',
    label: 'Schedules read',
    description: 'Read schedule definitions and scheduler metadata.',
    category: 'schedules',
  },
  {
    id: 'schedules:write',
    label: 'Schedules write',
    description: 'Create, update, enable, disable, or trigger schedules.',
    category: 'schedules',
  },
];

const TUNNEL_PROVIDER_LABELS: Record<TunnelProvider, string> = {
  auto: 'Automatic recommendation',
  none: 'Local only',
  cloudflare: 'Cloudflare Tunnel',
  ngrok: 'ngrok',
};

function formatDateTime(value?: string | null, timezone?: string | null) {
  if (!value) {
    return 'Never';
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone || undefined,
  }).format(new Date(value));
}

function defaultTokenScopes(scopes: ApiTokenScopeDefinition[]) {
  if (scopes.some((scope) => scope.id === 'workflows:run')) {
    return ['workflows:run'];
  }

  return scopes[0] ? [scopes[0].id] : [];
}

function groupTokenScopes(scopes: ApiTokenScopeDefinition[]) {
  return scopes.reduce<Array<{ category: string; items: ApiTokenScopeDefinition[] }>>(
    (groups, scope) => {
      const existing = groups.find((group) => group.category === scope.category);
      if (existing) {
        existing.items.push(scope);
        return groups;
      }

      groups.push({
        category: scope.category,
        items: [scope],
      });
      return groups;
    },
    []
  );
}

function isBackendManagedSessionToken(token: ApiTokenDefinition) {
  // Local password sign-in persists its short-lived bearer secret in the same backend store.
  // Keep that implementation detail out of the automation-key management surface.
  return token.metadata?.issued_by === 'local_auth' && token.metadata?.session === true;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const user = session?.user as AuthUser | undefined;
  const apiTokenCapability = profileApi.getApiTokenCapability();
  const [tokenName, setTokenName] = useState('');
  const [tokenScopes, setTokenScopes] = useState<string[]>(['workflows:run']);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenNameTouched, setTokenNameTouched] = useState(false);
  const [publicUrlCopied, setPublicUrlCopied] = useState(false);
  const [commonIntegrationUrlCopied, setCommonIntegrationUrlCopied] = useState(false);
  const [pendingTunnelProvider, setPendingTunnelProvider] = useState<TunnelProvider | null>(null);
  const [tunnelPreferenceError, setTunnelPreferenceError] = useState<string | null>(null);
  const {
    preferences: { showDiagnostics, assistantLauncherMode, assistantLauncherIcon },
    setShowDiagnostics,
    setAssistantLauncherMode,
    setAssistantLauncherIcon,
  } = useAgencyUserPreferences();

  const backendUserQuery = useQuery({
    queryKey: user?.id
      ? queryKeys.backendCurrentUser(user.id)
      : ['backendCurrentUser', 'anonymous'],
    queryFn: () => usersApi.getCurrentUser(),
    enabled: Boolean(user?.id && user.email),
    retry: 1,
  });

  const apiTokensQuery = useQuery({
    queryKey: ['profileApiTokens'],
    queryFn: () => apiTokensApi.listTokens(),
    enabled: Boolean(user?.id),
  });

  const tokenScopesQuery = useQuery({
    queryKey: ['profileApiTokenScopes'],
    queryFn: () => apiTokensApi.listScopes(),
    enabled: Boolean(user?.id),
  });

  const publicEndpointQuery = useQuery({
    queryKey: ['profilePublicEndpointInfo'],
    queryFn: () => profileApi.getPublicEndpointInfo(),
    enabled: Boolean(user?.id),
    refetchInterval: (query) =>
      ['requested', 'applying'].includes(query.state.data?.runtime_control?.state ?? '')
        ? 2_500
        : false,
  });

  const copyPublicUrl = async () => {
    const publicUrl = publicEndpointQuery.data?.current_public_url;
    if (!publicUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(publicUrl);
      setPublicUrlCopied(true);
    } catch {
      setPublicUrlCopied(false);
    }
  };

  const copyCommonIntegrationUrl = async () => {
    const publicUrl = publicEndpointQuery.data?.current_public_url;
    if (!publicUrl) {
      return;
    }

    const integrationUrl = `${publicUrl}/integrations/conversations/adapters/<provider>/webhook`;
    try {
      await navigator.clipboard.writeText(integrationUrl);
      setCommonIntegrationUrlCopied(true);
    } catch {
      setCommonIntegrationUrlCopied(false);
    }
  };

  const apiTokenRows = apiTokensQuery.data?.items ?? [];
  const automationKeyRows = apiTokenRows.filter((token) => !isBackendManagedSessionToken(token));
  const availableTokenScopes = tokenScopesQuery.data?.items ?? FALLBACK_TOKEN_SCOPES;
  const groupedTokenScopes = groupTokenScopes(availableTokenScopes);
  const selectedTokenScopes = useMemo(() => {
    if (availableTokenScopes.length === 0) {
      return tokenScopes;
    }

    const allowedScopeIds = new Set(availableTokenScopes.map((scope) => scope.id));
    const filtered = tokenScopes.filter((scopeId) => allowedScopeIds.has(scopeId));
    return filtered.length > 0 ? filtered : defaultTokenScopes(availableTokenScopes);
  }, [availableTokenScopes, tokenScopes]);
  const tokenNameError =
    tokenNameTouched && !tokenName.trim() ? 'Enter a name for this automation key.' : null;
  const backendUser = backendUserQuery.data;
  const profilePreferences = getBackendUserProfilePreferences(backendUser);
  const displayName = backendUser?.display_name || user?.name || 'User';
  const displayEmail = backendUser?.email || user?.email || 'No email provided';
  const displayImage = backendUser?.avatar_url || user?.image;

  const createTokenMutation = useMutation({
    mutationFn: () => {
      const name = tokenName.trim();
      if (!name) {
        throw new Error('Automation key name is required.');
      }
      if (selectedTokenScopes.length === 0) {
        throw new Error('Select at least one scope.');
      }
      return apiTokensApi.createToken({ name, scopes: selectedTokenScopes });
    },
    onSuccess: async (token) => {
      setRevealedToken(token.token);
      setTokenName('');
      setTokenScopes(defaultTokenScopes(availableTokenScopes));
      setTokenNameTouched(false);
      await queryClient.invalidateQueries({ queryKey: ['profileApiTokens'] });
    },
    onError: (error) => {
      setTokenError(error instanceof Error ? error.message : 'Failed to create automation key.');
    },
  });

  const revokeTokenMutation = useMutation({
    mutationFn: (tokenId: string) => apiTokensApi.revokeToken(tokenId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profileApiTokens'] });
    },
    onError: (error) => {
      setTokenError(error instanceof Error ? error.message : 'Failed to revoke automation key.');
    },
  });

  const tunnelPreferenceMutation = useMutation({
    mutationFn: ({ provider, applyNow }: { provider: TunnelProvider; applyNow: boolean }) =>
      profileApi.updatePublicEndpointPreference(
        provider,
        provider === 'cloudflare' || provider === 'ngrok'
          ? (publicEndpointQuery.data?.custom_domain ?? null)
          : null,
        applyNow
      ),
    onSuccess: (endpoint) => {
      queryClient.setQueryData(['profilePublicEndpointInfo'], endpoint);
      setPendingTunnelProvider(null);
      setTunnelPreferenceError(null);
    },
    onError: (error) => {
      setTunnelPreferenceError(
        error instanceof Error ? error.message : 'Could not save the tunnel preference.'
      );
    },
  });

  const requestTunnelProviderChange = (provider: TunnelProvider) => {
    if (provider !== publicEndpointQuery.data?.provider) {
      setTunnelPreferenceError(null);
      setPendingTunnelProvider(provider);
    }
  };

  const saveTunnelPreference = (applyNow: boolean) => {
    if (!pendingTunnelProvider) {
      return;
    }

    tunnelPreferenceMutation.mutate({ provider: pendingTunnelProvider, applyNow });
  };

  const renderSupportChip = (supported: boolean, label: string) => (
    <Badge variant={supported ? 'successful' : 'outline'}>
      {label}: {supported ? 'Yes' : 'No'}
    </Badge>
  );

  const toggleScope = (scopeId: string, checked: boolean) => {
    setTokenScopes((current) => {
      if (checked) {
        return current.includes(scopeId) ? current : [...current, scopeId];
      }

      return current.filter((scope) => scope !== scopeId);
    });
  };

  // Handle loading state
  if (status === 'loading') {
    return (
      <div className="flex min-h-[calc(100vh-76px)] items-center justify-center">
        <LoaderCircle className="size-7 animate-spin text-primary" aria-label="Loading profile" />
      </div>
    );
  }

  // Handle unauthenticated state
  if (status === 'unauthenticated') {
    return (
      <div className="flex min-h-[calc(100vh-76px)] flex-col items-center justify-center p-4">
        <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-center mb-2">Authentication Required</h1>
        <p className="text-gray-600 text-center mb-6">Please sign in to view your profile</p>
        <Button asChild>
          <a href="/login">Sign In</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <PageHeader
        className="mb-8"
        icon={CircleUserRound}
        tone="profile"
        title="Profile"
        description="Manage personal settings, browser preferences, Open Agency defaults, and automation access."
        actions={
          <>
            <Badge variant="secondary">
              {automationKeyRows.length} automation key{automationKeyRows.length === 1 ? '' : 's'}
            </Badge>
            <Badge variant={backendUser ? 'successful' : 'outline'}>
              {backendUser ? 'Identity synced' : 'Identity pending'}
            </Badge>
          </>
        }
      />

      <div className="grid gap-5">
        <Card className="overflow-hidden border border-neutral-200 bg-white shadow-sm lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,2fr)] dark:border-white/10 dark:bg-slate-950/45 dark:shadow-none">
          <CardHeader className="border-b border-neutral-200 bg-neutral-50/80 p-0 lg:border-r lg:border-b-0 dark:border-white/10 dark:bg-white/5">
            <div className="flex w-full items-center gap-4 px-5 py-5 text-left sm:px-6">
              {displayImage ? (
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full ring-4 ring-white dark:ring-white/10">
                  <Image
                    src={displayImage}
                    alt={`${displayName}'s profile`}
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-900 dark:bg-primary-500/10 dark:text-primary-200">
                  <CircleUserRound className="h-8 w-8" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-xl font-semibold text-neutral-900 dark:text-slate-100">
                  {displayName}
                </p>
                <p className="mt-1 truncate text-sm text-neutral-500 dark:text-slate-400">
                  {displayEmail}
                </p>
                <Badge className="mt-2" variant={backendUser ? 'successful' : 'outline'}>
                  {backendUser ? 'Backend identity synced' : 'Awaiting backend sync'}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-neutral-200 sm:grid sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-white/10">
              <div className="px-5 py-4 sm:px-6">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-slate-400">
                  Backend User ID
                </p>
                <p className="mt-2 break-all text-sm font-medium text-neutral-900 dark:text-slate-100">
                  {backendUser?.id || 'Pending sync'}
                </p>
              </div>
              <div className="px-5 py-4 sm:px-6">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-slate-400">
                  Status
                </p>
                <div className="mt-2">
                  <Badge variant={backendUser?.status === 'active' ? 'successful' : 'outline'}>
                    {backendUser?.status || 'unknown'}
                  </Badge>
                </div>
              </div>
              <div className="px-5 py-4 sm:px-6">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-slate-400">
                  Session Source
                </p>
                <p className="mt-2 text-sm text-neutral-700 dark:text-slate-300">
                  {backendUser?.local_credentials_enabled
                    ? 'Local password'
                    : user?.authMode === 'dev'
                      ? 'Developer auth'
                      : 'NextAuth session'}
                </p>
              </div>
            </div>
            {backendUserQuery.isError ? (
              <div className="border-t border-amber-200 bg-amber-50 px-6 py-4 text-sm text-amber-800">
                Backend user profile is not available yet. The frontend session is still active, but
                automation-key ownership requires backend identity sync.
              </div>
            ) : null}
          </CardContent>
        </Card>

        {backendUser ? <PersonalProfileSettingsCard user={backendUser} /> : null}

        {backendUser?.local_credentials_enabled ? (
          <LocalSignInSettingsCard user={backendUser} />
        ) : null}

        <div className="flex flex-col gap-5">
          <Card className="border border-neutral-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
            <CardHeader className="border-b border-neutral-200 bg-neutral-50/80 dark:border-white/10 dark:bg-white/5">
              <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Globe2 className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold text-neutral-900 dark:text-slate-100">
                      Integration Setup Details
                    </h2>
                  </div>
                  <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-slate-300">
                    Use these values when another service asks where to reach this Open Agency
                    backend. Tunnel changes are configured from setup and take effect after Open
                    Agency restarts.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {publicEndpointQuery.isFetching ? (
                    <LoaderCircle
                      className="size-4 animate-spin text-primary"
                      aria-label="Refreshing endpoint"
                    />
                  ) : (
                    <Badge
                      variant={
                        publicEndpointQuery.data?.current_public_url ? 'successful' : 'outline'
                      }
                    >
                      {publicEndpointQuery.data?.current_public_url
                        ? 'Tunnel active'
                        : 'Tunnel pending'}
                    </Badge>
                  )}
                  <Button asChild size="sm" variant="outline">
                    <Link href="/setup#public-tunnel">Manage tunnel</Link>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 pt-5 sm:pt-6">
              {publicEndpointQuery.isError ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100">
                  Could not load the current public endpoint. Reopen setup after the launcher has
                  started the tunnel.
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-slate-400">
                    Public Backend Base URL
                  </p>
                  {publicEndpointQuery.data?.current_public_url ? (
                    <div className="mt-3 flex items-start gap-2">
                      <a
                        className="min-w-0 flex-1 break-all text-sm font-medium text-sky-700 underline dark:text-sky-300"
                        href={publicEndpointQuery.data.current_public_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {publicEndpointQuery.data.current_public_url}
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-sky-700 hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-100"
                        aria-label={
                          publicUrlCopied
                            ? 'Public backend base URL copied'
                            : 'Copy public backend base URL'
                        }
                        onClick={copyPublicUrl}
                      >
                        {publicUrlCopied ? (
                          <Check className="size-4" aria-hidden="true" />
                        ) : (
                          <Copy className="size-4" aria-hidden="true" />
                        )}
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-neutral-600 dark:text-slate-300">
                      Waiting for the launcher to report a tunnel URL.
                    </p>
                  )}
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-slate-400">
                    Tunnel Preference
                  </p>
                  <div className="mt-3 space-y-2">
                    <Label htmlFor="profile-tunnel-provider">Public tunnel provider</Label>
                    <Select
                      value={publicEndpointQuery.data?.provider ?? ''}
                      disabled={!publicEndpointQuery.data || tunnelPreferenceMutation.isPending}
                      onValueChange={(value) =>
                        requestTunnelProviderChange(value as TunnelProvider)
                      }
                    >
                      <SelectTrigger
                        id="profile-tunnel-provider"
                        aria-label="Public tunnel provider"
                      >
                        <SelectValue placeholder="Loading" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TUNNEL_PROVIDER_LABELS).map(([provider, label]) => (
                          <SelectItem key={provider} value={provider}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="mt-3 break-all text-xs text-neutral-500 dark:text-slate-400">
                    {publicEndpointQuery.data?.custom_domain
                      ? `Custom domain: ${publicEndpointQuery.data.custom_domain}`
                      : 'Provider-assigned tunnel URL'}
                  </p>
                  {publicEndpointQuery.data?.runtime_control?.state === 'requested' ||
                  publicEndpointQuery.data?.runtime_control?.state === 'applying' ? (
                    <p className="mt-3 text-xs font-medium text-sky-700 dark:text-sky-300">
                      {publicEndpointQuery.data.runtime_control.message ||
                        'Applying tunnel change…'}
                    </p>
                  ) : null}
                  {publicEndpointQuery.data?.runtime_control?.state === 'ready' ? (
                    <p className="mt-3 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      {publicEndpointQuery.data.runtime_control.message || 'Tunnel is ready.'}
                    </p>
                  ) : null}
                  {publicEndpointQuery.data?.runtime_control?.state === 'failed' ? (
                    <p className="mt-3 text-xs font-medium text-red-700 dark:text-red-300">
                      {publicEndpointQuery.data.runtime_control.message ||
                        'Tunnel could not be started. Check launcher logs.'}
                    </p>
                  ) : null}
                  {tunnelPreferenceError ? (
                    <p className="mt-3 text-xs font-medium text-red-700 dark:text-red-300">
                      {tunnelPreferenceError}
                    </p>
                  ) : null}
                </div>
              </div>

              {publicEndpointQuery.data?.current_public_url ? (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-400/25 dark:bg-sky-500/10">
                  <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">
                    Common integration URL format
                  </p>
                  <div className="mt-2 flex items-start gap-2">
                    <code className="min-w-0 flex-1 break-all rounded bg-white px-3 py-2 text-xs text-sky-900 dark:bg-slate-950/80 dark:text-sky-100">
                      {publicEndpointQuery.data.current_public_url}
                      /integrations/conversations/adapters/&lt;provider&gt;/webhook
                    </code>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-sky-700 hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-100"
                      aria-label={
                        commonIntegrationUrlCopied
                          ? 'Common integration URL copied'
                          : 'Copy common integration URL'
                      }
                      onClick={copyCommonIntegrationUrl}
                    >
                      {commonIntegrationUrlCopied ? (
                        <Check className="size-4" aria-hidden="true" />
                      ) : (
                        <Copy className="size-4" aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-sky-900/80 dark:text-sky-100/80">
                    Replace <code>&lt;provider&gt;</code> with the adapter name requested by the
                    selected integration.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <AlertDialog
            open={Boolean(pendingTunnelProvider)}
            onOpenChange={(open) => {
              if (!open && !tunnelPreferenceMutation.isPending) {
                setPendingTunnelProvider(null);
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apply tunnel change now?</AlertDialogTitle>
                <AlertDialogDescription>
                  Switch to{' '}
                  {pendingTunnelProvider ? TUNNEL_PROVIDER_LABELS[pendingTunnelProvider] : ''}.{' '}
                  {publicEndpointQuery.data?.runtime_control?.supervisor_available
                    ? 'Applying now stops the current public tunnel and starts the selected one. Open Agency stays running, but the public URL may change.'
                    : 'The local launcher is not running, so this change can only be applied on the next launch.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={tunnelPreferenceMutation.isPending}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={tunnelPreferenceMutation.isPending}
                  onClick={() => saveTunnelPreference(false)}
                >
                  Save for next launch
                </AlertDialogAction>
                {publicEndpointQuery.data?.runtime_control?.supervisor_available ? (
                  <AlertDialogAction
                    disabled={tunnelPreferenceMutation.isPending}
                    onClick={() => saveTunnelPreference(true)}
                  >
                    {tunnelPreferenceMutation.isPending ? 'Applying…' : 'Apply now'}
                  </AlertDialogAction>
                ) : null}
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <OpenVoiceSettingsCard id="openvoice" />

          <Card className="border border-neutral-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
            <CardHeader className="border-b border-neutral-200 bg-neutral-50/80 dark:border-white/10 dark:bg-white/5">
              <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold text-neutral-900 dark:text-slate-100">
                      Browser preferences
                    </h2>
                  </div>
                  <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-slate-300">
                    Control interface behavior stored locally on this browser.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">This browser</Badge>
                  <Badge variant={showDiagnostics ? 'successful' : 'outline'}>
                    Diagnostics {showDiagnostics ? 'visible' : 'hidden'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-5 sm:pt-6">
              <FormSection
                title="Main Agent launcher"
                description="Choose where help appears and how the launcher identifies itself."
                icon={<BotMessageSquare className="size-4" aria-hidden="true" />}
                contentClassName="flex flex-col gap-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900 dark:text-slate-100">
                      Main Agent launcher
                    </p>
                    <p className="mt-1 max-w-2xl text-sm text-neutral-600 dark:text-slate-300">
                      Keep help at the right edge, float it over the workspace, or hide the
                      launcher. The full Assistant page remains available from navigation and
                      search.
                    </p>
                  </div>
                  <Badge variant={assistantLauncherMode === 'hidden' ? 'secondary' : 'successful'}>
                    {assistantLauncherMode === 'hidden'
                      ? 'Launcher hidden'
                      : `${assistantLauncherMode} launcher`}
                  </Badge>
                </div>

                <fieldset className="flex flex-col gap-2">
                  <legend className="text-sm font-medium text-neutral-900 dark:text-slate-100">
                    Launcher placement
                  </legend>
                  <div
                    className="grid gap-2 sm:grid-cols-3"
                    role="radiogroup"
                    aria-label="Assistant launcher placement"
                  >
                    {(
                      [
                        {
                          id: 'dock',
                          label: 'Right-edge dock',
                          description: 'Tucks against the workspace edge.',
                          icon: PanelRight,
                        },
                        {
                          id: 'floating',
                          label: 'Floating button',
                          description: 'Keeps the familiar corner button.',
                          icon: BotMessageSquare,
                        },
                        {
                          id: 'hidden',
                          label: 'Hidden',
                          description: 'Use navigation or command search.',
                          icon: EyeOff,
                        },
                      ] as const
                    ).map((option) => {
                      const Icon = option.icon;
                      const selected = assistantLauncherMode === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setAssistantLauncherMode(option.id)}
                          className={`rounded-xl border p-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-primary-400 ${
                            selected
                              ? 'border-primary-300 bg-primary-50 text-primary-950 dark:border-violet-300/30 dark:bg-violet-400/10 dark:text-violet-100'
                              : 'border-neutral-200 bg-white text-neutral-800 hover:border-primary-200 dark:border-white/10 dark:bg-slate-950/50 dark:text-slate-200'
                          }`}
                        >
                          <Icon className="size-4" aria-hidden="true" />
                          <span className="mt-2 block text-sm font-semibold">{option.label}</span>
                          <span className="mt-1 block text-xs opacity-75">
                            {option.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset className="flex flex-col gap-2 border-t border-neutral-200 pt-4 dark:border-white/10">
                  <legend className="text-sm font-medium text-neutral-900 dark:text-slate-100">
                    Launcher identity
                  </legend>
                  <div
                    className="flex flex-wrap gap-2"
                    role="radiogroup"
                    aria-label="Assistant launcher identity"
                  >
                    {(
                      [
                        { id: 'bot', label: 'Assistant', icon: BotMessageSquare },
                        { id: 'sparkles', label: 'Spark', icon: Sparkles },
                        { id: 'initial', label: 'Agent initial', icon: CircleUserRound },
                      ] as const
                    ).map((option) => {
                      const Icon = option.icon;
                      const selected = assistantLauncherIcon === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setAssistantLauncherIcon(option.id)}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-primary-400 ${
                            selected
                              ? 'border-primary-300 bg-primary-50 text-primary-900 dark:border-violet-300/30 dark:bg-violet-400/10 dark:text-violet-100'
                              : 'border-neutral-200 bg-white text-neutral-700 hover:border-primary-200 dark:border-white/10 dark:bg-slate-950/50 dark:text-slate-300'
                          }`}
                        >
                          <Icon className="size-4" aria-hidden="true" />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              </FormSection>

              <FormSection
                title="Developer diagnostics"
                description="Expose backend capability, graph, run-health, and module diagnostics only when troubleshooting."
                advanced
                advancedLabel="Show diagnostics setting"
              >
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-(--agency-shell-border) bg-(--agency-row-hover) p-4 transition hover:border-primary-200">
                  <Checkbox
                    aria-label="Show diagnostics workspace"
                    checked={showDiagnostics}
                    onCheckedChange={(checked) => setShowDiagnostics(checked === true)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-semibold text-neutral-900 dark:text-slate-100">
                      Show diagnostics workspace
                    </p>
                    <p className="mt-1 text-sm text-neutral-600 dark:text-slate-300">
                      Adds a dedicated Operations diagnostics page for backend capabilities, graph
                      status, run health, and module availability. The Agency Graph stays focused on
                      operational insight instead of local debug controls.
                    </p>
                    {showDiagnostics ? (
                      <Button asChild className="mt-3" size="sm" variant="outline">
                        <a href="/operations/diagnostics">Open Diagnostics</a>
                      </Button>
                    ) : null}
                  </div>
                </label>
                <p className="mt-3 text-xs text-neutral-500 dark:text-slate-400">
                  Preference is stored locally for this browser until a backend user-preferences API
                  is available.
                </p>
              </FormSection>
            </CardContent>
          </Card>

          <details
            id="automation-keys"
            className="group overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-950/45 dark:shadow-none"
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400 sm:px-6">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary-100 bg-primary-50 text-primary-700 dark:border-violet-300/15 dark:bg-violet-400/10 dark:text-violet-200">
                <Key className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold text-neutral-900 dark:text-slate-100">
                  Automation keys
                </span>
                <span className="mt-0.5 block text-sm text-neutral-600 dark:text-slate-400">
                  Give trusted scripts and services limited access to Open Agency.
                </span>
              </span>
              <Badge variant="secondary" className="hidden sm:inline-flex">
                {automationKeyRows.length} automation key{automationKeyRows.length === 1 ? '' : 's'}
              </Badge>
              <ChevronDown className="size-4 shrink-0 text-neutral-500 transition-transform group-open:rotate-180" />
            </summary>
            <div className="flex flex-col gap-6 border-t border-neutral-200 p-5 sm:p-6 dark:border-white/10">
              <div className="flex flex-wrap gap-2">
                {renderSupportChip(apiTokenCapability.readSupported, 'Read')}
                {renderSupportChip(apiTokenCapability.writeSupported, 'Write')}
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/25 dark:bg-emerald-500/10">
                <p className="text-sm text-emerald-800 dark:text-emerald-100">
                  {apiTokenCapability.message}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-slate-400">
                    Routes
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {apiTokenCapability.plannedRoutes.map((route) => (
                      <Badge key={route} variant="outline">
                        {route}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-slate-400">
                    Active keys
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-neutral-900 dark:text-slate-100">
                    {automationKeyRows.filter((token) => !token.revoked_at).length}
                  </p>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-slate-400">
                    Scopes In Use
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-neutral-900 dark:text-slate-100">
                    {new Set(automationKeyRows.flatMap((token) => token.scopes)).size}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 border-t border-(--agency-shell-border) p-5 sm:p-6 2xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
              <Card className="border border-neutral-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
                <CardHeader className="border-b border-neutral-200 bg-neutral-50/80 dark:border-white/10 dark:bg-white/5">
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-slate-100">
                      Create automation key
                    </h3>
                    <p className="mt-1 text-sm text-neutral-600 dark:text-slate-300">
                      Issue a scoped key for scripts, jobs, or backend integrations.
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-5 pt-5 sm:pt-6">
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-slate-400">
                      Recommended
                    </p>
                    <p className="mt-2 text-sm text-neutral-700 dark:text-slate-300">
                      Create a key only when a trusted script or service needs Open Agency access.
                      Use a descriptive name and only the route families that automation needs.
                    </p>
                  </div>

                  <FormField
                    label="Automation key name"
                    htmlFor="automation-key-name"
                    description="Use a name that identifies the script, job, or service using this key."
                    error={tokenNameError}
                    required
                  >
                    <Input
                      id="automation-key-name"
                      aria-label="Automation key name"
                      aria-invalid={Boolean(tokenNameError)}
                      aria-describedby="automation-key-name-feedback"
                      placeholder="CI runner, local automation"
                      value={tokenName}
                      onChange={(event) => setTokenName(event.target.value)}
                      onBlur={() => setTokenNameTouched(true)}
                      disabled={createTokenMutation.isPending}
                      required
                      className="h-12"
                    />
                  </FormField>

                  <fieldset className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <legend className="text-sm font-medium text-neutral-800 dark:text-slate-200">
                        Scopes
                      </legend>
                      <span className="text-xs text-neutral-500 dark:text-slate-400">
                        {selectedTokenScopes.length} selected
                      </span>
                    </div>
                    <div className="flex max-h-72 flex-col gap-3 overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/60">
                      {tokenScopesQuery.isLoading ? (
                        <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-slate-400">
                          <LoaderCircle className="size-4 animate-spin text-primary" />
                          <span>Loading allowed scopes...</span>
                        </div>
                      ) : (
                        groupedTokenScopes.map((group) => (
                          <div key={group.category} className="flex flex-col gap-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-slate-400">
                              {group.category}
                            </p>
                            <div className="flex flex-col gap-2">
                              {group.items.map((scope) => (
                                <label
                                  key={scope.id}
                                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-transparent px-1 py-1 transition hover:border-neutral-200 dark:hover:border-white/10"
                                >
                                  <Checkbox
                                    checked={selectedTokenScopes.includes(scope.id)}
                                    disabled={createTokenMutation.isPending}
                                    onCheckedChange={(checked) =>
                                      toggleScope(scope.id, checked === true)
                                    }
                                    className="mt-0.5"
                                  />
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-sm font-medium text-neutral-900 dark:text-slate-100">
                                        {scope.label}
                                      </span>
                                      <code className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700 dark:bg-white/10 dark:text-slate-300">
                                        {scope.id}
                                      </code>
                                    </div>
                                    <p className="mt-1 text-xs text-neutral-500 dark:text-slate-400">
                                      {scope.description}
                                    </p>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-slate-400">
                      Scope definitions are maintained by the backend. Read scopes allow viewing
                      resources, while write scopes allow creating and changing them.
                    </p>
                  </fieldset>

                  <FieldFeedback error={tokenError} />
                  {revealedToken ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/25 dark:bg-amber-500/10">
                      <p className="mb-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
                        Copy this automation key now. It will not be shown again.
                      </p>
                      <code className="block break-all rounded bg-white px-3 py-2 text-xs text-amber-900 dark:bg-slate-950/80 dark:text-amber-100">
                        {revealedToken}
                      </code>
                    </div>
                  ) : null}
                  <Button
                    disabled={
                      !tokenName.trim() ||
                      selectedTokenScopes.length === 0 ||
                      tokenScopesQuery.isLoading
                    }
                    onClick={() => {
                      setTokenError(null);
                      setRevealedToken(null);
                      createTokenMutation.mutate();
                    }}
                  >
                    {createTokenMutation.isPending ? (
                      <LoaderCircle data-icon="inline-start" className="animate-spin" />
                    ) : null}
                    {createTokenMutation.isPending ? 'Creating...' : 'Create automation key'}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border border-neutral-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
                <CardHeader className="border-b border-neutral-200 bg-neutral-50/80 dark:border-white/10 dark:bg-white/5">
                  <div className="flex w-full items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-900 dark:text-slate-100">
                        Automation keys
                      </h3>
                      <p className="mt-1 text-sm text-neutral-600 dark:text-slate-300">
                        Review scope coverage, recent usage, and revoke state for your scripts and
                        services.
                      </p>
                    </div>
                    {apiTokensQuery.isFetching ? (
                      <LoaderCircle
                        className="size-4 animate-spin text-primary"
                        aria-label="Refreshing automation keys"
                      />
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="pt-5 sm:pt-6">
                  {apiTokensQuery.isError ? (
                    <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-100">
                      Failed to load automation keys.
                    </div>
                  ) : automationKeyRows.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center text-sm text-neutral-500 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-400">
                      No automation keys have been created yet.
                    </div>
                  ) : (
                    <Table aria-label="Automation keys">
                      <TableHeader>
                        <TableRow>
                          <TableHead>NAME</TableHead>
                          <TableHead>SCOPES</TableHead>
                          <TableHead>LAST USED</TableHead>
                          <TableHead>LAST 4</TableHead>
                          <TableHead>STATUS</TableHead>
                          <TableHead>ACTIONS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {automationKeyRows.map((token) => (
                          <TableRow key={token.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-neutral-900 dark:text-slate-100">
                                  {token.name}
                                </p>
                                <p className="text-xs text-neutral-500 dark:text-slate-400">
                                  {token.prefix}...{token.last4}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {token.scopes.length ? token.scopes.join(', ') : 'none'}
                            </TableCell>
                            <TableCell>
                              {formatDateTime(token.last_used_at, profilePreferences.timezone)}
                            </TableCell>
                            <TableCell>
                              <code className="rounded bg-default-100 px-2 py-1 text-xs dark:bg-white/10 dark:text-slate-200">
                                ...{token.last4}
                              </code>
                            </TableCell>
                            <TableCell>
                              <Badge variant={token.revoked_at ? 'destructive' : 'successful'}>
                                {token.revoked_at ? 'revoked' : 'active'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={
                                  Boolean(token.revoked_at) ||
                                  (revokeTokenMutation.isPending &&
                                    revokeTokenMutation.variables === token.id)
                                }
                                onClick={() => revokeTokenMutation.mutate(token.id)}
                              >
                                {revokeTokenMutation.isPending &&
                                revokeTokenMutation.variables === token.id ? (
                                  <LoaderCircle data-icon="inline-start" className="animate-spin" />
                                ) : null}
                                {revokeTokenMutation.isPending &&
                                revokeTokenMutation.variables === token.id
                                  ? 'Revoking...'
                                  : 'Revoke'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
