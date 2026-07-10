'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, FileSearch, ShieldCheck, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { workflowsApi } from '@/lib/api/backend/workflows';
import { queryKeys } from '@/lib/react-query/queryKeys';
import type {
  WorkflowGovernanceActionResponse,
  WorkflowGovernanceBundleResponse,
  WorkflowGovernanceDocumentSuggestResponse,
  WorkflowGovernanceQueueItem,
  WorkflowGovernanceReviewQueueResponse,
} from '@/types/workflows';
import { Badge } from '@/components/library/shadcn/badge';
import { Button } from '@/components/library/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/library/shadcn/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/library/shadcn/dialog';
import { ErrorAlert, LoadingCard } from '@/components/agent-app/StatePanels';
import {
  WorkflowReadOnlySummaryField,
  WorkflowSettingsSection,
  WorkflowStateValue,
  WorkflowToneDot,
} from '@/components/workflow/WorkflowSettingsPrimitives';

interface WorkflowGovernancePanelProps {
  workflowId: string;
  editable?: boolean;
}

type WorkflowGovernanceDirectAction =
  | 'attach_evidence'
  | 'request_approval'
  | 'resolve'
  | 'dismiss'
  | 'reopen';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStringAtPath(value: unknown, path: string[]): string | null {
  let current: unknown = value;
  for (const segment of path) {
    if (!isRecord(current)) {
      return null;
    }
    current = current[segment];
  }
  return typeof current === 'string' ? current : null;
}

function readDocumentId(document: unknown): string | null {
  return readStringAtPath(document, ['id']);
}

function formatActivityTimestamp(value: unknown): string {
  if (typeof value !== 'string' || !value) {
    return 'Unknown time';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function readApprovalRequestIdFromBundle(result: WorkflowGovernanceBundleResponse): string | null {
  const approvalStep = result.applied_steps.find(
    (step) => isRecord(step) && step.action === 'request_approval'
  );
  return readStringAtPath(approvalStep, ['result', 'result', 'approval_request', 'id']);
}

function readApprovalRequestIdFromAction(result: WorkflowGovernanceActionResponse): string | null {
  return readStringAtPath(result.result, ['approval_request', 'id']);
}

function updateQueueItem(
  queue: WorkflowGovernanceReviewQueueResponse | undefined,
  recordKind: string,
  recordId: string,
  updater: (item: WorkflowGovernanceQueueItem) => WorkflowGovernanceQueueItem
): WorkflowGovernanceReviewQueueResponse | undefined {
  if (!queue) {
    return queue;
  }
  const updateCollection = (items: WorkflowGovernanceQueueItem[]) =>
    items.map((item) =>
      item.record_kind === recordKind && item.record_id === recordId ? updater(item) : item
    );
  return {
    ...queue,
    items: updateCollection(queue.items),
    proposals: updateCollection(queue.proposals),
    steering_approvals: updateCollection(queue.steering_approvals),
  };
}

function patchQueueItemAfterEvidence(
  item: WorkflowGovernanceQueueItem,
  documentId: string,
  summary?: string
): WorkflowGovernanceQueueItem {
  const evidenceLinks = [
    {
      id: `local-${documentId}`,
      document_id: documentId,
      label: documentId,
      summary,
    },
    ...item.evidence_links.filter((link) => String(link.document_id) !== documentId),
  ];
  const nextActions = item.next_actions.filter((action) => action !== 'attach_evidence');
  return {
    ...item,
    priority: nextActions.includes('request_approval')
      ? 'approval'
      : item.priority === 'evidence'
        ? 'review'
        : item.priority,
    evidence_link_count: evidenceLinks.length,
    evidence_links: evidenceLinks,
    next_actions: nextActions.length > 0 ? nextActions : ['monitor'],
  };
}

function patchQueueItemAfterApprovalRequest(
  item: WorkflowGovernanceQueueItem,
  approvalRequestId?: string | null
): WorkflowGovernanceQueueItem {
  const nextActions = item.next_actions.filter((action) => action !== 'request_approval');
  return {
    ...item,
    status: 'approval_requested',
    approval_request_id: approvalRequestId ?? item.approval_request_id,
    priority: item.evidence_link_count > 0 ? 'review' : 'evidence',
    next_actions: nextActions.length > 0 ? nextActions : ['monitor'],
  };
}

function patchQueueItemAfterLifecycleAction(
  item: WorkflowGovernanceQueueItem,
  action: 'resolve' | 'dismiss' | 'reopen'
): WorkflowGovernanceQueueItem {
  if (action === 'resolve' || action === 'dismiss') {
    return {
      ...item,
      status: action === 'resolve' ? 'resolved' : 'dismissed',
      priority: 'resolved',
      next_actions: ['reopen'],
    };
  }
  const reopenedStatus = item.record_kind === 'steering_approval' ? 'pending' : 'draft';
  const nextActions =
    item.evidence_link_count > 0
      ? ['review_for_approval']
      : ['attach_evidence', 'review_for_approval'];
  return {
    ...item,
    status: reopenedStatus,
    priority: 'approval',
    next_actions: nextActions,
  };
}

function actionSuccessMessage(action: WorkflowGovernanceDirectAction): string {
  switch (action) {
    case 'request_approval':
      return 'Approval requested.';
    case 'attach_evidence':
      return 'Evidence attached.';
    case 'resolve':
      return 'Governance record resolved.';
    case 'dismiss':
      return 'Governance record dismissed.';
    case 'reopen':
      return 'Governance record reopened.';
  }
}

function selectedQueueItem(
  queue: WorkflowGovernanceReviewQueueResponse | undefined,
  recordId: string | null
) {
  if (!queue || !recordId) {
    return queue?.items?.[0] ?? null;
  }
  return queue.items.find((item) => item.record_id === recordId) ?? queue.items[0] ?? null;
}

function priorityTone(priority: string) {
  switch (priority) {
    case 'repair':
      return 'destructive';
    case 'approval':
      return 'default';
    case 'evidence':
      return 'secondary';
    default:
      return 'outline';
  }
}

export default function WorkflowGovernancePanel({
  workflowId,
  editable = false,
}: WorkflowGovernancePanelProps) {
  const queryClient = useQueryClient();
  const queueQueryKey = [
    ...queryKeys.backendWorkflow(workflowId),
    'governance-review-queue',
  ] as const;
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [latestBundleResult, setLatestBundleResult] =
    useState<WorkflowGovernanceBundleResponse | null>(null);
  const [latestActionResult, setLatestActionResult] =
    useState<WorkflowGovernanceActionResponse | null>(null);

  const queueQuery = useQuery({
    queryKey: queueQueryKey,
    queryFn: () => workflowsApi.getWorkflowGovernanceReviewQueue(workflowId),
  });

  const activeItem = useMemo(
    () => selectedQueueItem(queueQuery.data, activeRecordId),
    [activeRecordId, queueQuery.data]
  );

  const suggestionsQuery = useQuery({
    queryKey: [
      ...queryKeys.backendWorkflow(workflowId),
      'governance-document-suggest',
      activeItem?.record_kind ?? 'none',
      activeItem?.record_id ?? 'none',
    ],
    enabled: Boolean(activeItem?.record_kind && activeItem?.record_id),
    queryFn: () =>
      workflowsApi.suggestWorkflowGovernanceDocuments(
        workflowId,
        String(activeItem?.record_kind ?? ''),
        String(activeItem?.record_id ?? '')
      ),
  });

  const bundleMutation = useMutation({
    mutationFn: ({ dryRun, item }: { dryRun: boolean; item: WorkflowGovernanceQueueItem }) =>
      workflowsApi.executeWorkflowGovernanceBundle(
        workflowId,
        String(item.record_kind),
        String(item.record_id),
        { dry_run: dryRun }
      ),
    onSuccess: async (result: WorkflowGovernanceBundleResponse, variables) => {
      setLatestBundleResult(result);
      if (!variables.dryRun) {
        queryClient.setQueryData<WorkflowGovernanceReviewQueueResponse | undefined>(
          queueQueryKey,
          (current) => {
            let next = current;
            const topSuggestion = result.suggestions.items[0];
            const suggestedDocumentId = topSuggestion
              ? readDocumentId(topSuggestion.document)
              : null;
            if (topSuggestion && suggestedDocumentId) {
              next = updateQueueItem(
                next,
                String(result.record_kind),
                String(result.record_id),
                (item) =>
                  patchQueueItemAfterEvidence(item, suggestedDocumentId, topSuggestion.reason)
              );
            }
            const approvalRequestId = readApprovalRequestIdFromBundle(result);
            if (approvalRequestId) {
              next = updateQueueItem(
                next,
                String(result.record_kind),
                String(result.record_id),
                (item) => patchQueueItemAfterApprovalRequest(item, String(approvalRequestId))
              );
            }
            return next;
          }
        );
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.backendWorkflow(workflowId),
      });
      toast.success(
        variables.dryRun ? 'Governance bundle preview updated.' : 'Governance bundle executed.',
        { position: 'top-right' }
      );
      if (!variables.dryRun && result.record_id) {
        setActiveRecordId(String(result.record_id));
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to execute governance bundle.', {
        position: 'top-right',
      });
    },
  });

  const actionMutation = useMutation({
    mutationFn: ({
      action,
      item,
      documentId,
      summary,
    }: {
      action: WorkflowGovernanceDirectAction;
      item: WorkflowGovernanceQueueItem;
      documentId?: string;
      summary?: string;
    }) => {
      if (action === 'request_approval') {
        return workflowsApi.requestWorkflowGovernanceApproval(
          workflowId,
          String(item.record_kind),
          String(item.record_id)
        );
      }
      if (action === 'resolve') {
        return workflowsApi.resolveWorkflowGovernanceRecord(
          workflowId,
          String(item.record_kind),
          String(item.record_id)
        );
      }
      if (action === 'dismiss') {
        return workflowsApi.dismissWorkflowGovernanceRecord(
          workflowId,
          String(item.record_kind),
          String(item.record_id)
        );
      }
      if (action === 'reopen') {
        return workflowsApi.reopenWorkflowGovernanceRecord(
          workflowId,
          String(item.record_kind),
          String(item.record_id)
        );
      }
      return workflowsApi.attachWorkflowGovernanceEvidence(
        workflowId,
        String(item.record_kind),
        String(item.record_id),
        {
          document_id: documentId,
          summary,
        }
      );
    },
    onSuccess: async (result, variables) => {
      setLatestActionResult(result);
      if (variables.action === 'request_approval') {
        const approvalRequestId = readApprovalRequestIdFromAction(result);
        queryClient.setQueryData<WorkflowGovernanceReviewQueueResponse | undefined>(
          queueQueryKey,
          (current) =>
            updateQueueItem(
              current,
              String(variables.item.record_kind),
              String(variables.item.record_id),
              (item) => patchQueueItemAfterApprovalRequest(item, approvalRequestId)
            )
        );
      } else if (
        variables.action === 'resolve' ||
        variables.action === 'dismiss' ||
        variables.action === 'reopen'
      ) {
        const lifecycleAction = variables.action;
        queryClient.setQueryData<WorkflowGovernanceReviewQueueResponse | undefined>(
          queueQueryKey,
          (current) =>
            updateQueueItem(
              current,
              String(variables.item.record_kind),
              String(variables.item.record_id),
              (item) => patchQueueItemAfterLifecycleAction(item, lifecycleAction)
            )
        );
      } else if (variables.documentId) {
        const documentId = variables.documentId;
        queryClient.setQueryData<WorkflowGovernanceReviewQueueResponse | undefined>(
          queueQueryKey,
          (current) =>
            updateQueueItem(
              current,
              String(variables.item.record_kind),
              String(variables.item.record_id),
              (item) => patchQueueItemAfterEvidence(item, documentId, variables.summary)
            )
        );
        queryClient.setQueryData<WorkflowGovernanceDocumentSuggestResponse | undefined>(
          [
            ...queryKeys.backendWorkflow(workflowId),
            'governance-document-suggest',
            variables.item.record_kind,
            variables.item.record_id,
          ],
          (current) => {
            if (!current) {
              return current;
            }
            return {
              ...current,
              items: current.items.map((suggestion) =>
                readDocumentId(suggestion.document) === documentId
                  ? {
                      ...suggestion,
                      summary: {
                        ...suggestion.summary,
                        linked_to_record: true,
                      },
                      reason:
                        `Already linked to this governance record; ${suggestion.reason}`.replace(
                          '; Already linked to this governance record',
                          'Already linked to this governance record'
                        ),
                    }
                  : suggestion
              ),
            };
          }
        );
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.backendWorkflow(workflowId),
      });
      toast.success(actionSuccessMessage(variables.action), { position: 'top-right' });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to run governance action.', {
        position: 'top-right',
      });
    },
  });

  if (queueQuery.isLoading) {
    return (
      <LoadingCard
        title="Governance queue"
        description="Loading approval, evidence, and remediation work for this workflow."
      />
    );
  }

  if (queueQuery.isError) {
    return (
      <ErrorAlert
        title="Governance queue unavailable"
        message={
          queueQuery.error instanceof Error
            ? queueQuery.error.message
            : 'Failed to load governance queue.'
        }
        onRetry={() => {
          void queueQuery.refetch();
        }}
      />
    );
  }

  const queue = queueQuery.data;
  if (!queue || queue.items.length === 0) {
    return (
      <WorkflowSettingsSection
        title="Governance queue"
        description="Approval, evidence, and repair work that needs operator attention."
        tone="emerald"
        className="p-4"
      >
        <div className="rounded-lg border border-emerald-200 bg-white/80 px-4 py-4 dark:border-emerald-500/20 dark:bg-slate-950/60">
          <div className="flex items-center gap-2 text-base font-semibold text-neutral-900 dark:text-slate-100">
            <WorkflowToneDot tone="emerald" />
            Queue clear
          </div>
          <p className="mt-2 text-sm text-neutral-500 dark:text-slate-400">
            No approval, evidence, or repair work is currently queued for this workflow.
          </p>
        </div>
      </WorkflowSettingsSection>
    );
  }

  const detailSuggestions: WorkflowGovernanceDocumentSuggestResponse | null =
    activeItem?.record_id &&
    latestBundleResult &&
    activeItem.record_id === latestBundleResult.record_id
      ? latestBundleResult.suggestions
      : (suggestionsQuery.data ?? null);
  const activeItemIsManuallyClosed =
    activeItem?.status === 'resolved' || activeItem?.status === 'dismissed';
  const activeItemHasApprovalLink = Boolean(activeItem?.approval_request_id);
  const activeActivity = Array.isArray(activeItem?.activity)
    ? activeItem.activity.filter(isRecord)
    : [];

  return (
    <>
      <Card className="border-neutral-200 bg-neutral-50/60 dark:border-white/10 dark:bg-white/3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Governance queue
          </CardTitle>
          <CardDescription>
            Review approval routing, evidence gaps, and deterministic repair work for this workflow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <WorkflowReadOnlySummaryField label="Actionable">
              <WorkflowStateValue>{queue.summary.actionable_count}</WorkflowStateValue>
            </WorkflowReadOnlySummaryField>
            <WorkflowReadOnlySummaryField label="Remediation">
              <WorkflowStateValue>{queue.summary.remediation_candidate_count}</WorkflowStateValue>
            </WorkflowReadOnlySummaryField>
            <WorkflowReadOnlySummaryField label="Orphaned approvals">
              <WorkflowStateValue>{queue.summary.orphaned_approval_count}</WorkflowStateValue>
            </WorkflowReadOnlySummaryField>
          </dl>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-3">
              {queue.items.map((item) => {
                const isActive = item.record_id === activeItem?.record_id;
                return (
                  <button
                    key={`${item.record_kind}:${item.record_id}`}
                    type="button"
                    onClick={() => setActiveRecordId(item.record_id)}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      isActive
                        ? 'border-sky-300 bg-sky-50/70 dark:border-sky-400/30 dark:bg-sky-500/10'
                        : 'border-neutral-200 bg-white/85 hover:border-neutral-300 dark:border-white/10 dark:bg-slate-950/65 dark:hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-neutral-900 dark:text-slate-100">
                          {item.title ?? item.record_id}
                        </p>
                        <p className="mt-1 text-xs text-neutral-500 dark:text-slate-400">
                          {item.record_kind.replace(/_/g, ' ')} · {item.status}
                        </p>
                      </div>
                      <Badge variant={priorityTone(item.priority)}>{item.priority}</Badge>
                    </div>
                    {item.audit_reason ? (
                      <p className="mt-2 line-clamp-2 text-xs text-neutral-600 dark:text-slate-300">
                        {item.audit_reason}
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {activeItem ? (
              <div className="space-y-4 rounded-lg border border-neutral-200 bg-white/85 p-4 dark:border-white/10 dark:bg-slate-950/65">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={priorityTone(activeItem.priority)}>{activeItem.priority}</Badge>
                    <Badge variant="outline">{activeItem.status}</Badge>
                  </div>
                  <h3 className="text-base font-semibold text-neutral-900 dark:text-slate-100">
                    {activeItem.title ?? activeItem.record_id}
                  </h3>
                  <p className="text-sm text-neutral-600 dark:text-slate-400">
                    Next actions: {activeItem.next_actions.join(', ')}
                  </p>
                </div>

                <div className="rounded-md border border-neutral-200 bg-neutral-50/80 p-3 dark:border-white/10 dark:bg-white/4">
                  <div className="flex items-center gap-2 text-sm font-medium text-neutral-900 dark:text-slate-100">
                    <FileSearch className="h-4 w-4" />
                    Suggested evidence
                  </div>
                  {suggestionsQuery.isLoading ? (
                    <p className="mt-2 text-sm text-neutral-600 dark:text-slate-400">
                      Ranking uploaded workflow documents...
                    </p>
                  ) : suggestionsQuery.data?.items?.length ? (
                    <div className="mt-3 space-y-2">
                      {suggestionsQuery.data.items.slice(0, 3).map((suggestion) => (
                        <div
                          key={String(suggestion.document.id)}
                          className="rounded-md border border-neutral-200 bg-white/90 p-3 dark:border-white/10 dark:bg-slate-950/72"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-neutral-900 dark:text-slate-100">
                                {String(
                                  suggestion.summary.headline ?? suggestion.document.filename
                                )}
                              </p>
                              <p className="mt-1 text-xs text-neutral-500 dark:text-slate-400">
                                {suggestion.reason}
                              </p>
                            </div>
                            <Badge variant="outline">Score {suggestion.score}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-neutral-600 dark:text-slate-400">
                      No matching workflow documents were found.
                    </p>
                  )}
                </div>

                <div className="rounded-md border border-neutral-200 bg-neutral-50/80 p-3 dark:border-white/10 dark:bg-white/4">
                  <div className="flex items-center gap-2 text-sm font-medium text-neutral-900 dark:text-slate-100">
                    <Wrench className="h-4 w-4" />
                    Bundle actions
                  </div>
                  <p className="mt-2 text-sm text-neutral-600 dark:text-slate-400">
                    Preview or execute the fixed governance flow for this record: suggest evidence,
                    attach the top match, then request approval.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={bundleMutation.isPending}
                      onClick={() => {
                        void bundleMutation.mutateAsync({ dryRun: true, item: activeItem });
                      }}
                    >
                      Preview Bundle
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setDetailOpen(true)}>
                      View Details
                    </Button>
                    <Button
                      type="button"
                      disabled={!editable || bundleMutation.isPending}
                      onClick={() => {
                        void bundleMutation.mutateAsync({ dryRun: false, item: activeItem });
                      }}
                    >
                      Apply Bundle
                    </Button>
                  </div>
                  {!editable ? (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                      Switch to edit mode to execute governance bundle actions.
                    </p>
                  ) : null}
                </div>

                {queue.recommendations.length ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-100">
                      <AlertTriangle className="h-4 w-4" />
                      Operator recommendations
                    </div>
                    <ul className="mt-2 space-y-2 text-sm text-amber-950 dark:text-amber-100">
                      {queue.recommendations.map((recommendation) => (
                        <li key={recommendation.action}>
                          <span className="font-medium">{recommendation.action}</span>
                          {' · '}
                          {recommendation.reason} ({recommendation.count})
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {activeItem ? (
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{activeItem.title ?? activeItem.record_id}</DialogTitle>
              <DialogDescription>
                {activeItem.record_kind.replace(/_/g, ' ')} · {activeItem.status} ·{' '}
                {activeItem.priority}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <section className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-4">
                <h4 className="text-sm font-semibold text-foreground">Record detail</h4>
                <dl className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-foreground">Record id</dt>
                    <dd className="break-all">{activeItem.record_id}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">Approval request</dt>
                    <dd className="break-all">{activeItem.approval_request_id ?? 'Not linked'}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="font-medium text-foreground">Next actions</dt>
                    <dd>{activeItem.next_actions.join(', ')}</dd>
                  </div>
                  {activeItem.audit_reason ? (
                    <div className="sm:col-span-2">
                      <dt className="font-medium text-foreground">Audit reason</dt>
                      <dd>{activeItem.audit_reason}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>

              <section className="flex flex-col gap-2 rounded-lg border border-border bg-background p-4">
                <h4 className="text-sm font-semibold text-foreground">Linked evidence</h4>
                {activeItem.evidence_links.length ? (
                  <div className="flex flex-col gap-2">
                    {activeItem.evidence_links.map((link) => (
                      <div
                        key={String(link.id)}
                        className="rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground"
                      >
                        <p className="font-medium text-foreground">
                          {String(link.label ?? link.document_id)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {String(link.document_id)}
                        </p>
                        {typeof link.summary === 'string' && link.summary ? (
                          <p className="mt-2">{link.summary}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No uploaded documents are currently linked to this record.
                  </p>
                )}
              </section>

              <section className="flex flex-col gap-2 rounded-lg border border-border bg-background p-4">
                <h4 className="text-sm font-semibold text-foreground">Activity</h4>
                {activeActivity.length ? (
                  <div className="flex flex-col gap-3">
                    {activeActivity.map((event, index) => (
                      <div
                        key={`${readStringAtPath(event, ['kind']) ?? 'event'}-${readStringAtPath(event, ['timestamp']) ?? index}`}
                        className="rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-foreground">
                              {readStringAtPath(event, ['title']) ?? 'Governance event'}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatActivityTimestamp(readStringAtPath(event, ['timestamp']))}
                              {readStringAtPath(event, ['actor'])
                                ? ` · ${readStringAtPath(event, ['actor'])}`
                                : ''}
                            </p>
                          </div>
                          {readStringAtPath(event, ['kind']) ? (
                            <Badge variant="outline">{readStringAtPath(event, ['kind'])}</Badge>
                          ) : null}
                        </div>
                        {readStringAtPath(event, ['summary']) ? (
                          <p className="mt-2">{readStringAtPath(event, ['summary'])}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No governance activity has been derived for this record yet.
                  </p>
                )}
              </section>

              <section className="flex flex-col gap-2 rounded-lg border border-border bg-background p-4">
                <h4 className="text-sm font-semibold text-foreground">Suggested documents</h4>
                {detailSuggestions?.items?.length ? (
                  <div className="flex flex-col gap-2">
                    {detailSuggestions.items.map((suggestion) => (
                      <div
                        key={String(suggestion.document.id)}
                        className="rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-foreground">
                              {String(suggestion.summary.headline ?? suggestion.document.filename)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {suggestion.reason}
                            </p>
                          </div>
                          <Badge variant="outline">Score {suggestion.score}</Badge>
                        </div>
                        {suggestion.matched_terms.length ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Matched terms: {suggestion.matched_terms.join(', ')}
                          </p>
                        ) : null}
                        <div className="mt-3">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!editable || actionMutation.isPending}
                            onClick={() => {
                              if (!activeItem) {
                                return;
                              }
                              void actionMutation.mutateAsync({
                                action: 'attach_evidence',
                                item: activeItem,
                                documentId: String(suggestion.document.id),
                                summary: suggestion.reason,
                              });
                            }}
                          >
                            Attach This Document
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No document suggestions are currently available.
                  </p>
                )}
              </section>

              {latestBundleResult && latestBundleResult.record_id === activeItem.record_id ? (
                <section className="flex flex-col gap-2 rounded-lg border border-emerald-300/60 bg-emerald-500/10 p-4 text-emerald-950 dark:border-emerald-400/20 dark:text-emerald-100">
                  <h4 className="text-sm font-semibold">Latest bundle result</h4>
                  <div className="flex flex-col gap-2 text-sm">
                    <p>Dry run: {latestBundleResult.dry_run ? 'Yes' : 'No'}</p>
                    <p>Planned steps: {latestBundleResult.planned_steps.length}</p>
                    <p>Applied steps: {latestBundleResult.applied_steps.length}</p>
                  </div>
                </section>
              ) : null}

              <section className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-4">
                <h4 className="text-sm font-semibold text-foreground">Direct actions</h4>
                <p className="text-sm text-muted-foreground">
                  Run a single operator action without executing the full governance bundle.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={
                      !editable ||
                      actionMutation.isPending ||
                      activeItemIsManuallyClosed ||
                      activeItemHasApprovalLink
                    }
                    onClick={() => {
                      void actionMutation.mutateAsync({
                        action: 'request_approval',
                        item: activeItem,
                      });
                    }}
                  >
                    Request Approval Only
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      !editable ||
                      actionMutation.isPending ||
                      activeItemIsManuallyClosed ||
                      activeItemHasApprovalLink
                    }
                    onClick={() => {
                      void actionMutation.mutateAsync({
                        action: 'resolve',
                        item: activeItem,
                      });
                    }}
                  >
                    Resolve
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      !editable ||
                      actionMutation.isPending ||
                      activeItemIsManuallyClosed ||
                      activeItemHasApprovalLink
                    }
                    onClick={() => {
                      void actionMutation.mutateAsync({
                        action: 'dismiss',
                        item: activeItem,
                      });
                    }}
                  >
                    Dismiss
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      !editable ||
                      actionMutation.isPending ||
                      !activeItemIsManuallyClosed ||
                      activeItemHasApprovalLink
                    }
                    onClick={() => {
                      void actionMutation.mutateAsync({
                        action: 'reopen',
                        item: activeItem,
                      });
                    }}
                  >
                    Reopen
                  </Button>
                </div>
                {activeItemHasApprovalLink ? (
                  <p className="text-xs text-amber-700">
                    Manual lifecycle actions are disabled while this record is linked to an approval
                    request.
                  </p>
                ) : null}
                {!editable ? (
                  <p className="text-xs text-amber-700">
                    Switch to edit mode to run direct governance actions.
                  </p>
                ) : null}
              </section>

              {latestActionResult && latestActionResult.record_id === activeItem.record_id ? (
                <section className="space-y-2 rounded-md border border-sky-200 bg-sky-50 p-4">
                  <h4 className="text-sm font-semibold text-sky-950">Latest direct action</h4>
                  <div className="space-y-1 text-sm text-sky-950">
                    <p>Action: {latestActionResult.action}</p>
                    {latestActionResult.document_id ? (
                      <p>Document: {latestActionResult.document_id}</p>
                    ) : null}
                  </div>
                </section>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
