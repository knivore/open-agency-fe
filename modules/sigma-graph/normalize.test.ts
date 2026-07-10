import { describe, expect, it } from 'vitest';
import { normalizeSigmaGraphDocument } from './normalize';

describe('sigma graph normalization', () => {
  it('deduplicates nodes and drops dangling edges', () => {
    const document = normalizeSigmaGraphDocument({
      schemaVersion: '',
      nodes: [
        { id: 'a', type: 'Memory', label: ' Memory A ' },
        { id: 'a', type: 'Memory', label: 'Memory A Updated', size: 0 },
        { id: 'b', type: 'Workflow', label: 'Workflow' },
      ],
      edges: [
        { id: 'a-b', source: 'a', target: 'b', type: 'LINKS_MEMORY' },
        { id: 'a-missing', source: 'a', target: 'missing', type: 'MISSING' },
      ],
    });

    expect(document.schemaVersion).toBe('sigma.graph.document.v1');
    expect(document.nodes).toHaveLength(2);
    expect(document.nodes.find((node) => node.id === 'a')?.label).toBe('Memory A Updated');
    expect(document.nodes.find((node) => node.id === 'a')?.size).toBe(6);
    expect(document.edges.map((edge) => edge.id)).toEqual(['a-b']);
  });
});
