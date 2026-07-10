import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WorkflowMonitoringControls from '@/components/workflow/WorkflowMonitoringControls';
import type { WorkflowMonitoringOperatorPayload } from '@/types/workflows';

const monitoring: WorkflowMonitoringOperatorPayload = {
  enabled: true,
  level: 'standard',
  exempted: false,
  visible_to_main_agent: true,
  mutable_by_main_agent: true,
  default_enabled: true,
  is_main_agent_default_workflow: true,
  status_label: 'Standard',
  controls: {
    enabled: true,
    level: 'standard',
    store_run_summaries: true,
    store_failure_summaries: true,
    allow_improvement_proposals: true,
    allow_evaluation_agent_review: true,
    allow_self_monitoring: false,
    delegate_hitl_to_main_agent: false,
    safe_to_summarize: true,
    route_improvement_proposals_to_approval: true,
    route_steering_requests_to_approval: false,
    supervise_token_usage: true,
    supervise_context_health: true,
    supervise_subagents: true,
    supervise_tool_failures: true,
    excluded_subagent_ids: [],
    excluded_task_ids: [],
    allowed_steering_actions: ['request_human_review'],
    auto_apply_steering_actions: [],
  },
};

describe('WorkflowMonitoringControls', () => {
  it('emits governance control updates for supervision toggles and exclusions', () => {
    const onMonitorControlChange = vi.fn();

    render(
      <WorkflowMonitoringControls
        monitoring={monitoring}
        agentOptions={[{ id: 'agent-1', label: 'Researcher (agent-1)' }]}
        taskOptions={[{ id: 'task-1', label: 'Search (task-1)' }]}
        isSaving={false}
        exemptionReason=""
        onExemptionReasonChange={vi.fn()}
        onMonitoringEnabledChange={vi.fn()}
        onExemptionReasonSave={vi.fn()}
        onAllowSelfMonitoringChange={vi.fn()}
        onMonitorControlChange={onMonitorControlChange}
      />
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Context health' }));
    expect(onMonitorControlChange).toHaveBeenCalledWith('supervise_context_health', false);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Improvement proposals' }));
    expect(onMonitorControlChange).toHaveBeenCalledWith('allow_improvement_proposals', false);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Approval-routed proposals' }));
    expect(onMonitorControlChange).toHaveBeenCalledWith(
      'route_improvement_proposals_to_approval',
      false
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Approval-gated steering' }));
    expect(onMonitorControlChange).toHaveBeenCalledWith(
      'route_steering_requests_to_approval',
      true
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Delegate HITL to main agent' }));
    expect(onMonitorControlChange).toHaveBeenCalledWith('delegate_hitl_to_main_agent', true);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Researcher (agent-1)' }));
    expect(onMonitorControlChange).toHaveBeenCalledWith('excluded_subagent_ids', ['agent-1']);
  });

  it('summarizes read-only supervision and exclusion state', () => {
    render(
      <WorkflowMonitoringControls
        editable={false}
        monitoring={{
          ...monitoring,
          controls: {
            ...monitoring.controls,
            supervise_context_health: false,
            route_steering_requests_to_approval: true,
            delegate_hitl_to_main_agent: true,
            excluded_subagent_ids: ['agent-1'],
          },
        }}
        agentOptions={[{ id: 'agent-1', label: 'Researcher (agent-1)' }]}
        taskOptions={[]}
        isSaving={false}
        exemptionReason=""
        onExemptionReasonChange={vi.fn()}
        onMonitoringEnabledChange={vi.fn()}
        onExemptionReasonSave={vi.fn()}
        onAllowSelfMonitoringChange={vi.fn()}
      />
    );

    expect(screen.getByText('Context supervision')).toBeInTheDocument();
    expect(screen.getByText('Improvement proposals')).toBeInTheDocument();
    expect(screen.getByText('Proposal approvals')).toBeInTheDocument();
    expect(screen.getByText('Steering approvals')).toBeInTheDocument();
    expect(screen.getByText('HITL delegation')).toBeInTheDocument();
    expect(screen.getByText('Researcher (agent-1)')).toBeInTheDocument();
  });
});
