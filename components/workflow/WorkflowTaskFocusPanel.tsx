'use client';

import type { AgentDefinition, BehaviorTuningProfile } from '@/types/agents';
import { toolsRecommendedForWorkflowCapabilities } from '@/lib/workflows/capabilityTooling';
import {
  type WorkflowTaskApprovalPolicy,
  workflowTaskApprovalPolicyOptions,
  workflowTaskRuntimeOverridePatch,
  type WorkflowTaskRuntimeOverrides,
  workflowTaskRuntimeOverridesFromTask,
} from '@/lib/workflows/taskRuntimeOverrides';
import {
  type WorkflowTaskInputSource,
  workflowTaskInputSourceOptions,
  workflowTaskInputSourcesFromMetadata,
  workflowTaskMetadataWithInputSources,
} from '@/lib/workflows/taskInputSources';
import type { ToolDefinition } from '@/types/tools';
import type {
  TaskDefinition,
  WorkflowCapabilityTag,
  WorkflowMemoryDefinition,
} from '@/types/workflows';
import { toolDisplayName } from '@/lib/tools/displayName';
import { Badge } from '../library/shadcn/badge';
import { Button } from '../library/shadcn/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../library/shadcn/card';
import { Checkbox } from '../library/shadcn/checkbox';
import { Input } from '../library/shadcn/input';
import { Label } from '../library/shadcn/label';
import { Textarea } from '../library/shadcn/textarea';
import WorkflowEdgeMetadataEditor from '@/components/workflow/WorkflowEdgeMetadataEditor';
import WorkflowMemorySelectionPanel from '@/components/workflow/WorkflowMemorySelectionPanel';
import { cn } from '@/lib/utils';
import React from 'react';

interface WorkflowTaskDependencyLink {
  task: TaskDefinition;
  edgeType: string;
  condition: string;
  conditionError?: string;
  metadataJson: string;
  metadataError?: string;
}

interface WorkflowTaskFocusPanelProps {
  surface?: 'builder' | 'graph';
  selectedTask: TaskDefinition;
  selectedAgent?: AgentDefinition | null;
  workflowCapabilityTags?: WorkflowCapabilityTag[];
  visibleAgentDefinitions?: AgentDefinition[];
  modelProfiles?: Pick<BehaviorTuningProfile, 'id' | 'name'>[];
  toolDefinitions?: ToolDefinition[];
  memoryDefinitions?: WorkflowMemoryDefinition[];
  dependencyLinks: WorkflowTaskDependencyLink[];
  dependentLinks: WorkflowTaskDependencyLink[];
  preferredDependencyTaskId?: string | null;
  preferredDependentTaskId?: string | null;
  previousTaskLabel?: string | null;
  nextTaskLabel?: string | null;
  isEditing: boolean;
  onClearSelection: () => void;
  onUpdateTask?: (updates: Partial<TaskDefinition>) => void;
  onDependencyEdgeTypeChange: (taskId: string, edgeType: string) => void;
  onDependencyConditionChange: (taskId: string, condition: string) => void;
  onDependencyMetadataChange: (taskId: string, metadataJson: string) => void;
  onDependentEdgeTypeChange: (taskId: string, edgeType: string) => void;
  onDependentConditionChange: (taskId: string, condition: string) => void;
  onDependentMetadataChange: (taskId: string, metadataJson: string) => void;
  onSelectDependencyTask: (taskId: string) => void;
  onSelectDependentTask: (taskId: string) => void;
  onSelectPreviousTask: () => void;
  onSelectNextTask: () => void;
}

function TaskDrawerSectionHeader({
  accentClassName,
  children,
  meta,
}: {
  accentClassName: string;
  children: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full shadow-sm', accentClassName)} />
        <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-neutral-600 dark:text-slate-300">
          {children}
        </p>
      </div>
      {meta ? <div className="shrink-0">{meta}</div> : null}
    </div>
  );
}

export default function WorkflowTaskFocusPanel({
  surface = 'graph',
  selectedTask,
  selectedAgent,
  workflowCapabilityTags = [],
  visibleAgentDefinitions = [],
  modelProfiles = [],
  toolDefinitions = [],
  memoryDefinitions = [],
  dependencyLinks,
  dependentLinks,
  preferredDependencyTaskId,
  preferredDependentTaskId,
  previousTaskLabel,
  nextTaskLabel,
  isEditing,
  onClearSelection,
  onUpdateTask,
  onDependencyEdgeTypeChange,
  onDependencyConditionChange,
  onDependencyMetadataChange,
  onDependentEdgeTypeChange,
  onDependentConditionChange,
  onDependentMetadataChange,
  onSelectDependencyTask,
  onSelectDependentTask,
  onSelectPreviousTask,
  onSelectNextTask,
}: WorkflowTaskFocusPanelProps) {
  const taskToolIds = selectedTask.tool_ids ?? [];
  const taskMemoryIds = selectedTask.memory_ids ?? [];
  const taskInputSources = workflowTaskInputSourcesFromMetadata(selectedTask.metadata);
  const taskRuntimeOverrides = workflowTaskRuntimeOverridesFromTask(selectedTask);
  const recommendedTools = toolsRecommendedForWorkflowCapabilities(
    toolDefinitions,
    workflowCapabilityTags
  );
  const recommendedToolIds = new Set(recommendedTools.map((tool) => tool.id));
  const otherTools = toolDefinitions.filter((tool) => !recommendedToolIds.has(tool.id));
  const showBuilderTaskFields = surface === 'builder';
  const editorFieldClassName =
    'workflow-drawer-input flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:border-amber-300/15 dark:bg-slate-950/78 dark:text-slate-100';

  const toggleTaskTool = (toolId: string) => {
    if (!onUpdateTask) {
      return;
    }

    onUpdateTask({
      tool_ids: taskToolIds.includes(toolId)
        ? taskToolIds.filter((candidateId) => candidateId !== toolId)
        : [...taskToolIds, toolId],
    });
  };
  const toggleTaskInputSource = (source: WorkflowTaskInputSource) => {
    if (!onUpdateTask) {
      return;
    }

    const nextSources = taskInputSources.includes(source)
      ? taskInputSources.filter((candidate) => candidate !== source)
      : [...taskInputSources, source];
    onUpdateTask({
      metadata: workflowTaskMetadataWithInputSources(selectedTask.metadata, nextSources),
    });
  };
  const updateTaskRuntimeOverrides = (
    updates: Partial<WorkflowTaskRuntimeOverrides>,
    taskUpdates: Partial<TaskDefinition> = {}
  ) => {
    if (!onUpdateTask) {
      return;
    }

    onUpdateTask({
      ...taskUpdates,
      ...workflowTaskRuntimeOverridePatch(selectedTask.metadata, {
        ...taskRuntimeOverrides,
        ...updates,
      }),
    });
  };
  const overrideCount = [
    taskRuntimeOverrides.timeout_seconds,
    taskRuntimeOverrides.max_retries,
    taskRuntimeOverrides.model_profile_id,
    taskRuntimeOverrides.max_tokens,
    taskRuntimeOverrides.approval_policy,
  ].filter((value) => value !== undefined && value !== '').length;
  const modelProfileLabel =
    modelProfiles.find((profile) => profile.id === taskRuntimeOverrides.model_profile_id)?.name ??
    taskRuntimeOverrides.model_profile_id;
  const approvalPolicyLabel =
    workflowTaskApprovalPolicyOptions.find(
      (option) => option.id === taskRuntimeOverrides.approval_policy
    )?.label ?? null;
  const dependencyCount = dependencyLinks.length;
  const dependentCount = dependentLinks.length;
  const selectedAgentLabel = selectedAgent?.name || 'Unassigned';
  const selectedAgentDescription =
    selectedAgent?.role || selectedAgent?.description || 'No agent role configured.';
  const showPanelHeader = surface === 'builder';

  return (
    <Card className="workflow-surface-task workflow-drawer-panel overflow-hidden border-amber-200/80 bg-white/95 shadow-sm shadow-amber-100/30 dark:shadow-none">
      {showPanelHeader ? (
        <CardHeader className="flex flex-col gap-3 space-y-0 border-b border-amber-100/80 bg-linear-to-r from-amber-50/90 via-white to-sky-50/50 dark:border-amber-300/10 dark:from-amber-500/10 dark:via-slate-950 dark:to-sky-500/10 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-neutral-950 dark:text-slate-50">Selected Task</CardTitle>
            <CardDescription className="text-neutral-600 dark:text-slate-300">
              Task details, dependencies, and linked agent.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClearSelection}>
            Clear Selection
          </Button>
        </CardHeader>
      ) : null}
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="workflow-drawer-fieldset workflow-drawer-section-agent rounded-xl border border-amber-200/60 bg-white/80 p-3 dark:border-amber-300/14">
            <TaskDrawerSectionHeader
              accentClassName={selectedAgent ? 'bg-sky-500' : 'bg-amber-500'}
              meta={<Badge variant="outline">{selectedAgent ? 'Assigned' : 'Missing'}</Badge>}
            >
              Assigned agent
            </TaskDrawerSectionHeader>
            <p className="mt-2 text-sm font-semibold text-neutral-900 dark:text-slate-100">
              {selectedAgentLabel}
            </p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500 dark:text-slate-400">
              {selectedAgentDescription}
            </p>
          </div>
          <div className="workflow-drawer-fieldset workflow-drawer-section-path rounded-xl border border-amber-200/60 bg-white/80 p-3 dark:border-amber-300/14">
            <TaskDrawerSectionHeader
              accentClassName="bg-emerald-500"
              meta={<Badge variant="outline">{dependencyCount + dependentCount} linked</Badge>}
            >
              Task path
            </TaskDrawerSectionHeader>
            <div className="mt-3 grid gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="grid min-h-14 max-w-full grid-cols-[6.75rem_minmax(0,1fr)] items-center gap-3 whitespace-normal rounded-lg border-emerald-200/80 bg-white/70 px-3 py-2 text-left text-emerald-950 enabled:cursor-pointer disabled:cursor-not-allowed hover:bg-emerald-50 dark:border-emerald-300/18 dark:bg-slate-950/45 dark:text-emerald-100 dark:hover:bg-emerald-500/10"
                onClick={onSelectPreviousTask}
                disabled={!previousTaskLabel}
              >
                <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] opacity-70">
                  Upstream
                </span>
                <span className="line-clamp-2 min-w-0 text-sm font-semibold leading-5">
                  {previousTaskLabel || 'No upstream task'}
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="grid min-h-14 max-w-full grid-cols-[6.75rem_minmax(0,1fr)] items-center gap-3 whitespace-normal rounded-lg border-emerald-200/80 bg-white/70 px-3 py-2 text-left text-emerald-950 enabled:cursor-pointer disabled:cursor-not-allowed hover:bg-emerald-50 dark:border-emerald-300/18 dark:bg-slate-950/45 dark:text-emerald-100 dark:hover:bg-emerald-500/10"
                onClick={onSelectNextTask}
                disabled={!nextTaskLabel}
              >
                <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] opacity-70">
                  Downstream
                </span>
                <span className="line-clamp-2 min-w-0 text-sm font-semibold leading-5">
                  {nextTaskLabel || 'No downstream task'}
                </span>
              </Button>
            </div>
          </div>
        </div>

        {isEditing && onUpdateTask ? (
          <div className="workflow-drawer-fieldset workflow-drawer-section-identity grid gap-3 rounded-xl border border-amber-200/70 bg-white/80 p-3 dark:border-amber-300/14 dark:bg-[linear-gradient(180deg,rgba(64,44,12,0.16),rgba(15,23,42,0.74))]">
            <div className="space-y-1.5">
              <Label htmlFor={`selected-task-name-${selectedTask.id}`}>Task name</Label>
              <Input
                id={`selected-task-name-${selectedTask.id}`}
                value={selectedTask.name}
                onChange={(event) => onUpdateTask({ name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`selected-task-description-${selectedTask.id}`}>Description</Label>
              <Textarea
                id={`selected-task-description-${selectedTask.id}`}
                value={selectedTask.description}
                className="min-h-20"
                onChange={(event) =>
                  onUpdateTask({
                    description: event.target.value,
                    ...(showBuilderTaskFields ? { instructions: event.target.value } : {}),
                  })
                }
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`selected-task-agent-${selectedTask.id}`}>Assigned agent</Label>
                <select
                  id={`selected-task-agent-${selectedTask.id}`}
                  value={selectedTask.agent_id ?? ''}
                  className={editorFieldClassName}
                  onChange={(event) => onUpdateTask({ agent_id: event.target.value || null })}
                >
                  <option value="">Unassigned</option>
                  {visibleAgentDefinitions.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </div>
              {showBuilderTaskFields ? (
                <div className="space-y-1.5">
                  <Label htmlFor={`selected-task-expected-output-${selectedTask.id}`}>
                    Expected output
                  </Label>
                  <Input
                    id={`selected-task-expected-output-${selectedTask.id}`}
                    value={selectedTask.expected_output ?? ''}
                    onChange={(event) => onUpdateTask({ expected_output: event.target.value })}
                  />
                </div>
              ) : null}
            </div>
            {showBuilderTaskFields ? (
              <div className="space-y-1.5">
                <Label htmlFor={`selected-task-instructions-${selectedTask.id}`}>
                  Instructions
                </Label>
                <Textarea
                  id={`selected-task-instructions-${selectedTask.id}`}
                  value={selectedTask.instructions ?? ''}
                  className="min-h-24"
                  onChange={(event) => onUpdateTask({ instructions: event.target.value })}
                />
              </div>
            ) : null}
            {showBuilderTaskFields ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
                    Tools
                  </Label>
                  <Badge variant="outline">
                    {taskToolIds.length}/{toolDefinitions.length} assigned
                  </Badge>
                </div>
                {toolDefinitions.length === 0 ? (
                  <p className="text-sm text-neutral-500 dark:text-slate-400">
                    No workflow tools available.
                  </p>
                ) : (
                  <div className="max-h-48 space-y-3 overflow-y-auto pr-1">
                    {recommendedTools.length > 0 ? (
                      <div className="space-y-2 rounded-md border border-sky-200/70 bg-sky-50/70 p-2 dark:border-sky-300/14 dark:bg-sky-500/10">
                        <p className="text-xs font-medium uppercase tracking-[0.12em] text-sky-700 dark:text-sky-200">
                          Recommended for this workflow
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {recommendedTools.map((tool) => {
                            const isAssigned = taskToolIds.includes(tool.id);
                            return (
                              <Button
                                key={tool.id}
                                type="button"
                                variant={isAssigned ? 'default' : 'outline'}
                                size="sm"
                                className="h-auto max-w-full justify-start whitespace-normal text-left"
                                onClick={() => toggleTaskTool(tool.id)}
                              >
                                {toolDisplayName(tool)}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    {otherTools.length > 0 ? (
                      <div className="space-y-2">
                        {recommendedTools.length > 0 ? (
                          <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
                            Other workflow tools
                          </p>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          {otherTools.map((tool) => {
                            const isAssigned = taskToolIds.includes(tool.id);
                            return (
                              <Button
                                key={tool.id}
                                type="button"
                                variant={isAssigned ? 'default' : 'outline'}
                                size="sm"
                                className="h-auto max-w-full justify-start whitespace-normal text-left"
                                onClick={() => toggleTaskTool(tool.id)}
                              >
                                {toolDisplayName(tool)}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}
            {showBuilderTaskFields ? (
              <WorkflowMemorySelectionPanel
                title="Memory List"
                description="Select memories this task can use during workflow execution."
                memories={memoryDefinitions}
                selectedMemoryIds={taskMemoryIds}
                isEditing={isEditing}
                onSelectedMemoryIdsChange={(memoryIds) => onUpdateTask({ memory_ids: memoryIds })}
              />
            ) : null}
            <div className="flex items-center gap-2">
              <Checkbox
                id={`selected-task-approval-${selectedTask.id}`}
                checked={selectedTask.human_approval_required === true}
                onCheckedChange={(checked) => {
                  const humanApprovalRequired = checked === true;
                  updateTaskRuntimeOverrides(
                    {
                      approval_policy: humanApprovalRequired ? 'required' : 'none',
                    },
                    { human_approval_required: humanApprovalRequired }
                  );
                }}
              />
              <Label
                htmlFor={`selected-task-approval-${selectedTask.id}`}
                className="text-sm text-neutral-700 dark:text-slate-300"
              >
                Human approval required
              </Label>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold text-neutral-900 dark:text-slate-100">
                {selectedTask.name}
              </p>
              {selectedTask.human_approval_required ? (
                <Badge variant="secondary">Approval</Badge>
              ) : null}
              {(selectedTask.depends_on_task_ids ?? []).length === 0 ? (
                <Badge variant="outline">Root</Badge>
              ) : null}
            </div>
            <p className="text-sm text-neutral-600 dark:text-slate-300">
              {selectedTask.description || 'No task description configured.'}
            </p>
          </div>
        )}

        {isEditing && onUpdateTask ? (
          <div className="workflow-drawer-fieldset workflow-drawer-section-inputs space-y-3 rounded-xl border border-amber-200/60 bg-white/80 p-3 dark:border-amber-300/14 dark:bg-slate-950/56">
            <TaskDrawerSectionHeader
              accentClassName="bg-teal-500"
              meta={<Badge variant="outline">{taskInputSources.length} selected</Badge>}
            >
              Task Inputs
            </TaskDrawerSectionHeader>
            <div className="grid gap-2 md:grid-cols-2">
              {workflowTaskInputSourceOptions.map((option) => (
                <label
                  key={option.id}
                  htmlFor={`selected-task-input-source-${selectedTask.id}-${option.id}`}
                  className="workflow-drawer-option flex min-h-24 cursor-pointer items-start gap-3 rounded-lg border border-amber-100 bg-amber-50/35 p-3 text-sm dark:border-amber-300/12 dark:bg-amber-500/8"
                >
                  <Checkbox
                    id={`selected-task-input-source-${selectedTask.id}-${option.id}`}
                    checked={taskInputSources.includes(option.id)}
                    className="cursor-pointer"
                    onCheckedChange={() => toggleTaskInputSource(option.id)}
                  />
                  <span className="space-y-0.5">
                    <span className="block font-medium text-neutral-800 dark:text-slate-100">
                      {option.label}
                    </span>
                    <span className="block text-xs text-neutral-500 dark:text-slate-400">
                      {option.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {isEditing && onUpdateTask ? (
          <div className="workflow-drawer-fieldset workflow-drawer-section-overrides space-y-3 rounded-xl border border-amber-200/60 bg-white/80 p-3 dark:border-amber-300/14 dark:bg-slate-950/56">
            <TaskDrawerSectionHeader
              accentClassName="bg-violet-500"
              meta={<Badge variant="outline">{overrideCount} configured</Badge>}
            >
              Task Overrides
            </TaskDrawerSectionHeader>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`selected-task-timeout-${selectedTask.id}`}>Timeout seconds</Label>
                <Input
                  id={`selected-task-timeout-${selectedTask.id}`}
                  type="number"
                  min={1}
                  value={taskRuntimeOverrides.timeout_seconds ?? ''}
                  onChange={(event) =>
                    updateTaskRuntimeOverrides({
                      timeout_seconds: event.target.value ? Number(event.target.value) : undefined,
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`selected-task-retries-${selectedTask.id}`}>Max retries</Label>
                <Input
                  id={`selected-task-retries-${selectedTask.id}`}
                  type="number"
                  min={0}
                  value={taskRuntimeOverrides.max_retries ?? ''}
                  onChange={(event) =>
                    updateTaskRuntimeOverrides({
                      max_retries: event.target.value ? Number(event.target.value) : undefined,
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`selected-task-model-profile-${selectedTask.id}`}>
                  Model profile override
                </Label>
                <select
                  id={`selected-task-model-profile-${selectedTask.id}`}
                  value={taskRuntimeOverrides.model_profile_id ?? ''}
                  className={editorFieldClassName}
                  onChange={(event) =>
                    updateTaskRuntimeOverrides({
                      model_profile_id: event.target.value || undefined,
                    })
                  }
                >
                  <option value="">Inherit assigned agent</option>
                  {modelProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`selected-task-max-tokens-${selectedTask.id}`}>Max tokens</Label>
                <Input
                  id={`selected-task-max-tokens-${selectedTask.id}`}
                  type="number"
                  min={1}
                  value={taskRuntimeOverrides.max_tokens ?? ''}
                  onChange={(event) =>
                    updateTaskRuntimeOverrides({
                      max_tokens: event.target.value ? Number(event.target.value) : undefined,
                    })
                  }
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor={`selected-task-approval-policy-${selectedTask.id}`}>
                  Approval policy override
                </Label>
                <select
                  id={`selected-task-approval-policy-${selectedTask.id}`}
                  value={taskRuntimeOverrides.approval_policy ?? 'inherit'}
                  className={editorFieldClassName}
                  onChange={(event) => {
                    const approvalPolicy = event.target.value as WorkflowTaskApprovalPolicy;
                    updateTaskRuntimeOverrides(
                      {
                        approval_policy: approvalPolicy === 'inherit' ? undefined : approvalPolicy,
                      },
                      approvalPolicy === 'required'
                        ? { human_approval_required: true }
                        : approvalPolicy === 'none'
                          ? { human_approval_required: false }
                          : {}
                    );
                  }}
                >
                  {workflowTaskApprovalPolicyOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ) : null}

        {showBuilderTaskFields ? (
          <div className="workflow-drawer-fieldset workflow-drawer-section-output space-y-2 rounded-xl border border-amber-200/60 bg-white/80 p-3 dark:border-amber-300/14">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500 dark:text-amber-200">
              Expected Output
            </p>
            <p className="text-sm text-neutral-900 dark:text-slate-100">
              {selectedTask.expected_output || 'No expected output defined.'}
            </p>
          </div>
        ) : null}

        {showBuilderTaskFields ? (
          <div className="workflow-drawer-fieldset workflow-drawer-section-output space-y-2 rounded-xl border border-amber-200/60 bg-white/80 p-3 dark:border-amber-300/14">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500 dark:text-amber-200">
              Instructions
            </p>
            <p className="text-sm text-neutral-700 dark:text-slate-300">
              {selectedTask.instructions || 'No task instructions configured.'}
            </p>
          </div>
        ) : null}

        {showBuilderTaskFields && (!isEditing || !onUpdateTask) ? (
          <WorkflowMemorySelectionPanel
            title="Memory List"
            description="Memories available to this task during workflow execution."
            memories={memoryDefinitions}
            selectedMemoryIds={taskMemoryIds}
            isEditing={false}
          />
        ) : null}

        {!isEditing || !onUpdateTask ? (
          <div className="workflow-drawer-fieldset workflow-drawer-section-inputs space-y-2 rounded-xl border border-amber-200/60 bg-amber-50/35 p-3 dark:border-amber-300/14 dark:bg-amber-500/8">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500 dark:text-amber-200">
                Task Inputs
              </p>
              <Badge variant="outline">{taskInputSources.length} selected</Badge>
            </div>
            {taskInputSources.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-slate-400">
                No structured task inputs declared.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {workflowTaskInputSourceOptions
                  .filter((option) => taskInputSources.includes(option.id))
                  .map((option) => (
                    <Badge key={option.id} variant="secondary">
                      {option.label}
                    </Badge>
                  ))}
              </div>
            )}
          </div>
        ) : null}

        {!isEditing || !onUpdateTask ? (
          <div className="workflow-drawer-fieldset workflow-drawer-section-overrides space-y-2 rounded-xl border border-amber-200/60 bg-amber-50/35 p-3 dark:border-amber-300/14 dark:bg-amber-500/8">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500 dark:text-amber-200">
                Task Overrides
              </p>
              <Badge variant="outline">{overrideCount} configured</Badge>
            </div>
            {overrideCount === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-slate-400">
                No task-level runtime overrides configured.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {taskRuntimeOverrides.timeout_seconds ? (
                  <Badge variant="secondary">Timeout {taskRuntimeOverrides.timeout_seconds}s</Badge>
                ) : null}
                {taskRuntimeOverrides.max_retries !== undefined ? (
                  <Badge variant="secondary">Retries {taskRuntimeOverrides.max_retries}</Badge>
                ) : null}
                {modelProfileLabel ? (
                  <Badge variant="secondary">Model {modelProfileLabel}</Badge>
                ) : null}
                {taskRuntimeOverrides.max_tokens ? (
                  <Badge variant="secondary">Max tokens {taskRuntimeOverrides.max_tokens}</Badge>
                ) : null}
                {approvalPolicyLabel ? (
                  <Badge variant="secondary">Approval {approvalPolicyLabel}</Badge>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        <div className="grid gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500 dark:text-amber-200">
              Depends On
            </p>
            {preferredDependencyTaskId ? (
              <p className="text-xs text-neutral-500 dark:text-slate-400">
                Filled button = preferred upstream path for `Previous`.
              </p>
            ) : null}
            {dependencyLinks.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-slate-400">No dependencies.</p>
            ) : (
              <div className="space-y-2">
                {dependencyLinks.map(
                  ({ task, edgeType, condition, conditionError, metadataJson, metadataError }) => (
                    <div
                      key={task.id}
                      className="workflow-drawer-fieldset workflow-drawer-section-dependency rounded-xl border border-amber-200/70 bg-amber-50/45 p-3 dark:border-amber-300/14 dark:bg-[linear-gradient(180deg,rgba(64,44,12,0.12),rgba(15,23,42,0.62))]"
                    >
                      <Button
                        type="button"
                        variant={task.id === preferredDependencyTaskId ? 'default' : 'outline'}
                        size="sm"
                        className="h-auto max-w-full justify-start whitespace-normal text-left"
                        onClick={() => onSelectDependencyTask(task.id)}
                      >
                        {task.id === preferredDependencyTaskId
                          ? `Preferred: ${task.name}`
                          : task.name}
                      </Button>
                      {isEditing ? (
                        <div className="mt-2 space-y-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Edge Type</Label>
                            <select
                              value={edgeType}
                              onChange={(event) =>
                                onDependencyEdgeTypeChange(task.id, event.target.value)
                              }
                              className={editorFieldClassName}
                            >
                              <option value="default">default</option>
                              <option value="conditional">conditional</option>
                              <option value="success">success</option>
                              <option value="failure">failure</option>
                            </select>
                            <p className="text-xs text-neutral-500 dark:text-slate-400">
                              `conditional` requires a condition. `success` and `failure` are
                              descriptive labels only.
                            </p>
                          </div>
                          <Input
                            value={condition}
                            onChange={(event) =>
                              onDependencyConditionChange(task.id, event.target.value)
                            }
                            placeholder="Edge condition"
                            className={conditionError ? 'border-red-500' : ''}
                          />
                          {conditionError ? (
                            <p className="text-xs text-red-600">Condition {conditionError}</p>
                          ) : null}
                          <WorkflowEdgeMetadataEditor
                            idPrefix={`dependency-edge-${task.id}`}
                            metadataJson={metadataJson}
                            metadataError={metadataError}
                            onChange={(nextMetadataJson) =>
                              onDependencyMetadataChange(task.id, nextMetadataJson)
                            }
                          />
                        </div>
                      ) : (
                        <div className="mt-2 space-y-1 text-xs text-neutral-500 dark:text-slate-400">
                          <p>Type: {edgeType}</p>
                          {condition ? <p>Condition: {condition}</p> : null}
                          {metadataJson ? <p>Metadata: {metadataJson}</p> : null}
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500 dark:text-amber-200">
              Required By
            </p>
            {preferredDependentTaskId ? (
              <p className="text-xs text-neutral-500 dark:text-slate-400">
                Filled button = preferred downstream path for `Next`.
              </p>
            ) : null}
            {dependentLinks.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-slate-400">No downstream tasks.</p>
            ) : (
              <div className="space-y-2">
                {dependentLinks.map(
                  ({ task, edgeType, condition, conditionError, metadataJson, metadataError }) => (
                    <div
                      key={task.id}
                      className="workflow-drawer-fieldset workflow-drawer-section-dependency rounded-xl border border-amber-200/70 bg-amber-50/45 p-3 dark:border-amber-300/14 dark:bg-[linear-gradient(180deg,rgba(64,44,12,0.12),rgba(15,23,42,0.62))]"
                    >
                      <Button
                        type="button"
                        variant={task.id === preferredDependentTaskId ? 'default' : 'outline'}
                        size="sm"
                        className="h-auto max-w-full justify-start whitespace-normal text-left"
                        onClick={() => onSelectDependentTask(task.id)}
                      >
                        {task.id === preferredDependentTaskId
                          ? `Preferred: ${task.name}`
                          : task.name}
                      </Button>
                      {isEditing ? (
                        <div className="mt-2 space-y-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Edge Type</Label>
                            <select
                              value={edgeType}
                              onChange={(event) =>
                                onDependentEdgeTypeChange(task.id, event.target.value)
                              }
                              className={editorFieldClassName}
                            >
                              <option value="default">default</option>
                              <option value="conditional">conditional</option>
                              <option value="success">success</option>
                              <option value="failure">failure</option>
                            </select>
                            <p className="text-xs text-neutral-500 dark:text-slate-400">
                              `conditional` requires a condition. `success` and `failure` are
                              descriptive labels only.
                            </p>
                          </div>
                          <Input
                            value={condition}
                            onChange={(event) =>
                              onDependentConditionChange(task.id, event.target.value)
                            }
                            placeholder="Edge condition"
                            className={conditionError ? 'border-red-500' : ''}
                          />
                          {conditionError ? (
                            <p className="text-xs text-red-600">Condition {conditionError}</p>
                          ) : null}
                          <WorkflowEdgeMetadataEditor
                            idPrefix={`dependent-edge-${task.id}`}
                            metadataJson={metadataJson}
                            metadataError={metadataError}
                            onChange={(nextMetadataJson) =>
                              onDependentMetadataChange(task.id, nextMetadataJson)
                            }
                          />
                        </div>
                      ) : (
                        <div className="mt-2 space-y-1 text-xs text-neutral-500 dark:text-slate-400">
                          <p>Type: {edgeType}</p>
                          {condition ? <p>Condition: {condition}</p> : null}
                          {metadataJson ? <p>Metadata: {metadataJson}</p> : null}
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
