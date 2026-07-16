'use client';

import type { ExecutionHost } from '@/types/workflows';
import type { WorkflowCapabilityTag } from '@/types/workflows';
import type { JsonObject } from '@/types/api';
import { FileText } from 'lucide-react';
import { Button } from '../library/shadcn/button';
import { Input } from '../library/shadcn/input';
import { Label } from '../library/shadcn/label';
import { Textarea } from '../library/shadcn/textarea';
import WorkflowPersistentCycleEditor from '@/components/workflow/WorkflowPersistentCycleEditor';

interface RuntimeAdapterOption {
  id: string;
  name: string;
  adapter_type: string;
}

interface WorkflowMetadataEditorProps {
  name: string;
  description: string;
  entrypoint: string;
  defaultRuntimeAdapterId: string;
  executionHost: ExecutionHost;
  restartActiveExecutions: boolean;
  workflowMetadata: JsonObject;
  workflowCapabilityTags: WorkflowCapabilityTag[];
  visibleTaskDefinitions: Array<{ id: string; name: string }>;
  runtimeAdapters: RuntimeAdapterOption[];
  workflowNameInvalid: boolean;
  workflowDescriptionInvalid: boolean;
  draftValidationIssues: string[];
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  autoSaveStatus?: 'idle' | 'saving' | 'saved' | 'blocked' | 'error';
  lastAutoSavedAt?: Date | null;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onEntrypointChange: (value: string) => void;
  onDefaultRuntimeAdapterChange: (value: string) => void;
  onExecutionHostChange: (value: ExecutionHost) => void;
  onRestartActiveExecutionsChange: (checked: boolean) => void;
  onWorkflowMetadataChange: (metadata: JsonObject) => void;
  onWorkflowCapabilityTagsChange: (value: WorkflowCapabilityTag[]) => void;
  onSave: () => void;
}

export default function WorkflowMetadataEditor({
  name,
  description,
  entrypoint,
  defaultRuntimeAdapterId,
  executionHost,
  restartActiveExecutions,
  workflowMetadata,
  visibleTaskDefinitions,
  runtimeAdapters,
  workflowNameInvalid,
  workflowDescriptionInvalid,
  draftValidationIssues,
  hasUnsavedChanges,
  isSaving,
  autoSaveStatus = 'idle',
  lastAutoSavedAt,
  onNameChange,
  onDescriptionChange,
  onEntrypointChange,
  onDefaultRuntimeAdapterChange,
  onExecutionHostChange,
  onRestartActiveExecutionsChange,
  onWorkflowMetadataChange,
  onSave,
}: WorkflowMetadataEditorProps) {
  const activeRunsBehaviorDescription = restartActiveExecutions
    ? 'Running executions restart after this workflow is saved.'
    : 'Running executions continue unchanged. Future runs use the saved workflow.';
  const autoSaveLabel = (() => {
    if (autoSaveStatus === 'saving') {
      return 'Autosaving...';
    }
    if (autoSaveStatus === 'blocked') {
      return 'Autosave paused until validation issues are fixed.';
    }
    if (autoSaveStatus === 'error') {
      return 'Autosave failed. Save Changes will retry.';
    }
    if (autoSaveStatus === 'saved') {
      return lastAutoSavedAt
        ? `Autosaved at ${lastAutoSavedAt.toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
          })}`
        : 'All changes saved.';
    }
    return hasUnsavedChanges ? 'Autosave pending...' : 'All changes saved.';
  })();

  return (
    <>
      <section className="workflow-surface-metadata grid gap-4 rounded-xl border border-neutral-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-12">
        <div className="flex items-start gap-3 border-b border-neutral-200 pb-4 dark:border-white/10 md:col-span-2 xl:col-span-12">
          <span className="workflow-metadata-icon flex size-9 shrink-0 items-center justify-center rounded-lg border">
            <FileText className="size-[1.05rem] stroke-[1.75]" />
          </span>
          <div>
            <h2 className="font-semibold text-neutral-950 dark:text-slate-100">
              Workflow metadata
            </h2>
            <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-slate-300">
              Give the workflow a clear purpose, choose where it runs, and control how saved changes
              affect active executions.
            </p>
          </div>
        </div>
        <div className="space-y-2 md:col-span-2 xl:col-span-6">
          <Label htmlFor="workflow-name">Name</Label>
          <Input
            id="workflow-name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            className={workflowNameInvalid ? 'border-red-500' : ''}
          />
          {workflowNameInvalid ? (
            <p className="text-xs text-red-600">Workflow name is required.</p>
          ) : null}
        </div>
        <div className="space-y-2 md:col-span-2 xl:col-span-6">
          <Label htmlFor="workflow-entrypoint">Entrypoint</Label>
          <select
            id="workflow-entrypoint"
            value={entrypoint}
            onChange={(event) => onEntrypointChange(event.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Auto-select first root task</option>
            {visibleTaskDefinitions.map((task) => (
              <option key={task.id} value={task.id}>
                {task.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 md:col-span-2 xl:col-span-7">
          <Label htmlFor="workflow-description">Description</Label>
          <Textarea
            id="workflow-description"
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            className={`min-h-24 ${workflowDescriptionInvalid ? 'border-red-500' : ''}`}
          />
          {workflowDescriptionInvalid ? (
            <p className="text-xs text-red-600">Workflow description is required.</p>
          ) : null}
        </div>
        <div className="space-y-2 xl:col-span-5">
          <Label htmlFor="workflow-default-runtime-adapter">Runtime adapter</Label>
          <select
            id="workflow-default-runtime-adapter"
            value={defaultRuntimeAdapterId}
            onChange={(event) => onDefaultRuntimeAdapterChange(event.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">No default adapter</option>
            {runtimeAdapters.map((adapter) => (
              <option key={adapter.id} value={adapter.id}>
                {adapter.name} ({adapter.id})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 xl:col-span-4">
          <Label htmlFor="workflow-execution-host">Execution host</Label>
          <select
            id="workflow-execution-host"
            value={executionHost}
            onChange={(event) => onExecutionHostChange(event.target.value as ExecutionHost)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="local">Local backend process</option>
            <option value="docker">Docker container</option>
          </select>
          <p className="text-xs text-neutral-500 dark:text-slate-400">
            Docker starts an isolated container for each run when the backend Docker host is
            configured.
          </p>
        </div>
        <div className="space-y-2 xl:col-span-8">
          <Label htmlFor="workflow-active-run-behavior">Active run behavior</Label>
          <select
            id="workflow-active-run-behavior"
            value={restartActiveExecutions ? 'restart' : 'keep'}
            onChange={(event) => onRestartActiveExecutionsChange(event.target.value === 'restart')}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="keep">Active runs stay current</option>
            <option value="restart">Active runs restart</option>
          </select>
          <p className="text-xs text-neutral-500 dark:text-slate-400">
            {activeRunsBehaviorDescription}
          </p>
        </div>
        <WorkflowPersistentCycleEditor
          metadata={workflowMetadata}
          onMetadataChange={onWorkflowMetadataChange}
        />
        <div className="flex flex-col gap-3 border-t border-neutral-200 pt-3 dark:border-white/10 md:col-span-2 xl:col-span-12 sm:flex-row sm:items-center sm:justify-between">
          <p
            className={`text-xs ${
              autoSaveStatus === 'error' || autoSaveStatus === 'blocked'
                ? 'text-amber-700 dark:text-amber-200'
                : 'text-neutral-500 dark:text-slate-400'
            }`}
          >
            {autoSaveLabel}
          </p>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              onClick={onSave}
              disabled={
                isSaving || !name.trim() || draftValidationIssues.length > 0 || !hasUnsavedChanges
              }
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
