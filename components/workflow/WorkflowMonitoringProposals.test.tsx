import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WorkflowMonitoringProposals from '@/components/workflow/WorkflowMonitoringProposals';
import type { WorkflowMonitoringEventsResponse } from '@/types/workflows';

const steeringEvents: WorkflowMonitoringEventsResponse = {
  workflow_id: 'workflow-1',
  monitoring: {
    enabled: true,
    level: 'standard',
    exempted: false,
    visible_to_main_agent: true,
    mutable_by_main_agent: true,
    default_enabled: true,
    is_main_agent_default_workflow: true,
    status_label: 'standard',
    controls: {
      enabled: true,
      level: 'standard',
      store_run_summaries: false,
      store_failure_summaries: false,
      allow_improvement_proposals: false,
      allow_evaluation_agent_review: false,
      allow_self_monitoring: false,
      safe_to_summarize: false,
      route_improvement_proposals_to_approval: false,
      route_steering_requests_to_approval: true,
    },
  },
  findings: [],
  proposals: [],
  evaluations: [],
  comparisons: [],
  steering_requests: [],
  steering_applied: [],
  approval_controls: [
    {
      id: 'approval-steering-1',
      approval_type: 'other',
      status: 'pending',
      target_type: 'workflow',
      target_id: 'workflow-1',
      requested_by_agent_id: 'main-agent',
      conversation_id: 'conversation-1',
      origin_message_id: 'message-1',
      summary: 'Supervisor steering requested: request_replan',
      diff_summary: 'Token budget exceeded for run.',
      proposed_payload: {
        recommended_action: 'request_replan',
        operator_parameter_schema: {
          action: 'request_replan',
          fields: [
            {
              name: 'target_task_id',
              label: 'Target task',
              type: 'select',
              default: 'task-1',
              options: [{ value: 'task-1', label: 'Research' }],
            },
            {
              name: 'instructions',
              label: 'Operator instructions',
              type: 'textarea',
            },
          ],
        },
      },
      metadata: { source: 'main_agent_monitor', action: 'supervisor_steering' },
      created_at: '2026-05-18T00:00:00Z',
      updated_at: '2026-05-18T00:00:00Z',
    },
  ],
};

describe('WorkflowMonitoringProposals', () => {
  it('shows findings-only monitor state when proposals are disabled', () => {
    render(
      <WorkflowMonitoringProposals
        events={{
          ...steeringEvents,
          findings: [
            {
              id: 'finding-1',
              execution_id: 'execution-1',
              workflow_id: 'workflow-1',
              event_type: 'monitor.finding.created',
              sequence: 1,
              timestamp: '2026-05-18T00:00:00Z',
              payload: {
                category: 'failed_execution',
                severity: 'medium',
                reason: 'Execution ended with status failed.',
              },
            },
          ],
        }}
        isLoading={false}
        isMutating={false}
        onApprovalDecision={vi.fn()}
      />
    );

    expect(screen.getByText('Monitor review')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Monitoring is active, but workflow-improvement proposals are disabled.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Recent findings')).toBeInTheDocument();
    expect(screen.getByText('failed execution')).toBeInTheDocument();
  });

  it('labels proposals as advisory when no approval request is attached', () => {
    const onSendToMainAgent = vi.fn();
    render(
      <WorkflowMonitoringProposals
        events={{
          ...steeringEvents,
          monitoring: {
            ...steeringEvents.monitoring,
            controls: {
              ...steeringEvents.monitoring.controls,
              allow_improvement_proposals: true,
            },
          },
          proposals: [
            {
              id: 'proposal-1',
              execution_id: 'execution-1',
              workflow_id: 'workflow-1',
              event_type: 'monitor.improvement.proposed',
              sequence: 2,
              payload: {
                proposed_change: {
                  summary: 'Tighten validation instructions.',
                },
                finding: {
                  evidence: [{ execution_id: 'execution-1' }],
                },
              },
              approval_requests: [],
            },
          ],
          approval_controls: [],
        }}
        isLoading={false}
        isMutating={false}
        onSendToMainAgent={onSendToMainAgent}
        onApprovalDecision={vi.fn()}
      />
    );

    expect(screen.getByText('Improvement proposals are advisory-only right now.')).toBeInTheDocument();
    expect(screen.getByText('advisory only')).toBeInTheDocument();
    expect(
      screen.getByText(
        'This proposal is recorded as monitor guidance. Add any operator edits or context before handing it to the main agent for review and implementation.'
      )
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Operator note'), {
      target: { value: 'Please keep the current approval gates and do not widen tool scope.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send to main agent' }));
    expect(onSendToMainAgent).toHaveBeenCalledWith(
      'proposal-1',
      'Please keep the current approval gates and do not widen tool scope.'
    );
  });

  it('shows latest main-agent dispatch state for advisory proposals', () => {
    render(
      <WorkflowMonitoringProposals
        events={{
          ...steeringEvents,
          monitoring: {
            ...steeringEvents.monitoring,
            controls: {
              ...steeringEvents.monitoring.controls,
              allow_improvement_proposals: true,
            },
          },
          proposals: [
            {
              id: 'proposal-2',
              execution_id: 'execution-1',
              workflow_id: 'workflow-1',
              event_type: 'monitor.improvement.proposed',
              sequence: 3,
              payload: {
                proposed_change: {
                  summary: 'Add stronger validation evidence.',
                },
                finding: {
                  evidence: [{ execution_id: 'execution-1' }],
                },
              },
              approval_requests: [],
              dispatches: [
                {
                  message_id: 'message-2',
                  conversation_id: 'conversation-main-agent',
                  created_at: '2026-05-18T02:00:00Z',
                  operator_note: 'Keep the approval boundary explicit.',
                },
              ],
            },
          ],
          approval_controls: [],
        }}
        isLoading={false}
        isMutating={false}
        onSendToMainAgent={vi.fn()}
        onApprovalDecision={vi.fn()}
      />
    );

    expect(screen.getByText('Sent to main agent')).toBeInTheDocument();
    expect(screen.getByText('Keep the approval boundary explicit.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send updated brief' })).toBeInTheDocument();
  });

  it('approves supervisor steering with operator parameters', () => {
    const onApprovalDecision = vi.fn();

    render(
      <WorkflowMonitoringProposals
        events={steeringEvents}
        isLoading={false}
        isMutating={false}
        onApprovalDecision={onApprovalDecision}
      />
    );

    expect(screen.getByText('Approval preview')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Record replan guidance for the execution or revise a mutable workflow after approval.'
      )
    ).toBeInTheDocument();
    expect(screen.getAllByText('Research')).toHaveLength(2);

    fireEvent.change(screen.getByLabelText('Operator instructions'), {
      target: { value: 'Use a shorter validation plan.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    expect(onApprovalDecision).toHaveBeenCalledWith('approval-steering-1', 'approve', {
      target_task_id: 'task-1',
      instructions: 'Use a shorter validation plan.',
    });
  });

  it('blocks invalid supervisor steering parameters before approval', () => {
    const onApprovalDecision = vi.fn();
    const events: WorkflowMonitoringEventsResponse = {
      ...steeringEvents,
      approval_controls: [
        {
          ...steeringEvents.approval_controls[0],
          id: 'approval-steering-max',
          summary: 'Supervisor steering requested: lower_max_iterations',
          proposed_payload: {
            recommended_action: 'lower_max_iterations',
            operator_parameter_schema: {
              action: 'lower_max_iterations',
              fields: [
                {
                  name: 'max_iterations',
                  label: 'Max iterations',
                  type: 'number',
                  min: 1,
                  max: 20,
                },
              ],
            },
          },
        },
      ],
    };

    render(
      <WorkflowMonitoringProposals
        events={events}
        isLoading={false}
        isMutating={false}
        onApprovalDecision={onApprovalDecision}
      />
    );

    fireEvent.change(screen.getByLabelText('Max iterations'), {
      target: { value: '99' },
    });
    const approveButton = screen.getByRole('button', { name: 'Approve' });

    expect(screen.getByRole('alert')).toHaveTextContent('Max iterations must be at most 20.');
    expect(approveButton).toBeDisabled();
    fireEvent.click(approveButton);
    expect(onApprovalDecision).not.toHaveBeenCalled();
  });
});
