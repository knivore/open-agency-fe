import { describe, expect, it } from 'vitest';
import { InMemorySigmaGraphController } from '@/modules/sigma-graph/store';
import type { SigmaGraphDocument } from '@/modules/sigma-graph/types';
import { agencyGraphReadToSigmaGraph } from './adapters';

describe('agency graph realtime reconciliation', () => {
  it('matches a reloaded graph snapshot after applying streamed deltas', () => {
    const initialSnapshot = agencyGraphReadToSigmaGraph({
      nodes: [
        {
          id: 'run-1',
          type: 'WorkflowRun',
          properties: { name: 'Run One', status: 'running' },
        },
      ],
      edges: [],
      meta: { id: 'run-1-neighborhood' },
    });
    const finalSnapshot = agencyGraphReadToSigmaGraph({
      nodes: [
        {
          id: 'run-1',
          type: 'WorkflowRun',
          properties: { name: 'Run One', status: 'completed' },
        },
        {
          id: 'run-1:task-1',
          type: 'StepRun',
          properties: { name: 'Task One', status: 'completed', task_id: 'task-1' },
        },
      ],
      edges: [
        {
          id: 'run-1:HAS_STEP_RUN:run-1:task-1',
          source: 'run-1',
          target: 'run-1:task-1',
          type: 'HAS_STEP_RUN',
          properties: {},
        },
      ],
      meta: { id: 'run-1-neighborhood' },
    });
    const controller = new InMemorySigmaGraphController(initialSnapshot);

    controller.patch({
      upsertNodes: [
        {
          id: 'run-1',
          type: 'WorkflowRun',
          label: 'Run One',
          clusterId: 'WorkflowRun',
          data: { name: 'Run One', status: 'completed' },
        },
        {
          id: 'run-1:task-1',
          type: 'StepRun',
          label: 'Task One',
          clusterId: 'StepRun',
          data: { name: 'Task One', status: 'completed', task_id: 'task-1' },
        },
      ],
      upsertEdges: [
        {
          id: 'run-1:HAS_STEP_RUN:run-1:task-1',
          source: 'run-1',
          target: 'run-1:task-1',
          type: 'HAS_STEP_RUN',
          label: 'HAS_STEP_RUN',
          data: {},
        },
      ],
      metadata: { eventId: 'projection-event-1' },
    });

    expect(canonicalGraph(controller.getDocument())).toEqual(canonicalGraph(finalSnapshot));
  });
});

function canonicalGraph(document: SigmaGraphDocument) {
  return {
    nodes: [...document.nodes]
      .map((node) => ({
        id: node.id,
        type: node.type,
        label: node.label,
        clusterId: node.clusterId,
        data: node.data || {},
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    edges: [...document.edges]
      .map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        label: edge.label,
        data: edge.data || {},
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}
