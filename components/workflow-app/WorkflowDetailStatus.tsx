'use client';

import { labelForEntrypointTask } from '@/components/workflow-app/useWorkflowEditorDraft';
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
  return (
    <>
      {isEditing ? (
        <Card className="border-amber-200 bg-amber-50/70">
          <CardContent className="pt-6 text-sm text-amber-900">
            The graph preview reflects unsaved changes. Save the workflow before running, publishing, or submitting it so those actions use the same definition shown here.
          </CardContent>
        </Card>
      ) : null}

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

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">Entrypoint: {labelForEntrypointTask(effectiveEntrypointTaskId, visibleTaskDefinitions)}</Badge>
        <Badge variant="outline">Runtime: {workflow.default_runtime_adapter_id || 'No default adapter'}</Badge>
        <Badge variant="outline">Host: {resolveWorkflowExecutionHost(workflow)}</Badge>
        <Badge variant="outline">Allowed adapters: {workflow.allowed_runtime_adapter_ids?.length ?? 0}</Badge>
        <Badge variant="outline">{visibleAgentCount} agents</Badge>
        <Badge variant="outline">{visibleTaskDefinitions.length} tasks</Badge>
        <Badge variant="outline">{workflow.nodes?.length ?? 0} nodes</Badge>
        <Badge variant="outline">{workflow.edges?.length ?? 0} edges</Badge>
        <Badge variant="secondary">Version {workflow.versioning?.version || '1.0.0'}</Badge>
        {workflow.versioning?.is_published ? <Badge>Published</Badge> : <Badge variant="outline">Draft</Badge>}
        {isEditing ? <Badge variant="secondary">{hasUnsavedChanges ? 'Unsaved draft changes' : 'Editing saved workflow'}</Badge> : null}
      </div>
    </>
  );
}
