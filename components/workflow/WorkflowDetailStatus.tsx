'use client';

import { labelForEntrypointTask } from '@/components/workflow/useWorkflowEditorDraft';
import { resolveWorkflowExecutionHost } from '@/lib/workflows/executionPayload';
import { cn } from '@/lib/utils';
import type { TaskDefinition, WorkflowDefinition } from '@/types/workflows';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../library/shadcn/card';

interface WorkflowDetailStatusProps {
  workflow: WorkflowDefinition;
  visibleTaskDefinitions: TaskDefinition[];
  visibleAgentCount: number;
  effectiveEntrypointTaskId: string;
  isEditing: boolean;
  draftValidationIssues: string[];
}

function workflowImportReport(workflow: WorkflowDefinition) {
  const report = workflow.metadata?.workflow_import_report;
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    return null;
  }

  const actionRequired = report.action_required === true;
  const messages = Array.isArray(report.messages)
    ? report.messages.filter((message): message is string => typeof message === 'string')
    : [];

  return {
    actionRequired,
    messages,
  };
}

export default function WorkflowDetailStatus({
  workflow,
  visibleTaskDefinitions,
  visibleAgentCount,
  effectiveEntrypointTaskId,
  isEditing,
  draftValidationIssues,
}: WorkflowDetailStatusProps) {
  const entrypointLabel = labelForEntrypointTask(effectiveEntrypointTaskId, visibleTaskDefinitions);
  const runtimeLabel = workflow.default_runtime_adapter_id || 'No default adapter';
  const hostLabel = resolveWorkflowExecutionHost(workflow);
  const importReport = workflowImportReport(workflow);
  return (
    <>
      {isEditing && draftValidationIssues.length > 0 ? (
        <Card className="border-red-200 bg-red-50/70 dark:border-red-400/25 dark:bg-red-500/10">
          <CardHeader>
            <CardTitle className="text-base text-red-900">Workflow validation</CardTitle>
            <CardDescription className="text-red-800">
              Fix these issues before saving the workflow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-red-900">
            {draftValidationIssues.map((issue) => (
              <p key={issue}>{issue}</p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {importReport?.actionRequired ? (
        <Card className="border-amber-200 bg-amber-50/80 dark:border-amber-300/25 dark:bg-amber-400/10">
          <CardHeader>
            <CardTitle className="text-base text-amber-950">Import needs review</CardTitle>
            <CardDescription className="text-amber-900">
              Some model profiles or tools from the package were missing locally.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-amber-950">
            {importReport.messages.slice(0, 5).map((message) => (
              <p key={message}>{message}</p>
            ))}
            {importReport.messages.length > 5 ? (
              <p>{importReport.messages.length - 5} more import notes.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-2.5 rounded-xl border border-(--agency-shell-border) bg-(--agency-surface-raised) px-3 py-2.5 shadow-(--agency-elevation-1) xl:flex-row xl:items-center xl:justify-between">
        <dl className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-(--agency-shell-muted)">
          <div className="flex min-w-0 items-baseline gap-2">
            <dt className="shrink-0 font-medium text-(--agency-shell-text)">Entrypoint</dt>
            <dd className="max-w-96 truncate">{entrypointLabel}</dd>
          </div>
          <div className="flex min-w-0 items-baseline gap-2">
            <dt className="shrink-0 font-medium text-(--agency-shell-text)">Runtime</dt>
            <dd className="truncate">{runtimeLabel}</dd>
          </div>
          <div className="flex min-w-0 items-baseline gap-2">
            <dt className="shrink-0 font-medium text-(--agency-shell-text)">Host</dt>
            <dd className="truncate">{hostLabel}</dd>
          </div>
        </dl>
        <dl className="flex flex-wrap items-center gap-1.5 text-xs tabular-nums">
          <div
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
              draftValidationIssues.length > 0
                ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-300/20 dark:bg-amber-400/10 dark:text-amber-100'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-300/20 dark:bg-emerald-400/10 dark:text-emerald-100'
            )}
          >
            <dt className="font-medium">Status</dt>
            <dd className="font-semibold">
              {draftValidationIssues.length > 0 ? 'Needs attention' : 'Ready'}
            </dd>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-agent-200/70 bg-agent-50/70 px-2.5 py-1 dark:border-agent-400/20 dark:bg-agent-500/10">
            <dt className="font-medium text-agent-700 dark:text-agent-200">Agents</dt>
            <dd className="font-semibold text-agent-950 dark:text-agent-50">{visibleAgentCount}</dd>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/70 bg-amber-50/70 px-2.5 py-1 dark:border-amber-300/20 dark:bg-amber-400/10">
            <dt className="font-medium text-amber-700 dark:text-amber-200">Tasks</dt>
            <dd className="font-semibold text-amber-950 dark:text-amber-50">
              {visibleTaskDefinitions.length}
            </dd>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-slate-50/70 px-2.5 py-1 dark:border-slate-400/20 dark:bg-slate-400/10">
            <dt className="font-medium text-slate-600 dark:text-slate-300">Graph</dt>
            <dd className="font-semibold text-slate-900 dark:text-slate-100">
              {workflow.nodes?.length ?? 0}/{workflow.edges?.length ?? 0}
            </dd>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/70 bg-blue-50/70 px-2.5 py-1 dark:border-blue-400/20 dark:bg-blue-500/10">
            <dt className="font-medium text-blue-700 dark:text-blue-200">Adapters</dt>
            <dd className="font-semibold text-blue-950 dark:text-blue-50">
              {workflow.allowed_runtime_adapter_ids?.length ?? 0}
            </dd>
          </div>
        </dl>
      </div>
    </>
  );
}
