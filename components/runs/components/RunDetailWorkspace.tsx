'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { formatRunDateTime, formatRunError } from '@/lib/workflows/runFormatting';
import { useWorkflowRunLauncher } from '@/lib/workflows/useWorkflowRunLauncher';
import {
  workflowExecutionEventsToGraphRuntimeEvents,
  workflowRunToGraphRuntimeEvents,
} from '@/lib/workflows/workflowGraphAdapter';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { useRunsModule } from '@/components/runs/context';
import {
  RUN_GOVERNANCE_EVENT_TYPES,
  useRunDetailData,
} from '@/components/runs/hooks/useRunDetailData';
import { useRunPresence } from '@/components/runs/hooks/useRunPresence';
import type {
  ExecutionApprovalRequest,
  ExecutionEventRecord,
  ExecutionArtifact,
  ExecutionStateSnapshot,
  RunLogEntry,
  RuntimeLogLine,
  RunSessionSummary,
} from '@/types/runtime';
import type { WorkflowDefinition } from '@/types/workflows';
import { Badge } from '@/components/library/shadcn/badge';
import { Button } from '@/components/library/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/library/shadcn/card';
import PageHeader from '@/components/app-shell/PageHeader';
import { useRegisterAssistantPageContext } from '@/components/assistant/AssistantPageContext';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/library/shadcn/accordion';
import WorkflowGraphCanvas from '@/components/workflow/WorkflowGraphCanvas';
import WorkflowRuntimeAdapterPanel from '@/components/workflow/WorkflowRuntimeAdapterPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/library/shadcn/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/library/shadcn/table';
import {
  CheckCircle2,
  Clock3,
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
import {
  RunsEmptyCard,
  RunsErrorAlert,
  RunsLoadingCard,
} from '@/components/runs/components/RunsState';
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
    bubble:
      'border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-500/30 dark:bg-sky-500/12 dark:text-sky-100',
    chip: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200',
    align: 'items-start',
  },
  {
    bubble:
      'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/12 dark:text-emerald-100',
    chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
    align: 'items-end',
  },
  {
    bubble:
      'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-500/30 dark:bg-violet-500/12 dark:text-violet-100',
    chip: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200',
    align: 'items-start',
  },
  {
    bubble:
      'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/12 dark:text-amber-100',
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
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

function runDisplayDateTime(run: RunSessionSummary) {
  return (
    formatRunDateTime(run.startedAt) ??
    formatRunDateTime(run.createdAt) ??
    formatRunDateTime(run.completedAt) ??
    formatRunDateTime(run.updatedAt) ??
    'Unknown time'
  );
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatTokenCount(value: unknown) {
  const count = numberValue(value);
  return count == null ? '—' : Math.round(count).toLocaleString('en-SG');
}

function formatCost(value: unknown, currency?: unknown) {
  const amount = numberValue(value);
  if (amount == null) {
    return '—';
  }
  const currencyCode = typeof currency === 'string' && currency.trim() ? currency : 'USD';
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: amount < 0.01 ? 6 : 4,
  }).format(amount);
}

function contextBadgeVariant(status: unknown) {
  if (status === 'overflow' || status === 'critical') {
    return 'failed' as const;
  }
  if (status === 'warning') {
    return 'secondary' as const;
  }
  if (status === 'normal') {
    return 'successful' as const;
  }
  return 'outline' as const;
}

function formatRunStatus(status: string) {
  return status.replace(/_/g, ' ');
}

function runStatusTone(status: string) {
  switch (status) {
    case 'completed':
      return {
        card: 'border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-500/12',
        badge:
          'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200',
        dot: 'bg-emerald-500',
        text: 'text-emerald-700 dark:text-emerald-200',
      };
    case 'running':
    case 'queued':
    case 'created':
      return {
        card: 'border-l-sky-500 bg-sky-50/50 dark:bg-sky-500/12',
        badge:
          'border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-200',
        dot: 'bg-sky-500',
        text: 'text-sky-700 dark:text-sky-200',
      };
    case 'waiting_for_approval':
    case 'paused':
    case 'cancelling':
      return {
        card: 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-500/12',
        badge:
          'border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200',
        dot: 'bg-amber-500',
        text: 'text-amber-700 dark:text-amber-200',
      };
    case 'failed':
    case 'cancelled':
      return {
        card: 'border-l-red-500 bg-red-50/50 dark:bg-red-500/12',
        badge:
          'border-red-200 bg-red-100 text-red-800 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200',
        dot: 'bg-red-500',
        text: 'text-red-700 dark:text-red-200',
      };
    default:
      return {
        card: 'border-l-neutral-400 bg-neutral-50/70 dark:bg-white/4',
        badge:
          'border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-white/10 dark:bg-white/6 dark:text-neutral-200',
        dot: 'bg-neutral-400',
        text: 'text-neutral-600 dark:text-neutral-300',
      };
  }
}

function containerStatusTone(status?: string | null) {
  switch (status) {
    case 'running':
    case 'healthy':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200';
    case 'created':
    case 'starting':
    case 'restarting':
      return 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-200';
    case 'exited':
    case 'removed':
    case 'failed':
    case 'dead':
      return 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200';
    default:
      return 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-white/10 dark:bg-white/6 dark:text-neutral-200';
  }
}

function governanceEventLabel(eventType: string | null | undefined) {
  switch (eventType) {
    case 'token.usage.recorded':
      return 'Token usage';
    case 'model.fallback.used':
      return 'Model fallback used';
    case 'model.fallback.failed':
      return 'Model fallback failed';
    case 'token.budget.warning':
      return 'Budget warning';
    case 'token.budget.exceeded':
      return 'Budget exceeded';
    case 'context.health.recorded':
      return 'Context health';
    case 'context.compaction.started':
      return 'Compaction started';
    case 'context.compaction.completed':
      return 'Compaction completed';
    case 'context.compaction.failed':
      return 'Compaction failed';
    case 'supervisor.steering.requested':
      return 'Steering requested';
    case 'supervisor.steering.applied':
      return 'Steering applied';
    default:
      return eventType || 'Governance event';
  }
}

function governanceEventSummary(event: ExecutionEventRecord) {
  const payload = isRecord(event.payload) ? event.payload : {};
  const metrics = isRecord(event.metrics) ? event.metrics : {};
  const totalTokens = payload.total_tokens ?? metrics.total_tokens;
  const status = payload.status ?? event.status;
  const action = payload.action ?? payload.recommended_action;

  if (event.event_type === 'model.fallback.used') {
    const fallback = modelFallbackFromEvent(event);
    return fallback
      ? `Switched to ${modelFallbackLabel(fallback.fallbackProvider, fallback.fallbackModel)} after ${modelFallbackLabel(fallback.primaryProvider, fallback.primaryModel)} failed.`
      : 'Model fallback switched to a backup model.';
  }
  if (event.event_type === 'model.fallback.failed') {
    const attempts = Array.isArray(payload.attempts) ? payload.attempts.length : 0;
    return `${attempts} fallback attempt${attempts === 1 ? '' : 's'} failed. ${stringValue(payload.error) ?? ''}`.trim();
  }

  if (event.event_type === 'token.usage.recorded') {
    const fallback = modelFallbackFromEvent(event);
    if (fallback) {
      return `Switched to ${modelFallbackLabel(fallback.fallbackProvider, fallback.fallbackModel)} after ${modelFallbackLabel(fallback.primaryProvider, fallback.primaryModel)} failed.`;
    }
    return `Total tokens ${formatTokenCount(totalTokens)}`;
  }
  if (event.event_type === 'token.budget.warning' || event.event_type === 'token.budget.exceeded') {
    return `${stringValue(payload.scope) ?? 'run'} used ${formatTokenCount(payload.used_tokens)} / ${formatTokenCount(payload.budget_tokens)} tokens`;
  }
  if (event.event_type === 'context.health.recorded') {
    return `${stringValue(status) ?? 'unknown'} · ${formatTokenCount(payload.estimated_total_context_tokens)} / ${formatTokenCount(payload.context_window)} tokens`;
  }
  if (event.event_type === 'context.compaction.completed') {
    return `Saved ${formatTokenCount(payload.estimated_tokens_saved)} tokens`;
  }
  if (event.event_type === 'context.compaction.failed') {
    return stringValue(payload.error) ?? stringValue(payload.reason) ?? 'Compaction failed';
  }
  if (
    event.event_type === 'supervisor.steering.requested' ||
    event.event_type === 'supervisor.steering.applied'
  ) {
    return stringValue(action) ?? stringValue(payload.reason) ?? 'Supervisor steering event';
  }
  return stringValue(payload.message) ?? stringValue(status) ?? 'Recorded by runtime governance';
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
    return 'border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/12 dark:text-red-100';
  }
  if (level === 'warn') {
    return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/12 dark:text-amber-100';
  }
  return 'border-neutral-200 bg-white text-neutral-800 dark:border-white/10 dark:bg-white/5 dark:text-neutral-100';
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
      bubble:
        'border-neutral-200 bg-neutral-50 text-neutral-900 dark:border-white/10 dark:bg-white/5 dark:text-neutral-100',
      chip: 'bg-neutral-200 text-neutral-700 dark:bg-white/10 dark:text-neutral-300',
      align: 'items-center',
    };
  }

  return EVENT_CHAT_PALETTE[hashString(actorLabel(event)) % EVENT_CHAT_PALETTE.length];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type NativeApprovalStatus = 'pending' | 'approved' | 'rejected';

interface NativeApprovalActivity {
  id: string;
  approvalRequestId?: string | null;
  requestEventId?: string | null;
  toolId: string;
  toolName: string;
  status: NativeApprovalStatus;
  requestedAt?: string;
  decidedAt?: string;
  agentId?: string | null;
  taskId?: string | null;
  riskLabels: string[];
  localPrivilegedExecution: boolean;
  decisionMode?: string | null;
  delegate?: string | null;
  respondedBy?: string | null;
  reason?: string | null;
  argumentsPayload?: Record<string, unknown> | null;
  responsePayload?: Record<string, unknown> | null;
  source?: 'event' | 'metadata' | 'persisted';
}

function RunStatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = runStatusTone(status);

  return (
    <Badge
      variant="outline"
      className={cn('inline-flex items-center gap-1.5 capitalize', tone.badge, className)}
    >
      <span className={cn('h-2 w-2 rounded-full', tone.dot)} aria-hidden="true" />
      {formatRunStatus(status)}
    </Badge>
  );
}

function SummaryCard({
  title,
  value,
  description,
  children,
  className,
}: {
  title: string;
  value?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        'border-neutral-200 shadow-sm dark:border-white/10 dark:bg-[rgba(10,17,30,0.78)]',
        className
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {children ?? (
          <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{value}</div>
        )}
        {description ? (
          <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">{description}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function workflowNameFromRun(run: RunSessionSummary) {
  const metadata = isRecord(run.metadata) ? run.metadata : {};
  const inputPayload = isRecord(run.inputPayload) ? run.inputPayload : {};
  const outputPayload = isRecord(run.outputPayload) ? run.outputPayload : {};

  return (
    stringValue(metadata.workflowName) ??
    stringValue(metadata.workflow_name) ??
    stringValue(metadata.workflow) ??
    stringValue(metadata.office_run_title) ??
    stringValue(inputPayload.workflowName) ??
    stringValue(inputPayload.workflow_name) ??
    stringValue(inputPayload.workflow) ??
    stringValue(outputPayload.workflowName) ??
    stringValue(outputPayload.workflow_name) ??
    stringValue(outputPayload.workflow)
  );
}

function workflowNameFromEvent(event: ExecutionEventRecord) {
  const payload = isRecord(event.payload) ? event.payload : {};
  const metadata = isRecord(event.metadata) ? event.metadata : {};

  return workflowNameFromPayloadValue(metadata) ?? workflowNameFromPayloadValue(payload);
}

function workflowNameFromEvents(events: ExecutionEventRecord[]) {
  for (const event of events) {
    const workflowName = workflowNameFromEvent(event);
    if (workflowName) {
      return workflowName;
    }
  }

  return null;
}

function workflowNameFromPayloadValue(value: unknown, depth = 0): string | null {
  if (depth > 4) {
    return null;
  }

  if (typeof value === 'string') {
    try {
      return workflowNameFromPayloadValue(JSON.parse(value), depth + 1);
    } catch {
      return null;
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const workflowName = workflowNameFromPayloadValue(item, depth + 1);
      if (workflowName) {
        return workflowName;
      }
    }

    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const directName =
    stringValue(value.workflowName) ??
    stringValue(value.workflow_name) ??
    stringValue(value.workflow);
  if (directName) {
    return directName;
  }

  const nestedCandidates = [
    value.input,
    value.data,
    value.payload,
    value.arguments,
    value.messages,
    value.content,
    value.plain_text,
  ];
  for (const candidate of nestedCandidates) {
    const workflowName = workflowNameFromPayloadValue(candidate, depth + 1);
    if (workflowName) {
      return workflowName;
    }
  }

  return null;
}

function workflowNameFromMessages(messages: unknown[]) {
  for (const message of messages) {
    const record = isRecord(message) ? message : {};
    const workflowName =
      workflowNameFromPayloadValue(record.content) ??
      workflowNameFromPayloadValue(record.plain_text);
    if (workflowName) {
      return workflowName;
    }
  }

  return null;
}

function eventStringValue(event: ExecutionEventRecord, keys: string[]) {
  const payload = isRecord(event.payload) ? event.payload : {};
  const metadata = isRecord(event.metadata) ? event.metadata : {};

  for (const key of keys) {
    const value =
      stringValue(event[key]) ?? stringValue(payload[key]) ?? stringValue(metadata[key]);
    if (value) {
      return value;
    }
  }

  return null;
}

function usableWorkflowName(name: unknown, ids: Array<string | null | undefined>) {
  const value = stringValue(name);
  if (!value) {
    return null;
  }

  return ids.some((id) => id?.trim() === value) ? null : value;
}

function stringArrayValue(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((item) => (typeof item === 'string' && item.trim() ? [item] : []))
    : [];
}

function usageBreakdownEntries(value: unknown) {
  if (!isRecord(value)) {
    return [];
  }
  return Object.entries(value)
    .flatMap(([label, bucket]) => (isRecord(bucket) ? [{ label, bucket }] : []))
    .sort(
      (left, right) =>
        (numberValue(right.bucket.total_tokens) ?? 0) - (numberValue(left.bucket.total_tokens) ?? 0)
    );
}

type ModelFallbackRecord = {
  primaryProvider: string | null;
  primaryModel: string | null;
  fallbackProvider: string | null;
  fallbackModel: string | null;
  fallbackIndex: number | null;
  agentId: string | null;
  taskId: string | null;
  modelRequestId: string | null;
  eventId: string | null;
  sequence: number | null;
  updatedAt: string | null;
};

function modelFallbackLabel(provider: string | null, model: string | null) {
  if (provider && model) {
    return `${provider}:${model}`;
  }
  return model ?? provider ?? 'unknown';
}

function modelFallbackRecordFromValue(value: unknown): ModelFallbackRecord | null {
  if (!isRecord(value) || value.used !== true) {
    return null;
  }

  return {
    primaryProvider: stringValue(value.primary_provider),
    primaryModel: stringValue(value.primary_model),
    fallbackProvider: stringValue(value.fallback_provider),
    fallbackModel: stringValue(value.fallback_model),
    fallbackIndex: numberValue(value.fallback_index),
    agentId: stringValue(value.agent_id),
    taskId: stringValue(value.task_id),
    modelRequestId: stringValue(value.model_request_id),
    eventId: stringValue(value.event_id),
    sequence: numberValue(value.sequence),
    updatedAt: stringValue(value.updated_at),
  };
}

function modelFallbackFromEvent(event: ExecutionEventRecord): ModelFallbackRecord | null {
  const payload = isRecord(event.payload) ? event.payload : {};
  if (event.event_type === 'model.fallback.used') {
    const record = modelFallbackRecordFromValue({ ...payload, used: true });
    return record
      ? {
          ...record,
          agentId: record.agentId ?? event.agent_id ?? null,
          taskId: record.taskId ?? event.task_id ?? null,
          modelRequestId: record.modelRequestId ?? event.model_request_id ?? null,
          eventId: record.eventId ?? event.id,
          sequence: record.sequence ?? event.sequence,
          updatedAt: record.updatedAt ?? event.timestamp ?? null,
        }
      : null;
  }
  const usage = isRecord(payload.usage) ? payload.usage : {};
  const providerUsage = isRecord(usage.provider_usage) ? usage.provider_usage : {};
  const record =
    modelFallbackRecordFromValue(providerUsage.model_fallback) ??
    modelFallbackRecordFromValue(usage.model_fallback);
  return record
    ? {
        ...record,
        agentId: record.agentId ?? event.agent_id ?? null,
        taskId: record.taskId ?? event.task_id ?? null,
        modelRequestId: record.modelRequestId ?? event.model_request_id ?? null,
        eventId: record.eventId ?? event.id,
        sequence: record.sequence ?? event.sequence,
        updatedAt: record.updatedAt ?? event.timestamp ?? null,
      }
    : null;
}

function modelFallbackEntries(tokenUsage: Record<string, unknown>, events: ExecutionEventRecord[]) {
  const snapshotRecords = Array.isArray(tokenUsage.model_fallbacks)
    ? tokenUsage.model_fallbacks
        .map(modelFallbackRecordFromValue)
        .filter((record): record is ModelFallbackRecord => record !== null)
    : [];

  if (snapshotRecords.length > 0) {
    return snapshotRecords;
  }

  return events
    .filter(
      (event) =>
        event.event_type === 'token.usage.recorded' || event.event_type === 'model.fallback.used'
    )
    .map(modelFallbackFromEvent)
    .filter((record): record is ModelFallbackRecord => record !== null);
}

function RuntimeUsageBreakdown({
  title,
  emptyLabel,
  entries,
}: {
  title: string;
  emptyLabel: string;
  entries: Array<{ label: string; bucket: Record<string, unknown> }>;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-white/10 dark:bg-[rgba(9,15,27,0.82)]">
      <div className="border-b border-neutral-200 px-4 py-3 dark:border-white/10">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{title}</p>
      </div>
      {entries.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Prompt</TableHead>
              <TableHead className="text-right">Completion</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map(({ label, bucket }) => (
              <TableRow key={label}>
                <TableCell className="max-w-3xs truncate font-medium text-neutral-900 dark:text-neutral-100">
                  {label}
                </TableCell>
                <TableCell className="text-right">
                  {formatTokenCount(bucket.prompt_tokens)}
                </TableCell>
                <TableCell className="text-right">
                  {formatTokenCount(bucket.completion_tokens)}
                </TableCell>
                <TableCell className="text-right">
                  {formatTokenCount(bucket.total_tokens)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCost(bucket.estimated_cost, bucket.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400">{emptyLabel}</p>
      )}
    </div>
  );
}

function ModelFallbackBreakdown({ entries }: { entries: ModelFallbackRecord[] }) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-white/10 dark:bg-[rgba(9,15,27,0.82)]">
      <div className="border-b border-neutral-200 px-4 py-3 dark:border-white/10">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          Model Fallbacks
        </p>
      </div>
      {entries.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Primary</TableHead>
              <TableHead>Fallback</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Task</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry, index) => (
              <TableRow key={`${entry.eventId ?? entry.modelRequestId ?? 'fallback'}-${index}`}>
                <TableCell className="max-w-[14rem] truncate font-medium text-neutral-900 dark:text-neutral-100">
                  {modelFallbackLabel(entry.primaryProvider, entry.primaryModel)}
                </TableCell>
                <TableCell className="max-w-[14rem] truncate">
                  {modelFallbackLabel(entry.fallbackProvider, entry.fallbackModel)}
                </TableCell>
                <TableCell>{entry.agentId ?? '—'}</TableCell>
                <TableCell>{entry.taskId ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400">
          No model fallback switches recorded.
        </p>
      )}
    </div>
  );
}

function nativeApprovalStatusValue(value: unknown): NativeApprovalStatus {
  return value === 'approved' || value === 'rejected' ? value : 'pending';
}

function nativeApprovalDenyLabels(activity: NativeApprovalActivity) {
  const labels = new Set(activity.riskLabels);
  return [
    'browser',
    'credentials',
    'dangerous',
    'filesystem',
    'local_privileged_execution',
    'mcp',
    'mutation',
    'network',
    'shell',
  ].filter((label) => labels.has(label));
}

function nativeApprovalDecisionLabel(activity: NativeApprovalActivity, delegationEnabled: boolean) {
  if (activity.decisionMode === 'delegated') {
    return 'Main agent delegated';
  }
  if (
    delegationEnabled &&
    activity.status === 'pending' &&
    nativeApprovalDenyLabels(activity).length === 0
  ) {
    return 'Delegation eligible';
  }
  return 'Human-held';
}

function deriveNativeApprovalActivities(
  events: ExecutionEventRecord[],
  executionMetadata?: Record<string, unknown> | null,
  persistedApprovals: ExecutionApprovalRequest[] = []
) {
  const activities: NativeApprovalActivity[] = [];
  const orderedEvents = [...events].sort((left, right) => left.sequence - right.sequence);

  for (const event of orderedEvents) {
    const payload = isRecord(event.payload) ? event.payload : {};
    const toolId = stringValue(payload.tool_id) ?? stringValue(event.tool_call_id) ?? event.id;
    const toolName = stringValue(payload.tool_name) ?? toolId;

    if (event.event_type === 'approval.requested') {
      const argumentsPayload = isRecord(payload.arguments) ? payload.arguments : null;
      activities.push({
        id: event.id,
        requestEventId: event.id,
        toolId,
        toolName,
        status: 'pending',
        requestedAt: event.timestamp,
        agentId: event.agent_id,
        taskId: event.task_id,
        riskLabels: stringArrayValue(payload.risk_labels),
        localPrivilegedExecution: payload.local_privileged_execution === true,
        argumentsPayload,
        source: 'event',
      });
      continue;
    }

    if (event.event_type !== 'approval.granted' && event.event_type !== 'approval.rejected') {
      continue;
    }

    const matchingActivity =
      [...activities]
        .reverse()
        .find((activity) => activity.toolId === toolId && activity.status === 'pending') ??
      [...activities].reverse().find((activity) => activity.toolId === toolId);
    const decisionMetadata = isRecord(payload.decision_metadata) ? payload.decision_metadata : {};
    const nextStatus: NativeApprovalStatus =
      event.event_type === 'approval.granted' ? 'approved' : 'rejected';
    const patch = {
      status: nextStatus,
      decidedAt: event.timestamp,
      decisionMode: stringValue(decisionMetadata.mode),
      delegate: stringValue(decisionMetadata.delegate),
      reason: stringValue(payload.reason),
      riskLabels: stringArrayValue(decisionMetadata.risk_labels),
    };

    if (matchingActivity) {
      matchingActivity.status = patch.status;
      matchingActivity.decidedAt = patch.decidedAt;
      matchingActivity.decisionMode = patch.decisionMode;
      matchingActivity.delegate = patch.delegate;
      matchingActivity.reason = patch.reason;
      if (patch.riskLabels.length > 0) {
        matchingActivity.riskLabels = patch.riskLabels;
      }
    } else {
      activities.push({
        id: event.id,
        toolId,
        toolName,
        status: patch.status,
        decidedAt: patch.decidedAt,
        agentId: event.agent_id,
        taskId: event.task_id,
        riskLabels: patch.riskLabels,
        localPrivilegedExecution: false,
        decisionMode: patch.decisionMode,
        delegate: patch.delegate,
        reason: patch.reason,
        argumentsPayload: null,
        source: 'event',
      });
    }
  }

  const pendingApproval = isRecord(executionMetadata?.pending_approval)
    ? executionMetadata.pending_approval
    : null;
  if (pendingApproval) {
    const toolId = stringValue(pendingApproval.tool_id);
    const approvalMetadata = isRecord(pendingApproval.approval_metadata)
      ? pendingApproval.approval_metadata
      : {};
    if (
      toolId &&
      !activities.some((activity) => activity.toolId === toolId && activity.status === 'pending')
    ) {
      activities.push({
        id: `pending-${toolId}`,
        toolId,
        toolName: stringValue(approvalMetadata.tool_name) ?? toolId,
        status: 'pending',
        agentId: stringValue(approvalMetadata.agent_id),
        taskId: stringValue(approvalMetadata.task_id),
        riskLabels: stringArrayValue(approvalMetadata.risk_labels),
        localPrivilegedExecution: approvalMetadata.local_privileged_execution === true,
        argumentsPayload: isRecord(pendingApproval.payload) ? pendingApproval.payload : null,
        source: 'metadata',
      });
    }
  }

  for (const row of persistedApprovals) {
    const requestPayload = isRecord(row.request_payload) ? row.request_payload : {};
    const responsePayload = isRecord(row.response_payload) ? row.response_payload : {};
    const approvalMetadata = isRecord(requestPayload.approval_metadata)
      ? requestPayload.approval_metadata
      : {};
    const responseMetadata = isRecord(responsePayload.metadata) ? responsePayload.metadata : {};
    const toolId =
      stringValue(row.tool_id) ??
      stringValue(approvalMetadata.tool_id) ??
      stringValue(requestPayload.tool_id) ??
      row.id;
    const toolName =
      stringValue(approvalMetadata.tool_name) ?? stringValue(requestPayload.tool_name) ?? toolId;
    const argumentsPayload = isRecord(requestPayload.arguments)
      ? requestPayload.arguments
      : isRecord(requestPayload.payload)
        ? requestPayload.payload
        : null;
    const riskLabels =
      stringArrayValue(approvalMetadata.risk_labels).length > 0
        ? stringArrayValue(approvalMetadata.risk_labels)
        : stringArrayValue(responseMetadata.risk_labels);
    const matchingActivity =
      activities.find((activity) => activity.approvalRequestId === row.id) ??
      activities.find((activity) => row.event_id && activity.requestEventId === row.event_id) ??
      [...activities].reverse().find((activity) => activity.toolId === toolId);
    const patch: NativeApprovalActivity = {
      id: row.id,
      approvalRequestId: row.id,
      requestEventId: row.event_id ?? matchingActivity?.requestEventId ?? null,
      toolId,
      toolName,
      status: nativeApprovalStatusValue(row.status),
      requestedAt: row.requested_at ?? matchingActivity?.requestedAt,
      decidedAt: row.responded_at ?? matchingActivity?.decidedAt,
      agentId: stringValue(approvalMetadata.agent_id) ?? matchingActivity?.agentId,
      taskId: stringValue(approvalMetadata.task_id) ?? matchingActivity?.taskId,
      riskLabels: riskLabels.length > 0 ? riskLabels : (matchingActivity?.riskLabels ?? []),
      localPrivilegedExecution:
        approvalMetadata.local_privileged_execution === true ||
        matchingActivity?.localPrivilegedExecution === true,
      decisionMode:
        stringValue(responseMetadata.mode) ??
        stringValue(approvalMetadata.decision_mode) ??
        matchingActivity?.decisionMode,
      delegate:
        stringValue(responseMetadata.delegate) ??
        stringValue(approvalMetadata.delegate) ??
        matchingActivity?.delegate,
      respondedBy: stringValue(row.responded_by) ?? matchingActivity?.respondedBy,
      reason: stringValue(responsePayload.reason) ?? matchingActivity?.reason,
      argumentsPayload: argumentsPayload ?? matchingActivity?.argumentsPayload ?? null,
      responsePayload: Object.keys(responsePayload).length > 0 ? responsePayload : null,
      source: 'persisted',
    };

    if (matchingActivity) {
      Object.assign(matchingActivity, patch);
    } else {
      activities.push(patch);
    }
  }

  return activities.sort((left, right) => {
    const leftTime = new Date(left.decidedAt ?? left.requestedAt ?? 0).getTime();
    const rightTime = new Date(right.decidedAt ?? right.requestedAt ?? 0).getTime();
    return rightTime - leftTime;
  });
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

function parseDisplayJsonText(value: string) {
  const initial = value.trim();
  const fencedJsonMatch = initial.match(/^```(?:json|JSON)?\s*\n([\s\S]*?)\n```$/);
  const trimmed = (fencedJsonMatch?.[1] ?? initial).trim();
  if (!trimmed || !/^[{[]/.test(trimmed)) {
    return null;
  }

  const candidates = [trimmed];
  if (/^[{[]\s*\\["]/.test(trimmed)) {
    candidates.push(trimmed.replace(/\\"/g, '"'));
  }
  if (trimmed.includes('\n')) {
    const escapedLineBreaks = trimmed.replace(/\r?\n/g, '\\n');
    candidates.push(escapedLineBreaks);
    if (/^[{[]\s*\\["]/.test(escapedLineBreaks)) {
      candidates.push(escapedLineBreaks.replace(/\\"/g, '"'));
    }
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (isRecord(parsed) || Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Some runtimes stringify JSON one layer too far; try the next display-safe form.
    }
  }

  return null;
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
  return (
    events.find((event) => {
      if (event.event_type !== 'artifact.created') {
        return false;
      }
      const payload = event.payload ?? {};
      const name = payloadText(payload, ['name', 'Name']);
      const uri = payloadText(payload, ['uri', 'Uri']);
      return (
        name === 'final_output.txt' ||
        uri?.endsWith('/final_output') ||
        uri?.includes('/final_output')
      );
    }) ?? null
  );
}

function sanitizeDisplayPayload(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.trim() === LLM_PARSE_FAILURE ? 'Thought unavailable' : value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeDisplayPayload);
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeDisplayPayload(item)])
    );
  }

  return value;
}

function normalizeMarkdownLikeText(value: string) {
  const lines = value.replace(/\r\n/g, '\n').split('\n');
  const normalized: string[] = [];
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return;
    }

    normalized.push(paragraphLines.join(' ').replace(/\s+/g, ' ').trim());
    paragraphLines = [];
  };

  // Agent outputs often arrive as hard-wrapped plain text rather than real markdown.
  // Re-group prose into paragraphs so the run story reads like a user-facing summary.
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      if (normalized[normalized.length - 1] !== '') {
        normalized.push('');
      }
      continue;
    }

    const isStructuredLine =
      /^(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```|\|)/.test(trimmed) ||
      /^([A-Z][A-Z\s]+:|[A-Z][A-Z\s]+$)/.test(trimmed) ||
      /^[A-Z][^:]{0,80}:$/.test(trimmed);

    if (isStructuredLine) {
      flushParagraph();
      normalized.push(line);
      continue;
    }

    paragraphLines.push(trimmed);
  }

  flushParagraph();

  return normalized.join('\n').trim();
}

function eventPrimaryOutput(event: ExecutionEventRecord) {
  const payload = event.payload ?? {};

  if (event.event_type === 'agent.message.created') {
    return payloadText(payload, [
      'content',
      'message',
      'summary',
      'output',
      'final_output',
      'text',
    ]);
  }

  if (event.event_type === 'llm.response.created') {
    return payloadText(payload, ['output', 'Output', 'text', 'Text', 'content', 'message']);
  }

  if (event.event_type === 'execution.completed') {
    return finalOutputFromPayload(payload) ?? cleanPayloadText(payload.error);
  }

  if (event.event_type === 'artifact.created') {
    return payloadText(payload, ['content', 'text', 'message']);
  }

  return null;
}

function showEventDetails(event: ExecutionEventRecord) {
  return (
    event.event_type === 'agent.message.created' ||
    event.event_type === 'llm.response.created' ||
    event.event_type === 'execution.completed' ||
    event.event_type === 'artifact.created' ||
    event.event_type === 'llm.request.created'
  );
}

function readableMessageContent(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const text = readableMessageContent(item);
      if (text) {
        return text;
      }
    }
    return null;
  }

  if (isRecord(value)) {
    return (
      readableMessageContent(value.text) ??
      readableMessageContent(value.content) ??
      readableMessageContent(value.input)
    );
  }

  return null;
}

function requestMessagePreview(payload: Record<string, unknown>) {
  if (!Array.isArray(payload.messages)) {
    return null;
  }

  for (let index = payload.messages.length - 1; index >= 0; index -= 1) {
    const message = payload.messages[index];
    if (!isRecord(message)) {
      continue;
    }

    const text = readableMessageContent(message.content);
    if (text) {
      return text;
    }
  }

  return null;
}

function summarizeEventPayload(event: ExecutionEventRecord) {
  const payload = event.payload ?? {};

  if (event.event_type === 'llm.request.created') {
    const preview = requestMessagePreview(payload);
    if (preview) {
      return preview;
    }

    return hasThoughtParseError(payload) || isUnavailableThought(payloadThought(payload))
      ? 'Prompt sent to the model. Intermediate thought was not returned in a readable format.'
      : 'Prompt sent to the model with captured reasoning context.';
  }

  if (event.event_type === 'llm.response.created') {
    const response = payloadText(payload, [
      'output',
      'Output',
      'text',
      'Text',
      'content',
      'message',
    ]);
    return response
      ? (response.split('\n').find((line) => line.trim()) ?? 'Model response received.')
      : 'Model response received.';
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
    return output
      ? 'Run completed and produced a final output.'
      : 'Run completed without a final output.';
  }

  const candidateKeys = [
    'error',
    'content',
    'message',
    'summary',
    'reason',
    'task_name',
    'tool_name',
    'status',
  ];
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
  const normalized = normalizeMarkdownLikeText(children);

  return (
    <div
      className={`min-w-0 max-w-full [overflow-wrap:anywhere] ${compact ? 'space-y-1 text-sm' : 'space-y-3 text-sm leading-6'}`}
    >
      <ReactMarkdown
        components={{
          a: ({ children: linkChildren, href }) => (
            <a
              href={href}
              className="font-medium text-sky-700 underline-offset-4 hover:underline dark:text-sky-300"
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noreferrer' : undefined}
            >
              {linkChildren}
            </a>
          ),
          code: ({ children: codeChildren }) => (
            <code className="max-w-full whitespace-pre-wrap rounded bg-black/5 px-1 py-0.5 font-mono text-[0.9em] text-neutral-900 [overflow-wrap:anywhere] dark:bg-white/10 dark:text-neutral-100">
              {codeChildren}
            </code>
          ),
          h1: ({ children: headingChildren }) => (
            <h3 className="text-base font-semibold text-neutral-950 dark:text-neutral-50">
              {headingChildren}
            </h3>
          ),
          h2: ({ children: headingChildren }) => (
            <h3 className="text-base font-semibold text-neutral-950 dark:text-neutral-50">
              {headingChildren}
            </h3>
          ),
          h3: ({ children: headingChildren }) => (
            <h4 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
              {headingChildren}
            </h4>
          ),
          li: ({ children: listChildren }) => (
            <li className="ml-4 list-disc pl-1">{listChildren}</li>
          ),
          ol: ({ children: listChildren }) => <ol className="space-y-1">{listChildren}</ol>,
          pre: ({ children: preChildren }) => (
            <pre className="max-w-full overflow-auto whitespace-pre-wrap rounded-md bg-black/5 p-3 font-mono text-xs [overflow-wrap:anywhere] dark:bg-white/10">
              {preChildren}
            </pre>
          ),
          p: ({ children: paragraphChildren }) => <p>{paragraphChildren}</p>,
          ul: ({ children: listChildren }) => <ul className="space-y-1">{listChildren}</ul>,
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}

function MissingThought() {
  return (
    <div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500 dark:border-white/10 dark:bg-white/4 dark:text-neutral-400">
      Thought not available in a readable format. The runtime marked this as a parser miss, not
      model content.
    </div>
  );
}

function PrimitivePayloadValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-neutral-400 dark:text-neutral-500">—</span>;
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

  return <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{String(value)}</span>;
}

function textLikeField(key?: string) {
  const normalized = key?.toLowerCase();
  return (
    normalized === 'content' ||
    normalized === 'message' ||
    normalized === 'text' ||
    normalized === 'prompt' ||
    normalized === 'instructions'
  );
}

function MessagePayloadList({ messages }: { messages: unknown[] }) {
  return (
    <div className="min-w-0 space-y-2">
      {messages.map((message, index) => {
        const record = isRecord(message) ? message : {};
        const role = typeof record.role === 'string' ? record.role : `message ${index + 1}`;
        const content = record.content;

        return (
          <div
            key={`${role}-${index}`}
            className="min-w-0 rounded-md border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{role}</Badge>
              {typeof record.name === 'string' && record.name ? (
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {record.name}
                </span>
              ) : null}
            </div>
            <PayloadValue value={content} depth={1} fieldKey="content" />
          </div>
        );
      })}
    </div>
  );
}

function PayloadValue({
  value,
  depth = 0,
  fieldKey,
}: {
  value: unknown;
  depth?: number;
  fieldKey?: string;
}) {
  if (fieldKey?.toLowerCase() === 'thought' && isUnavailableThought(value)) {
    return <MissingThought />;
  }

  if (typeof value === 'string' && (value.includes('\n') || textLikeField(fieldKey))) {
    return <MarkdownBlock compact>{value}</MarkdownBlock>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-neutral-400 dark:text-neutral-500">Empty list</span>;
    }

    if (depth > 2) {
      return <span className="text-neutral-500 dark:text-neutral-400">{value.length} items</span>;
    }

    return (
      <div className="space-y-2">
        {value.map((item, index) => (
          <div
            key={index}
            className="rounded-md border border-black/10 bg-white/60 p-2 dark:border-white/10 dark:bg-white/4"
          >
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Item {index + 1}
            </div>
            <PayloadValue value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  if (isRecord(value)) {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined);
    if (entries.length === 0) {
      return <span className="text-neutral-400 dark:text-neutral-500">Empty object</span>;
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

function filterPayloadEntries(
  payload: Record<string, unknown>,
  excludedKeys: string[] = []
): Array<[string, unknown]> {
  const excluded = new Set(excludedKeys.map((key) => key.toLowerCase()));
  return Object.entries(payload).filter(
    ([key, value]) => value !== undefined && !excluded.has(key.toLowerCase())
  );
}

function PayloadFields({ entries, depth }: { entries: Array<[string, unknown]>; depth: number }) {
  return (
    <dl className="grid min-w-0 gap-2">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className={
            depth === 0
              ? 'min-w-0 rounded-md border border-black/10 bg-white/60 p-2 dark:border-white/10 dark:bg-white/6'
              : 'min-w-0'
          }
        >
          <dt className="min-w-0 text-[11px] font-medium uppercase tracking-wide text-neutral-500 [overflow-wrap:anywhere] dark:text-neutral-400">
            {formatPayloadKey(key)}
          </dt>
          <dd className="mt-1 min-w-0 text-sm text-neutral-800 dark:text-neutral-100">
            <PayloadValue value={value} depth={depth + 1} fieldKey={key} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function EventTitle({ event }: { event: ExecutionEventRecord }) {
  if (event.event_type === 'agent.message.created') {
    return <>Agent update</>;
  }

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
  if (event.event_type === 'agent.message.created') {
    return <MessageSquare className="h-4 w-4" />;
  }

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
    <section className="rounded-md border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.07]">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-300">
        {title}
      </p>
      <div className={scrollable ? 'max-h-72 overflow-auto pr-1' : ''}>{children}</div>
    </section>
  );
}

function LlmResponseDetails({ payload }: { payload: Record<string, unknown> }) {
  const output = cleanPayloadText(payload.output) ?? cleanPayloadText(payload.Output);
  const text = cleanPayloadText(payload.text) ?? cleanPayloadText(payload.Text);
  const primary = output ?? text;
  const hasDistinctText = Boolean(output && text && output.trim() !== text.trim());
  const otherEntries = filterPayloadEntries(payload, ['output', 'text', 'thought', 'content']);

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
  const entries = filterPayloadEntries(payload, ['thought']);

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
  const otherEntries = filterPayloadEntries(payload, [
    'output',
    'final_output',
    'finaloutput',
    'error',
    'content',
  ]);

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

function AgentMessageDetails({ payload }: { payload: Record<string, unknown> }) {
  const entries = filterPayloadEntries(payload, [
    'content',
    'message',
    'summary',
    'output',
    'text',
    'final_output',
  ]);

  if (entries.length === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        No additional payload fields.
      </p>
    );
  }

  return <PayloadFields entries={entries} depth={0} />;
}

function EventPayloadDetails({ event }: { event: ExecutionEventRecord }) {
  const payload = event.payload ?? {};

  if (event.event_type === 'agent.message.created') {
    return <AgentMessageDetails payload={payload} />;
  }

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
  const llmResponseCount = events.filter(
    (event) => event.event_type === 'llm.response.created'
  ).length;
  const artifactCount = events.filter((event) => event.event_type === 'artifact.created').length;

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[rgba(10,17,30,0.84)]">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{events.length} events</Badge>
        <Badge variant="outline">{llmResponseCount} LLM responses</Badge>
        <Badge variant="outline">{artifactCount} artifacts</Badge>
      </div>
      {finalOutput ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/12 dark:text-emerald-100">
          <div className="mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <h3 className="text-sm font-semibold">Final output</h3>
          </div>
          <MarkdownBlock>{finalOutput}</MarkdownBlock>
        </div>
      ) : finalOutputArtifact ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/12 dark:text-emerald-100">
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
            <p className="mt-2 wrap-break-word font-mono text-xs text-emerald-800 dark:text-emerald-200">
              {payloadText(finalOutputArtifact.payload ?? {}, ['uri', 'Uri'])}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          No final output has been reported for this run yet.
        </p>
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
            <TableCell className="max-w-80">
              <pre className="max-h-24 overflow-auto whitespace-pre-wrap text-xs text-neutral-600 dark:text-neutral-300">
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
        const primaryOutput = eventPrimaryOutput(event);
        const summary = primaryOutput ?? summarizeEventPayload(event);
        const summaryIsLong = summary.length > 220 || summary.includes('\n');
        const showRawEventType = STORY_EVENT_TYPES_WITH_FRIENDLY_LABEL.has(event.event_type);
        const detailsVisible = showEventDetails(event);

        return (
          <article key={event.id} className={`flex flex-col ${palette.align}`}>
            <div
              className={`w-full max-w-215 rounded-lg border px-4 py-3 shadow-sm ${palette.bubble}`}
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
                    {showRawEventType ? (
                      <span className="text-current/65">{event.event_type}</span>
                    ) : null}
                    <span className="text-current/65">#{event.sequence}</span>
                    <span className="text-current/65">{formatDate(event.timestamp)}</span>
                    {event.task_id ? (
                      <span className="text-current/65">Task: {event.task_id}</span>
                    ) : null}
                  </div>
                  <div className={`mt-2 wrap-break-word text-sm ${isSystem ? 'text-center' : ''}`}>
                    {summaryIsLong ? (
                      <MarkdownBlock compact>{summary}</MarkdownBlock>
                    ) : (
                      <p>{summary}</p>
                    )}
                  </div>
                </div>
              </div>
              {detailsVisible ? (
                <div className="mt-3">
                  <Accordion type="single" collapsible>
                    <AccordionItem
                      value={`details-${event.id}`}
                      className="rounded-md border border-black/10 bg-white/70 px-3 dark:border-white/10 dark:bg-white/8"
                    >
                      <AccordionTrigger className="py-3 text-xs font-semibold uppercase tracking-wide text-current/60 hover:no-underline">
                        Details
                      </AccordionTrigger>
                      <AccordionContent className="pt-1">
                        <div className="text-xs text-neutral-800 dark:text-neutral-100">
                          <EventPayloadDetails event={event} />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function RuntimeLogLines({ lines }: { lines?: RuntimeLogLine[] }) {
  if (!lines || lines.length === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">No structured logs reported.</p>
    );
  }

  return (
    <div className="space-y-2">
      {lines.map((line, index) => (
        <div
          key={`${line.sequence ?? index}-${line.event_type ?? 'event'}`}
          className={`rounded-md border px-3 py-2 text-sm ${logLevelClass(line.level)}`}
        >
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <span>{line.sequence != null ? `#${line.sequence}` : `#${index + 1}`}</span>
            {line.event_type ? <span>{line.event_type}</span> : null}
            {line.timestamp ? <span>{formatDate(line.timestamp)}</span> : null}
            {line.task_id ? <span>Task: {line.task_id}</span> : null}
          </div>
          <p className="mt-1 whitespace-pre-wrap wrap-break-word">{line.message || line.text}</p>
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
    <div className="rounded-lg border border-neutral-200 p-4 text-sm dark:border-white/10 dark:bg-[rgba(9,15,27,0.82)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-neutral-900 dark:text-neutral-100">
            {artifact.name || artifact.id}
          </p>
          {artifact.uri ? (
            <p className="mt-1 wrap-break-word font-mono text-xs text-neutral-500 dark:text-neutral-400">
              {artifact.uri}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{artifact.artifact_type || 'artifact'}</Badge>
          {artifact.media_type ? <Badge variant="secondary">{artifact.media_type}</Badge> : null}
          {artifact.size_bytes != null ? (
            <Badge variant="outline">{artifact.size_bytes} bytes</Badge>
          ) : null}
        </div>
      </div>

      {contentText ? (
        <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-white/10 dark:bg-white/4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Content
          </p>
          <div className="max-h-72 overflow-auto pr-1">
            <MarkdownBlock>{contentText}</MarkdownBlock>
          </div>
        </div>
      ) : hasJsonContent ? (
        <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-white/10 dark:bg-white/4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Content JSON
          </p>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-xs text-neutral-700 dark:text-neutral-300">
            {JSON.stringify(contentJson, null, 2)}
          </pre>
        </div>
      ) : (
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          No inline content is attached to this artifact. Use the URI as the artifact reference.
        </p>
      )}
    </div>
  );
}

function OutputContent({ value }: { value: string }) {
  const structuredValue = parseDisplayJsonText(value);

  return (
    <div className="max-h-80 min-w-0 max-w-full overflow-auto pr-1">
      {structuredValue ? (
        <PayloadValue value={structuredValue} />
      ) : (
        <MarkdownBlock>{value}</MarkdownBlock>
      )}
    </div>
  );
}

function OutputPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 max-w-full rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/4">
      <p className="mb-2 min-w-0 text-xs font-semibold uppercase tracking-wide text-neutral-500 [overflow-wrap:anywhere] dark:text-neutral-400">
        {title}
      </p>
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
  const [showNodeOutputDiagnostics, setShowNodeOutputDiagnostics] = useState(false);
  const primaryOutput = outputPayload
    ? (finalOutputFromPayload(outputPayload) ?? outputTextFromValue(outputPayload))
    : null;
  const outputNodeOutputs = outputPayloadNodeOutputs(outputPayload);
  const nodeOutputs =
    Object.keys(outputNodeOutputs).length > 0 ? outputNodeOutputs : (stateNodeOutputs ?? {});
  const nodeOutputEntries = Object.entries(nodeOutputs);
  const contentArtifacts = artifacts.filter(
    (artifact) => artifact.content_text || artifact.content_json
  );
  const visibleArtifacts = contentArtifacts.filter((artifact) => {
    const artifactText = cleanPayloadText(artifact.content_text);
    return !primaryOutput || artifactText !== primaryOutput;
  });
  const hasOutput =
    Boolean(primaryOutput) || nodeOutputEntries.length > 0 || visibleArtifacts.length > 0;

  return (
    <Card className="min-w-0 max-w-full overflow-hidden">
      <CardHeader>
        <CardTitle>Run Outputs</CardTitle>
        <CardDescription>
          Canonical result first, with intermediate node diagnostics available when needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4">
        {!hasOutput && isLoadingArtifacts ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Loading output artifacts...
          </p>
        ) : !hasOutput ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
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
            <div className="space-y-3">
              <p className="text-sm text-neutral-600 dark:text-neutral-300">
                {nodeOutputEntries.length} intermediate node output
                {nodeOutputEntries.length === 1 ? '' : 's'} hidden from the main result.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowNodeOutputDiagnostics((current) => !current)}
              >
                {showNodeOutputDiagnostics ? 'Hide diagnostics' : 'Show diagnostics'}
              </Button>
              {showNodeOutputDiagnostics ? (
                <div className="grid min-w-0 gap-3">
                  {nodeOutputEntries.map(([nodeId, value]) => (
                    <div
                      key={nodeId}
                      className="min-w-0 rounded-md border border-neutral-200 bg-white p-3 dark:border-white/10 dark:bg-[rgba(10,17,30,0.78)]"
                    >
                      <p className="mb-2 min-w-0 font-mono text-xs text-neutral-500 [overflow-wrap:anywhere] dark:text-neutral-400">
                        {nodeId}
                      </p>
                      <PayloadValue value={value} />
                    </div>
                  ))}
                </div>
              ) : null}
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
      <pre className="max-h-120 overflow-auto rounded-lg border border-neutral-200 bg-neutral-950 p-4 text-xs text-neutral-100 dark:border-white/10">
        {logs?.logs?.trim() || 'No runtime logs reported.'}
      </pre>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Workflow Logs
          </h3>
          <Badge variant="outline">{workflowLogs.length}</Badge>
        </div>
        <RuntimeLogLines lines={workflowLogs} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Agent Logs
          </h3>
          <Badge variant="outline">{agentLogs.length} agents</Badge>
        </div>
        {agentLogs.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            No agent-specific logs reported.
          </p>
        ) : (
          <div className="space-y-4">
            {agentLogs.map((group, index) => (
              <div key={group.agent_id || group.agent_name || index} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
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
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Container stdout/stderr
            </h3>
            <Badge variant="outline">
              {logs?.container_id || logs?.containerId || 'container'}
            </Badge>
          </div>
          <pre className="max-h-90 overflow-auto rounded-lg border border-neutral-200 bg-neutral-950 p-4 text-xs text-neutral-100 dark:border-white/10">
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
    governanceEventsQuery,
    nativeApprovalsQuery,
    usageQuery,
    contextUsageQuery,
    artifactsQuery,
    logsQuery,
    conversationContextQuery,
    workflowQuery,
    refreshAll,
    pauseMutation,
    resumeMutation,
    cancelMutation,
    approvalDecisionMutation,
    nativeApprovalDecisionMutation,
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
    workflowIdFromUrl || run.workflowId
      ? `/workflows/${workflowIdFromUrl || run.workflowId}?tab=${workflowTab}`
      : null;
  const linkedConversation = conversationContextQuery.data?.conversation ?? null;
  const linkedApprovals = useMemo(
    () => conversationContextQuery.data?.approvals ?? [],
    [conversationContextQuery.data?.approvals]
  );
  const linkedMessages =
    conversationContextQuery.data?.messages.filter((message) => message.execution_id === runId) ??
    [];
  const workflow = workflowQuery.data;
  const workflowMetadata = isRecord(workflow?.metadata) ? workflow.metadata : {};
  const workflowMonitoring = isRecord(workflowMetadata.main_agent_monitoring)
    ? workflowMetadata.main_agent_monitoring
    : {};
  const hitlDelegationEnabled = workflowMonitoring.delegate_hitl_to_main_agent === true;
  const executionEvents = useMemo(() => eventsQuery.data?.items ?? [], [eventsQuery.data?.items]);
  const workflowLabel =
    usableWorkflowName(workflow?.name, [workflow?.id, run.workflowId, workflowIdFromUrl]) ||
    workflowNameFromRun(run) ||
    workflowNameFromEvents(executionEvents) ||
    workflowNameFromMessages(linkedMessages) ||
    run.workflowId?.trim() ||
    workflowIdFromUrl?.trim() ||
    'Unknown workflow';
  const runHeaderDateTime = runDisplayDateTime(run);
  const runHeaderTitle = `${workflowLabel} - ${runHeaderDateTime} (${run.id})`;
  const governanceEvents = (governanceEventsQuery.data?.items ?? []).filter((event) =>
    RUN_GOVERNANCE_EVENT_TYPES.includes(event.event_type)
  );
  const tokenUsage = isRecord(usageQuery.data?.token_usage) ? usageQuery.data.token_usage : {};
  const totalTokenUsage = isRecord(tokenUsage.total) ? tokenUsage.total : {};
  const agentUsageEntries = usageBreakdownEntries(tokenUsage.by_agent);
  const taskUsageEntries = usageBreakdownEntries(tokenUsage.by_task);
  const modelUsageEntries = usageBreakdownEntries(tokenUsage.by_model);
  const modelFallbacks = modelFallbackEntries(tokenUsage, governanceEvents);
  const fallbackCount =
    numberValue(tokenUsage.fallback_count) ??
    numberValue(totalTokenUsage.fallback_count) ??
    modelFallbacks.length;
  const latestModelFallback = modelFallbacks[modelFallbacks.length - 1] ?? null;
  const budgetWarnings = usageQuery.data?.budget_warnings ?? [];
  const latestBudgetWarning = budgetWarnings[budgetWarnings.length - 1] ?? null;
  const latestContextHealth = isRecord(contextUsageQuery.data?.latest_context_health)
    ? contextUsageQuery.data.latest_context_health
    : {};
  const latestCompaction = isRecord(contextUsageQuery.data?.latest_compaction)
    ? contextUsageQuery.data.latest_compaction
    : {};
  const compactionRecords = contextUsageQuery.data?.compaction_records ?? [];
  const persistedNativeApprovals = useMemo(
    () => nativeApprovalsQuery.data?.items ?? [],
    [nativeApprovalsQuery.data?.items]
  );
  const nativeApprovals = useMemo(
    () => deriveNativeApprovalActivities(executionEvents, run.metadata, persistedNativeApprovals),
    [executionEvents, run.metadata, persistedNativeApprovals]
  );
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
    getWorkflow: async (workflowId) =>
      workflowQuery.data ??
      (await workflowQuery.refetch().then((result) => {
        if (!result.data) {
          throw new Error(`Workflow ${workflowId} could not be loaded.`);
        }
        return result.data;
      })),
    executeWorkflow: api.runs.executeWorkflow,
    redirectTo: (nextRunId) => `/runs/${nextRunId}?workflowId=${rerunWorkflowId}&tab=runs`,
    additionalInvalidationKeys: () => [queryKeys.backendActiveRunSessions()],
  });
  const { tasks: derivedTasks, agents: derivedAgents } = useRunPresence({
    run,
    workflow,
    state: runDetail?.state ?? EMPTY_RUN_STATE,
    events: executionEvents,
    approvals: linkedApprovals,
  });
  const timelineEventsPayloadSignature = useMemo(
    () => JSON.stringify(timelineQuery.data?.events ?? []),
    [timelineQuery.data?.events]
  );
  const timelineRunSignature = useMemo(
    () =>
      JSON.stringify({
        id: run.id,
        workflowId: run.workflowId ?? null,
        runtimeAdapterId: run.runtimeAdapterId ?? null,
        status: run.status,
        createdAt: run.createdAt ?? null,
        startedAt: run.startedAt ?? null,
        completedAt: run.completedAt ?? null,
        updatedAt: run.updatedAt ?? null,
        currentNodeId: run.currentNodeId ?? null,
        triggerType: run.triggerType ?? null,
        workerId: run.workerId ?? null,
        error: run.error ?? null,
        outputPayload: run.outputPayload ?? null,
        metadata: run.metadata ?? null,
      }),
    [
      run.completedAt,
      run.createdAt,
      run.currentNodeId,
      run.error,
      run.id,
      run.metadata,
      run.outputPayload,
      run.runtimeAdapterId,
      run.startedAt,
      run.status,
      run.triggerType,
      run.updatedAt,
      run.workerId,
      run.workflowId,
    ]
  );
  const timelineGraphWorkflow = useMemo<WorkflowDefinition>(() => {
    if (workflow) {
      return workflow;
    }

    const eventAgents = new Map<string, { id: string; name: string; role: string | null }>();
    const eventTasks = new Map<
      string,
      { id: string; name: string; description: string; agent_id: string | null }
    >();

    for (const event of timelineQuery.data?.events ?? []) {
      const agentId = eventStringValue(event, ['agent_id', 'agentId']);
      const taskId =
        eventStringValue(event, ['task_id', 'taskId']) ??
        eventStringValue(event, ['current_node_id', 'currentNodeId']);
      const agentName = eventStringValue(event, ['agent_name', 'agentName', 'actor']);
      const taskName = eventStringValue(event, ['task_name', 'taskName']);

      if (agentId && !eventAgents.has(agentId)) {
        eventAgents.set(agentId, {
          id: agentId,
          name: agentName ?? agentId,
          role: null,
        });
      }
      if (taskId && !eventTasks.has(taskId)) {
        eventTasks.set(taskId, {
          id: taskId,
          name: taskName ?? taskId,
          description: '',
          agent_id: agentId,
        });
      }
    }

    for (const agent of derivedAgents) {
      if (!eventAgents.has(agent.id)) {
        eventAgents.set(agent.id, {
          id: agent.id,
          name: agent.name,
          role: typeof agent.metadata.role === 'string' ? agent.metadata.role : null,
        });
      }
    }
    for (const task of derivedTasks) {
      if (!eventTasks.has(task.id)) {
        eventTasks.set(task.id, {
          id: task.id,
          name: task.name,
          description:
            typeof task.metadata.description === 'string' ? task.metadata.description : '',
          agent_id: typeof task.metadata.agentId === 'string' ? task.metadata.agentId : null,
        });
      }
    }

    return {
      id: run.workflowId ?? workflowIdFromUrl ?? run.id,
      name: workflowLabel,
      description: null,
      agent_definitions: Array.from(eventAgents.values()),
      task_definitions: Array.from(eventTasks.values()).map((task) => ({
        ...task,
        depends_on_task_ids: [],
        human_approval_required: false,
      })),
    };
  }, [
    derivedAgents,
    derivedTasks,
    run.id,
    run.workflowId,
    timelineQuery.data?.events,
    workflow,
    workflowIdFromUrl,
    workflowLabel,
  ]);
  const timelineGraphRuntimeEvents = useMemo(() => {
    return [
      ...workflowRunToGraphRuntimeEvents(run, timelineGraphWorkflow),
      ...workflowExecutionEventsToGraphRuntimeEvents(
        timelineQuery.data?.events,
        timelineGraphWorkflow
      ),
    ];
    // Use content signatures so equivalent query result objects do not churn React Flow props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineEventsPayloadSignature, timelineGraphWorkflow, timelineRunSignature]);

  const effectivePreferredRerunAdapterId = preferredRuntimeAdapterId || run.runtimeAdapterId || '';
  const selectedRerunAdapterStillAvailable = runnableRuntimeAdapters.some(
    (adapter) => adapter.id === selectedRerunAdapterId
  );
  const effectiveSelectedRerunAdapterId = selectedRerunAdapterStillAvailable
    ? selectedRerunAdapterId
    : effectivePreferredRerunAdapterId;

  const assistantPageContext = useMemo(() => {
    const pendingConversationApproval =
      linkedApprovals.find((approval) => approval.status === 'pending') ?? null;
    const pendingNativeApproval =
      nativeApprovals.find((approval) => approval.status === 'pending') ?? null;
    const workflowId = rerunWorkflowId || workflow?.id || run.workflowId || workflowIdFromUrl;
    const entities = [
      {
        type: 'run',
        id: run.id,
        name: runHeaderTitle,
      },
      workflowId
        ? {
            type: 'workflow',
            id: workflowId,
            name: workflowLabel,
          }
        : null,
      linkedConversation
        ? {
            type: 'conversation',
            id: linkedConversation.id,
            name: linkedConversation.title || 'Linked conversation',
          }
        : null,
      ...derivedAgents.slice(0, 6).map((agent) => ({
        type: 'agent',
        id: agent.id,
        name: agent.name,
      })),
      ...derivedTasks.slice(0, 6).map((task) => ({
        type: 'task',
        id: task.id,
        name: task.name,
      })),
    ].filter(Boolean) as Array<{ type: string; id: string; name?: string | null }>;

    return {
      surface: 'runs.detail' as const,
      title: runHeaderTitle,
      description: `Run detail, timeline, approvals, artifacts, and runtime controls for ${workflowLabel}.`,
      entities,
      selection: {
        runId: run.id,
        workflowId,
        conversationId: linkedConversation?.id ?? null,
        approvalRequestId:
          pendingConversationApproval?.id ?? pendingNativeApproval?.approvalRequestId ?? null,
        toolId: pendingNativeApproval?.toolId ?? null,
        mode: eventViewMode,
      },
      summary: {
        status: run.status,
        workflowName: workflowLabel,
        runtimeAdapterId: run.runtimeAdapterId ?? null,
        currentNodeId: run.currentNodeId ?? null,
        startedAt: run.startedAt ?? null,
        completedAt: run.completedAt ?? null,
        canPause: run.status === 'running',
        canResume: run.status === 'paused',
        canCancel: !TERMINAL_STATUSES.has(run.status),
        linkedMessageCount: linkedMessages.length,
        linkedApprovalCount: linkedApprovals.length,
        pendingConversationApprovalCount: linkedApprovals.filter(
          (approval) => approval.status === 'pending'
        ).length,
        pendingNativeApprovalCount: nativeApprovals.filter(
          (approval) => approval.status === 'pending'
        ).length,
        pendingToolId: pendingNativeApproval?.toolId ?? null,
        eventCount: executionEvents.length,
        artifactCount: artifactsQuery.data?.items?.length ?? 0,
        agentCount: derivedAgents.length,
        taskCount: derivedTasks.length,
      },
      allowedActions: [
        'run.inspect',
        ...(run.status === 'running' ? ['run.pause'] : []),
        ...(run.status === 'paused' ? ['run.resume'] : []),
        ...(!TERMINAL_STATUSES.has(run.status) ? ['run.cancel'] : []),
        ...(pendingNativeApproval ? ['run.approve_request', 'run.reject_request'] : []),
        ...(workflowId
          ? ['workflow.inspect', 'workflow.propose_update', 'workflow.apply_update', 'workflow.run']
          : []),
      ],
    };
  }, [
    artifactsQuery.data?.items?.length,
    derivedAgents,
    derivedTasks,
    eventViewMode,
    executionEvents.length,
    linkedApprovals,
    linkedConversation,
    linkedMessages.length,
    nativeApprovals,
    rerunWorkflowId,
    run.completedAt,
    run.currentNodeId,
    run.id,
    run.runtimeAdapterId,
    run.startedAt,
    run.status,
    run.workflowId,
    runHeaderTitle,
    workflow?.id,
    workflowIdFromUrl,
    workflowLabel,
  ]);
  useRegisterAssistantPageContext(assistantPageContext);

  if (runQuery.isLoading) {
    return (
      <RunsLoadingCard
        title="Run"
        description="Loading canonical execution detail from the backend."
      />
    );
  }

  if (runQuery.isError) {
    return (
      <RunsErrorAlert
        title="Failed to load run"
        message={runQuery.error.message}
        onRetry={() => runQuery.refetch()}
      />
    );
  }

  if (!runDetail) {
    return (
      <RunsEmptyCard
        title="Run not found"
        description="The backend returned no execution detail for this run."
      />
    );
  }

  const canPause = run.status === 'running';
  const canResume = run.status === 'paused';
  const canCancel = !TERMINAL_STATUSES.has(run.status);
  const statusTone = runStatusTone(run.status);
  const containerStatus = run.container?.status || 'Not attached';

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

  const handleApprovalDecision = async (
    approvalRequestId: string,
    action: 'approve' | 'reject'
  ) => {
    await toast.promise(approvalDecisionMutation.mutateAsync({ approvalRequestId, action }), {
      loading: `${action === 'approve' ? 'Approving' : 'Rejecting'} request...`,
      success: `Approval ${action === 'approve' ? 'granted' : 'rejected'}.`,
      error: (error) => (error instanceof Error ? error.message : `Failed to ${action} approval.`),
      position: 'top-right',
    });
  };

  const handleNativeApprovalDecision = async (toolId: string, action: 'approve' | 'reject') => {
    await toast.promise(nativeApprovalDecisionMutation.mutateAsync({ toolId, action }), {
      loading: `${action === 'approve' ? 'Approving' : 'Rejecting'} native approval...`,
      success: `Native approval ${action === 'approve' ? 'granted' : 'rejected'}.`,
      error: (error) =>
        error instanceof Error ? error.message : `Failed to ${action} native approval.`,
      position: 'top-right',
    });
  };

  const handleRerun = async () => {
    const rerunPromise = launchWorkflow(effectiveSelectedRerunAdapterId || null);
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
      <PageHeader
        eyebrow="Run"
        title={runHeaderTitle}
        description={`Workflow: ${workflowLabel}`}
        meta={
          <>
            <RunStatusBadge status={run.status} />
            {run.runtimeAdapterId ? (
              <Badge variant="secondary">{run.runtimeAdapterId}</Badge>
            ) : null}
            <Badge variant="outline">
              <Clock3 className="mr-1 h-3 w-3" />
              Started {formatDate(run.startedAt)}
            </Badge>
          </>
        }
        actions={
          <>
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
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-12">
        <SummaryCard
          title="Status"
          className={cn('border-l-4 lg:col-span-4', statusTone.card)}
          description={
            run.currentNodeId ? (
              <>
                Current node <span className="font-mono">{run.currentNodeId}</span>
              </>
            ) : (
              'No active node reported'
            )
          }
        >
          <div className="flex items-center justify-between gap-3">
            <RunStatusBadge status={run.status} className="px-3 py-1 text-sm" />
            <span className={cn('text-xs font-medium', statusTone.text)}>
              {TERMINAL_STATUSES.has(run.status) ? 'Terminal' : 'Active'}
            </span>
          </div>
        </SummaryCard>
        <SummaryCard
          title="Created"
          value={formatDate(run.createdAt)}
          description="Queued by the backend"
          className="lg:col-span-2"
        />
        <SummaryCard
          title="Started"
          value={formatDate(run.startedAt)}
          description="Runtime handoff"
          className="lg:col-span-2"
        />
        <SummaryCard
          title="Completed"
          value={formatDate(run.completedAt)}
          description="Final state timestamp"
          className="lg:col-span-2"
        />
        <SummaryCard
          title="Last Heartbeat"
          value={formatDate(run.lastHeartbeatAt)}
          description="Worker liveness"
          className="lg:col-span-2"
        />
        <SummaryCard title="Runtime Adapter" className="lg:col-span-3">
          <Badge variant="secondary">{run.runtimeAdapterId || 'Unknown'}</Badge>
        </SummaryCard>
        <SummaryCard title="Runtime Revision" className="lg:col-span-3">
          <div
            className="truncate font-mono text-xs text-neutral-700 dark:text-neutral-300"
            title={run.runtimeRevisionId || undefined}
          >
            {run.runtimeRevisionId || '—'}
          </div>
        </SummaryCard>
        <SummaryCard title="Container Status" className="lg:col-span-3">
          <Badge
            variant="outline"
            className={cn('capitalize', containerStatusTone(run.container?.status))}
          >
            {containerStatus}
          </Badge>
        </SummaryCard>
        <SummaryCard title="Worker" className="lg:col-span-3">
          <div
            className="truncate font-mono text-xs text-neutral-700 dark:text-neutral-300"
            title={run.workerId || undefined}
          >
            {run.workerId || '—'}
          </div>
        </SummaryCard>
      </div>

      <WorkflowRuntimeAdapterPanel
        title="Rerun Configuration"
        description="Native stays the default rerun path when this workflow allows it. Switch adapters here only when you want this rerun to target a different runtime."
        selectLabel="Runtime adapter for the next run"
        selectId="run-detail-rerun-adapter"
        adapters={runnableRuntimeAdapters}
        selectedAdapterId={effectiveSelectedRerunAdapterId}
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
              : `Run Again${effectiveSelectedRerunAdapterId ? ` With ${effectiveSelectedRerunAdapterId}` : ''}`}
          </>
        }
        onAdapterChange={setSelectedRerunAdapterId}
        onAction={() => {
          void handleRerun();
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Runtime Governance</CardTitle>
          <CardDescription>
            Token usage, context health, and compaction state for this run.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {usageQuery.isError || contextUsageQuery.isError ? (
            <RunsErrorAlert
              title="Failed to load runtime governance"
              message={
                usageQuery.error?.message ??
                contextUsageQuery.error?.message ??
                'Runtime governance could not be loaded.'
              }
              onRetry={() => {
                void usageQuery.refetch();
                void contextUsageQuery.refetch();
              }}
            />
          ) : null}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-white/10 dark:bg-white/4">
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                Total Tokens
              </p>
              <p className="mt-2 text-2xl font-semibold text-neutral-950 dark:text-neutral-50">
                {usageQuery.isLoading
                  ? 'Loading...'
                  : formatTokenCount(totalTokenUsage.total_tokens)}
              </p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Prompt {formatTokenCount(totalTokenUsage.prompt_tokens)} · Completion{' '}
                {formatTokenCount(totalTokenUsage.completion_tokens)}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-white/10 dark:bg-white/4">
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                Estimated Cost
              </p>
              <p className="mt-2 text-2xl font-semibold text-neutral-950 dark:text-neutral-50">
                {usageQuery.isLoading
                  ? 'Loading...'
                  : formatCost(totalTokenUsage.estimated_cost, totalTokenUsage.currency)}
              </p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Updated {formatDate(usageQuery.data?.updated_at)}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-white/10 dark:bg-white/4">
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                Context Health
              </p>
              <div className="mt-2">
                <Badge variant={contextBadgeVariant(latestContextHealth.status)}>
                  {typeof latestContextHealth.status === 'string'
                    ? latestContextHealth.status
                    : contextUsageQuery.isLoading
                      ? 'loading'
                      : 'unknown'}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                {formatTokenCount(latestContextHealth.estimated_total_context_tokens)} /{' '}
                {formatTokenCount(latestContextHealth.context_window)} tokens
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-white/10 dark:bg-white/4">
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                Compaction
              </p>
              <div className="mt-2">
                <Badge variant={latestCompaction.compacted ? 'default' : 'outline'}>
                  {latestCompaction.compacted ? 'Compacted' : 'Not compacted'}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                {compactionRecords.length} records · Saved{' '}
                {formatTokenCount(latestCompaction.estimated_tokens_saved)} tokens
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-white/10 dark:bg-white/4">
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                Model Fallbacks
              </p>
              <p className="mt-2 text-2xl font-semibold text-neutral-950 dark:text-neutral-50">
                {usageQuery.isLoading ? 'Loading...' : formatTokenCount(fallbackCount)}
              </p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {latestModelFallback
                  ? `${modelFallbackLabel(latestModelFallback.primaryProvider, latestModelFallback.primaryModel)} -> ${modelFallbackLabel(latestModelFallback.fallbackProvider, latestModelFallback.fallbackModel)}`
                  : 'No switches recorded'}
              </p>
            </div>
          </div>
          {latestBudgetWarning ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/12 dark:text-amber-100">
              Budget warning: {stringValue(latestBudgetWarning.scope) ?? 'run'} used{' '}
              {formatTokenCount(latestBudgetWarning.used_tokens)} /{' '}
              {formatTokenCount(latestBudgetWarning.budget_tokens)} tokens.
            </div>
          ) : null}
          <div className="grid gap-4 xl:grid-cols-3">
            <RuntimeUsageBreakdown
              title="Agent Usage"
              emptyLabel="No per-agent token usage recorded."
              entries={agentUsageEntries}
            />
            <RuntimeUsageBreakdown
              title="Task Usage"
              emptyLabel="No per-task token usage recorded."
              entries={taskUsageEntries}
            />
            <RuntimeUsageBreakdown
              title="Model Usage"
              emptyLabel="No per-model token usage recorded."
              entries={modelUsageEntries}
            />
          </div>
          <ModelFallbackBreakdown entries={modelFallbacks} />
          <div className="rounded-lg border border-neutral-200 dark:border-white/10 dark:bg-[rgba(9,15,27,0.82)]">
            <div className="border-b border-neutral-200 px-4 py-3 dark:border-white/10">
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                Budget Warning History
              </p>
            </div>
            {budgetWarnings.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scope</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Used</TableHead>
                    <TableHead className="text-right">Budget</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgetWarnings.map((warning, index) => (
                    <TableRow key={`${stringValue(warning.scope) ?? 'scope'}-${index}`}>
                      <TableCell>{stringValue(warning.scope) ?? 'run'}</TableCell>
                      <TableCell>{stringValue(warning.status) ?? 'warning'}</TableCell>
                      <TableCell className="text-right">
                        {formatTokenCount(warning.used_tokens)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatTokenCount(warning.budget_tokens)}
                      </TableCell>
                      <TableCell>{stringValue(warning.action) ?? 'warn_only'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400">
                No token budget warnings have been recorded.
              </p>
            )}
          </div>
          <div className="rounded-lg border border-neutral-200 dark:border-white/10 dark:bg-[rgba(9,15,27,0.82)]">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-white/10">
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  Governance Event Timeline
                </p>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Loaded from filtered execution events for token, context, compaction, and steering
                  signals.
                </p>
              </div>
              <Badge variant="outline">{governanceEvents.length} events</Badge>
            </div>
            {governanceEventsQuery.isError ? (
              <RunsErrorAlert
                title="Failed to load governance events"
                message={governanceEventsQuery.error.message}
                onRetry={() => governanceEventsQuery.refetch()}
              />
            ) : governanceEvents.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead className="text-right">Sequence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {governanceEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-neutral-900 dark:text-neutral-100">
                            {governanceEventLabel(event.event_type)}
                          </div>
                          <div className="text-xs text-neutral-500 dark:text-neutral-400">
                            {formatDate(event.timestamp)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{governanceEventSummary(event)}</TableCell>
                      <TableCell>{event.agent_id ?? '—'}</TableCell>
                      <TableCell>{event.task_id ?? '—'}</TableCell>
                      <TableCell className="text-right">{event.sequence}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400">
                No governance events have been recorded.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Runtime Session</CardTitle>
          <CardDescription>
            Container, worker, replacement, and node context for this execution.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
            <p>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">Container</span>:{' '}
              {run.container?.containerName || run.container?.containerId || 'Not attached'}
            </p>
            <p>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">Image</span>:{' '}
              {run.container?.image || '—'}
            </p>
            <p>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">Worker</span>:{' '}
              {run.workerId || '—'}
            </p>
            <p>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                Current Node
              </span>
              : {runDetail.state.current_node_id || '—'}
            </p>
          </div>
          <div className="space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
            <p>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                Restart Reason
              </span>
              : {runDetail.replacement?.restartReason || run.restartReason || '—'}
            </p>
            <p>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                Replaces Execution
              </span>
              : {runDetail.replacement?.replacesExecution?.id || '—'}
            </p>
            <p>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                Replacement Count
              </span>
              : {runDetail.replacement?.replacedByExecutions?.length ?? 0}
            </p>
            <p>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                Diagnostics Keys
              </span>
              : {Object.keys(runDetail.runtime?.diagnostics || {}).length}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Runtime Error</CardTitle>
          <CardDescription>Normalized from backend execution detail.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-neutral-600 dark:text-neutral-300">
          {formatRunError(run.error)}
        </CardContent>
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
        <CardContent className="space-y-3 text-sm text-neutral-600 dark:text-neutral-300">
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
                <Badge variant="outline">{nativeApprovals.length} native approvals</Badge>
                <Badge variant="outline">{linkedMessages.length} linked messages</Badge>
                <Badge variant={hitlDelegationEnabled ? 'default' : 'outline'}>
                  HITL delegation: {hitlDelegationEnabled ? 'Main agent' : 'Human'}
                </Badge>
              </div>
              <p>
                Conversation:{' '}
                <Link
                  href="/assistant"
                  className="font-medium text-neutral-900 underline-offset-4 hover:underline dark:text-neutral-100"
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
                <div className="rounded-lg border border-neutral-200 p-4 dark:border-white/10 dark:bg-white/4">
                  <p className="mb-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    Node Outputs
                  </p>
                  <pre className="overflow-auto whitespace-pre-wrap text-xs text-neutral-600 dark:text-neutral-300">
                    {JSON.stringify(runDetail.state.node_outputs || {}, null, 2)}
                  </pre>
                </div>
                <div className="rounded-lg border border-neutral-200 p-4 dark:border-white/10 dark:bg-white/4">
                  <p className="mb-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    Runtime Diagnostics
                  </p>
                  <pre className="overflow-auto whitespace-pre-wrap text-xs text-neutral-600 dark:text-neutral-300">
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
                Native tool approvals and conversation approval requests linked to this execution.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {nativeApprovals.length > 0 ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      Native runtime approvals
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Approval-gated tool checkpoints from this execution event trace.
                    </p>
                  </div>
                  {nativeApprovals.map((approval) => {
                    const decisionLabel = nativeApprovalDecisionLabel(
                      approval,
                      hitlDelegationEnabled
                    );
                    const humanHeld = nativeApprovalDenyLabels(approval).length > 0;
                    return (
                      <div
                        key={approval.id}
                        className="rounded-lg border border-neutral-200 p-4 dark:border-white/10 dark:bg-white/4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-neutral-900 dark:text-neutral-100">
                              {approval.toolName}
                            </p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                              {approval.toolId}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge
                              variant={
                                approval.status === 'approved'
                                  ? 'successful'
                                  : approval.status === 'rejected'
                                    ? 'failed'
                                    : 'secondary'
                              }
                            >
                              {approval.status}
                            </Badge>
                            <Badge
                              variant={
                                approval.decisionMode === 'delegated'
                                  ? 'default'
                                  : humanHeld
                                    ? 'secondary'
                                    : 'outline'
                              }
                            >
                              {decisionLabel}
                            </Badge>
                          </div>
                        </div>
                        <div className="mt-3 space-y-1 text-sm text-neutral-600 dark:text-neutral-300">
                          <p>
                            Agent: {approval.agentId || 'unknown'} · Task:{' '}
                            {approval.taskId || 'unknown'}
                          </p>
                          <p>
                            Requested: {formatDate(approval.requestedAt)}
                            {approval.decidedAt
                              ? ` · Decided: ${formatDate(approval.decidedAt)}`
                              : ''}
                          </p>
                          <p>
                            Risk labels:{' '}
                            {approval.riskLabels.length > 0
                              ? approval.riskLabels.join(', ')
                              : 'none'}
                          </p>
                          {approval.reason ? <p>Decision reason: {approval.reason}</p> : null}
                          {approval.respondedBy ? (
                            <p>Responded by: {approval.respondedBy}</p>
                          ) : null}
                          {approval.argumentsPayload ? (
                            <details className="mt-2 rounded-md bg-neutral-50 px-3 py-2 dark:bg-white/5">
                              <summary className="cursor-pointer text-xs font-medium text-neutral-700 dark:text-neutral-300">
                                Redacted arguments
                              </summary>
                              <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs text-neutral-600 dark:text-neutral-300">
                                {JSON.stringify(approval.argumentsPayload, null, 2)}
                              </pre>
                            </details>
                          ) : null}
                        </div>
                        {approval.status === 'pending' ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() =>
                                void handleNativeApprovalDecision(approval.toolId, 'approve')
                              }
                              disabled={nativeApprovalDecisionMutation.isPending}
                            >
                              Approve
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                void handleNativeApprovalDecision(approval.toolId, 'reject')
                              }
                              disabled={nativeApprovalDecisionMutation.isPending}
                            >
                              Reject
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {nativeApprovalsQuery.isLoading && nativeApprovals.length === 0 ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Loading native approvals...
                </p>
              ) : null}

              {conversationContextQuery.isLoading ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Loading approvals...
                </p>
              ) : linkedApprovals.length === 0 && nativeApprovals.length === 0 ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  No linked approvals were found for this execution.
                </p>
              ) : linkedApprovals.length > 0 ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      Conversation approvals
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Assistant conversation approvals associated with this run.
                    </p>
                  </div>
                  {linkedApprovals.map((approval) => (
                    <div
                      key={approval.id}
                      className="rounded-lg border border-neutral-200 p-4 dark:border-white/10 dark:bg-white/4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-neutral-900 dark:text-neutral-100">
                            {approval.summary}
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            {approval.id}
                          </p>
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
                      <div className="mt-3 space-y-1 text-sm text-neutral-600 dark:text-neutral-300">
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
                  ))}
                </div>
              ) : null}
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
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Loading workflow agent definitions...
                </p>
              ) : workflowQuery.isError ? (
                <RunsErrorAlert
                  title="Failed to load workflow"
                  message={workflowQuery.error.message}
                  onRetry={() => workflowQuery.refetch()}
                />
              ) : derivedAgents.length === 0 ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  No agent definitions were available for this run.
                </p>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {derivedAgents.map((agent) => (
                    <div
                      key={agent.id}
                      className="rounded-lg border border-neutral-200 p-4 dark:border-white/10 dark:bg-white/4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                            <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                              {agent.name}
                            </p>
                          </div>
                          <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                            {agent.id}
                          </p>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {agent.status}
                        </Badge>
                      </div>
                      <div className="mt-3 space-y-1 text-sm text-neutral-600 dark:text-neutral-300">
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
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Loading workflow task definitions...
                </p>
              ) : workflowQuery.isError ? (
                <RunsErrorAlert
                  title="Failed to load workflow"
                  message={workflowQuery.error.message}
                  onRetry={() => workflowQuery.refetch()}
                />
              ) : derivedTasks.length === 0 ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  No task definitions were available for this run.
                </p>
              ) : (
                <div className="space-y-3">
                  {derivedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-lg border border-neutral-200 p-4 dark:border-white/10 dark:bg-white/4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <ListChecks className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                            <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                              {task.name}
                            </p>
                          </div>
                          <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                            {task.id}
                          </p>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {task.status}
                        </Badge>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-neutral-600 dark:text-neutral-300 md:grid-cols-2">
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
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading logs...</p>
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
                <CardDescription>
                  Backend event log<span hidden> from `/executions/{'{id}'}/events`.</span>
                </CardDescription>
              </div>
              <div
                className="inline-flex h-9 rounded-md border border-neutral-200 bg-neutral-50 p-1 dark:border-white/10 dark:bg-white/4"
                aria-label="Run events view"
              >
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
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading events...</p>
              ) : eventsQuery.isError ? (
                <RunsErrorAlert
                  title="Failed to load run events"
                  message={eventsQuery.error.message}
                  onRetry={() => eventsQuery.refetch()}
                />
              ) : (eventsQuery.data?.items ?? []).length === 0 ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  No run events recorded yet.
                </p>
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
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Loading timeline...
                </p>
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
                  </div>
                  {workflowQuery.isError ? (
                    <RunsErrorAlert
                      title="Failed to load workflow"
                      message={workflowQuery.error.message}
                      onRetry={() => workflowQuery.refetch()}
                    />
                  ) : (
                    <div className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-white/10 dark:bg-[rgba(10,17,30,0.78)]">
                      {workflowQuery.isLoading && !workflow ? (
                        <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
                          Loading workflow definition. Showing runtime-derived graph details.
                        </p>
                      ) : null}
                      <WorkflowGraphCanvas
                        workflow={timelineGraphWorkflow}
                        readOnly
                        includeTools
                        includeMemories
                        runtimeEvents={timelineGraphRuntimeEvents}
                        hideRuntimeRunFilter
                        className="h-140 min-h-105"
                      />
                    </div>
                  )}
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
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Loading artifacts...
                </p>
              ) : artifactsQuery.isError ? (
                <RunsErrorAlert
                  title="Failed to load artifacts"
                  message={artifactsQuery.error.message}
                  onRetry={() => artifactsQuery.refetch()}
                />
              ) : (artifactsQuery.data?.items ?? []).length === 0 ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  No artifacts were reported for this run.
                </p>
              ) : (
                artifactsQuery.data?.items.map((artifact) => (
                  <ArtifactCard key={artifact.id} artifact={artifact} />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
