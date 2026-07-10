'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/components/library/shadcn/badge';
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
import { Checkbox } from '@/components/library/shadcn/checkbox';
import { Label } from '@/components/library/shadcn/label';
import {
  WorkflowBooleanState,
  WorkflowReadOnlySummaryField,
  WorkflowSettingsSection,
  WorkflowStateValue,
} from '@/components/workflow/WorkflowSettingsPrimitives';
import type { MemoryRecord } from '@/types/memory';
import { memoryTypeLabel } from '@/types/memory';
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
  memories: MemoryRecord[];
  isLoading: boolean;
  isSaving: boolean;
  onEnabledChange: (checked: boolean, applyToAgents: boolean) => void;
  onRefresh: () => void;
}

function memoryTypeBadgeLabel(memory: MemoryRecord) {
  return memory.memory_type ? memoryTypeLabel(memory.memory_type) : memory.scope;
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
  memories,
  isLoading,
  isSaving,
  onEnabledChange,
  onRefresh,
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
        <div className="text-base font-semibold text-neutral-900 dark:text-slate-100">{title}</div>
        <p className="text-sm font-normal text-neutral-500 dark:text-slate-400">{description}</p>
      </div>
    </div>
  );

  const header = (
    <div className="space-y-1.5">
      <CardTitle className="text-base">Shared memory</CardTitle>
      <CardDescription>Durable memory available to native agents in this workflow.</CardDescription>
    </div>
  );

  const content = (
    <div className="space-y-4">
      {editable ? (
        <div className="flex items-start gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-950/72">
          <Checkbox
            id="workflow-shared-memory-enabled"
            checked={enabled}
            disabled={isSaving}
            className="cursor-pointer disabled:cursor-not-allowed"
            onCheckedChange={(value) => onEnabledChange(value === true, true)}
          />
          <div className="space-y-1">
            <Label htmlFor="workflow-shared-memory-enabled" className="cursor-pointer">
              Share workflow memory
            </Label>
            <p className="text-xs text-neutral-500 dark:text-slate-400">
              {agentCount > 0
                ? `${enabledAgentCount}/${agentCount} embedded agents have memory enabled.`
                : 'No embedded agents are configured yet.'}
            </p>
          </div>
        </div>
      ) : (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <WorkflowReadOnlySummaryField label="Shared memory">
            <WorkflowBooleanState enabled={enabled} />
          </WorkflowReadOnlySummaryField>
          <WorkflowReadOnlySummaryField label="Enabled agents">
            <WorkflowStateValue>
              {agentCount > 0 ? `${enabledAgentCount}/${agentCount}` : 'No embedded agents'}
            </WorkflowStateValue>
          </WorkflowReadOnlySummaryField>
        </dl>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-neutral-900 dark:text-slate-100">
            Workflow memories
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={onRefresh}
          >
            Refresh
          </Button>
        </div>
        {isLoading ? (
          <div className="rounded-md border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-500 dark:border-white/10 dark:bg-slate-950/72 dark:text-slate-400">
            Loading memory records...
          </div>
        ) : memories.length > 0 ? (
          <div className="divide-y divide-neutral-100 rounded-md border border-neutral-200 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-slate-950/72">
            {memories.slice(0, 5).map((memory) => (
              <div key={memory.id} className="space-y-1 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{memoryTypeBadgeLabel(memory)}</Badge>
                  {memory.sensitive ? <Badge variant="destructive">Sensitive</Badge> : null}
                </div>
                <p className="line-clamp-2 text-sm text-neutral-700 dark:text-slate-300">
                  {memory.summary || memory.content}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-500 dark:border-white/10 dark:bg-slate-950/72 dark:text-slate-400">
            No workflow-scoped memories yet.
          </div>
        )}
      </div>
    </div>
  );

  if (frame === 'inline') {
    return (
      <WorkflowSettingsSection
        title="Shared memory"
        description={description}
        tone="cyan"
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
          <div
            className={
              children ? 'grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]' : undefined
            }
          >
            <section className="space-y-4 rounded-md border border-neutral-200 bg-neutral-50/60 p-4 dark:border-white/10 dark:bg-white/3">
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
