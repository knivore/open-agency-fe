'use client';

import type { ExecutionHost } from '@/types/workflows';
import { Button } from '../library/shadcn/button';
import { Input } from '../library/shadcn/input';
import { Label } from '../library/shadcn/label';
import { Textarea } from '../library/shadcn/textarea';

interface RuntimeAdapterOption {
  id: string;
  name: string;
  adapter_type: string;
}

interface WorkflowMetadataEditorProps {
  name: string;
  description: string;
  entrypoint: string;
  executionHost: ExecutionHost;
  restartActiveExecutions: boolean;
  allowedRuntimeAdapterIds: string[];
  visibleTaskDefinitions: Array<{ id: string; name: string }>;
  runtimeAdapters: RuntimeAdapterOption[];
  workflowNameInvalid: boolean;
  workflowDescriptionInvalid: boolean;
  draftValidationIssues: string[];
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onEntrypointChange: (value: string) => void;
  onExecutionHostChange: (value: ExecutionHost) => void;
  onRestartActiveExecutionsChange: (checked: boolean) => void;
  onAllowedRuntimeAdapterToggle: (adapterId: string, checked: boolean) => void;
  onSave: () => void;
}

export default function WorkflowMetadataEditor({
  name,
  description,
  entrypoint,
  executionHost,
  restartActiveExecutions,
  allowedRuntimeAdapterIds,
  visibleTaskDefinitions,
  runtimeAdapters,
  workflowNameInvalid,
  workflowDescriptionInvalid,
  draftValidationIssues,
  hasUnsavedChanges,
  isSaving,
  onNameChange,
  onDescriptionChange,
  onEntrypointChange,
  onExecutionHostChange,
  onRestartActiveExecutionsChange,
  onAllowedRuntimeAdapterToggle,
  onSave,
}: WorkflowMetadataEditorProps) {
  return (
    <>
      <section className="space-y-4 rounded-md border border-neutral-200 bg-white p-4 md:col-span-2">
        <div className="space-y-2 md:col-span-2">
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
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="workflow-description">Description</Label>
          <Textarea
            id="workflow-description"
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            className={`min-h-28 ${workflowDescriptionInvalid ? 'border-red-500' : ''}`}
          />
          {workflowDescriptionInvalid ? (
            <p className="text-xs text-red-600">Workflow description is required.</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="workflow-entrypoint">Entrypoint</Label>
          <select
            id="workflow-entrypoint"
            value={entrypoint}
            onChange={(event) => onEntrypointChange(event.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Auto-select first root task</option>
            {visibleTaskDefinitions.map((task) => (
              <option key={task.id} value={task.id}>
                {task.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="workflow-execution-host">Default Execution Host</Label>
          <select
            id="workflow-execution-host"
            value={executionHost}
            onChange={(event) => onExecutionHostChange(event.target.value as ExecutionHost)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="local">Local backend process</option>
            <option value="docker">Docker container</option>
          </select>
          <p className="text-xs text-neutral-500">
            Docker starts an isolated container for each run when the backend Docker host is
            configured.
          </p>
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="flex items-start gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={restartActiveExecutions}
              onChange={(event) => onRestartActiveExecutionsChange(event.target.checked)}
            />
            <span>
              <span className="block font-medium text-neutral-900">Restart active runs</span>
              <span className="block text-xs text-neutral-500">
                Apply this workflow's publish or unpublish action to active executions.
              </span>
            </span>
          </label>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="workflow-allowed-runtimes">Allowed Runtime Adapters</Label>
          {runtimeAdapters.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No runtime adapters were returned by the backend.
            </p>
          ) : (
            <div id="workflow-allowed-runtimes" className="grid gap-2 md:grid-cols-2">
              {runtimeAdapters.map((adapter) => {
                const isChecked = allowedRuntimeAdapterIds.includes(adapter.id);

                return (
                  <label
                    key={adapter.id}
                    className="flex items-start gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(event) =>
                        onAllowedRuntimeAdapterToggle(adapter.id, event.target.checked)
                      }
                    />
                    <span>
                      <span className="block font-medium text-neutral-900">{adapter.name}</span>
                      <span className="block text-xs text-neutral-500">
                        {adapter.id} · {adapter.adapter_type}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          <p className="text-xs text-neutral-500">
            Select the adapters this workflow can run on. Native is used by default when selected.
          </p>
        </div>
        <div className="flex justify-end">
          <div className="flex gap-2">
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
