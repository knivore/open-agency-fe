'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/components/library/shadcn/badge';
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/library/shadcn/accordion';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/library/shadcn/card';
import { Checkbox } from '@/components/library/shadcn/checkbox';
import { Label } from '@/components/library/shadcn/label';
import type { WorkflowSharedMemoryOperatorPayload } from '@/types/workflows';

interface WorkflowSharedMemoryControlsProps {
  editable?: boolean;
  frame?: 'card' | 'inline' | 'accordion';
  accordionValue?: string;
  accordionItemClassName?: string;
  accordionTriggerClassName?: string;
  accordionAccentClassName?: string;
  title?: string;
  description?: string;
  children?: ReactNode;
  sharedMemory?: WorkflowSharedMemoryOperatorPayload | null;
  isLoading: boolean;
  isSaving: boolean;
  onEnabledChange: (checked: boolean, applyToAgents: boolean) => void;
}

export default function WorkflowSharedMemoryControls({
  editable = true,
  frame = 'card',
  accordionValue = 'memory-documents',
  accordionItemClassName = 'border-0',
  accordionTriggerClassName = '',
  accordionAccentClassName = 'bg-cyan-500',
  title = 'Memory and documents',
  description = 'Shared memory and workflow retrieval files',
  children,
  sharedMemory,
  isLoading,
  isSaving,
  onEnabledChange,
}: WorkflowSharedMemoryControlsProps) {
  const enabled = sharedMemory?.enabled === true;
  const enabledAgentCount =
    sharedMemory?.agent_states?.filter((agent) => agent.enabled).length ?? 0;
  const agentCount = sharedMemory?.agent_states?.length ?? 0;
  const accordionTrigger = (
    <div className="mr-3 flex min-w-0 flex-1 items-start gap-3">
      <span
        className={`mt-1 h-9 w-1 rounded-full ${accordionAccentClassName}`}
        aria-hidden="true"
      />
      <div className="min-w-0 space-y-1">
        <div className="text-base font-semibold text-neutral-900">{title}</div>
        <p className="text-sm font-normal text-neutral-500">{description}</p>
      </div>
    </div>
  );

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1.5">
        <CardTitle className="text-base">Shared memory</CardTitle>
        <CardDescription>
          Durable memory available to native agents in this workflow.
        </CardDescription>
      </div>
      <Badge variant={enabled ? 'default' : 'outline'}>{enabled ? 'On' : 'Off'}</Badge>
    </div>
  );

  const content = (
    <div className="space-y-4">
      {editable ? (
        <div className="flex items-start gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2">
          <Checkbox
            id="workflow-shared-memory-enabled"
            checked={enabled}
            disabled={isSaving}
            onCheckedChange={(value) => onEnabledChange(value === true, true)}
          />
          <div className="space-y-1">
            <Label htmlFor="workflow-shared-memory-enabled">Share workflow memory</Label>
            <p className="text-xs text-neutral-500">
              {agentCount > 0
                ? `${enabledAgentCount}/${agentCount} embedded agents have memory enabled.`
                : 'No embedded agents are configured yet.'}
            </p>
          </div>
        </div>
      ) : (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-md border border-neutral-200 bg-white px-3 py-2">
            <dt className="text-xs font-medium uppercase text-neutral-500">Shared memory</dt>
            <dd className="mt-1 font-medium text-neutral-900">
              {enabled ? 'Enabled' : 'Disabled'}
            </dd>
          </div>
          <div className="rounded-md border border-neutral-200 bg-white px-3 py-2">
            <dt className="text-xs font-medium uppercase text-neutral-500">Enabled agents</dt>
            <dd className="mt-1 font-medium text-neutral-900">
              {agentCount > 0 ? `${enabledAgentCount}/${agentCount}` : 'No embedded agents'}
            </dd>
          </div>
        </dl>
      )}

      {isLoading ? (
        <div className="rounded-md border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-500">
          Loading shared-memory settings...
        </div>
      ) : null}
    </div>
  );

  if (frame === 'inline') {
    return (
      <section className="space-y-4 rounded-md border border-neutral-200 bg-neutral-50/60 p-4">
        {header}
        {content}
      </section>
    );
  }

  if (frame === 'accordion') {
    return (
      <AccordionItem value={accordionValue} className={accordionItemClassName}>
        <AccordionTrigger className={accordionTriggerClassName}>
          {accordionTrigger}
        </AccordionTrigger>
        <AccordionContent className="space-y-4 px-1 pb-3 pt-1">
          <div
            className={
              children ? 'grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]' : undefined
            }
          >
            <section className="space-y-4 rounded-md border border-neutral-200 bg-neutral-50/60 p-4">
              {header}
              {content}
            </section>
            {children}
          </div>
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
