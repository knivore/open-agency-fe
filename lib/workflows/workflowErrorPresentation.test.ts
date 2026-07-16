import { describe, expect, it } from 'vitest';

import { workflowErrorPresentation } from '@/lib/workflows/workflowErrorPresentation';

describe('workflowErrorPresentation', () => {
  it('turns shell security validation failures into actionable language', () => {
    const presentation = workflowErrorPresentation(
      'Shell command tools are disabled by default and require allow_shell=True',
      'Failed to save workflow'
    );

    expect(presentation.title).toBe('Shell command tools are disabled');
    expect(presentation.summary).toContain('command tool');
    expect(presentation.guidance).toContain('security settings');
  });

  it('keeps unknown backend details available without leading with them', () => {
    const presentation = workflowErrorPresentation(
      'upstream transport closed unexpectedly',
      'Failed to start workflow'
    );

    expect(presentation.title).toBe('Failed to start workflow');
    expect(presentation.technicalDetails).toBe('upstream transport closed unexpectedly');
  });

  it('explains the secure sandbox requirement without suggesting it be bypassed', () => {
    const presentation = workflowErrorPresentation(
      'Shell command tools require sandbox_required=True',
      'Failed to save workflow'
    );

    expect(presentation.title).toBe('Shell command sandbox is required');
    expect(presentation.guidance).toContain('Keep sandboxing enabled');
    expect(presentation.guidance).not.toContain('disable');
  });
});
