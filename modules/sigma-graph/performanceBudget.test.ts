import { describe, expect, it } from 'vitest';
import { type GraphReadDtoDocument, graphReadDtoToSigmaGraph } from './adapters/graphReadDto';
import { createLargeSigmaGraphFixture } from './fixtures/largeGraph';
import { normalizeSigmaGraphDocument } from './normalize';
import { sigmaDocumentToGraphology } from './graphologyAdapter';

describe('sigma graph performance budget', () => {
  it('prepares a large graph snapshot within the data-path budget', () => {
    const fixture = createLargeSigmaGraphFixture({ nodeCount: 2_000, edgeCount: 5_000 });
    const startedAt = performance.now();

    const normalized = normalizeSigmaGraphDocument(fixture);
    const graph = sigmaDocumentToGraphology(normalized);

    const elapsedMs = performance.now() - startedAt;
    expect(graph.order).toBe(2_000);
    expect(graph.size).toBe(5_000);
    expect(elapsedMs).toBeLessThan(3_000);
  });

  it('normalizes a max-size graph read traversal response within the DTO budget', () => {
    const dto = createGraphReadTraversalFixture({ nodeCount: 250, edgeCount: 250 });
    const startedAt = performance.now();

    const sigmaDocument = graphReadDtoToSigmaGraph(dto);

    const elapsedMs = performance.now() - startedAt;
    expect(sigmaDocument.nodes).toHaveLength(250);
    expect(sigmaDocument.edges).toHaveLength(250);
    expect(sigmaDocument.metadata?.limit).toBe(250);
    expect(sigmaDocument.metadata?.truncated).toBe(true);
    expect(elapsedMs).toBeLessThan(750);
  });
});

function createGraphReadTraversalFixture({
  nodeCount,
  edgeCount,
}: {
  nodeCount: number;
  edgeCount: number;
}): GraphReadDtoDocument {
  return {
    nodes: Array.from({ length: nodeCount }, (_, index) => ({
      id: `traversal-node-${index}`,
      type: index === 0 ? 'WorkflowRun' : 'StepRun',
      labels: index === 0 ? ['WorkflowRun'] : ['StepRun'],
      properties: {
        name: `Traversal Node ${index}`,
        status: index % 3 === 0 ? 'completed' : 'running',
        sequence: index,
      },
    })),
    edges: Array.from({ length: edgeCount }, (_, index) => ({
      id: `traversal-edge-${index}`,
      source: `traversal-node-${index % nodeCount}`,
      target: `traversal-node-${(index + 1) % nodeCount}`,
      type: 'HAS_STEP_RUN',
      properties: {
        sequence: index,
      },
    })),
    meta: {
      query: 'expand',
      preset: 'workflow_run',
      limit: 250,
      truncated: true,
    },
  };
}
