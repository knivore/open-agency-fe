'use client';

import { useState } from 'react';
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
  WorkflowSettingsSection,
  WorkflowStateValue,
  WorkflowSummaryField,
} from '@/components/workflow/WorkflowSettingsPrimitives';
import type { WorkflowRuntimeGovernanceOperatorPayload } from '@/types/workflows';

type RuntimeGovernancePatch =
  | {
      tokenBudget: Record<string, number | string | null>;
    }
  | {
      contextCompaction: Record<string, number | boolean | null>;
    }
  | {
      executionPolicy: Record<string, number | string | null>;
    };

interface WorkflowRuntimeGovernanceControlsProps {
  editable?: boolean;
  frame?: 'card' | 'inline';
  governance?: WorkflowRuntimeGovernanceOperatorPayload | null;
  isSaving: boolean;
  onGovernanceChange?: (patch: RuntimeGovernancePatch) => void;
}

const budgetActionOptions = [
  { value: 'warn_only', label: 'Warn only' },
  { value: 'compact_context', label: 'Compact context' },
  { value: 'pause_execution', label: 'Pause execution' },
  { value: 'fail_execution', label: 'Fail execution' },
];

const approvalModeOptions = [
  { value: 'task_policy', label: 'Task policy' },
  { value: 'before_run', label: 'Before run' },
  { value: 'all_tasks', label: 'All tasks' },
];

const helpText = {
  runTotalTokens: 'Maximum tokens allowed for one workflow run before the budget action applies.',
  workflowTotalTokens:
    'Maximum cumulative tokens allowed for this workflow across runs where backend aggregation is available.',
  agentTotalTokens: 'Maximum cumulative tokens allowed for an individual agent or sub-agent.',
  warnRatio: 'Budget ratio that emits warning events before the hard limit is reached.',
  hardRatio: 'Budget ratio that emits exceeded events and applies the selected action.',
  action: 'Backend action to apply when the token budget is exceeded.',
  compactionEnabled:
    'Allows native runtime context compaction when context health or budget policy requires it.',
  persistContextPack:
    'Persists compacted runtime summaries as workflow context packs when enabled.',
  preserveRecentMessages: 'Number of recent assistant/tool messages kept raw after compaction.',
  oversizedMessageTokens: 'Message size threshold used by compaction safeguards.',
  minEstimatedTokensSaved:
    'Minimum estimated savings required before compaction is considered useful.',
  maxSummaryChars: 'Maximum character length for deterministic compacted summaries.',
  maxRuntimeSeconds: 'Maximum wall-clock seconds allowed for a native workflow run.',
  maxRetries: 'Default retry count for tasks that do not define their own retry limit.',
  concurrencyLimit:
    'Maximum task concurrency requested for the workflow. The native runtime currently enforces serial execution.',
  approvalMode: 'Workflow-level approval policy applied before or during task execution.',
};

function displayNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

function parseNumberInput(value: string, mode: 'int' | 'float') {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = mode === 'int' ? Number.parseInt(trimmed, 10) : Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function GovernanceNumberInput({
  id,
  label,
  value,
  mode = 'int',
  step,
  min,
  max,
  disabled,
  onCommit,
}: {
  id: string;
  label: string;
  value: number | null | undefined;
  mode?: 'int' | 'float';
  step?: string;
  min?: number;
  max?: number;
  disabled: boolean;
  onCommit: (value: number | null) => void;
}) {
  const sourceValue = displayNumber(value);
  const [draft, setDraft] = useState(() => ({ sourceValue, value: sourceValue }));
  const inputValue = draft.sourceValue === sourceValue ? draft.value : sourceValue;

  return (
    <>
      <Label className="sr-only" htmlFor={id}>
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        className="h-11 w-full"
        value={inputValue}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => setDraft({ sourceValue, value: event.currentTarget.value })}
        onBlur={() => onCommit(parseNumberInput(inputValue, mode))}
      />
    </>
  );
}

function readOnlyNumber(value: number | null | undefined, fallback = 'Not set') {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : fallback;
}

function budgetConfigurationLabel(configured: boolean | null | undefined) {
  return configured ? 'Budget set' : 'Using defaults';
}

function policyConfigurationLabel(configured: boolean | null | undefined) {
  return configured ? 'Policy set' : 'Policy defaults';
}

function persistContextPackSourceLabel(source: string | null | undefined) {
  if (source === 'workflow') {
    return 'Workflow override';
  }
  if (source === 'global_default') {
    return 'Global default';
  }
  return 'Unknown';
}

export default function WorkflowRuntimeGovernanceControls({
  editable = true,
  frame = 'card',
  governance,
  isSaving,
  onGovernanceChange,
}: WorkflowRuntimeGovernanceControlsProps) {
  const tokenBudget = governance?.token_budget;
  const contextCompaction = governance?.context_compaction;
  const executionPolicy = governance?.execution_policy;
  const controlsDisabled = isSaving || !onGovernanceChange;
  const selectedAction = budgetActionOptions.some((option) => option.value === tokenBudget?.action)
    ? String(tokenBudget?.action)
    : 'warn_only';
  const selectedApprovalMode = approvalModeOptions.some(
    (option) => option.value === executionPolicy?.approval_mode
  )
    ? String(executionPolicy?.approval_mode)
    : 'task_policy';

  const header = (
    <div className="space-y-1.5">
      <CardTitle className="text-base">Runtime governance</CardTitle>
      <CardDescription>Execution policy, token budget, and context compaction controls.</CardDescription>
    </div>
  );

  const editableContent = (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        <WorkflowSettingsSection
          title="Budget policy"
          description="Set the token budget source, limits, and action when a run crosses the hard threshold."
          tone="amber"
        >
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <WorkflowSummaryField
              label="Policy source"
              help="Shows whether this workflow has an explicit token budget policy or is inheriting backend defaults."
            >
              <WorkflowStateValue>
                {budgetConfigurationLabel(tokenBudget?.configured)}
              </WorkflowStateValue>
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Budget action" help={helpText.action}>
              <Label className="sr-only" htmlFor="workflow-runtime-budget-action">
                Budget action
              </Label>
              <Select
                value={selectedAction}
                disabled={controlsDisabled}
                onValueChange={(value) => onGovernanceChange?.({ tokenBudget: { action: value } })}
              >
                <SelectTrigger id="workflow-runtime-budget-action" className="h-11 w-full">
                  <SelectValue placeholder="Budget action" />
                </SelectTrigger>
                <SelectContent>
                  {budgetActionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </WorkflowSummaryField>
            <WorkflowSummaryField
              label="Persist source"
              help="Shows whether persist context pack is explicitly saved on this workflow or still inheriting the global default."
            >
              <WorkflowStateValue>
                {persistContextPackSourceLabel(contextCompaction?.persist_context_pack_source)}
              </WorkflowStateValue>
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Run limit" help={helpText.runTotalTokens}>
              <GovernanceNumberInput
                id="workflow-runtime-run-token-limit"
                label="Run token limit"
                value={tokenBudget?.run_total_tokens}
                min={0}
                disabled={controlsDisabled}
                onCommit={(value) =>
                  onGovernanceChange?.({ tokenBudget: { runTotalTokens: value } })
                }
              />
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Workflow limit" help={helpText.workflowTotalTokens}>
              <GovernanceNumberInput
                id="workflow-runtime-workflow-token-limit"
                label="Workflow token limit"
                value={tokenBudget?.workflow_total_tokens}
                min={0}
                disabled={controlsDisabled}
                onCommit={(value) =>
                  onGovernanceChange?.({ tokenBudget: { workflowTotalTokens: value } })
                }
              />
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Agent limit" help={helpText.agentTotalTokens}>
              <GovernanceNumberInput
                id="workflow-runtime-agent-token-limit"
                label="Agent token limit"
                value={tokenBudget?.agent_total_tokens}
                min={0}
                disabled={controlsDisabled}
                onCommit={(value) =>
                  onGovernanceChange?.({ tokenBudget: { agentTotalTokens: value } })
                }
              />
            </WorkflowSummaryField>
          </div>
        </WorkflowSettingsSection>

        <WorkflowSettingsSection
          title="Execution policy"
          description="Set run deadline, retry defaults, concurrency cap, and workflow approval behavior."
        >
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <WorkflowSummaryField
              label="Policy source"
              help="Shows whether this workflow has explicit execution policy fields."
            >
              <WorkflowStateValue>
                {policyConfigurationLabel(executionPolicy?.configured)}
              </WorkflowStateValue>
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Approval mode" help={helpText.approvalMode}>
              <Label className="sr-only" htmlFor="workflow-runtime-approval-mode">
                Approval mode
              </Label>
              <Select
                value={selectedApprovalMode}
                disabled={controlsDisabled}
                onValueChange={(value) =>
                  onGovernanceChange?.({ executionPolicy: { approvalMode: value } })
                }
              >
                <SelectTrigger id="workflow-runtime-approval-mode" className="h-11 w-full">
                  <SelectValue placeholder="Approval mode" />
                </SelectTrigger>
                <SelectContent>
                  {approvalModeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Max runtime" help={helpText.maxRuntimeSeconds}>
              <GovernanceNumberInput
                id="workflow-runtime-max-runtime"
                label="Max runtime"
                value={executionPolicy?.max_runtime_seconds}
                min={1}
                disabled={controlsDisabled}
                onCommit={(value) =>
                  onGovernanceChange?.({ executionPolicy: { maxRuntimeSeconds: value } })
                }
              />
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Max retries" help={helpText.maxRetries}>
              <GovernanceNumberInput
                id="workflow-runtime-max-retries"
                label="Max retries"
                value={executionPolicy?.max_retries}
                min={0}
                disabled={controlsDisabled}
                onCommit={(value) =>
                  onGovernanceChange?.({ executionPolicy: { maxRetries: value } })
                }
              />
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Concurrency cap" help={helpText.concurrencyLimit}>
              <GovernanceNumberInput
                id="workflow-runtime-concurrency-limit"
                label="Concurrency cap"
                value={executionPolicy?.concurrency_limit}
                min={1}
                disabled={controlsDisabled}
                onCommit={(value) =>
                  onGovernanceChange?.({ executionPolicy: { concurrencyLimit: value } })
                }
              />
            </WorkflowSummaryField>
            <WorkflowSummaryField
              label="Effective cap"
              help="Concurrency enforced by the selected runtime adapter."
            >
              <WorkflowStateValue>
                {readOnlyNumber(executionPolicy?.effective_concurrency_limit)}
              </WorkflowStateValue>
            </WorkflowSummaryField>
          </div>
        </WorkflowSettingsSection>

        <WorkflowSettingsSection
          title="Thresholds"
          description="Tune the warning and hard-stop ratios used by the selected budget action."
        >
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <WorkflowSummaryField label="Warn ratio" help={helpText.warnRatio}>
              <GovernanceNumberInput
                id="workflow-runtime-warn-ratio"
                label="Warn ratio"
                value={tokenBudget?.warn_ratio}
                mode="float"
                min={0}
                max={1}
                step="0.01"
                disabled={controlsDisabled}
                onCommit={(value) => onGovernanceChange?.({ tokenBudget: { warnRatio: value } })}
              />
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Hard ratio" help={helpText.hardRatio}>
              <GovernanceNumberInput
                id="workflow-runtime-hard-ratio"
                label="Hard ratio"
                value={tokenBudget?.hard_ratio}
                mode="float"
                min={0}
                max={1}
                step="0.01"
                disabled={controlsDisabled}
                onCommit={(value) => onGovernanceChange?.({ tokenBudget: { hardRatio: value } })}
              />
            </WorkflowSummaryField>
          </div>
        </WorkflowSettingsSection>

        <WorkflowSettingsSection
          title="Context compaction"
          description="Control when runtime context is summarized and whether compacted packs are retained for later runs."
          tone="sky"
        >
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <WorkflowSummaryField label="Compaction" help={helpText.compactionEnabled}>
              <label className="flex cursor-pointer items-center gap-2 font-medium text-neutral-900 has-disabled:cursor-not-allowed dark:text-slate-100">
                <Checkbox
                  aria-label="Enable context compaction"
                  checked={contextCompaction?.enabled !== false}
                  disabled={controlsDisabled}
                  className="cursor-pointer disabled:cursor-not-allowed"
                  onCheckedChange={(value) =>
                    onGovernanceChange?.({ contextCompaction: { enabled: value === true } })
                  }
                />
                <WorkflowBooleanState enabled={contextCompaction?.enabled !== false} />
              </label>
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Persist pack" help={helpText.persistContextPack}>
              <label className="flex cursor-pointer items-center gap-2 font-medium text-neutral-900 has-disabled:cursor-not-allowed dark:text-slate-100">
                <Checkbox
                  aria-label="Persist context pack"
                  checked={contextCompaction?.persist_context_pack === true}
                  disabled={controlsDisabled}
                  className="cursor-pointer disabled:cursor-not-allowed"
                  onCheckedChange={(value) =>
                    onGovernanceChange?.({
                      contextCompaction: { persistContextPack: value === true },
                    })
                  }
                />
                <WorkflowBooleanState enabled={contextCompaction?.persist_context_pack === true} />
              </label>
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Preserve recent" help={helpText.preserveRecentMessages}>
              <GovernanceNumberInput
                id="workflow-runtime-preserve-recent"
                label="Preserve recent"
                value={contextCompaction?.preserve_recent_messages}
                min={0}
                max={10}
                disabled={controlsDisabled}
                onCommit={(value) =>
                  onGovernanceChange?.({ contextCompaction: { preserveRecentMessages: value } })
                }
              />
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Oversized message" help={helpText.oversizedMessageTokens}>
              <GovernanceNumberInput
                id="workflow-runtime-oversized-message"
                label="Oversized message"
                value={contextCompaction?.oversized_message_tokens}
                min={50}
                disabled={controlsDisabled}
                onCommit={(value) =>
                  onGovernanceChange?.({ contextCompaction: { oversizedMessageTokens: value } })
                }
              />
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Minimum savings" help={helpText.minEstimatedTokensSaved}>
              <GovernanceNumberInput
                id="workflow-runtime-minimum-savings"
                label="Minimum savings"
                value={contextCompaction?.min_estimated_tokens_saved}
                min={0}
                disabled={controlsDisabled}
                onCommit={(value) =>
                  onGovernanceChange?.({ contextCompaction: { minEstimatedTokensSaved: value } })
                }
              />
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Summary length" help={helpText.maxSummaryChars}>
              <GovernanceNumberInput
                id="workflow-runtime-summary-length"
                label="Summary length"
                value={contextCompaction?.max_summary_chars}
                min={1200}
                max={20000}
                disabled={controlsDisabled}
                onCommit={(value) =>
                  onGovernanceChange?.({ contextCompaction: { maxSummaryChars: value } })
                }
              />
            </WorkflowSummaryField>
          </div>
        </WorkflowSettingsSection>
      </div>
    </TooltipProvider>
  );

  const readOnlyContent = (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        <WorkflowSettingsSection
          title="Budget policy"
          description="Token budget source, limits, and the action applied when a run crosses the hard threshold."
          tone="amber"
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <WorkflowSummaryField
              label="Policy source"
              help="Shows whether this workflow has an explicit token budget policy or is inheriting backend defaults."
            >
              <WorkflowStateValue>
                {budgetConfigurationLabel(tokenBudget?.configured)}
              </WorkflowStateValue>
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Budget action" help={helpText.action}>
              <WorkflowStateValue>
                {budgetActionOptions.find((option) => option.value === selectedAction)?.label ??
                  selectedAction}
              </WorkflowStateValue>
            </WorkflowSummaryField>
            <WorkflowSummaryField
              label="Persist source"
              help="Shows whether persist context pack is explicitly saved on this workflow or still inheriting the global default."
            >
              <WorkflowStateValue>
                {persistContextPackSourceLabel(contextCompaction?.persist_context_pack_source)}
              </WorkflowStateValue>
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Run limit" help={helpText.runTotalTokens}>
              <WorkflowStateValue>
                {readOnlyNumber(tokenBudget?.run_total_tokens)}
              </WorkflowStateValue>
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Workflow limit" help={helpText.workflowTotalTokens}>
              <WorkflowStateValue>
                {readOnlyNumber(tokenBudget?.workflow_total_tokens)}
              </WorkflowStateValue>
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Agent limit" help={helpText.agentTotalTokens}>
              <WorkflowStateValue>
                {readOnlyNumber(tokenBudget?.agent_total_tokens)}
              </WorkflowStateValue>
            </WorkflowSummaryField>
          </dl>
        </WorkflowSettingsSection>

        <WorkflowSettingsSection
          title="Execution policy"
          description="Run deadline, retry defaults, concurrency cap, and workflow approval behavior."
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <WorkflowSummaryField
              label="Policy source"
              help="Shows whether this workflow has explicit execution policy fields."
            >
              <WorkflowStateValue>
                {policyConfigurationLabel(executionPolicy?.configured)}
              </WorkflowStateValue>
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Approval mode" help={helpText.approvalMode}>
              <WorkflowStateValue>
                {approvalModeOptions.find((option) => option.value === selectedApprovalMode)?.label ??
                  selectedApprovalMode}
              </WorkflowStateValue>
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Max runtime" help={helpText.maxRuntimeSeconds}>
              <WorkflowStateValue>
                {readOnlyNumber(executionPolicy?.max_runtime_seconds)}
              </WorkflowStateValue>
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Max retries" help={helpText.maxRetries}>
              <WorkflowStateValue>{readOnlyNumber(executionPolicy?.max_retries)}</WorkflowStateValue>
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Concurrency cap" help={helpText.concurrencyLimit}>
              <WorkflowStateValue>
                {readOnlyNumber(executionPolicy?.concurrency_limit)}
              </WorkflowStateValue>
            </WorkflowSummaryField>
            <WorkflowSummaryField
              label="Effective cap"
              help="Concurrency enforced by the selected runtime adapter."
            >
              <WorkflowStateValue>
                {readOnlyNumber(executionPolicy?.effective_concurrency_limit)}
              </WorkflowStateValue>
            </WorkflowSummaryField>
          </dl>
        </WorkflowSettingsSection>

        <WorkflowSettingsSection
          title="Thresholds"
          description="Warning and hard-stop ratios used by the selected budget action."
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <WorkflowSummaryField label="Warn ratio" help={helpText.warnRatio}>
              <WorkflowStateValue>{readOnlyNumber(tokenBudget?.warn_ratio)}</WorkflowStateValue>
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Hard ratio" help={helpText.hardRatio}>
              <WorkflowStateValue>{readOnlyNumber(tokenBudget?.hard_ratio)}</WorkflowStateValue>
            </WorkflowSummaryField>
          </dl>
        </WorkflowSettingsSection>

        <WorkflowSettingsSection
          title="Context compaction"
          description="Runtime context summarization settings and retained compacted packs."
          tone="sky"
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <WorkflowSummaryField label="Compaction" help={helpText.compactionEnabled}>
              <WorkflowBooleanState enabled={contextCompaction?.enabled !== false} />
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Persist pack" help={helpText.persistContextPack}>
              <WorkflowBooleanState enabled={contextCompaction?.persist_context_pack === true} />
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Preserve recent" help={helpText.preserveRecentMessages}>
              <WorkflowStateValue>
                {readOnlyNumber(contextCompaction?.preserve_recent_messages)}
              </WorkflowStateValue>
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Oversized message" help={helpText.oversizedMessageTokens}>
              <WorkflowStateValue>
                {readOnlyNumber(contextCompaction?.oversized_message_tokens)}
              </WorkflowStateValue>
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Minimum savings" help={helpText.minEstimatedTokensSaved}>
              <WorkflowStateValue>
                {readOnlyNumber(contextCompaction?.min_estimated_tokens_saved)}
              </WorkflowStateValue>
            </WorkflowSummaryField>
            <WorkflowSummaryField label="Summary length" help={helpText.maxSummaryChars}>
              <WorkflowStateValue>
                {readOnlyNumber(contextCompaction?.max_summary_chars)}
              </WorkflowStateValue>
            </WorkflowSummaryField>
          </dl>
        </WorkflowSettingsSection>
      </div>
    </TooltipProvider>
  );

  const content = editable ? editableContent : readOnlyContent;

  if (frame === 'inline') {
    return (
      <section className="space-y-4 rounded-md border border-neutral-200 bg-neutral-50/60 p-4 dark:border-white/10 dark:bg-white/3">
        {header}
        {content}
      </section>
    );
  }

  return (
    <Card>
      <CardHeader>{header}</CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
