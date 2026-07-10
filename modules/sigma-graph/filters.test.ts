import { describe, expect, it } from 'vitest';
import { applySigmaGraphFilters, createTypeFilter } from './filters';
import { applySigmaGraphTimeWindow } from './temporal';
import { clusterSigmaGraphNodes } from './clustering';

const document = {
  schemaVersion: 'sigma.graph.document.v1',
  nodes: [
    {
      id: 'workflow-1',
      type: 'Workflow',
      label: 'Workflow',
      startedAt: '2026-05-24T00:00:00Z',
      endedAt: '2026-05-24T01:00:00Z',
    },
    { id: 'memory-1', type: 'Memory', label: 'Memory', startedAt: '2026-05-25T00:00:00Z' },
  ],
  edges: [{ id: 'edge-1', source: 'workflow-1', target: 'memory-1', type: 'LINKS_MEMORY' }],
};

describe('sigma graph filtering helpers', () => {
  it('filters by type while removing hidden-edge references', () => {
    const filtered = applySigmaGraphFilters(document, [
      createTypeFilter('workflow-only', ['Workflow']),
    ]);

    expect(filtered.nodes.map((node) => node.id)).toEqual(['workflow-1']);
    expect(filtered.edges).toEqual([]);
  });

  it('applies temporal windows', () => {
    const filtered = applySigmaGraphTimeWindow(document, {
      start: '2026-05-24T12:00:00Z',
      end: '2026-05-26T00:00:00Z',
    });

    expect(filtered.nodes.map((node) => node.id)).toEqual(['memory-1']);
    expect(filtered.edges).toEqual([]);
  });

  it('clusters nodes by type by default', () => {
    expect(clusterSigmaGraphNodes(document).map((cluster) => [cluster.id, cluster.size])).toEqual([
      ['Memory', 1],
      ['Workflow', 1],
    ]);
  });
});
