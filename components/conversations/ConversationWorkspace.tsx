'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, FileText, LoaderCircle, Paperclip, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Badge } from '@/components/library/shadcn/badge';
import { Button } from '@/components/library/shadcn/button';
import {
  agentsApi,
  conversationsApi,
  documentsApi,
  logsApi,
  runsApi,
  workflowsApi,
} from '@/lib/api/backend';
import { queryKeys } from '@/lib/react-query/queryKeys';
import type {
  ApprovalRequest,
  Conversation,
  ConversationMessage,
  ConversationStreamEvent,
  ExecutionEventRecord,
  WorkflowDefinition,
} from '@/lib/api/backend/types';
import WorkflowRunActionButton from '@/components/workflow-app/WorkflowRunActionButton';
import { toast } from 'sonner';
import { localUser } from '@/lib/identity/localUser';

const ACTIVE_CONVERSATION_STORAGE_KEY = 'agency.active_conversation_id';
const TERMINAL_RUN_STATUSES = new Set(['completed', 'failed', 'cancelled']);
const DOCUMENT_UPLOAD_ACCEPT = '.txt,.md,.markdown,.csv,.json,.log,.html,.htm,.pdf,.docx';
const REDACTED_VALUE = '[REDACTED]';
const SENSITIVE_KEY_FRAGMENTS = [
  'authorization',
  'apikey',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'clientsecret',
  'secret',
  'password',
  'passwd',
  'privatekey',
  'credential',
  'webhooksecret',
  'sessioncookie',
  'setcookie',
];
const SENSITIVE_TOKEN_PATTERN =
  /\b(Bearer\s+)[A-Za-z0-9._~+/=-]+|\b(sk-[A-Za-z0-9_-]{8,})\b|\b(xox[a-z]-[A-Za-z0-9-]{8,})\b|\b(gh[pousr]_[A-Za-z0-9_]{8,})\b|\b(glpat-[A-Za-z0-9_-]{8,})\b/g;

type PendingAsyncTurn = {
  conversationId: string;
  originMessageId: string;
};

function conversationDisplayTitle(conversation: Conversation) {
  const trimmed = conversation.title?.trim();
  if (trimmed) {
    return trimmed;
  }
  return `Conversation ${conversation.id.slice(0, 8)}`;
}

function formatConversationTimestamp(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sortMessages(messages: ConversationMessage[]) {
  return [...messages].sort((left, right) => {
    const leftTime = new Date(left.created_at).getTime();
    const rightTime = new Date(right.created_at).getTime();
    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    return left.id.localeCompare(right.id);
  });
}

function mergeMessage(current: ConversationMessage[], next: ConversationMessage) {
  const existing = current.find((item) => item.id === next.id);
  if (existing) {
    return current.map((item) => (item.id === next.id ? next : item));
  }
  return sortMessages([...current, next]);
}

function hasMessageAfterCursor(messages: ConversationMessage[], cursorMessageId: string) {
  let seenCursor = false;
  for (const message of sortMessages(messages)) {
    if (seenCursor) {
      return true;
    }
    if (message.id === cursorMessageId) {
      seenCursor = true;
    }
  }
  return false;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function mergeApproval(current: Record<string, ApprovalRequest>, next: ApprovalRequest) {
  return { ...current, [next.id]: next };
}

function approvalLabel(approval: ApprovalRequest | undefined) {
  if (!approval) {
    return null;
  }
  if (approval.status === 'approved') {
    return 'Approved';
  }
  if (approval.status === 'rejected') {
    return 'Rejected';
  }
  if (approval.status === 'cancelled') {
    return 'Cancelled';
  }
  return 'Pending approval';
}

function messageText(message: ConversationMessage) {
  if (typeof message.plain_text === 'string' && message.plain_text.trim()) {
    return message.plain_text;
  }
  if (message.content && typeof message.content.text === 'string') {
    return message.content.text;
  }
  return message.message_type;
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function messageTypeLabel(message: ConversationMessage, assistantLabel: string) {
  switch (message.message_type) {
    case 'approval_request':
      return 'Approval request';
    case 'approval_result':
      return 'Approval result';
    case 'execution_started':
      return 'Execution started';
    case 'execution_completed':
      return 'Execution completed';
    case 'workflow_proposal':
      return 'Workflow proposal';
    case 'workflow_update_proposal':
      return 'Workflow update';
    default:
      return message.role === 'user'
        ? 'You'
        : message.role === 'assistant'
          ? assistantLabel
          : 'System';
  }
}

function messageShellClasses(message: ConversationMessage) {
  if (message.role === 'user') {
    return 'agency-gradient ml-auto border border-primary-500 text-white shadow-sm shadow-primary/20';
  }
  if (message.role === 'assistant') {
    if (message.message_type === 'approval_request') {
      return 'border border-amber-200 bg-amber-50 text-amber-950 shadow-sm';
    }
    if (message.message_type === 'approval_result') {
      return 'border border-emerald-200 bg-emerald-50 text-emerald-950 shadow-sm';
    }
    return 'border border-primary-100 bg-white text-slate-900 shadow-sm shadow-primary/5';
  }
  if (message.message_type === 'execution_completed') {
    return 'mx-auto border border-emerald-200 bg-emerald-50 text-emerald-950';
  }
  if (message.message_type === 'execution_started') {
    return 'mx-auto border border-sky-200 bg-sky-50 text-sky-950';
  }
  return 'mx-auto border border-slate-200 bg-slate-100 text-slate-800';
}

function metadataToneClasses(message: ConversationMessage) {
  if (message.role === 'user') {
    return 'text-primary-50';
  }
  if (message.message_type === 'approval_request') {
    return 'text-amber-700';
  }
  if (message.message_type === 'approval_result') {
    return 'text-emerald-700';
  }
  if (message.message_type === 'execution_started') {
    return 'text-sky-700';
  }
  if (message.message_type === 'execution_completed') {
    return 'text-emerald-700';
  }
  return 'text-slate-500';
}

function transcriptWidthClasses(message: ConversationMessage) {
  return message.role === 'system' ? 'max-w-xl' : 'max-w-3xl';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalized === 'token' || normalized === 'auth') {
    return true;
  }
  if (normalized.endsWith('token') && normalized !== 'maxtoken' && normalized !== 'maxtokens') {
    return true;
  }
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

function redactSensitiveString(value: string) {
  return value.replace(SENSITIVE_TOKEN_PATTERN, (match, bearerPrefix) => {
    if (typeof bearerPrefix === 'string' && bearerPrefix.length > 0) {
      return `${bearerPrefix}${REDACTED_VALUE}`;
    }
    return REDACTED_VALUE;
  });
}

function sanitizeForDisplay(value: unknown, key = ''): unknown {
  if (key && isSensitiveKey(key)) {
    return REDACTED_VALUE;
  }
  if (typeof value === 'string') {
    return redactSensitiveString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForDisplay(item, key));
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeForDisplay(entryValue, entryKey),
      ])
    );
  }
  return value;
}

function formatValue(value: unknown) {
  if (value == null) {
    return '—';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function stableJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return formatValue(value);
  }
}

function primitivePreview(value: unknown) {
  if (value == null) {
    return '—';
  }
  if (typeof value === 'string') {
    return value.trim() || '""';
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.length} items]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value).length} keys}`;
  }
  return formatValue(value);
}

function valuesEqual(left: unknown, right: unknown) {
  return stableJson(left) === stableJson(right);
}

function buildObjectDiffRows(
  current: unknown,
  proposed: unknown,
  path = '',
  rows: Array<{ path: string; current: unknown; proposed: unknown }> = []
) {
  if (valuesEqual(current, proposed)) {
    return rows;
  }

  if (isRecord(current) && isRecord(proposed)) {
    const keys = Array.from(new Set([...Object.keys(current), ...Object.keys(proposed)])).sort();
    for (const key of keys) {
      buildObjectDiffRows(current[key], proposed[key], path ? `${path}.${key}` : key, rows);
    }
    return rows;
  }

  rows.push({ path: path || 'root', current, proposed });
  return rows;
}

function approvalBadgeVariant(
  approval: ApprovalRequest | undefined
): 'secondary' | 'outline' | 'successful' | 'failed' {
  if (!approval) {
    return 'outline';
  }
  if (approval.status === 'approved') {
    return 'successful';
  }
  if (approval.status === 'rejected' || approval.status === 'cancelled') {
    return 'failed';
  }
  return 'secondary';
}

function workflowSummaryFromMessage(message: ConversationMessage) {
  if (!message.content || typeof message.content !== 'object') {
    return null;
  }

  const workflow = message.content.workflow;
  if (!isRecord(workflow)) {
    return null;
  }

  return {
    id: typeof workflow.id === 'string' ? workflow.id : null,
    name: typeof workflow.name === 'string' ? workflow.name : 'Proposed workflow',
    version: typeof workflow.version === 'string' ? workflow.version : null,
    revision: typeof workflow.revision === 'number' ? workflow.revision : null,
    metadata: isRecord(workflow.metadata) ? workflow.metadata : undefined,
  };
}

function workflowFromApproval(approval: ApprovalRequest | undefined) {
  if (!approval || !isRecord(approval.proposed_payload)) {
    return null;
  }
  const workflow = approval.proposed_payload.workflow;
  return isRecord(workflow) ? workflow : null;
}

function isWorkflowVisibleToMainAgent(workflow: WorkflowDefinition) {
  return (
    workflow.metadata?.visible_to_agent === true ||
    workflow.metadata?.visible_to_main_agent === true
  );
}

function workflowInputKeys(workflow: WorkflowDefinition) {
  const metadataInputs = workflow.metadata?.inputs;
  if (Array.isArray(metadataInputs)) {
    return metadataInputs.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0
    );
  }

  const keys = new Set<string>();
  for (const task of workflow.task_definitions ?? []) {
    const inputSchema = (task as Record<string, unknown>).input_schema;
    if (isRecord(inputSchema) && isRecord(inputSchema.properties)) {
      for (const key of Object.keys(inputSchema.properties)) {
        keys.add(key);
      }
    }
  }
  return Array.from(keys).sort();
}

function workflowMetric(workflow: Record<string, unknown> | null, key: string) {
  const value = workflow?.[key];
  return Array.isArray(value) ? value.length : 0;
}

function workflowField(workflow: Record<string, unknown> | null, key: string) {
  const value = workflow?.[key];
  if (typeof value === 'string') {
    return value.trim() || '—';
  }
  if (value == null) {
    return '—';
  }
  return formatValue(value);
}

function compactPayloadValue(value: unknown) {
  if (value == null) {
    return null;
  }
  if (typeof value === 'string') {
    return value.trim() || null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `${value.length} item${value.length === 1 ? '' : 's'}`;
  }
  if (isRecord(value)) {
    const keys = Object.keys(value);
    return keys.length > 0 ? keys.slice(0, 4).join(', ') : null;
  }
  return formatValue(value);
}

function approvalPayloadHighlights(approval: ApprovalRequest) {
  const payload = isRecord(approval.proposed_payload) ? approval.proposed_payload : null;
  const workflow = isRecord(payload?.workflow) ? payload.workflow : null;
  const metadata = isRecord(approval.metadata) ? approval.metadata : null;
  const targetSummary = approvalTargetSummary(approval);
  const rows: Array<{ label: string; value: string }> = [];

  const addRow = (label: string, value: unknown) => {
    const formatted = compactPayloadValue(value);
    if (formatted) {
      rows.push({ label, value: formatted });
    }
  };

  addRow('Action', metadata?.action ?? approval.approval_type.replace(/_/g, ' '));
  addRow(
    'Target',
    approval.target_id ? `${approval.target_type}: ${approval.target_id}` : approval.target_type
  );
  addRow(
    'Workflow',
    workflow?.name ?? workflow?.id ?? targetSummary.workflowId ?? payload?.workflow_id
  );
  addRow('Runtime', targetSummary.runtimeAdapterId ?? payload?.default_runtime_adapter_id);
  addRow('Tool', targetSummary.toolName ?? payload?.tool_id);
  addRow('Inputs', payload?.input_payload ?? payload?.inputs);
  addRow('Arguments', targetSummary.redactedArguments ?? payload?.arguments);

  return rows;
}

function MainAgentVisibleWorkflowsPanel({
  workflows,
  isLoading,
  isError,
  mainAgentName,
  isPopup,
}: {
  workflows: WorkflowDefinition[];
  isLoading: boolean;
  isError: boolean;
  mainAgentName: string;
  isPopup: boolean;
}) {
  const visibleWorkflows = workflows.filter(isWorkflowVisibleToMainAgent);

  return (
    <section
      className={
        isPopup
          ? 'border-b border-slate-200 bg-slate-50 px-4 py-3'
          : 'border-y border-slate-200 bg-slate-50 px-6 py-4'
      }
    >
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Accessible workflows
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Workflows {mainAgentName} can inspect and run through assigned tools.
            </p>
          </div>
          <Badge variant="outline">{visibleWorkflows.length} visible</Badge>
        </div>

        {isLoading ? (
          <p className="mt-3 text-sm text-slate-500">Loading visible workflows...</p>
        ) : isError ? (
          <p className="mt-3 text-sm text-amber-700">
            Visible workflows could not be loaded right now.
          </p>
        ) : visibleWorkflows.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
            No workflows are currently marked visible to {mainAgentName}. Set
            `visible_to_main_agent` or `visible_to_agent` in workflow metadata to expose a workflow
            here.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {visibleWorkflows.slice(0, isPopup ? 2 : 4).map((workflow) => {
              const inputs = workflowInputKeys(workflow);
              const protectedExecution = workflow.metadata?.protected_execution === true;
              const mutable = workflow.metadata?.mutable_by_main_agent === true;
              return (
                <div
                  key={workflow.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{workflow.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{workflow.id}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {protectedExecution ? (
                        <Badge variant="secondary">Approval required</Badge>
                      ) : null}
                      {mutable ? <Badge variant="outline">Mutable</Badge> : null}
                    </div>
                  </div>
                  {workflow.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                      {workflow.description}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>{workflow.task_definitions?.length ?? 0} tasks</span>
                    <span>·</span>
                    <span>{workflow.agent_definitions?.length ?? 0} agents</span>
                    {inputs.length > 0 ? (
                      <>
                        <span>·</span>
                        <span>inputs: {inputs.slice(0, 3).join(', ')}</span>
                      </>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/workflows/${workflow.id}`}>Open workflow</Link>
                    </Button>
                    <WorkflowRunActionButton workflowId={workflow.id} label="Run workflow" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function PendingApprovalsPanel({
  approvals,
  mainAgentName,
  isPending,
  isPopup,
  onDecision,
}: {
  approvals: ApprovalRequest[];
  mainAgentName: string;
  isPending: boolean;
  isPopup: boolean;
  onDecision: (approvalRequestId: string, action: 'approve' | 'reject') => Promise<void> | void;
}) {
  const pendingApprovals = approvals
    .filter((approval) => approval.status === 'pending')
    .sort(
      (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    );

  if (pendingApprovals.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Pending approvals"
      className={
        isPopup
          ? 'border-b border-amber-200 bg-amber-50 px-4 py-3'
          : 'border-b border-amber-200 bg-amber-50 px-6 py-4'
      }
    >
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
              Pending approvals
            </p>
            <p className="mt-1 text-sm text-amber-900">
              {mainAgentName} is waiting for a human decision before applying these actions.
            </p>
          </div>
          <Badge variant="secondary">{pendingApprovals.length} pending</Badge>
        </div>

        <div className="mt-3 grid gap-3">
          {pendingApprovals.map((approval) => {
            const highlights = approvalPayloadHighlights(approval);
            return (
              <article
                key={approval.id}
                className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{approval.summary}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {approval.approval_type.replace(/_/g, ' ')} · {approval.target_type}
                      {approval.target_id ? ` · ${approval.target_id}` : ''}
                    </p>
                  </div>
                  <Badge variant={approvalBadgeVariant(approval)}>{approvalLabel(approval)}</Badge>
                </div>

                {approval.diff_summary ? (
                  <div className="mt-3">
                    <DataBlock title="Proposed Change Summary" value={approval.diff_summary} />
                  </div>
                ) : null}
                {highlights.length > 0 ? (
                  <dl className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-2">
                    {highlights.map((item) => (
                      <div key={`${approval.id}-${item.label}`}>
                        <dt className="font-semibold uppercase tracking-[0.12em] text-slate-500">
                          {item.label}
                        </dt>
                        <dd className="mt-1 break-words text-slate-800">{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}

                <ApprovalInspectionPanel approval={approval} />
                <ApprovalActions
                  approval={approval}
                  isPending={isPending}
                  onDecision={onDecision}
                />
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function WorkflowReviewDiff({
  currentWorkflow,
  proposedWorkflow,
  isUpdate,
}: {
  currentWorkflow: Record<string, unknown> | null;
  proposedWorkflow: Record<string, unknown> | null;
  isUpdate: boolean;
}) {
  if (!proposedWorkflow) {
    return null;
  }

  const rows = [
    ['Name', workflowField(currentWorkflow, 'name'), workflowField(proposedWorkflow, 'name')],
    [
      'Description',
      workflowField(currentWorkflow, 'description'),
      workflowField(proposedWorkflow, 'description'),
    ],
    [
      'Entrypoint',
      workflowField(currentWorkflow, 'entrypoint'),
      workflowField(proposedWorkflow, 'entrypoint'),
    ],
    [
      'Runtime',
      workflowField(currentWorkflow, 'default_runtime_adapter_id'),
      workflowField(proposedWorkflow, 'default_runtime_adapter_id'),
    ],
    [
      'Agents',
      workflowMetric(currentWorkflow, 'agent_definitions'),
      workflowMetric(proposedWorkflow, 'agent_definitions'),
    ],
    [
      'Tasks',
      workflowMetric(currentWorkflow, 'task_definitions'),
      workflowMetric(proposedWorkflow, 'task_definitions'),
    ],
    [
      'Tools',
      workflowMetric(currentWorkflow, 'tool_definitions'),
      workflowMetric(proposedWorkflow, 'tool_definitions'),
    ],
  ];

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {isUpdate ? 'Proposed change review' : 'Proposed workflow contents'}
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead className="text-slate-500">
            <tr>
              <th className="w-32 py-2 font-medium">Field</th>
              {isUpdate ? <th className="py-2 font-medium">Current</th> : null}
              <th className="py-2 font-medium">Proposed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {rows.map(([label, current, proposed]) => {
              const changed = String(current) !== String(proposed);
              return (
                <tr key={label}>
                  <td className="py-2 pr-3 font-medium text-slate-600">{label}</td>
                  {isUpdate ? (
                    <td className={`py-2 pr-3 ${changed ? 'text-slate-900' : 'text-slate-500'}`}>
                      {current}
                    </td>
                  ) : null}
                  <td
                    className={`py-2 pr-3 ${changed ? 'font-medium text-slate-900' : 'text-slate-500'}`}
                  >
                    {proposed}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WorkflowDetailedDiff({
  currentWorkflow,
  proposedWorkflow,
  isUpdate,
}: {
  currentWorkflow: Record<string, unknown> | null;
  proposedWorkflow: Record<string, unknown> | null;
  isUpdate: boolean;
}) {
  if (!proposedWorkflow) {
    return null;
  }

  const rows =
    isUpdate && currentWorkflow ? buildObjectDiffRows(currentWorkflow, proposedWorkflow) : [];

  return (
    <details className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
        Detailed Generated Diff
      </summary>
      {isUpdate ? (
        rows.length > 0 ? (
          <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-slate-100">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="w-56 px-3 py-2 font-medium">Path</th>
                  <th className="px-3 py-2 font-medium">Current</th>
                  <th className="px-3 py-2 font-medium">Proposed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {rows.map((row) => (
                  <tr key={row.path}>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-600">{row.path}</td>
                    <td className="px-3 py-2 align-top">
                      <pre className="max-w-sm whitespace-pre-wrap break-words">
                        {primitivePreview(row.current)}
                      </pre>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <pre className="max-w-sm whitespace-pre-wrap break-words font-medium text-slate-900">
                        {primitivePreview(row.proposed)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-500">No field-level changes were detected.</p>
        )
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          This is a new workflow proposal. Inspect the full proposed payload below before approval.
        </p>
      )}
    </details>
  );
}

function toolPayloadFromMessage(message: ConversationMessage) {
  if (!isRecord(message.content)) {
    return null;
  }

  const toolName = typeof message.content.tool_name === 'string' ? message.content.tool_name : null;
  const toolId = typeof message.content.tool_id === 'string' ? message.content.tool_id : null;
  const argumentsPayload = isRecord(message.content.arguments)
    ? sanitizeForDisplay(message.content.arguments)
    : null;
  const rawResultPayload = isRecord(message.content.result)
    ? message.content.result
    : (message.content.result ?? null);
  const resultPayload = sanitizeForDisplay(rawResultPayload);

  if (!toolName && !toolId) {
    return null;
  }

  return {
    toolName: toolName || toolId || 'Tool',
    toolId,
    argumentsPayload,
    resultPayload,
    rawResultPayload,
  };
}

function executionPayloadFromMessage(message: ConversationMessage) {
  if (!isRecord(message.content)) {
    return null;
  }

  return {
    executionId:
      typeof message.content.execution_id === 'string'
        ? message.content.execution_id
        : message.execution_id || null,
    workflowId:
      typeof message.content.workflow_id === 'string' ? message.content.workflow_id : null,
    workflowName:
      typeof message.content.workflow_name === 'string' ? message.content.workflow_name : null,
    status: typeof message.content.status === 'string' ? message.content.status : null,
    summary: typeof message.content.summary === 'string' ? message.content.summary : null,
    finalOutput: message.content.final_output,
  };
}

function timelineEventLabel(eventType: string) {
  return eventType.replace(/[._-]/g, ' ');
}

function timelineEventSummary(event: ExecutionEventRecord) {
  const payload = isRecord(event.payload) ? event.payload : null;
  const parts: string[] = [];

  const append = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) {
      parts.push(value.trim());
    }
  };

  append(payload?.summary);
  append(payload?.message);
  append(payload?.tool_name);
  append(payload?.task_id ?? event.task_id);
  append(payload?.agent_id ?? event.agent_id);

  return parts.length > 0 ? parts.slice(0, 3).join(' · ') : null;
}

function approvalTargetSummary(approval: ApprovalRequest) {
  const target = isRecord(approval.proposed_payload) ? approval.proposed_payload : null;
  const redactedArguments = isRecord(target?.redacted_arguments) ? target.redacted_arguments : null;
  return {
    toolName: typeof target?.tool_name === 'string' ? target.tool_name : null,
    workflowId: typeof target?.workflow_id === 'string' ? target.workflow_id : null,
    runtimeAdapterId:
      typeof target?.runtime_adapter_id === 'string' ? target.runtime_adapter_id : null,
    redactedArguments,
  };
}

function DataBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {title}
      </p>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-700">
        {formatValue(value)}
      </pre>
    </div>
  );
}

function DetailDataBlock({ title, value }: { title: string; value: unknown }) {
  if (value == null) {
    return null;
  }

  return (
    <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {title}
      </summary>
      <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700">
        {formatValue(value)}
      </pre>
    </details>
  );
}

function ApprovalInspectionPanel({ approval }: { approval: ApprovalRequest }) {
  const hasMetadata = approval.metadata && Object.keys(approval.metadata).length > 0;
  const hasPayload = approval.proposed_payload && Object.keys(approval.proposed_payload).length > 0;

  if (!hasPayload && !hasMetadata) {
    return null;
  }

  return (
    <div className="mt-3 space-y-3">
      <DetailDataBlock title="Full Proposed Payload" value={approval.proposed_payload} />
      <DetailDataBlock title="Approval Metadata" value={approval.metadata} />
    </div>
  );
}

function ExecutionTimelinePreview({
  executionId,
  status,
}: {
  executionId: string;
  status?: string | null;
}) {
  const isTerminal = status ? TERMINAL_RUN_STATUSES.has(status) : false;
  const timelineQuery = useQuery({
    queryKey: queryKeys.backendRunTimeline(executionId),
    queryFn: () => logsApi.getRunTimeline(executionId),
    enabled: Boolean(executionId),
    refetchInterval: isTerminal ? false : 3000,
  });

  if (timelineQuery.isLoading) {
    return (
      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
        Loading execution timeline...
      </div>
    );
  }

  if (timelineQuery.isError) {
    return (
      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        Execution timeline could not be loaded right now.
      </div>
    );
  }

  const events = timelineQuery.data?.events ?? [];
  const visibleEvents = events.slice(-6);

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Execution timeline
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{events.length} events</Badge>
          {timelineQuery.data?.execution_duration_ms != null ? (
            <Badge variant="outline">{timelineQuery.data.execution_duration_ms} ms</Badge>
          ) : null}
        </div>
      </div>

      {visibleEvents.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No execution events recorded yet.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {visibleEvents.map((event) => {
            const summary = timelineEventSummary(event);
            return (
              <li key={event.id} className="flex gap-3 text-xs">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-400" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">
                      {timelineEventLabel(event.event_type)}
                    </span>
                    <span className="text-slate-500">#{event.sequence}</span>
                    {event.timestamp ? (
                      <span className="text-slate-500">{formatTimestamp(event.timestamp)}</span>
                    ) : null}
                  </div>
                  {summary ? <p className="mt-1 break-words text-slate-600">{summary}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {events.length > visibleEvents.length ? (
        <p className="mt-3 text-xs text-slate-500">
          Showing latest {visibleEvents.length} events. Open the run for the full timeline.
        </p>
      ) : null}
    </div>
  );
}

function RunLifecycleActions({
  runId,
  workflowId,
  status,
}: {
  runId: string;
  workflowId?: string | null;
  status?: string | null;
}) {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const normalizedStatus = typeof status === 'string' ? status : 'unknown';
  const canPause = normalizedStatus === 'running';
  const canResume = normalizedStatus === 'paused';
  const canCancel = !TERMINAL_RUN_STATUSES.has(normalizedStatus);

  const refreshQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.backendRun(runId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.backendRunEvents(runId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.backendRunTimeline(runId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.backendAgentRuns() }),
      workflowId
        ? queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowRuns(workflowId) })
        : Promise.resolve(),
    ]);
  };

  const runAction = (action: 'pause' | 'resume' | 'cancel') => {
    startTransition(() => {
      void toast.promise(
        (async () => {
          if (action === 'pause') {
            await runsApi.pauseRun(runId);
          } else if (action === 'resume') {
            await runsApi.resumeRun(runId);
          } else {
            await runsApi.cancelRun(runId);
          }
          await refreshQueries();
        })(),
        {
          loading:
            action === 'pause'
              ? 'Pausing run...'
              : action === 'resume'
                ? 'Resuming run...'
                : 'Cancelling run...',
          success:
            action === 'pause'
              ? 'Run paused.'
              : action === 'resume'
                ? 'Run resumed.'
                : 'Run cancellation requested.',
          error: (error) =>
            error instanceof Error
              ? error.message
              : action === 'pause'
                ? 'Failed to pause run.'
                : action === 'resume'
                  ? 'Failed to resume run.'
                  : 'Failed to cancel run.',
          position: 'top-right',
        }
      );
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!canPause || isPending}
        onClick={() => runAction('pause')}
      >
        {isPending && canPause ? 'Pausing...' : 'Pause'}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!canResume || isPending}
        onClick={() => runAction('resume')}
      >
        {isPending && canResume ? 'Resuming...' : 'Resume'}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!canCancel || isPending}
        onClick={() => runAction('cancel')}
      >
        {isPending && canCancel ? 'Cancelling...' : 'Cancel'}
      </Button>
    </>
  );
}

function ApprovalActions({
  approval,
  isPending,
  onDecision,
}: {
  approval: ApprovalRequest;
  isPending: boolean;
  onDecision: (approvalRequestId: string, action: 'approve' | 'reject') => Promise<void> | void;
}) {
  if (approval.status === 'pending') {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          className="agency-gradient text-white hover:brightness-105"
          disabled={isPending}
          onClick={() => void onDecision(approval.id, 'approve')}
        >
          Approve
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => void onDecision(approval.id, 'reject')}
        >
          Reject
        </Button>
      </div>
    );
  }

  if (approval.decision_reason) {
    return <div className="mt-3 text-xs text-slate-500">{approval.decision_reason}</div>;
  }

  return null;
}

function WorkflowProposalCard({
  message,
  approval,
  isPending,
  onDecision,
}: {
  message: ConversationMessage;
  approval?: ApprovalRequest;
  isPending: boolean;
  onDecision: (approvalRequestId: string, action: 'approve' | 'reject') => Promise<void> | void;
}) {
  const workflow = workflowSummaryFromMessage(message);
  const isUpdate = message.message_type === 'workflow_update_proposal';
  const currentWorkflowQuery = useQuery({
    queryKey: workflow?.id
      ? queryKeys.backendWorkflow(workflow.id)
      : ['backendWorkflow', 'missing'],
    queryFn: () => workflowsApi.getWorkflow(workflow?.id || ''),
    enabled: isUpdate && Boolean(workflow?.id),
  });

  if (!workflow) {
    return null;
  }

  const proposedWorkflow = workflowFromApproval(approval);
  const currentWorkflow = currentWorkflowQuery.data
    ? (currentWorkflowQuery.data as unknown as Record<string, unknown>)
    : null;

  return (
    <div className="mr-auto ml-0 max-w-3xl rounded-2xl border border-primary-100 bg-primary-50/70 p-4 text-sm shadow-sm shadow-primary/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {isUpdate ? 'Workflow update proposal' : 'Workflow creation proposal'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Review the proposed workflow action before applying it.
          </p>
        </div>
        {approval ? (
          <Badge variant={approvalBadgeVariant(approval)}>{approvalLabel(approval)}</Badge>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 rounded-xl border border-primary-100 bg-white/90 p-4 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Workflow
          </p>
          <p className="mt-1 font-medium text-slate-900">{workflow.name}</p>
          {workflow.id ? <p className="mt-1 text-xs text-slate-500">{workflow.id}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {workflow.version ? <Badge variant="outline">Version {workflow.version}</Badge> : null}
          {workflow.revision !== null ? (
            <Badge variant="outline">Revision {workflow.revision}</Badge>
          ) : null}
          {approval?.approval_type ? (
            <Badge variant="outline">{approval.approval_type.replace(/_/g, ' ')}</Badge>
          ) : null}
        </div>
      </div>

      {approval?.diff_summary ? (
        <DataBlock title="Diff Summary" value={approval.diff_summary} />
      ) : null}
      {isUpdate && currentWorkflowQuery.isLoading ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
          Loading current workflow for review...
        </div>
      ) : null}
      {isUpdate && currentWorkflowQuery.isError ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
          Current workflow could not be loaded. Review the proposed payload before approving.
        </div>
      ) : null}
      <WorkflowReviewDiff
        currentWorkflow={isUpdate ? currentWorkflow : null}
        proposedWorkflow={proposedWorkflow}
        isUpdate={isUpdate}
      />
      <WorkflowDetailedDiff
        currentWorkflow={isUpdate ? currentWorkflow : null}
        proposedWorkflow={proposedWorkflow}
        isUpdate={isUpdate}
      />
      {approval ? <ApprovalInspectionPanel approval={approval} /> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {workflow.id ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/workflows/${workflow.id}`}>Open workflow</Link>
          </Button>
        ) : null}
        {workflow.id ? (
          <WorkflowRunActionButton workflowId={workflow.id} label="Run workflow" />
        ) : null}
      </div>

      {approval ? (
        <ApprovalActions approval={approval} isPending={isPending} onDecision={onDecision} />
      ) : null}
    </div>
  );
}

function GenericApprovalCard({
  approval,
  alignRight,
  isPending,
  onDecision,
}: {
  approval: ApprovalRequest;
  alignRight: boolean;
  isPending: boolean;
  onDecision: (approvalRequestId: string, action: 'approve' | 'reject') => Promise<void> | void;
}) {
  const workflowTarget =
    approval.target_type === 'workflow' && approval.target_id
      ? `/workflows/${approval.target_id}`
      : null;
  const runTarget =
    approval.target_type === 'execution' && approval.target_id
      ? `/runs/${approval.target_id}`
      : null;
  const targetSummary = approvalTargetSummary(approval);

  return (
    <div
      className={`${
        alignRight ? 'mr-0 ml-auto' : 'mr-auto ml-0'
      } max-w-3xl rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm shadow-sm`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-medium text-slate-900">{approval.summary}</div>
        <Badge variant={approvalBadgeVariant(approval)}>{approvalLabel(approval)}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
        <span>{approval.approval_type.replace(/_/g, ' ')}</span>
        <span>·</span>
        <span>{approval.target_type}</span>
        {approval.target_id ? (
          <>
            <span>·</span>
            <span>{approval.target_id}</span>
          </>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {workflowTarget ? (
          <Button asChild variant="outline" size="sm">
            <Link href={workflowTarget}>Open workflow</Link>
          </Button>
        ) : null}
        {runTarget ? (
          <Button asChild variant="outline" size="sm">
            <Link href={runTarget}>Open run</Link>
          </Button>
        ) : null}
        {approval.target_type === 'workflow' && approval.target_id ? (
          <WorkflowRunActionButton workflowId={approval.target_id} label="Run workflow" />
        ) : null}
      </div>
      {targetSummary.toolName ||
      targetSummary.runtimeAdapterId ||
      targetSummary.redactedArguments ? (
        <div className="mt-3 space-y-3">
          {targetSummary.toolName ? (
            <DataBlock title="Tool" value={targetSummary.toolName} />
          ) : null}
          {targetSummary.runtimeAdapterId ? (
            <DataBlock title="Runtime Adapter" value={targetSummary.runtimeAdapterId} />
          ) : null}
          {targetSummary.redactedArguments ? (
            <DataBlock title="Arguments" value={targetSummary.redactedArguments} />
          ) : null}
        </div>
      ) : null}
      <ApprovalInspectionPanel approval={approval} />
      <ApprovalActions approval={approval} isPending={isPending} onDecision={onDecision} />
    </div>
  );
}

function ExecutionStatusCard({ message }: { message: ConversationMessage }) {
  const execution = executionPayloadFromMessage(message);
  if (!execution?.executionId) {
    return null;
  }

  const isCompleted = message.message_type === 'execution_completed';

  return (
    <div className="mr-auto ml-0 max-w-3xl rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900">
            {isCompleted ? 'Execution completed' : 'Execution started'}
          </p>
          <p className="mt-1 text-xs text-slate-500">{execution.executionId}</p>
        </div>
        <Badge variant={isCompleted ? 'successful' : 'secondary'}>
          {execution.status ? execution.status : isCompleted ? 'Completed' : 'Running'}
        </Badge>
      </div>
      {execution.workflowName ||
      execution.workflowId ||
      execution.summary ||
      execution.finalOutput ? (
        <div className="mt-3 space-y-3">
          {execution.workflowName || execution.workflowId ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              Workflow:{' '}
              <span className="font-medium text-slate-900">
                {execution.workflowName || execution.workflowId}
              </span>
            </div>
          ) : null}
          {execution.summary ? <DataBlock title="Summary" value={execution.summary} /> : null}
          {execution.finalOutput ? (
            <DataBlock title="Final Output" value={execution.finalOutput} />
          ) : null}
        </div>
      ) : null}
      <ExecutionTimelinePreview executionId={execution.executionId} status={execution.status} />
      <div className="mt-3">
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/runs/${execution.executionId}`}>Open run</Link>
          </Button>
          {execution.workflowId ? (
            <WorkflowRunActionButton workflowId={execution.workflowId} label="Run again" />
          ) : null}
          <RunLifecycleActions
            runId={execution.executionId}
            workflowId={execution.workflowId}
            status={execution.status}
          />
        </div>
      </div>
    </div>
  );
}

function ToolCallCard({ message }: { message: ConversationMessage }) {
  const tool = toolPayloadFromMessage(message);
  if (!tool) {
    return null;
  }

  return (
    <div className="mr-auto ml-0 max-w-3xl rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900">Tool call</p>
          <p className="mt-1 text-xs text-slate-500">{tool.toolName}</p>
        </div>
        <Badge variant="secondary">Executing</Badge>
      </div>
      <div className="mt-3 space-y-3">
        {tool.toolId ? <DataBlock title="Tool Id" value={tool.toolId} /> : null}
        {tool.argumentsPayload ? (
          <DataBlock title="Arguments (Redacted)" value={tool.argumentsPayload} />
        ) : null}
      </div>
    </div>
  );
}

function ToolResultCard({ message }: { message: ConversationMessage }) {
  const tool = toolPayloadFromMessage(message);
  if (!tool) {
    return null;
  }

  const resultStatus =
    isRecord(tool.rawResultPayload) && typeof tool.rawResultPayload.status === 'string'
      ? tool.rawResultPayload.status
      : null;
  const linkedWorkflowId =
    isRecord(tool.rawResultPayload) && typeof tool.rawResultPayload.workflow_id === 'string'
      ? tool.rawResultPayload.workflow_id
      : null;
  const linkedRunId =
    isRecord(tool.rawResultPayload) && typeof tool.rawResultPayload.execution_id === 'string'
      ? tool.rawResultPayload.execution_id
      : null;
  const linkedRunStatus =
    isRecord(tool.rawResultPayload) && typeof tool.rawResultPayload.status === 'string'
      ? tool.rawResultPayload.status
      : null;

  return (
    <div className="mr-auto ml-0 max-w-3xl rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900">Tool result</p>
          <p className="mt-1 text-xs text-slate-500">{tool.toolName}</p>
        </div>
        <Badge variant={resultStatus === 'error' ? 'failed' : 'successful'}>
          {resultStatus || 'Completed'}
        </Badge>
      </div>
      <div className="mt-3 space-y-3">
        {tool.toolId ? <DataBlock title="Tool Id" value={tool.toolId} /> : null}
        {tool.resultPayload !== null ? (
          <DataBlock title="Result (Redacted)" value={tool.resultPayload} />
        ) : null}
      </div>
      {linkedWorkflowId || linkedRunId ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {linkedWorkflowId ? (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href={`/workflows/${linkedWorkflowId}`}>Open workflow</Link>
              </Button>
              <WorkflowRunActionButton workflowId={linkedWorkflowId} label="Run workflow" />
            </>
          ) : null}
          {linkedRunId ? (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href={`/runs/${linkedRunId}`}>Open run</Link>
              </Button>
              <RunLifecycleActions
                runId={linkedRunId}
                workflowId={linkedWorkflowId}
                status={linkedRunStatus}
              />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MainAgentChatEmptyState({
  mainAgentName,
  mainAgentLookupError,
  isPopup,
}: {
  mainAgentName: string;
  mainAgentLookupError: string | null;
  isPopup: boolean;
}) {
  const title = mainAgentLookupError ? 'Main agent setup required' : `Start with ${mainAgentName}`;

  return (
    <div className={`mx-auto w-full max-w-4xl ${isPopup ? '' : 'py-6'}`}>
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Assistant bootstrap
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This chat uses the persisted main agent from the backend database. If this is a fresh
              backend, create or detect an LLM model first, then run the one-time main-agent setup
              so chat is backed by an editable agent instead of hardcoded defaults.
            </p>
          </div>
          <Badge variant={mainAgentLookupError ? 'secondary' : 'outline'}>
            {mainAgentLookupError ? 'Setup needed' : 'Ready'}
          </Badge>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-medium text-slate-900">1. Add an LLM model</p>
            <p className="mt-2 text-sm text-slate-600">
              Use LLM Models to create provider and model presets for OpenAI, Claude, Gemini, Grok,
              Ollama, or other supported providers.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-medium text-slate-900">2. Run first-run setup</p>
            <p className="mt-2 text-sm text-slate-600">
              On the backend, run the interactive setup once or use non-interactive env bootstrap
              for headless deploys.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-medium text-slate-900">3. Manage the agent</p>
            <p className="mt-2 text-sm text-slate-600">
              After setup, the main agent is stored in the database and can be renamed,
              reconfigured, and assigned tools from Agents.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="font-medium text-slate-900">Backend setup command</p>
            <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100">
              make setup-main-agent
            </pre>
            <p className="mt-2 text-xs text-slate-500">
              For API-only deployments, configure `MAIN_AGENT_BOOTSTRAP_*` and run `python -m
              app.cli setup-main-agent --non-interactive`.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <Button asChild variant="outline" size="sm">
              <Link href="/behavior-profiles">Open LLM Models</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/agents">Open Agents</Link>
            </Button>
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Once setup exists, send a message here or through any trusted external channel mapped to
          the backend conversation API.
        </p>
      </div>
    </div>
  );
}

interface ConversationWorkspaceProps {
  mode?: 'page' | 'popup';
  onOpenFullPage?: () => void;
}

export default function ConversationWorkspace({
  mode = 'page',
  onOpenFullPage,
}: ConversationWorkspaceProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [approvals, setApprovals] = useState<Record<string, ApprovalRequest>>({});
  const [mainAgentName, setMainAgentName] = useState('Main Agent');
  const [mainAgentRole, setMainAgentRole] = useState<string | null>(null);
  const [mainAgentImplementationName, setMainAgentImplementationName] = useState<string | null>(
    null
  );
  const [mainAgentId, setMainAgentId] = useState<string | null>(null);
  const [mainAgentLookupError, setMainAgentLookupError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAsyncTurn, setPendingAsyncTurn] = useState<PendingAsyncTurn | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [desktopHistoryOpen, setDesktopHistoryOpen] = useState(true);
  const [isPending, startTransition] = useTransition();
  const streamRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestMessageIdRef = useRef<string | undefined>(undefined);
  const messagesRef = useRef<ConversationMessage[]>([]);
  const activeConversationIdRef = useRef<string | undefined>(undefined);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);

  const actorUserId = localUser.id;
  const isPopup = mode === 'popup';
  const approvalItems = Object.values(approvals);
  const pendingMainAgentTurn =
    pendingAsyncTurn &&
    conversation?.id === pendingAsyncTurn.conversationId &&
    !hasMessageAfterCursor(messages, pendingAsyncTurn.originMessageId)
      ? pendingAsyncTurn
      : null;
  const conversationsQuery = useQuery({
    queryKey: ['backendConversations'],
    queryFn: () => conversationsApi.listConversations(),
  });
  const visibleWorkflowsQuery = useQuery({
    queryKey: queryKeys.backendWorkflowList(),
    queryFn: () => workflowsApi.listWorkflows(),
  });
  const conversationItems = [...(conversationsQuery.data?.items ?? [])].sort(
    (left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const mainAgent = await conversationsApi.getMainAgent();
        if (cancelled) {
          return;
        }
        setMainAgentLookupError(null);
        setMainAgentId(mainAgent.agent_id);
        setMainAgentName(mainAgent.name?.trim() || 'Main Agent');
        setMainAgentRole(mainAgent.description?.trim() || null);
        setMainAgentImplementationName(null);
        try {
          const agent = await agentsApi.getAgentCatalogItem(mainAgent.agent_id);
          if (cancelled) {
            return;
          }
          setMainAgentImplementationName(agent.name?.trim() || null);
        } catch (agentError) {
          console.error('Failed to resolve active main agent details', agentError);
        }
      } catch (profileError) {
        console.error('Failed to resolve active main agent profile', profileError);
        if (!cancelled) {
          setMainAgentLookupError('Active main-agent details are temporarily unavailable.');
          setMainAgentRole(null);
          setMainAgentImplementationName(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingMainAgentTurn]);

  useEffect(() => {
    messagesRef.current = messages;
    latestMessageIdRef.current = messages[messages.length - 1]?.id;
  }, [messages]);

  useEffect(() => {
    activeConversationIdRef.current = conversation?.id;
  }, [conversation?.id]);

  useEffect(() => {
    if (
      pendingAsyncTurn &&
      conversation?.id === pendingAsyncTurn.conversationId &&
      hasMessageAfterCursor(messages, pendingAsyncTurn.originMessageId)
    ) {
      setPendingAsyncTurn(null);
    }
  }, [conversation?.id, messages, pendingAsyncTurn]);

  async function loadConversationThread(conversationId: string) {
    const [storedConversation, storedMessages, storedApprovals] = await Promise.all([
      conversationsApi.getConversation(conversationId),
      conversationsApi.listMessages(conversationId),
      conversationsApi.listApprovalRequests(conversationId),
    ]);

    setConversation(storedConversation);
    activeConversationIdRef.current = storedConversation.id;
    setPendingAsyncTurn(null);
    setMessages(sortMessages(storedMessages.items));
    setApprovals(
      storedApprovals.items.reduce<Record<string, ApprovalRequest>>((accumulator, approval) => {
        accumulator[approval.id] = approval;
        return accumulator;
      }, {})
    );
    setError(null);
  }

  async function backfillAsyncConversationMessages(conversationId: string, originMessageId: string) {
    const delaysMs = [30000, 60000, 120000, 180000];
    for (const delayMs of delaysMs) {
      await sleep(delayMs);
      if (activeConversationIdRef.current !== conversationId) {
        return;
      }
      if (hasMessageAfterCursor(messagesRef.current, originMessageId)) {
        return;
      }
      try {
        const storedMessages = await conversationsApi.listMessages(conversationId, {
          timeoutMs: 120000,
        });
        if (activeConversationIdRef.current !== conversationId) {
          return;
        }
        setMessages(sortMessages(storedMessages.items));
        if (hasMessageAfterCursor(storedMessages.items, originMessageId)) {
          return;
        }
      } catch (refreshError) {
        // The main-agent response may still be occupying the local dev backend. Keep retrying quietly.
      }
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const conversationId = window.localStorage.getItem(ACTIVE_CONVERSATION_STORAGE_KEY);
    if (!conversationId) {
      return;
    }

    void (async () => {
      try {
        await loadConversationThread(conversationId);
      } catch (loadError) {
        console.error('Failed to restore active conversation', loadError);
        window.localStorage.removeItem(ACTIVE_CONVERSATION_STORAGE_KEY);
      }
    })();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!conversation?.id) {
      window.localStorage.removeItem(ACTIVE_CONVERSATION_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(ACTIVE_CONVERSATION_STORAGE_KEY, conversation.id);
  }, [conversation?.id]);

  function applyStreamEvent(payload: ConversationStreamEvent) {
    if (payload.event_type === 'message.created') {
      setMessages((current) => mergeMessage(current, payload.message));
      return;
    }
    if (payload.event_type === 'approval.requested' || payload.event_type === 'approval.resolved') {
      setApprovals((current) => mergeApproval(current, payload.approval));
    }
  }

  useEffect(() => {
    if (!conversation?.id) {
      return undefined;
    }

    let cancelled = false;

    const clearReconnectTimeout = () => {
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    const refreshApprovals = async () => {
      try {
        const storedApprovals = await conversationsApi.listApprovalRequests(conversation.id);
        if (cancelled) {
          return;
        }
        setApprovals(
          storedApprovals.items.reduce<Record<string, ApprovalRequest>>((accumulator, approval) => {
            accumulator[approval.id] = approval;
            return accumulator;
          }, {})
        );
      } catch (refreshError) {
        if (!cancelled) {
          console.error('Failed to refresh conversation approvals after reconnect', refreshError);
        }
      }
    };

    const attachStreamListeners = (stream: EventSource) => {
      stream.onmessage = (event) => {
        try {
          const payload = conversationsApi.parseStreamEvent(event.data);
          applyStreamEvent(payload);
        } catch (streamError) {
          console.error('Failed to parse conversation stream event', streamError);
        }
      };

      stream.addEventListener('message.created', (event) => {
        try {
          const payload = conversationsApi.parseStreamEvent((event as MessageEvent<string>).data);
          applyStreamEvent(payload);
        } catch (streamError) {
          console.error('Failed to parse message.created event', streamError);
        }
      });

      stream.addEventListener('approval.requested', (event) => {
        try {
          const payload = conversationsApi.parseStreamEvent((event as MessageEvent<string>).data);
          applyStreamEvent(payload);
        } catch (streamError) {
          console.error('Failed to parse approval.requested event', streamError);
        }
      });

      stream.addEventListener('approval.resolved', (event) => {
        try {
          const payload = conversationsApi.parseStreamEvent((event as MessageEvent<string>).data);
          applyStreamEvent(payload);
        } catch (streamError) {
          console.error('Failed to parse approval.resolved event', streamError);
        }
      });
    };

    const connectStream = () => {
      if (cancelled) {
        return;
      }

      const stream = new EventSource(
        conversationsApi.getStreamUrl(conversation.id, latestMessageIdRef.current)
      );
      streamRef.current = stream;
      attachStreamListeners(stream);

      stream.onopen = () => {
        clearReconnectTimeout();
        void refreshApprovals();
      };

      stream.onerror = () => {
        if (cancelled) {
          return;
        }
        stream.close();
        if (streamRef.current === stream) {
          streamRef.current = null;
        }
        clearReconnectTimeout();
        reconnectTimeoutRef.current = setTimeout(() => {
          connectStream();
        }, 1000);
      };
    };

    connectStream();

    return () => {
      cancelled = true;
      clearReconnectTimeout();
      streamRef.current?.close();
      streamRef.current = null;
    };
  }, [conversation?.id]);

  async function ensureConversation() {
    if (conversation) {
      return conversation;
    }
    const created = await conversationsApi.createConversation({
      created_by_user_id: actorUserId,
      channel_type: 'web',
      channel_user_id: actorUserId,
      channel_display_name: localUser.name,
      metadata: {
        surface: 'assistant',
      },
    });
    setConversation(created);
    activeConversationIdRef.current = created.id;
    void conversationsQuery.refetch();
    return created;
  }

  function handleNewConversation() {
    setConversation(null);
    activeConversationIdRef.current = undefined;
    setPendingAsyncTurn(null);
    setMessages([]);
    setApprovals({});
    setError(null);
    setHistoryOpen(false);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ACTIVE_CONVERSATION_STORAGE_KEY);
    }
  }

  async function handleOpenConversation(conversationId: string) {
    setError(null);
    try {
      await loadConversationThread(conversationId);
      setHistoryOpen(false);
    } catch (loadError) {
      console.error('Failed to load conversation from history', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Failed to load conversation.');
    }
  }

  function clearSelectedDocument() {
    setSelectedDocument(null);
    if (documentInputRef.current) {
      documentInputRef.current.value = '';
    }
  }

  function handleDocumentSelected(event: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setSelectedDocument(null);
      return;
    }
    setSelectedDocument(file);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = input.trim();
    const documentToUpload = selectedDocument;
    if (!trimmed && !documentToUpload) {
      return;
    }

    setError(null);
    setInput('');
    clearSelectedDocument();

    startTransition(() => {
      void (async () => {
        try {
          const targetConversation = await ensureConversation();
          let messageTextToSend = trimmed;
          if (documentToUpload) {
            const ingestion = await documentsApi.ingestDocument({
              file: documentToUpload,
              scope: 'conversation',
              conversationId: targetConversation.id,
              agentId: mainAgentId ?? undefined,
              tags: ['chat-upload', 'assistant'],
            });
            const documentNote =
              `Uploaded document "${ingestion.filename}" into memory as ${ingestion.chunks_created} chunk` +
              `${ingestion.chunks_created === 1 ? '' : 's'} (${ingestion.document_id}).`;
            messageTextToSend = messageTextToSend
              ? `${messageTextToSend}\n\n${documentNote}`
              : documentNote;
          }
          const response = await conversationsApi.postMessage(targetConversation.id, {
            message: {
              role: 'user',
              message_type: 'user_text',
              plain_text: messageTextToSend,
              content: { text: messageTextToSend },
            },
            response_mode: 'async',
          });

          setMessages((current) => mergeMessage(current, response.message));
          if (response.assistant_message) {
            setMessages((current) => mergeMessage(current, response.assistant_message!));
          }
          if (response.execution_result_message) {
            setMessages((current) => mergeMessage(current, response.execution_result_message!));
          }
          if (response.approval_request) {
            setApprovals((current) => mergeApproval(current, response.approval_request!));
          }
          if (!response.assistant_message && response.stream_url) {
            setPendingAsyncTurn({
              conversationId: targetConversation.id,
              originMessageId: response.message.id,
            });
            void backfillAsyncConversationMessages(targetConversation.id, response.message.id);
          }
          const refreshed = await conversationsApi.getConversation(targetConversation.id);
          setConversation(refreshed);
          void conversationsQuery.refetch();
        } catch (submitError) {
          console.error('Failed to send conversation message', submitError);
          setError(submitError instanceof Error ? submitError.message : 'Failed to send message.');
          setInput(trimmed);
          setSelectedDocument(documentToUpload);
        }
      })();
    });
  }

  async function handleApprovalDecision(approvalRequestId: string, action: 'approve' | 'reject') {
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          const response =
            action === 'approve'
              ? await conversationsApi.approveApprovalRequest(approvalRequestId, {
                  user_id: actorUserId,
                })
              : await conversationsApi.rejectApprovalRequest(approvalRequestId, {
                  user_id: actorUserId,
                });

          if (response.message) {
            setMessages((current) => mergeMessage(current, response.message));
          }
          const assistantMessage = response.assistant_message;
          if (assistantMessage) {
            setMessages((current) => mergeMessage(current, assistantMessage));
          }
          const executionResultMessage = response.execution_result_message;
          if (executionResultMessage) {
            setMessages((current) => mergeMessage(current, executionResultMessage));
          }
          if (response.approval_request) {
            setApprovals((current) => mergeApproval(current, response.approval_request));
          }
        } catch (decisionError) {
          console.error(`Failed to ${action} approval`, decisionError);
          setError(
            decisionError instanceof Error ? decisionError.message : `Failed to ${action} approval.`
          );
        }
      })();
    });
  }

  const historyPanel = (
    <div
      className={`relative flex h-full min-h-0 flex-col border-slate-200 bg-slate-50 transition-opacity duration-300 ${
        desktopHistoryOpen ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <button
        type="button"
        className={`absolute top-1/2 right-0 z-10 hidden h-10 w-6 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-r-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-300 hover:text-slate-900 md:flex ${
          desktopHistoryOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setDesktopHistoryOpen(false)}
        aria-label="Minimize history sidebar"
        title="Minimize history sidebar"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Conversation history</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="New conversation"
            onClick={handleNewConversation}
          >
            New Chat
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {conversationsQuery.isLoading ? (
          <p className="px-2 text-sm text-slate-500">Loading history...</p>
        ) : conversationsQuery.isError ? (
          <p className="px-2 text-sm text-red-600">Conversation history could not be loaded.</p>
        ) : conversationItems.length === 0 ? (
          <p className="px-2 text-sm text-slate-500">No saved conversations yet.</p>
        ) : (
          <div className="space-y-2">
            {conversationItems.map((item) => {
              const isActive = item.id === conversation?.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-label={conversationDisplayTitle(item)}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                    isActive
                      ? 'border-primary-300 bg-white shadow-sm shadow-primary/10'
                      : 'border-primary-100 bg-white/70 hover:border-primary-200 hover:bg-white'
                  }`}
                  onClick={() => void handleOpenConversation(item.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-2 text-sm font-medium text-slate-900">
                      {conversationDisplayTitle(item)}
                    </p>
                    {isActive ? <Badge variant="outline">Open</Badge> : null}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {formatConversationTimestamp(item.updated_at)}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-400">{item.id}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const conversationShell = (
    <>
      <div
        className={
          isPopup
            ? 'border-b border-primary-100 bg-white px-6 py-4'
            : 'border-b border-primary-100 bg-white/90 px-6 py-4 shadow-sm shadow-primary/5'
        }
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="agency-gradient-text text-center text-2xl font-bold md:text-left">
              {mainAgentName} Chat
            </h1>
            <p className="mt-1 text-sm text-gray-500">Chat with {mainAgentName}.</p>
            {mainAgentRole ? <p className="mt-1 text-sm text-gray-500">{mainAgentRole}</p> : null}
            {mainAgentLookupError ? (
              <p className="mt-2 text-sm text-amber-700">{mainAgentLookupError}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <div className="text-left text-sm text-gray-500 lg:text-right">
              <div>
                {conversation ? conversationDisplayTitle(conversation) : 'Untitled conversation'}
              </div>
              <div>{conversation?.id || 'Conversation will be created on first message'}</div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {!isPopup ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="md:hidden"
                    onClick={() => setHistoryOpen((current) => !current)}
                  >
                    {historyOpen ? 'Hide history' : 'View history'}
                  </Button>
                </>
              ) : null}
              {isPopup ? (
                <Button type="button" variant="outline" size="sm" onClick={onOpenFullPage}>
                  Open full page
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        {!isPopup && historyOpen ? (
          <div className="mt-4 border-t border-primary-100 pt-4 md:hidden">{historyPanel}</div>
        ) : null}
      </div>

      {/*<MainAgentVisibleWorkflowsPanel*/}
      {/*  workflows={visibleWorkflowsQuery.data?.items ?? []}*/}
      {/*  isLoading={visibleWorkflowsQuery.isLoading}*/}
      {/*  isError={visibleWorkflowsQuery.isError}*/}
      {/*  mainAgentName={mainAgentName}*/}
      {/*  isPopup={isPopup}*/}
      {/*/>*/}

      <PendingApprovalsPanel
        approvals={approvalItems}
        mainAgentName={mainAgentName}
        isPending={isPending}
        isPopup={isPopup}
        onDecision={handleApprovalDecision}
      />

      <div
        className={
          isPopup
            ? 'min-h-0 flex-1 overflow-y-auto bg-white px-4 py-6'
            : 'flex-1 overflow-y-auto bg-[linear-gradient(180deg,#ffffff_0%,#f5fbff_100%)] px-4 py-6'
        }
      >
        {messages.length === 0 ? (
          <div
            className={`flex h-full flex-col p-2 ${isPopup ? 'justify-center' : 'items-center justify-center'}`}
          >
            {/*<MainAgentChatEmptyState*/}
            {/*  mainAgentName={mainAgentName}*/}
            {/*  mainAgentLookupError={mainAgentLookupError}*/}
            {/*  isPopup={isPopup}*/}
            {/*/>*/}
          </div>
        ) : (
          <div className="mx-auto max-w-4xl space-y-4">
            {messages.map((message, index) => {
              const approval = message.approval_request_id
                ? approvals[message.approval_request_id]
                : undefined;
              return (
                <div key={message.id} className="space-y-2">
                  <div
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={[
                        'w-full rounded-3xl px-4 py-3',
                        transcriptWidthClasses(message),
                        messageShellClasses(message),
                        index === messages.length - 1 ? 'ring-1 ring-slate-200/70' : '',
                      ].join(' ')}
                    >
                      <div
                        className={`mb-2 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] ${metadataToneClasses(message)}`}
                      >
                        <span>{messageTypeLabel(message, mainAgentName)}</span>
                        <span>{formatTimestamp(message.created_at)}</span>
                      </div>
                      <div className="prose prose-sm max-w-none break-words text-inherit prose-p:my-0 prose-headings:text-inherit prose-strong:text-inherit prose-code:text-inherit prose-pre:bg-transparent prose-pre:p-0">
                        <ReactMarkdown>{messageText(message)}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                  {message.message_type === 'workflow_proposal' ||
                  message.message_type === 'workflow_update_proposal' ? (
                    <WorkflowProposalCard
                      message={message}
                      approval={approval}
                      isPending={isPending}
                      onDecision={handleApprovalDecision}
                    />
                  ) : null}
                  {approval &&
                  message.message_type !== 'workflow_proposal' &&
                  message.message_type !== 'workflow_update_proposal' ? (
                    <GenericApprovalCard
                      approval={approval}
                      alignRight={message.role === 'user'}
                      isPending={isPending}
                      onDecision={handleApprovalDecision}
                    />
                  ) : null}
                  {message.message_type === 'execution_started' ||
                  message.message_type === 'execution_completed' ? (
                    <ExecutionStatusCard message={message} />
                  ) : null}
                  {message.message_type === 'tool_call' ? <ToolCallCard message={message} /> : null}
                  {message.message_type === 'tool_result' ? (
                    <ToolResultCard message={message} />
                  ) : null}
                </div>
              );
            })}
            {pendingMainAgentTurn ? (
              <div className="flex justify-start">
                <div className="w-full max-w-[min(82%,48rem)] rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900 shadow-sm">
                  <div className="flex items-start gap-3">
                    <LoaderCircle className="mt-0.5 h-4 w-4 animate-spin text-sky-600" />
                    <div>
                      <div className="font-medium">{mainAgentName} is working</div>
                      <div className="mt-1 text-xs leading-5 text-sky-700">
                        The request is still running. Long model or coding turns can take several
                        minutes; the response will appear here when it is ready.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className={
          isPopup
            ? 'border-t border-primary-100 bg-white p-4'
            : 'border-t border-primary-100 bg-white p-4 shadow-sm shadow-primary/5'
        }
      >
        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
        {selectedDocument ? (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <FileText className="h-4 w-4 text-slate-500" />
            <span className="font-medium text-slate-900">{selectedDocument.name}</span>
            <span className="text-slate-500">{formatFileSize(selectedDocument.size)}</span>
            <button
              type="button"
              className="ml-auto rounded-full p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
              onClick={clearSelectedDocument}
              aria-label="Remove selected document"
              title="Remove document"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        <div className="flex items-center gap-4">
          <input
            ref={documentInputRef}
            type="file"
            accept={DOCUMENT_UPLOAD_ACCEPT}
            className="hidden"
            onChange={handleDocumentSelected}
          />
          <Button
            type="button"
            variant="outline"
            className="h-10 w-10 rounded-full p-0"
            disabled={isPending}
            onClick={() => documentInputRef.current?.click()}
            aria-label="Attach document"
            title="Attach document"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <input
            className="flex-1 rounded-full border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            value={input}
            placeholder={`Message ${mainAgentName}`}
            aria-label={`Message ${mainAgentName}`}
            onChange={(event) => setInput(event.target.value)}
          />
          <Button
            type="submit"
            className="rounded-full px-4 py-2 text-white"
            disabled={isPending || (input.trim().length === 0 && !selectedDocument)}
          >
            {isPending ? (selectedDocument ? 'Uploading...' : 'Sending...') : 'Send'}
          </Button>
        </div>
      </form>
    </>
  );

  if (isPopup) {
    return <div className="flex h-full min-h-0 flex-col bg-white">{conversationShell}</div>;
  }

  return (
    <div className="flex h-auto bg-transparent md:h-[calc(100vh-76px)]">
      <aside
        className={`relative hidden shrink-0 overflow-visible border-r border-primary-100 bg-primary-50/60 transition-[width,border-color] duration-300 ease-out md:block ${
          desktopHistoryOpen ? 'w-80' : 'w-0 border-r-transparent'
        }`}
        aria-hidden={!desktopHistoryOpen}
      >
        <div
          className={`h-full transition-transform duration-300 ease-out ${
            desktopHistoryOpen ? 'translate-x-0' : '-translate-x-6'
          }`}
        >
          {historyPanel}
        </div>
      </aside>
      <button
        type="button"
        className={`hidden self-center rounded-r-full border border-primary-100 bg-white px-1.5 py-3 text-slate-500 shadow-sm shadow-primary/5 transition-all duration-300 hover:text-primary-900 md:block ${
          desktopHistoryOpen
            ? 'pointer-events-none -ml-6 opacity-0'
            : 'pointer-events-auto ml-0 opacity-100'
        }`}
        onClick={() => setDesktopHistoryOpen(true)}
        aria-label="Open history sidebar"
        title="Open history sidebar"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col">{conversationShell}</div>
    </div>
  );
}
