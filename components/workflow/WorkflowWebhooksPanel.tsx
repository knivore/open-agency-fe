'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appApiClient } from '@/lib/api/clientInstances';
import { Button } from '@/components/library/shadcn/button';
import { Input } from '@/components/library/shadcn/input';

type Endpoint = { id: string; name: string; url: string; enabled: boolean; events: string[] };
type Trigger = { id: string; enabled: boolean; token?: string; url?: string };

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Button size="sm" type="button" variant="outline" onClick={() => void copy()}>
      {copied ? 'Copied' : label}
    </Button>
  );
}

export default function WorkflowWebhooksPanel({ workflowId }: { workflowId: string }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('Completion callback');
  const [url, setUrl] = useState('');
  const [newTrigger, setNewTrigger] = useState<Trigger | null>(null);
  const endpoints = useQuery({
    queryKey: ['workflow-webhooks', workflowId],
    queryFn: () =>
      appApiClient.get<{ items: Endpoint[] }>(
        `/api/workflows/${encodeURIComponent(workflowId)}/webhook-endpoints`
      ),
  });
  const trigger = useQuery({
    queryKey: ['workflow-webhook-trigger', workflowId],
    retry: false,
    queryFn: () =>
      appApiClient.get<Trigger>(`/api/workflows/${encodeURIComponent(workflowId)}/webhook-trigger`),
  });
  const createEndpoint = useMutation({
    mutationFn: () =>
      appApiClient.post(`/api/workflows/${encodeURIComponent(workflowId)}/webhook-endpoints`, {
        name,
        url,
        events: ['execution.completed', 'execution.failed'],
        include_output: true,
      }),
    onSuccess: () => {
      setUrl('');
      void queryClient.invalidateQueries({ queryKey: ['workflow-webhooks', workflowId] });
    },
  });
  const createTrigger = useMutation({
    mutationFn: () =>
      appApiClient.post<Trigger>(
        `/api/workflows/${encodeURIComponent(workflowId)}/webhook-trigger`,
        {}
      ),
    onSuccess: (value) => {
      // The backend returns a trigger secret only once, so preserve this response locally.
      setNewTrigger(value);
      void queryClient.invalidateQueries({ queryKey: ['workflow-webhook-trigger', workflowId] });
    },
  });
  const endpointItems = endpoints.data?.items ?? [];
  const triggerUrl =
    newTrigger?.url ??
    (trigger.data?.id ? 'Configured — the token is only displayed when created.' : '');

  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50/55 p-4 dark:border-violet-400/25 dark:bg-violet-500/8">
      <h3 className="font-semibold text-neutral-900 dark:text-slate-100">Workflow webhooks</h3>
      <p className="mt-1 text-sm text-neutral-600 dark:text-slate-300">
        Register completion callbacks or generate a secure inbound URL that starts this same
        workflow.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <Input
          aria-label="Webhook name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          aria-label="Webhook URL"
          placeholder="https://example.com/agency"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
        <Button
          type="button"
          disabled={!url || createEndpoint.isPending}
          onClick={() => createEndpoint.mutate()}
        >
          Add callback
        </Button>
      </div>
      {createEndpoint.error ? (
        <p className="mt-2 text-sm text-red-700">
          Unable to add webhook. Confirm the URL is public HTTPS and your token has webhooks:manage.
        </p>
      ) : null}
      {endpointItems.length ? (
        <ul className="mt-3 space-y-2 text-sm">
          {endpointItems.map((endpoint) => (
            <li
              className="rounded-md border border-violet-100 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-950/20"
              key={endpoint.id}
            >
              <span className="font-medium">{endpoint.name}</span>
              <span className="ml-2 break-all text-neutral-600 dark:text-slate-300">
                {endpoint.url}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-neutral-600 dark:text-slate-300">
          No completion callbacks registered.
        </p>
      )}
      <div className="mt-4 border-t border-violet-200 pt-4 dark:border-violet-400/20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Inbound webhook trigger</p>
            <p className="text-sm text-neutral-600 dark:text-slate-300">
              Creates a one-time secret URL. Store the token immediately; it is not shown again.
            </p>
          </div>
          {!trigger.data?.id && !newTrigger ? (
            <Button
              type="button"
              disabled={createTrigger.isPending}
              onClick={() => createTrigger.mutate()}
            >
              Create trigger URL
            </Button>
          ) : null}
        </div>
        {triggerUrl ? (
          <div className="mt-3 flex items-center gap-2 rounded-md bg-slate-950 p-3 text-xs text-slate-100">
            <code className="min-w-0 flex-1 break-all">{triggerUrl}</code>
            {newTrigger?.url ? <CopyButton value={newTrigger.url} label="Copy URL" /> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
