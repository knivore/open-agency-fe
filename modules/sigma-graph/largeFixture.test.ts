import { describe, expect, it } from 'vitest';
import { createLargeSigmaGraphFixture } from './fixtures/largeGraph';
import { normalizeSigmaGraphDocument } from './normalize';
import { sigmaDocumentToGraphology } from './graphologyAdapter';

describe('large sigma graph fixture', () => {
  it('normalizes and converts a larger graph without dropping valid entities', () => {
    const fixture = createLargeSigmaGraphFixture({ nodeCount: 140, edgeCount: 240 });
    const normalized = normalizeSigmaGraphDocument(fixture);
    const graph = sigmaDocumentToGraphology(normalized);

    expect(normalized.nodes).toHaveLength(140);
    expect(normalized.edges).toHaveLength(240);
    expect(graph.order).toBe(140);
    expect(graph.size).toBe(240);
    expect(graph.getNodeAttribute('fixture-node-0', 'type')).toBeUndefined();
    expect(graph.getNodeAttribute('fixture-node-0', 'businessType')).toBe('Agent');
    expect(new Set(normalized.nodes.map((node) => node.clusterId)).size).toBeGreaterThan(1);
  });
});
