import { describe, expect, it } from 'vitest';
import type { GraphDocument } from './types';
import { layoutGraphDocumentGrid } from './layout';

describe('graph layout helpers', () => {
  it('lays out nodes in a stable grid without changing edges', () => {
    const document: GraphDocument = {
      schemaVersion: 'graph.document.v1',
      nodes: [
        { id: 'node-1', type: 'task', label: 'Task 1' },
        { id: 'node-2', type: 'task', label: 'Task 2' },
        { id: 'node-3', type: 'task', label: 'Task 3' },
      ],
      edges: [{ id: 'edge-1', source: 'node-1', target: 'node-2', type: 'dependency' }],
    };

    const nextDocument = layoutGraphDocumentGrid(document, {
      columns: 2,
      startX: 10,
      startY: 20,
      gapX: 100,
      gapY: 50,
    });

    expect(nextDocument.nodes.map((node) => node.position)).toEqual([
      { x: 10, y: 20 },
      { x: 110, y: 20 },
      { x: 10, y: 70 },
    ]);
    expect(nextDocument.edges).toBe(document.edges);
  });
});
