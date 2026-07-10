import { describe, expect, it } from 'vitest';

import { createGraphEdgeId } from './ids';

describe('graph id helpers', () => {
  it('keeps long edge ids unique after truncation', () => {
    const source = 'workflow-agent-8df0a8d1-6cc1-41b3-8020-487f21059278';
    const firstTarget = 'workflow-task-task-140215067da3';
    const secondTarget = 'workflow-task-task-32a77608452d';

    const first = createGraphEdgeId({
      type: 'workflow.assignment',
      source,
      target: firstTarget,
    });
    const second = createGraphEdgeId({
      type: 'workflow.assignment',
      source,
      target: secondTarget,
    });

    expect(first).not.toBe(second);
    expect(first.length).toBeLessThanOrEqual(96);
    expect(second.length).toBeLessThanOrEqual(96);
  });
});
