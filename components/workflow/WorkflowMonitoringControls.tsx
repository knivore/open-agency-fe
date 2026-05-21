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
import { Input } from '@/components/library/shadcn/input';
import { Label } from '@/components/library/shadcn/label';
import type { WorkflowMonitoringOperatorPayload } from '@/types/workflows';

interface WorkflowMonitoringControlsProps {
  editable?: boolean;
  frame?: 'card' | 'inline' | 'accordion';
  accordionValue?: string;
  accordionItemClassName?: string;
  accordionTriggerClassName?: string;
  accordionAccentClassName?: string;
  title?: string;
  description?: string;
  children?: ReactNode;
  monitoring?: WorkflowMonitoringOperatorPayload | null;
  isSaving: boolean;
  exemptionReason: string;
  onExemptionReasonChange: (value: string) => void;
  onMonitoringEnabledChange: (checked: boolean) => void;
  onExemptionReasonSave: () => void;
  onAllowSelfMonitoringChange: (checked: boolean) => void;
}

function statusLabel(monitoring?: WorkflowMonitoringOperatorPayload | null) {
  if (!monitoring) {
    return 'Not reported';
  }
  if (monitoring.exempted) {
    return 'Exempt';
  }
  return monitoring.enabled ? monitoring.level : 'Off';
}

export default function WorkflowMonitoringControls({
  editable = true,
  frame = 'card',
  accordionValue = 'monitoring',
  accordionItemClassName = 'border-neutral-200',
  accordionTriggerClassName = '',
  accordionAccentClassName = 'bg-emerald-500',
  title = 'Monitoring',
  description = 'Main-agent monitoring controls and proposals',
  children,
  monitoring,
  isSaving,
  exemptionReason,
  onExemptionReasonChange,
  onMonitoringEnabledChange,
  onExemptionReasonSave,
  onAllowSelfMonitoringChange,
}: WorkflowMonitoringControlsProps) {
  const monitoringEnabled = monitoring?.enabled !== false;
  const allowSelfMonitoring = monitoring?.controls?.allow_self_monitoring === true;
  const showSelfMonitoring = monitoring?.is_main_agent_default_workflow === true;
  const exemption = typeof monitoring?.reason === 'string' ? monitoring.reason : '';
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
        <CardTitle className="text-base">Main agent monitoring</CardTitle>
        <CardDescription>
          Workflow-level controls for the background main-agent monitor.
        </CardDescription>
      </div>
      <Badge variant={monitoring?.enabled ? 'default' : 'outline'}>{statusLabel(monitoring)}</Badge>
    </div>
  );

  const content = editable ? (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2">
        <Checkbox
          id="workflow-monitoring-enabled"
          checked={monitoringEnabled}
          disabled={isSaving}
          onCheckedChange={(value) => onMonitoringEnabledChange(value === true)}
        />
        <div className="space-y-1">
          <Label htmlFor="workflow-monitoring-enabled">Monitor this workflow</Label>
          <p className="text-xs text-neutral-500">
            Allows the main-agent monitor to inspect this workflow's active and recent runs.
          </p>
        </div>
      </div>

      {!monitoringEnabled ? (
        <div className="space-y-2 rounded-md border border-neutral-200 bg-white px-3 py-3">
          <Label htmlFor="workflow-monitoring-exemption-reason">Exemption reason</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="workflow-monitoring-exemption-reason"
              value={exemptionReason}
              disabled={isSaving}
              onChange={(event) => onExemptionReasonChange(event.target.value)}
              onBlur={onExemptionReasonSave}
              placeholder="Human-managed workflow; do not monitor automatically."
            />
            <button
              type="button"
              disabled={isSaving}
              onClick={onExemptionReasonSave}
              className="h-10 rounded-md border border-neutral-200 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save reason
            </button>
          </div>
        </div>
      ) : null}

      {showSelfMonitoring ? (
        <div className="flex items-start gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2">
          <Checkbox
            id="allow-self-monitoring"
            checked={allowSelfMonitoring}
            disabled={isSaving}
            onCheckedChange={(value) => onAllowSelfMonitoringChange(value === true)}
          />
          <div className="space-y-1">
            <Label htmlFor="allow-self-monitoring">Monitor this main-agent workflow</Label>
            <p className="text-xs text-neutral-500">
              This workflow is the active main-agent default workflow. Proposed changes still
              require approval.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  ) : (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div className="rounded-md border border-neutral-200 bg-white px-3 py-2">
        <dt className="text-xs font-medium uppercase text-neutral-500">Monitor workflow</dt>
        <dd className="mt-1 font-medium text-neutral-900">
          {monitoringEnabled ? 'Enabled' : 'Disabled'}
        </dd>
      </div>
      <div className="rounded-md border border-neutral-200 bg-white px-3 py-2">
        <dt className="text-xs font-medium uppercase text-neutral-500">Monitoring level</dt>
        <dd className="mt-1 font-medium text-neutral-900">{statusLabel(monitoring)}</dd>
      </div>
      <div className="rounded-md border border-neutral-200 bg-white px-3 py-2">
        <dt className="text-xs font-medium uppercase text-neutral-500">Self monitoring</dt>
        <dd className="mt-1 font-medium text-neutral-900">
          {showSelfMonitoring
            ? allowSelfMonitoring
              ? 'Allowed'
              : 'Not allowed'
            : 'Not applicable'}
        </dd>
      </div>
      <div className="rounded-md border border-neutral-200 bg-white px-3 py-2">
        <dt className="text-xs font-medium uppercase text-neutral-500">Exemption reason</dt>
        <dd className="mt-1 font-medium text-neutral-900">{exemption || 'None'}</dd>
      </div>
    </dl>
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
          <div className={children ? 'grid gap-4 xl:grid-cols-2' : undefined}>
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
