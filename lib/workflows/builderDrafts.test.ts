import { describe, expect, it } from 'vitest';
import { buildWorkflowDraftFromBuilder } from '@/lib/workflows/builderDrafts';

describe('buildWorkflowDraftFromBuilder', () => {
  it('defaults new builder drafts to the native runtime adapter', () => {
    const workflow = buildWorkflowDraftFromBuilder({
      workflowName: 'Research Workflow',
      workflowDescription: 'Draft workflow',
      tasks: [{ name: 'Task 1', description: 'Do work', expected_output: 'Done', includeTask: true }],
      agents: [{ name: 'Agent 1', role: 'Researcher', instructions: 'Research', backstory: 'Helpful' }],
    });

    expect(workflow.default_runtime_adapter_id).toBe('native');
    expect(workflow.allowed_runtime_adapter_ids).toEqual(['native']);
  });
});
