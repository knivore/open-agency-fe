import { describe, expect, it } from 'vitest';
import { createLargeSigmaGraphFixture } from './fixtures/largeGraph';
import { createConstellationSigmaGraphPositions } from './layout';

describe('createConstellationSigmaGraphPositions', () => {
  it('returns deterministic finite positions for clustered graphs', () => {
    const document = {
      schemaVersion: 'sigma.graph.document.v1',
      nodes: [
        { id: 'memory-1', type: 'Memory', label: 'Memory One', clusterId: 'knowledge' },
        { id: 'entity-1', type: 'Entity', label: 'Entity One', clusterId: 'knowledge' },
        { id: 'entity-2', type: 'Entity', label: 'Entity Two', clusterId: 'knowledge' },
        { id: 'run-1', type: 'Run', label: 'Run One', clusterId: 'operations' },
        { id: 'agent-1', type: 'Agent', label: 'Agent One', clusterId: 'operations' },
      ],
      edges: [
        { id: 'memory-entity-1', source: 'memory-1', target: 'entity-1', type: 'MENTIONS' },
        { id: 'memory-entity-2', source: 'memory-1', target: 'entity-2', type: 'MENTIONS' },
        { id: 'run-agent-1', source: 'run-1', target: 'agent-1', type: 'PARTICIPATED_IN' },
        { id: 'run-memory-1', source: 'run-1', target: 'memory-1', type: 'CREATED_MEMORY' },
      ],
    };

    const first = createConstellationSigmaGraphPositions(document);
    const second = createConstellationSigmaGraphPositions(document);

    expect(first).toEqual(second);
    expect(Object.keys(first)).toHaveLength(document.nodes.length);
    Object.values(first).forEach((point) => {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
      expect(Math.abs(point.x)).toBeLessThanOrEqual(30);
      expect(Math.abs(point.y)).toBeLessThanOrEqual(30);
    });
  });

  it('packs larger graphs more tightly than the default small-graph extent', () => {
    const largeFixture = createLargeSigmaGraphFixture({ edgeCount: 320, nodeCount: 180 });
    const positions = createConstellationSigmaGraphPositions(largeFixture);
    const radii = Object.values(positions).map((point) => Math.hypot(point.x, point.y));
    const averageRadius =
      radii.reduce((total, radius) => total + radius, 0) / Math.max(radii.length, 1);
    const maxRadius = Math.max(...radii);

    expect(averageRadius).toBeLessThan(8.5);
    expect(maxRadius).toBeLessThan(13.5);
  });

  it('seeds workflow runs into a readable orbit around their workflow', () => {
    const document = {
      schemaVersion: 'sigma.graph.document.v1',
      nodes: [
        { id: 'workflow-1', type: 'Workflow', label: 'Workflow One', clusterId: 'Workflow' },
        { id: 'run-1', type: 'Run', label: 'Run One', clusterId: 'Run' },
        { id: 'run-2', type: 'Run', label: 'Run Two', clusterId: 'Run' },
        { id: 'run-3', type: 'Run', label: 'Run Three', clusterId: 'Run' },
      ],
      edges: [
        { id: 'workflow-1:STARTED:run-1', source: 'workflow-1', target: 'run-1', type: 'STARTED' },
        { id: 'workflow-1:STARTED:run-2', source: 'workflow-1', target: 'run-2', type: 'STARTED' },
        { id: 'workflow-1:STARTED:run-3', source: 'workflow-1', target: 'run-3', type: 'STARTED' },
      ],
    };

    const positions = createConstellationSigmaGraphPositions(document, { iterations: 90 });
    const workflow = positions['workflow-1']!;
    const runOne = positions['run-1']!;
    const runTwo = positions['run-2']!;
    const runThree = positions['run-3']!;

    const runDistances = [runOne, runTwo, runThree].map((point) =>
      Math.hypot(point.x - workflow.x, point.y - workflow.y)
    );

    runDistances.forEach((distance) => {
      expect(distance).toBeGreaterThan(1.2);
      expect(distance).toBeLessThan(8);
    });
    expect(Math.hypot(runOne.x - runTwo.x, runOne.y - runTwo.y)).toBeGreaterThan(0.8);
    expect(Math.hypot(runTwo.x - runThree.x, runTwo.y - runThree.y)).toBeGreaterThan(0.8);
  });
});
