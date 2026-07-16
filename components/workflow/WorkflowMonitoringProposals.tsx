'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  GitPullRequest,
  Info,
  MessageSquareText,
  Route,
  ShieldAlert,
  Split,
  Trash2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/library/shadcn/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/library/shadcn/card';
import {
  WorkflowSummaryField,
  WorkflowStateValue,
} from '@/components/workflow/WorkflowSettingsPrimitives';
import type { ApprovalRequest } from '@/types/conversations';
import type {
  WorkflowMonitoringEventsResponse,
  WorkflowMonitoringProposalEvent,
} from '@/types/workflows';
import type { ExecutionEventRecord } from '@/types/runtime';

interface WorkflowMonitoringProposalsProps {
  editable?: boolean;
  frame?: 'card' | 'inline';
  events?: WorkflowMonitoringEventsResponse | null;
  isLoading: boolean;
  isMutating: boolean;
  onEnableImprovementProposals?: () => void;
  onSendToMainAgent?: (proposalEventId: string, operatorNote?: string) => void;
  onApprovalDecision: (
    approvalRequestId: string,
    action: 'approve' | 'reject' | 'request_changes' | 'split',
    steeringParameters?: Record<string, unknown>
  ) => void;
}

interface SteeringParameterField {
  name: string;
  label?: string;
  type?: 'select' | 'textarea' | 'number' | 'multiselect';
  placeholder?: string;
  options?: Array<{ value: string; label?: string }>;
  default?: unknown;
  required?: boolean;
  min?: number;
  max?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function pendingApproval(proposal: WorkflowMonitoringProposalEvent) {
  return (
    (proposal.approval_requests ?? []).find((approval) => approval.status === 'pending') ?? null
  );
}

function proposalSummary(proposal: WorkflowMonitoringProposalEvent) {
  const payload = proposal.payload ?? {};
  const proposedChange = payload.proposed_change;
  if (
    proposedChange &&
    typeof proposedChange === 'object' &&
    !Array.isArray(proposedChange) &&
    typeof proposedChange.summary === 'string'
  ) {
    return proposedChange.summary;
  }
  if (typeof payload.summary === 'string') {
    return payload.summary;
  }
  return 'Monitor improvement proposal';
}

function proposalRisk(proposal: WorkflowMonitoringProposalEvent) {
  const payload = proposal.payload ?? {};
  return typeof payload.risk === 'string' ? payload.risk : null;
}

function proposalEvidenceCount(proposal: WorkflowMonitoringProposalEvent) {
  const payload = proposal.payload ?? {};
  const finding = payload.finding;
  if (!finding || typeof finding !== 'object' || Array.isArray(finding)) {
    return 0;
  }
  const evidence = finding.evidence;
  return Array.isArray(evidence) ? evidence.length : 0;
}

function findingCategory(finding: ExecutionEventRecord) {
  const category = finding.payload?.category;
  return typeof category === 'string' ? category.replace(/_/g, ' ') : 'run finding';
}

function findingReason(finding: ExecutionEventRecord) {
  const reason = finding.payload?.reason;
  return typeof reason === 'string' && reason.trim() ? reason : 'Monitor finding recorded.';
}

function findingSeverity(finding: ExecutionEventRecord) {
  const severity = finding.payload?.severity;
  return typeof severity === 'string' ? severity : 'info';
}

function formatEventTimestamp(timestamp?: string) {
  if (!timestamp) {
    return null;
  }
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return timestamp;
  }
  return parsed.toLocaleString();
}

function statusToneClass(enabled: boolean, hasFindings: boolean) {
  if (!enabled && hasFindings) {
    return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-300/20 dark:bg-amber-500/10 dark:text-amber-100';
  }
  if (enabled) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-300/20 dark:bg-emerald-500/10 dark:text-emerald-100';
  }
  return 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-white/10 dark:bg-white/4 dark:text-slate-300';
}

function proposalHasApproval(proposal: WorkflowMonitoringProposalEvent) {
  return Boolean(proposal.approval_requests && proposal.approval_requests.length > 0);
}

function approvalBadgeVariant(approval: ApprovalRequest | null) {
  if (!approval || approval.status === 'pending') {
    return 'outline';
  }
  if (approval.status === 'approved') {
    return 'default';
  }
  return 'secondary';
}

function latestDispatch(proposal: WorkflowMonitoringProposalEvent) {
  const dispatches = proposal.dispatches ?? [];
  return dispatches.length > 0 ? dispatches[dispatches.length - 1] : null;
}

const dismissedProposalStoragePrefix = 'agency:workflow-monitoring:dismissed-proposals:v1:';
const proposalCardLimit = 6;

function dismissedProposalStorageKey(workflowId: string) {
  return `${dismissedProposalStoragePrefix}${workflowId}`;
}

function readDismissedProposalIds(workflowId?: string) {
  if (!workflowId || typeof window === 'undefined') {
    return new Set<string>();
  }
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(dismissedProposalStorageKey(workflowId)) ?? '[]'
    );
    return new Set(
      Array.isArray(stored)
        ? stored.filter((value): value is string => typeof value === 'string')
        : []
    );
  } catch {
    return new Set<string>();
  }
}

function AdvisoryProposalCard({
  editable,
  isMutating,
  proposal,
  onDismiss,
  onApprovalDecision,
  onSendToMainAgent,
}: {
  editable: boolean;
  isMutating: boolean;
  proposal: WorkflowMonitoringProposalEvent;
  onDismiss: (proposalId: string) => void;
  onApprovalDecision: (
    approvalRequestId: string,
    action: 'approve' | 'reject' | 'request_changes' | 'split',
    steeringParameters?: Record<string, unknown>
  ) => void;
  onSendToMainAgent?: (proposalEventId: string, operatorNote?: string) => void;
}) {
  const approval = pendingApproval(proposal) ?? proposal.approval_requests?.[0] ?? null;
  const pending = approval?.status === 'pending';
  const dispatch = latestDispatch(proposal);
  const [operatorNote, setOperatorNote] = useState('');

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950/72">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <GitPullRequest
              className="h-4 w-4 text-neutral-500 dark:text-slate-400"
              aria-hidden="true"
            />
            <p className="font-medium text-neutral-900 dark:text-slate-100">
              {proposalSummary(proposal)}
            </p>
          </div>
          <p className="text-xs text-neutral-500 dark:text-slate-400">
            Evidence: {proposalEvidenceCount(proposal)} item(s)
            {proposalRisk(proposal) ? ` · Risk: ${proposalRisk(proposal)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={approvalBadgeVariant(approval)}>
            {approval?.status ?? 'advisory only'}
          </Badge>
          <button
            type="button"
            onClick={() => onDismiss(proposal.id)}
            className="inline-flex size-8 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/8 dark:hover:text-slate-100"
            aria-label={`Dismiss ${proposalSummary(proposal)}`}
            title="Dismiss from this proposal list"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <details className="group mt-3 rounded-md border border-neutral-200 bg-neutral-50/65 dark:border-white/10 dark:bg-white/4">
        <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-neutral-700 outline-none hover:bg-white/70 focus-visible:ring-2 focus-visible:ring-ring dark:text-slate-200 dark:hover:bg-white/6 [&::-webkit-details-marker]:hidden">
          View proposal details
        </summary>
        <div className="border-t border-neutral-200 px-3 pb-3 pt-3 dark:border-white/10">
          {approval?.diff_summary ? (
            <p className="mt-3 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-700 dark:bg-white/4 dark:text-slate-300">
              {approval.diff_summary}
            </p>
          ) : null}

          {!approval ? (
            <div className="mt-3 space-y-3 rounded-md bg-neutral-50 px-3 py-2 dark:bg-white/4">
              {dispatch ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
                  <p className="font-medium">Sent to main agent</p>
                  <p className="mt-1 text-xs text-emerald-800">
                    {formatEventTimestamp(dispatch.created_at) ?? dispatch.created_at}
                    {dispatch.conversation_id ? ` · ${dispatch.conversation_id}` : ''}
                  </p>
                  {typeof dispatch.operator_note === 'string' && dispatch.operator_note.trim() ? (
                    <p className="mt-2 text-sm text-emerald-900">{dispatch.operator_note}</p>
                  ) : null}
                </div>
              ) : null}
              <p className="text-sm text-neutral-700 dark:text-slate-300">
                This proposal is recorded as monitor guidance. Add any operator edits or context
                before handing it to the main agent for review and implementation.
              </p>
              {editable && onSendToMainAgent ? (
                <label className="block space-y-1 text-sm text-neutral-700 dark:text-slate-300">
                  <span className="font-medium">Operator note</span>
                  <textarea
                    value={operatorNote}
                    placeholder="Add constraints, revisions, or extra context for the main agent."
                    disabled={isMutating}
                    onChange={(event) => setOperatorNote(event.target.value)}
                    className="min-h-24 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950/72 dark:text-slate-100 dark:focus:border-white/20"
                  />
                </label>
              ) : null}
              {editable && onSendToMainAgent ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() => onSendToMainAgent(proposal.id, operatorNote.trim() || undefined)}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-slate-950/72 dark:text-slate-200 dark:hover:bg-white/8"
                  >
                    <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                    {dispatch ? 'Send updated brief' : 'Send to main agent'}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {editable && pending && approval ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isMutating}
                onClick={() => onApprovalDecision(approval.id, 'approve')}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-neutral-900 px-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                Approve
              </button>
              <button
                type="button"
                disabled={isMutating}
                onClick={() => onApprovalDecision(approval.id, 'reject')}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-neutral-200 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/6"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Reject
              </button>
              <button
                type="button"
                disabled={isMutating}
                onClick={() => onApprovalDecision(approval.id, 'request_changes')}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-neutral-200 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/6"
              >
                <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                Request changes
              </button>
              <button
                type="button"
                disabled={isMutating}
                onClick={() => onApprovalDecision(approval.id, 'split')}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-neutral-200 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/6"
              >
                <Split className="h-4 w-4" aria-hidden="true" />
                Split
              </button>
            </div>
          ) : null}
        </div>
      </details>
    </div>
  );
}

function supervisorSteeringApprovals(events?: WorkflowMonitoringEventsResponse | null) {
  return (events?.approval_controls ?? []).filter(
    (approval) => isRecord(approval.metadata) && approval.metadata.action === 'supervisor_steering'
  );
}

function steeringAction(approval: ApprovalRequest) {
  const payload = isRecord(approval.proposed_payload) ? approval.proposed_payload : {};
  const metadata = isRecord(approval.metadata) ? approval.metadata : {};
  const action = payload.recommended_action ?? metadata.recommended_action;
  return typeof action === 'string' ? action : 'review';
}

function steeringParameterFields(approval: ApprovalRequest): SteeringParameterField[] {
  const payload = isRecord(approval.proposed_payload) ? approval.proposed_payload : {};
  const metadata = isRecord(approval.metadata) ? approval.metadata : {};
  const schema = isRecord(payload.operator_parameter_schema)
    ? payload.operator_parameter_schema
    : isRecord(metadata.operator_parameter_schema)
      ? metadata.operator_parameter_schema
      : null;
  const rawFields = Array.isArray(schema?.fields) ? schema.fields : [];
  return rawFields.flatMap((rawField): SteeringParameterField[] => {
    if (!isRecord(rawField)) {
      return [];
    }
    const options = Array.isArray(rawField.options)
      ? rawField.options.flatMap((rawOption): Array<{ value: string; label?: string }> => {
          if (!isRecord(rawOption)) {
            return [];
          }
          return [
            {
              value: String(rawOption.value ?? ''),
              label: typeof rawOption.label === 'string' ? rawOption.label : undefined,
            },
          ];
        })
      : undefined;
    const fieldType =
      rawField.type === 'select' ||
      rawField.type === 'textarea' ||
      rawField.type === 'number' ||
      rawField.type === 'multiselect'
        ? rawField.type
        : undefined;
    const field: SteeringParameterField = {
      name: String(rawField.name ?? ''),
      label: typeof rawField.label === 'string' ? rawField.label : undefined,
      type: fieldType,
      placeholder: typeof rawField.placeholder === 'string' ? rawField.placeholder : undefined,
      options,
      default: rawField.default,
      required: rawField.required === true,
      min: typeof rawField.min === 'number' ? rawField.min : undefined,
      max: typeof rawField.max === 'number' ? rawField.max : undefined,
    };
    return field.name ? [field] : [];
  });
}

function cleanSteeringParameters(parameters: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(parameters).filter(([, value]) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return value !== undefined && value !== null && value !== '';
    })
  );
}

function steeringParameterValidationError(
  fields: SteeringParameterField[],
  parameters: Record<string, unknown>
) {
  for (const field of fields) {
    const value = parameters[field.name];
    const empty =
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0);
    const label = field.label ?? field.name;
    if (field.required && empty) {
      return `${label} is required.`;
    }
    if (empty) {
      continue;
    }
    if (field.type === 'select' && field.options?.length) {
      const selected = String(value);
      if (!field.options.some((option) => option.value === selected)) {
        return `${label} is not a valid option.`;
      }
    }
    if (field.type === 'multiselect' && field.options?.length) {
      const selected = Array.isArray(value) ? value.map((item) => String(item)) : [];
      const optionValues = new Set(field.options.map((option) => option.value));
      if (selected.some((item) => !optionValues.has(item))) {
        return `${label} contains an invalid option.`;
      }
    }
    if (field.type === 'number') {
      const numberValue = Number(value);
      if (!Number.isInteger(numberValue)) {
        return `${label} must be a whole number.`;
      }
      if (field.min !== undefined && numberValue < field.min) {
        return `${label} must be at least ${field.min}.`;
      }
      if (field.max !== undefined && numberValue > field.max) {
        return `${label} must be at most ${field.max}.`;
      }
    }
  }
  return null;
}

function formattedSteeringParameterValue(field: SteeringParameterField, value: unknown) {
  if (value === undefined || value === null || value === '') {
    return 'Detected/default';
  }
  if (field.type === 'multiselect') {
    const values = Array.isArray(value) ? value.map((item) => String(item)) : [];
    if (values.length === 0) {
      return 'None selected';
    }
    return values
      .map((item) => field.options?.find((option) => option.value === item)?.label ?? item)
      .join(', ');
  }
  const stringValue = String(value);
  return field.options?.find((option) => option.value === stringValue)?.label ?? stringValue;
}

function steeringPreviewRows(
  approval: ApprovalRequest,
  fields: SteeringParameterField[],
  parameters: Record<string, unknown>
) {
  const payload = isRecord(approval.proposed_payload) ? approval.proposed_payload : {};
  const action = steeringAction(approval);
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Action', value: action },
    {
      label: 'Expected effect',
      value:
        action === 'request_replan'
          ? 'Record replan guidance for the execution or revise a mutable workflow after approval.'
          : action === 'redirect_subagent'
            ? 'Redirect the selected sub-agent or task with operator instructions.'
            : action === 'replace_task_instructions'
              ? 'Replace or augment task instructions with operator guidance.'
              : action === 'lower_max_iterations'
                ? 'Lower the selected agent iteration limit.'
                : action === 'reduce_tool_scope'
                  ? 'Remove selected tools from the selected task or sub-agent scope.'
                  : action === 'request_human_review'
                    ? 'Record a human-review checkpoint without mutating the workflow.'
                    : 'Record supervisor steering guidance.',
    },
  ];

  for (const field of fields) {
    rows.push({
      label: field.label ?? field.name,
      value: formattedSteeringParameterValue(field, parameters[field.name] ?? field.default),
    });
  }

  const severity = typeof payload.severity === 'string' ? payload.severity : null;
  const confidence = typeof payload.confidence === 'string' ? payload.confidence : null;
  if (severity || confidence) {
    rows.push({
      label: 'Signal',
      value: [
        severity ? `severity ${severity}` : null,
        confidence ? `confidence ${confidence}` : null,
      ]
        .filter(Boolean)
        .join(', '),
    });
  }

  return rows;
}

function SteeringApprovalCard({
  approval,
  editable,
  isMutating,
  onApprovalDecision,
}: {
  approval: ApprovalRequest;
  editable: boolean;
  isMutating: boolean;
  onApprovalDecision: (
    approvalRequestId: string,
    action: 'approve' | 'reject' | 'request_changes' | 'split',
    steeringParameters?: Record<string, unknown>
  ) => void;
}) {
  const fields = steeringParameterFields(approval);
  const [parameters, setParameters] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(
      fields
        .filter((field) => field.default !== undefined && field.default !== null)
        .map((field) => [field.name, field.default])
    )
  );
  const action = steeringAction(approval);
  const pending = approval.status === 'pending';
  const validationError = steeringParameterValidationError(fields, parameters);
  const previewRows = steeringPreviewRows(approval, fields, parameters);

  const setParameter = (name: string, value: unknown) => {
    setParameters((current) => ({ ...current, [name]: value }));
  };

  const toggleMultiValue = (name: string, value: string, checked: boolean) => {
    setParameters((current) => {
      const existing = Array.isArray(current[name]) ? (current[name] as string[]) : [];
      return {
        ...current,
        [name]: checked ? [...existing, value] : existing.filter((item) => item !== value),
      };
    });
  };

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950/72">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Route className="h-4 w-4 text-neutral-500 dark:text-slate-400" aria-hidden="true" />
            <p className="font-medium text-neutral-900 dark:text-slate-100">{approval.summary}</p>
          </div>
          <p className="text-xs text-neutral-500 dark:text-slate-400">Action: {action}</p>
        </div>
        <Badge variant={approvalBadgeVariant(approval)}>{approval.status}</Badge>
      </div>

      {approval.diff_summary ? (
        <p className="mt-3 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-700 dark:bg-white/4 dark:text-slate-300">
          {approval.diff_summary}
        </p>
      ) : null}

      <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-white/10 dark:bg-white/4">
        <p className="text-xs font-medium uppercase text-neutral-500 dark:text-slate-400">
          Approval preview
        </p>
        <dl className="mt-2 grid gap-2 text-sm md:grid-cols-2">
          {previewRows.map((row) => (
            <div key={row.label} className="min-w-0">
              <dt className="text-xs text-neutral-500 dark:text-slate-400">{row.label}</dt>
              <dd className="wrap-break-word text-neutral-800 dark:text-slate-200">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {editable && pending && fields.length > 0 ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {fields.map((field) => {
            if (field.type === 'textarea') {
              return (
                <label
                  key={field.name}
                  className="space-y-1 text-sm text-neutral-700 dark:text-slate-300 md:col-span-2"
                >
                  <span className="font-medium">{field.label ?? field.name}</span>
                  <textarea
                    value={String(parameters[field.name] ?? '')}
                    placeholder={field.placeholder}
                    disabled={isMutating}
                    onChange={(event) => setParameter(field.name, event.target.value)}
                    className="min-h-20 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950/72 dark:text-slate-100 dark:focus:border-white/20"
                  />
                </label>
              );
            }
            if (field.type === 'number') {
              return (
                <label
                  key={field.name}
                  className="space-y-1 text-sm text-neutral-700 dark:text-slate-300"
                >
                  <span className="font-medium">{field.label ?? field.name}</span>
                  <input
                    type="number"
                    min={field.min}
                    max={field.max}
                    value={String(parameters[field.name] ?? '')}
                    placeholder={field.placeholder}
                    disabled={isMutating}
                    onChange={(event) =>
                      setParameter(
                        field.name,
                        event.target.value === '' ? '' : Number(event.target.value)
                      )
                    }
                    className="h-9 w-full rounded-md border border-neutral-200 px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950/72 dark:text-slate-100 dark:focus:border-white/20"
                  />
                </label>
              );
            }
            if (field.type === 'multiselect') {
              const selected = Array.isArray(parameters[field.name])
                ? (parameters[field.name] as string[])
                : [];
              return (
                <fieldset
                  key={field.name}
                  className="space-y-2 text-sm text-neutral-700 dark:text-slate-300 md:col-span-2"
                >
                  <legend className="font-medium">{field.label ?? field.name}</legend>
                  <div className="flex flex-wrap gap-2">
                    {(field.options ?? []).map((option) => (
                      <label
                        key={option.value}
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-neutral-200 px-2 py-1 text-xs has-disabled:cursor-not-allowed dark:border-white/10 dark:bg-slate-950/72"
                      >
                        <input
                          type="checkbox"
                          checked={selected.includes(option.value)}
                          disabled={isMutating}
                          className="cursor-pointer disabled:cursor-not-allowed"
                          onChange={(event) =>
                            toggleMultiValue(field.name, option.value, event.target.checked)
                          }
                        />
                        {option.label ?? option.value}
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            }
            return (
              <label
                key={field.name}
                className="space-y-1 text-sm text-neutral-700 dark:text-slate-300"
              >
                <span className="font-medium">{field.label ?? field.name}</span>
                <select
                  value={String(parameters[field.name] ?? '')}
                  disabled={isMutating}
                  onChange={(event) => setParameter(field.name, event.target.value)}
                  className="h-9 w-full rounded-md border border-neutral-200 px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950/72 dark:text-slate-100 dark:focus:border-white/20"
                >
                  <option value="">Detected/default</option>
                  {(field.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label ?? option.value}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      ) : null}

      {editable && pending && validationError ? (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {validationError}
        </p>
      ) : null}

      {editable && pending ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isMutating || Boolean(validationError)}
            onClick={() =>
              onApprovalDecision(approval.id, 'approve', cleanSteeringParameters(parameters))
            }
            className="inline-flex h-9 items-center gap-2 rounded-md bg-neutral-900 px-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            Approve
          </button>
          <button
            type="button"
            disabled={isMutating}
            onClick={() => onApprovalDecision(approval.id, 'reject')}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-neutral-200 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Reject
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function WorkflowMonitoringProposals({
  editable = true,
  frame = 'card',
  events,
  isLoading,
  isMutating,
  onEnableImprovementProposals,
  onSendToMainAgent,
  onApprovalDecision,
}: WorkflowMonitoringProposalsProps) {
  const findings = events?.findings ?? [];
  const proposals = events?.proposals ?? [];
  const workflowId = events?.workflow_id;
  const [proposalUiState, setProposalUiState] = useState(() => ({
    workflowId,
    dismissedProposalIds: readDismissedProposalIds(workflowId),
    showAllProposals: false,
  }));
  const activeProposalUiState =
    proposalUiState.workflowId === workflowId
      ? proposalUiState
      : {
          workflowId,
          dismissedProposalIds: readDismissedProposalIds(workflowId),
          showAllProposals: false,
        };
  const { dismissedProposalIds, showAllProposals } = activeProposalUiState;

  const visibleProposals = proposals.filter((proposal) => !dismissedProposalIds.has(proposal.id));
  const proposalCards = showAllProposals
    ? visibleProposals
    : visibleProposals.slice(0, proposalCardLimit);
  const hiddenProposalCount = proposals.length - visibleProposals.length;

  const dismissProposal = (proposalId: string) => {
    const nextDismissedIds = new Set(dismissedProposalIds).add(proposalId);
    setProposalUiState({
      ...activeProposalUiState,
      dismissedProposalIds: nextDismissedIds,
    });
    if (workflowId && typeof window !== 'undefined') {
      // Dismissal reduces operator noise without deleting the backend audit event.
      window.localStorage.setItem(
        dismissedProposalStorageKey(workflowId),
        JSON.stringify([...nextDismissedIds])
      );
    }
  };

  const restoreDismissedProposals = () => {
    setProposalUiState({
      ...activeProposalUiState,
      dismissedProposalIds: new Set(),
    });
    if (workflowId && typeof window !== 'undefined') {
      window.localStorage.removeItem(dismissedProposalStorageKey(workflowId));
    }
  };
  const steeringApprovals = supervisorSteeringApprovals(events);
  const proposalsEnabled = events?.monitoring?.controls?.allow_improvement_proposals === true;
  const actionableProposalCount = proposals.filter((proposal) =>
    proposalHasApproval(proposal)
  ).length;
  const proposalsDisabled =
    Boolean(events?.monitoring) && !proposalsEnabled && proposals.length === 0;

  const header = (
    <div className="space-y-1.5">
      <CardTitle className="text-base">Monitor review</CardTitle>
      <CardDescription>
        Findings, workflow-improvement proposals, and approval actions from monitoring.
      </CardDescription>
    </div>
  );

  const content = (
    <div className="space-y-3">
      {isLoading ? (
        <p className="text-sm text-neutral-500 dark:text-slate-400">Loading monitor proposals...</p>
      ) : null}
      {!isLoading ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <WorkflowSummaryField label="Findings">
              <div className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">
                {findings.length}
              </div>
              <p className="mt-1 text-xs text-neutral-500 dark:text-slate-400">
                Recorded monitor evidence
              </p>
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Proposals">
              <div className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">
                {visibleProposals.length}
              </div>
              <p className="mt-1 text-xs text-neutral-500 dark:text-slate-400">
                {hiddenProposalCount > 0
                  ? `${hiddenProposalCount} dismissed`
                  : actionableProposalCount
                    ? `${actionableProposalCount} actionable`
                    : 'Advisory until approval routing exists'}
              </p>
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Steering approvals">
              <div className="text-2xl font-semibold text-neutral-900 dark:text-slate-100">
                {steeringApprovals.length}
              </div>
              <p className="mt-1 text-xs text-neutral-500 dark:text-slate-400">
                Operational interventions queued
              </p>
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Proposal mode">
              <WorkflowStateValue>
                {proposalsEnabled ? 'Improvement proposals enabled' : 'Findings only'}
              </WorkflowStateValue>
              <p className="mt-1 text-xs text-neutral-500 dark:text-slate-400">
                {proposalsEnabled
                  ? 'Findings can escalate into approval-backed changes.'
                  : 'Findings are recorded without drafting workflow edits.'}
              </p>
            </WorkflowSummaryField>
          </div>

          {proposalsDisabled ? (
            <div
              className={`rounded-md border px-3 py-3 ${statusToneClass(
                proposalsEnabled,
                findings.length > 0
              )}`}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    Workflow-improvement proposals are disabled.
                  </p>
                  <p className="text-sm opacity-90">
                    This workflow can collect findings, but it will not draft improvements until
                    proposals are enabled.
                  </p>
                  {onEnableImprovementProposals ? (
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={onEnableImprovementProposals}
                      className="mt-2 inline-flex h-9 items-center rounded-md border border-current/25 bg-white/70 px-3 text-sm font-medium hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-950/50 dark:hover:bg-slate-950/70"
                    >
                      Enable proposals
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {proposals.length > 0 && actionableProposalCount === 0 ? (
            <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-3 text-sky-950 dark:border-sky-300/18 dark:bg-sky-500/10 dark:text-sky-100">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    Improvement proposals are advisory-only right now.
                  </p>
                  <p className="text-sm opacity-90">
                    The backend drafted these proposals, but no approval request was attached, so
                    there is nothing to approve from this panel yet.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {!proposalsDisabled &&
          findings.length === 0 &&
          proposals.length === 0 &&
          steeringApprovals.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-slate-400">
              No monitor findings or proposals for this workflow yet.
            </p>
          ) : null}

          <section className="space-y-3">
            <div className="flex items-center gap-2 border-b border-neutral-200/80 pb-2 dark:border-white/10">
              <ShieldAlert
                className="h-4 w-4 text-neutral-500 dark:text-slate-400"
                aria-hidden="true"
              />
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-slate-100">
                Recent findings
              </h3>
            </div>
            {findings.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-slate-400">
                No monitor findings recorded yet.
              </p>
            ) : (
              <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                {findings.map((finding) => (
                  <div
                    key={finding.id}
                    className="rounded-md border border-neutral-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950/72"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{findingCategory(finding)}</Badge>
                          <Badge variant="secondary">{findingSeverity(finding)}</Badge>
                        </div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-slate-100">
                          {findingReason(finding)}
                        </p>
                      </div>
                      {formatEventTimestamp(finding.timestamp) ? (
                        <p className="text-xs text-neutral-500 dark:text-slate-400">
                          {formatEventTimestamp(finding.timestamp)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 border-b border-neutral-200/80 pb-2 dark:border-white/10">
              <GitPullRequest
                className="h-4 w-4 text-neutral-500 dark:text-slate-400"
                aria-hidden="true"
              />
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-slate-100">
                Improvement proposals
              </h3>
            </div>
            {visibleProposals.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-slate-400">
                {proposals.length > 0
                  ? 'All current proposals are dismissed from this list.'
                  : proposalsEnabled
                    ? 'No monitor improvement proposals have been drafted yet.'
                    : 'Proposal generation is disabled for this workflow.'}
              </p>
            ) : (
              <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                {proposalCards.map((proposal) => (
                  <AdvisoryProposalCard
                    key={proposal.id}
                    editable={editable}
                    isMutating={isMutating}
                    proposal={proposal}
                    onDismiss={dismissProposal}
                    onApprovalDecision={onApprovalDecision}
                    onSendToMainAgent={onSendToMainAgent}
                  />
                ))}
                {visibleProposals.length > proposalCardLimit ? (
                  <button
                    type="button"
                    onClick={() =>
                      setProposalUiState({
                        ...activeProposalUiState,
                        showAllProposals: !activeProposalUiState.showAllProposals,
                      })
                    }
                    className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:border-white/10 dark:bg-slate-950/72 dark:text-slate-200 dark:hover:bg-white/8"
                  >
                    {showAllProposals
                      ? 'Show fewer proposals'
                      : `Show ${visibleProposals.length - proposalCardLimit} more proposal${
                          visibleProposals.length - proposalCardLimit === 1 ? '' : 's'
                        }`}
                  </button>
                ) : null}
              </div>
            )}
            {hiddenProposalCount > 0 ? (
              <button
                type="button"
                onClick={restoreDismissedProposals}
                className="text-sm font-medium text-neutral-600 underline-offset-4 hover:underline dark:text-slate-300"
              >
                Restore {hiddenProposalCount} dismissed proposal
                {hiddenProposalCount === 1 ? '' : 's'}
              </button>
            ) : null}
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 border-b border-neutral-200/80 pb-2 dark:border-white/10">
              <Route className="h-4 w-4 text-neutral-500 dark:text-slate-400" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-slate-100">
                Steering approvals
              </h3>
            </div>
            {steeringApprovals.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-slate-400">
                No steering approvals are waiting.
              </p>
            ) : (
              steeringApprovals.map((approval) => (
                <SteeringApprovalCard
                  key={approval.id}
                  approval={approval}
                  editable={editable}
                  isMutating={isMutating}
                  onApprovalDecision={onApprovalDecision}
                />
              ))
            )}
          </section>
        </>
      ) : null}
    </div>
  );

  if (frame === 'inline') {
    return (
      <section className="workflow-surface-monitoring space-y-4 rounded-xl border border-sky-200/70 bg-sky-50/50 p-4">
        {header}
        {content}
      </section>
    );
  }

  return (
    <Card>
      <CardHeader>{header}</CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
