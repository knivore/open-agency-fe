import { describe, expect, it } from 'vitest';
import { InMemorySigmaGraphController } from './store';

describe('sigma graph controller', () => {
  it('loads, patches, and notifies subscribers', () => {
    const controller = new InMemorySigmaGraphController();
    const seen: number[] = [];
    controller.subscribe((document) => seen.push(document.nodes.length));

    controller.load({
      schemaVersion: 'sigma.graph.document.v1',
      nodes: [{ id: 'a', type: 'Memory', label: 'A' }],
      edges: [],
    });
    controller.patch({
      upsertNodes: [{ id: 'b', type: 'Workflow', label: 'B' }],
      upsertEdges: [{ id: 'a-b', source: 'a', target: 'b', type: 'RELATED' }],
    });

    expect(seen).toEqual([1, 2]);
    expect(controller.getDocument().edges.map((edge) => edge.id)).toEqual(['a-b']);
  });
});
