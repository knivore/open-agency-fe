import { describe, expect, it } from 'vitest';
import type { SigmaGraphDocument } from './types';
import {
  compactForceGraph3DInitialNodes,
  deriveForceGraph3DCameraDistance,
  deriveForceGraph3DDisplayDocument,
  deriveForceGraph3DSceneFrame,
} from './ForceGraph3DCanvas';

function workflowRunFixture(): SigmaGraphDocument {
  const workflowId = 'workflow:alpha';
  return {
    schemaVersion: 'sigma.graph.document.v1',
    id: 'workflow-runs',
    title: 'Workflow runs',
    metadata: {},
    nodes: [
      {
        id: workflowId,
        type: 'Workflow',
        label: 'Alpha Workflow',
        size: 14,
        data: { id: workflowId },
      },
      ...Array.from({ length: 9 }, (_, index) => {
        const status = index < 3 ? 'failed' : index < 6 ? 'running' : 'completed';
        const timestamp = new Date(Date.UTC(2026, 5, 16 - index, 2, 0, 0)).toISOString();
        return {
          id: `run:${index + 1}`,
          type: 'Run',
          label: `Run ${index + 1}`,
          size: 12,
          startedAt: timestamp,
          endedAt: timestamp,
          data: {
            created_at: timestamp,
            id: `run:${index + 1}`,
            status,
          },
        };
      }),
      {
        id: 'error:1',
        type: 'Error',
        label: 'Failed to execute',
        size: 10,
        data: { status: 'failed' },
      },
    ],
    edges: [
      ...Array.from({ length: 9 }, (_, index) => ({
        id: `${workflowId}:STARTED:run:${index + 1}`,
        source: workflowId,
        target: `run:${index + 1}`,
        type: 'STARTED',
        label: 'STARTED',
      })),
      {
        id: 'run:1:FAILED_WITH:error:1',
        source: 'run:1',
        target: 'error:1',
        type: 'FAILED_WITH',
        label: 'FAILED_WITH',
      },
    ],
  };
}

function mixedWorkflowRunFixture(): SigmaGraphDocument {
  const alphaWorkflow = 'workflow:alpha';
  const betaWorkflow = 'workflow:beta';
  const nodes: SigmaGraphDocument['nodes'] = [
    {
      id: alphaWorkflow,
      type: 'Workflow',
      label: 'Alpha Workflow',
      size: 14,
      data: { id: alphaWorkflow },
    },
    {
      id: betaWorkflow,
      type: 'Workflow',
      label: 'Beta Workflow',
      size: 14,
      data: { id: betaWorkflow },
    },
  ];
  const edges: SigmaGraphDocument['edges'] = [];

  for (let index = 0; index < 8; index += 1) {
    const timestamp = new Date(Date.UTC(2026, 5, 16 - index, 2, 0, 0)).toISOString();
    nodes.push({
      id: `run:alpha:${index + 1}`,
      type: 'Run',
      label: `Alpha Run ${index + 1}`,
      size: 12,
      startedAt: timestamp,
      endedAt: timestamp,
      data: {
        created_at: timestamp,
        id: `run:alpha:${index + 1}`,
        status: index < 2 ? 'failed' : 'completed',
      },
    });
    edges.push({
      id: `${alphaWorkflow}:STARTED:run:alpha:${index + 1}`,
      source: alphaWorkflow,
      target: `run:alpha:${index + 1}`,
      type: 'STARTED',
      label: 'STARTED',
    });
  }

  for (let index = 0; index < 3; index += 1) {
    const timestamp = new Date(Date.UTC(2026, 5, 16 - index, 8, 0, 0)).toISOString();
    nodes.push({
      id: `run:beta:${index + 1}`,
      type: 'Run',
      label: `Beta Run ${index + 1}`,
      size: 12,
      startedAt: timestamp,
      endedAt: timestamp,
      data: {
        created_at: timestamp,
        id: `run:beta:${index + 1}`,
        status: 'completed',
      },
    });
    edges.push({
      id: `${betaWorkflow}:STARTED:run:beta:${index + 1}`,
      source: betaWorkflow,
      target: `run:beta:${index + 1}`,
      type: 'STARTED',
      label: 'STARTED',
    });
  }

  return {
    schemaVersion: 'sigma.graph.document.v1',
    id: 'mixed-workflow-runs',
    title: 'Mixed workflow runs',
    metadata: {},
    nodes,
    edges,
  };
}

describe('deriveForceGraph3DDisplayDocument', () => {
  it('keeps the original document in detail tier', () => {
    const document = workflowRunFixture();

    const result = deriveForceGraph3DDisplayDocument(document, 'detail');

    expect(result).toBe(document);
  });

  it('aggregates runs into synthetic workflow clusters in overview tier', () => {
    const document = workflowRunFixture();

    const result = deriveForceGraph3DDisplayDocument(document, 'overview');

    expect(result).not.toBe(document);
    expect(result.nodes.some((node) => node.type === 'RunCluster')).toBe(true);
    expect(result.nodes.some((node) => node.id === 'run:1')).toBe(false);
    expect(result.nodes.some((node) => node.id === 'error:1')).toBe(false);
    expect(
      result.edges.some(
        (edge) => edge.source === 'workflow:alpha' && edge.target.startsWith('run-cluster:')
      )
    ).toBe(true);
    expect(result.metadata?.graph_3d_detail_tier).toBe('overview');
  });

  it('keeps the newest runs visible in mid tier while clustering older runs', () => {
    const document = workflowRunFixture();

    const result = deriveForceGraph3DDisplayDocument(document, 'mid');

    expect(result.nodes.some((node) => node.id === 'run:1')).toBe(true);
    expect(result.nodes.some((node) => node.id === 'run:2')).toBe(true);
    expect(result.nodes.some((node) => node.id === 'run:3')).toBe(false);
    expect(result.nodes.some((node) => node.id === 'run:9')).toBe(false);
    expect(result.nodes.some((node) => node.type === 'RunCluster')).toBe(true);
  });

  it('clusters dense workflows earlier while leaving sparse workflows expanded', () => {
    const document = mixedWorkflowRunFixture();

    const result = deriveForceGraph3DDisplayDocument(document, 'mid');

    expect(result.nodes.some((node) => node.id === 'run:alpha:8')).toBe(false);
    expect(result.nodes.some((node) => node.id === 'run:beta:1')).toBe(true);
    expect(result.nodes.some((node) => node.id === 'run:beta:3')).toBe(true);
    expect(
      result.nodes.some(
        (node) => node.type === 'RunCluster' && String(node.data?.workflow_id) === 'workflow:alpha'
      )
    ).toBe(true);
    expect(
      result.nodes.some(
        (node) => node.type === 'RunCluster' && String(node.data?.workflow_id) === 'workflow:beta'
      )
    ).toBe(false);
  });
});

describe('deriveForceGraph3DSceneFrame', () => {
  it('compacts seeded 3D positions before the force engine separates disconnected groups', () => {
    const nodes = [
      { val: 4, x: -160, y: -80, z: -40 },
      { val: 4, x: 120, y: 90, z: 38 },
      { val: 4, x: 260, y: 140, z: 62 },
      { val: 4, x: -220, y: 160, z: -58 },
    ];

    const before = deriveForceGraph3DSceneFrame(nodes);
    const compacted = compactForceGraph3DInitialNodes(nodes);
    const after = deriveForceGraph3DSceneFrame(compacted);

    expect(compacted).toHaveLength(nodes.length);
    expect(after.radius).toBeLessThan(before.radius * 0.7);
  });

  it('expands the scene frame for dense live layouts without over-zooming the camera', () => {
    const nodes = Array.from({ length: 160 }, (_, index) => {
      const angle = (Math.PI * 2 * index) / 160;
      const ringRadius = index % 3 === 0 ? 310 : index % 3 === 1 ? 220 : 140;
      return {
        val: 8,
        x: Math.cos(angle) * ringRadius,
        y: Math.sin(angle) * ringRadius,
        z: ((index % 9) - 4) * 18,
      };
    });

    const frame = deriveForceGraph3DSceneFrame(nodes);
    const desktopDistance = deriveForceGraph3DCameraDistance(frame, { height: 760, width: 1280 });
    const compactDistance = deriveForceGraph3DCameraDistance(frame, { height: 720, width: 520 });

    expect(frame.radius).toBeGreaterThan(330);
    expect(desktopDistance).toBeGreaterThan(frame.radius);
    expect(desktopDistance).toBeLessThanOrEqual(820);
    expect(compactDistance).toBeLessThanOrEqual(620);
  });
});
