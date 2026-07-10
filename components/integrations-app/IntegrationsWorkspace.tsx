'use client';

import {
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { connectorsApi } from '@/lib/api/backend/connectors';
import { credentialsApi } from '@/lib/api/backend/credentials';
import { integrationsApi } from '@/lib/api/backend/integrations';
import { mcpServersApi } from '@/lib/api/backend/mcpServers';
import { providersApi } from '@/lib/api/backend/providers';
import { profileApi } from '@/lib/api/backend/profile';
import type {
  SmartHomeEntityListPayload,
  SmartHomeEntitySummary,
} from '@/lib/api/backend/smartHome';
import { smartHomeApi } from '@/lib/api/backend/smartHome';
import { toolsApi } from '@/lib/api/backend/tools';
import { isApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/react-query/queryKeys';
import type {
  ConnectorCapabilityDefinition,
  ConnectorHealthHistoryPayload,
  ConnectorInstallationDefinition,
  ConnectorSetupSessionPayload,
  CredentialDefinition,
  IntegrationCatalogPayload,
  IntegrationCategory,
  IntegrationProvider,
  ModelProfileDefinition,
  ModelProviderDefinition,
  PlannedIntegrationDefinition,
  PlannedIntegrationState,
} from '@/types/integrations';
import { Badge } from '../library/shadcn/badge';
import { Button } from '../library/shadcn/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../library/shadcn/card';
import { useRegisterAssistantPageContext } from '@/components/assistant/AssistantPageContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../library/shadcn/dialog';
import { Input } from '../library/shadcn/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../library/shadcn/tabs';
import { Textarea } from '../library/shadcn/textarea';
import PageHeader from '@/components/app-shell/PageHeader';
import { ArrowRight, Copy, Info, PlugZap, Plus, RefreshCw, Trash2, Wrench } from 'lucide-react';
import { EmptyCard, ErrorAlert, LoadingCard } from '@/components/agent-app/StatePanels';
import { toast } from 'sonner';
import type { ToolDefinition } from '@/types/tools';
import { cn } from '@/lib/utils';
import { buildSmartHomeCapabilityMetadata } from '@/modules/smart-home/capabilityMetadata';

const TOOL_TYPES = [
  'python_function',
  'http_request',
  'sql_query',
  'shell_command',
  'mcp_tool',
  'a2a_remote_agent',
  'workflow_tool',
  'human_approval',
] as const;

const IMPLEMENTATION_TYPES = ['python', 'http', 'mcp', 'a2a', 'shell', 'other'] as const;
const MCP_TRANSPORT_TYPES = ['stdio', 'http', 'sse'] as const;
type OperationsFilter = 'all' | 'failing' | 'healthy' | 'never-tested';
type ConnectorSetupMode = 'new' | 'update';
const OPERATIONS_PAGE_SIZE = 5;
const CATEGORY_PAGE_SIZE = 12;
const CATEGORY_PAGINATION_THRESHOLD = 25;
const ONECLI_AGENCY_USER_PLACEHOLDER = '{agency_user_id}';
const ONECLI_INSTALLATION_PLACEHOLDER = '{agency_installation_id}';

function onecliTransportModeLabel(mode?: ConnectorCapabilityDefinition['onecliTransportMode']) {
  return mode === 'direct' ? 'Direct capable' : 'Proxy-compatible';
}

function capabilitySurfaceLabel(surface?: ConnectorCapabilityDefinition['capabilitySurface']) {
  return surface === 'module' ? 'Module surface' : 'Connector surface';
}

const FALLBACK_CONNECTOR_METADATA: Record<string, ConnectorCapabilityDefinition> = {
  'telegram-bot': {
    backendKey: 'telegram-bot',
    displayName: 'Telegram',
    authModel: 'bot token',
    providerAliases: ['telegram'],
    onecliTransportMode: 'direct',
    healthSupported: false,
    requiredMetadata: [],
    instanceIdentityMetadata: [
      {
        key: 'bot_user_id',
        description: 'Telegram bot user id for distinguishing multiple bot tokens.',
      },
      {
        key: 'bot_username',
        description: 'Telegram bot username shown to operators and agents.',
      },
    ],
    supportedSecretRefSchemes: ['onecli://', 'env://', 'env:'],
    onecliSetupGuide: {
      storagePath: 'onecli://users/{agency_user_id}/telegram-bot/{agency_installation_id}',
      fields: [
        {
          key: 'bot_token',
          label: 'Bot token',
          secret: true,
          description: 'Paste the Telegram Bot API token from BotFather into OneCLI.',
        },
        {
          key: 'webhook_secret_ref',
          label: 'Webhook secret ref',
          secret: false,
          description:
            'Store the secret reference used to verify Telegram production webhooks as Agency metadata.',
        },
      ],
      agencyStores: [
        'installation id',
        'provider key',
        'display name',
        'onecli credential ref',
        'non-secret metadata',
        'installation status',
      ],
      completionSignal:
        'OneCLI completes the Agency installation with only the onecli:// credential ref and non-secret metadata; Agency then marks the installation active.',
      notes: [
        'Each setup session gets its own Agency installation id, so multiple Telegram bots can coexist without sharing a OneCLI path.',
        'Store the Telegram bot token in OneCLI, but keep delivery and health checks direct because the bot token is embedded in the request path. Agency mirrors the same secret into a runtime secret record at completion time, so OneCLI stays the setup/storage layer for direct transport.',
      ],
    },
  },
  'whatsapp-cloud-api': {
    backendKey: 'whatsapp-cloud-api',
    displayName: 'WhatsApp Cloud API',
    authModel: 'access token',
    providerAliases: ['whatsapp', 'meta-whatsapp'],
    onecliTransportMode: 'direct',
    healthSupported: false,
    requiredMetadata: [
      {
        key: 'phone_number_id',
        description:
          'WhatsApp Cloud API requires the Meta phone number id used for message delivery and health checks.',
      },
    ],
    instanceIdentityMetadata: [
      {
        key: 'business_account_id',
        description: 'Meta WhatsApp Business Account id for this sender.',
      },
      {
        key: 'display_phone_number',
        description: 'Human-readable sender phone number for this credential.',
      },
    ],
    supportedSecretRefSchemes: ['onecli://', 'env://', 'env:'],
    onecliSetupGuide: {
      storagePath: 'onecli://users/{agency_user_id}/whatsapp-cloud-api/{agency_installation_id}',
      fields: [
        {
          key: 'access_token',
          label: 'Access token',
          secret: true,
          description: 'Paste the Meta WhatsApp Cloud API access token into OneCLI.',
        },
        {
          key: 'phone_number_id',
          label: 'Phone number id',
          secret: false,
          description: 'Store the delivery phone number id as Agency metadata.',
        },
        {
          key: 'app_secret_ref',
          label: 'App secret ref',
          secret: false,
          description:
            'Store the app secret reference used to verify WhatsApp production webhooks as Agency metadata.',
        },
      ],
      agencyStores: [
        'installation id',
        'provider key',
        'display name',
        'onecli credential ref',
        'non-secret metadata',
        'installation status',
      ],
      completionSignal:
        'OneCLI completes the Agency installation with only the onecli:// credential ref and non-secret metadata; Agency then marks the installation active.',
      notes: [
        'Each setup session gets its own Agency installation id, so multiple WhatsApp installs can coexist without sharing a OneCLI path.',
      ],
    },
  },
  'discord-bot': {
    backendKey: 'discord-bot',
    displayName: 'Discord',
    authModel: 'bot token',
    providerAliases: ['discord'],
    onecliTransportMode: 'direct',
    healthSupported: false,
    requiredMetadata: [],
    instanceIdentityMetadata: [
      {
        key: 'application_id',
        description: 'Discord application id that owns this bot token.',
      },
      {
        key: 'bot_user_id',
        description: 'Discord bot user id for distinguishing multiple bot tokens.',
      },
      {
        key: 'default_guild_id',
        description: 'Default Discord guild id this credential is intended to operate in.',
      },
    ],
    supportedSecretRefSchemes: ['onecli://', 'env://', 'env:'],
    onecliSetupGuide: {
      storagePath: 'onecli://users/{agency_user_id}/discord-bot/{agency_installation_id}',
      fields: [
        {
          key: 'bot_token',
          label: 'Bot token',
          secret: true,
          description:
            'Paste the Discord bot token from the application bot settings into OneCLI for connector health, HTTP delivery, and ordinary Discord server/channel chat. Discord is direct-capable, so Agency can mirror the same secret into runtime storage and use the direct path for Gateway auth, including DMs.',
        },
        {
          key: 'webhook_public_key',
          label: 'Webhook public key',
          secret: false,
          description:
            'Store the Discord application Public Key as Agency metadata for interaction verification. This must be the Public Key hex value, not a Discord webhook URL.',
        },
      ],
      agencyStores: [
        'installation id',
        'provider key',
        'display name',
        'onecli credential ref',
        'non-secret metadata',
        'installation status',
      ],
      completionSignal:
        'OneCLI completes the Agency installation with only the onecli:// credential ref and non-secret metadata; Agency then marks the installation active.',
      notes: [
        'Each setup session gets its own Agency installation id, so multiple Discord bots can coexist without sharing a OneCLI path.',
      ],
    },
  },
  'home-assistant': {
    backendKey: 'home-assistant',
    displayName: 'Smart Home',
    authModel: 'access token',
    providerAliases: ['home-assistant', 'home_assistant', 'homeassistant', 'smart-home'],
    ...buildSmartHomeCapabilityMetadata(),
    onecliTransportMode: 'proxy',
    healthSupported: false,
    requiredMetadata: [],
    instanceIdentityMetadata: [
      {
        key: 'base_url',
        description: 'Base URL for the Home Assistant instance, including scheme and host.',
      },
      {
        key: 'home_name',
        description: 'Operator-facing home or installation name for this Home Assistant instance.',
      },
      {
        key: 'default_area',
        description: 'Default Home Assistant area or room for ambient-home queries.',
      },
    ],
    targetScopeMetadata: [
      {
        key: 'area_id',
        description: "Home Assistant area id used as the workflow's default room target.",
      },
      {
        key: 'entity_id',
        description: 'Default Home Assistant entity id when the workflow acts on one device.',
      },
      {
        key: 'camera_entity_id',
        description:
          'Default Home Assistant camera entity id for snapshot or scene analysis flows.',
      },
    ],
    supportedSecretRefSchemes: ['onecli://', 'env://', 'env:'],
    onecliSetupGuide: {
      storagePath: 'onecli://users/{agency_user_id}/home-assistant/{agency_installation_id}',
      fields: [
        {
          key: 'base_url',
          label: 'Base URL',
          secret: false,
          description: 'Store the full Home Assistant base URL, such as https://home.example.com.',
        },
        {
          key: 'access_token',
          label: 'Long-lived access token',
          secret: true,
          description:
            'Paste a Home Assistant long-lived access token generated from the user profile page.',
        },
        {
          key: 'verify_ssl',
          label: 'Verify SSL',
          secret: false,
          description:
            'Set whether Agency should verify the Home Assistant server certificate in production.',
        },
      ],
      options: [
        {
          id: 'long-lived-token',
          name: 'Long-Lived Token',
          authModel: 'access token',
          summary: 'Recommended for the current MVP and maps directly to Agency runtime settings.',
          fields: [
            {
              key: 'base_url',
              label: 'Base URL',
              secret: false,
              description: 'Agency needs the reachable Home Assistant base URL.',
            },
            {
              key: 'access_token',
              label: 'Long-lived access token',
              secret: true,
              description:
                'Generate this from the Home Assistant user profile page and store it in OneCLI.',
            },
            {
              key: 'verify_ssl',
              label: 'Verify SSL',
              secret: false,
              description: 'Enable this for publicly trusted HTTPS certificates.',
            },
          ],
          notes: [
            "Use this for today's backend path. Agency reads Home Assistant through the stored base URL plus bearer token.",
          ],
        },
        {
          id: 'interactive-browser-connection',
          name: 'Interactive Connection',
          authModel: 'oauth/session bootstrap',
          summary:
            'Frontend-led browser flow that should still complete by storing the same base URL and bearer token fields.',
          fields: [
            {
              key: 'base_url',
              label: 'Base URL',
              secret: false,
              description:
                'Capture the Home Assistant instance URL before handing off to a browser-based connection flow.',
            },
          ],
          notes: [
            'Home Assistant is still the single integration point. Do not introduce separate Aqara, Xiaomi, or Google Home connector frameworks for the same home setup path.',
          ],
        },
      ],
      agencyStores: [
        'installation id',
        'provider key',
        'display name',
        'onecli credential ref',
        'non-secret metadata',
        'installation status',
      ],
      completionSignal:
        'OneCLI completes the Agency installation with only the onecli:// credential ref and non-secret metadata; Agency then marks the installation active.',
      notes: [
        'Connect Agency through the Smart Home path backed by Home Assistant. Aqara, Xiaomi, Google Home, and similar ecosystems should already be bridged into Home Assistant before this step.',
      ],
    },
  },
};

const PRODUCTION_WEBHOOK_METADATA: Record<
  string,
  Array<{ key: string; description: string; alternatives?: string[] }>
> = {
  'telegram-bot': [
    {
      key: 'webhook_secret_ref',
      alternatives: ['webhook_secret_token'],
      description:
        'Telegram production webhooks require webhook_secret_ref or webhook_secret_token.',
    },
  ],
  'discord-bot': [
    {
      key: 'webhook_public_key',
      description:
        'Discord production interaction webhooks require webhook_public_key. Ordinary server/channel messages and DMs can use the background Discord Gateway path when the credential is completed in direct mode.',
    },
  ],
  'whatsapp-cloud-api': [
    {
      key: 'app_secret_ref',
      alternatives: ['app_secret'],
      description: 'WhatsApp production webhooks require app_secret_ref or app_secret.',
    },
  ],
};

function statusVariant(status: IntegrationProvider['status']) {
  switch (status) {
    case 'configured':
    case 'enabled':
      return 'successful';
    case 'planned':
      return 'secondary';
    case 'disabled':
    case 'unsupported':
      return 'failed';
    default:
      return 'outline';
  }
}

function providerStatusLabel(status: IntegrationProvider['status']) {
  return status === 'planned' ? 'setup ready' : status;
}

function integrationStatusCue(status: IntegrationProvider['status']) {
  switch (status) {
    case 'configured':
    case 'enabled':
      return {
        accent: 'bg-success-500',
        badge:
          'border-success-200 bg-success-50 text-success-800 dark:border-emerald-400/25 dark:bg-emerald-500/12 dark:text-emerald-100',
        card: 'border-success-200 bg-success-50/30 dark:border-emerald-400/25 dark:bg-[linear-gradient(180deg,rgba(8,28,26,0.96)_0%,rgba(11,26,24,0.94)_100%)]',
      };
    case 'planned':
      return {
        accent: 'bg-secondary-500',
        badge:
          'border-secondary-200 bg-secondary-50 text-secondary-800 dark:border-sky-400/20 dark:bg-sky-500/12 dark:text-sky-100',
        card: 'border-secondary-200 bg-secondary-50/30 dark:border-sky-400/20 dark:bg-[linear-gradient(180deg,rgba(15,22,40,0.96)_0%,rgba(11,19,34,0.95)_100%)]',
      };
    case 'disabled':
    case 'unsupported':
      return {
        accent: 'bg-destructive-500',
        badge:
          'border-destructive-200 bg-destructive-50 text-destructive-800 dark:border-red-400/25 dark:bg-red-500/12 dark:text-red-100',
        card: 'border-destructive-200 bg-destructive-50/25 dark:border-red-400/25 dark:bg-[linear-gradient(180deg,rgba(38,17,20,0.96)_0%,rgba(26,15,18,0.95)_100%)]',
      };
    default:
      return {
        accent: 'bg-primary-500',
        badge:
          'border-primary-200 bg-primary-50 text-primary-800 dark:border-primary-400/25 dark:bg-primary-500/12 dark:text-primary-100',
        card: 'border-primary-200 bg-primary-50/25 dark:border-primary-400/25 dark:bg-[linear-gradient(180deg,rgba(17,22,38,0.96)_0%,rgba(13,18,31,0.95)_100%)]',
      };
  }
}

function formatShortTimestamp(value?: string | null) {
  if (!value) return 'Unknown time';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function toStringValue(value: unknown) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function connectorFailureHint(error?: string | null) {
  if (!error) {
    return null;
  }

  const normalized = error.toLowerCase();
  if (
    normalized.includes('certificate_verify_failed') &&
    normalized.includes('self-signed certificate')
  ) {
    // This error is emitted by Python connector health checks, so the operator needs
    // backend trust-store remediation rather than a browser or Next.js setting.
    return 'Backend TLS verification rejected a self-signed certificate. Trust the issuing CA in the backend runtime, set SSL_CERT_FILE/REQUESTS_CA_BUNDLE to that CA bundle, or use a non-intercepted network path before re-testing.';
  }

  return null;
}

function mergeMetadataRequirements(
  ...groups: Array<ConnectorCapabilityDefinition['requiredMetadata']>
) {
  const seen = new Set<string>();
  return groups
    .flatMap((group) => group ?? [])
    .filter((requirement) => {
      if (seen.has(requirement.key)) {
        return false;
      }
      seen.add(requirement.key);
      return true;
    });
}

const CREDENTIAL_INSTANCE_LABEL_KEYS = [
  'workspace_id',
  'workspace_name',
  'tenant_id',
  'team_id',
  'channel_id',
  'default_channel_id',
  'guild_id',
  'default_guild_id',
  'bot_user_id',
  'bot_username',
  'phone_number_id',
  'display_phone_number',
  'mailbox',
  'owner',
  'repo',
  'bucket',
  'region',
  'folder_id',
] as const;

function credentialInstanceLabel(credential: CredentialDefinition) {
  const metadata = credential.metadata ?? {};
  const summary = CREDENTIAL_INSTANCE_LABEL_KEYS.flatMap((key) => {
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

  return summary ? `${credential.name} (${summary})` : credential.name;
}

function parseJsonObject(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }

  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function isConnectorSetupSessionPayload(
  value: CredentialDefinition | ConnectorSetupSessionPayload
): value is ConnectorSetupSessionPayload {
  return (
    typeof (value as ConnectorSetupSessionPayload).setup_url === 'string' &&
    typeof (value as ConnectorSetupSessionPayload).device_code === 'string' &&
    typeof (value as ConnectorSetupSessionPayload).onecli_credential_ref === 'string'
  );
}

function canCompleteConnectorInstallation(installation: ConnectorInstallationDefinition | null) {
  return installation?.status === 'setup_pending' || installation?.status === 'rotation_required';
}

function buildFallbackOneCLISetupGuide(
  provider: IntegrationProvider,
  planned?: PlannedIntegrationState
): NonNullable<ConnectorCapabilityDefinition['onecliSetupGuide']> {
  const backendKey = planned?.backendKey || provider.id;
  const authModel = planned?.authModel || 'credential';
  const secretLabel =
    {
      'api key': 'API key',
      'access key': 'Access key',
      'access token': 'Access token',
      'bot token': 'Bot token',
      oauth: 'OAuth token set',
    }[authModel.toLowerCase()] ?? 'Credential';

  return {
    storagePath: `onecli://users/${ONECLI_AGENCY_USER_PLACEHOLDER}/${backendKey}/${ONECLI_INSTALLATION_PLACEHOLDER}`,
    fields: [
      {
        key: secretLabel.toLowerCase().replace(/\s+/g, '_'),
        label: secretLabel,
        secret: authModel.toLowerCase() !== 'public api',
        description: `Store the ${authModel} credential in OneCLI for ${provider.name}.`,
      },
    ],
    options: [],
    agencyStores: [
      'installation id',
      'provider key',
      'display name',
      'onecli credential ref',
      'non-secret metadata',
      'installation status',
    ],
    completionSignal:
      'OneCLI completes the Agency installation with only the onecli:// credential ref and non-secret metadata; Agency then marks the installation active.',
    notes:
      backendKey === 'telegram-bot'
        ? [
            'Store the Telegram bot token in OneCLI, but keep delivery and health checks direct because the bot token is embedded in the request path. Agency mirrors the same secret into a runtime secret record at completion time, so OneCLI stays the setup/storage layer for direct transport.',
          ]
        : [],
  };
}

function resolveOneCLIStoragePath(storagePath: string, agencyUserId: string) {
  return storagePath.replaceAll(ONECLI_AGENCY_USER_PLACEHOLDER, agencyUserId);
}

function normalizeOneCLISetupUrl(setupUrl: string) {
  try {
    const url = new URL(setupUrl);

    // OneCLI setup sessions are sometimes issued with the internal service host name.
    // The browser needs a host it can actually resolve, so preserve the path/query but
    // swap the hostname to the current frontend host when we see the internal alias.
    if (url.hostname === 'onecli' && typeof window !== 'undefined' && window.location.hostname) {
      url.hostname = window.location.hostname;
      return url.toString();
    }

    return setupUrl;
  } catch {
    return setupUrl;
  }
}

type OneCLICopyRow = {
  id: string;
  label: string;
  value: string;
  description: string;
  copyable: boolean;
};

type OneCLIGenericSecretGuide = {
  rows: OneCLICopyRow[];
  notes: string[];
};

function buildOneCLIGenericSecretGuide(
  provider: IntegrationProvider,
  backendKey: string,
  onecliStoragePath: string,
  setupSession: ConnectorSetupSessionPayload | null,
  setupGuideFields: NonNullable<ConnectorCapabilityDefinition['onecliSetupGuide']>['fields'],
  setupGuideNotes: string[] = []
): OneCLIGenericSecretGuide {
  const sessionRows: OneCLICopyRow[] = setupSession
    ? [
        {
          id: 'agency_installation_id',
          label: 'Agency installation id',
          value: setupSession.installation.id,
          description: 'Paste this if OneCLI asks which Agency installation to complete.',
          copyable: true,
        },
        {
          id: 'device_code',
          label: 'Device code',
          value: setupSession.device_code,
          description: 'Short code that links the OneCLI setup back to Agency.',
          copyable: true,
        },
      ]
    : [];
  const refRow: OneCLICopyRow = {
    id: 'credential_ref',
    label: 'Agency credential_ref',
    value: setupSession?.onecli_credential_ref ?? onecliStoragePath,
    description: 'OneCLI should persist the secret under this Agency-owned namespace.',
    copyable: true,
  };

  if (backendKey === 'discord-bot') {
    return {
      rows: [
        {
          id: 'custom_connection_key',
          label: 'Name',
          value: backendKey,
          description: 'Use this as the OneCLI custom connection name/key.',
          copyable: true,
        },
        {
          id: 'secret_value',
          label: 'Secret value',
          value: 'Paste Discord bot token from Discord Developer Portal',
          description: 'Agency does not store this value. Paste it directly into OneCLI.',
          copyable: false,
        },
        {
          id: 'host_pattern',
          label: 'Host pattern',
          value: 'discord.com',
          description: 'Matches Discord API requests.',
          copyable: true,
        },
        {
          id: 'inject_as',
          label: 'Inject as',
          value: 'Header',
          description: 'Select Header in OneCLI.',
          copyable: true,
        },
        {
          id: 'header_name',
          label: 'Header name',
          value: 'Authorization',
          description: 'Discord expects the bot token in the Authorization header.',
          copyable: true,
        },
        {
          id: 'path_pattern',
          label: 'Path pattern',
          value: '/api/v10/*',
          description: 'Limits injection to Discord API calls.',
          copyable: true,
        },
        {
          id: 'value_format',
          label: 'Value format',
          value: 'Bot {value}',
          description: 'OneCLI replaces {value} with the secret value.',
          copyable: true,
        },
        refRow,
        ...sessionRows,
      ],
      notes: [],
    };
  }

  if (backendKey === 'whatsapp-cloud-api') {
    return {
      rows: [
        {
          id: 'custom_connection_key',
          label: 'Name',
          value: backendKey,
          description: 'Use this as the OneCLI custom connection name/key.',
          copyable: true,
        },
        {
          id: 'secret_value',
          label: 'Secret value',
          value: 'Paste Meta WhatsApp Cloud API access token',
          description: 'Agency does not store this value. Paste it directly into OneCLI.',
          copyable: false,
        },
        {
          id: 'host_pattern',
          label: 'Host pattern',
          value: 'graph.facebook.com',
          description: 'Matches Meta Graph API requests.',
          copyable: true,
        },
        {
          id: 'inject_as',
          label: 'Inject as',
          value: 'Header',
          description: 'Select Header in OneCLI.',
          copyable: true,
        },
        {
          id: 'header_name',
          label: 'Header name',
          value: 'Authorization',
          description: 'WhatsApp Cloud API expects a bearer token header.',
          copyable: true,
        },
        {
          id: 'path_pattern',
          label: 'Path pattern',
          value: '/*',
          description: 'Applies to Graph API paths for this connection.',
          copyable: true,
        },
        {
          id: 'value_format',
          label: 'Value format',
          value: 'Bearer {value}',
          description: 'OneCLI replaces {value} with the access token.',
          copyable: true,
        },
        {
          id: 'metadata_phone_number_id',
          label: 'Agency metadata',
          value: 'phone_number_id',
          description: 'This is non-secret metadata Agency can store for WhatsApp delivery.',
          copyable: true,
        },
        refRow,
        ...sessionRows,
      ],
      notes: [],
    };
  }

  const primarySecret = setupGuideFields.find((field) => field.secret);
  const fallbackSecretLabel =
    primarySecret?.label ??
    setupGuideFields.find((field) => field.key)?.label ??
    `${provider.name} secret`;
  const rows: OneCLICopyRow[] = [
    {
      id: 'custom_connection_key',
      label: 'Name',
      value: backendKey,
      description: 'Use this as the OneCLI custom connection name/key.',
      copyable: true,
    },
    {
      id: primarySecret ? `secret_${primarySecret.key}` : 'secret_value',
      label: 'Secret value',
      value:
        backendKey === 'telegram-bot'
          ? 'Paste Telegram Bot API token from BotFather'
          : `Paste ${fallbackSecretLabel} from ${provider.name}`,
      description: 'Agency does not store this value. Paste it directly into OneCLI.',
      copyable: false,
    },
    refRow,
    ...setupGuideFields
      .filter((field) => !field.secret)
      .map((field) => ({
        id: `metadata_${field.key}`,
        label: 'Agency metadata',
        value: field.key,
        description: `${field.label} is non-secret metadata Agency can keep with the installation.`,
        copyable: true,
      })),
    ...sessionRows,
  ];

  return {
    rows,
    notes: setupGuideNotes.length
      ? setupGuideNotes
      : backendKey === 'telegram-bot'
        ? [
            'Store the Telegram bot token in OneCLI, but keep delivery and health checks direct because the bot token is embedded in the request path. Agency mirrors the same secret into a runtime secret record at completion time, so OneCLI stays the setup/storage layer for direct transport.',
          ]
        : [],
  };
}

function csvToList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDisplayLabel(value?: string | null) {
  if (!value) return '';
  const words = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  const acronyms = new Set([
    'a2a',
    'api',
    'cli',
    'csv',
    'docx',
    'html',
    'http',
    'json',
    'llm',
    'mcp',
    'pdf',
    'sql',
    'txt',
    'ui',
    'url',
    'xml',
    'yaml',
  ]);
  const lowercase = new Set([
    'a',
    'an',
    'and',
    'as',
    'by',
    'for',
    'from',
    'in',
    'of',
    'on',
    'or',
    'the',
    'to',
    'with',
  ]);

  return words
    .map((word, index) => {
      const normalized = word.toLowerCase();
      if (acronyms.has(normalized)) return word.toUpperCase();
      if (index > 0 && lowercase.has(normalized)) return normalized;
      return `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`;
    })
    .join(' ');
}

function smartHomeEntityFriendlyName(entity: SmartHomeEntitySummary) {
  const friendly = entity.attributes?.friendly_name;
  return typeof friendly === 'string' && friendly.trim() ? friendly.trim() : entity.entity_id;
}

function smartHomeEntityAreaName(entity: SmartHomeEntitySummary) {
  const area = entity.attributes?.area_name;
  return typeof area === 'string' && area.trim() ? area.trim() : null;
}

function formatSmartHomePreviewError(error: unknown) {
  if (!(error instanceof Error) || !error.message.trim()) {
    return 'Unable to fetch Home Assistant entities.';
  }

  const message = error.message.trim();
  if (message.startsWith('<!DOCTYPE html') || message.startsWith('<html')) {
    return 'Home Assistant preview returned an unexpected HTML response. Check that the frontend API proxy route is available and the backend path is reachable.';
  }

  return message;
}

const CATEGORY_PROVIDER_KIND_ORDER: IntegrationProvider['kind'][] = [
  'planned',
  'model_provider',
  'model_profile',
  'tool',
  'mcp_server',
  'runtime_adapter',
];

type SupportedProviderFilter = 'all' | IntegrationProvider['kind'];

function categorySearchParam(categoryId: string) {
  return `integration-search-${categoryId}`;
}

function categoryFilterParam(categoryId: string) {
  return `integration-filter-${categoryId}`;
}

function categoryPageParam(categoryId: string) {
  return `integration-page-${categoryId}`;
}

function readCategorySearchQuery(categoryId: string) {
  if (typeof window === 'undefined') {
    return '';
  }

  return new URLSearchParams(window.location.search).get(categorySearchParam(categoryId)) ?? '';
}

function persistCategorySearchQuery(categoryId: string, query: string) {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  const param = categorySearchParam(categoryId);
  const normalizedQuery = query.trim();
  if (normalizedQuery) {
    url.searchParams.set(param, normalizedQuery);
  } else {
    url.searchParams.delete(param);
  }
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

function readCategoryProviderFilter(categoryId: string): SupportedProviderFilter {
  if (typeof window === 'undefined') {
    return 'all';
  }

  const value = new URLSearchParams(window.location.search).get(categoryFilterParam(categoryId));
  if (
    value === 'planned' ||
    value === 'model_provider' ||
    value === 'model_profile' ||
    value === 'tool' ||
    value === 'mcp_server' ||
    value === 'runtime_adapter'
  ) {
    return value;
  }

  return 'all';
}

function persistCategoryProviderFilter(categoryId: string, filter: SupportedProviderFilter) {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  const param = categoryFilterParam(categoryId);
  if (filter === 'all') {
    url.searchParams.delete(param);
  } else {
    url.searchParams.set(param, filter);
  }
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

function readCategoryPage(categoryId: string) {
  if (typeof window === 'undefined') {
    return 1;
  }

  const value = Number.parseInt(
    new URLSearchParams(window.location.search).get(categoryPageParam(categoryId)) ?? '1',
    10
  );
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function persistCategoryPage(categoryId: string, page: number) {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  const param = categoryPageParam(categoryId);
  if (page <= 1) {
    url.searchParams.delete(param);
  } else {
    url.searchParams.set(param, String(page));
  }
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

function providerKindRank(kind: IntegrationProvider['kind']) {
  const index = CATEGORY_PROVIDER_KIND_ORDER.indexOf(kind);
  return index === -1 ? CATEGORY_PROVIDER_KIND_ORDER.length : index;
}

function providerGroupTitle(kind: IntegrationProvider['kind']) {
  switch (kind) {
    case 'model_provider':
      return 'Connections';
    case 'model_profile':
      return 'Model presets';
    case 'tool':
      return 'Tools';
    case 'mcp_server':
      return 'MCP servers';
    case 'runtime_adapter':
      return 'Runtime adapters';
    case 'planned':
      return 'Connectors';
    default:
      return formatDisplayLabel(kind);
  }
}

function providerGroupDescription(categoryId: string, kind: IntegrationProvider['kind']) {
  if (categoryId === 'custom') {
    switch (kind) {
      case 'tool':
        return 'Custom tools that agents can call directly.';
      case 'mcp_server':
        return 'Attached MCP servers exposed as tool surfaces.';
      case 'runtime_adapter':
        return 'Runtime boundaries and transport adapters used by custom integrations.';
      default:
        break;
    }
  }

  switch (kind) {
    case 'model_provider':
      return 'Saved provider endpoints, auth, and vendor-level configuration.';
    case 'model_profile':
      return 'Selectable model presets that agents and workflows can bind to.';
    case 'tool':
      return 'Callable tools and contracts available to the runtime.';
    case 'mcp_server':
      return 'Connected MCP servers and discovery targets.';
    case 'runtime_adapter':
      return 'Runtime-level adapters surfaced through the integrations inventory.';
    default:
      return null;
  }
}

type ProviderExplorerSection = {
  key: string;
  title: string;
  description: string | null;
  providers: IntegrationProvider[];
};

type PlannedProviderSectionEntry = {
  provider: IntegrationProvider;
  readinessState: PlannedProviderFilter;
};

type PlannedProviderSection = {
  name: string | null;
  providers: PlannedProviderSectionEntry[];
};

type CustomSemanticGroupDefinition = {
  key: string;
  title: string;
  description: string;
  matcher: (provider: IntegrationProvider, haystack: string) => boolean;
};

const CUSTOM_SEMANTIC_GROUPS: CustomSemanticGroupDefinition[] = [
  {
    key: 'workflow',
    title: 'Workflow',
    description: 'Workflow orchestration, automation steps, and execution tooling.',
    matcher: (provider, haystack) =>
      haystack.includes('workflow') ||
      haystack.includes('automation') ||
      haystack.includes('orchestr') ||
      provider.kind === 'runtime_adapter',
  },
  {
    key: 'graph',
    title: 'Graph',
    description: 'Knowledge graph, observability graph, and topology-aware tools.',
    matcher: (_provider, haystack) =>
      haystack.includes('graph') ||
      haystack.includes('sigma') ||
      haystack.includes('lineage') ||
      haystack.includes('topology'),
  },
  {
    key: 'document',
    title: 'Document',
    description: 'Document ingestion, file handling, extraction, and content transforms.',
    matcher: (_provider, haystack) =>
      haystack.includes('document') ||
      haystack.includes('file') ||
      haystack.includes('pdf') ||
      haystack.includes('doc') ||
      haystack.includes('sheet') ||
      haystack.includes('slide'),
  },
  {
    key: 'memory',
    title: 'Memory',
    description: 'Memory retrieval, storage, summaries, and long-term context operations.',
    matcher: (_provider, haystack) =>
      haystack.includes('memory') ||
      haystack.includes('retriev') ||
      haystack.includes('vector') ||
      haystack.includes('embedding') ||
      haystack.includes('context pack'),
  },
  {
    key: 'browser',
    title: 'Browser',
    description: 'Browser automation, page interaction, screenshots, and web session work.',
    matcher: (_provider, haystack) =>
      haystack.includes('browser') ||
      haystack.includes('playwright') ||
      haystack.includes('chrome') ||
      haystack.includes('screenshot') ||
      haystack.includes('dom'),
  },
  {
    key: 'network',
    title: 'Network',
    description: 'HTTP, APIs, MCP endpoints, remote transport, and external connectivity.',
    matcher: (provider, haystack) =>
      haystack.includes('http') ||
      haystack.includes('api') ||
      haystack.includes('network') ||
      haystack.includes('mcp') ||
      haystack.includes('webhook') ||
      provider.kind === 'mcp_server',
  },
];

function providerSemanticDocument(provider: IntegrationProvider) {
  const rawTool =
    provider.kind === 'tool' ? (provider.raw as unknown as ToolDefinition | undefined) : undefined;
  const rawTags = rawTool?.tags ?? [];
  const rawToolType = rawTool?.tool_type ? [rawTool.tool_type] : [];

  return [
    provider.id,
    provider.name,
    provider.description ?? '',
    provider.kind,
    ...(provider.capabilities ?? []),
    ...rawTags,
    ...rawToolType,
    ...provider.configFields.map((field) => field.key),
  ]
    .join('\n')
    .toLowerCase();
}

function buildCustomExplorerSections(providers: IntegrationProvider[]): ProviderExplorerSection[] {
  const groupedProviders = new Map<string, IntegrationProvider[]>();
  const matchedProviderIds = new Set<string>();

  providers.forEach((provider) => {
    const haystack = providerSemanticDocument(provider);
    const matches = CUSTOM_SEMANTIC_GROUPS.filter((group) => group.matcher(provider, haystack));

    if (matches.length === 0) {
      return;
    }

    matches.forEach((group) => {
      groupedProviders.set(group.key, [...(groupedProviders.get(group.key) ?? []), provider]);
      matchedProviderIds.add(provider.id);
    });
  });

  const semanticSections = CUSTOM_SEMANTIC_GROUPS.flatMap((group) => {
    const groupProviders = groupedProviders.get(group.key) ?? [];
    if (groupProviders.length === 0) {
      return [];
    }

    return [
      {
        key: group.key,
        title: group.title,
        description: group.description,
        providers: groupProviders,
      },
    ];
  });

  const unmatchedProviders = providers.filter((provider) => !matchedProviderIds.has(provider.id));

  if (unmatchedProviders.length === 0) {
    return semanticSections;
  }

  return [
    ...semanticSections,
    {
      key: 'general',
      title: 'General',
      description: 'Custom integrations that do not fit a narrower semantic bucket yet.',
      providers: unmatchedProviders,
    },
  ];
}

function buildSupportedExplorerSections(
  categoryId: string,
  providers: IntegrationProvider[]
): ProviderExplorerSection[] {
  if (categoryId === 'custom') {
    return buildCustomExplorerSections(providers);
  }

  const groups = new Map<IntegrationProvider['kind'], IntegrationProvider[]>();

  providers.forEach((provider) => {
    groups.set(provider.kind, [...(groups.get(provider.kind) ?? []), provider]);
  });

  return CATEGORY_PROVIDER_KIND_ORDER.flatMap((kind) => {
    const groupProviders = groups.get(kind) ?? [];
    if (groupProviders.length === 0) {
      return [];
    }

    return [
      {
        key: kind,
        title: providerGroupTitle(kind),
        description: providerGroupDescription(categoryId, kind),
        providers: groupProviders,
      },
    ];
  });
}

function providerSearchDocument(provider: IntegrationProvider) {
  return [
    provider.id,
    provider.name,
    provider.categoryId,
    provider.kind,
    provider.status,
    provider.description ?? '',
    ...(provider.capabilities ?? []),
    ...provider.configFields.flatMap((field) => [field.key, field.label, field.description ?? '']),
    ...provider.credentialStatus.refs.flatMap((reference) => [
      reference.name,
      reference.source ?? '',
      reference.description ?? '',
    ]),
    toStringValue(provider.raw),
  ]
    .join('\n')
    .toLowerCase();
}

function matchesProviderSearch(provider: IntegrationProvider, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return providerSearchDocument(provider).includes(normalized);
}

function paginateSectionCollections<T extends { providers: unknown[] }>(
  sections: T[],
  page: number
) {
  const totalItems = sections.reduce((sum, section) => sum + section.providers.length, 0);

  if (totalItems <= CATEGORY_PAGINATION_THRESHOLD) {
    return {
      sections,
      resolvedPage: 1,
      totalPages: 1,
      isPaginated: false,
      totalItems,
    };
  }

  const pages: T[][] = [];
  let currentPage: T[] = [];
  let currentCount = 0;

  sections.forEach((section) => {
    const sectionCount = section.providers.length;
    if (currentPage.length > 0 && currentCount + sectionCount > CATEGORY_PAGE_SIZE) {
      pages.push(currentPage);
      currentPage = [];
      currentCount = 0;
    }

    currentPage.push(section);
    currentCount += sectionCount;
  });

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  const totalPages = Math.max(1, pages.length);
  const resolvedPage = Math.min(Math.max(page, 1), totalPages);

  return {
    sections: pages[resolvedPage - 1] ?? [],
    resolvedPage,
    totalPages,
    isPaginated: true,
    totalItems,
  };
}

function sectionTargetPage<T extends { providers: unknown[] }>(
  sections: T[],
  sectionIndex: number
) {
  let targetPage = 1;
  let currentCount = 0;

  for (let index = 0; index <= sectionIndex; index += 1) {
    const sectionCount = sections[index]?.providers.length ?? 0;
    if (index > 0 && currentCount + sectionCount > CATEGORY_PAGE_SIZE) {
      targetPage += 1;
      currentCount = 0;
    }
    currentCount += sectionCount;
  }

  return targetPage;
}

function paginationSummaryLabel(totalItems: number, visibleItems: number, startIndex: number) {
  if (totalItems === 0 || visibleItems === 0 || startIndex <= 0) {
    return 'Showing 0 of 0';
  }

  const endIndex = Math.min(totalItems, startIndex + visibleItems - 1);
  return `Showing ${startIndex}-${endIndex} of ${totalItems}`;
}

function SectionJumpChips({
  sections,
  onJump,
}: {
  sections: Array<{ id: string; label: string; count: number; targetPage: number }>;
  onJump: (sectionId: string, targetPage: number) => void;
}) {
  if (sections.length <= 1) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {sections.map((section) => (
        <Button
          key={section.id}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onJump(section.id, section.targetPage)}
        >
          {section.label} ({section.count})
        </Button>
      ))}
    </div>
  );
}

function slugifyLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function categorySectionId(categoryId: string, sectionKey: string) {
  return `${categoryId}-section-${slugifyLabel(sectionKey)}`;
}

function scrollToCategorySection(sectionId: string) {
  const target = document.getElementById(sectionId);
  if (!target) {
    return;
  }

  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function schemaPropertyNames(schema: unknown): string[] {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return [];
  }
  const properties = (schema as { properties?: unknown }).properties;
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    return [];
  }
  return Object.keys(properties);
}

function ToolIntegrationSummary({
  provider,
  tool,
}: {
  provider: IntegrationProvider;
  tool?: ToolDefinition;
}) {
  const inputFields = schemaPropertyNames(tool?.input_schema);
  const outputFields = schemaPropertyNames(tool?.output_schema);
  const tags = tool?.tags ?? provider.capabilities ?? [];
  const theme = supportedCategoryTheme('custom');

  return (
    <div
      className={cn(
        'space-y-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4',
        theme.panelMuted
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-neutral-900 dark:text-slate-100">
            Tool capability
          </p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-slate-300">
            Read-only summary for workflow assignment. Agency keeps schema and implementation
            details behind the workflow and backend boundaries.
          </p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className={cn('rounded-lg border border-neutral-200 bg-white px-3 py-2', theme.panel)}>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400">
            Tool ID
          </p>
          <p className="mt-1 wrap-break-word text-sm text-neutral-900 dark:text-slate-100">
            {provider.id}
          </p>
        </div>
        <div className={cn('rounded-lg border border-neutral-200 bg-white px-3 py-2', theme.panel)}>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400">
            Type
          </p>
          <p className="mt-1 text-sm text-neutral-900 dark:text-slate-100">
            {formatDisplayLabel(tool?.tool_type) || 'Unknown'}
          </p>
        </div>
        <div className={cn('rounded-lg border border-neutral-200 bg-white px-3 py-2', theme.panel)}>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400">
            Inputs
          </p>
          <p className="mt-1 text-sm text-neutral-900 dark:text-slate-100">
            {inputFields.length > 0
              ? `${inputFields.length} field${inputFields.length === 1 ? '' : 's'}`
              : 'No declared fields'}
          </p>
          {inputFields.length > 0 ? (
            <p className="mt-1 line-clamp-2 text-xs text-neutral-500 dark:text-slate-400">
              {inputFields.join(', ')}
            </p>
          ) : null}
        </div>
        <div className={cn('rounded-lg border border-neutral-200 bg-white px-3 py-2', theme.panel)}>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400">
            Outputs
          </p>
          <p className="mt-1 text-sm text-neutral-900 dark:text-slate-100">
            {outputFields.length > 0
              ? `${outputFields.length} field${outputFields.length === 1 ? '' : 's'}`
              : 'Contract-defined result'}
          </p>
          {outputFields.length > 0 ? (
            <p className="mt-1 line-clamp-2 text-xs text-neutral-500 dark:text-slate-400">
              {outputFields.join(', ')}
            </p>
          ) : null}
        </div>
      </div>
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {formatDisplayLabel(tag)}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function toolPayloadFromForm(form: {
  name: string;
  description: string;
  toolType: string;
  implementationType: string;
  target: string;
  entrypoint: string;
  inputSchema: string;
  outputSchema: string;
  tags: string;
}) {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    tool_type: form.toolType,
    input_schema: parseJsonObject(form.inputSchema, 'Input schema'),
    output_schema: parseJsonObject(form.outputSchema, 'Output schema'),
    implementation: {
      implementation_type: form.implementationType,
      target: form.target.trim(),
      entrypoint: form.entrypoint.trim() || null,
    },
    tags: csvToList(form.tags),
  };
}

function CreateToolCard({ onCreated }: { onCreated: () => Promise<void> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    toolType: 'python_function',
    implementationType: 'python',
    target: '',
    entrypoint: '',
    inputSchema: '{\n  "type": "object",\n  "properties": {}\n}',
    outputSchema: '{}',
    tags: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const reset = () => {
    setForm({
      name: '',
      description: '',
      toolType: 'python_function',
      implementationType: 'python',
      target: '',
      entrypoint: '',
      inputSchema: '{\n  "type": "object",\n  "properties": {}\n}',
      outputSchema: '{}',
      tags: '',
    });
    setError(null);
  };

  const handleCreate = async () => {
    setError(null);
    setIsPending(true);
    try {
      await toolsApi.createTool(toolPayloadFromForm(form));
      await onCreated();
      toast.success('Tool created.', { position: 'top-right' });
      reset();
      setIsOpen(false);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create tool.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        className="agency-gradient text-white hover:brightness-105"
        onClick={() => setIsOpen(true)}
      >
        <Plus className="mr-2 h-4 w-4" />
        New tool
      </Button>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open && !isPending) {
            reset();
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New tool</DialogTitle>
            <DialogDescription>
              Create a canonical backend tool definition that agents and workflows can bind to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                  Name
                </label>
                <Input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                  Tool Type
                </label>
                <select
                  value={form.toolType}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, toolType: event.target.value }))
                  }
                  disabled={isPending}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {TOOL_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                Description
              </label>
              <Textarea
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                disabled={isPending}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                  Implementation Type
                </label>
                <select
                  value={form.implementationType}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, implementationType: event.target.value }))
                  }
                  disabled={isPending}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {IMPLEMENTATION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                  Target
                </label>
                <Input
                  value={form.target}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, target: event.target.value }))
                  }
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                  Entrypoint
                </label>
                <Input
                  value={form.entrypoint}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, entrypoint: event.target.value }))
                  }
                  disabled={isPending}
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                  Input Schema
                </label>
                <Textarea
                  className="min-h-35 font-mono text-xs"
                  value={form.inputSchema}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, inputSchema: event.target.value }))
                  }
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                  Output Schema
                </label>
                <Textarea
                  className="min-h-35 font-mono text-xs"
                  value={form.outputSchema}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, outputSchema: event.target.value }))
                  }
                  disabled={isPending}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                Tags
              </label>
              <Input
                value={form.tags}
                onChange={(event) =>
                  setForm((current) => ({ ...current, tags: event.target.value }))
                }
                disabled={isPending}
                placeholder="search, internal"
              />
            </div>
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              className="agency-gradient text-white hover:brightness-105"
              disabled={
                isPending || !form.name.trim() || !form.description.trim() || !form.target.trim()
              }
              onClick={handleCreate}
            >
              {isPending ? 'Creating...' : 'Create tool'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                reset();
                setIsOpen(false);
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CreateMcpServerCard({ onCreated }: { onCreated: () => Promise<void> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [transport, setTransport] = useState<(typeof MCP_TRANSPORT_TYPES)[number]>('stdio');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [url, setUrl] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const reset = () => {
    setName('');
    setTransport('stdio');
    setCommand('');
    setArgs('');
    setUrl('');
    setEnabled(false);
    setError(null);
  };

  const handleCreate = async () => {
    setError(null);
    setIsPending(true);
    try {
      const createdServer = await mcpServersApi.createMcpServer({
        name: name.trim(),
        transport,
        command: command.trim(),
        args: csvToList(args),
        url: url.trim() || null,
        enabled,
      });
      if (enabled) {
        try {
          await mcpServersApi.discover(createdServer.id);
        } catch (discoverError) {
          await onCreated();
          toast.error(
            `MCP server created, but discovery failed: ${
              discoverError instanceof Error ? discoverError.message : 'Unknown discovery error.'
            }`,
            { position: 'top-right' }
          );
          reset();
          setIsOpen(false);
          return;
        }
      }
      await onCreated();
      toast.success(enabled ? 'MCP server created and discovered.' : 'MCP server created.', {
        position: 'top-right',
      });
      reset();
      setIsOpen(false);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create MCP server.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setIsOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        New MCP server
      </Button>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open && !isPending) {
            reset();
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New MCP server</DialogTitle>
            <DialogDescription>
              Create a backend MCP server definition for tool discovery and runtime use.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                  Name
                </label>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                  Transport
                </label>
                <select
                  value={transport}
                  onChange={(event) =>
                    setTransport(event.target.value as (typeof MCP_TRANSPORT_TYPES)[number])
                  }
                  disabled={isPending}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {MCP_TRANSPORT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                  Command
                </label>
                <Input
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                  Args
                </label>
                <Input
                  value={args}
                  onChange={(event) => setArgs(event.target.value)}
                  disabled={isPending}
                  placeholder="--flag, value"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                URL
              </label>
              <Input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                disabled={isPending}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
                disabled={isPending}
              />
              Enabled
            </label>
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              className="agency-gradient text-white hover:brightness-105"
              disabled={isPending || !name.trim() || !command.trim()}
              onClick={handleCreate}
            >
              {isPending ? 'Creating...' : 'Create MCP server'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                reset();
                setIsOpen(false);
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ManageModelProfilesButton() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" asChild>
        <Link href="/models">
          <ArrowRight className="mr-2 h-4 w-4" />
          Manage models
        </Link>
      </Button>
    </div>
  );
}

type SupportedCategoryTheme = {
  summaryPrimary: 'default' | 'primary' | 'success' | 'warning';
  summarySecondary: 'default' | 'primary' | 'success' | 'warning';
  cardShell: string;
  sectionHeader: string;
  title: string;
  description: string;
  panel: string;
  panelMuted: string;
};

function supportedCategoryTheme(categoryId: string): SupportedCategoryTheme {
  const base: SupportedCategoryTheme = {
    summaryPrimary: 'primary',
    summarySecondary: 'success',
    cardShell:
      'dark:border-slate-300/14 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96)_0%,rgba(8,16,29,0.98)_100%)]',
    sectionHeader:
      'dark:border-slate-300/14 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(8,16,29,0.96))]',
    title: 'dark:text-slate-100',
    description: 'dark:text-slate-300',
    panel: 'dark:border-white/10 dark:bg-slate-950/72',
    panelMuted: 'dark:border-white/10 dark:bg-white/4',
  };

  const themes: Record<string, SupportedCategoryTheme> = {
    'llm-models': {
      ...base,
      cardShell:
        'dark:border-violet-300/22 dark:bg-[linear-gradient(180deg,rgba(31,27,54,0.97)_0%,rgba(12,20,36,0.98)_100%)]',
      sectionHeader:
        'dark:border-violet-300/18 dark:bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.18),transparent_34%),linear-gradient(135deg,rgba(21,18,38,0.96),rgba(9,18,32,0.98))]',
      title: 'dark:text-violet-50',
      description: 'dark:text-violet-100/80',
      panel: 'dark:border-violet-300/16 dark:bg-violet-500/8',
      panelMuted: 'dark:border-violet-300/14 dark:bg-violet-500/6',
    },
    custom: {
      ...base,
      summaryPrimary: 'success',
      summarySecondary: 'primary',
      cardShell:
        'dark:border-cyan-300/22 dark:bg-[linear-gradient(180deg,rgba(8,31,40,0.96)_0%,rgba(9,20,34,0.98)_100%)]',
      sectionHeader:
        'dark:border-cyan-300/18 dark:bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_34%),linear-gradient(135deg,rgba(8,31,40,0.96),rgba(9,18,32,0.98))]',
      title: 'dark:text-cyan-50',
      description: 'dark:text-cyan-100/78',
      panel: 'dark:border-cyan-300/16 dark:bg-cyan-500/[0.07]',
      panelMuted: 'dark:border-cyan-300/14 dark:bg-cyan-500/5',
    },
    communications: {
      ...base,
      cardShell:
        'dark:border-sky-300/22 dark:bg-[linear-gradient(180deg,rgba(11,31,55,0.97)_0%,rgba(8,18,33,0.98)_100%)]',
      sectionHeader:
        'dark:border-sky-300/18 dark:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_34%),linear-gradient(135deg,rgba(11,31,55,0.96),rgba(8,18,33,0.98))]',
      title: 'dark:text-sky-50',
      description: 'dark:text-sky-100/78',
    },
    productivity: {
      ...base,
      summaryPrimary: 'warning',
      cardShell:
        'dark:border-amber-300/22 dark:bg-[linear-gradient(180deg,rgba(48,34,14,0.96)_0%,rgba(16,22,31,0.98)_100%)]',
      sectionHeader:
        'dark:border-amber-300/18 dark:bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_34%),linear-gradient(135deg,rgba(48,34,14,0.94),rgba(10,18,31,0.98))]',
      title: 'dark:text-amber-50',
      description: 'dark:text-amber-100/78',
    },
    developer: {
      ...base,
      summaryPrimary: 'warning',
      cardShell:
        'dark:border-orange-300/22 dark:bg-[linear-gradient(180deg,rgba(52,26,15,0.96)_0%,rgba(14,20,31,0.98)_100%)]',
      sectionHeader:
        'dark:border-orange-300/18 dark:bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.16),transparent_34%),linear-gradient(135deg,rgba(52,26,15,0.94),rgba(10,18,31,0.98))]',
      title: 'dark:text-orange-50',
      description: 'dark:text-orange-100/78',
    },
    'media-creative': {
      ...base,
      cardShell:
        'dark:border-fuchsia-300/20 dark:bg-[linear-gradient(180deg,rgba(45,21,48,0.96)_0%,rgba(12,18,32,0.98)_100%)]',
      sectionHeader:
        'dark:border-fuchsia-300/18 dark:bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,0.15),transparent_34%),linear-gradient(135deg,rgba(45,21,48,0.94),rgba(10,18,31,0.98))]',
      title: 'dark:text-fuchsia-50',
      description: 'dark:text-fuchsia-100/78',
    },
    'home-tools': {
      ...base,
      summaryPrimary: 'success',
      cardShell:
        'dark:border-emerald-300/22 dark:bg-[linear-gradient(180deg,rgba(8,40,32,0.96)_0%,rgba(8,19,33,0.98)_100%)]',
      sectionHeader:
        'dark:border-emerald-300/18 dark:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.15),transparent_34%),linear-gradient(135deg,rgba(8,40,32,0.94),rgba(9,18,32,0.98))]',
      title: 'dark:text-emerald-50',
      description: 'dark:text-emerald-100/78',
    },
    'search-knowledge': {
      ...base,
      summaryPrimary: 'warning',
      cardShell:
        'dark:border-orange-300/22 dark:bg-[linear-gradient(180deg,rgba(47,30,13,0.96)_0%,rgba(10,18,31,0.98)_100%)]',
      sectionHeader:
        'dark:border-orange-300/18 dark:bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.14),transparent_34%),linear-gradient(135deg,rgba(47,30,13,0.94),rgba(10,18,31,0.98))]',
      title: 'dark:text-orange-50',
      description: 'dark:text-orange-100/78',
    },
    storage: {
      ...base,
      cardShell:
        'dark:border-blue-300/22 dark:bg-[linear-gradient(180deg,rgba(12,31,58,0.96)_0%,rgba(8,18,33,0.98)_100%)]',
      sectionHeader:
        'dark:border-blue-300/18 dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_34%),linear-gradient(135deg,rgba(12,31,58,0.94),rgba(8,18,33,0.98))]',
      title: 'dark:text-blue-50',
      description: 'dark:text-blue-100/78',
    },
  };

  return themes[categoryId] ?? base;
}

function isEmbeddingModelProfile(profile?: ModelProfileDefinition) {
  if (!profile) {
    return false;
  }
  const haystack = `${profile.name} ${profile.model} ${profile.description ?? ''}`.toLowerCase();
  return (
    haystack.includes('embed') ||
    haystack.includes('nomic') ||
    haystack.includes('mxbai') ||
    profile.parameters?.embedding_dimensions !== undefined
  );
}

function LlmPresetSummary({ preset }: { preset: IntegrationProvider }) {
  const rawProfile = preset.raw as unknown as ModelProfileDefinition | undefined;
  const capabilities = preset.capabilities ?? [];
  const embeddingReady = isEmbeddingModelProfile(rawProfile);
  const cue = integrationStatusCue(preset.status);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border px-3 py-2 shadow-sm shadow-black/5 dark:shadow-none',
        cue.card
      )}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', cue.accent)} />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="pl-2">
          <p className="text-sm font-medium text-neutral-900 dark:text-slate-100">{preset.name}</p>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-slate-300">
            {rawProfile?.model ?? 'No model id set'}
          </p>
        </div>
        <Badge variant={statusVariant(preset.status)} className={cue.badge}>
          {providerStatusLabel(preset.status)}
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 pl-2">
        {rawProfile?.temperature !== null && rawProfile?.temperature !== undefined ? (
          <Badge variant="outline">Temp {rawProfile.temperature}</Badge>
        ) : null}
        {rawProfile?.max_tokens !== null && rawProfile?.max_tokens !== undefined ? (
          <Badge variant="outline">Max {rawProfile.max_tokens}</Badge>
        ) : null}
        {capabilities.map((capability) => (
          <Badge key={capability} variant="outline">
            {capability}
          </Badge>
        ))}
        {embeddingReady ? <Badge variant="successful">Memory embedding candidate</Badge> : null}
      </div>
    </div>
  );
}

function LlmModelsInventoryPanel({ category }: { category: IntegrationCategory }) {
  const theme = supportedCategoryTheme(category.id);
  const connections = category.providers
    .filter((provider) => provider.kind === 'model_provider')
    .map((provider) => ({
      provider,
      raw: provider.raw as unknown as ModelProviderDefinition | undefined,
    }));
  const presets = category.providers.filter((provider) => provider.kind === 'model_profile');
  const connectionIds = new Set(connections.map(({ provider }) => provider.id));
  const unlinkedPresets = presets.filter((preset) => {
    const rawProfile = preset.raw as unknown as ModelProfileDefinition | undefined;
    return !rawProfile?.provider || !connectionIds.has(rawProfile.provider);
  });
  const embeddingPresetCount = presets.filter((preset) =>
    isEmbeddingModelProfile(preset.raw as unknown as ModelProfileDefinition | undefined)
  ).length;

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'flex items-start justify-between gap-3 rounded-2xl border border-neutral-200 bg-white/90 p-4 shadow-sm dark:shadow-none',
          theme.sectionHeader
        )}
      >
        <div>
          <h2 className={cn('text-xl font-semibold text-neutral-900', theme.title)}>
            {category.name}
          </h2>
          <p className={cn('mt-1 text-sm text-neutral-500', theme.description)}>
            Agent configuration starts here: provider connections hold endpoint/auth, model presets
            bind agents, and embedding presets can power memory retrieval.
          </p>
        </div>
        <ManageModelProfilesButton />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div
          className={cn(
            'rounded-lg border border-neutral-200 bg-white px-4 py-3',
            theme.panelMuted
          )}
        >
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400">
            Connections
          </p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-slate-100">
            {connections.length}
          </p>
        </div>
        <div
          className={cn(
            'rounded-lg border border-neutral-200 bg-white px-4 py-3',
            theme.panelMuted
          )}
        >
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400">
            Model presets
          </p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-slate-100">
            {presets.length}
          </p>
        </div>
        <div
          className={cn(
            'rounded-lg border border-neutral-200 bg-white px-4 py-3',
            theme.panelMuted
          )}
        >
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400">
            Memory candidates
          </p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-slate-100">
            {embeddingPresetCount}
          </p>
        </div>
      </div>

      {connections.length === 0 ? (
        <EmptyCard
          title="No LLM connections found"
          description="Create a model to add a provider connection and first model preset."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {connections.map(({ provider, raw }) => {
            const linkedPresets = presets.filter((preset) => {
              const rawProfile = preset.raw as unknown as ModelProfileDefinition | undefined;
              return rawProfile?.provider === provider.id;
            });
            const baseUrl = raw?.endpoint?.base_url;
            const providerFamily =
              typeof raw?.config?.provider_family === 'string'
                ? raw.config.provider_family
                : raw?.provider_type;
            const hasConfigApiKey = Boolean(raw?.config?.api_key);
            const cue = integrationStatusCue(provider.status);

            return (
              <Card
                key={provider.id}
                className={cn('relative overflow-hidden', cue.card, theme.cardShell)}
              >
                <span className={cn('absolute inset-x-0 top-0 h-1', cue.accent)} />
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg dark:text-slate-100">{provider.name}</CardTitle>
                      <CardDescription className="dark:text-slate-300">
                        {provider.description || 'LLM provider connection'}
                      </CardDescription>
                    </div>
                    <Badge variant={statusVariant(provider.status)} className={cue.badge}>
                      {providerStatusLabel(provider.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{raw?.provider_type ?? provider.kind}</Badge>
                    {providerFamily ? <Badge variant="outline">{providerFamily}</Badge> : null}
                    <Badge variant="outline">
                      {linkedPresets.length} preset{linkedPresets.length === 1 ? '' : 's'}
                    </Badge>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div
                      className={cn(
                        'rounded-md border border-neutral-200 bg-white px-3 py-2',
                        theme.panel
                      )}
                    >
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400">
                        Endpoint
                      </p>
                      <p className="mt-1 wrap-break-word text-sm text-neutral-800 dark:text-slate-100">
                        {baseUrl || 'Not set'}
                      </p>
                    </div>
                    <div
                      className={cn(
                        'rounded-md border border-neutral-200 bg-white px-3 py-2',
                        theme.panel
                      )}
                    >
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400">
                        Credentials
                      </p>
                      <p className="mt-1 text-sm text-neutral-800 dark:text-slate-100">
                        {provider.credentialStatus.refs.length > 0 || hasConfigApiKey
                          ? 'Configured'
                          : provider.credentialStatus.message}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400">
                      Model presets
                    </p>
                    {linkedPresets.length > 0 ? (
                      <div className="space-y-2">
                        {linkedPresets.map((preset) => (
                          <LlmPresetSummary key={preset.id} preset={preset} />
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed border-neutral-300 bg-white px-3 py-3 text-sm text-neutral-500 dark:border-white/10 dark:bg-slate-950/72 dark:text-slate-400">
                        No model presets are attached to this connection yet.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {unlinkedPresets.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-400/25 dark:bg-amber-500/10">
          <CardHeader>
            <CardTitle className="text-lg dark:text-amber-100">Unlinked model presets</CardTitle>
            <CardDescription className="dark:text-amber-200">
              These presets reference a provider id that is not currently present in the connection
              list.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {unlinkedPresets.map((preset) => (
              <LlmPresetSummary key={preset.id} preset={preset} />
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function priorityLabel(priority?: PlannedIntegrationDefinition['launchPriority']) {
  switch (priority) {
    case 'now':
      return 'Now';
    case 'next':
      return 'Next';
    default:
      return 'Later';
  }
}

type PlannedProviderFilter = 'all' | 'needs-setup' | 'healthy' | 'failing' | 'never-tested';

function plannedProviderReadinessState(
  provider: IntegrationProvider,
  latestHistoryStatus: string | null
): Exclude<PlannedProviderFilter, 'all'> {
  const planned = provider.raw as PlannedIntegrationState | undefined;
  const hasCredentials = (planned?.matchedCredentialIds.length ?? 0) > 0;

  if (!hasCredentials) {
    return 'needs-setup';
  }
  if (latestHistoryStatus === 'completed') {
    return 'healthy';
  }
  if (latestHistoryStatus === 'failed') {
    return 'failing';
  }
  return 'never-tested';
}

function plannedProviderPriorityValue(state: Exclude<PlannedProviderFilter, 'all'>) {
  switch (state) {
    case 'failing':
      return 0;
    case 'needs-setup':
      return 1;
    case 'never-tested':
      return 2;
    case 'healthy':
      return 3;
    default:
      return 4;
  }
}

function plannedCategoryFilterParam(categoryId: string) {
  return `planned-filter-${categoryId}`;
}

function readPlannedCategoryFilter(categoryId: string): PlannedProviderFilter {
  if (typeof window === 'undefined') {
    return 'all';
  }

  const value = new URLSearchParams(window.location.search).get(
    plannedCategoryFilterParam(categoryId)
  );
  if (
    value === 'needs-setup' ||
    value === 'healthy' ||
    value === 'failing' ||
    value === 'never-tested'
  ) {
    return value;
  }
  return 'all';
}

function persistPlannedCategoryFilter(categoryId: string, filter: PlannedProviderFilter) {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  const param = plannedCategoryFilterParam(categoryId);
  if (filter === 'all') {
    url.searchParams.delete(param);
  } else {
    url.searchParams.set(param, filter);
  }
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

function readIntegrationTabParam() {
  if (typeof window === 'undefined') {
    return null;
  }

  return new URLSearchParams(window.location.search).get('integration-tab');
}

function persistIntegrationTabParam(categoryId: string) {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set('integration-tab', categoryId);
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

function writeIntegrationTabParam(categoryId: string) {
  persistIntegrationTabParam(categoryId);
  return categoryId;
}

function readIntegrationConnectorParam() {
  if (typeof window === 'undefined') {
    return null;
  }

  return new URLSearchParams(window.location.search).get('integration-connector');
}

function readIntegrationConnectorActionParam() {
  if (typeof window === 'undefined') {
    return null;
  }

  return new URLSearchParams(window.location.search).get('connector-action');
}

function readOperationsFilterParam(): OperationsFilter {
  if (typeof window === 'undefined') {
    return 'all';
  }

  const value = new URLSearchParams(window.location.search).get('operations-filter');
  if (value === 'failing' || value === 'healthy' || value === 'never-tested') {
    return value;
  }

  return 'all';
}

function persistIntegrationConnectorParam(connectorId: string | null) {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  if (connectorId) {
    url.searchParams.set('integration-connector', connectorId);
  } else {
    url.searchParams.delete('integration-connector');
  }
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

function writeIntegrationConnectorParam(connectorId: string | null) {
  persistIntegrationConnectorParam(connectorId);
  return connectorId;
}

function persistOperationsFilterParam(filter: OperationsFilter) {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  if (filter === 'all') {
    url.searchParams.delete('operations-filter');
  } else {
    url.searchParams.set('operations-filter', filter);
  }
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

function latestConnectorHistoryByCredential(items: ConnectorHealthHistoryPayload['items']) {
  const latestByCredentialId = new Map<string, ConnectorHealthHistoryPayload['items'][number]>();

  items.forEach((item) => {
    if (!latestByCredentialId.has(item.credentialId)) {
      latestByCredentialId.set(item.credentialId, item);
    }
  });

  return latestByCredentialId;
}

function connectorOperationsState(status?: string | null): Exclude<OperationsFilter, 'all'> {
  if (status === 'completed') {
    return 'healthy';
  }
  if (status === 'failed') {
    return 'failing';
  }
  return 'never-tested';
}

function plannedReadinessLabel(state: PlannedProviderFilter) {
  switch (state) {
    case 'healthy':
      return 'Healthy';
    case 'failing':
      return 'Failing';
    case 'never-tested':
      return 'Not Tested';
    case 'needs-setup':
      return 'Need Setup';
    default:
      return state;
  }
}

function plannedReadinessBadgeVariant(
  state: PlannedProviderFilter
): 'successful' | 'failed' | 'outline' | 'secondary' {
  switch (state) {
    case 'healthy':
      return 'successful';
    case 'failing':
      return 'failed';
    case 'never-tested':
      return 'outline';
    case 'needs-setup':
      return 'secondary';
    default:
      return 'outline';
  }
}

function plannedReadinessCue(state: PlannedProviderFilter) {
  switch (state) {
    case 'healthy':
      return {
        accent: 'bg-success-500',
        badge:
          'border-success-200 bg-success-50 text-success-800 dark:border-emerald-400/30 dark:bg-emerald-500/12 dark:text-emerald-100',
        card: 'border-success-200 bg-success-50/30 dark:border-emerald-400/35 dark:bg-emerald-500/10',
      };
    case 'failing':
      return {
        accent: 'bg-destructive-500',
        badge:
          'border-destructive-200 bg-destructive-50 text-destructive-800 dark:border-red-400/30 dark:bg-red-500/12 dark:text-red-100',
        card: 'border-destructive-200 bg-destructive-50/25 dark:border-red-400/35 dark:bg-red-500/10',
      };
    case 'needs-setup':
      return {
        accent: 'bg-warning-400',
        badge:
          'border-warning-200 bg-warning-50 text-warning-900 dark:border-amber-300/35 dark:bg-amber-400/12 dark:text-amber-100',
        card: 'border-warning-200 bg-warning-50/35 dark:border-amber-300/35 dark:bg-amber-400/10',
      };
    case 'never-tested':
      return {
        accent: 'bg-primary-500',
        badge:
          'border-primary-200 bg-primary-50 text-primary-800 dark:border-sky-400/35 dark:bg-sky-500/12 dark:text-sky-100',
        card: 'border-primary-200 bg-primary-50/25 dark:border-sky-400/35 dark:bg-sky-500/10',
      };
    default:
      return {
        accent: 'bg-neutral-400',
        badge:
          'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-slate-400/25 dark:bg-slate-400/10 dark:text-slate-100',
        card: 'border-neutral-200 bg-neutral-50/60 dark:border-white/10 dark:bg-white/3',
      };
  }
}

function openIntegrationConnector(categoryId: string, connectorId: string) {
  persistIntegrationTabParam(categoryId);
  persistIntegrationConnectorParam(connectorId);
}

function CategoryPagination({
  categoryId,
  currentPage,
  totalPages,
  totalItems,
  onChange,
}: {
  categoryId: string;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="mb-24 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white/90 px-4 py-3 pr-24 shadow-sm dark:border-white/10 dark:bg-slate-950/70 dark:shadow-none md:pr-28">
      <p className="text-sm text-neutral-500 dark:text-slate-300">
        {totalItems} integration{totalItems === 1 ? '' : 's'} across {totalPages} pages.
      </p>
      <p className="text-sm text-neutral-500 dark:text-slate-300">
        Page {currentPage} of {totalPages}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          Previous
        </Button>
        <Button
          type="button"
          data-testid={`category-next-page-${categoryId}`}
          variant="outline"
          size="sm"
          onClick={() => onChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function CategorySummaryTile({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  tone?: 'default' | 'primary' | 'success' | 'warning';
}) {
  const toneClassName = {
    default: 'border-neutral-200 bg-white/85 dark:border-white/10 dark:bg-white/4',
    primary: 'border-primary-200 bg-primary-50/80 dark:border-sky-400/25 dark:bg-sky-500/10',
    success:
      'border-emerald-200 bg-emerald-50/80 dark:border-emerald-400/25 dark:bg-emerald-500/10',
    warning: 'border-amber-200 bg-amber-50/85 dark:border-amber-300/25 dark:bg-amber-400/10',
  }[tone];

  return (
    <div className={cn('rounded-2xl border px-4 py-3 shadow-sm dark:shadow-none', toneClassName)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-neutral-950 dark:text-slate-50">{value}</p>
    </div>
  );
}

function fallbackConnectorCapability(
  provider: IntegrationProvider,
  planned?: PlannedIntegrationState
): ConnectorCapabilityDefinition {
  return (
    FALLBACK_CONNECTOR_METADATA[planned?.backendKey ?? ''] ?? {
      backendKey: planned?.backendKey ?? '',
      displayName: provider.name,
      authModel: planned?.authModel ?? '',
      providerAliases: planned?.providerAliases ?? [],
      healthSupported: false,
      requiredMetadata: [],
      instanceIdentityMetadata: [],
      supportedSecretRefSchemes: ['onecli://', 'env://', 'env:'],
    }
  );
}

function plannedProviderSectionName(provider: IntegrationProvider) {
  const backendKey = (provider.raw as PlannedIntegrationState | undefined)?.backendKey;
  if (['twilio-sms'].includes(backendKey ?? '')) {
    return 'SMS & voice';
  }
  if (['gmail', 'outlook-email'].includes(backendKey ?? '')) {
    return 'Email';
  }
  if (
    ['telegram-bot', 'whatsapp-cloud-api', 'discord-bot', 'slack-app', 'microsoft-teams'].includes(
      backendKey ?? ''
    )
  ) {
    return 'Messaging & chat';
  }
  return null;
}

function communicationsSectionDescription(sectionName: string) {
  switch (sectionName) {
    case 'Messaging & chat':
      return 'Bot, workspace, and chat-surface connectors for conversational use.';
    case 'SMS & voice':
      return 'Phone-number based delivery and escalation channels.';
    case 'Email':
      return 'Mailbox connectors for triage, drafts, outbound replies, and digests.';
    default:
      return 'Communication connectors available for Agency setup.';
  }
}

function groupPlannedProvidersBySection(
  categoryId: string,
  providers: PlannedProviderSectionEntry[]
): PlannedProviderSection[] {
  if (categoryId !== 'communications') {
    return [{ name: null, providers }];
  }

  const sectionOrder = ['Messaging & chat', 'SMS & voice', 'Email'];
  const groups = new Map<string, PlannedProviderSectionEntry[]>();

  providers.forEach((entry) => {
    const sectionName = plannedProviderSectionName(entry.provider) ?? 'Other';
    groups.set(sectionName, [...(groups.get(sectionName) ?? []), entry]);
  });

  return [
    ...sectionOrder
      .map((name) => ({ name, providers: groups.get(name) ?? [] }))
      .filter((group) => group.providers.length > 0),
    ...Array.from(groups.entries())
      .filter(([name]) => !sectionOrder.includes(name))
      .map(([name, sectionProviders]) => ({ name, providers: sectionProviders })),
  ];
}

function PlannedProviderCard({
  provider,
  onRefresh,
  onConnectorTestResult,
  isSelected,
  onSelect,
  readinessState,
  onecliUserNamespace,
  capabilityOverride,
  autoOpenSetup,
}: {
  provider: IntegrationProvider;
  onRefresh: () => Promise<void>;
  onConnectorTestResult: (credentialId: string, result: Record<string, unknown>) => void;
  isSelected: boolean;
  onSelect: (connectorId: string) => void;
  readinessState: PlannedProviderFilter;
  onecliUserNamespace: string;
  capabilityOverride?: ConnectorCapabilityDefinition | null;
  autoOpenSetup?: boolean;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();
  const planned = provider.raw as PlannedIntegrationState | undefined;
  const backendKey = planned?.backendKey ?? '';
  const matchedCredentialIds = useMemo(
    () => planned?.matchedCredentialIds ?? [],
    [planned?.matchedCredentialIds]
  );
  const matchedCredentials = planned?.matchedCredentials ?? [];
  const [selectedCredentialId, setSelectedCredentialId] = useState(matchedCredentialIds[0] ?? '');
  const matchedCredentialId =
    selectedCredentialId && matchedCredentialIds.includes(selectedCredentialId)
      ? selectedCredentialId
      : matchedCredentialIds[0] || null;
  const hasCredentials = matchedCredentialIds.length > 0;
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(provider.name);
  const [setupSession, setSetupSession] = useState<ConnectorSetupSessionPayload | null>(null);
  const [setupMode, setSetupMode] = useState<ConnectorSetupMode>('new');
  const [metadataValues, setMetadataValues] = useState<Record<string, string>>({});
  const [runtimeSecretValue, setRuntimeSecretValue] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastHealthResult, setLastHealthResult] = useState<Record<string, unknown> | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [smartHomePreviewOpen, setSmartHomePreviewOpen] = useState(false);
  const [smartHomePreviewDomain, setSmartHomePreviewDomain] = useState('');
  const isUpdateMode = setupMode === 'update' && Boolean(matchedCredentialId);
  const autoOpenedSetupRef = useRef(false);

  const schemaQuery = useQuery({
    queryKey: ['connectorCredentialSchema', backendKey],
    queryFn: (): Promise<ConnectorCapabilityDefinition> =>
      credentialsApi.getConnectorCredentialSchema(backendKey),
    enabled: Boolean(backendKey) && !capabilityOverride && (hasCredentials || isOpen),
    retry: false,
  });

  const smartHomeAvailabilityQuery = useQuery({
    queryKey: queryKeys.backendSmartHomeAvailability(),
    queryFn: () => smartHomeApi.getAvailability(),
    enabled: backendKey === 'home-assistant',
    staleTime: 60 * 1000,
    retry: 1,
  });
  const smartHomeAvailable = smartHomeAvailabilityQuery.data?.available !== false;

  const smartHomeEntitiesQuery = useQuery({
    queryKey: ['homeAssistantEntitiesPreview', smartHomePreviewDomain],
    queryFn: (): Promise<SmartHomeEntityListPayload> =>
      smartHomeApi.listEntities({
        domain: smartHomePreviewDomain.trim() || undefined,
      }),
    enabled: backendKey === 'home-assistant' && smartHomePreviewOpen && smartHomeAvailable,
    retry: false,
  });

  const existingCredentialQuery = useQuery({
    queryKey: ['connectorCredential', matchedCredentialId],
    queryFn: (): Promise<CredentialDefinition> =>
      credentialsApi.getCredential(matchedCredentialId as string),
    enabled: false,
    retry: false,
  });

  const historyQuery = useQuery({
    queryKey: ['connectorHistory', matchedCredentialId],
    queryFn: (): Promise<ConnectorHealthHistoryPayload> =>
      connectorsApi.getConnectorHistory(matchedCredentialId as string),
    enabled: Boolean(matchedCredentialId),
    retry: false,
  });

  const installationsQuery = useQuery({
    queryKey: ['connectorInstallations'],
    queryFn: () => connectorsApi.listConnectorInstallations(),
    enabled: Boolean(backendKey),
    retry: false,
    staleTime: 5000,
  });
  const providerInstallation: ConnectorInstallationDefinition | null =
    installationsQuery.data?.items.find(
      (installation) =>
        installation.provider === backendKey &&
        !['revoked', 'disabled'].includes(installation.status)
    ) ?? null;
  const sessionInstallation: ConnectorInstallationDefinition | null = setupSession
    ? (installationsQuery.data?.items.find(
        (installation) => installation.id === setupSession.installation.id
      ) ?? setupSession.installation)
    : null;
  const latestInstallation: ConnectorInstallationDefinition | null =
    sessionInstallation ?? (setupMode === 'new' && hasCredentials ? null : providerInstallation);
  const setupSessionCompleted = latestInstallation?.status === 'active';
  const completionAvailable = canCompleteConnectorInstallation(latestInstallation);

  const metadataPayload = () =>
    Object.fromEntries(
      Object.entries(metadataValues)
        .map(([key, value]) => [key, value.trim()])
        .filter(([, value]) => Boolean(value))
    );

  const openSetupDialog = useCallback(
    async (mode: ConnectorSetupMode = hasCredentials ? 'update' : 'new') => {
      setSetupMode(mode);
      setIsOpen(true);
      setSaveError(null);
      setSetupSession(null);
      setRuntimeSecretValue('');

      const [schemaResult, existingCredentialResult] = await Promise.all([
        backendKey ? schemaQuery.refetch() : Promise.resolve({ data: null }),
        mode === 'update' && matchedCredentialId
          ? existingCredentialQuery.refetch()
          : Promise.resolve({ data: null }),
      ]);

      const existingCredential = existingCredentialResult.data ?? null;
      const capability = schemaResult.data ?? fallbackConnectorCapability(provider, planned);
      const metadataFields = mergeMetadataRequirements(
        capability.requiredMetadata,
        capability.instanceIdentityMetadata,
        PRODUCTION_WEBHOOK_METADATA[backendKey] ?? []
      );
      const sourceMetadata = existingCredential?.metadata ?? {};

      setName(existingCredential?.name ?? provider.name);
      setMetadataValues(
        Object.fromEntries(
          metadataFields.map((requirement) => [
            requirement.key,
            toStringValue(sourceMetadata[requirement.key]),
          ])
        )
      );
    },
    [
      backendKey,
      existingCredentialQuery,
      hasCredentials,
      matchedCredentialId,
      planned,
      provider,
      schemaQuery,
    ]
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      setSaveError(null);
      const metadata = metadataPayload();
      const payload = {
        provider: backendKey,
        name: name.trim(),
        metadata,
      };
      // Configured providers can have more than one installation; update mode edits the matched
      // credential while new mode always starts a separate OneCLI setup session.
      if (isUpdateMode && matchedCredentialId) {
        return credentialsApi.updateConnectorCredential(matchedCredentialId, payload);
      }
      return connectorsApi.createConnectorSetupSession(backendKey, payload);
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.backendIntegrations() });
      await queryClient.invalidateQueries({ queryKey: ['connectorInstallations'] });
      await onRefresh();
      if (isConnectorSetupSessionPayload(result)) {
        setSetupSession(result);
        toast.success('OneCLI setup session created.', { position: 'top-right' });
        return;
      }
      toast.success('Connector credential updated.', { position: 'top-right' });
      setIsOpen(false);
    },
    onError: (error) => {
      if (isApiError(error) && error.status === 404) {
        setSaveError(
          'Connector setup is not available from the running Open Agency backend yet. Restart the backend and try again.'
        );
        return;
      }
      setSaveError(error instanceof Error ? error.message : 'Failed to save connector credential.');
    },
  });

  const completeInstallationMutation = useMutation({
    mutationFn: async () => {
      if (!latestInstallation) {
        throw new Error('No connector installation is available to complete.');
      }

      setSaveError(null);
      const payload: Record<string, unknown> = {
        // Completion confirms the OneCLI-side secret exists; direct mode also mirrors the raw
        // provider secret into Agency so runtime delivery can stay off the OneCLI proxy path.
        onecli_credential_ref: latestInstallation.onecli_credential_ref,
        metadata: metadataPayload(),
      };
      if (directTransportRequiresRuntimeSecret) {
        payload.runtime_secret_value = runtimeSecretValue.trim();
      }
      return connectorsApi.completeConnectorInstallation(latestInstallation.id, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.backendIntegrations() });
      await queryClient.invalidateQueries({ queryKey: ['connectorInstallations'] });
      await installationsQuery.refetch();
      await onRefresh();
      toast.success('Connector setup completed.', { position: 'top-right' });
      setIsOpen(false);
    },
    onError: (error) => {
      setSaveError(error instanceof Error ? error.message : 'Failed to complete connector setup.');
    },
  });

  const healthMutation = useMutation({
    mutationFn: async () => {
      if (!matchedCredentialId) {
        throw new Error('No saved backend credential is available for this connector yet.');
      }
      return connectorsApi.testConnector(matchedCredentialId);
    },
    onSuccess: (result) => {
      setLastHealthResult(result);
      if (matchedCredentialId) {
        onConnectorTestResult(matchedCredentialId, result);
      }
      void queryClient.invalidateQueries({ queryKey: ['aggregateConnectorHistory'] });
      void historyQuery.refetch();
      toast.success('Connector test completed.', { position: 'top-right' });
    },
    onError: (error) => {
      const result = {
        ok: false,
        error: error instanceof Error ? error.message : 'Connector test failed.',
      };
      setLastHealthResult(result);
      if (matchedCredentialId) {
        onConnectorTestResult(matchedCredentialId, result);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDeleteInstallationId) {
        throw new Error('No connector instance is selected for deletion.');
      }

      return connectorsApi.deleteConnectorInstallation(selectedDeleteInstallationId);
    },
    onSuccess: async () => {
      setDeleteMode(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['connectorInstallations'] }),
        queryClient.invalidateQueries({
          queryKey: ['connectorHistory', matchedCredentialId ?? ''],
        }),
        queryClient.invalidateQueries({ queryKey: ['aggregateConnectorHistory'] }),
        onRefresh(),
      ]);
      toast.success('Connector instance deleted.', { position: 'top-right' });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to delete connector instance.', {
        position: 'top-right',
      });
    },
  });

  const effectiveCapability: ConnectorCapabilityDefinition =
    capabilityOverride ?? schemaQuery.data ?? fallbackConnectorCapability(provider, planned);
  const onecliSetupGuide =
    effectiveCapability.onecliSetupGuide ?? buildFallbackOneCLISetupGuide(provider, planned);
  const onecliTransportMode = effectiveCapability.onecliTransportMode ?? 'proxy';
  const directTransportRequiresRuntimeSecret = onecliTransportMode === 'direct';
  const onecliStoragePath = resolveOneCLIStoragePath(
    onecliSetupGuide.storagePath,
    onecliUserNamespace
  );
  const requiredMetadata = effectiveCapability.requiredMetadata ?? [];
  const capabilitySurface = effectiveCapability.capabilitySurface ?? 'connector';
  const moduleCapabilities = effectiveCapability.moduleCapabilities ?? [];
  const agencyCapabilityDependencies = effectiveCapability.dependsOnAgencyCapabilities ?? [];
  const ownershipNotes = effectiveCapability.ownershipNotes ?? [];
  const instanceIdentityMetadata = mergeMetadataRequirements(
    effectiveCapability.instanceIdentityMetadata
  ).filter((requirement) => !requiredMetadata.some((required) => required.key === requirement.key));
  const productionWebhookMetadata = (PRODUCTION_WEBHOOK_METADATA[backendKey] ?? []).filter(
    (requirement) =>
      !requiredMetadata.some((required) => required.key === requirement.key) &&
      !instanceIdentityMetadata.some((identity) => identity.key === requirement.key)
  );
  const missingRequiredMetadata = requiredMetadata.some(
    (requirement) => !(metadataValues[requirement.key] ?? '').trim()
  );
  const missingProductionWebhookMetadata = productionWebhookMetadata.some((requirement) => {
    const keys = [requirement.key, ...(requirement.alternatives ?? [])];
    return !keys.some((key) => (metadataValues[key] ?? '').trim());
  });
  const runtimeSecretValueReady =
    !directTransportRequiresRuntimeSecret || Boolean(runtimeSecretValue.trim());
  const healthSupported = Boolean(effectiveCapability.healthSupported);
  const historyItems = historyQuery.data?.items ?? [];
  const persistedHealthResult =
    !lastHealthResult && historyItems.length > 0
      ? {
          ok: historyItems[0].status === 'completed',
          error: historyItems[0].error ?? null,
          audit_execution_id: historyItems[0].executionId,
        }
      : null;
  const effectiveLastHealthResult = lastHealthResult ?? persistedHealthResult;
  const lastHealthOk = effectiveLastHealthResult?.ok === true;
  const cardReadinessState = historyItems[0]
    ? plannedProviderReadinessState(provider, historyItems[0].status)
    : readinessState;
  const canStartSetup = Boolean(name.trim());
  const onecliGenericSecretGuide = buildOneCLIGenericSecretGuide(
    provider,
    backendKey,
    onecliStoragePath,
    setupSession,
    onecliSetupGuide.fields,
    onecliSetupGuide.notes ?? []
  );
  const onecliCopyRows = onecliGenericSecretGuide.rows.filter((row) => Boolean(row.value));
  const setupUrl = setupSession ? normalizeOneCLISetupUrl(setupSession.setup_url) : null;
  const readinessCue = plannedReadinessCue(cardReadinessState);
  const selectedCredential =
    matchedCredentials.find((credential) => credential.id === matchedCredentialId) ??
    matchedCredentials[0] ??
    null;
  const selectedInstallation =
    selectedCredential?.secret_ref && installationsQuery.data?.items
      ? (installationsQuery.data.items.find(
          (installation) => installation.onecli_credential_ref === selectedCredential.secret_ref
        ) ?? null)
      : null;
  const selectedDeleteInstallationId = selectedInstallation?.id ?? latestInstallation?.id ?? null;
  const selectedCredentialMetadata = selectedCredential?.metadata ?? {};
  const selectedIdentityFields = instanceIdentityMetadata.filter((requirement) =>
    Boolean(toStringValue(selectedCredentialMetadata[requirement.key]).trim())
  );
  const agentSelectionHint = selectedIdentityFields
    .slice(0, 3)
    .map(
      (requirement) =>
        `${requirement.key}: ${toStringValue(selectedCredentialMetadata[requirement.key])}`
    )
    .join(' | ');

  useEffect(() => {
    if (!setupSession || !isOpen || setupSessionCompleted) {
      return;
    }
    const interval = window.setInterval(() => {
      void installationsQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: queryKeys.backendIntegrations() });
    }, 4000);
    return () => window.clearInterval(interval);
  }, [installationsQuery, isOpen, queryClient, setupSession, setupSessionCompleted]);

  useEffect(() => {
    if (!isSelected) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const card = cardRef.current;

      if (!card) {
        return;
      }

      if (typeof card.scrollIntoView === 'function') {
        card.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      card.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isSelected]);

  useEffect(() => {
    if (!autoOpenSetup || !isSelected || isOpen || autoOpenedSetupRef.current) {
      return;
    }

    autoOpenedSetupRef.current = true;
    void openSetupDialog(hasCredentials ? 'update' : 'new');
  }, [autoOpenSetup, hasCredentials, isOpen, isSelected, openSetupDialog]);

  const handleCardActionClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  const handleCardActionKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  const copyOneCLIValue = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`, { position: 'top-right' });
    } catch (error) {
      console.error('Unable to copy OneCLI setup value.', error);
      toast.error('Copy failed.', { position: 'top-right' });
    }
  };

  return (
    <>
      <Card
        ref={cardRef}
        data-testid={`planned-provider-card-${provider.id}`}
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        className={cn(
          'relative overflow-hidden border-dashed transition-colors dark:text-slate-100',
          readinessCue.card,
          isSelected ? 'border-primary-500 ring-2 ring-primary-100' : ''
        )}
        onClick={() => onSelect(provider.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect(provider.id);
          }
        }}
      >
        <span className={cn('absolute inset-x-0 top-0 h-1', readinessCue.accent)} />
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg text-neutral-950 dark:text-slate-50">
                {provider.name}
              </CardTitle>
              <CardDescription className="text-neutral-600 dark:text-slate-300">
                {provider.description || 'OneCLI-ready connector.'}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge variant="secondary">
                {backendKey === 'home-assistant' ? 'Smart Home setup' : 'Secure setup'}
              </Badge>
              <Badge
                data-testid={`planned-provider-status-${provider.id}`}
                variant={plannedReadinessBadgeVariant(cardReadinessState)}
                className={readinessCue.badge}
              >
                {plannedReadinessLabel(cardReadinessState)}
              </Badge>
              {hasCredentials ? <Badge variant="successful">credentials ready</Badge> : null}
              {providerInstallation ? (
                <Badge
                  variant={providerInstallation.status === 'active' ? 'successful' : 'outline'}
                >
                  {formatDisplayLabel(providerInstallation.status)}
                </Badge>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Backend key: {planned?.backendKey || 'tbd'}</Badge>
            <Badge variant="outline">Auth: {planned?.authModel || 'tbd'}</Badge>
            <Badge variant="outline">Priority: {priorityLabel(planned?.launchPriority)}</Badge>
            <Badge variant="outline">{capabilitySurfaceLabel(capabilitySurface)}</Badge>
          </div>
          {capabilitySurface === 'module' ||
          moduleCapabilities.length > 0 ||
          agencyCapabilityDependencies.length > 0 ? (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-400/20 dark:bg-sky-500/10">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-sky-950 dark:text-sky-100">
                    Module ownership
                  </p>
                  <p className="mt-1 text-sm text-sky-900 dark:text-sky-200">
                    Smart Home owns smart-home control and context. Voice and vision stay reusable
                    Agency capabilities that smart-home flows call into.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-sky-300 bg-white text-sky-800 dark:border-sky-400/30 dark:bg-white/10 dark:text-sky-100"
                >
                  {capabilitySurfaceLabel(capabilitySurface)}
                </Badge>
              </div>
              {moduleCapabilities.length > 0 ? (
                <div className="mt-3">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-sky-800 dark:text-sky-200">
                    Smart Home owns
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {moduleCapabilities.map((item) => (
                      <Badge key={item} variant="secondary">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
              {agencyCapabilityDependencies.length > 0 ? (
                <div className="mt-3">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-sky-800 dark:text-sky-200">
                    Uses Agency capabilities
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {agencyCapabilityDependencies.map((item) => (
                      <Badge key={item} variant="outline">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/70">
            <p className="text-sm font-medium text-neutral-900 dark:text-slate-100">
              Credential inventory
            </p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-slate-300">
              {provider.credentialStatus.message}
            </p>
            {provider.credentialStatus.refs.length ? (
              <div className="mt-3 space-y-2">
                {provider.credentialStatus.refs.map((reference, index) => (
                  <div key={`${reference.source ?? reference.name}-${index}`} className="space-y-1">
                    <Badge variant="outline">{reference.name}</Badge>
                    {reference.description ? (
                      <p className="wrap-break-word text-xs text-neutral-500 dark:text-slate-400">
                        {reference.description}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            {matchedCredentials.length > 1 ? (
              <div className="mt-4 space-y-1">
                <label
                  htmlFor={`${provider.id}-active-instance`}
                  className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400"
                >
                  Active instance
                </label>
                <select
                  id={`${provider.id}-active-instance`}
                  className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-900 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                  value={matchedCredentialId ?? ''}
                  onChange={(event) => setSelectedCredentialId(event.target.value)}
                  onClick={handleCardActionClick}
                  onKeyDown={handleCardActionKeyDown}
                >
                  {matchedCredentials.map((credential) => (
                    <option key={credential.id} value={credential.id}>
                      {credentialInstanceLabel(credential)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {hasCredentials ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {deleteMode ? (
                  <>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => deleteMutation.mutate()}
                      disabled={deleteMutation.isPending || !selectedDeleteInstallationId}
                    >
                      {deleteMutation.isPending ? 'Deleting...' : 'Confirm delete selected'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={deleteMutation.isPending}
                      onClick={() => setDeleteMode(false)}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="outline" onClick={() => setDeleteMode(true)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete selected instance
                  </Button>
                )}
              </div>
            ) : null}
            {matchedCredentials.length > 1 ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-300/25 dark:bg-amber-400/10">
                <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
                  Multiple instances detected
                </p>
                <p className="mt-1 text-xs text-amber-900 dark:text-amber-200/90">
                  Fill instance identity fields so agents can resolve the intended workspace,
                  channel, sender, repository, bucket, folder, or mailbox before using this
                  connector.
                </p>
              </div>
            ) : null}
            {selectedCredential ? (
              <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-white/10 dark:bg-white/4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400">
                  Agent selection signal
                </p>
                <p className="mt-1 wrap-break-word text-sm text-neutral-700 dark:text-slate-300">
                  {agentSelectionHint ||
                    'Add instance identity metadata so agents do not guess between repeated connector installations.'}
                </p>
              </div>
            ) : null}
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/70">
            <p className="text-sm font-medium text-neutral-900 dark:text-slate-100">
              Connector setup
            </p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-slate-300">
              {backendKey === 'home-assistant'
                ? 'Use the guided Smart Home setup first. Agency still stores the bridge URL and token securely behind the same connector flow.'
                : 'Start a backend-owned OneCLI setup session for this connector.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {backendKey === 'home-assistant' ? (
                <Button asChild className="agency-gradient text-white hover:brightness-105">
                  <Link
                    href="/integrations/smart-home"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    Open guided setup
                  </Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  className="agency-gradient text-white hover:brightness-105"
                  onClick={(event) => {
                    handleCardActionClick(event);
                    void openSetupDialog('new');
                  }}
                  onKeyDown={handleCardActionKeyDown}
                >
                  {hasCredentials ? 'Add another setup' : 'Set up connector'}
                </Button>
              )}
              {backendKey === 'home-assistant' ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={(event) => {
                    handleCardActionClick(event);
                    void openSetupDialog(hasCredentials ? 'update' : 'new');
                  }}
                  onKeyDown={handleCardActionKeyDown}
                >
                  {hasCredentials ? 'Advanced connector setup' : 'Open connector setup'}
                </Button>
              ) : null}
              {hasCredentials ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={(event) => {
                    handleCardActionClick(event);
                    void openSetupDialog('update');
                  }}
                  onKeyDown={handleCardActionKeyDown}
                >
                  Update credential
                </Button>
              ) : null}
              {hasCredentials && healthSupported ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={healthMutation.isPending}
                  onClick={(event) => {
                    handleCardActionClick(event);
                    healthMutation.mutate();
                  }}
                  onKeyDown={handleCardActionKeyDown}
                >
                  {healthMutation.isPending ? 'Testing...' : 'Test connection'}
                </Button>
              ) : null}
              {backendKey === 'home-assistant' ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={smartHomeAvailabilityQuery.isFetching || !smartHomeAvailable}
                  onClick={(event) => {
                    handleCardActionClick(event);
                    setSmartHomePreviewOpen(true);
                  }}
                  onKeyDown={handleCardActionKeyDown}
                >
                  {smartHomeAvailabilityQuery.isFetching
                    ? 'Checking Smart Home...'
                    : 'List entities'}
                </Button>
              ) : null}
            </div>
          </div>
          {effectiveLastHealthResult ? (
            <div
              className={`rounded-xl border p-4 ${
                lastHealthOk
                  ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-400/25 dark:bg-emerald-500/10'
                  : 'border-red-200 bg-red-50 dark:border-red-400/25 dark:bg-red-500/10'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-neutral-900 dark:text-slate-100">
                    Latest connector test
                  </p>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-slate-300">
                    {lastHealthOk
                      ? 'Backend health check succeeded for the saved connector credential.'
                      : toStringValue(effectiveLastHealthResult.error) ||
                        'Backend health check failed.'}
                  </p>
                </div>
                <Badge variant={lastHealthOk ? 'successful' : 'failed'}>
                  {lastHealthOk ? 'healthy' : 'failed'}
                </Badge>
              </div>
              {'audit_execution_id' in effectiveLastHealthResult ? (
                <p className="mt-3 text-xs text-neutral-500 dark:text-slate-400">
                  Audit execution: {toStringValue(effectiveLastHealthResult.audit_execution_id)}
                </p>
              ) : null}
            </div>
          ) : null}
          {hasCredentials ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/70">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-neutral-900 dark:text-slate-100">
                    Recent test history
                  </p>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-slate-300">
                    Latest backend audit runs for this connector credential.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(event) => {
                    handleCardActionClick(event);
                    void historyQuery.refetch();
                  }}
                  onKeyDown={handleCardActionKeyDown}
                  disabled={historyQuery.isFetching}
                >
                  {historyQuery.isFetching ? 'Refreshing...' : 'Refresh'}
                </Button>
              </div>
              {historyQuery.isLoading ? (
                <p className="mt-3 text-sm text-neutral-500 dark:text-slate-400">
                  Loading connector history…
                </p>
              ) : historyQuery.isError ? (
                <p className="mt-3 text-sm text-red-600">{historyQuery.error.message}</p>
              ) : historyItems.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {historyItems.slice(0, 3).map((item) => (
                    <div
                      key={item.executionId}
                      className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-3 dark:border-white/10 dark:bg-white/4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-neutral-900 dark:text-slate-100">
                            {formatShortTimestamp(item.startedAt ?? item.completedAt ?? null)}
                          </p>
                          <p className="mt-1 text-xs text-neutral-500 dark:text-slate-400">
                            {item.executionId}
                          </p>
                        </div>
                        <Badge
                          variant={
                            item.status === 'completed'
                              ? 'successful'
                              : item.status === 'failed'
                                ? 'failed'
                                : 'outline'
                          }
                        >
                          {item.status}
                        </Badge>
                      </div>
                      {item.error ? (
                        <p className="mt-2 text-sm text-red-600">{item.error}</p>
                      ) : (
                        <p className="mt-2 text-sm text-neutral-600 dark:text-slate-300">
                          No error recorded.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-neutral-500 dark:text-slate-400">
                  No test runs recorded yet for this connector credential.
                </p>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open && !saveMutation.isPending) {
            setSaveError(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isUpdateMode ? `Update ${provider.name} credential` : `Set up ${provider.name}`}
            </DialogTitle>
            <DialogDescription>
              {isUpdateMode
                ? `Backend key \`${backendKey}\`. Update the credential reference and metadata the backend uses for connector health checks.`
                : `Backend key \`${backendKey}\`. Start a new OneCLI setup session for this connector.`}
            </DialogDescription>
          </DialogHeader>

          {schemaQuery.isLoading ||
          schemaQuery.isFetching ||
          existingCredentialQuery.isLoading ||
          existingCredentialQuery.isFetching ? (
            <LoadingCard
              title="Connector schema"
              description="Loading connector credential requirements."
            />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                    Display Name
                  </label>
                  <Input
                    aria-label="Display Name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    disabled={saveMutation.isPending}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                    Auth Model
                  </label>
                  <Input aria-label="Auth Model" value={effectiveCapability.authModel} readOnly />
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-slate-950/70">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-slate-100">
                      OneCLI setup
                    </p>
                    <p className="mt-1 text-xs text-neutral-500 dark:text-slate-300">
                      Agency creates the setup session and stores only the resulting OneCLI
                      credential reference.
                    </p>
                  </div>
                  <Badge
                    variant={
                      latestInstallation?.status === 'active'
                        ? 'successful'
                        : setupSession
                          ? 'outline'
                          : 'outline'
                    }
                  >
                    {latestInstallation
                      ? formatDisplayLabel(latestInstallation.status)
                      : setupSession
                        ? 'Session ready'
                        : 'Backend-managed'}
                  </Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-neutral-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-white/4">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400">
                      1. Agency
                    </p>
                    <p className="mt-2 text-sm text-neutral-700 dark:text-slate-200">
                      Creates the installation and device code.
                    </p>
                  </div>
                  <div className="rounded-lg border border-neutral-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-white/4">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400">
                      2. OneCLI
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {onecliTransportModeLabel(onecliTransportMode)}
                      </Badge>
                      <p className="text-xs text-neutral-500 dark:text-slate-300">
                        {onecliTransportMode === 'direct'
                          ? 'OneCLI should stay out of the request path. Agency mirrors the same secret into a runtime secret record before direct delivery.'
                          : 'OneCLI can proxy provider traffic for proxy-compatible connectors; direct connectors mirror the same secret into Agency runtime storage before delivery.'}
                      </p>
                    </div>
                    <p className="mt-2 wrap-break-word text-sm text-neutral-700 dark:text-slate-200">
                      Stores secrets at {onecliStoragePath}.
                    </p>
                  </div>
                  <div className="rounded-lg border border-neutral-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-white/4">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400">
                      3. Status
                    </p>
                    <p className="mt-2 text-sm text-neutral-700 dark:text-slate-200">
                      Completion changes this installation to active.
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-neutral-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-white/4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400">
                        Copy into OneCLI
                      </p>
                      <p className="mt-1 text-xs text-neutral-500 dark:text-slate-300">
                        In OneCLI, open Connections, Custom, Generic Secret and fill the form with
                        these values. Secret rows are not copied from Agency; paste those values
                        from the integration provider.
                      </p>
                    </div>
                    {!setupSession ? (
                      <Badge variant="outline">Start setup for device code</Badge>
                    ) : null}
                  </div>
                  {onecliGenericSecretGuide.notes.length > 0 ? (
                    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
                      <div className="flex items-start gap-2">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" />
                        <div className="space-y-2">
                          <p className="font-medium text-amber-950 dark:text-amber-100">
                            Setup notes
                          </p>
                          <ul className="space-y-2">
                            {onecliGenericSecretGuide.notes.map((note) => (
                              <li key={note} className="flex gap-2">
                                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500 dark:bg-amber-300" />
                                <span>{note}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {onecliSetupGuide.options?.length ? (
                    <div
                      data-testid={`connector-setup-options-${backendKey}`}
                      className="mt-3 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-3 dark:border-cyan-400/30 dark:bg-cyan-500/10"
                    >
                      <div className="flex items-start gap-2">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-700 dark:text-cyan-300" />
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-medium text-cyan-950 dark:text-cyan-100">
                              Connection modes
                            </p>
                            <p className="mt-1 text-xs text-cyan-900 dark:text-cyan-200">
                              This connector supports more than one operator-facing setup path.
                              Agency should still normalize all successful flows back to the same
                              backend credential model.
                            </p>
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            {onecliSetupGuide.options.map((option) => (
                              <div
                                key={option.id}
                                data-testid={`connector-setup-option-${option.id}`}
                                className="rounded-md border border-cyan-200 bg-white px-3 py-3 dark:border-cyan-400/20 dark:bg-slate-950/75"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-medium text-neutral-900 dark:text-slate-100">
                                    {option.name}
                                  </p>
                                  <Badge variant="outline" className="text-[11px]">
                                    {option.authModel}
                                  </Badge>
                                </div>
                                <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-slate-300">
                                  {option.summary}
                                </p>
                                {option.fields.length > 0 ? (
                                  <p className="mt-2 text-xs text-neutral-500 dark:text-slate-400">
                                    Fields: {option.fields.map((field) => field.label).join(', ')}
                                  </p>
                                ) : null}
                                {option.notes?.length ? (
                                  <ul className="mt-2 space-y-1 text-xs text-neutral-600 dark:text-slate-300">
                                    {option.notes.map((note) => (
                                      <li key={note} className="flex gap-2">
                                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500 dark:bg-cyan-300" />
                                        <span>{note}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-3 space-y-2">
                    {onecliCopyRows.map((row) => (
                      <div
                        key={row.id}
                        data-testid={`onecli-copy-row-${row.id}`}
                        className="grid gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-white/10 dark:bg-slate-950/78 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)_auto]"
                      >
                        <div className="min-w-0">
                          <p className="wrap-break-word font-mono text-xs font-semibold text-neutral-900 dark:text-slate-100">
                            {row.label}
                          </p>
                          <p className="mt-1 text-xs text-neutral-500 dark:text-slate-400">
                            {row.description}
                          </p>
                        </div>
                        <p className="min-w-0 break-all rounded border border-neutral-200 bg-white px-2 py-2 font-mono text-xs text-neutral-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                          {row.value}
                        </p>
                        {row.copyable ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => void copyOneCLIValue(row.label, row.value)}
                          >
                            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                            Copy
                          </Button>
                        ) : (
                          <Button type="button" variant="outline" size="sm" disabled>
                            Provider secret
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {(selectedInstallation ?? latestInstallation) ? (
                  <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-950/78">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400">
                      Installation
                    </p>
                    <p className="mt-1 wrap-break-word text-sm text-neutral-900 dark:text-slate-100">
                      {(selectedInstallation ?? latestInstallation)?.name}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500 dark:text-slate-400">
                      Status:{' '}
                      {formatDisplayLabel((selectedInstallation ?? latestInstallation)?.status)}
                    </p>
                    <div className="mt-3 grid gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-white/10 dark:bg-white/4">
                      <div className="min-w-0">
                        <p className="wrap-break-word font-mono text-xs font-semibold text-neutral-900 dark:text-slate-100">
                          Installation id
                        </p>
                        <p className="mt-1 text-xs text-neutral-500 dark:text-slate-400">
                          Use this as the stable installation identifier for the selected connector
                          instance.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          aria-label="Installation id"
                          value={(selectedInstallation ?? latestInstallation)?.id ?? ''}
                          readOnly
                          className="font-mono text-xs"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() =>
                            void copyOneCLIValue(
                              'Installation id',
                              (selectedInstallation ?? latestInstallation)?.id ?? ''
                            )
                          }
                        >
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          Copy
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                          installationsQuery.isFetching || completeInstallationMutation.isPending
                        }
                        onClick={() => {
                          void installationsQuery.refetch();
                          void queryClient.invalidateQueries({
                            queryKey: queryKeys.backendIntegrations(),
                          });
                        }}
                      >
                        {installationsQuery.isFetching ? 'Refreshing...' : 'Refresh status'}
                      </Button>
                      {(selectedInstallation ?? latestInstallation)?.status === 'active' ? (
                        <Badge variant="successful">Setup completed in OneCLI</Badge>
                      ) : (
                        <Badge variant="outline">Waiting for OneCLI completion</Badge>
                      )}
                    </div>
                    {completionAvailable ? (
                      <p className="mt-3 text-xs text-neutral-500 dark:text-slate-400">
                        After creating the matching OneCLI custom secret, complete setup to activate
                        this installation in Agency.
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {setupSession ? (
                  <div className="space-y-1">
                    <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400">
                      Setup URL
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        aria-label="Setup URL"
                        value={setupUrl ?? setupSession.setup_url}
                        readOnly
                      />
                      <Button asChild type="button" variant="outline" size="sm">
                        <a
                          href={setupUrl ?? setupSession.setup_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open setup
                        </a>
                      </Button>
                    </div>
                  </div>
                ) : null}
                {latestInstallation &&
                directTransportRequiresRuntimeSecret &&
                latestInstallation.status !== 'active' ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 dark:border-amber-400/30 dark:bg-amber-500/10">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-amber-900 dark:text-amber-100">
                        Runtime secret mirror
                      </p>
                      <Badge
                        variant="outline"
                        className="border-amber-300 bg-white text-amber-800 dark:border-amber-400/30 dark:bg-white/10 dark:text-amber-200"
                      >
                        required for direct mode
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-amber-900 dark:text-amber-200">
                      Paste the same provider secret here so Agency can resolve it directly at
                      runtime without routing Telegram-style traffic through OneCLI.
                    </p>
                    <div className="mt-3 space-y-1">
                      <label className="text-xs font-medium uppercase tracking-[0.14em] text-amber-900 dark:text-amber-100">
                        Runtime secret value
                      </label>
                      <Input
                        aria-label="Runtime secret value"
                        type="password"
                        value={runtimeSecretValue}
                        onChange={(event) => setRuntimeSecretValue(event.target.value)}
                        disabled={saveMutation.isPending || completeInstallationMutation.isPending}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              {requiredMetadata.length > 0 ? (
                <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-slate-950/78">
                  <p className="text-sm font-medium text-neutral-900 dark:text-slate-100">
                    Required metadata
                  </p>
                  {requiredMetadata.map((requirement) => (
                    <div key={requirement.key} className="space-y-1">
                      <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400">
                        {requirement.key}
                      </label>
                      <Input
                        aria-label={requirement.key}
                        value={metadataValues[requirement.key] ?? ''}
                        onChange={(event) =>
                          setMetadataValues((current) => ({
                            ...current,
                            [requirement.key]: event.target.value,
                          }))
                        }
                        disabled={saveMutation.isPending || completeInstallationMutation.isPending}
                      />
                      <p className="text-xs text-neutral-500 dark:text-slate-400">
                        {requirement.description}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}

              {productionWebhookMetadata.length > 0 ? (
                <div
                  className={`space-y-3 rounded-xl border p-4 ${
                    missingProductionWebhookMetadata
                      ? 'border-amber-200 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-500/10'
                      : 'border-neutral-200 bg-white dark:border-white/10 dark:bg-slate-950/78'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-neutral-900 dark:text-slate-100">
                      Production webhook verification
                    </p>
                    {missingProductionWebhookMetadata ? (
                      <Badge
                        variant="outline"
                        className="border-amber-300 bg-white text-amber-800 dark:border-amber-400/30 dark:bg-white/10 dark:text-amber-200"
                      >
                        incomplete
                      </Badge>
                    ) : (
                      <Badge variant="successful">ready</Badge>
                    )}
                  </div>
                  {productionWebhookMetadata.map((requirement) => {
                    const keys = [requirement.key, ...(requirement.alternatives ?? [])];
                    return (
                      <div key={requirement.key} className="space-y-2">
                        <p className="text-xs text-neutral-600 dark:text-slate-300">
                          {requirement.description}
                        </p>
                        <div className="grid gap-2 md:grid-cols-2">
                          {keys.map((key) => (
                            <div key={key} className="space-y-1">
                              <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400">
                                {key}
                              </label>
                              <Input
                                aria-label={key}
                                value={metadataValues[key] ?? ''}
                                onChange={(event) =>
                                  setMetadataValues((current) => ({
                                    ...current,
                                    [key]: event.target.value,
                                  }))
                                }
                                disabled={
                                  saveMutation.isPending || completeInstallationMutation.isPending
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {instanceIdentityMetadata.length > 0 ? (
                <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/78">
                  <p className="text-sm font-medium text-neutral-900 dark:text-slate-100">
                    Instance identity
                  </p>
                  {instanceIdentityMetadata.map((requirement) => (
                    <div key={requirement.key} className="space-y-1">
                      <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400">
                        {requirement.key}
                      </label>
                      <Input
                        aria-label={requirement.key}
                        value={metadataValues[requirement.key] ?? ''}
                        onChange={(event) =>
                          setMetadataValues((current) => ({
                            ...current,
                            [requirement.key]: event.target.value,
                          }))
                        }
                        disabled={saveMutation.isPending || completeInstallationMutation.isPending}
                      />
                      <p className="text-xs text-neutral-500 dark:text-slate-400">
                        {requirement.description}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}

              {ownershipNotes.length > 0 ? (
                <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-400/20 dark:bg-sky-500/10">
                  <p className="text-sm font-medium text-sky-950 dark:text-sky-100">
                    Capability boundary
                  </p>
                  <ul className="space-y-2 text-sm text-sky-900 dark:text-sky-200">
                    {ownershipNotes.map((note) => (
                      <li key={note} className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500 dark:bg-sky-300" />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              className="agency-gradient text-white hover:brightness-105"
              disabled={
                completionAvailable
                  ? completeInstallationMutation.isPending ||
                    schemaQuery.isLoading ||
                    missingRequiredMetadata ||
                    !runtimeSecretValueReady
                  : saveMutation.isPending ||
                    schemaQuery.isLoading ||
                    !name.trim() ||
                    !canStartSetup ||
                    missingRequiredMetadata
              }
              onClick={() =>
                completionAvailable ? completeInstallationMutation.mutate() : saveMutation.mutate()
              }
            >
              {completionAvailable
                ? completeInstallationMutation.isPending
                  ? 'Completing...'
                  : 'Complete setup'
                : saveMutation.isPending
                  ? isUpdateMode
                    ? 'Saving...'
                    : 'Starting...'
                  : isUpdateMode
                    ? 'Update credential'
                    : 'Start OneCLI setup'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saveMutation.isPending || completeInstallationMutation.isPending}
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={smartHomePreviewOpen} onOpenChange={setSmartHomePreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Smart Home entity preview</DialogTitle>
            <DialogDescription>
              Read-only smoke check against the live home backend route. This validates that Agency
              can see the connected home and enumerate entities before you rely on ambient-home
              actions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                  Domain filter
                </label>
                <Input
                  aria-label="Smart Home domain filter"
                  placeholder="light, sensor, camera, lock"
                  value={smartHomePreviewDomain}
                  onChange={(event) => setSmartHomePreviewDomain(event.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={smartHomeEntitiesQuery.isFetching}
                  onClick={() => void smartHomeEntitiesQuery.refetch()}
                >
                  {smartHomeEntitiesQuery.isFetching ? 'Refreshing...' : 'Refresh preview'}
                </Button>
              </div>
            </div>
            {!smartHomeAvailable ? (
              <ErrorAlert
                title="Smart Home module unavailable"
                message={
                  smartHomeAvailabilityQuery.data?.reason ??
                  'The paired backend does not expose the Smart Home module right now.'
                }
              />
            ) : smartHomeEntitiesQuery.isLoading ? (
              <LoadingCard
                title="Loading entities"
                description="Requesting the current home entity list from the backend."
              />
            ) : smartHomeEntitiesQuery.isError ? (
              <ErrorAlert
                title="Smart Home preview failed"
                message={formatSmartHomePreviewError(smartHomeEntitiesQuery.error)}
              />
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-3">
                  <p className="text-sm font-medium text-neutral-900">
                    {smartHomeEntitiesQuery.data?.count ?? 0} entities returned
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    This comes from `GET /api/smart-home/entities` on the backend, not from the
                    fallback registry.
                  </p>
                </div>
                <div className="space-y-2">
                  {(smartHomeEntitiesQuery.data?.items ?? []).slice(0, 20).map((entity) => (
                    <div
                      key={entity.entity_id}
                      className="rounded-lg border border-neutral-200 bg-white px-3 py-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-neutral-900">
                            {smartHomeEntityFriendlyName(entity)}
                          </p>
                          <p className="mt-1 font-mono text-xs text-neutral-500">
                            {entity.entity_id}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">state: {entity.state}</Badge>
                          {smartHomeEntityAreaName(entity) ? (
                            <Badge variant="secondary">{smartHomeEntityAreaName(entity)}</Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {(smartHomeEntitiesQuery.data?.items ?? []).length === 0 ? (
                  <p className="text-sm text-neutral-500">
                    No entities matched the current filter.
                  </p>
                ) : null}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSmartHomePreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PlannedCategoryPanel({
  category,
  onRefresh,
  onConnectorTestResult,
  latestHistoryByCredentialId,
  selectedConnectorId,
  selectedConnectorAction,
  onSelectConnector,
  onecliUserNamespace,
  connectorCapabilitiesByBackendKey,
}: {
  category: IntegrationCategory;
  onRefresh: () => Promise<void>;
  onConnectorTestResult: (credentialId: string, result: Record<string, unknown>) => void;
  latestHistoryByCredentialId: Map<string, ConnectorHealthHistoryPayload['items'][number]>;
  selectedConnectorId: string | null;
  onSelectConnector: (connectorId: string | null) => void;
  onecliUserNamespace: string;
  connectorCapabilitiesByBackendKey: Record<string, ConnectorCapabilityDefinition>;
  selectedConnectorAction?: string | null;
}) {
  const [activeFilter, setActiveFilter] = useState<PlannedProviderFilter>(() =>
    readPlannedCategoryFilter(category.id)
  );
  const [searchQuery, setSearchQuery] = useState(() => readCategorySearchQuery(category.id));
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [page, setPage] = useState(() => readCategoryPage(category.id));
  const [pendingSectionId, setPendingSectionId] = useState<string | null>(null);
  const configuredCount = category.providers.filter(
    (provider) => provider.status === 'configured'
  ).length;
  const mappedCredentialIds = category.providers
    .flatMap(
      (provider) =>
        (provider.raw as PlannedIntegrationState | undefined)?.matchedCredentialIds ?? []
    )
    .filter((value, index, array) => Boolean(value) && array.indexOf(value) === index);
  const latestStatusByCredentialId = useMemo(
    () =>
      new Map(
        mappedCredentialIds.map((credentialId) => [
          credentialId,
          latestHistoryByCredentialId.get(credentialId)?.status ?? null,
        ])
      ),
    [latestHistoryByCredentialId, mappedCredentialIds]
  );
  const latestConnectorStatuses = mappedCredentialIds.map(
    (credentialId) => latestStatusByCredentialId.get(credentialId) ?? null
  );
  const healthyCount = latestConnectorStatuses.filter((status) => status === 'completed').length;
  const failingCount = latestConnectorStatuses.filter((status) => status === 'failed').length;
  const neverTestedCount = mappedCredentialIds.length - healthyCount - failingCount;
  const needsSetupCount = category.providers.filter((provider) => {
    const planned = provider.raw as PlannedIntegrationState | undefined;
    return (planned?.matchedCredentialIds.length ?? 0) === 0;
  }).length;
  const filteredProviders = useMemo<PlannedProviderSectionEntry[]>(
    () =>
      category.providers
        .map((provider) => {
          const planned = provider.raw as PlannedIntegrationState | undefined;
          const latestStatus =
            (planned?.matchedCredentialIds ?? [])
              .map((credentialId) => latestStatusByCredentialId.get(credentialId) ?? null)
              .find((status) => status !== null) ?? null;
          const readinessState = plannedProviderReadinessState(provider, latestStatus);
          return {
            provider,
            readinessState,
          };
        })
        .filter(({ provider, readinessState }) => {
          if (selectedConnectorId && provider.id === selectedConnectorId) {
            return true;
          }
          if (activeFilter !== 'all' && readinessState !== activeFilter) {
            return false;
          }
          return matchesProviderSearch(provider, deferredSearchQuery);
        })
        .sort((left, right) => {
          const priorityDelta =
            plannedProviderPriorityValue(left.readinessState) -
            plannedProviderPriorityValue(right.readinessState);
          if (priorityDelta !== 0) {
            return priorityDelta;
          }
          return left.provider.name.localeCompare(right.provider.name);
        })
        .map(({ provider, readinessState }) => ({ provider, readinessState })),
    [
      activeFilter,
      category.providers,
      deferredSearchQuery,
      latestStatusByCredentialId,
      selectedConnectorId,
    ]
  );
  const allProviderSections = useMemo<PlannedProviderSection[]>(
    () => groupPlannedProvidersBySection(category.id, filteredProviders),
    [category.id, filteredProviders]
  );
  const {
    sections: providerSections,
    resolvedPage,
    totalPages,
    totalItems,
  } = useMemo(
    () => paginateSectionCollections<PlannedProviderSection>(allProviderSections, page),
    [allProviderSections, page]
  );
  const visibleSectionItemCount = providerSections.reduce(
    (sum, section) => sum + section.providers.length,
    0
  );
  const visibleProviderIds = new Set(
    providerSections.flatMap((section) => section.providers.map((entry) => entry.provider.id))
  );
  const firstVisibleIndex = filteredProviders.findIndex((entry) =>
    visibleProviderIds.has(entry.provider.id)
  );
  const sectionJumpItems = allProviderSections.map((section, index) => ({
    id: categorySectionId(category.id, section.name ?? 'all'),
    label: section.name ?? 'All connectors',
    count: section.providers.length,
    targetPage: sectionTargetPage(allProviderSections, index),
  }));

  const updatePage = (nextPage: number) => {
    const normalized = Math.max(1, nextPage);
    setPage(normalized);
    persistCategoryPage(category.id, normalized);
  };

  const updateSearch = (nextSearch: string) => {
    setSearchQuery(nextSearch);
    persistCategorySearchQuery(category.id, nextSearch);
    updatePage(1);
  };

  useEffect(() => {
    if (!pendingSectionId) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      scrollToCategorySection(pendingSectionId);
      setPendingSectionId(null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pendingSectionId, providerSections]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-slate-100">
            {category.name}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-neutral-500 dark:text-slate-300">
            {category.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{category.providers.length} setup-ready</Badge>
          <Badge variant="outline">{configuredCount} credential-backed</Badge>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <CategorySummaryTile label="Directory" value={category.providers.length} tone="primary" />
        <CategorySummaryTile label="Credential-backed" value={configuredCount} tone="success" />
        <CategorySummaryTile label="Need setup" value={needsSetupCount} tone="warning" />
        <CategorySummaryTile label="Visible" value={totalItems} />
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'All', count: category.providers.length },
          { key: 'needs-setup', label: 'Need Setup', count: needsSetupCount },
          { key: 'healthy', label: 'Healthy', count: healthyCount },
          { key: 'failing', label: 'Failing', count: failingCount },
          { key: 'never-tested', label: 'Not Tested', count: neverTestedCount },
        ].map((filter) => (
          <Button
            key={filter.key}
            type="button"
            data-testid={`planned-filter-${category.id}-${filter.key}`}
            variant={activeFilter === filter.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              const nextFilter = filter.key as PlannedProviderFilter;
              setActiveFilter(nextFilter);
              persistPlannedCategoryFilter(category.id, nextFilter);
              updatePage(1);
            }}
            className={
              activeFilter === filter.key ? 'agency-gradient text-white hover:brightness-105' : ''
            }
          >
            {filter.label} ({filter.count})
          </Button>
        ))}
      </div>

      <div className="space-y-4 rounded-[28px] border border-neutral-200 bg-linear-to-br from-white via-neutral-50 to-primary-50/30 p-4 shadow-sm dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.76))] dark:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Input
            value={searchQuery}
            onChange={(event) => updateSearch(event.target.value)}
            placeholder={`Search ${category.name.toLowerCase()} connectors`}
            className="max-w-md border-neutral-200 bg-white/95 dark:border-white/10 dark:bg-slate-950/70"
          />
          <p className="text-sm text-neutral-500 dark:text-slate-300">
            {paginationSummaryLabel(totalItems, visibleSectionItemCount, firstVisibleIndex + 1)}
          </p>
        </div>
        <SectionJumpChips
          sections={sectionJumpItems}
          onJump={(sectionId, targetPage) => {
            updatePage(targetPage);
            setPendingSectionId(sectionId);
          }}
        />
      </div>

      <div className="space-y-6">
        {providerSections.map((section) => (
          <section
            key={section.name ?? 'all'}
            id={categorySectionId(category.id, section.name ?? 'all')}
            className="scroll-mt-24 space-y-3"
          >
            {section.name ? (
              <div className="rounded-2xl border border-neutral-200 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/4 dark:shadow-none">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-slate-100">
                      {section.name}
                    </h3>
                    <p className="mt-1 text-sm text-neutral-500 dark:text-slate-300">
                      {communicationsSectionDescription(section.name)}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {section.providers.length} connector{section.providers.length === 1 ? '' : 's'}
                  </Badge>
                </div>
              </div>
            ) : null}
            {section.name ? null : (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white/90 px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/4 dark:shadow-none">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-slate-100">
                  All connectors
                </h3>
                <Badge variant="outline">
                  {section.providers.length} connector{section.providers.length === 1 ? '' : 's'}
                </Badge>
              </div>
            )}
            <div className="grid gap-4 xl:grid-cols-2">
              {section.providers.map(({ provider, readinessState }) => (
                <PlannedProviderCard
                  key={provider.id}
                  provider={provider}
                  onRefresh={onRefresh}
                  onConnectorTestResult={onConnectorTestResult}
                  isSelected={provider.id === selectedConnectorId}
                  onSelect={onSelectConnector}
                  readinessState={readinessState}
                  onecliUserNamespace={onecliUserNamespace}
                  autoOpenSetup={
                    provider.id === selectedConnectorId && selectedConnectorAction === 'start-setup'
                  }
                  capabilityOverride={
                    connectorCapabilitiesByBackendKey[
                      (provider.raw as PlannedIntegrationState | undefined)?.backendKey ?? ''
                    ] ?? null
                  }
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <CategoryPagination
        categoryId={category.id}
        currentPage={resolvedPage}
        totalPages={totalPages}
        totalItems={totalItems}
        onChange={updatePage}
      />

      {totalItems === 0 ? (
        <EmptyCard
          title="No connectors match this view"
          description="Try another readiness filter or search query to inspect other OneCLI setup connectors in this category."
        />
      ) : null}
    </div>
  );
}

function ProviderEditor({
  provider,
  onRefresh,
  isSelected,
  onSelect,
}: {
  provider: IntegrationProvider;
  onRefresh: () => Promise<void>;
  isSelected: boolean;
  onSelect: (providerId: string) => void;
}) {
  const queryClient = useQueryClient();
  const rawTool =
    provider.kind === 'tool' ? (provider.raw as unknown as ToolDefinition | undefined) : undefined;
  const [formValues, setFormValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      provider.configFields.map((field) => [field.key, toStringValue(field.value)])
    )
  );
  const [deleteMode, setDeleteMode] = useState(false);

  const refreshIntegrations = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.backendIntegrations() });
    await onRefresh();
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!provider.actions.canSaveConfig) {
        return null;
      }

      if (provider.kind === 'mcp_server') {
        return providersApi.updateMcpServer(provider.id, {
          command: formValues.command || '',
          args: formValues.args
            ? formValues.args
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean)
            : [],
          url: formValues.url || null,
          enabled: formValues.enabled === 'true',
        });
      }

      return null;
    },
    onSuccess: async () => {
      await refreshIntegrations();
      toast.success('Configuration saved.', { position: 'top-right' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async () => {
      if (provider.kind !== 'mcp_server' || !provider.actions.canEnableDisable) {
        return null;
      }

      const nextEnabled = provider.status !== 'enabled';
      return providersApi.updateMcpServer(provider.id, { enabled: nextEnabled });
    },
    onSuccess: async () => {
      await refreshIntegrations();
      toast.success('Provider state updated.', { position: 'top-right' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (provider.kind === 'mcp_server') {
        return mcpServersApi.deleteMcpServer(provider.id);
      }

      if (provider.kind === 'tool') {
        return toolsApi.deleteTool(provider.id);
      }

      return null;
    },
    onSuccess: async () => {
      await refreshIntegrations();
      toast.success('Integration deleted.', { position: 'top-right' });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      if (!provider.actions.canTestConnection) {
        return null;
      }

      if (provider.kind === 'mcp_server') {
        return providersApi.discoverMcpServer(provider.id);
      }

      if (provider.kind === 'model_provider') {
        return providersApi.testModelProvider(provider.id);
      }

      if (provider.kind === 'model_profile') {
        return providersApi.testModelProfile(provider.id);
      }

      if (provider.kind === 'tool') {
        return toolsApi.testTool(provider.id, { input: {} });
      }

      return null;
    },
  });

  const canDelete = provider.kind === 'mcp_server' || provider.kind === 'tool';
  const credentialCapability = profileApi.getIntegrationCredentialCapability();
  const isChatProvider = provider.kind === 'model_provider' || provider.kind === 'model_profile';
  const cue = integrationStatusCue(provider.status);
  const categoryTheme = supportedCategoryTheme(provider.categoryId);

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-colors',
        cue.card,
        categoryTheme.cardShell,
        isSelected ? 'ring-2 ring-primary-100' : ''
      )}
      onClickCapture={() => onSelect(provider.id)}
      onFocusCapture={() => onSelect(provider.id)}
    >
      <span className={cn('absolute inset-x-0 top-0 h-1', cue.accent)} />
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className={cn('text-lg', categoryTheme.title)}>{provider.name}</CardTitle>
            <CardDescription className={categoryTheme.description}>
              {provider.description || 'No provider description available.'}
            </CardDescription>
          </div>
          <Badge variant={statusVariant(provider.status)} className={cue.badge}>
            {providerStatusLabel(provider.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{formatDisplayLabel(provider.kind)}</Badge>
          {provider.capabilities?.map((capability) => (
            <Badge key={capability} variant="outline">
              {formatDisplayLabel(capability)}
            </Badge>
          ))}
        </div>

        {isChatProvider ? (
          <>
            <div className="space-y-3">
              <p className="text-sm font-medium text-neutral-900 dark:text-slate-100">
                Configuration snapshot
              </p>
              {provider.configFields.map((field) => (
                <div
                  key={field.key}
                  className={cn(
                    'rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2',
                    categoryTheme.panelMuted
                  )}
                >
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400">
                    {field.label}
                  </p>
                  <p className="mt-1 wrap-break-word text-sm text-neutral-800 dark:text-slate-100">
                    {toStringValue(field.value) || 'Not set'}
                  </p>
                </div>
              ))}
            </div>
            <div
              className={cn(
                'rounded-xl border border-neutral-200 bg-neutral-50 p-4',
                categoryTheme.panelMuted
              )}
            >
              <p className="text-sm font-medium text-neutral-900 dark:text-slate-100">
                Credential handling
              </p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-slate-300">
                {provider.credentialStatus.message}
              </p>
              {provider.credentialStatus.refs.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {provider.credentialStatus.refs.map((reference, index) => (
                    <Badge key={`${reference.source ?? reference.name}-${index}`} variant="outline">
                      {reference.name}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
            <ManageModelProfilesButton />
          </>
        ) : (
          <>
            {provider.kind === 'tool' ? (
              <ToolIntegrationSummary provider={provider} tool={rawTool} />
            ) : provider.configFields.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-neutral-900 dark:text-slate-100">
                  Required / available configuration
                </p>
                {provider.configFields.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400">
                      {field.label}
                      {field.required ? ' *' : ''}
                    </label>
                    {field.type === 'textarea' || field.type === 'json' ? (
                      <Textarea
                        value={formValues[field.key] ?? ''}
                        readOnly={!field.editable}
                        onChange={(event) =>
                          setFormValues((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                        className="min-h-24"
                      />
                    ) : (
                      <Input
                        value={formValues[field.key] ?? ''}
                        readOnly={!field.editable}
                        onChange={(event) =>
                          setFormValues((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                      />
                    )}
                    {field.description ? (
                      <p className="text-xs text-neutral-500 dark:text-slate-400">
                        {field.description}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500 dark:text-slate-400">
                No configuration schema is currently exposed for this provider.
              </p>
            )}

            {provider.kind !== 'tool' ? (
              <div
                className={cn(
                  'rounded-xl border border-neutral-200 bg-neutral-50 p-4',
                  categoryTheme.panelMuted
                )}
              >
                <p className="text-sm font-medium text-neutral-900 dark:text-slate-100">
                  Credential handling
                </p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-slate-300">
                  {provider.credentialStatus.message}
                </p>
                {!credentialCapability.writeSupported ? (
                  <p className="mt-2 text-xs text-neutral-500 dark:text-slate-400">
                    {credentialCapability.message}
                  </p>
                ) : null}
                {provider.credentialStatus.refs.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {provider.credentialStatus.refs.map((reference, index) => (
                      <Badge
                        key={`${reference.source ?? reference.name}-${index}`}
                        variant="outline"
                      >
                        {reference.name}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {provider.actions.canSaveConfig ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                >
                  <Wrench className="mr-2 h-4 w-4" />
                  {saveMutation.isPending ? 'Saving...' : 'Save Config'}
                </Button>
              ) : null}
              {provider.actions.canEnableDisable ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => toggleMutation.mutate()}
                  disabled={toggleMutation.isPending}
                >
                  <PlugZap className="mr-2 h-4 w-4" />
                  {provider.status === 'enabled' ? 'Disable' : 'Enable'}
                </Button>
              ) : null}
              {provider.actions.canTestConnection ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => testMutation.mutate()}
                  disabled={testMutation.isPending}
                >
                  {testMutation.isPending
                    ? 'Testing...'
                    : provider.kind === 'mcp_server'
                      ? 'Discover'
                      : 'Test'}
                </Button>
              ) : null}
              {canDelete ? (
                deleteMode ? (
                  <>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => deleteMutation.mutate()}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? 'Deleting...' : 'Confirm delete'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={deleteMutation.isPending}
                      onClick={() => setDeleteMode(false)}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="outline" onClick={() => setDeleteMode(true)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                )
              ) : null}
            </div>

            {saveMutation.isError ? (
              <ErrorAlert
                title="Failed to save configuration"
                message={saveMutation.error.message}
              />
            ) : null}
            {toggleMutation.isError ? (
              <ErrorAlert
                title="Failed to update provider state"
                message={toggleMutation.error.message}
              />
            ) : null}
            {deleteMutation.isError ? (
              <ErrorAlert
                title="Failed to delete integration"
                message={deleteMutation.error.message}
              />
            ) : null}
            {testMutation.isError ? (
              <ErrorAlert
                title="Connection or discovery failed"
                message={testMutation.error.message}
              />
            ) : null}
            {testMutation.isSuccess && testMutation.data ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-100">
                Test/discovery completed. The backend returned a response successfully.
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CategoryPanel({
  category,
  onRefresh,
  onConnectorTestResult,
  latestHistoryByCredentialId,
  selectedConnectorId,
  onSelectConnector,
  onecliUserNamespace,
  connectorCapabilitiesByBackendKey,
  selectedConnectorAction,
}: {
  category: IntegrationCategory;
  onRefresh: () => Promise<void>;
  onConnectorTestResult: (credentialId: string, result: Record<string, unknown>) => void;
  latestHistoryByCredentialId: Map<string, ConnectorHealthHistoryPayload['items'][number]>;
  selectedConnectorId: string | null;
  onSelectConnector: (connectorId: string | null) => void;
  onecliUserNamespace: string;
  connectorCapabilitiesByBackendKey: Record<string, ConnectorCapabilityDefinition>;
  selectedConnectorAction?: string | null;
}) {
  if (category.id === 'llm-models') {
    return <LlmModelsInventoryPanel category={category} />;
  }

  if (category.status === 'planned') {
    return (
      <PlannedCategoryPanel
        category={category}
        onRefresh={onRefresh}
        onConnectorTestResult={onConnectorTestResult}
        latestHistoryByCredentialId={latestHistoryByCredentialId}
        selectedConnectorId={selectedConnectorId}
        onSelectConnector={onSelectConnector}
        onecliUserNamespace={onecliUserNamespace}
        connectorCapabilitiesByBackendKey={connectorCapabilitiesByBackendKey}
        selectedConnectorAction={selectedConnectorAction}
      />
    );
  }

  if (category.providers.length === 0) {
    return (
      <div className="space-y-4">
        {category.id === 'custom' ? (
          <div className="flex flex-wrap gap-2">
            <CreateToolCard onCreated={onRefresh} />
            <CreateMcpServerCard onCreated={onRefresh} />
          </div>
        ) : null}
        <EmptyCard
          title={`No ${category.name.toLowerCase()} providers`}
          description={category.description}
        />
      </div>
    );
  }
  return (
    <SupportedCategoryPanel
      category={category}
      onRefresh={onRefresh}
      selectedConnectorId={selectedConnectorId}
      onSelectConnector={onSelectConnector}
    />
  );
}

function SupportedCategoryPanel({
  category,
  onRefresh,
  selectedConnectorId,
  onSelectConnector,
}: {
  category: IntegrationCategory;
  onRefresh: () => Promise<void>;
  selectedConnectorId: string | null;
  onSelectConnector: (connectorId: string | null) => void;
}) {
  const theme = supportedCategoryTheme(category.id);
  const [searchQuery, setSearchQuery] = useState(() => readCategorySearchQuery(category.id));
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [activeFilter, setActiveFilter] = useState<SupportedProviderFilter>(() =>
    readCategoryProviderFilter(category.id)
  );
  const [page, setPage] = useState(() => readCategoryPage(category.id));
  const [pendingSectionId, setPendingSectionId] = useState<string | null>(null);
  const matchingProviders = useMemo(
    () =>
      category.providers
        .filter((provider) => {
          if (selectedConnectorId && provider.id === selectedConnectorId) {
            return true;
          }
          if (activeFilter !== 'all' && provider.kind !== activeFilter) {
            return false;
          }
          return matchesProviderSearch(provider, deferredSearchQuery);
        })
        .sort((left, right) => {
          const rankDelta = providerKindRank(left.kind) - providerKindRank(right.kind);
          if (rankDelta !== 0) {
            return rankDelta;
          }
          return left.name.localeCompare(right.name);
        }),
    [activeFilter, category.providers, deferredSearchQuery, selectedConnectorId]
  );
  const allProviderSections = useMemo<ProviderExplorerSection[]>(
    () => buildSupportedExplorerSections(category.id, matchingProviders),
    [category.id, matchingProviders]
  );
  const {
    sections: providerSections,
    resolvedPage,
    totalPages,
    totalItems,
  } = useMemo(
    () => paginateSectionCollections<ProviderExplorerSection>(allProviderSections, page),
    [allProviderSections, page]
  );
  const availableFilters = [
    { key: 'all' as const, label: 'All', count: category.providers.length },
    ...CATEGORY_PROVIDER_KIND_ORDER.map((kind) => ({
      key: kind,
      label: providerGroupTitle(kind),
      count: category.providers.filter((provider) => provider.kind === kind).length,
    })).filter((filter) => filter.count > 0),
  ];
  const visibleSectionItemCount = providerSections.reduce(
    (sum, section) => sum + section.providers.length,
    0
  );
  const visibleProviderIds = new Set(
    providerSections.flatMap((section) => section.providers.map((provider) => provider.id))
  );
  const firstVisibleIndex = matchingProviders.findIndex((provider) =>
    visibleProviderIds.has(provider.id)
  );
  const sectionJumpItems = allProviderSections.map((section, index) => ({
    id: categorySectionId(category.id, section.key),
    label: section.title,
    count: section.providers.length,
    targetPage: sectionTargetPage(allProviderSections, index),
  }));

  // Keep per-category list state in the URL so direct links restore the same view
  // without coupling every tab to top-level React state.
  const updatePage = (nextPage: number) => {
    const normalized = Math.max(1, nextPage);
    setPage(normalized);
    persistCategoryPage(category.id, normalized);
  };

  const updateSearch = (nextSearch: string) => {
    setSearchQuery(nextSearch);
    persistCategorySearchQuery(category.id, nextSearch);
    updatePage(1);
  };

  const updateFilter = (nextFilter: SupportedProviderFilter) => {
    setActiveFilter(nextFilter);
    persistCategoryProviderFilter(category.id, nextFilter);
    updatePage(1);
  };

  useEffect(() => {
    if (!pendingSectionId) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      scrollToCategorySection(pendingSectionId);
      setPendingSectionId(null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pendingSectionId, providerSections]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={cn('text-xl font-semibold text-neutral-900', theme.title)}>
            {category.name}
          </h2>
          <p className={cn('mt-1 text-sm text-neutral-500', theme.description)}>
            {category.description}
          </p>
        </div>
        {category.id === 'custom' ? (
          <div className="flex flex-wrap gap-2">
            <CreateToolCard onCreated={onRefresh} />
            <CreateMcpServerCard onCreated={onRefresh} />
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <CategorySummaryTile
          label="Directory"
          value={category.providers.length}
          tone={theme.summaryPrimary}
        />
        <CategorySummaryTile label="Visible" value={totalItems} />
        <CategorySummaryTile
          label="Groups"
          value={allProviderSections.length || 1}
          tone={theme.summarySecondary}
        />
        <CategorySummaryTile
          label="Active filter"
          value={formatDisplayLabel(activeFilter)}
          tone="warning"
        />
      </div>

      <div className="space-y-4 rounded-[28px] border border-neutral-200 bg-linear-to-br from-white via-neutral-50 to-secondary-50/35 p-4 shadow-sm dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.76))] dark:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Input
            value={searchQuery}
            onChange={(event) => updateSearch(event.target.value)}
            placeholder={`Search ${category.name.toLowerCase()} integrations`}
            className="max-w-md border-neutral-200 bg-white/95 dark:border-white/10 dark:bg-slate-950/70"
          />
          <p className="text-sm text-neutral-500 dark:text-slate-300">
            {paginationSummaryLabel(totalItems, visibleSectionItemCount, firstVisibleIndex + 1)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableFilters.map((filter) => (
            <Button
              key={filter.key}
              type="button"
              variant={activeFilter === filter.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateFilter(filter.key)}
              className={
                activeFilter === filter.key ? 'agency-gradient text-white hover:brightness-105' : ''
              }
            >
              {filter.label} ({filter.count})
            </Button>
          ))}
        </div>
        <SectionJumpChips
          sections={sectionJumpItems}
          onJump={(sectionId, targetPage) => {
            updatePage(targetPage);
            setPendingSectionId(sectionId);
          }}
        />
      </div>

      <div className="space-y-6">
        {providerSections.map((section) => (
          <section
            key={section.key}
            id={categorySectionId(category.id, section.key)}
            className="scroll-mt-24 space-y-3"
          >
            <div
              className={cn(
                'rounded-2xl border border-neutral-200 bg-white/90 p-4 shadow-sm dark:shadow-none',
                theme.sectionHeader
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className={cn('text-sm font-semibold text-neutral-900', theme.title)}>
                    {section.title}
                  </h3>
                  {section.description ? (
                    <p className={cn('mt-1 text-sm text-neutral-500', theme.description)}>
                      {section.description}
                    </p>
                  ) : null}
                </div>
                <Badge variant="outline">
                  {section.providers.length} integration{section.providers.length === 1 ? '' : 's'}
                </Badge>
              </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {section.providers.map((provider) => (
                <ProviderEditor
                  key={provider.id}
                  provider={provider}
                  onRefresh={onRefresh}
                  isSelected={provider.id === selectedConnectorId}
                  onSelect={(providerId) => onSelectConnector(providerId)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <CategoryPagination
        categoryId={category.id}
        currentPage={resolvedPage}
        totalPages={totalPages}
        totalItems={totalItems}
        onChange={updatePage}
      />

      {totalItems === 0 ? (
        <EmptyCard
          title="No integrations match this view"
          description="Adjust the search or filter to inspect other integrations in this category."
        />
      ) : null}
    </div>
  );
}

function OperationsPanel({
  aggregateHistoryQuery,
  mappedCredentialIds,
  healthyConnectorCount,
  failingConnectorCount,
  neverTestedConnectorCount,
  operationsFilter,
  setOperationsFilter,
  filteredOperationalItems,
  matchingOperationalItems,
  operationsVisibleCount,
  setOperationsVisibleCount,
  operationsLastTestResult,
  operationsTestMutation,
  operationsBulkTestMutation,
  refreshOperationsQueue,
  credentialProviderById,
  categoryNameById,
}: {
  aggregateHistoryQuery: ReturnType<typeof useQuery<ConnectorHealthHistoryPayload>>;
  mappedCredentialIds: string[];
  healthyConnectorCount: number;
  failingConnectorCount: number;
  neverTestedConnectorCount: number;
  operationsFilter: OperationsFilter;
  setOperationsFilter: (filter: OperationsFilter) => void;
  filteredOperationalItems: Array<{
    provider: IntegrationProvider;
    credentialId: string;
    latestItem: ConnectorHealthHistoryPayload['items'][number] | null;
    state: Exclude<OperationsFilter, 'all'>;
    timestamp: string | null;
  }>;
  matchingOperationalItems: Array<{
    provider: IntegrationProvider;
    credentialId: string;
    latestItem: ConnectorHealthHistoryPayload['items'][number] | null;
    state: Exclude<OperationsFilter, 'all'>;
    timestamp: string | null;
  }>;
  operationsVisibleCount: number;
  setOperationsVisibleCount: (value: number | ((current: number) => number)) => void;
  operationsLastTestResult: Record<string, Record<string, unknown>>;
  operationsTestMutation: ReturnType<typeof useMutation<Record<string, unknown>, Error, string>>;
  operationsBulkTestMutation: ReturnType<
    typeof useMutation<
      Array<{
        credentialId: string;
        ok: boolean;
        result?: Record<string, unknown>;
        error?: string;
      }>,
      Error,
      string[]
    >
  >;
  refreshOperationsQueue: () => Promise<void>;
  credentialProviderById: Map<string, IntegrationProvider>;
  categoryNameById: Map<string, string>;
}) {
  const applyOperationsFilter = (nextFilter: OperationsFilter) => {
    setOperationsFilter(nextFilter);
    setOperationsVisibleCount(OPERATIONS_PAGE_SIZE);
    persistOperationsFilterParam(nextFilter);
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-5 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-neutral-900 dark:text-slate-100">
            Connector operations
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-slate-300">
            Latest backend health state across configured OneCLI setup connectors.
          </p>
        </div>
        {aggregateHistoryQuery.isLoading || aggregateHistoryQuery.isFetching ? (
          <Badge variant="outline">Refreshing…</Badge>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400">
            Credential-backed
          </p>
          <p
            data-testid="operations-credential-backed-count"
            className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-slate-100"
          >
            {mappedCredentialIds.length}
          </p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-emerald-700">
            Healthy
          </p>
          <p
            data-testid="operations-healthy-count"
            className="mt-2 text-2xl font-semibold text-emerald-900"
          >
            {healthyConnectorCount}
          </p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-red-700">Failing</p>
          <p
            data-testid="operations-failing-count"
            className="mt-2 text-2xl font-semibold text-red-900"
          >
            {failingConnectorCount}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-slate-400">
            Never tested
          </p>
          <p
            data-testid="operations-never-tested-count"
            className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-slate-100"
          >
            {neverTestedConnectorCount}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-neutral-900 dark:text-slate-100">
              Recent connector runs
            </p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-slate-300">
              Latest connector test result per saved connector credential.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refreshOperationsQueue()}
              disabled={aggregateHistoryQuery.isFetching || mappedCredentialIds.length === 0}
            >
              Refresh all
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => operationsBulkTestMutation.mutate(mappedCredentialIds)}
              disabled={operationsBulkTestMutation.isPending || mappedCredentialIds.length === 0}
            >
              {operationsBulkTestMutation.isPending
                ? 'Testing all...'
                : 'Test all credential-backed'}
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All', count: mappedCredentialIds.length },
            { key: 'failing', label: 'Failing', count: failingConnectorCount },
            { key: 'healthy', label: 'Healthy', count: healthyConnectorCount },
            { key: 'never-tested', label: 'Never tested', count: neverTestedConnectorCount },
          ].map((filter) => (
            <Button
              key={filter.key}
              type="button"
              data-testid={`operations-filter-${filter.key}`}
              variant={operationsFilter === filter.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyOperationsFilter(filter.key as OperationsFilter)}
              className={
                operationsFilter === filter.key
                  ? 'agency-gradient text-white hover:brightness-105'
                  : ''
              }
            >
              {filter.label} ({filter.count})
            </Button>
          ))}
        </div>
        {filteredOperationalItems.length > 0 ? (
          <div className="mt-4 space-y-3">
            {filteredOperationalItems.map((item) => {
              const provider = item.provider ?? credentialProviderById.get(item.credentialId);
              const lastTestResult = operationsLastTestResult[item.credentialId] ?? null;
              const lastTestOk = lastTestResult?.ok === true;
              const persistedFailureHint = connectorFailureHint(item.latestItem?.error);
              const immediateFailureError = lastTestOk
                ? null
                : toStringValue(lastTestResult?.error);
              const immediateFailureHint = connectorFailureHint(immediateFailureError);
              const planned = provider?.raw as PlannedIntegrationState | undefined;
              return (
                <div
                  key={`${provider?.id ?? item.credentialId}-${item.latestItem?.executionId ?? 'never-tested'}`}
                  data-testid={`operations-row-${item.credentialId}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-white/5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900 dark:text-slate-100">
                      {provider?.name ?? item.latestItem?.credentialName}
                    </p>
                    <div
                      data-testid={`operations-row-meta-${item.credentialId}`}
                      className="mt-2 flex flex-wrap gap-2"
                    >
                      {provider ? (
                        <Badge variant="outline">
                          {categoryNameById.get(provider.categoryId) ?? provider.categoryId}
                        </Badge>
                      ) : null}
                      {planned?.backendKey ? (
                        <Badge variant="outline">Key: {planned.backendKey}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-neutral-500 dark:text-slate-400">
                      {formatShortTimestamp(item.timestamp)}
                    </p>
                    {item.latestItem?.error ? (
                      <div className="mt-2 space-y-1">
                        <p className="text-sm text-red-600">{item.latestItem.error}</p>
                        {persistedFailureHint ? (
                          <p className="text-sm text-amber-700 dark:text-amber-200">
                            {persistedFailureHint}
                          </p>
                        ) : null}
                      </div>
                    ) : item.state === 'never-tested' ? (
                      <p className="mt-2 text-sm text-neutral-600">
                        No connector test runs recorded yet.
                      </p>
                    ) : null}
                    {lastTestResult ? (
                      <div className="mt-2 space-y-1">
                        <p
                          className={`text-sm ${lastTestOk ? 'text-emerald-700' : 'text-red-600'}`}
                        >
                          {lastTestOk
                            ? `Latest queue test succeeded${lastTestResult.audit_execution_id ? ` · ${toStringValue(lastTestResult.audit_execution_id)}` : ''}`
                            : immediateFailureError || 'Latest queue test failed.'}
                        </p>
                        {immediateFailureHint ? (
                          <p className="text-sm text-amber-700 dark:text-amber-200">
                            {immediateFailureHint}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        item.state === 'healthy'
                          ? 'successful'
                          : item.state === 'failing'
                            ? 'failed'
                            : 'outline'
                      }
                    >
                      {item.state}
                    </Badge>
                    {provider ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={
                            operationsTestMutation.isPending &&
                            operationsTestMutation.variables === item.credentialId
                          }
                          onClick={() => operationsTestMutation.mutate(item.credentialId)}
                        >
                          {operationsTestMutation.isPending &&
                          operationsTestMutation.variables === item.credentialId
                            ? 'Testing...'
                            : 'Test now'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openIntegrationConnector(provider.categoryId, provider.id)}
                        >
                          Open
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {matchingOperationalItems.length > OPERATIONS_PAGE_SIZE ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {filteredOperationalItems.length < matchingOperationalItems.length ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setOperationsVisibleCount((current) => current + OPERATIONS_PAGE_SIZE)
                    }
                  >
                    Show more
                  </Button>
                ) : null}
                {operationsVisibleCount > OPERATIONS_PAGE_SIZE ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOperationsVisibleCount(OPERATIONS_PAGE_SIZE)}
                  >
                    Show less
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-sm text-neutral-500">
            {mappedCredentialIds.length > 0
              ? 'No connectors match this operations filter.'
              : 'No credential-backed OneCLI setup connectors yet.'}
          </p>
        )}
      </div>
    </div>
  );
}

export default function IntegrationsWorkspace({ mode = 'full' }: { mode?: 'full' | 'operations' }) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const integrationTabSearchParam = searchParams.get('integration-tab');
  const integrationConnectorSearchParam = searchParams.get('integration-connector');
  const integrationConnectorActionSearchParam = searchParams.get('connector-action');
  const operationsFilterSearchParam = searchParams.get('operations-filter');
  const onecliUserNamespace = session?.user?.id ?? ONECLI_AGENCY_USER_PLACEHOLDER;
  const integrationsQuery = useQuery({
    queryKey: queryKeys.backendIntegrations(),
    queryFn: (): Promise<IntegrationCatalogPayload> => integrationsApi.listCategories(),
  });
  const connectorCapabilitiesQuery = useQuery({
    queryKey: ['connectorCapabilities'],
    queryFn: () => credentialsApi.getConnectorCredentialCapabilities(),
    retry: false,
  });

  const [activeTab, setActiveTab] = useState<string | null>(() => readIntegrationTabParam());
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(() =>
    readIntegrationConnectorParam()
  );
  const [selectedConnectorAction, setSelectedConnectorAction] = useState<string | null>(() =>
    readIntegrationConnectorActionParam()
  );
  const [operationsFilter, setOperationsFilter] = useState<OperationsFilter>(() =>
    readOperationsFilterParam()
  );
  const [operationsVisibleCount, setOperationsVisibleCount] = useState(OPERATIONS_PAGE_SIZE);
  const [operationsLastTestResult, setOperationsLastTestResult] = useState<
    Record<string, Record<string, unknown>>
  >({});

  useEffect(() => {
    // Same-route Next links update search params without remounting this workspace.
    const timeout = window.setTimeout(() => {
      setActiveTab(integrationTabSearchParam);
      setSelectedConnectorId(integrationConnectorSearchParam);
      setSelectedConnectorAction(integrationConnectorActionSearchParam);
      setOperationsFilter(readOperationsFilterParam());
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [
    integrationTabSearchParam,
    integrationConnectorSearchParam,
    integrationConnectorActionSearchParam,
    operationsFilterSearchParam,
  ]);
  const categories = useMemo(
    () => integrationsQuery.data?.categories ?? [],
    [integrationsQuery.data]
  );
  const connectorCapabilitiesByBackendKey = useMemo(
    () => connectorCapabilitiesQuery.data?.connectors ?? {},
    [connectorCapabilitiesQuery.data]
  );
  const plannedProviders = useMemo(
    () =>
      categories.flatMap((category) => (category.status === 'planned' ? category.providers : [])),
    [categories]
  );
  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );
  const mappedCredentialIds = useMemo(
    () =>
      plannedProviders
        .flatMap(
          (provider) =>
            (provider.raw as PlannedIntegrationState | undefined)?.matchedCredentialIds ?? []
        )
        .filter((value, index, array) => Boolean(value) && array.indexOf(value) === index),
    [plannedProviders]
  );
  const aggregateHistoryQuery = useQuery({
    queryKey: ['aggregateConnectorHistory', mappedCredentialIds.join(',')],
    queryFn: (): Promise<ConnectorHealthHistoryPayload> =>
      connectorsApi.getAggregateConnectorHistory({ limit: 200 }),
    enabled: mappedCredentialIds.length > 0,
    retry: false,
  });
  const aggregateLatestHistoryByCredentialId = useMemo(
    () => latestConnectorHistoryByCredential(aggregateHistoryQuery.data?.items ?? []),
    [aggregateHistoryQuery.data]
  );
  const latestCredentialHistoryQueries = useQueries({
    queries: mappedCredentialIds.map((credentialId) => ({
      queryKey: ['connectorLatestHistory', credentialId],
      queryFn: (): Promise<ConnectorHealthHistoryPayload> =>
        connectorsApi.getConnectorHistory(credentialId, { limit: 1 }),
      enabled: Boolean(credentialId),
      retry: false,
    })),
  });
  const latestCredentialHistoryByCredentialId = useMemo(() => {
    const latest = new Map<string, ConnectorHealthHistoryPayload['items'][number]>();

    latestCredentialHistoryQueries.forEach((query, index) => {
      const credentialId = mappedCredentialIds[index];
      const latestItem = query.data?.items?.[0] ?? null;
      if (credentialId && latestItem) {
        latest.set(credentialId, latestItem);
      }
    });

    return latest;
  }, [latestCredentialHistoryQueries, mappedCredentialIds]);
  const credentialBackedProviders = useMemo(
    () =>
      plannedProviders.filter(
        (provider) =>
          ((provider.raw as PlannedIntegrationState | undefined)?.matchedCredentialIds.length ??
            0) > 0
      ),
    [plannedProviders]
  );
  const credentialProviderById = useMemo(() => {
    const map = new Map<string, IntegrationProvider>();

    credentialBackedProviders.forEach((provider) => {
      const planned = provider.raw as PlannedIntegrationState | undefined;
      (planned?.matchedCredentialIds ?? []).forEach((credentialId) => {
        if (!map.has(credentialId)) {
          map.set(credentialId, provider);
        }
      });
    });

    return map;
  }, [credentialBackedProviders]);
  const latestHistoryByCredentialId = useMemo(() => {
    const latest = new Map(aggregateLatestHistoryByCredentialId);

    // Keep operations status stable after refresh even if the aggregate history
    // query is stale or temporarily empty; each credential owns its latest run.
    latestCredentialHistoryByCredentialId.forEach((item, credentialId) => {
      latest.set(credentialId, item);
    });

    Object.entries(operationsLastTestResult).forEach(([credentialId, result]) => {
      const provider = credentialProviderById.get(credentialId);
      const planned = provider?.raw as PlannedIntegrationState | undefined;
      const ok = result.ok === true;

      // Aggregate history can lag the just-completed health check; merge a token-safe
      // optimistic item so the operations queue does not keep showing "never-tested".
      latest.set(credentialId, {
        executionId: toStringValue(result.audit_execution_id) || `connector-test-${credentialId}`,
        credentialId,
        credentialName:
          toStringValue(result.credential_name) ||
          planned?.matchedCredentialNames[0] ||
          provider?.name ||
          credentialId,
        provider: toStringValue(result.provider) || planned?.backendKey || 'unknown',
        status: ok ? 'completed' : 'failed',
        startedAt: null,
        completedAt: null,
        error: ok ? null : toStringValue(result.error) || 'Connector test failed.',
        eventTypes: [ok ? 'tool.call.completed' : 'tool.call.failed'],
      });
    });

    return latest;
  }, [
    aggregateLatestHistoryByCredentialId,
    credentialProviderById,
    latestCredentialHistoryByCredentialId,
    operationsLastTestResult,
  ]);
  const operationalItems = useMemo(
    () =>
      credentialBackedProviders
        .map((provider) => {
          const planned = provider.raw as PlannedIntegrationState | undefined;
          const credentialId = planned?.matchedCredentialIds[0] ?? '';
          const latestItem = credentialId
            ? (latestHistoryByCredentialId.get(credentialId) ?? null)
            : null;
          const state = connectorOperationsState(latestItem?.status ?? null);

          return {
            provider,
            credentialId,
            latestItem,
            state,
            timestamp: latestItem?.startedAt ?? latestItem?.completedAt ?? null,
          };
        })
        .sort((left, right) => {
          const priorityDelta =
            plannedProviderPriorityValue(left.state) - plannedProviderPriorityValue(right.state);
          if (priorityDelta !== 0) {
            return priorityDelta;
          }

          if (left.timestamp && right.timestamp) {
            return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
          }

          if (left.timestamp) return -1;
          if (right.timestamp) return 1;
          return left.provider.name.localeCompare(right.provider.name);
        }),
    [credentialBackedProviders, latestHistoryByCredentialId]
  );
  const matchingOperationalItems = useMemo(
    () =>
      operationalItems.filter(
        (item) => operationsFilter === 'all' || item.state === operationsFilter
      ),
    [operationalItems, operationsFilter]
  );
  const filteredOperationalItems = useMemo(
    () => matchingOperationalItems.slice(0, operationsVisibleCount),
    [matchingOperationalItems, operationsVisibleCount]
  );
  const healthyConnectorCount = useMemo(
    () =>
      mappedCredentialIds.filter(
        (credentialId) => latestHistoryByCredentialId.get(credentialId)?.status === 'completed'
      ).length,
    [latestHistoryByCredentialId, mappedCredentialIds]
  );
  const failingConnectorCount = useMemo(
    () =>
      mappedCredentialIds.filter(
        (credentialId) => latestHistoryByCredentialId.get(credentialId)?.status === 'failed'
      ).length,
    [latestHistoryByCredentialId, mappedCredentialIds]
  );
  const neverTestedConnectorCount =
    mappedCredentialIds.length - healthyConnectorCount - failingConnectorCount;
  const categoryForSelectedConnector = categories.find((category) =>
    category.providers.some((provider) => provider.id === selectedConnectorId)
  )?.id;
  const staleSelectedConnector = Boolean(
    categories.length > 0 && selectedConnectorId && !categoryForSelectedConnector
  );
  const resolvedSelectedConnectorId = staleSelectedConnector ? null : selectedConnectorId;
  const recordConnectorTestResult = (credentialId: string, result: Record<string, unknown>) => {
    setOperationsLastTestResult((current) => ({ ...current, [credentialId]: result }));
  };
  const operationsTestMutation = useMutation({
    mutationFn: async (credentialId: string) => connectorsApi.testConnector(credentialId),
    onMutate: (credentialId) => {
      setOperationsLastTestResult((current) => {
        const next = { ...current };
        delete next[credentialId];
        return next;
      });
    },
    onSuccess: async (result, credentialId) => {
      recordConnectorTestResult(credentialId, result);
      await Promise.all([
        aggregateHistoryQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ['connectorLatestHistory', credentialId] }),
        queryClient.invalidateQueries({ queryKey: ['connectorHistory', credentialId] }),
      ]);
      toast.success('Connector test completed.', { position: 'top-right' });
    },
    onError: (error, credentialId) => {
      recordConnectorTestResult(credentialId, {
        ok: false,
        error: error instanceof Error ? error.message : 'Connector test failed.',
      });
      toast.error(error instanceof Error ? error.message : 'Connector test failed.', {
        position: 'top-right',
      });
    },
  });
  const refreshOperationsQueue = async () => {
    await Promise.all([
      aggregateHistoryQuery.refetch(),
      ...mappedCredentialIds.map((credentialId) =>
        queryClient.invalidateQueries({ queryKey: ['connectorLatestHistory', credentialId] })
      ),
      ...mappedCredentialIds.map((credentialId) =>
        queryClient.invalidateQueries({ queryKey: ['connectorHistory', credentialId] })
      ),
    ]);
  };
  const operationsBulkTestMutation = useMutation({
    mutationFn: async (credentialIds: string[]) => {
      return await Promise.all(
        credentialIds.map(async (credentialId) => {
          try {
            const result = await connectorsApi.testConnector(credentialId);
            return { credentialId, ok: true as const, result };
          } catch (error) {
            return {
              credentialId,
              ok: false as const,
              error: error instanceof Error ? error.message : 'Connector test failed.',
            };
          }
        })
      );
    },
    onMutate: (credentialIds) => {
      setOperationsLastTestResult((current) => {
        const next = { ...current };
        credentialIds.forEach((credentialId) => {
          delete next[credentialId];
        });
        return next;
      });
    },
    onSuccess: async (results) => {
      setOperationsLastTestResult((current) => {
        const next = { ...current };
        results.forEach((result) => {
          next[result.credentialId] = result.ok
            ? result.result
            : {
                ok: false,
                error: result.error,
              };
        });
        return next;
      });
      await refreshOperationsQueue();
      const passed = results.filter((result) => result.ok).length;
      const failed = results.length - passed;
      toast.success(`Bulk connector test finished. ${passed} passed, ${failed} failed.`, {
        position: 'top-right',
      });
    },
  });

  useEffect(() => {
    if (staleSelectedConnector) {
      writeIntegrationConnectorParam(null);
    }
  }, [staleSelectedConnector]);

  const resolvedActiveTab =
    (categoryForSelectedConnector ??
      (categories.some((category) => category.id === activeTab) ? activeTab : categories[0]?.id) ??
      '') ||
    undefined;
  const activeCategory = categories.find((category) => category.id === resolvedActiveTab) ?? null;
  const selectedProvider =
    categories
      .flatMap((category) => category.providers)
      .find((provider) => provider.id === resolvedSelectedConnectorId) ?? null;
  const assistantPageContext = useMemo(() => {
    const allProviders = categories.flatMap((category) => category.providers);
    const selectedPlanned = selectedProvider?.raw as PlannedIntegrationState | undefined;
    const selectedCredentialId = selectedPlanned?.matchedCredentialIds?.[0] ?? null;
    const selectedEntity = selectedProvider
      ? {
          type: selectedProvider.kind === 'planned' ? 'connector' : selectedProvider.kind,
          id: selectedProvider.id,
          name: selectedProvider.name,
          categoryId: selectedProvider.categoryId,
          status: selectedProvider.status,
          kind: selectedProvider.kind,
        }
      : null;

    return {
      surface:
        mode === 'operations' ? ('integrations.operations' as const) : ('integrations' as const),
      title: mode === 'operations' ? 'Connector operations' : 'Providers and connectors',
      description:
        mode === 'operations'
          ? 'Operational queue for credential-backed connector health checks.'
          : 'Models, MCP servers, services, and their setup state.',
      entities: selectedEntity ? [selectedEntity] : [],
      selection: {
        mode,
        tab: resolvedActiveTab ?? null,
        integrationCategoryId: activeCategory?.id ?? null,
        integrationProviderId: selectedProvider?.id ?? null,
        connectorId: selectedProvider?.kind === 'planned' ? selectedProvider.id : null,
        credentialId: selectedCredentialId,
        toolId: selectedProvider?.kind === 'tool' ? selectedProvider.id : null,
      },
      summary: {
        loading: integrationsQuery.isLoading,
        error: integrationsQuery.isError ? integrationsQuery.error.message : null,
        categoryCount: categories.length,
        activeCategoryName: activeCategory?.name ?? null,
        providerCount: allProviders.length,
        selectedProviderName: selectedProvider?.name ?? null,
        selectedProviderKind: selectedProvider?.kind ?? null,
        selectedProviderStatus: selectedProvider?.status ?? null,
        toolCount: allProviders.filter((provider) => provider.kind === 'tool').length,
        mcpServerCount: allProviders.filter((provider) => provider.kind === 'mcp_server').length,
        modelProviderCount: allProviders.filter((provider) => provider.kind === 'model_provider')
          .length,
        modelProfileCount: allProviders.filter((provider) => provider.kind === 'model_profile')
          .length,
        plannedConnectorCount: plannedProviders.length,
        credentialBackedConnectorCount: mappedCredentialIds.length,
        healthyConnectorCount,
        failingConnectorCount,
        neverTestedConnectorCount,
        operationsFilter,
        visibleOperationsCount: filteredOperationalItems.length,
      },
      allowedActions: selectedProvider
        ? selectedProvider.kind === 'tool'
          ? ['tool.inspect', 'tool.propose_update']
          : selectedProvider.kind === 'planned'
            ? ['connector.inspect', 'connector.test']
            : ['integration.inspect']
        : ['integration.inspect'],
    };
  }, [
    activeCategory,
    categories,
    failingConnectorCount,
    filteredOperationalItems.length,
    healthyConnectorCount,
    integrationsQuery.error,
    integrationsQuery.isError,
    integrationsQuery.isLoading,
    mappedCredentialIds.length,
    mode,
    neverTestedConnectorCount,
    operationsFilter,
    plannedProviders.length,
    resolvedActiveTab,
    selectedProvider,
  ]);
  useRegisterAssistantPageContext(assistantPageContext);

  const refreshIntegrations = async () => {
    await integrationsQuery.refetch();
  };

  if (integrationsQuery.isLoading) {
    return (
      <LoadingCard title="Integrations" description="Loading available models and services." />
    );
  }

  if (integrationsQuery.isError) {
    return (
      <ErrorAlert
        title="Failed to load integrations"
        message={integrationsQuery.error.message}
        onRetry={() => integrationsQuery.refetch()}
      />
    );
  }

  if (categories.length === 0) {
    return (
      <EmptyCard
        title="No integration categories found"
        description="This backend did not return any models, services, or connector categories."
        actionLabel="Refresh"
        onAction={() => integrationsQuery.refetch()}
      />
    );
  }

  const operationsPanel = (
    <OperationsPanel
      aggregateHistoryQuery={aggregateHistoryQuery}
      mappedCredentialIds={mappedCredentialIds}
      healthyConnectorCount={healthyConnectorCount}
      failingConnectorCount={failingConnectorCount}
      neverTestedConnectorCount={neverTestedConnectorCount}
      operationsFilter={operationsFilter}
      setOperationsFilter={setOperationsFilter}
      filteredOperationalItems={filteredOperationalItems}
      matchingOperationalItems={matchingOperationalItems}
      operationsVisibleCount={operationsVisibleCount}
      setOperationsVisibleCount={setOperationsVisibleCount}
      operationsLastTestResult={operationsLastTestResult}
      operationsTestMutation={operationsTestMutation}
      operationsBulkTestMutation={operationsBulkTestMutation}
      refreshOperationsQueue={refreshOperationsQueue}
      credentialProviderById={credentialProviderById}
      categoryNameById={categoryNameById}
    />
  );

  if (mode === 'operations') {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={PlugZap}
          tone="integration"
          title="Integrations"
          description="Check saved connectors and fix any that are failing."
          actions={
            <>
              <Button type="button" variant="outline" asChild>
                <Link href="/integrations">Back to integrations</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => integrationsQuery.refetch()}
                disabled={integrationsQuery.isFetching}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${integrationsQuery.isFetching ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>
            </>
          }
        />
        {operationsPanel}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={PlugZap}
        tone="integration"
        title="Integrations"
        description="Connect the models and services your workflows need. Choose an item to set it up and test it."
        actions={
          <>
            {failingConnectorCount > 0 ? (
              <Button type="button" variant="outline" asChild>
                <Link href="/integrations?operations-filter=failing">
                  Only failing ({failingConnectorCount})
                </Link>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => integrationsQuery.refetch()}
              disabled={integrationsQuery.isFetching}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${integrationsQuery.isFetching ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </>
        }
      />

      {mappedCredentialIds.length > 0 ? operationsPanel : null}

      <Tabs
        value={resolvedActiveTab}
        onValueChange={(value) => {
          setActiveTab(writeIntegrationTabParam(value));
          if (categoryForSelectedConnector && categoryForSelectedConnector !== value) {
            setSelectedConnectorId(writeIntegrationConnectorParam(null));
          }
        }}
        className="space-y-4"
      >
        <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-[28px] border border-neutral-200 bg-linear-to-r from-white via-neutral-50 to-primary-50/35 p-2 shadow-sm dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.86),rgba(15,23,42,0.72))] dark:shadow-none">
          {categories.map((category) => (
            <TabsTrigger
              key={category.id}
              value={category.id}
              className="gap-2 rounded-2xl border border-transparent px-4 py-2.5 text-neutral-700 transition data-[state=active]:border-primary-200 data-[state=active]:bg-white data-[state=active]:text-neutral-950 data-[state=active]:shadow-sm dark:text-slate-300 dark:data-[state=active]:border-sky-400/30 dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-none"
              onClick={() => {
                setActiveTab(writeIntegrationTabParam(category.id));
                if (categoryForSelectedConnector && categoryForSelectedConnector !== category.id) {
                  setSelectedConnectorId(writeIntegrationConnectorParam(null));
                }
              }}
            >
              <span>{category.name}</span>
              <Badge variant={category.status === 'planned' ? 'secondary' : 'outline'}>
                {category.providers.length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
        {activeCategory ? (
          <TabsContent key={activeCategory.id} value={activeCategory.id}>
            <CategoryPanel
              category={activeCategory}
              onRefresh={refreshIntegrations}
              onConnectorTestResult={recordConnectorTestResult}
              latestHistoryByCredentialId={latestHistoryByCredentialId}
              selectedConnectorId={resolvedSelectedConnectorId}
              onSelectConnector={(connectorId) =>
                setSelectedConnectorId(writeIntegrationConnectorParam(connectorId))
              }
              onecliUserNamespace={onecliUserNamespace}
              connectorCapabilitiesByBackendKey={connectorCapabilitiesByBackendKey}
              selectedConnectorAction={selectedConnectorAction}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
