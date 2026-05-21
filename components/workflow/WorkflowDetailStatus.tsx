'use client';

import { labelForEntrypointTask } from '@/components/workflow/useWorkflowEditorDraft';
import { resolveWorkflowExecutionHost } from '@/lib/workflows/executionPayload';
import type { TaskDefinition, WorkflowDefinition } from '@/types/workflows';
import { Badge } from '../library/shadcn/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../library/shadcn/card';

interface WorkflowDetailStatusProps {
  workflow: WorkflowDefinition;
  visibleTaskDefinitions: TaskDefinition[];
  visibleAgentCount: number;
  effectiveEntrypointTaskId: string;
  hasUnsavedChanges: boolean;
  isEditing: boolean;
  draftValidationIssues: string[];
}

export default function WorkflowDetailStatus({
  workflow,
  visibleTaskDefinitions,
  visibleAgentCount,
  effectiveEntrypointTaskId,
  hasUnsavedChanges,
  isEditing,
  draftValidationIssues,
}: WorkflowDetailStatusProps) {
  const entrypointLabel = labelForEntrypointTask(effectiveEntrypointTaskId, visibleTaskDefinitions);
  const runtimeLabel = workflow.default_runtime_adapter_id || 'No default adapter';
  const hostLabel = resolveWorkflowExecutionHost(workflow);
  const versionLabel = workflow.versioning?.version || '1.0.0';
  const publicationLabel = workflow.versioning?.is_published ? 'Published' : 'Draft';
  const editLabel = isEditing ? (hasUnsavedChanges ? 'Unsaved changes' : 'Editing') : null;

  return (
    <>
      {isEditing && draftValidationIssues.length > 0 ? (
        <Card className="border-red-200 bg-red-50/70">
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

      <div className="flex flex-col gap-3 rounded-xl border border-primary-100 bg-white/80 px-4 py-3 shadow-sm shadow-primary-100/30 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={workflow.versioning?.is_published ? 'default' : 'outline'}>
              {publicationLabel}
            </Badge>
            <Badge variant="secondary">v{versionLabel}</Badge>
            {editLabel ? <Badge variant="secondary">{editLabel}</Badge> : null}
          </div>
          <div className="grid gap-2 text-sm text-neutral-600 md:grid-cols-3">
            <div className="min-w-0">
              <span className="font-medium text-neutral-900">Entrypoint</span>
              <span className="ml-2 truncate">{entrypointLabel}</span>
            </div>
            <div className="min-w-0">
              <span className="font-medium text-neutral-900">Runtime</span>
              <span className="ml-2 truncate">{runtimeLabel}</span>
            </div>
            <div className="min-w-0">
              <span className="font-medium text-neutral-900">Host</span>
              <span className="ml-2">{hostLabel}</span>
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:min-w-[28rem]">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50/70 px-3 py-2">
            <dt className="text-xs font-medium text-neutral-500">Agents</dt>
            <dd className="mt-0.5 font-semibold text-neutral-900">{visibleAgentCount}</dd>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50/70 px-3 py-2">
            <dt className="text-xs font-medium text-neutral-500">Tasks</dt>
            <dd className="mt-0.5 font-semibold text-neutral-900">
              {visibleTaskDefinitions.length}
            </dd>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50/70 px-3 py-2">
            <dt className="text-xs font-medium text-neutral-500">Graph</dt>
            <dd className="mt-0.5 font-semibold text-neutral-900">
              {workflow.nodes?.length ?? 0}/{workflow.edges?.length ?? 0}
            </dd>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50/70 px-3 py-2">
            <dt className="text-xs font-medium text-neutral-500">Adapters</dt>
            <dd className="mt-0.5 font-semibold text-neutral-900">
              {workflow.allowed_runtime_adapter_ids?.length ?? 0}
            </dd>
          </div>
        </dl>
      </div>
    </>
  );
}
