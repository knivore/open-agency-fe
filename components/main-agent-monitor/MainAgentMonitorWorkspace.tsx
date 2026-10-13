'use client';

import DiffViewer from '@/components/tools/DiffViewer';

import Link from 'next/link';
import WorkflowReviewQueue from './WorkflowReviewQueue';
import WhatsAppNotificationSetup from '@/components/integrations-app/WhatsAppNotificationSetup';
import TelegramNotificationSetup from '@/components/integrations-app/TelegramNotificationSetup';
import {useMemo, useState} from 'react';
import {useSession} from 'next-auth/react';
import {toast} from 'sonner';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ExternalLink,
  GitBranch,
  Inbox,
  MessageSquare,
  Radar,
  RefreshCw,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Badge} from '@/components/library/shadcn/badge';
import {Button} from '@/components/library/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/library/shadcn/card';
import {Input} from '@/components/library/shadcn/input';
import {Label} from '@/components/library/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/library/shadcn/select';
import PageHeader from '@/components/app-shell/PageHeader';
import WorkspaceToolbar from '@/components/app-shell/WorkspaceToolbar';
import WorkspaceMetrics from '@/components/app-shell/WorkspaceMetrics';
import ActivityTimeline from '@/components/app-shell/ActivityTimeline';
import AppState from '@/components/app-shell/AppState';
import { NativeSelect } from '@/components/library/shadcn/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/library/shadcn/tabs';
import {conversationsApi} from '@/lib/api/backend/conversations';
import {credentialsApi} from '@/lib/api/backend/credentials';
import {mainAgentMonitorApi} from '@/lib/api/backend/workflows';
import {queryKeys} from '@/lib/react-query/queryKeys';
import type {ApprovalRequest, Conversation} from '@/types/conversations';
import type {CredentialDefinition} from '@/types/integrations';
import type {ExecutionEventRecord} from '@/types/runtime';
import type {MainAgentMonitorCommandCenterResponse} from '@/types/workflows';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function text(value: unknown, fallback = 'Not set') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function formatDate(value: unknown) {
  if (typeof value !== 'string' || !value) {
    return 'No timestamp';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function eventReason(event: ExecutionEventRecord) {
  const payload = isRecord(event.payload) ? event.payload : {};
  return text(payload.reason ?? payload.summary ?? payload.category, event.event_type);
}

function eventSeverity(event: ExecutionEventRecord) {
  const payload = isRecord(event.payload) ? event.payload : {};
  return text(payload.severity, 'info');
}

function approvalKind(approval: ApprovalRequest) {
  const metadata = isRecord(approval.metadata) ? approval.metadata : {};
  if (metadata.action === 'supervisor_steering') {
    return 'Steering';
  }
  if (metadata.proposal_kind === 'workflow_improvement') {
    return 'Workflow update';
  }
  return approval.approval_type.replaceAll('_', ' ');
}

function repoWritePermission(approval: ApprovalRequest) {
  const payload = isRecord(approval.proposed_payload) ? approval.proposed_payload : {};
  const direct = payload.repo_write_permission;
  if (isRecord(direct)) {
    return direct;
  }
  const workflow = isRecord(payload.workflow) ? payload.workflow : {};
  const metadata = isRecord(workflow.metadata) ? workflow.metadata : {};
  const nested = metadata.repo_write_permission;
  return isRecord(nested) ? nested : null;
}

function conversationFromRoute(route: Record<string, unknown>): Conversation | null {
  const conversation = route.conversation;
  return isRecord(conversation) && typeof conversation.id === 'string'
    ? (conversation as unknown as Conversation)
    : null;
}

function routeDeliverySummary(route: unknown) {
  if (!isRecord(route)) {
    return 'Conversation inbox';
  }
  const conversation = conversationFromRoute(route);
  const delivery = isRecord(route.monitor_delivery) ? route.monitor_delivery : null;
  if (!delivery) {
    return conversation ? conversationTargetLabel(conversation) : 'Conversation inbox';
  }
  const provider = text(delivery.provider, conversation?.channel_type ?? 'external');
  const credentialId = text(delivery.credential_id, 'credential not set');
  return `${provider} via ${credentialId}`;
}

function conversationTargetLabel(conversation: Conversation) {
  if (conversation.channel_type === 'discord') {
    return `Discord channel ${conversation.channel_thread_id ?? 'not set'}`;
  }
  if (conversation.channel_type === 'telegram') {
    return `Telegram chat ${conversation.channel_thread_id ?? conversation.channel_user_id ?? 'not set'}`;
  }
  if (conversation.channel_type === 'whatsapp') {
    return `WhatsApp recipient ${conversation.channel_user_id ?? 'not set'}`;
  }
  return conversation.title ?? conversation.channel_display_name ?? conversation.id;
}

const CREDENTIAL_LABEL_METADATA_KEYS = [
  'workspace_id',
  'workspace_name',
  'tenant_id',
  'guild_id',
  'default_guild_id',
  'channel_id',
  'bot_user_id',
  'bot_username',
  'phone_number_id',
  'business_account_id',
  'display_phone_number',
] as const;

function credentialLabel(credential: CredentialDefinition) {
  const metadata = credential.metadata ?? {};
  const metadataSummary = CREDENTIAL_LABEL_METADATA_KEYS.flatMap((key) => {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) {
      return [`${key}: ${value.trim()}`];
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return [`${key}: ${String(value)}`];
    }
    return [];
  })
    .slice(0, 3)
    .join(' | ');

  return metadataSummary
    ? `${credential.name} (${metadataSummary})`
    : `${credential.name} (${credential.id})`;
}

function credentialMatchesDeliveryProvider(credential: CredentialDefinition, provider: string) {
  const credentialProvider = credential.provider;
  if (provider === 'discord') {
    return credentialProvider === 'discord-bot' || credentialProvider === 'discord';
  }
  if (provider === 'telegram') {
    return credentialProvider === 'telegram-bot' || credentialProvider === 'telegram';
  }
  if (provider === 'whatsapp') {
    return credentialProvider === 'whatsapp-cloud-api' || credentialProvider === 'whatsapp';
  }
  return false;
}

function deliveryThreadLabel(provider: string) {
  if (provider === 'discord') {
    return 'Discord channel ID';
  }
  if (provider === 'telegram') {
    return 'Telegram chat ID';
  }
  return 'Thread ID';
}

function deliveryUserLabel(provider: string) {
  if (provider === 'whatsapp') {
    return 'Recipient phone / wa_id';
  }
  if (provider === 'telegram') {
    return 'Telegram user ID';
  }
  if (provider === 'discord') {
    return 'Discord user ID';
  }
  return 'Channel user ID';
}

function deliveryThreadRequired(provider: string) {
  return provider === 'telegram' || provider === 'discord';
}

export function ApprovalCard({
                               approval,
                               isMutating,
                               onDecision,
                             }: {
  approval: ApprovalRequest;
  isMutating: boolean;
  onDecision: (approvalId: string, action: 'approve' | 'reject') => void;
}) {
  const permission = repoWritePermission(approval);
  return (
    <Card className="border-neutral-200 dark:border-white/10">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle
              title={approval.summary}
              className="line-clamp-2 break-words text-base leading-6"
            >
              {approval.summary}
            </CardTitle>
            <CardDescription>
              {approvalKind(approval)} · {formatDate(approval.created_at)}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {permission ? <Badge variant="secondary">Repo write</Badge> : null}
            <Badge variant="outline">{approval.status}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <details className="group rounded-lg border bg-background">
          <summary
            className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Review request
            <ChevronDown
              className="size-4 shrink-0 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="space-y-4 border-t p-3">
            <p className="whitespace-pre-wrap break-words text-sm leading-6">{approval.summary}</p>
            {approval.diff_summary && approval.diff_summary !== approval.summary ? (
              <DiffViewer patch={approval.diff_summary} />
            ) : null}
            {permission ? (
              <div
                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <p className="font-medium">Repository write access requested</p>
                <p className="mt-1">
                  {text(permission.reason, 'Review read-write repo access before approving.')}
                </p>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={isMutating}
                onClick={() => onDecision(approval.id, 'approve')}
              >
                <Check className="mr-2 h-4 w-4"/>
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isMutating}
                onClick={() => onDecision(approval.id, 'reject')}
              >
                <X className="mr-2 h-4 w-4"/>
                Reject
              </Button>
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function EventList({
                     title,
                     events,
                     empty,
                   }: {
  title: string;
  events: Array<ExecutionEventRecord & { workflow?: { id: string; name: string } }>;
  empty: string;
}) {
  return (
    <Card className="border-neutral-200 dark:border-white/10">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{events.length} recent items</CardDescription>
      </CardHeader>
      <CardContent>
        <ActivityTimeline
          empty={empty}
          items={events.slice(0, 6).map((event) => ({
            id: event.id,
            title: eventReason(event),
            timestamp: formatDate(event.timestamp),
            meta: (
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{eventSeverity(event)}</Badge>
                <span className="text-xs text-muted-foreground">
                  {event.workflow?.name ?? event.workflow_id}
                </span>
              </div>
            ),
          }))}
        />
      </CardContent>
    </Card>
  );
}

function RoutingPanel({
                        data,
                        isSaving,
                        onSave,
                        actorUserId,
                      }: {
  data: MainAgentMonitorCommandCenterResponse;
  isSaving: boolean;
  onSave: (payload: Record<string, unknown>) => void;
  actorUserId: string;
}) {
  const noExternalDeliveryValue = '__conversation_only__';
  const route = isRecord(data.notification_route) ? data.notification_route : {};
  const routeConversation = conversationFromRoute(route);
  const routeConversationMetadata = isRecord(routeConversation?.metadata)
    ? routeConversation.metadata
    : {};
  const delivery = isRecord(route.monitor_delivery) ? route.monitor_delivery : {};
  const [conversationId, setConversationId] = useState(text(route.approval_conversation_id, ''));
  const [provider, setProvider] = useState(text(delivery.provider, 'telegram'));
  const [credentialId, setCredentialId] = useState(text(delivery.credential_id, ''));
  const [deliveryThreadId, setDeliveryThreadId] = useState(
    ['telegram', 'discord'].includes(routeConversation?.channel_type ?? '')
      ? text(routeConversation?.channel_thread_id, '')
      : ''
  );
  const [deliveryUserId, setDeliveryUserId] = useState(
    ['telegram', 'discord', 'whatsapp'].includes(routeConversation?.channel_type ?? '')
      ? text(routeConversation?.channel_user_id, '')
      : ''
  );
  const [deliveryDisplayName, setDeliveryDisplayName] = useState(
    ['telegram', 'discord', 'whatsapp'].includes(routeConversation?.channel_type ?? '')
      ? text(routeConversation?.channel_display_name, '')
      : ''
  );
  const [deliveryGuildId, setDeliveryGuildId] = useState(
    text(routeConversationMetadata.guild_id, '')
  );

  const credentialsQuery = useQuery({
    queryKey: ['monitorDeliveryCredentials'],
    queryFn: () => credentialsApi.listCredentials(),
    retry: false,
  });
  const deliveryCredentials = (credentialsQuery.data?.items ?? []).filter((credential) =>
    credentialMatchesDeliveryProvider(credential, provider)
  );

  const resolveDeliveryMutation = useMutation({
    mutationFn: async () => {
      const normalizedProvider = provider.trim().toLowerCase();
      if (!['telegram', 'discord', 'whatsapp'].includes(normalizedProvider)) {
        throw new Error('Choose Telegram, Discord, or WhatsApp before resolving a destination.');
      }
      const threadId = deliveryThreadId.trim();
      const userId = deliveryUserId.trim();
      if (deliveryThreadRequired(normalizedProvider) && !threadId) {
        throw new Error(`${deliveryThreadLabel(normalizedProvider)} is required.`);
      }
      if (!userId) {
        throw new Error(`${deliveryUserLabel(normalizedProvider)} is required.`);
      }

      const metadata = {
        ...(normalizedProvider === 'discord' && deliveryGuildId.trim()
          ? {guild_id: deliveryGuildId.trim()}
          : {}),
        purpose: 'main_agent_monitor_delivery',
      };
      // Monitor delivery only sends when the external conversation resolves to the
      // same Open Agency user that owns the selected credential.
      await conversationsApi.upsertChannelIdentityMapping({
        channel_type: normalizedProvider,
        channel_user_id: userId,
        internal_user_id: actorUserId,
        channel_display_name: deliveryDisplayName.trim() || undefined,
        trusted: true,
        metadata,
      });
      return conversationsApi.resolveChannelConversation(normalizedProvider, {
        channel_thread_id: threadId || undefined,
        channel_user_id: userId,
        channel_display_name: deliveryDisplayName.trim() || undefined,
        metadata,
      });
    },
    onSuccess: (conversation) => {
      setConversationId(conversation.id);
      setProvider(conversation.channel_type);
      setCredentialId((current) => {
        const selected = credentialsQuery.data?.items.find(
          (credential) => credential.id === current
        );
        return selected && credentialMatchesDeliveryProvider(selected, conversation.channel_type)
          ? current
          : '';
      });
      toast.success('Chat destination resolved.', {position: 'top-right'});
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to resolve chat destination.', {
        position: 'top-right',
      });
    },
  });

  return (
    <details
      className="group overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-white/10 dark:bg-white/5">
      <summary
        className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-5 py-4 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary-100 bg-primary-50 text-primary-700 dark:border-cyan-300/15 dark:bg-cyan-300/8 dark:text-cyan-200">
          <MessageSquare className="size-4" aria-hidden="true"/>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-neutral-900 dark:text-slate-100">
            Advanced: Notification routing
          </span>
          <span className="mt-0.5 block text-sm text-neutral-600 dark:text-slate-400">
            Route monitor prompts to the inbox or a linked chat conversation.
          </span>
        </span>
        <span className="hidden text-sm text-neutral-500 sm:block dark:text-slate-400">
          {routeConversation ? conversationTargetLabel(routeConversation) : 'Inbox only'}
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-neutral-500 transition-transform group-open:rotate-180"/>
      </summary>
      <div className="space-y-4 border-t border-neutral-200 p-5 dark:border-white/10">
        <div
          className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase text-neutral-500 dark:text-slate-400">
                Saved destination
              </p>
              <p className="mt-1 text-sm text-neutral-900 dark:text-slate-100">
                {routeConversation
                  ? conversationTargetLabel(routeConversation)
                  : 'No approval conversation'}
              </p>
            </div>
            {routeConversation ? <Badge variant="outline">{routeConversation.id}</Badge> : null}
          </div>
          {['telegram', 'discord', 'whatsapp'].includes(routeConversation?.channel_type ?? '') ? (
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-600 dark:text-slate-400">
              {routeConversation?.channel_thread_id ? (
                <span>Thread: {routeConversation.channel_thread_id}</span>
              ) : null}
              <span>User: {routeConversation?.channel_user_id ?? 'not set'}</span>
              {routeConversationMetadata.guild_id ? (
                <span>Guild: {String(routeConversationMetadata.guild_id)}</span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {provider !== 'whatsapp' ? (
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="delivery-thread-id">{deliveryThreadLabel(provider)}</Label>
              <Input
                id="delivery-thread-id"
                value={deliveryThreadId}
                onChange={(event) => setDeliveryThreadId(event.target.value)}
                placeholder={provider === 'telegram' ? 'chat-id' : 'channel-id'}
              />
            </div>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="delivery-user-id">{deliveryUserLabel(provider)}</Label>
            <Input
              id="delivery-user-id"
              value={deliveryUserId}
              onChange={(event) => setDeliveryUserId(event.target.value)}
              placeholder={provider === 'whatsapp' ? '15551234567' : 'operator-user-id'}
            />
          </div>
          {provider === 'discord' ? (
            <div className="space-y-1">
              <Label htmlFor="delivery-guild-id">Guild ID</Label>
              <Input
                id="delivery-guild-id"
                value={deliveryGuildId}
                onChange={(event) => setDeliveryGuildId(event.target.value)}
                placeholder="optional"
              />
            </div>
          ) : null}
          <div className="space-y-1 md:col-span-3">
            <Label htmlFor="delivery-display-name">Display name</Label>
            <Input
              id="delivery-display-name"
              value={deliveryDisplayName}
              onChange={(event) => setDeliveryDisplayName(event.target.value)}
              placeholder="optional"
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              disabled={resolveDeliveryMutation.isPending}
              onClick={() => resolveDeliveryMutation.mutate()}
            >
              <MessageSquare className="mr-2 h-4 w-4"/>
              Resolve
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_1fr_auto]">
          <div className="space-y-1">
            <Label htmlFor="approval-conversation">Approval conversation</Label>
            <Input
              id="approval-conversation"
              value={conversationId}
              onChange={(event) => setConversationId(event.target.value)}
              placeholder="conversation-id"
            />
          </div>
          <div className="space-y-1">
            <Label>Provider</Label>
            <Select
              value={provider}
              onValueChange={(value) => {
                setProvider(value);
                setCredentialId('');
              }}
            >
              <SelectTrigger>
                <SelectValue/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="telegram">Telegram</SelectItem>
                <SelectItem value="discord">Discord</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Credential</Label>
            <Select
              value={credentialId || noExternalDeliveryValue}
              onValueChange={(value) =>
                setCredentialId(value === noExternalDeliveryValue ? '' : value)
              }
            >
              <SelectTrigger>
                <SelectValue/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={noExternalDeliveryValue}>Conversation inbox only</SelectItem>
                {deliveryCredentials.map((credential) => (
                  <SelectItem key={credential.id} value={credential.id}>
                    {credentialLabel(credential)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {deliveryCredentials.length === 0 ? (
              <p className="text-xs text-amber-700">No {provider} credentials are saved yet.</p>
            ) : null}
          </div>
          <div className="flex items-end">
            <Button
              disabled={isSaving || !conversationId.trim()}
              onClick={() => {
                const payload: Record<string, unknown> = {
                  approval_conversation_id: conversationId.trim(),
                  notification_routes: credentialId.trim()
                    ? ['conversation', provider]
                    : ['conversation'],
                };
                if (credentialId.trim()) {
                  payload.monitor_delivery = {
                    provider,
                    credential_id: credentialId.trim(),
                  };
                }
                onSave(payload);
              }}
            >
              <SlidersHorizontal className="mr-2 h-4 w-4"/>
              Save
            </Button>
          </div>
        </div>
      </div>
    </details>
  );
}

export default function MainAgentMonitorWorkspace() {
  const queryClient = useQueryClient();
  const {data: session} = useSession();
  const actorUserId = session?.user?.id ?? 'operator';
  const [monitorTab, setMonitorTab] = useState('review');
  const [reviewSearch, setReviewSearch] = useState('');
  const [workflowFilter, setWorkflowFilter] = useState('all');
  const [ageFilter, setAgeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const monitorQuery = useQuery({
    queryKey: queryKeys.backendMainAgentMonitor(),
    queryFn: () => mainAgentMonitorApi.getCommandCenter(),
    refetchInterval: 30_000,
  });

  const routeMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => mainAgentMonitorApi.updateRoutes(payload),
    onSuccess: (next) => {
      queryClient.setQueryData(queryKeys.backendMainAgentMonitor(), next);
      toast.success('Monitor routing updated.', {position: 'top-right'});
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update monitor routing.', {
        position: 'top-right',
      });
    },
  });

  const approvalMutation = useMutation({
    mutationFn: ({approvalId, action}: { approvalId: string; action: 'approve' | 'reject' }) => {
      if (action === 'approve') {
        return conversationsApi.approveApprovalRequest(approvalId, {
          user_id: actorUserId,
          reason: 'Approved from main-agent monitor inbox.',
        });
      }
      return conversationsApi.rejectApprovalRequest(approvalId, {
        user_id: actorUserId,
        reason: 'Rejected from main-agent monitor inbox.',
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({queryKey: queryKeys.backendMainAgentMonitor()});
      toast.success('Approval decision recorded.', {position: 'top-right'});
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Approval decision failed.', {
        position: 'top-right',
      });
    },
  });

  const data = monitorQuery.data;
  const summary = data?.summary;
  const runtime = isRecord(data?.runtime) ? data.runtime : {};
  const lastTick = isRecord(runtime.last_tick) ? runtime.last_tick : null;
  const allApprovals = data?.pending_approvals ?? [];
  const matchesWorkflow = (id: unknown) => workflowFilter === 'all' || id === workflowFilter;
  const matchesAge = (timestamp: string | undefined) => ageFilter === 'all' || monitorQuery.dataUpdatedAt - Date.parse(timestamp ?? '') >= Number(ageFilter) * 86_400_000;
  const pendingApprovals = allApprovals.filter(approval => {
    const payload = isRecord(approval.proposed_payload) ? approval.proposed_payload : {};
    const metadata = isRecord(approval.metadata) ? approval.metadata : {};
    const workflowId = payload.workflow_id ?? metadata.workflow_id ?? (approval.target_type === 'workflow' ? approval.target_id : null);
    return matchesWorkflow(workflowId) && matchesAge(approval.created_at) &&
      (approval.summary + ' ' + approval.target_id + ' ' + approval.approval_type).toLowerCase().includes(reviewSearch.trim().toLowerCase());
  });
  const filterEvents = <T extends ExecutionEventRecord>(events: T[]) => events.filter(event =>
    matchesWorkflow(event.workflow_id) && matchesAge(event.timestamp) &&
    (severityFilter === 'all' || eventSeverity(event) === severityFilter) &&
    eventReason(event).toLowerCase().includes(reviewSearch.trim().toLowerCase()));
  const repoWriteRequests = data?.repo_write_requests ?? [];
  const monitoredWorkflows = useMemo(
    () => (data?.workflows ?? []).filter((item) => item.monitoring.enabled),
    [data?.workflows]
  );

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        icon={Radar}
        tone="monitor"
        title="Main-agent Monitor"
        description="Dedicated operations queue for workflow health findings, improvement approvals, repo-write gates, and notification routing."
        actions={
          <Button
            type="button"
            variant="outline"
            disabled={monitorQuery.isFetching}
            onClick={() => monitorQuery.refetch()}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${monitorQuery.isFetching ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        }
      />

      <WorkspaceMetrics
        label="Monitor operations"
        items={[
          { label: 'Monitor', value: data ? (data.settings?.enabled ? 'On' : 'Off') : '—' },
          { label: 'Monitored workflows', value: summary?.monitored_workflow_count ?? '—' },
          {
            label: 'Pending approvals',
            value: summary?.pending_approval_count ?? '—',
            onSelect: () => setMonitorTab('review'),
            selected: monitorTab === 'review',
          },
          { label: 'Repo write gates', value: summary?.pending_repo_write_request_count ?? '—' },
          {
            label: 'Findings',
            value: summary?.recent_finding_count ?? '—',
            onSelect: () => setMonitorTab('activity'),
            selected: monitorTab === 'activity',
          },
        ]}
      />
      {monitorQuery.isError ? <AppState variant="error" title="Monitor could not be loaded" description={monitorQuery.error instanceof Error ? monitorQuery.error.message : 'Try refreshing the monitor.'} onAction={() => void monitorQuery.refetch()}/> : null}
      <Tabs
        value={monitorTab}
        onValueChange={setMonitorTab}
        activationMode="manual"
        className="flex min-w-0 flex-col gap-4"
      >
        <TabsList aria-label="Monitor sections" className="h-auto flex-wrap justify-start">
          <TabsTrigger value="review">Review inbox</TabsTrigger>
          <TabsTrigger value="activity">Activity and coverage</TabsTrigger>
          <TabsTrigger value="notifications">Notification settings</TabsTrigger>
        </TabsList>
        {monitorTab !== 'notifications' ? (
          <WorkspaceToolbar
            search={{
              label: 'Search monitor',
              placeholder: 'Search findings and approval requests',
              value: reviewSearch,
              onChange: setReviewSearch,
            }}
            summary={
              monitorTab === 'review'
                ? `${pendingApprovals.length} of ${allApprovals.length} pending approvals`
                : 'Filter retained monitor evidence'
            }
            onReset={
              reviewSearch ||
              workflowFilter !== 'all' ||
              ageFilter !== 'all' ||
              severityFilter !== 'all'
                ? () => {
                    setReviewSearch('');
                    setWorkflowFilter('all');
                    setAgeFilter('all');
                    setSeverityFilter('all');
                  }
                : undefined
            }
          >
            <NativeSelect
              aria-label="Monitor workflow"
              value={workflowFilter}
              onChange={(event) => setWorkflowFilter(event.target.value)}
              className="w-full sm:w-64"
            >
              <option value="all">All workflows</option>
              {workflowFilter !== 'all' &&
              !(data?.workflows ?? []).some((item) => item.workflow.id === workflowFilter) ? (
                <option value={workflowFilter}>{workflowFilter} · Current filter</option>
              ) : null}
              {(data?.workflows ?? []).map((item) => (
                <option key={item.workflow.id} value={item.workflow.id}>
                  {item.workflow.name}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              aria-label="Monitor request age"
              value={ageFilter}
              onChange={(event) => setAgeFilter(event.target.value)}
              className="w-full sm:w-44"
            >
              <option value="all">All ages</option>
              <option value="1">Older than 1 day</option>
              <option value="7">Older than 7 days</option>
              <option value="30">Older than 30 days</option>
            </NativeSelect>
            {monitorTab === 'activity' ? (
              <NativeSelect
                aria-label="Finding severity"
                value={severityFilter}
                onChange={(event) => setSeverityFilter(event.target.value)}
                className="w-full sm:w-44"
              >
                <option value="all">All severities</option>
                {[
                  ...new Set([
                    ...(data?.findings ?? []).map(eventSeverity),
                    ...(severityFilter !== 'all' ? [severityFilter] : []),
                  ]),
                ]
                  .sort()
                  .map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
              </NativeSelect>
            ) : null}
          </WorkspaceToolbar>
        ) : null}
        <TabsContent value="review" className="flex flex-col gap-5">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <Card className="border-neutral-200 dark:border-white/10">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Inbox className="h-5 w-5 text-primary-700" />
                  <CardTitle>Human Attention Inbox</CardTitle>
                </div>
                <CardDescription>
                  Pending monitor approvals are explicit human gates; repo-write requests are never
                  auto-approved.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {monitorQuery.isLoading ? (
                  <AppState
                    variant="loading"
                    title="Loading review inbox"
                    description="Reading pending human decisions."
                    compact
                  />
                ) : pendingApprovals.length === 0 ? (
                  <p className="text-sm text-neutral-500 dark:text-slate-400">
                    No approval requests match this view.
                  </p>
                ) : (
                  pendingApprovals.map((approval) => (
                    <ApprovalCard
                      key={approval.id}
                      approval={approval}
                      isMutating={approvalMutation.isPending}
                      onDecision={(approvalId, action) =>
                        approvalMutation.mutate({ approvalId, action })
                      }
                    />
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-neutral-200 dark:border-white/10">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Radar className="h-5 w-5 text-primary-700" />
                  <CardTitle>Operational Health</CardTitle>
                </div>
                <CardDescription>Monitor loop status and delivery signals.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs font-medium uppercase text-neutral-500 dark:text-slate-400">
                    Last tick
                  </p>
                  <p className="mt-1 text-sm text-neutral-900 dark:text-slate-100">
                    {lastTick
                      ? formatDate(lastTick.occurred_at ?? lastTick.timestamp)
                      : 'No tick recorded yet'}
                  </p>
                  {lastTick?.error ? (
                    <p className="mt-1 text-sm text-red-700">{String(lastTick.error)}</p>
                  ) : null}
                </div>
                <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs font-medium uppercase text-neutral-500 dark:text-slate-400">
                    External delivery
                  </p>
                  <p className="mt-1 text-sm text-neutral-900 dark:text-slate-100">
                    {routeDeliverySummary(data?.notification_route)}
                  </p>
                </div>
                <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs font-medium uppercase text-neutral-500 dark:text-slate-400">
                    Strict monitoring
                  </p>
                  <p className="mt-1 text-sm text-neutral-900 dark:text-slate-100">
                    {summary?.strict_workflow_count ?? 0} workflows
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <WorkflowReviewQueue
            jobs={
              (Array.isArray(data?.review_queue) ? data.review_queue : []) as React.ComponentProps<
                typeof WorkflowReviewQueue
              >['jobs']
            }
            refresh={() => monitorQuery.refetch()}
          />

          {repoWriteRequests.length > 0 ? (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-700" />
                  <CardTitle>Repository Write Requests</CardTitle>
                </div>
                <CardDescription>
                  Approve only when the requested repo should be mounted read-write and host permissions
                  are writable.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {repoWriteRequests.map((approval) => {
                  const permission = repoWritePermission(approval);
                  return (
                    <div
                      key={approval.id}
                      className="rounded-md border border-amber-200 bg-white px-3 py-3 dark:border-amber-400/20 dark:bg-slate-950/60"
                    >
                      <p className="font-medium text-neutral-900 dark:text-slate-100">
                        {approval.summary}
                      </p>
                      <p className="mt-1 text-sm text-neutral-600 dark:text-slate-300">
                        {text(permission?.operator_action, 'Review read-write mounts before approval.')}
                      </p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>
        <TabsContent value="activity" className="flex flex-col gap-5">
          <div className="grid gap-6 xl:grid-cols-3">
            <EventList
              title="Recent Findings"
              events={filterEvents(data?.findings ?? [])}
              empty="No recent findings."
            />
            <EventList
              title="Improvement Proposals"
              events={filterEvents(data?.proposals ?? [])}
              empty="No recent proposals."
            />
            <EventList
              title="Steering Requests"
              events={filterEvents(data?.steering_requests ?? [])}
              empty="No recent steering requests."
            />
          </div>

          <Card className="border-neutral-200 dark:border-white/10">
            <CardHeader>
              <div className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-primary-700" />
                <CardTitle>Monitored Workflows</CardTitle>
              </div>
              <CardDescription>Current monitor coverage and workflow-level controls.</CardDescription>
            </CardHeader>
            <CardContent>
              {monitoredWorkflows.length === 0 ? (
                <p className="text-sm text-neutral-500 dark:text-slate-400">
                  No workflows are currently monitored.
                </p>
              ) : (
                <div className="grid gap-2">
                  {monitoredWorkflows.slice(0, 12).map((item) => (
                    <Link
                      key={item.workflow.id}
                      href={`/workflows/${item.workflow.id}?tab=monitoring`}
                      className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm hover:border-primary-200 hover:bg-primary-50 dark:border-white/10 dark:bg-white/5 dark:hover:border-cyan-400/20 dark:hover:bg-white/10"
                    >
                      <span className="min-w-0 truncate font-medium text-neutral-900 dark:text-slate-100">
                        {item.workflow.name}
                      </span>
                      <span className="flex items-center gap-2 text-neutral-500 dark:text-slate-400">
                        {item.monitoring.status_label}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent
          value="notifications"
          forceMount
          hidden={monitorTab !== 'notifications'}
          className="flex flex-col gap-5 data-[state=inactive]:hidden"
        >
          <TelegramNotificationSetup />
          <WhatsAppNotificationSetup />

          {data ? (
            <RoutingPanel
              key={JSON.stringify(data.notification_route ?? {})}
              data={data}
              isSaving={routeMutation.isPending}
              actorUserId={actorUserId}
              onSave={(payload) => routeMutation.mutate(payload)}
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
