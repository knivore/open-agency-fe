import { describe, expect, it } from 'vitest';
import { sigmaDocumentToGraphology } from './SigmaGraphCanvas';

describe('SigmaGraphCanvas graphology adapter', () => {
  it('converts a Sigma graph document into a graphology graph', () => {
    const graph = sigmaDocumentToGraphology({
      schemaVersion: 'sigma.graph.document.v1',
      nodes: [
        { id: 'a', type: 'Memory', label: 'A' },
        { id: 'b', type: 'Workflow', label: 'B' },
      ],
      edges: [{ id: 'a-b', source: 'a', target: 'b', type: 'LINKS_MEMORY' }],
    });

    expect(graph.order).toBe(2);
    expect(graph.size).toBe(1);
    expect(graph.getNodeAttribute('a', 'label')).toBe('A');
    expect(graph.getNodeAttribute('a', 'businessType')).toBe('Memory');
    expect(graph.getNodeAttribute('a', 'type')).toBeUndefined();
    expect(graph.getEdgeAttribute('a-b', 'businessType')).toBe('LINKS_MEMORY');
    expect(graph.getEdgeAttribute('a-b', 'type')).toBeUndefined();
  });

  it('prefers constellation layout positions over incoming node coordinates', () => {
    const graph = sigmaDocumentToGraphology(
      {
        schemaVersion: 'sigma.graph.document.v1',
        nodes: [
          {
            id: 'a',
            type: 'Memory',
            label: 'A',
            clusterId: 'island-0',
            position: { x: 999, y: 999 },
          },
          {
            id: 'b',
            type: 'Workflow',
            label: 'B',
            clusterId: 'island-1',
            position: { x: -999, y: -999 },
          },
        ],
        edges: [{ id: 'a-b', source: 'a', target: 'b', type: 'LINKS_MEMORY' }],
      },
      { appearance: 'constellation' }
    );

    expect(graph.getNodeAttribute('a', 'x')).not.toBe(999);
    expect(graph.getNodeAttribute('a', 'y')).not.toBe(999);
    expect(graph.getNodeAttribute('b', 'x')).not.toBe(-999);
    expect(graph.getNodeAttribute('b', 'y')).not.toBe(-999);
  });

  it('uses tinted fallback colors in constellation mode when nodes and edges have no explicit color', () => {
    const graph = sigmaDocumentToGraphology(
      {
        schemaVersion: 'sigma.graph.document.v1',
        nodes: [
          { id: 'a', type: 'Memory', label: 'A', clusterId: 'island-0' },
          { id: 'b', type: 'Workflow', label: 'B', clusterId: 'island-1' },
        ],
        edges: [{ id: 'a-b', source: 'a', target: 'b', type: 'LINKS_MEMORY' }],
      },
      { appearance: 'constellation' }
    );

    expect(graph.getNodeAttribute('a', 'color')).not.toBe('#d4d4d8');
    expect(graph.getNodeAttribute('b', 'color')).not.toBe('#d4d4d8');
    expect(graph.getNodeAttribute('a', 'color')).not.toBe(graph.getNodeAttribute('b', 'color'));
    expect(graph.getEdgeAttribute('a-b', 'color')).toBe('#52525b');
  });
});
