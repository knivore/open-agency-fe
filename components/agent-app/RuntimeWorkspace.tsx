'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { runtimeAdaptersApi } from '@/lib/api/backend';
import { queryKeys } from '@/lib/react-query/queryKeys';
import type { RuntimeAdapterDefinition } from '@/types/runtime';
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
import { Textarea } from '../library/shadcn/textarea';
import { Plus, RefreshCw, Trash2, Wrench } from 'lucide-react';
import { EmptyCard, ErrorAlert, LoadingCard } from '@/components/agent-app/StatePanels';
import { toast } from 'sonner';

const RUNTIME_ADAPTER_TYPES = [
  'native',
  'crewai',
  'openai_agents',
  'nemo_agent_toolkit',
  'pydantic_agents',
  'other',
] as const;
const PROTECTED_ADAPTER_IDS = new Set(['native', 'crewai']);

type AdapterFormState = {
  name: string;
  adapterType: string;
  description: string;
  version: string;
  capabilities: string;
  configSchema: string;
};

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

function toFormState(adapter?: RuntimeAdapterDefinition): AdapterFormState {
  return {
    name: adapter?.name ?? '',
    adapterType: adapter?.adapter_type ?? 'other',
    description: adapter?.description ?? '',
    version: adapter?.version ?? '',
    capabilities: (adapter?.capabilities ?? []).join(', '),
    configSchema: JSON.stringify(adapter?.config_schema ?? {}, null, 2),
  };
}

function payloadFromForm(form: AdapterFormState) {
  return {
    name: form.name.trim(),
    adapter_type: form.adapterType,
    description: form.description.trim() || null,
    version: form.version.trim() || null,
    capabilities: csvToList(form.capabilities),
    config_schema: parseJsonObject(form.configSchema, 'Config schema'),
  };
}

function AdapterFields({
  form,
  setForm,
  disabled,
  lockType,
}: {
  form: AdapterFormState;
  setForm: React.Dispatch<React.SetStateAction<AdapterFormState>>;
  disabled: boolean;
  lockType?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
            Name
          </label>
          <Input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
            Adapter Type
          </label>
          <select
            value={form.adapterType}
            onChange={(event) =>
              setForm((current) => ({ ...current, adapterType: event.target.value }))
            }
            disabled={disabled || lockType}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {RUNTIME_ADAPTER_TYPES.map((type) => (
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
          disabled={disabled}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
            Version
          </label>
          <Input
            value={form.version}
            onChange={(event) =>
              setForm((current) => ({ ...current, version: event.target.value }))
            }
            disabled={disabled}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
            Capabilities
          </label>
          <Input
            value={form.capabilities}
            onChange={(event) =>
              setForm((current) => ({ ...current, capabilities: event.target.value }))
            }
            disabled={disabled}
            placeholder="streaming, tools"
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
          Config Schema
        </label>
        <Textarea
          className="min-h-[140px] font-mono text-xs"
          value={form.configSchema}
          onChange={(event) =>
            setForm((current) => ({ ...current, configSchema: event.target.value }))
          }
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function CreateRuntimeAdapterCard({ onCreated }: { onCreated: () => Promise<void> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<AdapterFormState>(() => toFormState());
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const reset = () => {
    setForm(toFormState());
    setError(null);
  };

  const handleCreate = async () => {
    setError(null);
    setIsPending(true);
    try {
      await runtimeAdaptersApi.createRuntimeAdapter(payloadFromForm(form));
      await onCreated();
      toast.success('Runtime adapter created.', { position: 'top-right' });
      reset();
      setIsOpen(false);
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : 'Failed to create runtime adapter.'
      );
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
        New runtime adapter
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
            <DialogTitle>New runtime adapter [WIP]</DialogTitle>
            <DialogDescription>
              Create a custom runtime adapter definition. Built-in adapters are seeded by the
              backend.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <AdapterFields form={form} setForm={setForm} disabled={isPending} />
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
          </div>
          <DialogFooter>

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

function RuntimeAdapterCard({
  adapter,
  onRefresh,
}: {
  adapter: RuntimeAdapterDefinition;
  onRefresh: () => Promise<void>;
}) {
  const isProtected = PROTECTED_ADAPTER_IDS.has(adapter.id);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<AdapterFormState>(() => toFormState(adapter));
  const [deleteMode, setDeleteMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const reset = () => {
    setForm(toFormState(adapter));
    setDeleteMode(false);
    setError(null);
  };

  const handleSave = async () => {
    setError(null);
    setIsPending(true);
    try {
      await runtimeAdaptersApi.updateRuntimeAdapter(adapter.id, payloadFromForm(form));
      await onRefresh();
      toast.success('Runtime adapter updated.', { position: 'top-right' });
      setIsEditing(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Failed to update runtime adapter.'
      );
    } finally {
      setIsPending(false);
    }
  };

  const handleDelete = async () => {
    setError(null);
    setIsPending(true);
    try {
      await runtimeAdaptersApi.deleteRuntimeAdapter(adapter.id);
      await onRefresh();
      toast.success('Runtime adapter deleted.', { position: 'top-right' });
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : 'Failed to delete runtime adapter.'
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-neutral-900">{adapter.name}</p>
            {isProtected ? <Badge variant="secondary">Protected</Badge> : null}
          </div>
          <p className="text-sm text-neutral-500">
            {adapter.description || 'No description configured.'}
          </p>
        </div>
        <Badge variant="secondary">{adapter.adapter_type}</Badge>
      </div>

      {adapter.capabilities?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {adapter.capabilities.map((capability) => (
            <Badge key={capability} variant="outline">
              {capability}
            </Badge>
          ))}
        </div>
      ) : null}

      {isProtected ? (
        <p className="mt-3 text-xs text-neutral-500">
          Built-in adapters are seeded by the backend and cannot be changed from the UI.
        </p>
      ) : null}

      {isEditing ? (
        <div className="mt-4 space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <AdapterFields form={form} setForm={setForm} disabled={isPending} lockType />
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <div className="flex gap-2">
            <Button
              type="button"
              className="agency-gradient text-white hover:brightness-105"
              disabled={isPending || !form.name.trim()}
              onClick={handleSave}
            >
              <Wrench className="mr-2 h-4 w-4" />
              {isPending ? 'Saving...' : 'Save adapter'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                reset();
                setIsEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isProtected}
            onClick={() => {
              reset();
              setIsEditing(true);
            }}
          >
            Edit
          </Button>
          {isProtected ? null : deleteMode ? (
            <>
              <Button
                type="button"
                variant="destructive"
                disabled={isPending}
                onClick={handleDelete}
              >
                {isPending ? 'Deleting...' : 'Confirm delete'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
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
          )}
          {error ? <p className="basis-full text-xs text-red-600">{error}</p> : null}
        </div>
      )}
    </div>
  );
}

export default function RuntimeWorkspace() {
  const adaptersQuery = useQuery({
    queryKey: queryKeys.backendRuntimeAdapters(),
    queryFn: () => runtimeAdaptersApi.listRuntimeAdapters(),
  });

  const refreshAll = async () => {
    await adaptersQuery.refetch();
  };

  if (adaptersQuery.isLoading) {
    return <LoadingCard title="Runtime" description="Loading runtime adapters." />;
  }

  if (adaptersQuery.isError) {
    return (
      <ErrorAlert
        title="Failed to load runtime adapters"
        message={adaptersQuery.error.message}
        onRetry={() => adaptersQuery.refetch()}
      />
    );
  }

  const adapters = adaptersQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Runtime</h1>
          <p className="text-sm text-neutral-500">
            Runtime adapters, capabilities, and backend execution surfaces.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CreateRuntimeAdapterCard onCreated={refreshAll} />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void refreshAll();
            }}
            disabled={adaptersQuery.isFetching}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${adaptersQuery.isFetching ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Runtime Adapters</CardTitle>
            <CardDescription>
              Available execution backends exposed by the transformed API.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {adapters.length === 0 ? (
              <EmptyCard
                title="No runtime adapters"
                description="The backend returned no runtime adapter definitions."
              />
            ) : (
              adapters.map((adapter) => (
                <RuntimeAdapterCard key={adapter.id} adapter={adapter} onRefresh={refreshAll} />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
