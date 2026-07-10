import { describe, expect, it } from 'vitest';
import { agencyGraphReadToSigmaGraph } from './adapters';

describe('agency graph adapters', () => {
  it('normalizes backend graph read documents for Sigma', () => {
    const document = agencyGraphReadToSigmaGraph({
      nodes: [
        { id: 'run-1', type: 'WorkflowRun', properties: { status: 'completed' } },
        { id: 'step-1', type: 'StepRun', properties: { status: 'completed' } },
      ],
      edges: [{ id: 'edge-1', source: 'run-1', target: 'step-1', type: 'HAS_STEP_RUN' }],
      meta: { title: 'Memory graph' },
    });

    expect(document.title).toBe('Memory graph');
    expect(document.nodes.map((node) => node.type)).toEqual(['WorkflowRun', 'StepRun']);
    expect(document.edges.map((edge) => edge.type)).toEqual(['HAS_STEP_RUN']);
  });
});
