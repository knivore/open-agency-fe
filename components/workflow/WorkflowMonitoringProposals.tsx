'use client';

import { Check, GitPullRequest, MessageSquareText, Split, X } from 'lucide-react';
import { Badge } from '@/components/library/shadcn/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/library/shadcn/card';
import type { ApprovalRequest } from '@/types/conversations';
import type {
  WorkflowMonitoringEventsResponse,
  WorkflowMonitoringProposalEvent,
} from '@/types/workflows';

interface WorkflowMonitoringProposalsProps {
  editable?: boolean;
  frame?: 'card' | 'inline';
  events?: WorkflowMonitoringEventsResponse | null;
  isLoading: boolean;
  isMutating: boolean;
  onApprovalDecision: (
    approvalRequestId: string,
    action: 'approve' | 'reject' | 'request_changes' | 'split'
  ) => void;
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

function approvalBadgeVariant(approval: ApprovalRequest | null) {
  if (!approval || approval.status === 'pending') {
    return 'outline';
  }
  if (approval.status === 'approved') {
    return 'default';
  }
  return 'secondary';
}

export default function WorkflowMonitoringProposals({
  editable = true,
  frame = 'card',
  events,
  isLoading,
  isMutating,
  onApprovalDecision,
}: WorkflowMonitoringProposalsProps) {
  const proposals = events?.proposals ?? [];
  const pendingCount = proposals.filter((proposal) => pendingApproval(proposal)).length;

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1.5">
        <CardTitle className="text-base">Monitor proposals</CardTitle>
        <CardDescription>
          Permissioned workflow improvements proposed from run evidence.
        </CardDescription>
      </div>
      <Badge variant={pendingCount ? 'default' : 'outline'}>{pendingCount} pending</Badge>
    </div>
  );

  const content = (
    <div className="space-y-3">
      {isLoading ? <p className="text-sm text-neutral-500">Loading monitor proposals...</p> : null}
      {!isLoading && proposals.length === 0 ? (
        <p className="text-sm text-neutral-500">No monitor proposals for this workflow yet.</p>
      ) : null}
      {proposals.map((proposal) => {
        const approval = pendingApproval(proposal) ?? proposal.approval_requests?.[0] ?? null;
        const pending = approval?.status === 'pending';
        return (
          <div key={proposal.id} className="rounded-md border border-neutral-200 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <GitPullRequest className="h-4 w-4 text-neutral-500" aria-hidden="true" />
                  <p className="font-medium text-neutral-900">{proposalSummary(proposal)}</p>
                </div>
                <p className="text-xs text-neutral-500">
                  Evidence: {proposalEvidenceCount(proposal)} item(s)
                  {proposalRisk(proposal) ? ` · Risk: ${proposalRisk(proposal)}` : ''}
                </p>
              </div>
              <Badge variant={approvalBadgeVariant(approval)}>
                {approval?.status ?? 'proposal recorded'}
              </Badge>
            </div>

            {approval?.diff_summary ? (
              <p className="mt-3 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                {approval.diff_summary}
              </p>
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
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-neutral-200 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Reject
                </button>
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => onApprovalDecision(approval.id, 'request_changes')}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-neutral-200 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                  Request changes
                </button>
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => onApprovalDecision(approval.id, 'split')}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-neutral-200 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Split className="h-4 w-4" aria-hidden="true" />
                  Split
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );

  if (frame === 'inline') {
    return (
      <section className="space-y-4 rounded-md border border-neutral-200 bg-neutral-50/60 p-4">
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
