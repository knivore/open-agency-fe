'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/library/shadcn/button';

const terminalStatuses = new Set(['completed', 'failed', 'cancelled']);

function apiSnippet(workflowId: string) {
  const encodedWorkflowId = encodeURIComponent(workflowId);

  return `const AGENCY_URL = 'https://your-agency-host';
const API_TOKEN = process.env.AGENCY_API_TOKEN;

const start = await fetch(
  \`${'${AGENCY_URL}'}/workflows/${encodedWorkflowId}/executions\`,
  {
    method: 'POST',
    headers: {
      Authorization: \`Bearer ${'${API_TOKEN}'}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: {}, // Supply this workflow's input values here.
      trigger: { type: 'api' },
    }),
  }
);

if (!start.ok) throw new Error(await start.text());
const { process_id: executionId } = await start.json();

let execution;
do {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const response = await fetch(\`${'${AGENCY_URL}'}/executions/${'${executionId}'}\`, {
    headers: { Authorization: \`Bearer ${'${API_TOKEN}'}\` },
  });
  if (!response.ok) throw new Error(await response.text());
  ({ execution } = await response.json());
} while (!${JSON.stringify([...terminalStatuses])}.includes(execution.status));

if (execution.status !== 'completed') throw new Error(execution.error ?? execution.status);
return execution.output_payload;`;
}

function curlSnippet(workflowId: string) {
  const encodedWorkflowId = encodeURIComponent(workflowId);
  return `curl --request POST 'https://your-agency-host/workflows/${encodedWorkflowId}/executions/start' \\
  --header 'Authorization: Bearer $AGENCY_API_TOKEN' \\
  --header 'Content-Type: application/json' \\
  --header 'Idempotency-Key: request-unique-key' \\
  --header 'Prefer: wait=30' \\
  --data '{"inputs":{},"metadata":{"correlation_id":"external-request"}}'`;
}

function CopyCodeButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Button type="button" size="sm" variant="outline" onClick={() => void copy()}>
      {copied ? 'Copied' : label}
    </Button>
  );
}

export default function WorkflowApiAccessPanel({ workflowId }: { workflowId: string }) {
  const javascript = apiSnippet(workflowId);
  const curl = curlSnippet(workflowId);

  return (
    <section className="rounded-xl border border-sky-200 bg-sky-50/55 p-4 dark:border-sky-400/25 dark:bg-sky-500/8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h3 className="font-semibold text-neutral-900 dark:text-slate-100">Trigger via API</h3>
          <p className="max-w-3xl text-sm text-neutral-600 dark:text-slate-300">
            Start this workflow from a trusted service, then wait for its result by polling the
            returned execution ID.
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link href="/profile">Create API token</Link>
        </Button>
      </div>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <div className="rounded-lg border border-sky-100 bg-white/80 p-3 dark:border-white/10 dark:bg-slate-950/20">
          <p className="font-medium text-neutral-900 dark:text-slate-100">1. Authorize</p>
          <p className="mt-1 text-neutral-600 dark:text-slate-300">
            Create a bearer token with <code>workflows:run</code> and <code>executions:read</code>{' '}
            scopes.
          </p>
        </div>
        <div className="rounded-lg border border-sky-100 bg-white/80 p-3 dark:border-white/10 dark:bg-slate-950/20">
          <p className="font-medium text-neutral-900 dark:text-slate-100">2. Start</p>
          <p className="mt-1 text-neutral-600 dark:text-slate-300">
            <code>POST /workflows/{workflowId}/executions</code> waits up to 60 seconds, then
            returns either a result or an execution ID.
          </p>
        </div>
        <div className="rounded-lg border border-sky-100 bg-white/80 p-3 dark:border-white/10 dark:bg-slate-950/20">
          <p className="font-medium text-neutral-900 dark:text-slate-100">3. Receive result</p>
          <p className="mt-1 text-neutral-600 dark:text-slate-300">
            Poll <code>GET /executions/&lt;id&gt;</code> until it is terminal, then read{' '}
            <code>output_payload</code>.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2 rounded-lg bg-slate-950 p-3 text-slate-100">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-300">
            JavaScript: start and wait
          </p>
          <CopyCodeButton value={javascript} label="Copy JavaScript" />
        </div>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap text-xs leading-5">
          {javascript}
        </pre>
      </div>

      <div className="mt-3 space-y-2 rounded-lg bg-slate-950 p-3 text-slate-100">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-300">
            cURL: start only
          </p>
          <CopyCodeButton value={curl} label="Copy cURL" />
        </div>
        <pre className="overflow-auto whitespace-pre-wrap text-xs leading-5">{curl}</pre>
      </div>
    </section>
  );
}
