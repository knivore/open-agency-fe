import { describe, expect, it } from 'vitest';
import { toAgentRun } from '@/lib/api/backend/agentTransforms';

describe('agent execution transforms', () => {
  it('preserves the current workflow node for graph runtime projection', () => {
    expect(
      toAgentRun({
        id: 'run-1',
        workflow_id: 'workflow-1',
        status: 'running',
        current_node_id: 'node-task-b',
      }).currentNodeId
    ).toBe('node-task-b');
  });
});
