import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WorkflowRuntimeGovernanceControls from '@/components/workflow/WorkflowRuntimeGovernanceControls';
import type { WorkflowRuntimeGovernanceOperatorPayload } from '@/types/workflows';

const governance: WorkflowRuntimeGovernanceOperatorPayload = {
  workflow_id: 'workflow-1',
  token_budget: {
    configured: true,
    run_total_tokens: 1000,
    workflow_total_tokens: 10000,
    agent_total_tokens: 2000,
    warn_ratio: 0.8,
    hard_ratio: 1,
    action: 'warn_only',
  },
  context_compaction: {
    enabled: true,
    persist_context_pack: false,
    persist_context_pack_source: 'global_default',
    preserve_recent_messages: 1,
    oversized_message_tokens: 600,
    min_estimated_tokens_saved: 50,
    max_summary_chars: 5000,
  },
  execution_policy: {
    configured: true,
    max_runtime_seconds: 1800,
    max_retries: 2,
    concurrency_limit: 1,
    approval_mode: 'task_policy',
    effective_concurrency_limit: 1,
  },
};

describe('WorkflowRuntimeGovernanceControls', () => {
  it('emits token budget and compaction patches', () => {
    const onGovernanceChange = vi.fn();

    render(
      <WorkflowRuntimeGovernanceControls
        governance={governance}
        isSaving={false}
        onGovernanceChange={onGovernanceChange}
      />
    );

    const runLimit = screen.getByLabelText('Run token limit');
    fireEvent.change(runLimit, { target: { value: '1500' } });
    fireEvent.blur(runLimit);
    expect(onGovernanceChange).toHaveBeenCalledWith({
      tokenBudget: {
        runTotalTokens: 1500,
      },
    });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Persist context pack' }));
    expect(onGovernanceChange).toHaveBeenCalledWith({
      contextCompaction: {
        persistContextPack: true,
      },
    });

    const maxRetries = screen.getByLabelText('Max retries');
    fireEvent.change(maxRetries, { target: { value: '3' } });
    fireEvent.blur(maxRetries);
    expect(onGovernanceChange).toHaveBeenCalledWith({
      executionPolicy: {
        maxRetries: 3,
      },
    });
  });

  it('summarizes read-only runtime governance state', () => {
    render(
      <WorkflowRuntimeGovernanceControls
        editable={false}
        governance={{
          ...governance,
          token_budget: {
            ...governance.token_budget,
            action: 'compact_context',
          },
          context_compaction: {
            ...governance.context_compaction,
            persist_context_pack: true,
          },
        }}
        isSaving={false}
      />
    );

    expect(screen.getByText('Runtime governance')).toBeInTheDocument();
    expect(screen.getByText('Budget set')).toBeInTheDocument();
    expect(screen.getByText('Compact context')).toBeInTheDocument();
    expect(screen.getByText('Task policy')).toBeInTheDocument();
    expect(screen.getAllByText('Enabled').length).toBeGreaterThan(0);
  });
});
