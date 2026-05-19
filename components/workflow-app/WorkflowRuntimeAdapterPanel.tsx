'use client';

import type { ReactNode } from 'react';
import type { RuntimeAdapterDefinition } from '@/types/runtime';
import type { ExecutionHost } from '@/types/workflows';
import { Button } from '@/components/library/shadcn/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/library/shadcn/card';

interface WorkflowRuntimeAdapterPanelProps {
  title: string;
  description: string;
  selectLabel: string;
  selectId: string;
  adapters: RuntimeAdapterDefinition[];
  selectedAdapterId: string;
  preferredAdapterId?: string | null;
  currentAdapterId?: string | null;
  selectedExecutionHost?: ExecutionHost;
  currentExecutionHost?: ExecutionHost | null;
  isPending?: boolean;
  isDisabled?: boolean;
  actionDisabled?: boolean;
  actionVariant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  actionClassName?: string;
  actionContent: ReactNode;
  onAdapterChange: (value: string) => void;
  onExecutionHostChange?: (value: ExecutionHost) => void;
  onAction: () => void;
}

export default function WorkflowRuntimeAdapterPanel({
  title,
  description,
  selectLabel,
  selectId,
  adapters,
  selectedAdapterId,
  preferredAdapterId,
  currentAdapterId,
  selectedExecutionHost,
  currentExecutionHost,
  isPending = false,
  isDisabled = false,
  actionDisabled = false,
  actionVariant = 'outline',
  actionClassName,
  actionContent,
  onAdapterChange,
  onExecutionHostChange,
  onAction,
}: WorkflowRuntimeAdapterPanelProps) {
  const adapterCount = adapters.length;
  const availabilityText =
    adapterCount === 0
      ? 'No runtime adapters are available for this workflow right now.'
      : `This workflow can run on ${adapterCount} adapter${adapterCount === 1 ? '' : 's'}.`;
  const preferenceText = preferredAdapterId
    ? `Preferred launch adapter: ${preferredAdapterId}.`
    : 'No preferred adapter is available right now.';
  const currentAdapterText = currentAdapterId ? `Current run adapter: ${currentAdapterId}.` : null;
  const host = selectedExecutionHost ?? 'local';
  const hostText = currentExecutionHost ? `Current run host: ${currentExecutionHost}.` : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid w-full max-w-3xl gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-900" htmlFor={selectId}>
              {selectLabel}
            </label>
            <select
              id={selectId}
              value={selectedAdapterId}
              onChange={(event) => onAdapterChange(event.target.value)}
              disabled={isDisabled || isPending || adapterCount === 0}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {adapterCount === 0 ? (
                <option value="">No runtime adapters available</option>
              ) : (
                adapters.map((adapter) => (
                  <option key={adapter.id} value={adapter.id}>
                    {adapter.name} ({adapter.id})
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-900" htmlFor={`${selectId}-host`}>
              Execution host
            </label>
            <select
              id={`${selectId}-host`}
              value={host}
              onChange={(event) => onExecutionHostChange?.(event.target.value as ExecutionHost)}
              disabled={isDisabled || isPending || !onExecutionHostChange}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="local">Local backend process</option>
              <option value="docker">Docker container</option>
            </select>
          </div>
          <div className="space-y-1 text-xs text-neutral-500 md:col-span-2">
            <p>{availabilityText}</p>
            <p>{preferenceText}</p>
            {currentAdapterText ? <p>{currentAdapterText}</p> : null}
            {hostText ? <p>{hostText}</p> : null}
          </div>
        </div>
        <Button
          type="button"
          variant={actionVariant}
          onClick={onAction}
          disabled={actionDisabled || isPending || !selectedAdapterId}
          className={actionClassName}
        >
          {actionContent}
        </Button>
      </CardContent>
    </Card>
  );
}
