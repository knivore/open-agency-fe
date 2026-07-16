'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRegisterAssistantPageContext } from '@/components/assistant/AssistantPageContext';
import { behaviorProfilesApi } from '@/lib/api/backend/behaviorProfiles';
import { runtimeAdaptersApi } from '@/lib/api/backend/runtimeAdapters';
import { runsApi } from '@/lib/api/backend/runs';
import { schedulesApi } from '@/lib/api/backend/schedules';
import { toolsApi } from '@/lib/api/backend/tools';
import { workflowsApi } from '@/lib/api/backend/workflows';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { requestAssistantOpen } from '@/lib/assistant/events';
import {
  createWorkflowDefinitionFromExportPackage,
  parseWorkflowExportPackageJson,
  type WorkflowExportPackage,
} from '@/lib/workflows/workflowExport';
import { workflowAssignedToolIds } from '@/lib/workflows/workflowToolCounts';
import type { RuntimeAdapterDefinition } from '@/types/runtime';
import type { AgentRun } from '@/types/runtime';
import type { BehaviorTuningProfile } from '@/types/agents';
import type { ToolDefinition } from '@/types/tools';
import { Badge } from '../library/shadcn/badge';
import { Button } from '../library/shadcn/button';
import { DialogClose } from '../library/shadcn/dialog';
import { Input } from '../library/shadcn/input';
import { Textarea } from '../library/shadcn/textarea';
import {
  ChevronRight,
  CheckCircle2,
  CircleAlert,
  CircleHelp,
  CircleUserRound,
  ListChecks,
  Plus,
  RefreshCw,
  Search,
  Upload,
  Workflow,
  Wrench,
} from 'lucide-react';
import { EmptyCard, ErrorAlert, LoadingCard } from '@/components/agent-app/StatePanels';
import PageHeader from '@/components/app-shell/PageHeader';
import { AppDialog } from '@/components/app-shell/AppOverlay';
import { FieldFeedback, FormField, FormSection } from '@/components/app-shell/FormSection';
import type { ScheduleDefinition } from '@/types/runtime';
import { toast } from 'sonner';
import WorkflowListActions from '@/components/workflow/WorkflowListActions';
import { formatRunDateTime } from '@/lib/workflows/runFormatting';

type CreateWorkflowFormState = {
  name: string;
  description: string;
  runtimeAdapterId: string;
};

type ImportMappings = {
  modelProfileMappings: Record<string, string>;
  toolMappings: Record<string, string>;
};

function preferredRuntimeAdapterId(adapters: RuntimeAdapterDefinition[]) {
  return adapters.find((adapter) => adapter.id === 'native')?.id ?? adapters[0]?.id ?? '';
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatScheduleDateTime(value?: string | null) {
  if (!value) {
    return 'No upcoming run scheduled.';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function runTimestamp(run: AgentRun) {
  return run.completedAt ?? run.updatedAt ?? run.startedAt ?? run.createdAt ?? null;
}

function runTimestampMs(run: AgentRun) {
  const value = runTimestamp(run);
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatRunDuration(run: AgentRun) {
  const startValue = run.startedAt ?? run.createdAt;
  const endValue = run.completedAt ?? run.updatedAt;
  if (!startValue || !endValue) {
    return null;
  }

  const durationMs = new Date(endValue).getTime() - new Date(startValue).getTime();
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return null;
  }

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function summarizeLastRun(run: AgentRun | undefined, isLoading: boolean, isError: boolean) {
  if (isError) {
    return {
      label: 'Unavailable',
      detail: 'Run history could not be loaded.',
      duration: null,
      tone: 'error' as const,
    };
  }

  if (isLoading) {
    return {
      label: 'Loading',
      detail: 'Checking recent runs…',
      duration: null,
      tone: 'loading' as const,
    };
  }

  if (!run) {
    return {
      label: 'Not run yet',
      detail: 'No execution history',
      duration: null,
      tone: 'neutral' as const,
    };
  }

  const labels: Partial<Record<AgentRun['status'], string>> = {
    completed: 'Success',
    failed: 'Failed',
    cancelled: 'Cancelled',
    running: 'Running',
    queued: 'Queued',
    created: 'Created',
    paused: 'Paused',
    waiting_for_approval: 'Needs approval',
    cancelling: 'Cancelling',
    unknown: 'Unknown',
  };
  const detail = formatRunDateTime(runTimestamp(run)) ?? 'Time unavailable';
  const tone =
    run.status === 'completed'
      ? ('success' as const)
      : run.status === 'failed' || run.status === 'cancelled'
        ? ('error' as const)
        : run.status === 'running' || run.status === 'queued' || run.status === 'created'
          ? ('loading' as const)
          : run.status === 'waiting_for_approval' || run.status === 'paused'
            ? ('warning' as const)
            : ('neutral' as const);

  return {
    label: labels[run.status] ?? 'Unknown',
    detail,
    duration: formatRunDuration(run),
    tone,
  };
}

function summarizeWorkflowSchedule(
  schedules: ScheduleDefinition[] | undefined,
  isLoading: boolean,
  isError: boolean
) {
  if (isError) {
    return {
      label: 'Schedule status unavailable',
      detail: 'Unable to load schedule data for this workflow.',
      tone: 'error' as const,
    };
  }

  if (isLoading) {
    return {
      label: 'Loading schedule status...',
      detail: 'Checking upcoming runs for this workflow.',
      tone: 'loading' as const,
    };
  }

  const workflowSchedules = schedules ?? [];
  const enabledSchedules = workflowSchedules.filter((schedule) => schedule.enabled !== false);
  const nextFireAt = enabledSchedules
    .map((schedule) => schedule.next_fire_at)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0];

  if (workflowSchedules.length === 0) {
    return {
      label: 'No schedule',
      detail: 'On demand',
      tone: 'neutral' as const,
    };
  }

  if (enabledSchedules.length === 0) {
    return {
      label: 'Disabled',
      detail: 'Paused',
      tone: 'paused' as const,
    };
  }

  if (nextFireAt) {
    return {
      label: enabledSchedules.length > 1 ? 'Upcoming run' : 'Next run',
      detail: formatScheduleDateTime(nextFireAt),
      tone: 'scheduled' as const,
    };
  }

  return {
    label: 'Enabled',
    detail: `${formatCount(enabledSchedules.length, 'active schedule')} with no next run set.`,
    tone: 'scheduled' as const,
  };
}

function toCreateWorkflowPayload(form: CreateWorkflowFormState) {
  const runtimeAdapterIds = form.runtimeAdapterId ? [form.runtimeAdapterId] : [];

  return {
    id: `workflow-${crypto.randomUUID()}`,
    name: form.name.trim(),
    description: form.description.trim() || null,
    nodes: [],
    edges: [],
    entrypoint: '',
    agent_definitions: [],
    task_definitions: [],
    tool_definitions: [],
    allowed_runtime_adapter_ids: runtimeAdapterIds,
    default_runtime_adapter_id: form.runtimeAdapterId || null,
    versioning: {
      version: '1.0.0',
      revision: 1,
      labels: ['draft'],
    },
    metadata: {
      inputs: [],
      process: 'sequential',
      created_from: 'workflow-list-workspace',
    },
  };
}

function CreateWorkflowDialog({
  adapters,
  onCreated,
}: {
  adapters: RuntimeAdapterDefinition[];
  onCreated: (workflowId: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const [form, setForm] = useState<CreateWorkflowFormState>({
    name: '',
    description: '',
    runtimeAdapterId: preferredRuntimeAdapterId(adapters),
  });

  const createMutation = useMutation({
    mutationFn: () => workflowsApi.createWorkflow(toCreateWorkflowPayload(form)),
    onSuccess: async (workflow) => {
      const createdWorkflow =
        workflow && typeof workflow === 'object' && !Array.isArray(workflow)
          ? (workflow as Record<string, unknown>)
          : null;
      if (!createdWorkflow || typeof createdWorkflow.id !== 'string') {
        throw new Error('Workflow create response did not include an ID.');
      }
      setIsOpen(false);
      setForm({
        name: '',
        description: '',
        runtimeAdapterId: preferredRuntimeAdapterId(adapters),
      });
      await onCreated(createdWorkflow.id);
    },
  });
  const defaultRuntimeAdapterId = preferredRuntimeAdapterId(adapters);
  const formIsDirty =
    form.name.length > 0 ||
    form.description.length > 0 ||
    form.runtimeAdapterId !== defaultRuntimeAdapterId;
  const nameError = nameTouched && !form.name.trim() ? 'Enter a workflow name.' : null;

  return (
    <>
      <Button type="button" variant="brand" onClick={() => setIsOpen(true)}>
        <Plus data-icon="inline-start" />
        Create workflow
      </Button>
      <AppDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        dirty={formIsDirty}
        busy={createMutation.isPending}
        onDiscard={() => {
          setNameTouched(false);
          setForm({
            name: '',
            description: '',
            runtimeAdapterId: defaultRuntimeAdapterId,
          });
        }}
        size="md"
        title="Create workflow"
        description="Give the workflow a clear name. Keep the Native runtime unless you already know that you need a different execution environment."
        footer={
          <>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={createMutation.isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              disabled={createMutation.isPending || !form.name.trim()}
              onClick={() => {
                setNameTouched(true);
                if (!form.name.trim()) return;
                void toast.promise(createMutation.mutateAsync(), {
                  loading: 'Creating workflow...',
                  success: 'Workflow created.',
                  error: (error) =>
                    error instanceof Error ? error.message : 'Failed to create workflow.',
                  position: 'top-right',
                });
              }}
            >
              {createMutation.isPending ? 'Creating...' : 'Create workflow'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <FormSection
            title="Workflow basics"
            description="Use a name and description that make the workflow easy to identify later."
          >
            <div className="flex flex-col gap-4">
              <FormField
                label="Name"
                htmlFor="new-workflow-name"
                description="Shown in the workflow list and run history."
                error={nameError}
                required
              >
                <Input
                  id="new-workflow-name"
                  required
                  value={form.name}
                  aria-invalid={Boolean(nameError)}
                  aria-describedby="new-workflow-name-feedback"
                  onBlur={() => setNameTouched(true)}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  disabled={createMutation.isPending}
                />
              </FormField>
              <FormField
                label="Description"
                htmlFor="new-workflow-description"
                description="Describe the result this workflow should produce."
                optional
              >
                <Textarea
                  id="new-workflow-description"
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                  disabled={createMutation.isPending}
                  className="min-h-28"
                  aria-describedby="new-workflow-description-feedback"
                />
              </FormField>
            </div>
          </FormSection>
          <FormSection
            title="Runtime settings"
            description="Most local workflows should use the Native runtime."
            advanced
          >
            <FormField
              label="Runtime adapter"
              htmlFor="new-workflow-runtime"
              description="Choose Native unless this workflow requires another execution adapter."
              optional
            >
              <select
                id="new-workflow-runtime"
                value={form.runtimeAdapterId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, runtimeAdapterId: event.target.value }))
                }
                disabled={createMutation.isPending || adapters.length === 0}
                aria-describedby="new-workflow-runtime-feedback"
                className="flex h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm shadow-sm shadow-primary/5 transition-colors hover:border-primary-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">No default adapter</option>
                {adapters.map((adapter) => (
                  <option key={adapter.id} value={adapter.id}>
                    {adapter.name} ({adapter.id})
                  </option>
                ))}
              </select>
            </FormField>
          </FormSection>
          {createMutation.isError ? (
            <FieldFeedback
              error={
                createMutation.error instanceof Error
                  ? createMutation.error.message
                  : 'Failed to create workflow.'
              }
            />
          ) : null}
        </div>
      </AppDialog>
    </>
  );
}

function importedWorkflowPayload(
  pkg: WorkflowExportPackage,
  profiles: BehaviorTuningProfile[],
  tools: ToolDefinition[],
  mappings: ImportMappings
) {
  const importedAt = new Date().toISOString();
  const report = buildImportReport(pkg, profiles, tools, mappings);
  const workflow = createWorkflowDefinitionFromExportPackage(pkg, {
    importedWorkflowId: `workflow-${crypto.randomUUID()}`,
    availableModelProfiles: profiles,
    availableTools: tools,
    modelProfileMappings: mappings.modelProfileMappings,
    toolMappings: mappings.toolMappings,
  });

  return {
    ...workflow,
    versioning: {
      ...(workflow.versioning ?? { version: '1.0.0', revision: 1 }),
      labels: Array.from(new Set([...(workflow.versioning?.labels ?? []), 'draft', 'imported'])),
    },
    metadata: {
      ...(workflow.metadata ?? {}),
      imported_at: importedAt,
      imported_from_workflow_id: pkg.workflow.id,
      imported_schema_version: pkg.schemaVersion,
      workflow_import_report: {
        ...report,
        imported_at: importedAt,
      },
    },
  };
}

function buildImportReport(
  pkg: WorkflowExportPackage,
  profiles: BehaviorTuningProfile[],
  tools: ToolDefinition[],
  mappings: ImportMappings
) {
  const localProfileIds = new Set(profiles.map((profile) => profile.id));
  const localToolIds = new Set(tools.map((tool) => tool.id));
  const missingModelProfileIds = pkg.dependencies.modelProfiles
    .map((profile) => profile.id)
    .filter(
      (profileId) =>
        !localProfileIds.has(profileId) &&
        !(
          mappings.modelProfileMappings[profileId] &&
          localProfileIds.has(mappings.modelProfileMappings[profileId])
        )
    );
  const mappedModelProfiles = Object.fromEntries(
    Object.entries(mappings.modelProfileMappings).filter(([, mappedProfileId]) =>
      localProfileIds.has(mappedProfileId)
    )
  );
  const bundledToolIds = pkg.dependencies.tools
    .filter((tool) => tool.implementation)
    .map((tool) => tool.id);
  const skippedToolIds = pkg.dependencies.tools
    .filter(
      (tool) =>
        !tool.implementation &&
        !localToolIds.has(tool.id) &&
        !(mappings.toolMappings[tool.id] && localToolIds.has(mappings.toolMappings[tool.id]))
    )
    .map((tool) => tool.id);
  const mappedTools = Object.fromEntries(
    Object.entries(mappings.toolMappings).filter(([, mappedToolId]) =>
      localToolIds.has(mappedToolId)
    )
  );
  const messages = [
    ...missingModelProfileIds.map(
      (profileId) =>
        `Model profile "${profileId}" was not found and must be selected before running affected agents.`
    ),
    ...skippedToolIds.map(
      (toolId) => `Tool "${toolId}" was not found and was skipped during import.`
    ),
    ...Object.entries(mappedModelProfiles).map(
      ([sourceId, targetId]) => `Model profile "${sourceId}" was mapped to "${targetId}".`
    ),
    ...Object.entries(mappedTools).map(
      ([sourceId, targetId]) => `Tool "${sourceId}" was mapped to "${targetId}".`
    ),
    ...bundledToolIds.map((toolId) => `Custom tool "${toolId}" was imported from the package.`),
  ];

  return {
    action_required: missingModelProfileIds.length > 0 || skippedToolIds.length > 0,
    messages,
    missing_model_profile_ids: missingModelProfileIds,
    skipped_tool_ids: skippedToolIds,
    mapped_model_profiles: mappedModelProfiles,
    mapped_tools: mappedTools,
    bundled_tool_ids: bundledToolIds,
  };
}

function ImportWorkflowDialog({
  profiles,
  tools,
  onImported,
}: {
  profiles: BehaviorTuningProfile[];
  tools: ToolDefinition[];
  onImported: (workflowId: string) => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<WorkflowExportPackage | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [mappings, setMappings] = useState<ImportMappings>({
    modelProfileMappings: {},
    toolMappings: {},
  });
  const importReport = selectedPackage
    ? buildImportReport(selectedPackage, profiles, tools, mappings)
    : null;

  const resetImportState = () => {
    setFileName('');
    setSelectedPackage(null);
    setParseError(null);
    setMappings({
      modelProfileMappings: {},
      toolMappings: {},
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPackage) {
        throw new Error('Choose a workflow export package first.');
      }

      const workflow = await workflowsApi.createWorkflow(
        importedWorkflowPayload(selectedPackage, profiles, tools, mappings)
      );
      const createdWorkflow =
        workflow && typeof workflow === 'object' && !Array.isArray(workflow)
          ? (workflow as Record<string, unknown>)
          : null;
      if (!createdWorkflow || typeof createdWorkflow.id !== 'string') {
        throw new Error('Workflow import response did not include an ID.');
      }
      return createdWorkflow.id;
    },
    onSuccess: async (workflowId) => {
      setIsOpen(false);
      resetImportState();
      await onImported(workflowId);
    },
  });

  const handleFileChange = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    setFileName(file.name);
    setSelectedPackage(null);
    setParseError(null);
    setMappings({
      modelProfileMappings: {},
      toolMappings: {},
    });

    try {
      const text = await file.text();
      const pkg = parseWorkflowExportPackageJson(text);
      setSelectedPackage(pkg);
    } catch (error) {
      setParseError(
        error instanceof Error ? error.message : 'Failed to read workflow export package.'
      );
    }
  };
  const localProfileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const localToolById = new Map(tools.map((tool) => [tool.id, tool]));
  const modelProfileRows =
    selectedPackage?.dependencies.modelProfiles.map((profile) => ({
      profile,
      localProfile: localProfileById.get(profile.id) ?? null,
      mappedProfileId: mappings.modelProfileMappings[profile.id] ?? '',
    })) ?? [];
  const toolRows =
    selectedPackage?.dependencies.tools.map((tool) => ({
      tool,
      localTool: localToolById.get(tool.id) ?? null,
      mappedToolId: mappings.toolMappings[tool.id] ?? '',
      hasBundledImplementation: Boolean(tool.implementation),
    })) ?? [];
  const importIsDirty = Boolean(
    fileName ||
    selectedPackage ||
    parseError ||
    Object.keys(mappings.modelProfileMappings).length ||
    Object.keys(mappings.toolMappings).length
  );

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setIsOpen(true)}>
        <Upload data-icon="inline-start" />
        Import workflow
      </Button>
      <AppDialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            resetImportState();
          }
        }}
        dirty={importIsDirty}
        busy={importMutation.isPending}
        onDiscard={resetImportState}
        size="lg"
        icon={<Upload className="size-4" aria-hidden="true" />}
        title="Import workflow"
        description="Import a workflow package exported from Open Agency, then review any missing model or tool mappings before creating it."
        bodyClassName="flex flex-col gap-4"
        footer={
          <>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={importMutation.isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              disabled={importMutation.isPending || !selectedPackage}
              onClick={() => {
                void toast.promise(importMutation.mutateAsync(), {
                  loading: 'Importing workflow...',
                  success: 'Workflow imported.',
                  error: (error) =>
                    error instanceof Error ? error.message : 'Failed to import workflow.',
                  position: 'top-right',
                });
              }}
            >
              {importMutation.isPending ? 'Importing...' : 'Import workflow'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-md border border-dashed border-border bg-muted/30 p-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={(event) => {
                void handleFileChange(event.target.files?.[0]);
              }}
              disabled={importMutation.isPending}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {fileName || 'No package selected'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Use a `.workflow.json` export package. Review missing model profiles and tools
                  before importing.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={importMutation.isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                Choose file
              </Button>
            </div>
          </div>
          {parseError ? (
            <div className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {parseError}
            </div>
          ) : null}
          {selectedPackage ? (
            <div className="rounded-md border border-border bg-background p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">
                    {selectedPackage.workflow.name || selectedPackage.workflow.id}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedPackage.workflow.description || 'No workflow description.'}
                  </p>
                </div>
                <Badge variant="outline">{selectedPackage.schemaVersion}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline">
                  {selectedPackage.workflow.agent_definitions?.length ?? 0} agents
                </Badge>
                <Badge variant="outline">
                  {selectedPackage.workflow.task_definitions?.length ?? 0} tasks
                </Badge>
                <Badge variant="outline">
                  {selectedPackage.dependencies.tools.length} tool references
                </Badge>
                <Badge variant="outline">
                  {selectedPackage.dependencies.modelProfiles.length} model refs
                </Badge>
              </div>
              {selectedPackage.importNotes.length > 0 ? (
                <div className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
                  {selectedPackage.importNotes.slice(0, 4).map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                  {selectedPackage.importNotes.length > 4 ? (
                    <p>{selectedPackage.importNotes.length - 4} more import notes.</p>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-4 space-y-3">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                      Model profiles
                    </p>
                    <Badge
                      variant={
                        modelProfileRows.some((row) => !row.localProfile) ? 'outline' : 'secondary'
                      }
                    >
                      {modelProfileRows.filter((row) => !row.localProfile).length} need review
                    </Badge>
                  </div>
                  {modelProfileRows.length === 0 ? (
                    <p className="text-xs text-neutral-500">No model profile references.</p>
                  ) : (
                    <div className="space-y-2">
                      {modelProfileRows.map(({ profile, localProfile, mappedProfileId }) => (
                        <div
                          key={profile.id}
                          className="grid gap-2 rounded-md border border-neutral-200 bg-neutral-50/70 p-2 md:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)]"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {profile.name || profile.id}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{profile.id}</p>
                          </div>
                          {localProfile ? (
                            <Badge variant="secondary" className="justify-self-start">
                              Available locally
                            </Badge>
                          ) : (
                            <select
                              aria-label={`Map model profile ${profile.id}`}
                              value={mappedProfileId}
                              onChange={(event) =>
                                setMappings((current) => ({
                                  ...current,
                                  modelProfileMappings: {
                                    ...current.modelProfileMappings,
                                    [profile.id]: event.target.value,
                                  },
                                }))
                              }
                              className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                            >
                              <option value="">Leave empty - action required</option>
                              {profiles.map((localProfileOption) => (
                                <option key={localProfileOption.id} value={localProfileOption.id}>
                                  {localProfileOption.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                      Tools
                    </p>
                    <Badge
                      variant={
                        toolRows.some((row) => !row.localTool && !row.hasBundledImplementation)
                          ? 'outline'
                          : 'secondary'
                      }
                    >
                      {
                        toolRows.filter((row) => !row.localTool && !row.hasBundledImplementation)
                          .length
                      }{' '}
                      need review
                    </Badge>
                  </div>
                  {toolRows.length === 0 ? (
                    <p className="text-xs text-neutral-500">No tool references.</p>
                  ) : (
                    <div className="space-y-2">
                      {toolRows.map(
                        ({ tool, localTool, mappedToolId, hasBundledImplementation }) => (
                          <div
                            key={tool.id}
                            className="grid gap-2 rounded-md border border-neutral-200 bg-neutral-50/70 p-2 md:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)]"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {tool.display_name || tool.name || tool.id}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">{tool.id}</p>
                            </div>
                            {localTool ? (
                              <Badge variant="secondary" className="justify-self-start">
                                Available locally
                              </Badge>
                            ) : hasBundledImplementation ? (
                              <Badge variant="secondary" className="justify-self-start">
                                Custom tool will import
                              </Badge>
                            ) : (
                              <select
                                aria-label={`Map tool ${tool.id}`}
                                value={mappedToolId}
                                onChange={(event) =>
                                  setMappings((current) => ({
                                    ...current,
                                    toolMappings: {
                                      ...current.toolMappings,
                                      [tool.id]: event.target.value,
                                    },
                                  }))
                                }
                                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                              >
                                <option value="">Skip tool - action required</option>
                                {tools.map((localToolOption) => (
                                  <option key={localToolOption.id} value={localToolOption.id}>
                                    {localToolOption.display_name ||
                                      localToolOption.name ||
                                      localToolOption.id}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>

                {importReport && importReport.action_required ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Import will create the workflow, but some references need action after import.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </AppDialog>
    </>
  );
}

export default function WorkflowListWorkspace() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'needs-attention'>('all');
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'scheduled' | 'unscheduled'>('all');
  const workflowsQuery = useQuery({
    queryKey: queryKeys.backendWorkflowList(),
    queryFn: () => workflowsApi.listWorkflows(),
  });
  const adaptersQuery = useQuery({
    queryKey: queryKeys.backendRuntimeAdapters(),
    queryFn: () => runtimeAdaptersApi.listRuntimeAdapters(),
  });
  const profilesQuery = useQuery({
    queryKey: queryKeys.backendBehaviorProfiles(),
    queryFn: () => behaviorProfilesApi.listProfiles(),
  });
  const toolsQuery = useQuery({
    queryKey: queryKeys.tools(),
    queryFn: async () => {
      const response = await toolsApi.listTools();
      return response.items;
    },
  });
  const schedulesQuery = useQuery({
    queryKey: ['backendSchedules'] as const,
    queryFn: async () => {
      const response = await schedulesApi.listSchedules();
      return response.items;
    },
  });
  const runsQuery = useQuery({
    queryKey: queryKeys.backendAgentRuns(),
    queryFn: () => runsApi.listRuns(),
    staleTime: 30_000,
  });
  const runtimeAdapters = adaptersQuery.data?.items ?? [];
  const behaviorProfiles = profilesQuery.data ?? [];
  const tools = toolsQuery.data ?? [];
  // Schedules live behind a separate API, so the list view groups them here instead of
  // assuming the workflow list payload already carries next-fire metadata.
  const schedulesByWorkflowId = useMemo(() => {
    const groupedSchedules = new Map<string, ScheduleDefinition[]>();
    (schedulesQuery.data ?? []).forEach((schedule) => {
      if (!schedule.workflow_id) {
        return;
      }

      const existingSchedules = groupedSchedules.get(schedule.workflow_id) ?? [];
      existingSchedules.push(schedule);
      groupedSchedules.set(schedule.workflow_id, existingSchedules);
    });

    return groupedSchedules;
  }, [schedulesQuery.data]);
  const workflows = useMemo(() => workflowsQuery.data?.items ?? [], [workflowsQuery.data?.items]);
  const personaNoticeQueries = useQueries({
    queries: workflows.map((workflow) => ({
      queryKey: queryKeys.backendWorkflowPersonaVersionNotices(workflow.id),
      queryFn: () => workflowsApi.listWorkflowPersonaVersionNotices(workflow.id),
      enabled: Boolean(workflow.id),
    })),
  });
  const personaNoticeCountByWorkflowId = useMemo(() => {
    const counts = new Map<string, number>();
    personaNoticeQueries.forEach((query, index) => {
      const workflowId = workflows[index]?.id;
      if (!workflowId) {
        return;
      }
      counts.set(
        workflowId,
        (query.data?.items ?? []).filter((notice) => notice.status === 'outdated').length
      );
    });
    return counts;
  }, [personaNoticeQueries, workflows]);
  const latestRunByWorkflowId = useMemo(() => {
    const latestRuns = new Map<string, AgentRun>();
    (runsQuery.data ?? []).forEach((run) => {
      if (!run.workflowId) {
        return;
      }
      const current = latestRuns.get(run.workflowId);
      if (!current || runTimestampMs(run) > runTimestampMs(current)) {
        latestRuns.set(run.workflowId, run);
      }
    });
    return latestRuns;
  }, [runsQuery.data]);
  const visibleWorkflows = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
    return workflows.filter((workflow) => {
      const personaUpdateCount = personaNoticeCountByWorkflowId.get(workflow.id) ?? 0;
      const hasEnabledSchedule = (schedulesByWorkflowId.get(workflow.id) ?? []).some(
        (schedule) => schedule.enabled !== false
      );
      const matchesSearch =
        normalizedSearch.length === 0 ||
        workflow.name.toLocaleLowerCase().includes(normalizedSearch) ||
        (workflow.description ?? '').toLocaleLowerCase().includes(normalizedSearch);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'ready' && personaUpdateCount === 0) ||
        (statusFilter === 'needs-attention' && personaUpdateCount > 0);
      const matchesSchedule =
        scheduleFilter === 'all' ||
        (scheduleFilter === 'scheduled' && hasEnabledSchedule) ||
        (scheduleFilter === 'unscheduled' && !hasEnabledSchedule);
      return matchesSearch && matchesStatus && matchesSchedule;
    });
  }, [
    personaNoticeCountByWorkflowId,
    scheduleFilter,
    schedulesByWorkflowId,
    searchQuery,
    statusFilter,
    workflows,
  ]);
  const filtersActive =
    searchQuery.trim().length > 0 || statusFilter !== 'all' || scheduleFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setScheduleFilter('all');
  };

  const assistantPageContext = useMemo(
    () => ({
      surface: 'workflow.list' as const,
      title: 'Workflows',
      description: 'Canonical workflow definitions.',
      summary: {
        workflowCount: workflows.length,
        runtimeAdapterCount: runtimeAdapters.length,
        modelProfileCount: behaviorProfiles.length,
        toolCount: tools.length,
        isLoading:
          workflowsQuery.isLoading ||
          adaptersQuery.isLoading ||
          profilesQuery.isLoading ||
          toolsQuery.isLoading,
      },
      allowedActions: ['workflow.create', 'workflow.import', 'workflow.search', 'workflow.open'],
    }),
    [
      adaptersQuery.isLoading,
      behaviorProfiles.length,
      profilesQuery.isLoading,
      runtimeAdapters.length,
      tools.length,
      toolsQuery.isLoading,
      workflows.length,
      workflowsQuery.isLoading,
    ]
  );
  useRegisterAssistantPageContext(assistantPageContext);

  const handleCreated = async (workflowId: string) => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowList() });
    router.push(`/workflows/${workflowId}`);
  };

  if (
    workflowsQuery.isLoading ||
    adaptersQuery.isLoading ||
    profilesQuery.isLoading ||
    toolsQuery.isLoading
  ) {
    return (
      <LoadingCard
        title="Workflows"
        description="Loading workflow definitions and runtime catalog data."
      />
    );
  }

  if (workflowsQuery.isError) {
    return (
      <ErrorAlert
        title="Failed to load workflows"
        message={workflowsQuery.error.message}
        onRetry={() => workflowsQuery.refetch()}
      />
    );
  }

  if (adaptersQuery.isError) {
    return (
      <ErrorAlert
        title="Failed to load runtime adapters"
        message={adaptersQuery.error.message}
        onRetry={() => adaptersQuery.refetch()}
      />
    );
  }

  if (profilesQuery.isError) {
    return (
      <ErrorAlert
        title="Failed to load model profiles"
        message={profilesQuery.error.message}
        onRetry={() => profilesQuery.refetch()}
      />
    );
  }

  if (toolsQuery.isError) {
    return (
      <ErrorAlert
        title="Failed to load tools"
        message={toolsQuery.error.message}
        onRetry={() => toolsQuery.refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        icon={Workflow}
        tone="workflow"
        title="Workflows"
        description="Build, run, and manage your LLM workflows."
        actions={
          <>
            <CreateWorkflowDialog adapters={runtimeAdapters} onCreated={handleCreated} />
            <ImportWorkflowDialog
              profiles={behaviorProfiles}
              tools={tools}
              onImported={handleCreated}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => workflowsQuery.refetch()}
              disabled={workflowsQuery.isFetching}
            >
              <RefreshCw
                data-icon="inline-start"
                className={workflowsQuery.isFetching ? 'animate-spin' : undefined}
              />
              Refresh
            </Button>
          </>
        }
      />

      {workflows.length === 0 ? (
        <EmptyCard
          title="No workflows found"
          description="Create a workflow first, then open the builder to add agents, tasks, and dependency edges."
          actionLabel="Refresh"
          onAction={() => workflowsQuery.refetch()}
        />
      ) : null}

      {workflows.length > 0 ? (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full max-w-2xl lg:flex-1">
            <span className="sr-only">Search workflows</span>
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-(--agency-shell-muted)"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search workflows"
              className="h-11 rounded-lg border-(--agency-control-border) bg-(--agency-control-bg) pl-10 shadow-(--agency-outline-shadow)"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="workflow-status-filter">
              Filter by status
            </label>
            <select
              id="workflow-status-filter"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as 'all' | 'ready' | 'needs-attention')
              }
              className="h-11 rounded-lg border border-(--agency-control-border) bg-(--agency-control-bg) px-3 text-sm font-medium text-(--agency-control-text) shadow-(--agency-outline-shadow)"
            >
              <option value="all">Status: All</option>
              <option value="ready">Status: Ready</option>
              <option value="needs-attention">Status: Needs attention</option>
            </select>
            <label className="sr-only" htmlFor="workflow-schedule-filter">
              Filter by schedule
            </label>
            <select
              id="workflow-schedule-filter"
              value={scheduleFilter}
              onChange={(event) =>
                setScheduleFilter(event.target.value as 'all' | 'scheduled' | 'unscheduled')
              }
              className="h-11 rounded-lg border border-(--agency-control-border) bg-(--agency-control-bg) px-3 text-sm font-medium text-(--agency-control-text) shadow-(--agency-outline-shadow)"
            >
              <option value="all">Schedule: All</option>
              <option value="scheduled">Schedule: Active</option>
              <option value="unscheduled">Schedule: None</option>
            </select>
            <Button
              type="button"
              variant="ghost"
              className="h-11 px-3 text-(--agency-shell-muted)"
              onClick={clearFilters}
              disabled={!filtersActive}
            >
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      {workflows.length > 0 && visibleWorkflows.length === 0 ? (
        <div className="agency-surface-subtle rounded-xl border px-5 py-10 text-center">
          <p className="font-semibold text-(--agency-shell-text)">No matching workflows</p>
          <p className="mt-1 text-sm text-(--agency-shell-muted)">
            Try a different search or clear the current filters.
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      ) : null}

      {visibleWorkflows.length > 0 ? (
        <section
          aria-label="Workflow list"
          className="agency-surface-raised overflow-hidden rounded-xl border"
        >
          <div className="hidden grid-cols-[minmax(16rem,1.35fr)_minmax(12rem,0.9fr)_minmax(10.5rem,0.72fr)_minmax(10rem,0.66fr)_3.5rem] items-center gap-5 border-b border-(--agency-shell-border) bg-(--agency-surface-subtle) px-5 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.11em] text-(--agency-shell-muted) lg:grid">
            <span>Workflow</span>
            <span>Agents / tasks / tools</span>
            <span>Schedule</span>
            <span>Last run</span>
            <span className="text-right">Actions</span>
          </div>

          <div className="divide-y divide-(--agency-shell-border)">
            {visibleWorkflows.map((workflow) => {
              const outdatedPersonaCount = personaNoticeCountByWorkflowId.get(workflow.id) ?? 0;
              const assignedToolCount = workflowAssignedToolIds(workflow).length;
              const bundledToolCount = workflow.tool_definitions?.length ?? 0;
              const toolCount = assignedToolCount > 0 ? assignedToolCount : bundledToolCount;
              const scheduleSummary = summarizeWorkflowSchedule(
                schedulesByWorkflowId.get(workflow.id),
                schedulesQuery.isLoading,
                schedulesQuery.isError
              );
              const lastRunSummary = summarizeLastRun(
                latestRunByWorkflowId.get(workflow.id),
                runsQuery.isLoading,
                runsQuery.isError
              );

              return (
                <article
                  key={workflow.id}
                  className="group relative grid transition-colors hover:bg-(--agency-row-hover) lg:grid-cols-[minmax(0,1fr)_3.5rem] lg:items-stretch"
                >
                  <Link
                    href={`/workflows/${workflow.id}`}
                    className="grid min-w-0 gap-5 px-5 py-5 outline-none focus-visible:bg-(--agency-row-hover) focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-2 lg:grid-cols-[minmax(16rem,1.35fr)_minmax(12rem,0.9fr)_minmax(10.5rem,0.72fr)_minmax(10rem,0.66fr)] lg:items-center lg:gap-5 lg:py-6"
                  >
                    <div className="flex min-w-0 items-start gap-4 sm:col-span-2 lg:col-span-1">
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-(--agency-shell-border) bg-(--agency-surface-subtle) text-primary transition-colors group-hover:border-(--agency-shell-border-strong)">
                        <Workflow className="size-5 stroke-[1.75]" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2
                            className="line-clamp-2 text-base font-semibold leading-5 tracking-[-0.015em] text-(--agency-shell-text)"
                            title={workflow.name}
                          >
                            {workflow.name}
                          </h2>
                          {outdatedPersonaCount > 0 ? (
                            <Badge
                              variant="outline"
                              className="border-(--agency-warning-border) bg-(--agency-warning-bg) text-(--agency-warning-text)"
                            >
                              {outdatedPersonaCount} persona update
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm leading-5 text-(--agency-shell-muted)">
                          {workflow.description || 'No workflow description configured.'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-(--agency-shell-muted) lg:flex lg:flex-wrap">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <CircleUserRound className="size-4 stroke-[1.75]" />
                        {formatCount(workflow.agent_definitions?.length ?? 0, 'agent')}
                      </span>
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <ListChecks className="size-4 stroke-[1.75]" />
                        {formatCount(workflow.task_definitions?.length ?? 0, 'task')}
                      </span>
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <Wrench className="size-4 stroke-[1.75]" />
                        {formatCount(toolCount, 'tool')}
                      </span>
                    </div>

                    <div className="min-w-0 text-sm">
                      <p
                        data-tone={scheduleSummary.tone}
                        className="workflow-schedule-status flex items-center gap-2 font-medium text-(--agency-shell-text)"
                      >
                        <span className="workflow-schedule-dot size-2 shrink-0 rounded-full" />
                        {scheduleSummary.label}
                      </p>
                      <p
                        className="mt-1 truncate text-(--agency-shell-muted)"
                        title={scheduleSummary.detail}
                      >
                        {scheduleSummary.detail}
                      </p>
                      <ChevronRight className="mt-2 size-4 text-(--agency-shell-muted) transition-transform group-hover:translate-x-0.5 md:hidden" />
                    </div>

                    <div className="min-w-0 text-sm">
                      <p
                        data-tone={lastRunSummary.tone}
                        className="workflow-run-status flex items-center gap-2 font-medium text-(--agency-shell-text)"
                      >
                        {lastRunSummary.tone === 'success' ? (
                          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                        ) : lastRunSummary.tone === 'error' ? (
                          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
                        ) : (
                          <span className="workflow-run-dot size-2 shrink-0 rounded-full" />
                        )}
                        {lastRunSummary.label}
                      </p>
                      <p
                        className="mt-1 truncate text-(--agency-shell-muted)"
                        title={lastRunSummary.detail}
                      >
                        {lastRunSummary.detail}
                      </p>
                      {lastRunSummary.duration ? (
                        <p className="mt-0.5 text-xs text-(--agency-shell-muted)">
                          {lastRunSummary.duration}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                  <div className="absolute right-3 top-3 flex items-center lg:static lg:justify-center lg:pr-2">
                    <WorkflowListActions
                      workflow={workflow}
                      runtimeAdapters={runtimeAdapters}
                      behaviorProfiles={behaviorProfiles}
                      tools={tools}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {visibleWorkflows.length > 0 ? (
        <p className="text-sm text-(--agency-shell-muted)">
          Showing {visibleWorkflows.length} of {workflows.length}{' '}
          {workflows.length === 1 ? 'workflow' : 'workflows'}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-2 py-2 text-sm text-(--agency-shell-muted)">
        <CircleHelp className="size-4" aria-hidden="true" />
        <span>Not sure where to start?</span>
        <button
          type="button"
          onClick={requestAssistantOpen}
          className="font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Ask Assistant
        </button>
      </div>
    </div>
  );
}
