'use client';

import { apiTokensApi } from '@/lib/api/backend/apiTokens';
import { profileApi } from '@/lib/api/backend/profile';
import { usersApi } from '@/lib/api/backend/users';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { useAgencyUserPreferences } from '@/lib/userPreferences';
import { useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { Checkbox } from '@/components/library/shadcn/checkbox';
import PageHeader from '@/components/app-shell/PageHeader';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Spinner,
  Chip,
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  Input,
} from '@nextui-org/react';
import { AlertCircle, CircleUserRound, Globe2, Key, SlidersHorizontal } from 'lucide-react';
import type { AuthUser } from '@/types/auth';
import type { ApiTokenScopeDefinition } from '@/types/apiTokens';

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

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Never';
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
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

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const user = session?.user as AuthUser | undefined;
  const apiTokenCapability = profileApi.getApiTokenCapability();
  const [tokenName, setTokenName] = useState('');
  const [tokenScopes, setTokenScopes] = useState<string[]>(['workflows:run']);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const {
    preferences: { showDiagnostics },
    setShowDiagnostics,
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
  });

  const apiTokenRows = apiTokensQuery.data?.items ?? [];
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
  const backendUser = backendUserQuery.data;
  const displayName = backendUser?.display_name || user?.name || 'User';
  const displayEmail = backendUser?.email || user?.email || 'No email provided';
  const displayImage = backendUser?.avatar_url || user?.image;

  const createTokenMutation = useMutation({
    mutationFn: () => {
      const name = tokenName.trim();
      if (!name) {
        throw new Error('Token name is required.');
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
      await queryClient.invalidateQueries({ queryKey: ['profileApiTokens'] });
    },
    onError: (error) => {
      setTokenError(error instanceof Error ? error.message : 'Failed to create API token.');
    },
  });

  const revokeTokenMutation = useMutation({
    mutationFn: (tokenId: string) => apiTokensApi.revokeToken(tokenId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profileApiTokens'] });
    },
    onError: (error) => {
      setTokenError(error instanceof Error ? error.message : 'Failed to revoke API token.');
    },
  });

  const renderSupportChip = (supported: boolean, label: string) => (
    <Chip color={supported ? 'success' : 'warning'} variant="flat" size="sm" radius="full">
      {label}: {supported ? 'Yes' : 'No'}
    </Chip>
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
        <Spinner size="lg" color="primary" />
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
        <Button color="primary" href="/login" as="a">
          Sign In
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
        description="Manage your backend identity mapping and personal access tokens for scripted or server-to-server access."
        actions={
          <>
            <Chip
              variant="flat"
              color="default"
              className="bg-white dark:bg-white/10 dark:text-slate-100"
            >
              {apiTokenRows.length} token{apiTokenRows.length === 1 ? '' : 's'}
            </Chip>
            <Chip variant="flat" color={backendUser ? 'success' : 'warning'}>
              {backendUser ? 'Identity synced' : 'Identity pending'}
            </Chip>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="border border-neutral-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <CardHeader className="border-b border-neutral-200 bg-neutral-50/80 p-0 dark:border-white/10 dark:bg-white/5">
            <div className="flex w-full flex-col items-center px-6 py-8 text-center">
              {displayImage ? (
                <div className="relative mb-4 h-24 w-24 overflow-hidden rounded-full ring-4 ring-white">
                  <Image
                    src={displayImage}
                    alt={`${displayName}'s profile`}
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
              ) : (
                <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-primary-50 text-primary-900">
                  <CircleUserRound className="h-12 w-12" />
                </div>
              )}
              <p className="text-xl font-semibold text-neutral-900 dark:text-slate-100">
                {displayName}
              </p>
              <p className="mt-1 break-all text-sm text-neutral-500 dark:text-slate-400">
                {displayEmail}
              </p>
              <Chip
                className="mt-4"
                color={backendUser ? 'success' : 'warning'}
                variant="flat"
                size="sm"
              >
                {backendUser ? 'Backend identity synced' : 'Awaiting backend sync'}
              </Chip>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <div className="divide-y divide-neutral-200 dark:divide-white/10">
              <div className="px-6 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-slate-400">
                  Backend User ID
                </p>
                <p className="mt-2 break-all text-sm font-medium text-neutral-900 dark:text-slate-100">
                  {backendUser?.id || 'Pending sync'}
                </p>
              </div>
              <div className="px-6 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-slate-400">
                  Status
                </p>
                <div className="mt-2">
                  <Chip
                    color={backendUser?.status === 'active' ? 'success' : 'warning'}
                    variant="flat"
                    size="sm"
                  >
                    {backendUser?.status || 'unknown'}
                  </Chip>
                </div>
              </div>
              <div className="px-6 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-slate-400">
                  Session Source
                </p>
                <p className="mt-2 text-sm text-neutral-700 dark:text-slate-300">
                  {user?.authMode === 'dev' ? 'Developer auth' : 'NextAuth session'}
                </p>
              </div>
            </div>
            {backendUserQuery.isError ? (
              <div className="border-t border-amber-200 bg-amber-50 px-6 py-4 text-sm text-amber-800">
                Backend user profile is not available yet. The frontend session is still active, but
                token ownership requires backend identity sync.
              </div>
            ) : null}
          </CardBody>
        </Card>

        <div className="space-y-6">
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
                    backend. Tunnel changes are configured from setup and take effect after Agency
                    restarts.
                  </p>
                </div>
                {publicEndpointQuery.isFetching ? (
                  <Spinner size="sm" color="primary" />
                ) : (
                  <Chip
                    color={publicEndpointQuery.data?.current_public_url ? 'success' : 'warning'}
                    variant="flat"
                    size="sm"
                  >
                    {publicEndpointQuery.data?.current_public_url
                      ? 'Tunnel active'
                      : 'Tunnel pending'}
                  </Chip>
                )}
              </div>
            </CardHeader>
            <CardBody className="space-y-5">
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
                    <a
                      className="mt-3 block break-all text-sm font-medium text-sky-700 underline dark:text-sky-300"
                      href={publicEndpointQuery.data.current_public_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {publicEndpointQuery.data.current_public_url}
                    </a>
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
                  <p className="mt-3 text-sm font-medium text-neutral-900 dark:text-slate-100">
                    {publicEndpointQuery.data?.provider ?? 'Loading'}
                  </p>
                  <p className="mt-1 break-all text-xs text-neutral-500 dark:text-slate-400">
                    {publicEndpointQuery.data?.custom_domain
                      ? `Custom domain: ${publicEndpointQuery.data.custom_domain}`
                      : 'Provider-assigned tunnel URL'}
                  </p>
                </div>
              </div>

              {publicEndpointQuery.data?.current_public_url ? (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-400/25 dark:bg-sky-500/10">
                  <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">
                    Common integration URL format
                  </p>
                  <code className="mt-2 block break-all rounded bg-white px-3 py-2 text-xs text-sky-900 dark:bg-slate-950/80 dark:text-sky-100">
                    {publicEndpointQuery.data.current_public_url}
                    /integrations/conversations/adapters/&lt;provider&gt;/webhook
                  </code>
                  <p className="mt-2 text-xs leading-5 text-sky-900/80 dark:text-sky-100/80">
                    Replace <code>&lt;provider&gt;</code> with the adapter name requested by the
                    selected integration.
                  </p>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card className="border border-neutral-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
            <CardHeader className="border-b border-neutral-200 bg-neutral-50/80 dark:border-white/10 dark:bg-white/5">
              <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold text-neutral-900 dark:text-slate-100">
                      Preferences
                    </h2>
                  </div>
                  <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-slate-300">
                    Control optional surfaces that add operational context without making the main
                    workspace feel like a debugging console.
                  </p>
                </div>
                <Chip color={showDiagnostics ? 'success' : 'default'} variant="flat" size="sm">
                  Diagnostics {showDiagnostics ? 'visible' : 'hidden'}
                </Chip>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 transition hover:border-primary-200 dark:border-white/10 dark:bg-white/5 dark:hover:border-cyan-400/25">
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
                    <Button
                      as="a"
                      href="/operations/diagnostics"
                      className="mt-3"
                      color="primary"
                      size="sm"
                      variant="flat"
                    >
                      Open Diagnostics
                    </Button>
                  ) : null}
                </div>
              </label>
              <p className="text-xs text-neutral-500 dark:text-slate-400">
                Preference is stored locally for this browser until a backend user-preferences API
                is available.
              </p>
            </CardBody>
          </Card>

          <Card className="border border-neutral-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
            <CardHeader className="border-b border-neutral-200 bg-neutral-50/80 dark:border-white/10 dark:bg-white/5">
              <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold text-neutral-900 dark:text-slate-100">
                      Backend API Tokens
                    </h2>
                  </div>
                  <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-slate-300">
                    Personal access tokens for scripts, jobs, and external clients. Tokens are
                    revealed once, stored hashed by the backend, and only grant the route families
                    covered by their selected scopes.
                  </p>
                </div>
                <Chip color="success" variant="flat" size="sm">
                  Backend route available
                </Chip>
              </div>
            </CardHeader>
            <CardBody className="space-y-6">
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
                      <Chip key={route} variant="bordered" radius="sm">
                        {route}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-slate-400">
                    Active Tokens
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-neutral-900 dark:text-slate-100">
                    {apiTokenRows.filter((token) => !token.revoked_at).length}
                  </p>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-slate-400">
                    Scopes In Use
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-neutral-900 dark:text-slate-100">
                    {new Set(apiTokenRows.flatMap((token) => token.scopes)).size}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          <div className="grid gap-6 2xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
            <Card className="border border-neutral-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
              <CardHeader className="border-b border-neutral-200 bg-neutral-50/80 dark:border-white/10 dark:bg-white/5">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-slate-100">
                    Create Token
                  </h3>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-slate-300">
                    Issue a scoped token for scripts, jobs, or backend integrations.
                  </p>
                </div>
              </CardHeader>
              <CardBody className="space-y-5">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-slate-400">
                    Recommended
                  </p>
                  <p className="mt-2 text-sm text-neutral-700 dark:text-slate-300">
                    Use a descriptive name and only the route families the automation needs. Most
                    single-purpose runners should not need more than one or two scope groups.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-800 dark:text-slate-200">
                    Token name
                  </label>
                  <Input
                    aria-label="Token name"
                    placeholder="CI runner, local automation"
                    value={tokenName}
                    onValueChange={setTokenName}
                    isDisabled={createTokenMutation.isPending}
                    variant="bordered"
                    radius="lg"
                    classNames={{
                      inputWrapper:
                        'min-h-12 border-neutral-200 bg-white shadow-none dark:border-white/10 dark:bg-slate-950/70',
                      input: 'text-neutral-900 dark:text-slate-100',
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium text-neutral-800 dark:text-slate-200">
                      Scopes
                    </label>
                    <span className="text-xs text-neutral-500 dark:text-slate-400">
                      {selectedTokenScopes.length} selected
                    </span>
                  </div>
                  <div className="max-h-72 space-y-3 overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/60">
                    {tokenScopesQuery.isLoading ? (
                      <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-slate-400">
                        <Spinner size="sm" color="primary" />
                        <span>Loading allowed scopes...</span>
                      </div>
                    ) : (
                      groupedTokenScopes.map((group) => (
                        <div key={group.category} className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-slate-400">
                            {group.category}
                          </p>
                          <div className="space-y-2">
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
                </div>

                {tokenError ? (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-100">
                    {tokenError}
                  </div>
                ) : null}
                {revealedToken ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/25 dark:bg-amber-500/10">
                    <p className="mb-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
                      Copy this token now. It will not be shown again.
                    </p>
                    <code className="block break-all rounded bg-white px-3 py-2 text-xs text-amber-900 dark:bg-slate-950/80 dark:text-amber-100">
                      {revealedToken}
                    </code>
                  </div>
                ) : null}
                <Button
                  color="primary"
                  isLoading={createTokenMutation.isPending}
                  isDisabled={
                    !tokenName.trim() ||
                    selectedTokenScopes.length === 0 ||
                    tokenScopesQuery.isLoading
                  }
                  onPress={() => {
                    setTokenError(null);
                    setRevealedToken(null);
                    createTokenMutation.mutate();
                  }}
                >
                  Create Token
                </Button>
              </CardBody>
            </Card>

            <Card className="border border-neutral-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
              <CardHeader className="border-b border-neutral-200 bg-neutral-50/80 dark:border-white/10 dark:bg-white/5">
                <div className="flex w-full items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-slate-100">
                      Issued Tokens
                    </h3>
                    <p className="mt-1 text-sm text-neutral-600 dark:text-slate-300">
                      Review scope coverage, recent usage, and revoke state for active automation
                      clients.
                    </p>
                  </div>
                  {apiTokensQuery.isFetching ? <Spinner size="sm" color="primary" /> : null}
                </div>
              </CardHeader>
              <CardBody>
                {apiTokensQuery.isError ? (
                  <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-100">
                    Failed to load API tokens.
                  </div>
                ) : apiTokenRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center text-sm text-neutral-500 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-400">
                    No API tokens have been issued yet.
                  </div>
                ) : (
                  <Table
                    aria-label="Backend API tokens"
                    removeWrapper
                    classNames={{
                      table: 'dark:text-slate-200',
                      th: 'bg-transparent text-neutral-500 dark:text-slate-400',
                      td: 'text-neutral-700 dark:text-slate-300',
                      tr: 'border-b border-neutral-200 dark:border-white/10',
                    }}
                  >
                    <TableHeader>
                      <TableColumn>NAME</TableColumn>
                      <TableColumn>SCOPES</TableColumn>
                      <TableColumn>LAST USED</TableColumn>
                      <TableColumn>LAST 4</TableColumn>
                      <TableColumn>STATUS</TableColumn>
                      <TableColumn>ACTIONS</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {apiTokenRows.map((token) => (
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
                          <TableCell>{formatDateTime(token.last_used_at)}</TableCell>
                          <TableCell>
                            <code className="rounded bg-default-100 px-2 py-1 text-xs dark:bg-white/10 dark:text-slate-200">
                              ...{token.last4}
                            </code>
                          </TableCell>
                          <TableCell>
                            <Chip
                              color={token.revoked_at ? 'danger' : 'success'}
                              variant="flat"
                              size="sm"
                            >
                              {token.revoked_at ? 'revoked' : 'active'}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              color="warning"
                              variant="flat"
                              isDisabled={Boolean(token.revoked_at)}
                              isLoading={
                                revokeTokenMutation.isPending &&
                                revokeTokenMutation.variables === token.id
                              }
                              onPress={() => revokeTokenMutation.mutate(token.id)}
                            >
                              Revoke
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
