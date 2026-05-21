'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  credentialsApi,
  integrationsApi,
  mcpServersApi,
  providersApi,
  profileApi,
  toolsApi,
} from '@/lib/api/backend';
import { isApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/react-query/queryKeys';
import type {
  ConnectorCapabilityDefinition,
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
import { ArrowRight, Plus, RefreshCw, PlugZap, Trash2, Wrench } from 'lucide-react';
import { EmptyCard, ErrorAlert, LoadingCard } from '@/components/agent-app/StatePanels';
import { toast } from 'sonner';
import type { ToolDefinition } from '@/types/tools';

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
const LEGACY_SECRET_STORE_KEY = ['one', 'cli'].join('');
const LEGACY_SECRET_STORE_NAME = ['One', 'CLI'].join('');
const FALLBACK_CONNECTOR_METADATA: Record<string, ConnectorCapabilityDefinition> = {
  'telegram-bot': {
    backendKey: 'telegram-bot',
    displayName: 'Telegram',
    authModel: 'bot token',
    providerAliases: ['telegram'],
    healthSupported: false,
    requiredMetadata: [],
    supportedSecretRefSchemes: ['env://', 'env:'],
  },
  'whatsapp-cloud-api': {
    backendKey: 'whatsapp-cloud-api',
    displayName: 'WhatsApp Cloud API',
    authModel: 'access token',
    providerAliases: ['whatsapp', 'meta-whatsapp'],
    healthSupported: false,
    requiredMetadata: [
      {
        key: 'phone_number_id',
        description:
          'WhatsApp Cloud API requires the Meta phone number id used for message delivery and health checks.',
      },
    ],
    supportedSecretRefSchemes: ['env://', 'env:'],
  },
  'discord-bot': {
    backendKey: 'discord-bot',
    displayName: 'Discord',
    authModel: 'bot token',
    providerAliases: ['discord'],
    healthSupported: false,
    requiredMetadata: [],
    supportedSecretRefSchemes: ['env://', 'env:'],
  },
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
  return status === 'planned' ? 'credential ready' : status;
}

function toStringValue(value: unknown) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
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

function sanitizeIntegrationCopy(value?: string | null, fallback = '') {
  if (!value) return fallback;

  const legacyStoreNamePattern = new RegExp(`\\b${LEGACY_SECRET_STORE_NAME}\\b`, 'gi');
  const legacyStoreKeyPattern = new RegExp(`\\b${LEGACY_SECRET_STORE_KEY}\\b`, 'gi');
  const legacyStoreUriPattern = new RegExp(`${LEGACY_SECRET_STORE_KEY}://[^\\s),]+`, 'gi');
  const legacyManagedSetupPattern = new RegExp(
    `\\bAgency-(?:owned|managed)\\s+${LEGACY_SECRET_STORE_NAME}\\s+setup\\s+sessions?\\b`,
    'gi'
  );
  const legacySetupSessionPattern = new RegExp(
    `\\b${LEGACY_SECRET_STORE_NAME}\\s+setup\\s+sessions?\\b`,
    'gi'
  );
  const legacyCredentialSetupPattern = new RegExp(
    `\\b${LEGACY_SECRET_STORE_NAME}\\s+credential\\s+setup\\b`,
    'gi'
  );

  return value
    .replace(legacyStoreUriPattern, 'env://SECRET_REF')
    .replace(legacyManagedSetupPattern, 'backend credential references')
    .replace(legacySetupSessionPattern, 'credential reference setup')
    .replace(legacyCredentialSetupPattern, 'credential reference setup')
    .replace(legacyStoreNamePattern, 'configured secret store')
    .replace(legacyStoreKeyPattern, 'secret store');
}

function supportedFrontendSecretRefSchemes(schemes?: string[] | null) {
  const filtered = (schemes ?? []).filter(
    (scheme) => !scheme.toLowerCase().includes(LEGACY_SECRET_STORE_KEY)
  );
  return filtered.length > 0 ? filtered : ['env://', 'env:'];
}

function isUnsupportedSecretRef(value: string) {
  return value.trim().toLowerCase().startsWith(`${LEGACY_SECRET_STORE_KEY}://`);
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

  return (
    <div className="space-y-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-neutral-900">Tool capability</p>
          <p className="mt-1 text-sm text-neutral-600">
            Read-only summary for assignment and runtime planning. Edit raw tool definitions through
            the tool contract or backend tool management flow.
          </p>
        </div>
        <Button asChild type="button" variant="outline" size="sm">
          <Link href="/tools/contracts">Open contracts</Link>
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
            Tool ID
          </p>
          <p className="mt-1 break-words text-sm text-neutral-900">{provider.id}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">Type</p>
          <p className="mt-1 text-sm text-neutral-900">
            {formatDisplayLabel(tool?.tool_type) || 'Unknown'}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">Inputs</p>
          <p className="mt-1 text-sm text-neutral-900">
            {inputFields.length > 0
              ? `${inputFields.length} field${inputFields.length === 1 ? '' : 's'}`
              : 'No declared fields'}
          </p>
          {inputFields.length > 0 ? (
            <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{inputFields.join(', ')}</p>
          ) : null}
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
            Outputs
          </p>
          <p className="mt-1 text-sm text-neutral-900">
            {outputFields.length > 0
              ? `${outputFields.length} field${outputFields.length === 1 ? '' : 's'}`
              : 'Contract-defined result'}
          </p>
          {outputFields.length > 0 ? (
            <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{outputFields.join(', ')}</p>
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
                  className="min-h-[140px] font-mono text-xs"
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
                  className="min-h-[140px] font-mono text-xs"
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
  const [allowlistedCommand, setAllowlistedCommand] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const reset = () => {
    setName('');
    setTransport('stdio');
    setCommand('');
    setArgs('');
    setUrl('');
    setEnabled(false);
    setAllowlistedCommand('');
    setError(null);
  };

  const handleCreate = async () => {
    setError(null);
    setIsPending(true);
    try {
      await mcpServersApi.createMcpServer({
        name: name.trim(),
        transport,
        command: command.trim(),
        args: csvToList(args),
        url: url.trim() || null,
        enabled,
        allowlisted_command: allowlistedCommand.trim() || null,
      });
      await onCreated();
      toast.success('MCP server created.', { position: 'top-right' });
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
            <div className="grid gap-3 md:grid-cols-2">
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
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                  Allowlisted Command
                </label>
                <Input
                  value={allowlistedCommand}
                  onChange={(event) => setAllowlistedCommand(event.target.value)}
                  disabled={isPending}
                />
              </div>
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
        <Link href="/behavior-profiles">
          <ArrowRight className="mr-2 h-4 w-4" />
          Manage LLM models
        </Link>
      </Button>
    </div>
  );
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

  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-neutral-900">{preset.name}</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {rawProfile?.model ?? 'No model id set'}
          </p>
        </div>
        <Badge variant={statusVariant(preset.status)}>{providerStatusLabel(preset.status)}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">{category.name}</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Agent configuration starts here: provider connections hold endpoint/auth, model presets
            bind agents, and embedding presets can power memory retrieval.
          </p>
        </div>
        <ManageModelProfilesButton />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
            Connections
          </p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">{connections.length}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
            Model presets
          </p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">{presets.length}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
            Memory candidates
          </p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">{embeddingPresetCount}</p>
        </div>
      </div>

      {connections.length === 0 ? (
        <EmptyCard
          title="No LLM connections found"
          description="Create an LLM model to add a provider connection and first model preset."
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

            return (
              <Card key={provider.id} className="border-neutral-200 bg-neutral-50/40">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{provider.name}</CardTitle>
                      <CardDescription>
                        {sanitizeIntegrationCopy(provider.description, 'LLM provider connection')}
                      </CardDescription>
                    </div>
                    <Badge variant={statusVariant(provider.status)}>
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
                    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2">
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                        Endpoint
                      </p>
                      <p className="mt-1 break-words text-sm text-neutral-800">
                        {baseUrl || 'Not set'}
                      </p>
                    </div>
                    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2">
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                        Credentials
                      </p>
                      <p className="mt-1 text-sm text-neutral-800">
                        {provider.credentialStatus.refs.length > 0 || hasConfigApiKey
                          ? 'Configured'
                          : sanitizeIntegrationCopy(provider.credentialStatus.message)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                      Model presets
                    </p>
                    {linkedPresets.length > 0 ? (
                      <div className="space-y-2">
                        {linkedPresets.map((preset) => (
                          <LlmPresetSummary key={preset.id} preset={preset} />
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed border-neutral-300 bg-white px-3 py-3 text-sm text-neutral-500">
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
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-lg">Unlinked model presets</CardTitle>
            <CardDescription>
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

type PlannedProviderFilter = 'all' | 'needs-setup' | 'configured';

function plannedProviderReadinessState(provider: IntegrationProvider): Exclude<PlannedProviderFilter, 'all'> {
  const planned = provider.raw as PlannedIntegrationState | undefined;
  const hasCredentials = (planned?.matchedCredentialIds.length ?? 0) > 0;

  return hasCredentials ? 'configured' : 'needs-setup';
}

function plannedProviderPriorityValue(state: Exclude<PlannedProviderFilter, 'all'>) {
  switch (state) {
    case 'needs-setup':
      return 0;
    case 'configured':
      return 1;
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
  if (value === 'needs-setup' || value === 'configured') {
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

function plannedReadinessLabel(state: PlannedProviderFilter) {
  switch (state) {
    case 'configured':
      return 'configured';
    case 'needs-setup':
      return 'needs setup';
    default:
      return state;
  }
}

function plannedReadinessBadgeVariant(
  state: PlannedProviderFilter
): 'successful' | 'outline' | 'secondary' {
  switch (state) {
    case 'configured':
      return 'successful';
    case 'needs-setup':
      return 'secondary';
    default:
      return 'outline';
  }
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
      supportedSecretRefSchemes: ['env://', 'env:'],
    }
  );
}

function buildIntegrationConnectorUrl(categoryId: string, connectorId: string) {
  if (typeof window === 'undefined') {
    return '';
  }

  const url = new URL(window.location.href);
  url.searchParams.set('integration-tab', categoryId);
  url.searchParams.set('integration-connector', connectorId);
  return `${url.pathname}${url.search}${url.hash}`;
}

function PlannedProviderCard({
  provider,
  onRefresh,
  isSelected,
  onSelect,
  readinessState,
}: {
  provider: IntegrationProvider;
  onRefresh: () => Promise<void>;
  isSelected: boolean;
  onSelect: (connectorId: string) => void;
  readinessState: PlannedProviderFilter;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();
  const planned = provider.raw as PlannedIntegrationState | undefined;
  const backendKey = planned?.backendKey ?? '';
  const matchedCredentialId = planned?.matchedCredentialIds[0] ?? null;
  const hasCredentials = (planned?.matchedCredentialIds.length ?? 0) > 0;
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(provider.name);
  const [secretRef, setSecretRef] = useState('');
  const [metadataValues, setMetadataValues] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const connectorUrl = buildIntegrationConnectorUrl(provider.categoryId, provider.id);

  const schemaQuery = useQuery({
    queryKey: ['connectorCredentialSchema', backendKey],
    queryFn: (): Promise<ConnectorCapabilityDefinition> =>
      credentialsApi.getConnectorCredentialSchema(backendKey),
    enabled: Boolean(backendKey) && hasCredentials,
    retry: false,
  });

  const existingCredentialQuery = useQuery({
    queryKey: ['connectorCredential', matchedCredentialId],
    queryFn: (): Promise<CredentialDefinition> =>
      credentialsApi.getCredential(matchedCredentialId as string),
    enabled: false,
    retry: false,
  });

  const openSetupDialog = async () => {
    setIsOpen(true);
    setSaveError(null);

    const [schemaResult, existingCredentialResult] = await Promise.all([
      backendKey ? schemaQuery.refetch() : Promise.resolve({ data: null }),
      matchedCredentialId ? existingCredentialQuery.refetch() : Promise.resolve({ data: null }),
    ]);

    const existingCredential = existingCredentialResult.data ?? null;
    const requiredMetadata = schemaResult.data?.requiredMetadata ?? [];
    const sourceMetadata = existingCredential?.metadata ?? {};

    setName(existingCredential?.name ?? provider.name);
    setSecretRef(
      existingCredential?.secret_ref && !isUnsupportedSecretRef(existingCredential.secret_ref)
        ? existingCredential.secret_ref
        : ''
    );
    setMetadataValues(
      Object.fromEntries(
        requiredMetadata.map((requirement) => [
          requirement.key,
          toStringValue(sourceMetadata[requirement.key]),
        ])
      )
    );
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      setSaveError(null);
      const metadata = Object.fromEntries(
        Object.entries(metadataValues)
          .map(([key, value]) => [key, value.trim()])
          .filter(([, value]) => Boolean(value))
      );
      const payload = {
        provider: backendKey,
        name: name.trim(),
        secret_ref: secretRef.trim(),
        metadata,
      };
      if (matchedCredentialId) {
        return credentialsApi.updateConnectorCredential(matchedCredentialId, payload);
      }
      return credentialsApi.createConnectorCredential(backendKey, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.backendIntegrations() });
      await onRefresh();
      toast.success(matchedCredentialId ? 'Connector credential updated.' : 'Connector credential created.', {
        position: 'top-right',
      });
      setIsOpen(false);
    },
    onError: (error) => {
      if (isApiError(error) && error.status === 404) {
        setSaveError(
          'Connector setup is not available from the running Agency backend yet. Restart the backend and try again.'
        );
        return;
      }
      setSaveError(error instanceof Error ? error.message : 'Failed to save connector credential.');
    },
  });

  const effectiveCapability: ConnectorCapabilityDefinition =
    schemaQuery.data ?? fallbackConnectorCapability(provider, planned);
  const requiredMetadata = effectiveCapability.requiredMetadata ?? [];
  const supportedSecretRefSchemes = supportedFrontendSecretRefSchemes(
    effectiveCapability.supportedSecretRefSchemes
  );
  const secretRefPlaceholder = `${supportedSecretRefSchemes[0] ?? 'env://'}${backendKey
    .replace(/[^A-Za-z0-9]+/g, '_')
    .toUpperCase()}_TOKEN`;

  useEffect(() => {
    if (isSelected) {
      cardRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [isSelected]);

  const handleCardActionClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  const handleCardActionKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  const handleCopyLink = async (event: MouseEvent<HTMLButtonElement>) => {
    handleCardActionClick(event);

    try {
      await navigator.clipboard.writeText(connectorUrl);
      toast.success('Connector link copied.', { position: 'top-right' });
    } catch (error) {
      console.error('Unable to copy connector link.', error);
      toast.error('Copy link failed.', { position: 'top-right' });
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
        className={`border-dashed bg-neutral-50/60 transition-colors ${
          isSelected ? 'border-primary-500 ring-2 ring-primary-100' : 'border-neutral-300'
        }`}
        onClick={() => onSelect(provider.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect(provider.id);
          }
        }}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">{provider.name}</CardTitle>
              <CardDescription>
                {sanitizeIntegrationCopy(provider.description, 'Connector credential.')}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Connector credential</Badge>
              <Badge
                data-testid={`planned-provider-status-${provider.id}`}
                variant={plannedReadinessBadgeVariant(readinessState)}
              >
                {plannedReadinessLabel(readinessState)}
              </Badge>
              {hasCredentials ? <Badge variant="successful">credentials ready</Badge> : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Backend key: {planned?.backendKey || 'tbd'}</Badge>
            <Badge variant="outline">Auth: {planned?.authModel || 'tbd'}</Badge>
            <Badge variant="outline">Priority: {priorityLabel(planned?.launchPriority)}</Badge>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-sm font-medium text-neutral-900">Credential inventory</p>
            <p className="mt-1 text-sm text-neutral-600">
              {sanitizeIntegrationCopy(provider.credentialStatus.message)}
            </p>
            {planned?.matchedCredentialNames.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {planned.matchedCredentialNames.map((credentialName) => (
                  <Badge key={credentialName} variant="outline">
                    {credentialName}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-sm font-medium text-neutral-900">Connector setup</p>
            <p className="mt-1 text-sm text-neutral-600">
              Save a connector credential reference supported by the Open-Agency backend.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                className="agency-gradient text-white hover:brightness-105"
                onClick={(event) => {
                  handleCardActionClick(event);
                  void openSetupDialog();
                }}
                onKeyDown={handleCardActionKeyDown}
              >
                {hasCredentials ? 'Update credential' : 'Add credential'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={(event) => void handleCopyLink(event)}
                onKeyDown={handleCardActionKeyDown}
              >
                Copy link
              </Button>
            </div>
          </div>
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
              {hasCredentials ? `Update ${provider.name} credential` : `Add ${provider.name} credential`}
            </DialogTitle>
            <DialogDescription>
              Backend key `{backendKey}`. Save a credential reference that already exists in your
              configured secret store.
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

              <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">Secret reference</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      Enter a reference to a secret that already exists in your configured secret
                      store. Raw tokens, passwords, and API keys are rejected by the backend.
                    </p>
                  </div>
                  <Badge variant="outline">Credential-backed</Badge>
                </div>
                <Input
                  aria-label="Secret reference"
                  placeholder={secretRefPlaceholder}
                  value={secretRef}
                  onChange={(event) => setSecretRef(event.target.value)}
                  disabled={saveMutation.isPending}
                />
                <p className="text-xs text-neutral-500">
                  Supported schemes: {supportedSecretRefSchemes.join(', ')}
                </p>
              </div>

              {requiredMetadata.length > 0 ? (
                <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="text-sm font-medium text-neutral-900">Required metadata</p>
                  {requiredMetadata.map((requirement) => (
                    <div key={requirement.key} className="space-y-1">
                      <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
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
                        disabled={saveMutation.isPending}
                      />
                      <p className="text-xs text-neutral-500">
                        {sanitizeIntegrationCopy(requirement.description)}
                      </p>
                    </div>
                  ))}
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
                saveMutation.isPending ||
                schemaQuery.isLoading ||
                !name.trim() ||
                !secretRef.trim() ||
                isUnsupportedSecretRef(secretRef) ||
                requiredMetadata.some(
                  (requirement) => !(metadataValues[requirement.key] ?? '').trim()
                )
              }
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending
                ? hasCredentials
                  ? 'Saving...'
                  : 'Saving...'
                : hasCredentials
                  ? 'Update credential'
                  : 'Save credential'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saveMutation.isPending}
              onClick={() => setIsOpen(false)}
            >
              Cancel
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
  selectedConnectorId,
  onSelectConnector,
}: {
  category: IntegrationCategory;
  onRefresh: () => Promise<void>;
  selectedConnectorId: string | null;
  onSelectConnector: (connectorId: string | null) => void;
}) {
  const [activeFilter, setActiveFilter] = useState<PlannedProviderFilter>(() =>
    readPlannedCategoryFilter(category.id)
  );
  const configuredCount = category.providers.filter(
    (provider) => provider.status === 'configured'
  ).length;
  const needsSetupCount = category.providers.filter((provider) => {
    const planned = provider.raw as PlannedIntegrationState | undefined;
    return (planned?.matchedCredentialIds.length ?? 0) === 0;
  }).length;
  const configuredConnectorCount = category.providers.length - needsSetupCount;
  const filteredProviders = category.providers
    .map((provider) => {
      const readinessState = plannedProviderReadinessState(provider);
      return {
        provider,
        readinessState,
      };
    })
    .filter(({ provider, readinessState }) => {
      if (selectedConnectorId && provider.id === selectedConnectorId) {
        return true;
      }
      return activeFilter === 'all' || readinessState === activeFilter;
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
    .map(({ provider, readinessState }) => ({ provider, readinessState }));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">{category.name}</h2>
          <p className="mt-1 max-w-3xl text-sm text-neutral-500">
            {sanitizeIntegrationCopy(category.description)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{category.providers.length} credential-ready</Badge>
          <Badge variant="outline">{configuredCount} credential-backed</Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'All', count: category.providers.length },
          { key: 'needs-setup', label: 'Needs setup', count: needsSetupCount },
          { key: 'configured', label: 'Configured', count: configuredConnectorCount },
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
            }}
            className={
              activeFilter === filter.key ? 'agency-gradient text-white hover:brightness-105' : ''
            }
          >
            {filter.label} ({filter.count})
          </Button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {filteredProviders.map(({ provider, readinessState }) => (
          <PlannedProviderCard
            key={provider.id}
            provider={provider}
            onRefresh={onRefresh}
            isSelected={provider.id === selectedConnectorId}
            onSelect={onSelectConnector}
            readinessState={readinessState}
          />
        ))}
      </div>
      {filteredProviders.length === 0 ? (
        <EmptyCard
          title="No connectors match this filter"
          description="Try another readiness filter to inspect other connector credentials in this category."
        />
      ) : null}
    </div>
  );
}

function ProviderEditor({
  provider,
  onRefresh,
}: {
  provider: IntegrationProvider;
  onRefresh: () => Promise<void>;
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

  return (
    <Card className="border-neutral-200">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{provider.name}</CardTitle>
            <CardDescription>
              {sanitizeIntegrationCopy(provider.description, 'No provider description available.')}
            </CardDescription>
          </div>
          <Badge variant={statusVariant(provider.status)}>
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
              <p className="text-sm font-medium text-neutral-900">Configuration snapshot</p>
              {provider.configFields.map((field) => (
                <div
                  key={field.key}
                  className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2"
                >
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                    {field.label}
                  </p>
                  <p className="mt-1 break-words text-sm text-neutral-800">
                    {toStringValue(field.value) || 'Not set'}
                  </p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-sm font-medium text-neutral-900">Credential handling</p>
              <p className="mt-1 text-sm text-neutral-600">
                {sanitizeIntegrationCopy(provider.credentialStatus.message)}
              </p>
              {provider.credentialStatus.refs.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {provider.credentialStatus.refs.map((reference) => (
                    <Badge key={reference.name} variant="outline">
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
                <p className="text-sm font-medium text-neutral-900">
                  Required / available configuration
                </p>
                {provider.configFields.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
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
                        className="min-h-[96px]"
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
                      <p className="text-xs text-neutral-500">
                        {sanitizeIntegrationCopy(field.description)}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">
                No configuration schema is currently exposed for this provider.
              </p>
            )}

            {provider.kind !== 'tool' ? (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-sm font-medium text-neutral-900">Credential handling</p>
                <p className="mt-1 text-sm text-neutral-600">
                  {sanitizeIntegrationCopy(provider.credentialStatus.message)}
                </p>
                {!credentialCapability.writeSupported ? (
                  <p className="mt-2 text-xs text-neutral-500">
                    {sanitizeIntegrationCopy(credentialCapability.message)}
                  </p>
                ) : null}
                {provider.credentialStatus.refs.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {provider.credentialStatus.refs.map((reference) => (
                      <Badge key={reference.name} variant="outline">
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
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
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
  selectedConnectorId,
  onSelectConnector,
}: {
  category: IntegrationCategory;
  onRefresh: () => Promise<void>;
  selectedConnectorId: string | null;
  onSelectConnector: (connectorId: string | null) => void;
}) {
  if (category.id === 'llm-models') {
    return <LlmModelsInventoryPanel category={category} />;
  }

  if (category.status === 'planned') {
    return (
      <PlannedCategoryPanel
        category={category}
        onRefresh={onRefresh}
        selectedConnectorId={selectedConnectorId}
        onSelectConnector={onSelectConnector}
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
          description={sanitizeIntegrationCopy(category.description)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">{category.name}</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {sanitizeIntegrationCopy(category.description)}
          </p>
        </div>
        {category.id === 'custom' ? (
          <div className="flex flex-wrap gap-2">
            <CreateToolCard onCreated={onRefresh} />
            <CreateMcpServerCard onCreated={onRefresh} />
          </div>
        ) : null}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {category.providers.map((provider) => (
          <ProviderEditor key={provider.id} provider={provider} onRefresh={onRefresh} />
        ))}
      </div>
    </div>
  );
}

export default function IntegrationsWorkspace() {
  const integrationsQuery = useQuery({
    queryKey: queryKeys.backendIntegrations(),
    queryFn: (): Promise<IntegrationCatalogPayload> => integrationsApi.listCategories(),
  });

  const [activeTab, setActiveTab] = useState<string | null>(() => readIntegrationTabParam());
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(() =>
    readIntegrationConnectorParam()
  );
  const categories = useMemo(
    () => integrationsQuery.data?.categories ?? [],
    [integrationsQuery.data]
  );
  const categoryForSelectedConnector = categories.find((category) =>
    category.providers.some((provider) => provider.id === selectedConnectorId)
  )?.id;
  const staleSelectedConnector = Boolean(
    categories.length > 0 && selectedConnectorId && !categoryForSelectedConnector
  );
  const resolvedSelectedConnectorId = staleSelectedConnector ? null : selectedConnectorId;
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
  const refreshIntegrations = async () => {
    await integrationsQuery.refetch();
  };

  if (integrationsQuery.isLoading) {
    return (
      <LoadingCard
        title="Integrations"
        description="Loading backend-backed integration categories."
      />
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
        description="The backend did not return any supported integration/provider route groups."
        actionLabel="Refresh"
        onAction={() => integrationsQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Integrations"
        title="Providers and connectors"
        description="Configured LLM models, tools, MCP servers, and connector credentials. Connector categories can store backend credential references when the backend exposes a connector schema."
        actions={
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
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-neutral-200 bg-neutral-50/40">
          <CardContent className="px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
              Categories
            </p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">{categories.length}</p>
          </CardContent>
        </Card>
        <Card className="border-neutral-200 bg-neutral-50/40">
          <CardContent className="px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
              Backend-backed
            </p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">
              {categories.filter((category) => category.status === 'supported').length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-neutral-200 bg-neutral-50/40">
          <CardContent className="px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
              Connector credentials
            </p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">
              {categories
                .filter((category) => category.status === 'planned')
                .reduce((count, category) => count + category.providers.length, 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs
        value={resolvedActiveTab}
        onValueChange={(value) => {
          setActiveTab(writeIntegrationTabParam(value));
          if (categoryForSelectedConnector && categoryForSelectedConnector !== value) {
            setSelectedConnectorId(writeIntegrationConnectorParam(null));
          }
        }}
      >
        <TabsList className="h-auto flex-wrap justify-start">
          {categories.map((category) => (
            <TabsTrigger
              key={category.id}
              value={category.id}
              className="gap-2"
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
        {categories.map((category) => (
          <TabsContent key={category.id} value={category.id}>
            <CategoryPanel
              category={category}
              onRefresh={refreshIntegrations}
              selectedConnectorId={resolvedSelectedConnectorId}
              onSelectConnector={(connectorId) =>
                setSelectedConnectorId(writeIntegrationConnectorParam(connectorId))
              }
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
