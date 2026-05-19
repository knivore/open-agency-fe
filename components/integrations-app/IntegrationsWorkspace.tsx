'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  connectorsApi,
  credentialsApi,
  integrationsApi,
  mcpServersApi,
  providersApi,
  profileApi,
  toolsApi,
} from '@/lib/api/backend';
import { queryKeys } from '@/lib/react-query/queryKeys';
import type {
  ConnectorCapabilityDefinition,
  ConnectorHealthHistoryPayload,
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
type OperationsFilter = 'all' | 'failing' | 'healthy' | 'never-tested';
const OPERATIONS_PAGE_SIZE = 5;
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

function formatRegistryTimestamp(value?: string | null) {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
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
        <Badge variant={statusVariant(preset.status)}>{preset.status}</Badge>
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
                        {provider.description || 'LLM provider connection'}
                      </CardDescription>
                    </div>
                    <Badge variant={statusVariant(provider.status)}>{provider.status}</Badge>
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
                          : provider.credentialStatus.message}
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
      return 'healthy';
    case 'failing':
      return 'failing';
    case 'never-tested':
      return 'never tested';
    case 'needs-setup':
      return 'needs setup';
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

function openIntegrationConnector(categoryId: string, connectorId: string) {
  persistIntegrationTabParam(categoryId);
  persistIntegrationConnectorParam(connectorId);
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
  const [lastHealthResult, setLastHealthResult] = useState<Record<string, unknown> | null>(null);
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

  const historyQuery = useQuery({
    queryKey: ['connectorHistory', matchedCredentialId],
    queryFn: (): Promise<ConnectorHealthHistoryPayload> =>
      connectorsApi.getConnectorHistory(matchedCredentialId as string),
    enabled: Boolean(matchedCredentialId),
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
      typeof existingCredential?.secret_ref === 'string' ? existingCredential.secret_ref : ''
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
      const validation = await credentialsApi.validateConnectorCredential(backendKey, payload);
      if (!validation.valid) {
        throw new Error(validation.errors.join(' ') || 'Connector credential payload is invalid.');
      }
      if (matchedCredentialId) {
        return credentialsApi.updateConnectorCredential(matchedCredentialId, payload);
      }
      return credentialsApi.createConnectorCredential(backendKey, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.backendIntegrations() });
      await onRefresh();
      toast.success(
        hasCredentials ? 'Connector credential updated.' : 'Connector credential saved.',
        { position: 'top-right' }
      );
      setIsOpen(false);
    },
    onError: (error) => {
      setSaveError(error instanceof Error ? error.message : 'Failed to save connector credential.');
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
      void historyQuery.refetch();
      toast.success('Connector test completed.', { position: 'top-right' });
    },
    onError: (error) => {
      setLastHealthResult({
        ok: false,
        error: error instanceof Error ? error.message : 'Connector test failed.',
      });
    },
  });

  const effectiveCapability: ConnectorCapabilityDefinition =
    schemaQuery.data ?? fallbackConnectorCapability(provider, planned);
  const requiredMetadata = effectiveCapability.requiredMetadata ?? [];
  const secretSchemes = effectiveCapability.supportedSecretRefSchemes ?? [];
  const healthSupported = Boolean(effectiveCapability.healthSupported);
  const lastHealthOk = lastHealthResult?.ok === true;
  const historyItems = historyQuery.data?.items ?? [];

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
              <CardDescription>{provider.description || 'Planned connector.'}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">planned</Badge>
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
            <p className="mt-1 text-sm text-neutral-600">{provider.credentialStatus.message}</p>
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
              Save backend credential metadata for this connector. Use a secret reference such as
              `env://VAR_NAME` or your configured secret-store ref, not a raw token.
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
                {hasCredentials ? 'Update credential' : 'Set up connector'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={(event) => void handleCopyLink(event)}
                onKeyDown={handleCardActionKeyDown}
              >
                Copy link
              </Button>
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
            </div>
          </div>
          {lastHealthResult ? (
            <div
              className={`rounded-xl border p-4 ${lastHealthOk ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-neutral-900">Latest connector test</p>
                  <p className="mt-1 text-sm text-neutral-600">
                    {lastHealthOk
                      ? 'Backend health check succeeded for the saved connector credential.'
                      : toStringValue(lastHealthResult.error) || 'Backend health check failed.'}
                  </p>
                </div>
                <Badge variant={lastHealthOk ? 'successful' : 'failed'}>
                  {lastHealthOk ? 'healthy' : 'failed'}
                </Badge>
              </div>
              {'audit_execution_id' in lastHealthResult ? (
                <p className="mt-3 text-xs text-neutral-500">
                  Audit execution: {toStringValue(lastHealthResult.audit_execution_id)}
                </p>
              ) : null}
            </div>
          ) : null}
          {hasCredentials ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-neutral-900">Recent test history</p>
                  <p className="mt-1 text-sm text-neutral-600">
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
                <p className="mt-3 text-sm text-neutral-500">Loading connector history…</p>
              ) : historyQuery.isError ? (
                <p className="mt-3 text-sm text-red-600">{historyQuery.error.message}</p>
              ) : historyItems.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {historyItems.slice(0, 3).map((item) => (
                    <div
                      key={item.executionId}
                      className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-neutral-900">
                            {formatShortTimestamp(item.startedAt ?? item.completedAt ?? null)}
                          </p>
                          <p className="mt-1 text-xs text-neutral-500">{item.executionId}</p>
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
                        <p className="mt-2 text-sm text-neutral-600">No error recorded.</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-neutral-500">
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
              {hasCredentials ? `Update ${provider.name} credential` : `Set up ${provider.name}`}
            </DialogTitle>
            <DialogDescription>
              Backend key `{backendKey}`. Save a credential reference that the backend can validate
              and use for connector health checks.
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
              {schemaQuery.isError ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-medium text-amber-900">Schema unavailable</p>
                  <p className="mt-1 text-sm text-amber-800">
                    Falling back to planned connector metadata for setup. You can still save the
                    credential and let backend validation enforce any missing requirements.
                  </p>
                  <p className="mt-2 text-xs text-amber-700">{schemaQuery.error.message}</p>
                  {requiredMetadata.length > 0 ? (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-white/70 p-3">
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-amber-900">
                        Fallback setup fields
                      </p>
                      <ul className="mt-2 space-y-1 text-sm text-amber-900">
                        {requiredMetadata.map((requirement) => (
                          <li key={requirement.key}>
                            <span className="font-medium">{requirement.key}</span>:{' '}
                            {requirement.description}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
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

              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                  Secret Reference
                </label>
                <Input
                  aria-label="Secret Reference"
                  value={secretRef}
                  onChange={(event) => setSecretRef(event.target.value)}
                  disabled={saveMutation.isPending}
                  placeholder={
                    secretSchemes.includes('env')
                      ? 'env://TELEGRAM_BOT_TOKEN'
                      : 'secret://provider/key'
                  }
                />
                <p className="text-xs text-neutral-500">
                  Supported schemes:{' '}
                  {secretSchemes.length ? secretSchemes.join(', ') : 'secret store refs only'}
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
                      <p className="text-xs text-neutral-500">{requirement.description}</p>
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
                requiredMetadata.some(
                  (requirement) => !(metadataValues[requirement.key] ?? '').trim()
                )
              }
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending
                ? 'Saving...'
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
  latestHistoryByCredentialId,
  categoryHistoryLoading,
  selectedConnectorId,
  onSelectConnector,
}: {
  category: IntegrationCategory;
  onRefresh: () => Promise<void>;
  latestHistoryByCredentialId: Map<string, ConnectorHealthHistoryPayload['items'][number]>;
  categoryHistoryLoading: boolean;
  selectedConnectorId: string | null;
  onSelectConnector: (connectorId: string | null) => void;
}) {
  const [activeFilter, setActiveFilter] = useState<PlannedProviderFilter>(() =>
    readPlannedCategoryFilter(category.id)
  );
  const configuredCount = category.providers.filter(
    (provider) => provider.status === 'configured'
  ).length;
  const mappedCredentialIds = category.providers
    .flatMap(
      (provider) =>
        (provider.raw as PlannedIntegrationState | undefined)?.matchedCredentialIds ?? []
    )
    .filter((value, index, array) => Boolean(value) && array.indexOf(value) === index);
  const nowCount = category.providers.filter((provider) => {
    const planned = provider.raw as PlannedIntegrationState | undefined;
    return planned?.launchPriority === 'now';
  }).length;
  const nextCount = category.providers.filter((provider) => {
    const planned = provider.raw as PlannedIntegrationState | undefined;
    return planned?.launchPriority === 'next';
  }).length;
  const laterCount = category.providers.filter((provider) => {
    const planned = provider.raw as PlannedIntegrationState | undefined;
    return !planned?.launchPriority || planned.launchPriority === 'later';
  }).length;
  const latestStatusByCredentialId = new Map(
    mappedCredentialIds.map((credentialId) => [
      credentialId,
      latestHistoryByCredentialId.get(credentialId)?.status ?? null,
    ])
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
  const filteredProviders = category.providers
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
          <p className="mt-1 max-w-3xl text-sm text-neutral-500">{category.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{category.providers.length} planned</Badge>
          <Badge variant="outline">{configuredCount} credential-backed</Badge>
        </div>
      </div>

      {/*<div className="grid gap-3 md:grid-cols-4">*/}
      {/*  <Card className="border-neutral-200 bg-neutral-50/40">*/}
      {/*    <CardContent className="px-5 py-4">*/}
      {/*      <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">*/}
      {/*        Ship Now*/}
      {/*      </p>*/}
      {/*      <p className="mt-2 text-2xl font-semibold text-neutral-900">{nowCount}</p>*/}
      {/*    </CardContent>*/}
      {/*  </Card>*/}
      {/*  <Card className="border-neutral-200 bg-neutral-50/40">*/}
      {/*    <CardContent className="px-5 py-4">*/}
      {/*      <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">*/}
      {/*        Next Wave*/}
      {/*      </p>*/}
      {/*      <p className="mt-2 text-2xl font-semibold text-neutral-900">{nextCount}</p>*/}
      {/*    </CardContent>*/}
      {/*  </Card>*/}
      {/*  <Card className="border-neutral-200 bg-neutral-50/40">*/}
      {/*    <CardContent className="px-5 py-4">*/}
      {/*      <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">*/}
      {/*        Later*/}
      {/*      </p>*/}
      {/*      <p className="mt-2 text-2xl font-semibold text-neutral-900">{laterCount}</p>*/}
      {/*    </CardContent>*/}
      {/*  </Card>*/}
      {/*  <Card className="border-neutral-200 bg-neutral-50/40">*/}
      {/*    <CardContent className="px-5 py-4">*/}
      {/*      <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">*/}
      {/*        Credential-backed*/}
      {/*      </p>*/}
      {/*      <p className="mt-2 text-2xl font-semibold text-neutral-900">{configuredCount}</p>*/}
      {/*    </CardContent>*/}
      {/*  </Card>*/}
      {/*</div>*/}

      {/*<div className="rounded-xl border border-neutral-200 bg-white px-5 py-4">*/}
      {/*  <div className="flex items-start justify-between gap-3">*/}
      {/*    <div>*/}
      {/*      <p className="text-sm font-medium text-neutral-900">Connector health summary</p>*/}
      {/*      <p className="mt-1 text-sm text-neutral-600">*/}
      {/*        Latest backend audit status across credential-backed connectors in this category.*/}
      {/*      </p>*/}
      {/*    </div>*/}
      {/*    {categoryHistoryLoading ? <Badge variant="outline">Refreshing…</Badge> : null}*/}
      {/*  </div>*/}
      {/*  <div className="mt-4 grid gap-3 md:grid-cols-3">*/}
      {/*    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">*/}
      {/*      <p className="text-xs font-medium uppercase tracking-[0.14em] text-emerald-700">*/}
      {/*        Healthy*/}
      {/*      </p>*/}
      {/*      <p*/}
      {/*        data-testid="planned-category-healthy-count"*/}
      {/*        className="mt-2 text-2xl font-semibold text-emerald-900"*/}
      {/*      >*/}
      {/*        {healthyCount}*/}
      {/*      </p>*/}
      {/*    </div>*/}
      {/*    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">*/}
      {/*      <p className="text-xs font-medium uppercase tracking-[0.14em] text-red-700">Failing</p>*/}
      {/*      <p*/}
      {/*        data-testid="planned-category-failing-count"*/}
      {/*        className="mt-2 text-2xl font-semibold text-red-900"*/}
      {/*      >*/}
      {/*        {failingCount}*/}
      {/*      </p>*/}
      {/*    </div>*/}
      {/*    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">*/}
      {/*      <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">*/}
      {/*        Never tested*/}
      {/*      </p>*/}
      {/*      <p*/}
      {/*        data-testid="planned-category-never-tested-count"*/}
      {/*        className="mt-2 text-2xl font-semibold text-neutral-900"*/}
      {/*      >*/}
      {/*        {neverTestedCount}*/}
      {/*      </p>*/}
      {/*    </div>*/}
      {/*  </div>*/}
      {/*</div>*/}

      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'All', count: category.providers.length },
          { key: 'needs-setup', label: 'Needs setup', count: needsSetupCount },
          { key: 'healthy', label: 'Healthy', count: healthyCount },
          { key: 'failing', label: 'Failing', count: failingCount },
          { key: 'never-tested', label: 'Never tested', count: neverTestedCount },
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
          description="Try another readiness filter to inspect other planned connectors in this category."
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
              {provider.description || 'No provider description available.'}
            </CardDescription>
          </div>
          <Badge variant={statusVariant(provider.status)}>{provider.status}</Badge>
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
              <p className="mt-1 text-sm text-neutral-600">{provider.credentialStatus.message}</p>
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
                      <p className="text-xs text-neutral-500">{field.description}</p>
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
                <p className="mt-1 text-sm text-neutral-600">{provider.credentialStatus.message}</p>
                {!credentialCapability.writeSupported ? (
                  <p className="mt-2 text-xs text-neutral-500">{credentialCapability.message}</p>
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
  latestHistoryByCredentialId,
  categoryHistoryLoading,
  selectedConnectorId,
  onSelectConnector,
}: {
  category: IntegrationCategory;
  onRefresh: () => Promise<void>;
  latestHistoryByCredentialId: Map<string, ConnectorHealthHistoryPayload['items'][number]>;
  categoryHistoryLoading: boolean;
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
        latestHistoryByCredentialId={latestHistoryByCredentialId}
        categoryHistoryLoading={categoryHistoryLoading}
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
          description={category.description}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">{category.name}</h2>
          <p className="mt-1 text-sm text-neutral-500">{category.description}</p>
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
    <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-neutral-900">Connector operations</p>
          <p className="mt-1 text-sm text-neutral-600">
            Latest backend health state across configured planned connectors.
          </p>
        </div>
        {aggregateHistoryQuery.isLoading || aggregateHistoryQuery.isFetching ? (
          <Badge variant="outline">Refreshing…</Badge>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
            Credential-backed
          </p>
          <p
            data-testid="operations-credential-backed-count"
            className="mt-2 text-2xl font-semibold text-neutral-900"
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
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
            Never tested
          </p>
          <p
            data-testid="operations-never-tested-count"
            className="mt-2 text-2xl font-semibold text-neutral-900"
          >
            {neverTestedConnectorCount}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-neutral-900">Recent connector runs</p>
            <p className="mt-1 text-sm text-neutral-600">
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
              const planned = provider?.raw as PlannedIntegrationState | undefined;
              return (
                <div
                  key={`${provider?.id ?? item.credentialId}-${item.latestItem?.executionId ?? 'never-tested'}`}
                  data-testid={`operations-row-${item.credentialId}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900">
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
                    <p className="mt-1 text-xs text-neutral-500">
                      {formatShortTimestamp(item.timestamp)}
                    </p>
                    {item.latestItem?.error ? (
                      <p className="mt-2 text-sm text-red-600">{item.latestItem.error}</p>
                    ) : item.state === 'never-tested' ? (
                      <p className="mt-2 text-sm text-neutral-600">
                        No connector test runs recorded yet.
                      </p>
                    ) : null}
                    {lastTestResult ? (
                      <p
                        className={`mt-2 text-sm ${lastTestOk ? 'text-emerald-700' : 'text-red-600'}`}
                      >
                        {lastTestOk
                          ? `Latest queue test succeeded${lastTestResult.audit_execution_id ? ` · ${toStringValue(lastTestResult.audit_execution_id)}` : ''}`
                          : toStringValue(lastTestResult.error) || 'Latest queue test failed.'}
                      </p>
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
              : 'No credential-backed planned connectors yet.'}
          </p>
        )}
      </div>
    </div>
  );
}

export default function IntegrationsWorkspace({ mode = 'full' }: { mode?: 'full' | 'operations' }) {
  const queryClient = useQueryClient();
  const integrationsQuery = useQuery({
    queryKey: queryKeys.backendIntegrations(),
    queryFn: (): Promise<IntegrationCatalogPayload> => integrationsApi.listCategories(),
  });

  const [activeTab, setActiveTab] = useState<string | null>(() => readIntegrationTabParam());
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(() =>
    readIntegrationConnectorParam()
  );
  const [operationsFilter, setOperationsFilter] = useState<OperationsFilter>(() =>
    readOperationsFilterParam()
  );
  const [operationsVisibleCount, setOperationsVisibleCount] = useState(OPERATIONS_PAGE_SIZE);
  const [operationsLastTestResult, setOperationsLastTestResult] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const categories = useMemo(
    () => integrationsQuery.data?.categories ?? [],
    [integrationsQuery.data]
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
  const latestHistoryByCredentialId = useMemo(
    () => latestConnectorHistoryByCredential(aggregateHistoryQuery.data?.items ?? []),
    [aggregateHistoryQuery.data]
  );
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
      setOperationsLastTestResult((current) => ({ ...current, [credentialId]: result }));
      await Promise.all([
        aggregateHistoryQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ['connectorHistory', credentialId] }),
      ]);
      toast.success('Connector test completed.', { position: 'top-right' });
    },
    onError: (error, credentialId) => {
      setOperationsLastTestResult((current) => ({
        ...current,
        [credentialId]: {
          ok: false,
          error: error instanceof Error ? error.message : 'Connector test failed.',
        },
      }));
      toast.error(error instanceof Error ? error.message : 'Connector test failed.', {
        position: 'top-right',
      });
    },
  });
  const refreshOperationsQueue = async () => {
    await Promise.all([
      aggregateHistoryQuery.refetch(),
      ...mappedCredentialIds.map((credentialId) =>
        queryClient.invalidateQueries({ queryKey: ['connectorHistory', credentialId] })
      ),
    ]);
  };
  const operationsBulkTestMutation = useMutation({
    mutationFn: async (credentialIds: string[]) => {
      const results = await Promise.all(
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
      return results;
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
  const registrySource = integrationsQuery.data?.registrySource ?? 'fallback';
  const registryUpdatedAt = formatRegistryTimestamp(
    integrationsQuery.data?.registryUpdatedAt ?? null
  );
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
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
              Integrations
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-neutral-900">Connector operations</h1>
            <p className="mt-2 max-w-3xl text-sm text-neutral-600">
              Dedicated operational queue for credential-backed connectors, with health filters,
              bulk actions, and direct test controls.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={registrySource === 'backend' ? 'successful' : 'secondary'}>
                Registry: {registrySource === 'backend' ? 'Backend' : 'Local fallback'}
              </Badge>
              {registrySource === 'fallback' ? (
                <Badge variant="outline">Waiting on `GET /integrations/categories`</Badge>
              ) : null}
              {registryUpdatedAt ? (
                <Badge variant="outline">Updated {registryUpdatedAt}</Badge>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
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
          </div>
        </div>
        {operationsPanel}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
            Integrations
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-neutral-900">Providers and connectors</h1>
          <p className="mt-2 max-w-3xl text-sm text-neutral-600">
            Configured LLM models, tools, and MCP servers.
            <br/>Planned categories remain visible until backend route groups exist for them.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant={registrySource === 'backend' ? 'successful' : 'secondary'}>
              Registry: {registrySource === 'backend' ? 'Backend' : 'Local fallback'}
            </Badge>
            {registrySource === 'fallback' ? (
              <Badge variant="outline">Waiting on `GET /integrations/categories`</Badge>
            ) : null}
            {registryUpdatedAt ? (
              <Badge variant="outline">Updated {registryUpdatedAt}</Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
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
        </div>
      </div>

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
              Planned connectors
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
              latestHistoryByCredentialId={latestHistoryByCredentialId}
              categoryHistoryLoading={
                aggregateHistoryQuery.isLoading || aggregateHistoryQuery.isFetching
              }
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
