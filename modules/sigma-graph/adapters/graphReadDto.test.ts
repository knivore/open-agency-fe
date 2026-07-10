import { describe, expect, it } from 'vitest';
import { graphReadDtoToSigmaGraph } from './graphReadDto';

describe('graph read DTO adapter', () => {
  it('maps neutral backend graph responses into Sigma documents', () => {
    const document = graphReadDtoToSigmaGraph({
      nodes: [
        {
          id: 'workflow-1',
          type: 'Workflow',
          labels: ['Workflow'],
          properties: { name: 'Research Workflow', created_at: '2026-05-20T10:00:00Z' },
        },
        {
          id: 'memory-1',
          labels: ['Memory'],
          properties: { summary: 'Important memory' },
        },
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'workflow-1',
          target: 'memory-1',
          type: 'LINKS_MEMORY',
          properties: { completed_at: '2026-05-20T10:05:00Z' },
        },
      ],
      meta: { title: 'Workflow Lineage' },
    });

    expect(document.title).toBe('Workflow Lineage');
    expect(document.nodes.map((node) => node.label)).toEqual([
      'Research Workflow',
      'Important memory',
    ]);
    expect(document.nodes[0]?.clusterId).toBe('Workflow');
    expect(document.nodes[0]?.startedAt).toBe('2026-05-20T10:00:00Z');
    expect(document.nodes[0]?.endedAt).toBe('2026-05-20T10:00:00Z');
    expect(document.edges[0]?.type).toBe('LINKS_MEMORY');
    expect(document.edges[0]?.endedAt).toBe('2026-05-20T10:05:00Z');
  });

  it('derives useful labels when graph nodes only have operational properties', () => {
    const document = graphReadDtoToSigmaGraph({
      nodes: [
        {
          id: '00f77db4-e4f8-458a-ac2b-47b1f49f44c6',
          type: 'WorkflowRun',
          properties: { status: 'failed', updated_at: '2026-05-27T01:44:53Z' },
        },
        {
          id: '00f77db4-e4f8-458a-ac2b-47b1f49f44c6:task-a',
          type: 'StepRun',
          properties: { task_id: 'task-a', status: 'failed' },
        },
      ],
      edges: [],
      meta: {},
    });

    expect(document.nodes.map((node) => node.label)).toEqual([
      expect.stringContaining('Failed run'),
      'A - Failed',
    ]);
    expect(document.nodes[0]?.label).not.toBe(document.nodes[0]?.id);
    expect(document.nodes[1]?.label).not.toBe(document.nodes[1]?.id);
  });

  it('merges backend operational projection nodes and coverage metadata', () => {
    const document = graphReadDtoToSigmaGraph({
      nodes: [
        {
          id: 'workflow-1',
          type: 'Workflow',
          properties: { name: 'Research Workflow' },
        },
      ],
      edges: [],
      operational: {
        coverage: {
          recent_run_count: 2,
          workflow_count: 1,
        },
        nodes: [
          {
            id: 'run-1',
            type: 'Run',
            properties: { id: 'run-1', status: 'failed', error: 'Coordinator failed' },
          },
        ],
        edges: [
          {
            id: 'workflow-1:STARTED:run-1',
            source: 'workflow-1',
            target: 'run-1',
            type: 'STARTED',
          },
        ],
      },
      operational_nodes: [
        {
          id: 'incident-cluster:workflow-1:coordinator',
          type: 'IncidentCluster',
          properties: {
            failure_count: 2,
            incident_signature: 'coordinator failed',
            run_ids: ['run-1', 'run-2'],
          },
        },
      ],
      meta: { title: 'Operational graph' },
    });

    expect(document.nodes.map((node) => node.type)).toEqual(['Workflow', 'Run', 'IncidentCluster']);
    expect(document.edges.map((edge) => edge.type)).toEqual(['STARTED']);
    expect(document.nodes.find((node) => node.id === 'run-1')?.metadata).toMatchObject({
      graph_read_operational_coverage: true,
    });
    expect(document.edges[0]?.metadata).toMatchObject({
      graph_read_operational_coverage: true,
    });
    expect(document.metadata).toMatchObject({
      operational_edge_count: 1,
      operational_node_count: 2,
      operational_coverage: {
        recent_run_count: 2,
        workflow_count: 1,
      },
    });
  });
});
