import { describe, expect, it } from 'vitest';
import {
  AGENTIC_TASK_TEMPLATES,
  createAgenticTaskTemplateDraft,
  createCapabilityStarterTaskDraft,
  workflowTaskStarterTemplate,
} from '@/lib/workflows/capabilityTaskTemplates';

describe('capabilityTaskTemplates', () => {
  it('returns a capability-aware add-task template', () => {
    const template = workflowTaskStarterTemplate(['home-control'], 0);

    expect(template).toMatchObject({
      label: 'Smart Home control',
      addTaskLabel: 'Add Smart Home Task',
    });
  });

  it('creates a capability-aware starter task draft', () => {
    expect(createCapabilityStarterTaskDraft(['vision'], 0)).toMatchObject({
      name: 'Vision task 1',
      description: expect.stringContaining('imagery'),
      expected_output: 'Structured scene analysis or visual summary',
    });
  });

  it('guides home-control workflow tasks toward canonical device tools', () => {
    expect(createCapabilityStarterTaskDraft(['home-control'], 0)).toMatchObject({
      instructions: expect.stringContaining('agency.device.*'),
    });
    expect(createCapabilityStarterTaskDraft(['home-control'], 0)).toMatchObject({
      instructions: expect.stringContaining('home_assistant.* only'),
    });
  });

  it('creates common agentic pattern task drafts', () => {
    expect(AGENTIC_TASK_TEMPLATES.map((template) => template.id)).toEqual([
      'research',
      'critique',
      'implementation',
      'validation',
      'report',
    ]);
    expect(createAgenticTaskTemplateDraft('validation', 2)).toMatchObject({
      name: 'Validation task 3',
      description: expect.stringContaining('Verify'),
      expected_output: 'Validation result with checks performed, evidence, and residual risk',
      metadata: {
        task_template_id: 'validation',
        task_template_label: 'Validation',
      },
    });
  });
});
