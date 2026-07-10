'use client';

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/library/shadcn/accordion';
import { Button } from '@/components/library/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/library/shadcn/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/library/shadcn/tooltip';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/library/shadcn/card';
import {
  WorkflowBooleanState,
  WorkflowReadOnlySummaryField,
  WorkflowSettingsSection,
  WorkflowStateValue,
} from '@/components/workflow/WorkflowSettingsPrimitives';
import type { ScheduleDefinition } from '@/types/runtime';
import { MoreHorizontal, Pause, Pencil, Play, RefreshCw, Save, Trash2, X, Zap } from 'lucide-react';
import { useState } from 'react';

interface WorkflowSchedulesPanelProps {
  editable?: boolean;
  frame?: 'card' | 'inline' | 'accordion';
  accordionValue?: string;
  accordionItemClassName?: string;
  accordionTriggerClassName?: string;
  accordionAccentClassName?: string;
  title?: string;
  description?: string;
  schedules: ScheduleDefinition[];
  isLoading: boolean;
  errorMessage?: string;
  isMutating?: boolean;
  onCreateSchedule?: (payload: Record<string, unknown>) => Promise<void> | void;
  onRefresh: () => void;
  onDeleteSchedule: (schedule: ScheduleDefinition) => Promise<void> | void;
  onToggleSchedule: (schedule: ScheduleDefinition) => void;
  onTriggerNow: (schedule: ScheduleDefinition) => void;
  onUpdateSchedule: (
    schedule: ScheduleDefinition,
    patch: Record<string, unknown>
  ) => Promise<void> | void;
}

interface ScheduleDraft {
  cron: string;
}

function formatDateTime(value?: string | null, timezone?: string | null) {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone || undefined,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }
}

function formatTrigger(schedule: ScheduleDefinition) {
  if (schedule.trigger_type === 'cron' && typeof schedule.trigger_config?.cron === 'string') {
    return `cron ${schedule.trigger_config.cron}`;
  }

  if (
    schedule.trigger_type === 'interval' &&
    schedule.trigger_config?.interval_seconds !== undefined
  ) {
    return `every ${schedule.trigger_config.interval_seconds}s`;
  }

  return schedule.trigger_type || 'manual';
}

function getCronExpression(schedule: ScheduleDefinition) {
  return typeof schedule.trigger_config?.cron === 'string' ? schedule.trigger_config.cron : '';
}

function draftFromSchedule(schedule: ScheduleDefinition): ScheduleDraft {
  return {
    cron: getCronExpression(schedule),
  };
}

function validateCronField(value: string, label: string, minimum: number, maximum: number) {
  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return `${label} is required.`;
  }

  for (const part of parts) {
    if (part === '*') {
      continue;
    }
    if (part.startsWith('*/')) {
      const step = Number.parseInt(part.slice(2), 10);
      if (!Number.isInteger(step) || step < 1) {
        return `${label} step must be at least 1.`;
      }
      continue;
    }

    const parsed = Number.parseInt(part, 10);
    if (
      !Number.isInteger(parsed) ||
      String(parsed) !== part ||
      parsed < minimum ||
      parsed > maximum
    ) {
      return `${label} must be *, */n, or ${minimum}-${maximum}.`;
    }
  }

  return null;
}

function parseCronExpression(cron: string) {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) {
    return {
      fields,
      error: 'Use five fields: minute hour day month weekday.',
    };
  }

  const checks = [
    validateCronField(fields[0], 'Minute', 0, 59),
    validateCronField(fields[1], 'Hour', 0, 23),
    validateCronField(fields[2], 'Day', 1, 31),
    validateCronField(fields[3], 'Month', 1, 12),
    validateCronField(fields[4], 'Weekday', 0, 6),
  ];
  const error = checks.find(Boolean) ?? null;

  return { fields, error };
}

function describeCron(cron: string) {
  const { fields, error } = parseCronExpression(cron);
  if (error || fields.length !== 5) {
    return null;
  }

  const [minute, hour, day, month, weekday] = fields;
  if (
    day === '*' &&
    month === '*' &&
    weekday === '*' &&
    /^\d+$/.test(minute) &&
    /^\d+$/.test(hour)
  ) {
    return `Daily at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  }
  if (
    day === '*' &&
    month === '*' &&
    weekday !== '*' &&
    /^\d+$/.test(minute) &&
    /^\d+$/.test(hour)
  ) {
    return `Weekday ${weekday} at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  }

  return 'Custom cron schedule';
}

function buildSchedulePatch(draft: ScheduleDraft) {
  const cron = draft.cron.trim();
  if (!cron) {
    throw new Error('Cron expression is required.');
  }

  const parsed = parseCronExpression(cron);
  if (parsed.error) {
    throw new Error(parsed.error);
  }

  return {
    trigger_type: 'cron',
    trigger_config: { cron },
  };
}

export default function WorkflowSchedulesPanel({
  editable = true,
  frame = 'card',
  accordionValue = 'schedules',
  accordionItemClassName = 'border-neutral-200',
  accordionTriggerClassName = '',
  accordionAccentClassName = 'bg-amber-500',
  title = 'Schedules',
  description,
  schedules,
  isLoading,
  errorMessage,
  isMutating = false,
  onCreateSchedule,
  onRefresh,
  onDeleteSchedule,
  onToggleSchedule,
  onTriggerNow,
  onUpdateSchedule,
}: WorkflowSchedulesPanelProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState<ScheduleDraft>({ cron: '0 7 * * *' });
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [pendingDeleteScheduleId, setPendingDeleteScheduleId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ScheduleDraft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const headerDescription =
    description ??
    `Recurring workflow triggers and next fire times.${!editable ? ' Enable edit mode to change schedule settings.' : ''}`;

  const startEditing = (schedule: ScheduleDefinition) => {
    setEditingScheduleId(schedule.id);
    setDraft(draftFromSchedule(schedule));
    setDraftError(null);
  };

  const stopEditing = () => {
    setEditingScheduleId(null);
    setDraft(null);
    setDraftError(null);
  };

  const cancelDelete = () => {
    setPendingDeleteScheduleId(null);
  };

  const updateDraft = (patch: Partial<ScheduleDraft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
    setDraftError(null);
  };

  const updateCreateDraft = (patch: Partial<ScheduleDraft>) => {
    setCreateDraft((current) => ({ ...current, ...patch }));
    setCreateError(null);
  };

  const stopCreating = () => {
    setIsCreating(false);
    setCreateDraft({ cron: '0 7 * * *' });
    setCreateError(null);
  };

  const renderCronForm = ({
    cancelLabel,
    cron,
    error,
    inputId,
    onCancel,
    onCronChange,
    onSubmit,
    submitLabel,
    timezone,
  }: {
    cancelLabel: string;
    cron: string;
    error: string | null;
    inputId: string;
    onCancel: () => void;
    onCronChange: (cron: string) => void;
    onSubmit: () => Promise<void> | void;
    submitLabel: string;
    timezone?: string | null;
  }) => {
    const cronPreview = describeCron(cron);
    const cronParts = parseCronExpression(cron).fields;

    return (
      <form
        className="grid flex-1 gap-4 rounded-md border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/72"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        <div className="grid gap-3">
          <label
            className="text-sm font-medium text-neutral-900 dark:text-slate-100"
            htmlFor={inputId}
          >
            Cron expression
          </label>
          <input
            id={inputId}
            value={cron}
            onChange={(event) => onCronChange(event.target.value)}
            disabled={isMutating}
            placeholder="0 7 * * *"
            className="flex h-10 w-full max-w-xl rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
          />
          <div className="grid gap-2 text-sm text-neutral-700 dark:text-slate-300 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <p>
              {cronPreview ?? 'Enter five fields in this order: minute hour day month weekday.'}
              {timezone ? ` Timezone: ${timezone}.` : ''}
            </p>
            <code className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-700 dark:border-white/10 dark:bg-white/4 dark:text-slate-300">
              minute hour day month weekday
            </code>
          </div>
          {cronParts.length === 5 ? (
            <div className="grid gap-2 text-xs text-neutral-600 dark:text-slate-400 sm:grid-cols-5">
              {['Minute', 'Hour', 'Day', 'Month', 'Weekday'].map((label, index) => (
                <div
                  key={label}
                  className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-2 dark:border-white/10 dark:bg-white/4"
                >
                  <div className="font-medium uppercase text-neutral-500 dark:text-slate-400">
                    {label}
                  </div>
                  <code className="mt-1 block text-sm text-neutral-900 dark:text-slate-100">
                    {cronParts[index]}
                  </code>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {error}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={isMutating}>
            <Save className="mr-2 h-4 w-4" />
            {submitLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isMutating}
          >
            <X className="mr-2 h-4 w-4" />
            {cancelLabel}
          </Button>
        </div>
      </form>
    );
  };

  const headerActions = (
    <div className="flex flex-wrap gap-2">
      {editable && onCreateSchedule ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsCreating(true)}
          disabled={isMutating || isCreating}
        >
          <Pencil className="mr-2 h-4 w-4" />
          Set schedule
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={isLoading || isMutating}
      >
        <RefreshCw className="mr-2 h-4 w-4" />
        Refresh
      </Button>
    </div>
  );

  const header = (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{headerDescription}</CardDescription>
      </div>
      {headerActions}
    </div>
  );

  const accordionTrigger = (
    <div className="mr-3 flex min-w-0 flex-1 items-start gap-3">
      <span
        className={`mt-1 h-9 w-1 rounded-full ${accordionAccentClassName}`}
        aria-hidden="true"
      />
      <div className="min-w-0 space-y-1">
        <div className="text-base font-semibold text-neutral-900 dark:text-slate-100">{title}</div>
        <p className="text-sm font-normal text-neutral-500 dark:text-slate-400">
          {headerDescription}
        </p>
      </div>
    </div>
  );

  const content = (
    <div>
      {errorMessage ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {errorMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600 dark:border-white/10 dark:bg-white/4 dark:text-slate-400">
          Loading schedules...
        </div>
      ) : null}

      {editable && isCreating && onCreateSchedule ? (
        <div className="mt-3">
          {renderCronForm({
            cancelLabel: 'Cancel',
            cron: createDraft.cron,
            error: createError,
            inputId: 'new-workflow-schedule-cron',
            onCancel: stopCreating,
            onCronChange: (cron) => updateCreateDraft({ cron }),
            onSubmit: async () => {
              try {
                const patch = buildSchedulePatch(createDraft);
                await onCreateSchedule(patch);
                stopCreating();
              } catch (error) {
                setCreateError(
                  error instanceof Error ? error.message : 'Schedule creation is invalid.'
                );
              }
            },
            submitLabel: 'Create schedule',
          })}
        </div>
      ) : null}

      {!isLoading && schedules.length === 0 && !isCreating ? (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600 dark:border-white/10 dark:bg-white/4 dark:text-slate-400">
          {editable
            ? 'No schedules are attached to this workflow. Use Set schedule to create one.'
            : 'No schedules are attached to this workflow.'}
        </div>
      ) : null}

      {schedules.length > 0 ? (
        <div className="space-y-3">
          {schedules.map((schedule) => (
            <div
              key={schedule.id}
              className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white/75 p-4 shadow-sm shadow-neutral-950/3 dark:border-white/10 dark:bg-slate-950/60 dark:shadow-none lg:flex-row lg:items-start lg:justify-between"
            >
              {editable && editingScheduleId === schedule.id && draft ? (
                renderCronForm({
                  cancelLabel: 'Cancel',
                  cron: draft.cron,
                  error: draftError,
                  inputId: `${schedule.id}-cron`,
                  onCancel: stopEditing,
                  onCronChange: (cron) => updateDraft({ cron }),
                  onSubmit: async () => {
                    try {
                      const patch = buildSchedulePatch(draft);
                      await onUpdateSchedule(schedule, patch);
                      stopEditing();
                    } catch (error) {
                      setDraftError(
                        error instanceof Error ? error.message : 'Schedule update is invalid.'
                      );
                    }
                  },
                  submitLabel: 'Save cron',
                  timezone: schedule.timezone,
                })
              ) : (
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    <WorkflowBooleanState enabled={schedule.enabled === true} />
                    <span className="text-neutral-600 dark:text-slate-300">
                      {formatTrigger(schedule)}
                    </span>
                    <span className="text-neutral-500 dark:text-slate-400">
                      {schedule.timezone || 'UTC'}
                    </span>
                  </div>
                  <dl className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
                    <WorkflowReadOnlySummaryField label="Next fire">
                      <WorkflowStateValue>
                        {formatDateTime(schedule.next_fire_at, schedule.timezone)}
                      </WorkflowStateValue>
                    </WorkflowReadOnlySummaryField>
                    <WorkflowReadOnlySummaryField label="Last fire">
                      <WorkflowStateValue>
                        {formatDateTime(schedule.last_fire_at, schedule.timezone)}
                      </WorkflowStateValue>
                    </WorkflowReadOnlySummaryField>
                    <WorkflowReadOnlySummaryField label="Concurrency">
                      <WorkflowStateValue>
                        {schedule.max_concurrent_executions ?? 1}
                      </WorkflowStateValue>
                    </WorkflowReadOnlySummaryField>
                  </dl>
                </div>
              )}
              {editable ? (
                <>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    {editingScheduleId === schedule.id ||
                    schedule.trigger_type !== 'cron' ? null : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => startEditing(schedule)}
                        disabled={isMutating}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit cron
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onTriggerNow(schedule)}
                      disabled={isMutating}
                    >
                      <Zap className="mr-2 h-4 w-4" />
                      Trigger now
                    </Button>
                    <Button
                      type="button"
                      variant={schedule.enabled ? 'secondary' : 'default'}
                      size="sm"
                      onClick={() => onToggleSchedule(schedule)}
                      disabled={isMutating}
                    >
                      {schedule.enabled ? (
                        <Pause className="mr-2 h-4 w-4" />
                      ) : (
                        <Play className="mr-2 h-4 w-4" />
                      )}
                      {schedule.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <DropdownMenu>
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="shrink-0"
                                aria-label={`Schedule actions for ${schedule.name || schedule.id}`}
                                disabled={isMutating}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent>Schedule actions</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem
                          className="text-red-700 focus:bg-red-50 focus:text-red-800"
                          onSelect={() => {
                            setPendingDeleteScheduleId(schedule.id);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove schedule
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {pendingDeleteScheduleId === schedule.id ? (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-medium">
                          Remove {schedule.name || schedule.id}? This cannot be undone.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              void onDeleteSchedule(schedule);
                              setPendingDeleteScheduleId(null);
                            }}
                            disabled={isMutating}
                          >
                            Remove
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={cancelDelete}
                            disabled={isMutating}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );

  if (frame === 'inline') {
    return (
      <WorkflowSettingsSection
        title={title}
        description={headerDescription}
        tone="amber"
        actions={headerActions}
        className="space-y-4 p-4"
      >
        {content}
      </WorkflowSettingsSection>
    );
  }

  if (frame === 'accordion') {
    return (
      <AccordionItem value={accordionValue} className={accordionItemClassName}>
        <AccordionTrigger className={accordionTriggerClassName}>
          {accordionTrigger}
        </AccordionTrigger>
        <AccordionContent className="space-y-4 px-1 pb-3 pt-1">
          <section className="space-y-4 rounded-md border border-neutral-200 bg-neutral-50/60 p-4 dark:border-white/10 dark:bg-white/3">
            {header}
            {content}
          </section>
        </AccordionContent>
      </AccordionItem>
    );
  }

  return (
    <Card>
      <CardHeader>{header}</CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
