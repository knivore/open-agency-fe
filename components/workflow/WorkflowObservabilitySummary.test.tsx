import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import WorkflowObservabilitySummary from '@/components/workflow/WorkflowObservabilitySummary';

describe('WorkflowObservabilitySummary', () => {
  it('renders workflow-scoped model and agent governance metrics', () => {
    render(
      <WorkflowObservabilitySummary
        workflowMetrics={{
          workflow_id: 'workflow-1',
          total_tokens: 1250,
          estimated_cost: 0.0123,
          context_health: {
            latest: {
              status: 'warning',
            },
          },
          budget: {
            warning_count: 2,
            exceeded_count: 1,
          },
          compaction: {
            event_count: 3,
          },
        }}
        modelUsage={{
          items: [
            {
              provider: 'openai',
              model: 'gpt-4.1-mini',
              total_tokens: 1000,
              fallback_count: 1,
              fallback_rate: 0.5,
            },
          ],
          fallback_summary: {
            fallback_count: 1,
            fallback_failure_count: 1,
            fallback_rate: 0.5,
            fallback_primary_models: {
              'openai:gpt-4.1': 1,
            },
            recent_failures: [
              {
                event_id: 'fallback-failed-1',
                execution_id: 'run-1',
                primary_model: 'gpt-4.1',
                error: 'backup model timed out',
              },
            ],
          },
        }}
        agentMetrics={[
          {
            agent_id: 'agent-1',
            total_tokens: 800,
            context_health: {
              latest: {
                status: 'normal',
              },
            },
          },
        ]}
      />
    );

    expect(screen.getByText('Governance observability')).toBeInTheDocument();
    expect(screen.getByText('Context warning')).toBeInTheDocument();
    expect(screen.getByText('1,250')).toBeInTheDocument();
    expect(screen.getByText('$0.01')).toBeInTheDocument();
    expect(screen.getByText('2 warning / 1 exceeded')).toBeInTheDocument();
    expect(screen.getByText('1 used / 1 failed')).toBeInTheDocument();
    expect(screen.getByText('gpt-4.1-mini')).toBeInTheDocument();
    expect(screen.getByText('50.0%')).toBeInTheDocument();
    expect(screen.getByText('openai:gpt-4.1')).toBeInTheDocument();
    expect(screen.getByText('backup model timed out')).toBeInTheDocument();
    expect(screen.getByText('agent-1')).toBeInTheDocument();
    expect(screen.getByText('Context normal')).toBeInTheDocument();
  });

  it('renders empty states before usage exists', () => {
    render(<WorkflowObservabilitySummary workflowMetrics={null} modelUsage={null} />);

    expect(screen.getByText('No model usage recorded yet.')).toBeInTheDocument();
    expect(screen.getByText('No agent usage recorded yet.')).toBeInTheDocument();
  });
});
