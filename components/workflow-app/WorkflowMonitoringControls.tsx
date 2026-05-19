'use client';

import { Badge } from '@/components/library/shadcn/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/library/shadcn/card';
import { Checkbox } from '@/components/library/shadcn/checkbox';
import { Input } from '@/components/library/shadcn/input';
import { Label } from '@/components/library/shadcn/label';
import type { WorkflowMonitoringOperatorPayload } from '@/types/workflows';

interface WorkflowMonitoringControlsProps {
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

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle className="text-base">Main-Agent Monitoring</CardTitle>
            <CardDescription>
              Workflow-level controls for the background main-agent monitor.
            </CardDescription>
          </div>
          <Badge variant={monitoring?.enabled ? 'default' : 'outline'}>
            {statusLabel(monitoring)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
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
              <Label htmlFor="allow-self-monitoring">
                Monitor this main-agent workflow
              </Label>
              <p className="text-xs text-neutral-500">
                This workflow is the active main-agent default workflow. Proposed changes still require approval.
              </p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
