'use client';

import { Repeat2 } from 'lucide-react';
import { Button } from '@/components/library/shadcn/button';
import { Input } from '@/components/library/shadcn/input';
import { Label } from '@/components/library/shadcn/label';
import {
  readPersistentCycleConfiguration,
  writePersistentCycleConfiguration,
  type PersistentCycleConfiguration,
} from '@/lib/workflows/persistentCycle';
import type { JsonObject } from '@/types/api';

interface WorkflowPersistentCycleEditorProps {
  metadata: JsonObject;
  onMetadataChange: (metadata: JsonObject) => void;
}

export default function WorkflowPersistentCycleEditor({
  metadata,
  onMetadataChange,
}: WorkflowPersistentCycleEditorProps) {
  const configuration = readPersistentCycleConfiguration(metadata);
  const updateConfiguration = (patch: Partial<PersistentCycleConfiguration>) => {
    onMetadataChange(writePersistentCycleConfiguration(metadata, { ...configuration, ...patch }));
  };

  const updatePositiveNumber = (key: keyof PersistentCycleConfiguration, rawValue: string) => {
    const value = Number(rawValue);
    if (Number.isFinite(value) && value > 0) {
      updateConfiguration({ [key]: value });
    }
  };

  const updateOptionalInteger = (key: 'maxCycles' | 'maxNoProgressCycles', rawValue: string) => {
    if (!rawValue) {
      updateConfiguration({ [key]: null });
      return;
    }
    const value = Number(rawValue);
    if (Number.isInteger(value) && value > 0) {
      updateConfiguration({ [key]: value });
    }
  };

  return (
    <section className="border-t border-neutral-200 pt-4 dark:border-white/10 md:col-span-2 xl:col-span-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
            <Repeat2 className="size-[1.05rem] stroke-[1.75]" />
          </span>
          <div>
            <h3 className="font-semibold text-neutral-950 dark:text-slate-100">Execution mode</h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-slate-300">
              Persistent monitors repeat this workflow under one durable run and sleep between
              cycles until paused or cancelled.
            </p>
          </div>
        </div>
        <div
          className="inline-flex w-fit rounded-md border border-neutral-200 bg-neutral-100 p-1 dark:border-white/10 dark:bg-white/5"
          role="group"
          aria-label="Workflow execution mode"
        >
          <Button
            type="button"
            size="sm"
            variant={configuration.enabled ? 'ghost' : 'secondary'}
            aria-pressed={!configuration.enabled}
            onClick={() => updateConfiguration({ enabled: false })}
          >
            Finite
          </Button>
          <Button
            type="button"
            size="sm"
            variant={configuration.enabled ? 'secondary' : 'ghost'}
            aria-pressed={configuration.enabled}
            onClick={() => updateConfiguration({ enabled: true })}
          >
            Persistent monitor
          </Button>
        </div>
      </div>

      {configuration.enabled ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="persistent-cycle-interval">Interval (seconds)</Label>
            <Input
              id="persistent-cycle-interval"
              type="number"
              min={1}
              step={1}
              value={configuration.intervalSeconds}
              onChange={(event) => updatePositiveNumber('intervalSeconds', event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="persistent-cycle-backoff">Failure backoff</Label>
            <Input
              id="persistent-cycle-backoff"
              type="number"
              min={1}
              step={0.25}
              value={configuration.failureBackoffMultiplier}
              onChange={(event) =>
                updatePositiveNumber('failureBackoffMultiplier', event.target.value)
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="persistent-cycle-max-interval">Maximum interval (seconds)</Label>
            <Input
              id="persistent-cycle-max-interval"
              type="number"
              min={configuration.intervalSeconds}
              step={1}
              value={configuration.maxIntervalSeconds}
              onChange={(event) => updatePositiveNumber('maxIntervalSeconds', event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="persistent-cycle-max-failures">Pause after failures</Label>
            <Input
              id="persistent-cycle-max-failures"
              type="number"
              min={1}
              step={1}
              value={configuration.maxConsecutiveFailures}
              onChange={(event) =>
                updatePositiveNumber('maxConsecutiveFailures', event.target.value)
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="persistent-cycle-no-progress">Pause after repeated results</Label>
            <Input
              id="persistent-cycle-no-progress"
              type="number"
              min={1}
              step={1}
              placeholder="No limit"
              value={configuration.maxNoProgressCycles ?? ''}
              onChange={(event) => updateOptionalInteger('maxNoProgressCycles', event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="persistent-cycle-max-cycles">Stop after cycles</Label>
            <Input
              id="persistent-cycle-max-cycles"
              type="number"
              min={1}
              step={1}
              placeholder="No limit"
              value={configuration.maxCycles ?? ''}
              onChange={(event) => updateOptionalInteger('maxCycles', event.target.value)}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
