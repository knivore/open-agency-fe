'use client';

import type { ReactNode } from 'react';
import type { RuntimeAdapterDefinition } from '@/types/runtime';
import type { ExecutionHost } from '@/types/workflows';
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/library/shadcn/accordion';
import { Button } from '@/components/library/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/library/shadcn/card';

interface WorkflowRuntimeAdapterPanelProps {
  editable?: boolean;
  frame?: 'card' | 'inline' | 'accordion';
  accordionValue?: string;
  accordionItemClassName?: string;
  accordionTriggerClassName?: string;
  accordionAccentClassName?: string;
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
  actionContent?: ReactNode;
  onAdapterChange: (value: string) => void;
  onExecutionHostChange?: (value: ExecutionHost) => void;
  onAction?: () => void;
}

export default function WorkflowRuntimeAdapterPanel({
  editable = true,
  frame = 'card',
  accordionValue = 'runtime-adapter',
  accordionItemClassName = 'border-neutral-200',
  accordionTriggerClassName = '',
  accordionAccentClassName = 'bg-sky-500',
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
  const renderAccordionTrigger = () => (
    <div className="mr-3 flex min-w-0 flex-1 items-start gap-3">
      <span
        className={`mt-1 h-9 w-1 rounded-full ${accordionAccentClassName}`}
        aria-hidden="true"
      />
      <div className="min-w-0 space-y-1">
        <div className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{title}</div>
        <p className="text-sm font-normal text-neutral-500 dark:text-neutral-400">{description}</p>
      </div>
    </div>
  );

  const content = editable ? (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="grid w-full max-w-3xl gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-900 dark:text-neutral-100" htmlFor={selectId}>
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
          <label className="text-sm font-medium text-neutral-900 dark:text-neutral-100" htmlFor={`${selectId}-host`}>
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
        <div className="space-y-1 text-xs text-neutral-500 dark:text-neutral-400 md:col-span-2">
          <p>{availabilityText}</p>
          <p>{preferenceText}</p>
          {currentAdapterText ? <p>{currentAdapterText}</p> : null}
          {hostText ? <p>{hostText}</p> : null}
        </div>
      </div>
      {onAction && actionContent ? (
        <Button
          type="button"
          variant={actionVariant}
          onClick={onAction}
          disabled={actionDisabled || isPending || !selectedAdapterId}
          className={actionClassName}
        >
          {actionContent}
        </Button>
      ) : null}
    </div>
  ) : (
    <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-md border border-neutral-200 bg-neutral-50/70 px-3 py-2 dark:border-white/10 dark:bg-white/5">
        <dt className="text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400">Runtime adapter</dt>
        <dd className="mt-1 font-medium text-neutral-900 dark:text-neutral-100">
          {selectedAdapterId || preferredAdapterId || 'Not set'}
        </dd>
      </div>
      <div className="rounded-md border border-neutral-200 bg-neutral-50/70 px-3 py-2 dark:border-white/10 dark:bg-white/5">
        <dt className="text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400">Execution host</dt>
        <dd className="mt-1 font-medium text-neutral-900 dark:text-neutral-100">{host}</dd>
      </div>
      <div className="rounded-md border border-neutral-200 bg-neutral-50/70 px-3 py-2 dark:border-white/10 dark:bg-white/5">
        <dt className="text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400">Preferred adapter</dt>
        <dd className="mt-1 font-medium text-neutral-900 dark:text-neutral-100">{preferredAdapterId || 'Not set'}</dd>
      </div>
      <div className="rounded-md border border-neutral-200 bg-neutral-50/70 px-3 py-2 dark:border-white/10 dark:bg-white/5">
        <dt className="text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400">Available adapters</dt>
        <dd className="mt-1 font-medium text-neutral-900 dark:text-neutral-100">{adapterCount}</dd>
      </div>
    </div>
  );

  if (frame === 'inline') {
    return (
      <section className="space-y-4 rounded-md border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-[rgba(10,17,30,0.84)]">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{title}</h3>
          <p className="text-sm text-muted-foreground dark:text-neutral-400">{description}</p>
        </div>
        {content}
      </section>
    );
  }

  if (frame === 'accordion') {
    return (
      <AccordionItem value={accordionValue} className={accordionItemClassName}>
        <AccordionTrigger className={accordionTriggerClassName}>
          {renderAccordionTrigger()}
        </AccordionTrigger>
        <AccordionContent className="space-y-4 px-1 pb-3 pt-1">{content}</AccordionContent>
      </AccordionItem>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
