'use client';

import type { ReactNode } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/library/shadcn/select';
import { TooltipProvider } from '@/components/library/shadcn/tooltip';
import {
  WorkflowBooleanState,
  WorkflowFieldLabel,
  WorkflowReadOnlySummaryField,
  WorkflowSettingsSection,
  WorkflowSummaryField,
} from '@/components/workflow/WorkflowSettingsPrimitives';
import type { WorkflowMonitoringOperatorPayload } from '@/types/workflows';

type MonitoringControlKey =
  | 'allow_improvement_proposals'
  | 'route_improvement_proposals_to_approval'
  | 'supervise_token_usage'
  | 'supervise_context_health'
  | 'supervise_subagents'
  | 'supervise_tool_failures'
  | 'delegate_hitl_to_main_agent'
  | 'route_steering_requests_to_approval'
  | 'excluded_subagent_ids'
  | 'excluded_task_ids'
  | 'allowed_steering_actions'
  | 'auto_apply_steering_actions'
  | 'level';

interface MonitoringOption {
  id: string;
  label: string;
}

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
  agentOptions?: MonitoringOption[];
  taskOptions?: MonitoringOption[];
  isSaving: boolean;
  exemptionReason: string;
  onExemptionReasonChange: (value: string) => void;
  onMonitoringEnabledChange: (checked: boolean) => void;
  onExemptionReasonSave: () => void;
  onAllowSelfMonitoringChange: (checked: boolean) => void;
  onMonitorControlChange?: (key: MonitoringControlKey, value: boolean | string | string[]) => void;
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

const monitoringLevels = [
  { value: 'minimal', label: 'Minimal' },
  { value: 'standard', label: 'Standard' },
  { value: 'strict', label: 'Strict' },
];

const steeringActionOptions = [
  { id: 'request_human_review', label: 'Human review' },
  { id: 'request_replan', label: 'Replan' },
  { id: 'redirect_subagent', label: 'Redirect sub-agent' },
  { id: 'pause_execution', label: 'Pause execution' },
  { id: 'resume_execution', label: 'Resume execution' },
  { id: 'cancel_execution', label: 'Cancel execution' },
  { id: 'repair_stale_execution', label: 'Repair stale run' },
  { id: 'replace_task_instructions', label: 'Replace task instructions' },
  { id: 'lower_max_iterations', label: 'Lower max iterations' },
  { id: 'reduce_tool_scope', label: 'Reduce tool scope' },
];

const autoApplySteeringActionOptions = steeringActionOptions.filter((option) =>
  ['pause_execution', 'resume_execution', 'cancel_execution', 'repair_stale_execution'].includes(
    option.id
  )
);

const helpText = {
  monitorWorkflow:
    'Controls whether the backend main-agent monitor can inspect active and recent runs for this workflow. Turning it off exempts the workflow from monitoring and stores the exemption reason.',
  monitoringLevel:
    'Sets the backend monitoring intensity. Minimal should generate fewer checks, standard is the default policy, and strict allows tighter supervision where the backend supports it.',
  selfMonitoring:
    'Only applies to the main agent default workflow. When enabled, the main-agent monitor is allowed to monitor the main agent workflow itself.',
  exemptionReason:
    'Explains why monitoring is disabled. This is saved only while monitoring is off and helps operators understand the exemption later.',
  tokenSupervision:
    'Allows the monitor to watch token usage and budget-related signals reported by workflow runs.',
  contextSupervision:
    'Allows the monitor to watch context-window health, compaction, and related run diagnostics.',
  toolSupervision:
    'Allows the monitor to create findings or proposals from tool failures reported by workflow runs.',
  improvementProposals:
    'Lets the monitor turn run findings into workflow-improvement proposals instead of recording findings only.',
  proposalApprovals:
    'Routes monitor improvement proposals through approval controls so operators can approve, reject, or request changes.',
  subagentSupervision:
    'Controls whether sub-agent nodes are supervised. Disabling it marks agent nodes as not supervised in the graph overlay.',
  steeringApprovals:
    'Routes monitor steering requests through approval controls before they are applied, instead of treating them as direct operational actions.',
  hitlDelegation:
    'Lets the main agent handle eligible human-in-the-loop checkpoints. Run details show whether HITL is delegated to the main agent or held for a human.',
  excludedSubagents:
    'Removes selected sub-agents from monitor supervision. Tasks assigned to excluded agents are shown as excluded in the graph overlay.',
  excludedTasks:
    'Removes selected tasks from monitor supervision. Excluded task nodes are labeled as excluded in the graph overlay.',
  allowedSteering:
    'Limits the steering actions the monitor may request, such as human review, replanning, pausing, canceling, or reducing tool scope.',
  autoApplySteering:
    'Selects operational steering actions the backend may auto-apply without a separate manual approval when policy allows it.',
};

function toggleListValue(values: string[] | null | undefined, value: string, checked: boolean) {
  const current = new Set(values ?? []);
  if (checked) {
    current.add(value);
  } else {
    current.delete(value);
  }
  return Array.from(current).sort();
}

function boolControlLabel(value: boolean | undefined) {
  return value === false ? 'Disabled' : 'Enabled';
}

function optInControlLabel(value: boolean | undefined) {
  return value === true ? 'Enabled' : 'Disabled';
}

function formatListSummary(values: string[], options: MonitoringOption[]) {
  if (values.length === 0) {
    return 'None';
  }

  const labelsById = new Map(options.map((option) => [option.id, option.label]));
  const labels = values.map((value) => labelsById.get(value) ?? value);
  const visibleLabels = labels.slice(0, 2);

  return `${visibleLabels.join(', ')}${labels.length > visibleLabels.length ? ` +${labels.length - visibleLabels.length}` : ''}`;
}

function OptionCheckboxList({
  title,
  help,
  emptyLabel,
  options,
  values,
  disabled,
  className = '',
  listClassName = '',
  onChange,
}: {
  title: string;
  help?: ReactNode;
  emptyLabel: string;
  options: MonitoringOption[];
  values: string[];
  disabled: boolean;
  className?: string;
  listClassName?: string;
  onChange: (values: string[]) => void;
}) {
  return (
    <div
      className={`rounded-md border border-neutral-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-slate-950/72 ${className}`}
    >
      <div className="mb-2">
        <WorkflowFieldLabel label={title} help={help} />
      </div>
      {options.length === 0 ? (
        <p className="text-xs text-neutral-500 dark:text-slate-400">{emptyLabel}</p>
      ) : (
        <div className={`grid gap-2 ${listClassName}`}>
          {options.map((option) => {
            const checked = values.includes(option.id);
            return (
              <label
                key={option.id}
                className="flex cursor-pointer items-start gap-2 text-sm leading-5 text-neutral-700 has-disabled:cursor-not-allowed dark:text-slate-300"
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  className="cursor-pointer disabled:cursor-not-allowed"
                  onCheckedChange={(value) =>
                    onChange(toggleListValue(values, option.id, value === true))
                  }
                />
                <span className="min-w-0 wrap-break-word">{option.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
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
  agentOptions = [],
  taskOptions = [],
  isSaving,
  exemptionReason,
  onExemptionReasonChange,
  onMonitoringEnabledChange,
  onExemptionReasonSave,
  onAllowSelfMonitoringChange,
  onMonitorControlChange,
}: WorkflowMonitoringControlsProps) {
  const monitoringEnabled = monitoring?.enabled !== false;
  const allowSelfMonitoring = monitoring?.controls?.allow_self_monitoring === true;
  const showSelfMonitoring = monitoring?.is_main_agent_default_workflow === true;
  const exemption = typeof monitoring?.reason === 'string' ? monitoring.reason : '';
  const controls = monitoring?.controls;
  const allowedSteeringActions = controls?.allowed_steering_actions ?? [];
  const autoApplySteeringActions = controls?.auto_apply_steering_actions ?? [];
  const excludedSubagentIds = controls?.excluded_subagent_ids ?? [];
  const excludedTaskIds = controls?.excluded_task_ids ?? [];
  const controlsDisabled = isSaving || !onMonitorControlChange;
  const selectedMonitoringLevel = monitoringLevels.some(
    (level) => level.value === monitoring?.level
  )
    ? monitoring?.level
    : 'standard';
  const renderControlCheckbox = (
    key: MonitoringControlKey,
    accessibleLabel: string,
    checked: boolean,
    disabled = controlsDisabled
  ) => (
    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-neutral-900 has-disabled:cursor-not-allowed dark:text-slate-100">
      <Checkbox
        aria-label={accessibleLabel}
        checked={checked}
        disabled={disabled}
        className="cursor-pointer disabled:cursor-not-allowed"
        onCheckedChange={(value) => onMonitorControlChange?.(key, value === true)}
      />
      <WorkflowBooleanState enabled={checked} />
    </label>
  );
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
      <CardTitle className="text-base">Main agent monitoring</CardTitle>
      <CardDescription>
        Workflow-level controls for the background main-agent monitor.
      </CardDescription>
    </div>
  );

  const content = editable ? (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        <WorkflowSettingsSection
          title="Policy"
          description="Start with the baseline monitoring posture and how this workflow is allowed to participate."
          tone="emerald"
        >
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <WorkflowSummaryField label="Monitoring level" help={helpText.monitoringLevel}>
              <Label className="sr-only" htmlFor="workflow-monitoring-level">
                Monitoring level
              </Label>
              <Select
                value={selectedMonitoringLevel}
                disabled={controlsDisabled}
                onValueChange={(value) => onMonitorControlChange?.('level', value)}
              >
                <SelectTrigger id="workflow-monitoring-level" className="h-11 w-full">
                  <SelectValue placeholder="Monitoring level" />
                </SelectTrigger>
                <SelectContent>
                  {monitoringLevels.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </WorkflowSummaryField>

            <WorkflowSummaryField label="Monitor workflow" help={helpText.monitorWorkflow}>
              <label className="flex cursor-pointer items-center gap-2 font-medium text-neutral-900 has-disabled:cursor-not-allowed dark:text-slate-100">
                <Checkbox
                  id="workflow-monitoring-enabled"
                  checked={monitoringEnabled}
                  disabled={isSaving}
                  className="cursor-pointer disabled:cursor-not-allowed"
                  onCheckedChange={(value) => onMonitoringEnabledChange(value === true)}
                />
                <span>Monitor this workflow</span>
              </label>
              <p className="mt-1 text-xs text-neutral-500 dark:text-slate-400">
                Allows the main-agent monitor to inspect this workflow&apos;s active and recent
                runs.
              </p>
            </WorkflowSummaryField>

            <WorkflowSummaryField label="Self monitoring" help={helpText.selfMonitoring}>
              {showSelfMonitoring ? (
                <label className="flex cursor-pointer items-center gap-2 font-medium text-neutral-900 has-disabled:cursor-not-allowed dark:text-slate-100">
                  <Checkbox
                    id="allow-self-monitoring"
                    checked={allowSelfMonitoring}
                    disabled={isSaving}
                    className="cursor-pointer disabled:cursor-not-allowed"
                    onCheckedChange={(value) => onAllowSelfMonitoringChange(value === true)}
                  />
                  <span>Monitor this main-agent workflow</span>
                </label>
              ) : (
                <div className="font-medium text-neutral-900 dark:text-slate-100">
                  Not applicable
                </div>
              )}
            </WorkflowSummaryField>

            <WorkflowSummaryField
              label="Exemption reason"
              help={helpText.exemptionReason}
              className="sm:col-span-2"
            >
              <div className="flex flex-col gap-2 xl:flex-row">
                <Label className="sr-only" htmlFor="workflow-monitoring-exemption-reason">
                  Exemption reason
                </Label>
                <Input
                  id="workflow-monitoring-exemption-reason"
                  value={exemptionReason}
                  disabled={isSaving || monitoringEnabled}
                  onChange={(event) => onExemptionReasonChange(event.target.value)}
                  onBlur={onExemptionReasonSave}
                  placeholder="Human-managed workflow; do not monitor automatically."
                />
                <button
                  type="button"
                  disabled={isSaving || monitoringEnabled}
                  onClick={onExemptionReasonSave}
                  className="h-10 rounded-md border border-neutral-200 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/6"
                >
                  Save reason
                </button>
              </div>
            </WorkflowSummaryField>
          </div>
        </WorkflowSettingsSection>

        <WorkflowSettingsSection
          title="Review behavior"
          description="Configure how the monitor turns findings into approvals, guidance, and human handoff."
          tone="amber"
        >
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <WorkflowSummaryField
              label="Improvement proposals"
              help={helpText.improvementProposals}
            >
              {renderControlCheckbox(
                'allow_improvement_proposals',
                'Improvement proposals',
                controls?.allow_improvement_proposals === true
              )}
              <p className="mt-1 text-xs text-neutral-500 dark:text-slate-400">
                When disabled, the monitor records findings but does not draft workflow changes.
              </p>
            </WorkflowSummaryField>

            <WorkflowSummaryField label="Proposal approvals" help={helpText.proposalApprovals}>
              {renderControlCheckbox(
                'route_improvement_proposals_to_approval',
                'Approval-routed proposals',
                controls?.route_improvement_proposals_to_approval === true
              )}
            </WorkflowSummaryField>

            <WorkflowSummaryField label="Steering approvals" help={helpText.steeringApprovals}>
              {renderControlCheckbox(
                'route_steering_requests_to_approval',
                'Approval-gated steering',
                controls?.route_steering_requests_to_approval === true
              )}
            </WorkflowSummaryField>

            <WorkflowSummaryField label="HITL delegation" help={helpText.hitlDelegation}>
              {renderControlCheckbox(
                'delegate_hitl_to_main_agent',
                'Delegate HITL to main agent',
                controls?.delegate_hitl_to_main_agent === true
              )}
            </WorkflowSummaryField>
          </div>
        </WorkflowSettingsSection>

        <WorkflowSettingsSection
          title="Supervision scope"
          description="Choose what the monitor watches by default and which agents or tasks are excluded from its coverage."
          tone="sky"
        >
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <WorkflowSummaryField label="Token supervision" help={helpText.tokenSupervision}>
              {renderControlCheckbox(
                'supervise_token_usage',
                'Token usage',
                controls?.supervise_token_usage !== false
              )}
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Context supervision" help={helpText.contextSupervision}>
              {renderControlCheckbox(
                'supervise_context_health',
                'Context health',
                controls?.supervise_context_health !== false
              )}
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Tool supervision" help={helpText.toolSupervision}>
              {renderControlCheckbox(
                'supervise_tool_failures',
                'Tool failures',
                controls?.supervise_tool_failures !== false
              )}
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Sub-agent supervision" help={helpText.subagentSupervision}>
              {renderControlCheckbox(
                'supervise_subagents',
                'Sub-agents',
                controls?.supervise_subagents !== false
              )}
            </WorkflowSummaryField>

            <div className="sm:col-span-2 xl:grid xl:grid-cols-2 xl:gap-3">
              <OptionCheckboxList
                title="Excluded sub-agents"
                help={helpText.excludedSubagents}
                emptyLabel="No workflow agents available."
                options={agentOptions}
                values={excludedSubagentIds}
                disabled={controlsDisabled}
                className="h-full"
                listClassName="max-h-80 overflow-y-auto pr-1"
                onChange={(values) => onMonitorControlChange?.('excluded_subagent_ids', values)}
              />
              <OptionCheckboxList
                title="Excluded tasks"
                help={helpText.excludedTasks}
                emptyLabel="No workflow tasks available."
                options={taskOptions}
                values={excludedTaskIds}
                disabled={controlsDisabled}
                className="h-full"
                listClassName="max-h-80 overflow-y-auto pr-1"
                onChange={(values) => onMonitorControlChange?.('excluded_task_ids', values)}
              />
            </div>
          </div>
        </WorkflowSettingsSection>

        <WorkflowSettingsSection
          title="Steering permissions"
          description="Limit what the monitor is allowed to request, and which operational actions can be applied automatically."
        >
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2 xl:grid xl:grid-cols-2 xl:gap-3">
              <OptionCheckboxList
                title="Allowed steering"
                help={helpText.allowedSteering}
                emptyLabel="No steering actions available."
                options={steeringActionOptions}
                values={allowedSteeringActions}
                disabled={controlsDisabled}
                className="h-full"
                listClassName="sm:grid-cols-2 xl:grid-cols-1"
                onChange={(values) => onMonitorControlChange?.('allowed_steering_actions', values)}
              />

              <OptionCheckboxList
                title="Auto-apply steering"
                help={helpText.autoApplySteering}
                emptyLabel="No operational steering actions available."
                options={autoApplySteeringActionOptions}
                values={autoApplySteeringActions}
                disabled={controlsDisabled}
                className="h-full"
                listClassName="sm:grid-cols-2 xl:grid-cols-1"
                onChange={(values) =>
                  onMonitorControlChange?.('auto_apply_steering_actions', values)
                }
              />
            </div>
          </div>
        </WorkflowSettingsSection>
      </div>
    </TooltipProvider>
  ) : (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        <WorkflowSettingsSection
          title="Policy"
          description="Baseline monitoring posture and workflow participation."
          tone="emerald"
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <WorkflowReadOnlySummaryField label="Monitoring level" help={helpText.monitoringLevel}>
              {statusLabel(monitoring)}
            </WorkflowReadOnlySummaryField>
            <WorkflowReadOnlySummaryField label="Monitor workflow" help={helpText.monitorWorkflow}>
              {monitoringEnabled ? 'Enabled' : 'Disabled'}
            </WorkflowReadOnlySummaryField>
            <WorkflowReadOnlySummaryField label="Self monitoring" help={helpText.selfMonitoring}>
              {showSelfMonitoring
                ? allowSelfMonitoring
                  ? 'Allowed'
                  : 'Not allowed'
                : 'Not applicable'}
            </WorkflowReadOnlySummaryField>
            <WorkflowReadOnlySummaryField label="Exemption reason" help={helpText.exemptionReason}>
              {exemption || 'None'}
            </WorkflowReadOnlySummaryField>
          </dl>
        </WorkflowSettingsSection>

        <WorkflowSettingsSection
          title="Review behavior"
          description="How findings become approvals, guidance, and human handoff."
          tone="amber"
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <WorkflowReadOnlySummaryField
              label="Improvement proposals"
              help={helpText.improvementProposals}
            >
              {optInControlLabel(controls?.allow_improvement_proposals)}
            </WorkflowReadOnlySummaryField>
            <WorkflowReadOnlySummaryField
              label="Proposal approvals"
              help={helpText.proposalApprovals}
            >
              {optInControlLabel(controls?.route_improvement_proposals_to_approval)}
            </WorkflowReadOnlySummaryField>
            <WorkflowReadOnlySummaryField
              label="Steering approvals"
              help={helpText.steeringApprovals}
            >
              {optInControlLabel(controls?.route_steering_requests_to_approval)}
            </WorkflowReadOnlySummaryField>
            <WorkflowReadOnlySummaryField label="HITL delegation" help={helpText.hitlDelegation}>
              {optInControlLabel(controls?.delegate_hitl_to_main_agent)}
            </WorkflowReadOnlySummaryField>
          </dl>
        </WorkflowSettingsSection>

        <WorkflowSettingsSection
          title="Supervision scope"
          description="Default watch surfaces and excluded workflow nodes."
          tone="sky"
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <WorkflowReadOnlySummaryField
              label="Token supervision"
              help={helpText.tokenSupervision}
            >
              {boolControlLabel(controls?.supervise_token_usage)}
            </WorkflowReadOnlySummaryField>
            <WorkflowReadOnlySummaryField
              label="Context supervision"
              help={helpText.contextSupervision}
            >
              {boolControlLabel(controls?.supervise_context_health)}
            </WorkflowReadOnlySummaryField>
            <WorkflowReadOnlySummaryField label="Tool supervision" help={helpText.toolSupervision}>
              {boolControlLabel(controls?.supervise_tool_failures)}
            </WorkflowReadOnlySummaryField>
            <WorkflowReadOnlySummaryField
              label="Sub-agent supervision"
              help={helpText.subagentSupervision}
            >
              {boolControlLabel(controls?.supervise_subagents)}
            </WorkflowReadOnlySummaryField>
            <WorkflowReadOnlySummaryField
              label="Excluded sub-agents"
              help={helpText.excludedSubagents}
              className="sm:col-span-2 xl:col-span-1"
            >
              {formatListSummary(excludedSubagentIds, agentOptions)}
            </WorkflowReadOnlySummaryField>
            <WorkflowReadOnlySummaryField
              label="Excluded tasks"
              help={helpText.excludedTasks}
              className="sm:col-span-2 xl:col-span-1"
            >
              {formatListSummary(excludedTaskIds, taskOptions)}
            </WorkflowReadOnlySummaryField>
          </dl>
        </WorkflowSettingsSection>

        <WorkflowSettingsSection
          title="Steering permissions"
          description="Allowed monitor requests and automatic operational actions."
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <WorkflowReadOnlySummaryField label="Allowed steering" help={helpText.allowedSteering}>
              {formatListSummary(allowedSteeringActions, steeringActionOptions)}
            </WorkflowReadOnlySummaryField>
            <WorkflowReadOnlySummaryField
              label="Auto-apply steering"
              help={helpText.autoApplySteering}
            >
              {formatListSummary(autoApplySteeringActions, autoApplySteeringActionOptions)}
            </WorkflowReadOnlySummaryField>
          </dl>
        </WorkflowSettingsSection>
      </div>
    </TooltipProvider>
  );

  if (frame === 'inline') {
    return (
      <section className="workflow-surface-monitoring space-y-4 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
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
            <section className="workflow-surface-monitoring space-y-4 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
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
