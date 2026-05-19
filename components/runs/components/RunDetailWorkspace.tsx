'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { formatRunError } from '@/lib/workflows/runFormatting';
import { useWorkflowRunLauncher } from '@/lib/workflows/useWorkflowRunLauncher';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { useRunsModule } from '@/components/runs/context';
import { useRunDetailData } from '@/components/runs/hooks/useRunDetailData';
import { useRunPresence } from '@/components/runs/hooks/useRunPresence';
import type {
  ExecutionEventRecord,
  ExecutionArtifact,
  ExecutionStateSnapshot,
  RunLogEntry,
  RuntimeLogLine,
  RunSessionSummary,
} from '@/lib/api/backend/types';
import { Badge } from '@/components/library/shadcn/badge';
import { Button } from '@/components/library/shadcn/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/library/shadcn/card';
import WorkflowRuntimeAdapterPanel from '@/components/workflow-app/WorkflowRuntimeAdapterPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/library/shadcn/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/library/shadcn/table';
import {
  CheckCircle2,
  FileText,
  ListChecks,
  MessageSquare,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
  Square,
  Table2,
  User,
} from 'lucide-react';
import { RunsEmptyCard, RunsErrorAlert, RunsLoadingCard } from '@/components/runs/components/RunsState';
import { toast } from 'sonner';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);
const LLM_PARSE_FAILURE = 'Failed to parse LLM response';
const STORY_EVENT_TYPES_WITH_FRIENDLY_LABEL = new Set([
  'artifact.created',
  'execution.completed',
  'execution.created',
  'execution.started',
  'llm.request.created',
  'llm.response.created',
]);
type EventViewMode = 'story' | 'rows';

const EVENT_CHAT_PALETTE = [
  {
    bubble: 'border-sky-200 bg-sky-50 text-sky-950',
    chip: 'bg-sky-100 text-sky-800',
    align: 'items-start',
  },
  {
    bubble: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    chip: 'bg-emerald-100 text-emerald-800',
    align: 'items-end',
  },
  {
    bubble: 'border-violet-200 bg-violet-50 text-violet-950',
    chip: 'bg-violet-100 text-violet-800',
    align: 'items-start',
  },
  {
    bubble: 'border-amber-200 bg-amber-50 text-amber-950',
    chip: 'bg-amber-100 text-amber-800',
    align: 'items-end',
  },
];

const EMPTY_RUN_STATE: ExecutionStateSnapshot = {
  paused: false,
  cancelled: false,
  node_outputs: {},
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' }) : '—';
}

function orderEventsLatestFirst(events: ExecutionEventRecord[]) {
  return [...events].sort((left, right) => {
    if (right.sequence !== left.sequence) {
      return right.sequence - left.sequence;
    }
    return new Date(right.timestamp ?? 0).getTime() - new Date(left.timestamp ?? 0).getTime();
  });
}

function logLevelClass(level?: string | null) {
  if (level === 'error') {
    return 'border-red-200 bg-red-50 text-red-900';
  }
  if (level === 'warn') {
    return 'border-amber-200 bg-amber-50 text-amber-900';
  }
  return 'border-neutral-200 bg-white text-neutral-800';
}

function actorLabel(event: ExecutionEventRecord) {
  return event.actor || event.actor_type || 'system';
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function eventChatPalette(event: ExecutionEventRecord) {
  if ((event.actor_type || '').toLowerCase() === 'system') {
    return {
      bubble: 'border-neutral-200 bg-neutral-50 text-neutral-900',
      chip: 'bg-neutral-200 text-neutral-700',
      align: 'items-center',
    };
  }

  return EVENT_CHAT_PALETTE[hashString(actorLabel(event)) % EVENT_CHAT_PALETTE.length];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatPayloadKey(key: string) {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function cleanPayloadText(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isUnavailableThought(value: unknown) {
  const text = cleanPayloadText(value);
  return !text || text === LLM_PARSE_FAILURE;
}

function hasThoughtParseError(payload: Record<string, unknown>) {
  return payload.thought_parse_error === true || payload.thoughtParseError === true;
}

function stripFinalOutputLabel(value: string) {
  return value.replace(/^Final Output\s*\n+/i, '').trim();
}

function payloadText(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const text = cleanPayloadText(payload[key]);
    if (text) {
      return text;
    }
  }

  return null;
}

function outputTextFromValue(value: unknown): string | null {
  const direct = cleanPayloadText(value);
  if (direct) {
    return direct;
  }

  if (isRecord(value)) {
    return (
      payloadText(value, ['final_output', 'finalOutput', 'content', 'text', 'output', 'Output']) ??
      (value.final_output != null ? JSON.stringify(value.final_output, null, 2) : null) ??
      (value.finalOutput != null ? JSON.stringify(value.finalOutput, null, 2) : null)
    );
  }

  return null;
}

function finalOutputFromPayload(payload: Record<string, unknown>) {
  for (const key of ['final_output', 'finalOutput', 'output', 'Output']) {
    const output = outputTextFromValue(payload[key]);
    if (output) {
      return stripFinalOutputLabel(output);
    }
  }

  return null;
}

function outputPayloadNodeOutputs(payload?: Record<string, unknown> | null) {
  const nodeOutputs = payload?.node_outputs ?? payload?.nodeOutputs;
  return isRecord(nodeOutputs) ? nodeOutputs : {};
}

function payloadThought(payload: Record<string, unknown>) {
  return 'thought' in payload ? payload.thought : payload.Thought;
}

function finalOutputForEvents(events: ExecutionEventRecord[]) {
  const completedEvents = events.filter((event) => event.event_type === 'execution.completed');
  for (let index = completedEvents.length - 1; index >= 0; index -= 1) {
    const payload = completedEvents[index].payload ?? {};
    const output = finalOutputFromPayload(payload);
    if (output) {
      return output;
    }
  }

  return null;
}

function finalOutputArtifactForEvents(events: ExecutionEventRecord[]) {
  return events.find((event) => {
    if (event.event_type !== 'artifact.created') {
      return false;
    }
    const payload = event.payload ?? {};
    const name = payloadText(payload, ['name', 'Name']);
    const uri = payloadText(payload, ['uri', 'Uri']);
    return name === 'final_output.txt' || uri?.endsWith('/final_output') || uri?.includes('/final_output');
  }) ?? null;
}

function sanitizeDisplayPayload(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.trim() === LLM_PARSE_FAILURE ? 'Thought unavailable' : value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeDisplayPayload);
  }

  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeDisplayPayload(item)]));
  }

  return value;
}

function summarizeEventPayload(event: ExecutionEventRecord) {
  const payload = event.payload ?? {};

  if (event.event_type === 'llm.request.created') {
    return hasThoughtParseError(payload) || isUnavailableThought(payloadThought(payload))
      ? 'Prompt sent to the model. Intermediate thought was not returned in a readable format.'
      : 'Prompt sent to the model with captured reasoning context.';
  }

  if (event.event_type === 'llm.response.created') {
    const response = payloadText(payload, ['output', 'Output', 'text', 'Text', 'content', 'message']);
    return response ? response.split('\n').find((line) => line.trim()) ?? 'Model response received.' : 'Model response received.';
  }

  if (event.event_type === 'artifact.created') {
    const name = payloadText(payload, ['name', 'Name', 'artifact_id', 'artifactId']);
    return name ? `Saved ${name}.` : 'Saved an execution artifact.';
  }

  if (event.event_type === 'execution.completed') {
    const error = cleanPayloadText(payload.error);
    const output = finalOutputFromPayload(payload);
    if (error) {
      return `Run ended with an error: ${error}`;
    }
    return output ? 'Run completed and produced a final output.' : 'Run completed without a final output.';
  }

  const candidateKeys = ['error', 'content', 'message', 'summary', 'reason', 'task_name', 'tool_name', 'status'];
  for (const key of candidateKeys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  if (Array.isArray(payload.messages)) {
    return `${payload.messages.length} message${payload.messages.length === 1 ? '' : 's'} in request payload`;
  }

  if (typeof payload.node_id === 'string') {
    return payload.node_id;
  }

  if (Object.keys(payload).length > 0) {
    const keys = Object.keys(payload).slice(0, 4).map(formatPayloadKey).join(', ');
    return `${Object.keys(payload).length} payload field${Object.keys(payload).length === 1 ? '' : 's'}: ${keys}`;
  }

  return 'No payload';
}

function MarkdownBlock({ children, compact = false }: { children: string; compact?: boolean }) {
  return (
    <div className={`min-w-0 break-words ${compact ? 'space-y-1 text-sm' : 'space-y-3 text-sm leading-6'}`}>
      <ReactMarkdown
        components={{
          a: ({ children: linkChildren, href }) => (
            <a
              href={href}
              className="font-medium text-sky-700 underline-offset-4 hover:underline"
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noreferrer' : undefined}
            >
              {linkChildren}
            </a>
          ),
          code: ({ children: codeChildren }) => (
            <code className="rounded bg-black/5 px-1 py-0.5 font-mono text-[0.9em] text-neutral-900">
              {codeChildren}
            </code>
          ),
          h1: ({ children: headingChildren }) => (
            <h3 className="text-base font-semibold text-neutral-950">{headingChildren}</h3>
          ),
          h2: ({ children: headingChildren }) => (
            <h3 className="text-base font-semibold text-neutral-950">{headingChildren}</h3>
          ),
          h3: ({ children: headingChildren }) => (
            <h4 className="text-sm font-semibold text-neutral-950">{headingChildren}</h4>
          ),
          li: ({ children: listChildren }) => <li className="ml-4 list-disc pl-1">{listChildren}</li>,
          ol: ({ children: listChildren }) => <ol className="space-y-1">{listChildren}</ol>,
          p: ({ children: paragraphChildren }) => <p>{paragraphChildren}</p>,
          ul: ({ children: listChildren }) => <ul className="space-y-1">{listChildren}</ul>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

function MissingThought() {
  return (
    <div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
      Thought not available in a readable format. The runtime marked this as a parser miss, not model content.
    </div>
  );
}

function PrimitivePayloadValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-neutral-400">—</span>;
  }

  if (typeof value === 'boolean') {
    return <Badge variant="outline">{value ? 'true' : 'false'}</Badge>;
  }

  if (typeof value === 'number') {
    return <span className="font-mono text-xs">{value}</span>;
  }

  if (typeof value === 'string' && value.includes('\n')) {
    return <MarkdownBlock compact>{value}</MarkdownBlock>;
  }

  return <span className="whitespace-pre-wrap break-words">{String(value)}</span>;
}

function MessagePayloadList({ messages }: { messages: unknown[] }) {
  return (
    <div className="space-y-2">
      {messages.map((message, index) => {
        const record = isRecord(message) ? message : {};
        const role = typeof record.role === 'string' ? record.role : `message ${index + 1}`;
        const content = record.content;

        return (
          <div key={`${role}-${index}`} className="rounded-md border border-black/10 bg-white/70 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{role}</Badge>
              {typeof record.name === 'string' && record.name ? <span className="text-xs text-neutral-500">{record.name}</span> : null}
            </div>
            <PayloadValue value={content} depth={1} />
          </div>
        );
      })}
    </div>
  );
}

function PayloadValue({ value, depth = 0, fieldKey }: { value: unknown; depth?: number; fieldKey?: string }) {
  if (fieldKey?.toLowerCase() === 'thought' && isUnavailableThought(value)) {
    return <MissingThought />;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-neutral-400">Empty list</span>;
    }

    if (depth > 2) {
      return <span className="text-neutral-500">{value.length} items</span>;
    }

    return (
      <div className="space-y-2">
        {value.map((item, index) => (
          <div key={index} className="rounded-md border border-black/10 bg-white/60 p-2">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-500">Item {index + 1}</div>
            <PayloadValue value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  if (isRecord(value)) {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined);
    if (entries.length === 0) {
      return <span className="text-neutral-400">Empty object</span>;
    }

    if (Array.isArray(value.messages)) {
      const otherEntries = entries.filter(([key]) => key !== 'messages');
      return (
        <div className="space-y-3">
          <MessagePayloadList messages={value.messages} />
          {otherEntries.length > 0 ? <PayloadFields entries={otherEntries} depth={depth} /> : null}
        </div>
      );
    }

    return <PayloadFields entries={entries} depth={depth} />;
  }

  return <PrimitivePayloadValue value={value} />;
}

function PayloadFields({ entries, depth }: { entries: Array<[string, unknown]>; depth: number }) {
  return (
    <dl className="grid gap-2">
      {entries.map(([key, value]) => (
        <div key={key} className={depth === 0 ? 'rounded-md border border-black/10 bg-white/60 p-2' : ''}>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">{formatPayloadKey(key)}</dt>
          <dd className="mt-1 text-sm text-neutral-800">
            <PayloadValue value={value} depth={depth + 1} fieldKey={key} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function EventTitle({ event }: { event: ExecutionEventRecord }) {
  if (event.event_type === 'llm.request.created') {
    return <>LLM request sent</>;
  }

  if (event.event_type === 'llm.response.created') {
    return <>LLM response received</>;
  }

  if (event.event_type === 'artifact.created') {
    return <>Artifact created</>;
  }

  if (event.event_type === 'execution.completed') {
    return <>Execution completed</>;
  }

  if (event.event_type === 'execution.started') {
    return <>Execution started</>;
  }

  if (event.event_type === 'execution.created') {
    return <>Execution created</>;
  }

  return <>{event.event_type}</>;
}

function EventIcon({ event }: { event: ExecutionEventRecord }) {
  if (event.event_type === 'llm.response.created') {
    return <Sparkles className="h-4 w-4" />;
  }

  if (event.event_type === 'artifact.created') {
    return <FileText className="h-4 w-4" />;
  }

  if (event.event_type === 'execution.completed') {
    return <CheckCircle2 className="h-4 w-4" />;
  }

  return <MessageSquare className="h-4 w-4" />;
}

function PayloadSection({
  title,
  children,
  scrollable = false,
}: {
  title: string;
  children: ReactNode;
  scrollable?: boolean;
}) {
  return (
    <section className="rounded-md border border-black/10 bg-white/70 p-3">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-neutral-500">{title}</p>
      <div className={scrollable ? 'max-h-72 overflow-auto pr-1' : ''}>{children}</div>
    </section>
  );
}

function LlmResponseDetails({ payload }: { payload: Record<string, unknown> }) {
  const output = cleanPayloadText(payload.output) ?? cleanPayloadText(payload.Output);
  const text = cleanPayloadText(payload.text) ?? cleanPayloadText(payload.Text);
  const primary = output ?? text;
  const hasDistinctText = Boolean(output && text && output.trim() !== text.trim());
  const otherEntries = Object.entries(payload).filter(
    ([key]) => !['output', 'text', 'thought'].includes(key.toLowerCase())
  );

  return (
    <div className="space-y-3">
      {'thought' in payload || 'Thought' in payload || hasThoughtParseError(payload) ? (
        <PayloadSection title="Thought">
          {hasThoughtParseError(payload) || isUnavailableThought(payloadThought(payload)) ? (
            <MissingThought />
          ) : (
            <PayloadValue value={payloadThought(payload)} fieldKey="thought" />
          )}
        </PayloadSection>
      ) : null}
      {primary ? (
        <PayloadSection title="Response" scrollable>
          <MarkdownBlock>{primary}</MarkdownBlock>
        </PayloadSection>
      ) : null}
      {hasDistinctText && text ? (
        <PayloadSection title="Text" scrollable>
          <MarkdownBlock>{text}</MarkdownBlock>
        </PayloadSection>
      ) : null}
      {otherEntries.length > 0 ? <PayloadFields entries={otherEntries} depth={0} /> : null}
    </div>
  );
}

function LlmRequestDetails({ payload }: { payload: Record<string, unknown> }) {
  const entries = Object.entries(payload).filter(([key]) => key.toLowerCase() !== 'thought');

  return (
    <div className="space-y-3">
      {'thought' in payload || 'Thought' in payload || hasThoughtParseError(payload) ? (
        <PayloadSection title="Thought">
          {hasThoughtParseError(payload) || isUnavailableThought(payloadThought(payload)) ? (
            <MissingThought />
          ) : (
            <PayloadValue value={payloadThought(payload)} fieldKey="thought" />
          )}
        </PayloadSection>
      ) : null}
      {entries.length > 0 ? <PayloadFields entries={entries} depth={0} /> : null}
    </div>
  );
}

function CompletionDetails({ payload }: { payload: Record<string, unknown> }) {
  const output = finalOutputFromPayload(payload);
  const error = cleanPayloadText(payload.error);
  const otherEntries = Object.entries(payload).filter(
    ([key]) => !['output', 'final_output', 'finaloutput', 'error'].includes(key.toLowerCase())
  );

  return (
    <div className="space-y-3">
      {error ? (
        <PayloadSection title="Error">
          <PrimitivePayloadValue value={error} />
        </PayloadSection>
      ) : null}
      {output ? (
        <PayloadSection title="Final output" scrollable>
          <MarkdownBlock>{stripFinalOutputLabel(output)}</MarkdownBlock>
        </PayloadSection>
      ) : null}
      {otherEntries.length > 0 ? <PayloadFields entries={otherEntries} depth={0} /> : null}
    </div>
  );
}

function EventPayloadDetails({ event }: { event: ExecutionEventRecord }) {
  const payload = event.payload ?? {};

  if (event.event_type === 'llm.response.created') {
    return <LlmResponseDetails payload={payload} />;
  }

  if (event.event_type === 'llm.request.created') {
    return <LlmRequestDetails payload={payload} />;
  }

  if (event.event_type === 'execution.completed') {
    return <CompletionDetails payload={payload} />;
  }

  return <PayloadValue value={payload} />;
}

function RunStoryOverview({ events }: { events: ExecutionEventRecord[] }) {
  const finalOutput = finalOutputForEvents(events);
  const finalOutputArtifact = finalOutputArtifactForEvents(events);
  const llmResponseCount = events.filter((event) => event.event_type === 'llm.response.created').length;
  const artifactCount = events.filter((event) => event.event_type === 'artifact.created').length;

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{events.length} events</Badge>
        <Badge variant="outline">{llmResponseCount} LLM responses</Badge>
        <Badge variant="outline">{artifactCount} artifacts</Badge>
      </div>
      {finalOutput ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
          <div className="mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <h3 className="text-sm font-semibold">Final output</h3>
          </div>
          <MarkdownBlock>{finalOutput}</MarkdownBlock>
        </div>
      ) : finalOutputArtifact ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
          <div className="mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <h3 className="text-sm font-semibold">Final output artifact</h3>
          </div>
          <p className="text-sm">
            The run completed and saved its final answer as{' '}
            <span className="font-medium">
              {payloadText(finalOutputArtifact.payload ?? {}, ['name', 'Name']) ?? 'an artifact'}
            </span>
            .
          </p>
          {payloadText(finalOutputArtifact.payload ?? {}, ['uri', 'Uri']) ? (
            <p className="mt-2 break-words font-mono text-xs text-emerald-800">
              {payloadText(finalOutputArtifact.payload ?? {}, ['uri', 'Uri'])}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-neutral-500">No final output has been reported for this run yet.</p>
      )}
    </section>
  );
}

function EventRowsView({ events }: { events: ExecutionEventRecord[] }) {
  const orderedEvents = orderEventsLatestFirst(events);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Seq</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Actor</TableHead>
          <TableHead>Timestamp</TableHead>
          <TableHead>Payload</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orderedEvents.map((event) => (
          <TableRow key={event.id}>
            <TableCell>{event.sequence}</TableCell>
            <TableCell>{event.event_type}</TableCell>
            <TableCell>{actorLabel(event)}</TableCell>
            <TableCell>{formatDate(event.timestamp)}</TableCell>
            <TableCell className="max-w-[320px]">
              <pre className="max-h-24 overflow-auto whitespace-pre-wrap text-xs text-neutral-600">
                {JSON.stringify(sanitizeDisplayPayload(event.payload || {}), null, 2)}
              </pre>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function EventStoryView({ events }: { events: ExecutionEventRecord[] }) {
  const orderedEvents = orderEventsLatestFirst(events);

  return (
    <div className="space-y-4">
      <RunStoryOverview events={events} />
      {orderedEvents.map((event) => {
        const palette = eventChatPalette(event);
        const isSystem = (event.actor_type || '').toLowerCase() === 'system';
        const summary = summarizeEventPayload(event);
        const summaryIsLong = summary.length > 220 || summary.includes('\n');
        const showRawEventType = STORY_EVENT_TYPES_WITH_FRIENDLY_LABEL.has(event.event_type);

        return (
          <article key={event.id} className={`flex flex-col ${palette.align}`}>
            <div
              className={`w-full max-w-[860px] rounded-lg border px-4 py-3 shadow-sm ${palette.bubble}`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 rounded-full p-2 ${palette.chip}`}>
                  <EventIcon event={event} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${palette.chip}`}>
                      {actorLabel(event)}
                    </span>
                    <span className="font-semibold">
                      <EventTitle event={event} />
                    </span>
                    {showRawEventType ? <span className="text-current/65">{event.event_type}</span> : null}
                    <span className="text-current/65">#{event.sequence}</span>
                    <span className="text-current/65">{formatDate(event.timestamp)}</span>
                    {event.task_id ? <span className="text-current/65">Task: {event.task_id}</span> : null}
                  </div>
                  <div className={`mt-2 break-words text-sm ${isSystem ? 'text-center' : ''}`}>
                    {summaryIsLong ? <MarkdownBlock compact>{summary}</MarkdownBlock> : <p>{summary}</p>}
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-current/60">Details</p>
                <div className="rounded-md border border-black/10 bg-white/70 p-3 text-xs">
                  <EventPayloadDetails event={event} />
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function RuntimeLogLines({ lines }: { lines?: RuntimeLogLine[] }) {
  if (!lines || lines.length === 0) {
    return <p className="text-sm text-neutral-500">No structured logs reported.</p>;
  }

  return (
    <div className="space-y-2">
      {lines.map((line, index) => (
        <div
          key={`${line.sequence ?? index}-${line.event_type ?? 'event'}`}
          className={`rounded-md border px-3 py-2 text-sm ${logLevelClass(line.level)}`}
        >
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <span>{line.sequence != null ? `#${line.sequence}` : `#${index + 1}`}</span>
            {line.event_type ? <span>{line.event_type}</span> : null}
            {line.timestamp ? <span>{formatDate(line.timestamp)}</span> : null}
            {line.task_id ? <span>Task: {line.task_id}</span> : null}
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words">{line.message || line.text}</p>
        </div>
      ))}
    </div>
  );
}

export function ArtifactCard({ artifact }: { artifact: ExecutionArtifact }) {
  const contentText = cleanPayloadText(artifact.content_text);
  const contentJson = artifact.content_json;
  const hasJsonContent = isRecord(contentJson);

  return (
    <div className="rounded-lg border border-neutral-200 p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-neutral-900">{artifact.name || artifact.id}</p>
          {artifact.uri ? <p className="mt-1 break-words font-mono text-xs text-neutral-500">{artifact.uri}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{artifact.artifact_type || 'artifact'}</Badge>
          {artifact.media_type ? <Badge variant="secondary">{artifact.media_type}</Badge> : null}
          {artifact.size_bytes != null ? <Badge variant="outline">{artifact.size_bytes} bytes</Badge> : null}
        </div>
      </div>

      {contentText ? (
        <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Content</p>
          <div className="max-h-72 overflow-auto pr-1">
            <MarkdownBlock>{contentText}</MarkdownBlock>
          </div>
        </div>
      ) : hasJsonContent ? (
        <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Content JSON</p>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-xs text-neutral-700">
            {JSON.stringify(contentJson, null, 2)}
          </pre>
        </div>
      ) : (
        <p className="mt-3 text-sm text-neutral-500">
          No inline content is attached to this artifact. Use the URI as the artifact reference.
        </p>
      )}
    </div>
  );
}

function OutputContent({ value }: { value: string }) {
  return (
    <div className="max-h-80 overflow-auto pr-1">
      <MarkdownBlock>{value}</MarkdownBlock>
    </div>
  );
}

function OutputPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</p>
      {children}
    </section>
  );
}

function RunOutputs({
  outputPayload,
  stateNodeOutputs,
  artifacts,
  isLoadingArtifacts,
}: {
  outputPayload?: Record<string, unknown> | null;
  stateNodeOutputs?: Record<string, unknown>;
  artifacts: ExecutionArtifact[];
  isLoadingArtifacts: boolean;
}) {
  const primaryOutput = outputPayload ? finalOutputFromPayload(outputPayload) ?? outputTextFromValue(outputPayload) : null;
  const outputNodeOutputs = outputPayloadNodeOutputs(outputPayload);
  const nodeOutputs = Object.keys(outputNodeOutputs).length > 0 ? outputNodeOutputs : stateNodeOutputs ?? {};
  const nodeOutputEntries = Object.entries(nodeOutputs);
  const contentArtifacts = artifacts.filter((artifact) => artifact.content_text || artifact.content_json);
  const visibleArtifacts = contentArtifacts.filter((artifact) => {
    const artifactText = cleanPayloadText(artifact.content_text);
    return !primaryOutput || artifactText !== primaryOutput;
  });
  const hasOutput = Boolean(primaryOutput) || nodeOutputEntries.length > 0 || visibleArtifacts.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Run Outputs</CardTitle>
        <CardDescription>
          Canonical result, node outputs, and inline artifact content for this execution.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasOutput && isLoadingArtifacts ? (
          <p className="text-sm text-neutral-500">Loading output artifacts...</p>
        ) : !hasOutput ? (
          <p className="text-sm text-neutral-500">
            No structured output or inline artifacts were reported for this run.
          </p>
        ) : null}

        {primaryOutput ? (
          <OutputPanel title="Primary output">
            <OutputContent value={primaryOutput} />
          </OutputPanel>
        ) : null}

        {nodeOutputEntries.length > 0 ? (
          <OutputPanel title="Node outputs">
            <div className="grid gap-3">
              {nodeOutputEntries.map(([nodeId, value]) => (
                <div key={nodeId} className="rounded-md border border-neutral-200 bg-white p-3">
                  <p className="mb-2 font-mono text-xs text-neutral-500">{nodeId}</p>
                  <PayloadValue value={value} />
                </div>
              ))}
            </div>
          </OutputPanel>
        ) : null}

        {visibleArtifacts.length > 0 ? (
          <OutputPanel title="Output artifacts">
            <div className="space-y-3">
              {visibleArtifacts.map((artifact) => (
                <ArtifactCard key={artifact.id} artifact={artifact} />
              ))}
            </div>
          </OutputPanel>
        ) : null}
      </CardContent>
    </Card>
  );
}

function StructuredRuntimeLogs({ logs }: { logs?: RunLogEntry }) {
  const workflowLogs = logs?.workflow_logs ?? [];
  const agentLogs = logs?.agent_logs ?? [];
  const rawContainerLogs = logs?.raw_container_logs?.trim();

  if (workflowLogs.length === 0 && agentLogs.length === 0 && !rawContainerLogs) {
    return (
      <pre className="max-h-[480px] overflow-auto rounded-lg border border-neutral-200 bg-neutral-950 p-4 text-xs text-neutral-100">
        {logs?.logs?.trim() || 'No runtime logs reported.'}
      </pre>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-neutral-900">Workflow Logs</h3>
          <Badge variant="outline">{workflowLogs.length}</Badge>
        </div>
        <RuntimeLogLines lines={workflowLogs} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-neutral-900">Agent Logs</h3>
          <Badge variant="outline">{agentLogs.length} agents</Badge>
        </div>
        {agentLogs.length === 0 ? (
          <p className="text-sm text-neutral-500">No agent-specific logs reported.</p>
        ) : (
          <div className="space-y-4">
            {agentLogs.map((group, index) => (
              <div key={group.agent_id || group.agent_name || index} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-medium text-neutral-900">
                    {group.agent_name || group.agent_id || `Agent ${index + 1}`}
                  </h4>
                  {group.agent_id ? <Badge variant="secondary">{group.agent_id}</Badge> : null}
                  <Badge variant="outline">{group.logs.length}</Badge>
                </div>
                <RuntimeLogLines lines={group.logs} />
              </div>
            ))}
          </div>
        )}
      </section>

      {rawContainerLogs ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-neutral-900">Container stdout/stderr</h3>
            <Badge variant="outline">{logs?.container_id || logs?.containerId || 'container'}</Badge>
          </div>
          <pre className="max-h-[360px] overflow-auto rounded-lg border border-neutral-200 bg-neutral-950 p-4 text-xs text-neutral-100">
            {rawContainerLogs}
          </pre>
        </section>
      ) : null}
    </div>
  );
}

export default function RunDetailWorkspace({ runId }: { runId: string }) {
  const { api } = useRunsModule();
  const searchParams = useSearchParams();
  const [selectedRerunAdapterId, setSelectedRerunAdapterId] = useState('');
  const [eventViewMode, setEventViewMode] = useState<EventViewMode>('story');
  const {
    runQuery,
    timelineQuery,
    eventsQuery,
    artifactsQuery,
    logsQuery,
    conversationContextQuery,
    workflowQuery,
    refreshAll,
    pauseMutation,
    resumeMutation,
    cancelMutation,
    approvalDecisionMutation,
  } = useRunDetailData(runId);

  const runDetail = runQuery.data;
  const workflowIdFromUrl = searchParams.get('workflowId');
  const run: RunSessionSummary = runDetail?.summary ?? {
    id: runId,
    workflowId: workflowIdFromUrl,
    runtimeAdapterId: null,
    status: 'unknown',
    container: {},
  };
  const workflowTab = searchParams.get('tab') || 'runs';
  const rerunWorkflowId = run.workflowId ?? workflowIdFromUrl ?? '';
  const workflowBackHref =
    workflowIdFromUrl || run.workflowId ? `/workflows/${workflowIdFromUrl || run.workflowId}?tab=${workflowTab}` : null;
  const linkedConversation = conversationContextQuery.data?.conversation ?? null;
  const linkedApprovals = conversationContextQuery.data?.approvals ?? [];
  const linkedMessages = conversationContextQuery.data?.messages.filter((message) => message.execution_id === runId) ?? [];
  const workflow = workflowQuery.data;
  const {
    runtimeAdaptersQuery,
    runnableRuntimeAdapters,
    preferredRuntimeAdapterId,
    launchMutation: rerunMutation,
    launchWorkflow,
  } = useWorkflowRunLauncher({
    workflowId: rerunWorkflowId,
    workflow,
    listRuntimeAdapters: api.runtimeAdapters.listRuntimeAdapters,
    getWorkflow: async (workflowId) => workflowQuery.data ?? await workflowQuery.refetch().then((result) => {
      if (!result.data) {
        throw new Error(`Workflow ${workflowId} could not be loaded.`);
      }
      return result.data;
    }),
    executeWorkflow: api.runs.executeWorkflow,
    redirectTo: (nextRunId) => `/runs/${nextRunId}?workflowId=${rerunWorkflowId}&tab=runs`,
    additionalInvalidationKeys: () => [queryKeys.backendActiveRunSessions()],
  });
  const { tasks: derivedTasks, agents: derivedAgents } = useRunPresence({
    run,
    workflow,
    state: runDetail?.state ?? EMPTY_RUN_STATE,
    events: eventsQuery.data?.items ?? [],
    approvals: linkedApprovals,
  });

  useEffect(() => {
    const effectivePreferredAdapterId = preferredRuntimeAdapterId || run.runtimeAdapterId || '';

    if (!effectivePreferredAdapterId) {
      if (selectedRerunAdapterId) {
        setSelectedRerunAdapterId('');
      }
      return;
    }

    if (!selectedRerunAdapterId || !runnableRuntimeAdapters.some((adapter) => adapter.id === selectedRerunAdapterId)) {
      setSelectedRerunAdapterId(effectivePreferredAdapterId);
    }
  }, [preferredRuntimeAdapterId, run.runtimeAdapterId, runnableRuntimeAdapters, selectedRerunAdapterId]);

  if (runQuery.isLoading) {
    return <RunsLoadingCard title="Run" description="Loading canonical execution detail from the backend." />;
  }

  if (runQuery.isError) {
    return <RunsErrorAlert title="Failed to load run" message={runQuery.error.message} onRetry={() => runQuery.refetch()} />;
  }

  if (!runDetail) {
    return <RunsEmptyCard title="Run not found" description="The backend returned no execution detail for this run." />;
  }

  const canPause = run.status === 'running';
  const canResume = run.status === 'paused';
  const canCancel = !TERMINAL_STATUSES.has(run.status);

  const handlePause = async () => {
    await toast.promise(pauseMutation.mutateAsync(), {
      loading: 'Pausing run...',
      success: 'Run paused.',
      error: (error) => (error instanceof Error ? error.message : 'Failed to pause run.'),
      position: 'top-right',
    });
  };

  const handleResume = async () => {
    await toast.promise(resumeMutation.mutateAsync(), {
      loading: 'Resuming run...',
      success: 'Run resumed.',
      error: (error) => (error instanceof Error ? error.message : 'Failed to resume run.'),
      position: 'top-right',
    });
  };

  const handleCancel = async () => {
    await toast.promise(cancelMutation.mutateAsync(), {
      loading: 'Cancelling run...',
      success: 'Run cancellation requested.',
      error: (error) => (error instanceof Error ? error.message : 'Failed to cancel run.'),
      position: 'top-right',
    });
  };

  const handleApprovalDecision = async (approvalRequestId: string, action: 'approve' | 'reject') => {
    await toast.promise(approvalDecisionMutation.mutateAsync({ approvalRequestId, action }), {
      loading: `${action === 'approve' ? 'Approving' : 'Rejecting'} request...`,
      success: `Approval ${action === 'approve' ? 'granted' : 'rejected'}.`,
      error: (error) => (error instanceof Error ? error.message : `Failed to ${action} approval.`),
      position: 'top-right',
    });
  };

  const handleRerun = async () => {
    const rerunPromise = launchWorkflow(selectedRerunAdapterId || null);
    await toast.promise(rerunPromise, {
      loading: 'Starting workflow again...',
      success: 'Workflow run started.',
      error: (error) => (error instanceof Error ? error.message : 'Failed to start workflow.'),
      position: 'top-right',
    });
    await rerunPromise;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">Run</p>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{run.id}</h1>
          <p className="mt-1 text-sm text-neutral-500">Workflow: {run.workflowId || 'Unknown'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {workflowBackHref ? (
            <Button asChild type="button" variant="outline">
              <Link href={workflowBackHref}>Back to Workflow Runs</Link>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => refreshAll()}
            disabled={runQuery.isFetching || timelineQuery.isFetching}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${runQuery.isFetching || timelineQuery.isFetching ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handlePause}
            disabled={!canPause || pauseMutation.isPending}
          >
            <Pause className="mr-2 h-4 w-4" />
            {pauseMutation.isPending ? 'Pausing...' : 'Pause'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleResume}
            disabled={!canResume || resumeMutation.isPending}
          >
            <Play className="mr-2 h-4 w-4" />
            {resumeMutation.isPending ? 'Resuming...' : 'Resume'}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleCancel}
            disabled={!canCancel || cancelMutation.isPending}
          >
            <Square className="mr-2 h-4 w-4" />
            {cancelMutation.isPending ? 'Cancelling...' : 'Cancel'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline">{run.status}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Created</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-neutral-600">
            {formatDate(run.createdAt)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Started</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-neutral-600">
            {formatDate(run.startedAt)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Completed</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-neutral-600">
            {formatDate(run.completedAt)}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Runtime Adapter</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-neutral-600">
            {run.runtimeAdapterId || 'Unknown'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Runtime Revision</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-neutral-600">
            {run.runtimeRevisionId || '—'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Container Status</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-neutral-600">
            {run.container?.status || 'Not attached'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last Heartbeat</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-neutral-600">
            {formatDate(run.lastHeartbeatAt)}
          </CardContent>
        </Card>
      </div>

      <WorkflowRuntimeAdapterPanel
        title="Rerun Configuration"
        description="Native stays the default rerun path when this workflow allows it. Switch adapters here only when you want this rerun to target a different runtime."
        selectLabel="Runtime adapter for the next run"
        selectId="run-detail-rerun-adapter"
        adapters={runnableRuntimeAdapters}
        selectedAdapterId={selectedRerunAdapterId}
        preferredAdapterId={preferredRuntimeAdapterId}
        currentAdapterId={run.runtimeAdapterId}
        isPending={rerunMutation.isPending}
        isDisabled={!run.workflowId || runtimeAdaptersQuery.isLoading}
        actionVariant="outline"
        actionContent={
          <>
            <Play className="mr-2 h-4 w-4" />
            {rerunMutation.isPending
              ? 'Starting...'
              : `Run Again${selectedRerunAdapterId ? ` With ${selectedRerunAdapterId}` : ''}`}
          </>
        }
        onAdapterChange={setSelectedRerunAdapterId}
        onAction={() => {
          void handleRerun();
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Runtime Session</CardTitle>
          <CardDescription>
            Container, worker, replacement, and node context for this execution.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 text-sm text-neutral-600">
            <p>
              <span className="font-medium text-neutral-900">Container</span>:{' '}
              {run.container?.containerName || run.container?.containerId || 'Not attached'}
            </p>
            <p>
              <span className="font-medium text-neutral-900">Image</span>:{' '}
              {run.container?.image || '—'}
            </p>
            <p>
              <span className="font-medium text-neutral-900">Worker</span>: {run.workerId || '—'}
            </p>
            <p>
              <span className="font-medium text-neutral-900">Current Node</span>:{' '}
              {runDetail.state.current_node_id || '—'}
            </p>
          </div>
          <div className="space-y-2 text-sm text-neutral-600">
            <p>
              <span className="font-medium text-neutral-900">Restart Reason</span>:{' '}
              {runDetail.replacement?.restartReason || run.restartReason || '—'}
            </p>
            <p>
              <span className="font-medium text-neutral-900">Replaces Execution</span>:{' '}
              {runDetail.replacement?.replacesExecution?.id || '—'}
            </p>
            <p>
              <span className="font-medium text-neutral-900">Replacement Count</span>:{' '}
              {runDetail.replacement?.replacedByExecutions?.length ?? 0}
            </p>
            <p>
              <span className="font-medium text-neutral-900">Diagnostics Keys</span>:{' '}
              {Object.keys(runDetail.runtime?.diagnostics || {}).length}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Runtime Error</CardTitle>
          <CardDescription>Normalized from backend execution detail.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-neutral-600">{formatRunError(run.error)}</CardContent>
      </Card>

      <RunOutputs
        outputPayload={run.outputPayload}
        stateNodeOutputs={runDetail.state.node_outputs}
        artifacts={artifactsQuery.data?.items ?? []}
        isLoadingArtifacts={artifactsQuery.isLoading}
      />

      <Card>
        <CardHeader>
          <CardTitle>Conversation Context</CardTitle>
          <CardDescription>
            Linked assistant conversation and execution-scoped approval activity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-neutral-600">
          {conversationContextQuery.isLoading ? (
            <p>Loading conversation linkage...</p>
          ) : conversationContextQuery.isError ? (
            <RunsErrorAlert
              title="Failed to load conversation context"
              message={conversationContextQuery.error.message}
              onRetry={() => conversationContextQuery.refetch()}
            />
          ) : linkedConversation ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{linkedConversation.channel_type}</Badge>
                <Badge variant="outline">{linkedApprovals.length} approvals</Badge>
                <Badge variant="outline">{linkedMessages.length} linked messages</Badge>
              </div>
              <p>
                Conversation:{' '}
                <Link
                  href="/assistant"
                  className="font-medium text-neutral-900 underline-offset-4 hover:underline"
                >
                  {linkedConversation.title || linkedConversation.id}
                </Link>
              </p>
            </>
          ) : (
            <p>No linked conversation was found for this execution.</p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="events">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Execution State</CardTitle>
              <CardDescription>
                Backend execution state snapshot and runtime diagnostics.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Paused: {runDetail.state.paused ? 'Yes' : 'No'}</Badge>
                <Badge variant="outline">
                  Cancelled: {runDetail.state.cancelled ? 'Yes' : 'No'}
                </Badge>
                {run.container?.exitCode !== null && run.container?.exitCode !== undefined ? (
                  <Badge variant="outline">Exit code: {run.container.exitCode}</Badge>
                ) : null}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-neutral-200 p-4">
                  <p className="mb-2 text-sm font-medium text-neutral-900">Node Outputs</p>
                  <pre className="overflow-auto whitespace-pre-wrap text-xs text-neutral-600">
                    {JSON.stringify(runDetail.state.node_outputs || {}, null, 2)}
                  </pre>
                </div>
                <div className="rounded-lg border border-neutral-200 p-4">
                  <p className="mb-2 text-sm font-medium text-neutral-900">Runtime Diagnostics</p>
                  <pre className="overflow-auto whitespace-pre-wrap text-xs text-neutral-600">
                    {JSON.stringify(runDetail.runtime?.diagnostics || {}, null, 2)}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals">
          <Card>
            <CardHeader>
              <CardTitle>Approvals</CardTitle>
              <CardDescription>
                Conversation approval requests linked to this execution.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {conversationContextQuery.isLoading ? (
                <p className="text-sm text-neutral-500">Loading approvals...</p>
              ) : linkedApprovals.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  No linked approvals were found for this execution.
                </p>
              ) : (
                linkedApprovals.map((approval) => (
                  <div key={approval.id} className="rounded-lg border border-neutral-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-neutral-900">{approval.summary}</p>
                        <p className="text-xs text-neutral-500">{approval.id}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          variant={
                            approval.status === 'approved'
                              ? 'successful'
                              : approval.status === 'rejected' || approval.status === 'cancelled'
                                ? 'failed'
                                : 'secondary'
                          }
                        >
                          {approval.status}
                        </Badge>
                        <Badge variant="outline">{approval.approval_type}</Badge>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-neutral-600">
                      <p>
                        Target: {approval.target_type}
                        {approval.target_id ? ` · ${approval.target_id}` : ''}
                      </p>
                      <p>Requested by: {approval.requested_by_agent_id}</p>
                      <p>Updated: {formatDate(approval.updated_at)}</p>
                      <p>
                        {approval.diff_summary ||
                          approval.decision_reason ||
                          'No additional approval summary.'}
                      </p>
                    </div>
                    {approval.status === 'pending' ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void handleApprovalDecision(approval.id, 'approve')}
                          disabled={approvalDecisionMutation.isPending}
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void handleApprovalDecision(approval.id, 'reject')}
                          disabled={approvalDecisionMutation.isPending}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents">
          <Card>
            <CardHeader>
              <CardTitle>Agents</CardTitle>
              <CardDescription>
                Derived from workflow definitions, execution events, and current node state.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {workflowQuery.isLoading ? (
                <p className="text-sm text-neutral-500">Loading workflow agent definitions...</p>
              ) : workflowQuery.isError ? (
                <RunsErrorAlert
                  title="Failed to load workflow"
                  message={workflowQuery.error.message}
                  onRetry={() => workflowQuery.refetch()}
                />
              ) : derivedAgents.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  No agent definitions were available for this run.
                </p>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {derivedAgents.map((agent) => (
                    <div key={agent.id} className="rounded-lg border border-neutral-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-neutral-500" />
                            <p className="truncate font-medium text-neutral-900">{agent.name}</p>
                          </div>
                          <p className="truncate text-xs text-neutral-500">{agent.id}</p>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {agent.status}
                        </Badge>
                      </div>
                      <div className="mt-3 space-y-1 text-sm text-neutral-600">
                        <p>
                          Role:{' '}
                          {typeof agent.metadata.role === 'string' ? agent.metadata.role : '—'}
                        </p>
                        <p>Last event: {agent.lastEventType || '—'}</p>
                        <p>Last seen: {formatDate(agent.lastEventAt)}</p>
                        <p>Tool count: {String(agent.metadata.toolCount ?? 0)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
              <CardDescription>
                Derived from workflow task definitions, execution events, and current node state.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {workflowQuery.isLoading ? (
                <p className="text-sm text-neutral-500">Loading workflow task definitions...</p>
              ) : workflowQuery.isError ? (
                <RunsErrorAlert
                  title="Failed to load workflow"
                  message={workflowQuery.error.message}
                  onRetry={() => workflowQuery.refetch()}
                />
              ) : derivedTasks.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  No task definitions were available for this run.
                </p>
              ) : (
                <div className="space-y-3">
                  {derivedTasks.map((task) => (
                    <div key={task.id} className="rounded-lg border border-neutral-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <ListChecks className="h-4 w-4 text-neutral-500" />
                            <p className="truncate font-medium text-neutral-900">{task.name}</p>
                          </div>
                          <p className="truncate text-xs text-neutral-500">{task.id}</p>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {task.status}
                        </Badge>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-neutral-600 md:grid-cols-2">
                        <p>
                          Assigned agent:{' '}
                          {typeof task.metadata.agentId === 'string' ? task.metadata.agentId : '—'}
                        </p>
                        <p>Last event: {task.lastEventType || '—'}</p>
                        <p>Last seen: {formatDate(task.lastEventAt)}</p>
                        <p>Dependencies: {String(task.metadata.dependencyCount ?? 0)}</p>
                        <p>
                          Approval required: {task.metadata.humanApprovalRequired ? 'Yes' : 'No'}
                        </p>
                        <p>Event count: {String(task.metadata.eventCount ?? 0)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Runtime Logs</CardTitle>
              <CardDescription>
                Container logs<span hidden> from `/executions/{'{id}'}/runtime/logs`.</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logsQuery.isLoading ? (
                <p className="text-sm text-neutral-500">Loading logs...</p>
              ) : logsQuery.isError ? (
                <RunsErrorAlert
                  title="Failed to load runtime logs"
                  message={logsQuery.error.message}
                  onRetry={() => logsQuery.refetch()}
                />
              ) : (
                <StructuredRuntimeLogs logs={logsQuery.data} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
              <div>
                <CardTitle>Run Events</CardTitle>
                <CardDescription>Backend event log<span hidden> from `/executions/{'{id}'}/events`.</span></CardDescription>
              </div>
              <div className="inline-flex h-9 rounded-md border border-neutral-200 bg-neutral-50 p-1" aria-label="Run events view">
                <Button
                  type="button"
                  size="sm"
                  variant={eventViewMode === 'story' ? 'default' : 'ghost'}
                  className="h-7 gap-1.5 px-2"
                  aria-pressed={eventViewMode === 'story'}
                  onClick={() => setEventViewMode('story')}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Story
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={eventViewMode === 'rows' ? 'default' : 'ghost'}
                  className="h-7 gap-1.5 px-2"
                  aria-pressed={eventViewMode === 'rows'}
                  onClick={() => setEventViewMode('rows')}
                >
                  <Table2 className="h-3.5 w-3.5" />
                  Rows
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {eventsQuery.isLoading ? (
                <p className="text-sm text-neutral-500">Loading events...</p>
              ) : eventsQuery.isError ? (
                <RunsErrorAlert
                  title="Failed to load run events"
                  message={eventsQuery.error.message}
                  onRetry={() => eventsQuery.refetch()}
                />
              ) : (eventsQuery.data?.items ?? []).length === 0 ? (
                <p className="text-sm text-neutral-500">No run events recorded yet.</p>
              ) : eventViewMode === 'rows' ? (
                <EventRowsView events={eventsQuery.data?.items ?? []} />
              ) : (
                <EventStoryView events={eventsQuery.data?.items ?? []} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Observability Timeline</CardTitle>
              <CardDescription>
                Summary<span hidden> from `/observability/executions/{'{id}'}/timeline`.</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {timelineQuery.isLoading ? (
                <p className="text-sm text-neutral-500">Loading timeline...</p>
              ) : timelineQuery.isError ? (
                <RunsErrorAlert
                  title="Failed to load run timeline"
                  message={timelineQuery.error.message}
                  onRetry={() => timelineQuery.refetch()}
                />
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      Duration: {timelineQuery.data?.execution_duration_ms ?? 0} ms
                    </Badge>
                    <Badge variant="outline">
                      Events: {timelineQuery.data?.events.length ?? 0}
                    </Badge>
                  </div>
                  <p className="text-sm text-neutral-500">
                    This lifecycle follows the backend execution statuses: `created` → `queued` →
                    `running` → terminal state, with optional `paused`, `waiting_for_approval`, or
                    `cancelling`.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="artifacts">
          <Card>
            <CardHeader>
              <CardTitle>Artifacts</CardTitle>
              <CardDescription>
                Execution artifacts<span hidden> returned by the transformed backend.</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {artifactsQuery.isLoading ? (
                <p className="text-sm text-neutral-500">Loading artifacts...</p>
              ) : artifactsQuery.isError ? (
                <RunsErrorAlert
                  title="Failed to load artifacts"
                  message={artifactsQuery.error.message}
                  onRetry={() => artifactsQuery.refetch()}
                />
              ) : (artifactsQuery.data?.items ?? []).length === 0 ? (
                <p className="text-sm text-neutral-500">No artifacts were reported for this run.</p>
              ) : (
                artifactsQuery.data?.items.map((artifact) => <ArtifactCard key={artifact.id} artifact={artifact} />)
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
