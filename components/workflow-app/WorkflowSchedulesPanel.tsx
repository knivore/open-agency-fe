'use client';

import { Badge } from '@/components/library/shadcn/badge';
import { Button } from '@/components/library/shadcn/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/library/shadcn/card';
import type { ScheduleDefinition } from '@/types/runtime';
import { Pause, Pencil, Play, RefreshCw, Save, X, Zap } from 'lucide-react';
import { useState } from 'react';

interface WorkflowSchedulesPanelProps {
  schedules: ScheduleDefinition[];
  isLoading: boolean;
  errorMessage?: string;
  isMutating?: boolean;
  onRefresh: () => void;
  onToggleSchedule: (schedule: ScheduleDefinition) => void;
  onTriggerNow: (schedule: ScheduleDefinition) => void;
  onUpdateSchedule: (schedule: ScheduleDefinition, patch: Record<string, unknown>) => Promise<void> | void;
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

  if (schedule.trigger_type === 'interval' && schedule.trigger_config?.interval_seconds !== undefined) {
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
  const parts = value.split(',').map((part) => part.trim()).filter(Boolean);
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
    if (!Number.isInteger(parsed) || String(parsed) !== part || parsed < minimum || parsed > maximum) {
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
  if (day === '*' && month === '*' && weekday === '*' && /^\d+$/.test(minute) && /^\d+$/.test(hour)) {
    return `Daily at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  }
  if (day === '*' && month === '*' && weekday !== '*' && /^\d+$/.test(minute) && /^\d+$/.test(hour)) {
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
  schedules,
  isLoading,
  errorMessage,
  isMutating = false,
  onRefresh,
  onToggleSchedule,
  onTriggerNow,
  onUpdateSchedule,
}: WorkflowSchedulesPanelProps) {
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ScheduleDraft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);

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

  const updateDraft = (patch: Partial<ScheduleDraft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
    setDraftError(null);
  };

  const cronPreview = draft ? describeCron(draft.cron) : null;
  const cronParts = draft ? parseCronExpression(draft.cron).fields : [];

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>Schedules</CardTitle>
          <CardDescription>Recurring workflow triggers and next fire times.</CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={isLoading || isMutating}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {errorMessage ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {errorMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
            Loading schedules...
          </div>
        ) : null}

        {!isLoading && schedules.length === 0 ? (
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
            No schedules are attached to this workflow.
          </div>
        ) : null}

        {schedules.length > 0 ? (
          <div className="space-y-3">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="flex flex-col gap-4 rounded-md border border-neutral-200 p-4 lg:flex-row lg:items-start lg:justify-between"
              >
                {editingScheduleId === schedule.id && draft ? (
                  <form
                    className="grid flex-1 gap-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void (async () => {
                        try {
                          const patch = buildSchedulePatch(draft);
                          await onUpdateSchedule(schedule, patch);
                          stopEditing();
                        } catch (error) {
                          setDraftError(error instanceof Error ? error.message : 'Schedule update is invalid.');
                        }
                      })();
                    }}
                  >
                    <div className="grid gap-3">
                      <label className="text-sm font-medium text-neutral-900" htmlFor={`${schedule.id}-cron`}>
                        Cron expression
                      </label>
                      <input
                        id={`${schedule.id}-cron`}
                        value={draft.cron}
                        onChange={(event) => updateDraft({ cron: event.target.value })}
                        disabled={isMutating}
                        placeholder="0 7 * * *"
                        className="flex h-10 w-full max-w-xl rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                      />
                      <div className="grid gap-2 text-sm text-neutral-700 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                        <p>
                          {cronPreview ?? 'Enter five fields in this order: minute hour day month weekday.'}
                          {schedule.timezone ? ` Timezone: ${schedule.timezone}.` : ''}
                        </p>
                        <code className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-700">
                          minute hour day month weekday
                        </code>
                      </div>
                      {cronParts.length === 5 ? (
                        <div className="grid gap-2 text-xs text-neutral-600 sm:grid-cols-5">
                          {['Minute', 'Hour', 'Day', 'Month', 'Weekday'].map((label, index) => (
                            <div key={label} className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-2">
                              <div className="font-medium uppercase text-neutral-500">{label}</div>
                              <code className="mt-1 block text-sm text-neutral-900">{cronParts[index]}</code>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {draftError ? (
                      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                        {draftError}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" size="sm" disabled={isMutating}>
                        <Save className="mr-2 h-4 w-4" />
                        Save cron
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={stopEditing} disabled={isMutating}>
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={schedule.enabled ? 'default' : 'outline'}>
                      {schedule.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                    <Badge variant="outline">{formatTrigger(schedule)}</Badge>
                    <Badge variant="secondary">{schedule.timezone || 'UTC'}</Badge>
                  </div>
                  <dl className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <dt className="text-xs font-medium uppercase text-neutral-500">Next fire</dt>
                      <dd className="mt-1 text-neutral-900">{formatDateTime(schedule.next_fire_at, schedule.timezone)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase text-neutral-500">Last fire</dt>
                      <dd className="mt-1 text-neutral-900">{formatDateTime(schedule.last_fire_at, schedule.timezone)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase text-neutral-500">Concurrency</dt>
                      <dd className="mt-1 text-neutral-900">{schedule.max_concurrent_executions ?? 1}</dd>
                    </div>
                  </dl>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {editingScheduleId === schedule.id || schedule.trigger_type !== 'cron' ? null : (
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
                    {schedule.enabled ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                    {schedule.enabled ? 'Disable' : 'Enable'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
