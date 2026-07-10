import { describe, expect, it } from 'vitest';
import {
  executionEventsToSigmaGraph,
  recentExecutionsToSigmaGraph,
  workflowExecutionsToSigmaGraph,
} from './executionFallbackGraph';

describe('executionEventsToSigmaGraph', () => {
  it('builds a run fallback graph with failure, sequence, and parent edges', () => {
    const document = executionEventsToSigmaGraph(
      {
        id: 'run-1',
        workflow_id: 'workflow-1',
        status: 'failed',
        trigger_type: 'schedule',
        trigger_payload: { schedule_id: 'schedule-1' },
        runtime_revision_id: 'revision-1',
        container_id: 'container-1',
        error: 'Codex CLI timed out after 120 seconds.',
      },
      [
        {
          id: 'event-1',
          execution_id: 'run-1',
          event_type: 'execution.created',
          sequence: 1,
          timestamp: '2026-05-27T01:09:39Z',
        },
        {
          id: 'event-2',
          execution_id: 'run-1',
          parent_event_id: 'event-1',
          event_type: 'container.created',
          sequence: 2,
          timestamp: '2026-05-27T01:09:40Z',
        },
      ]
    );

    expect(document.metadata).toMatchObject({
      projection_mode: 'execution-events-fallback',
      root_type: 'Run',
      root_id: 'run-1',
      event_count: 2,
    });
    expect(document.nodes.map((node) => node.type)).toEqual(
      expect.arrayContaining([
        'Run',
        'Workflow',
        'Schedule',
        'RuntimeRevision',
        'RuntimeContainer',
        'Error',
        'ExecutionEvent',
        'ContainerEvent',
      ])
    );
    expect(document.edges.map((edge) => edge.type)).toEqual(
      expect.arrayContaining([
        'STARTED',
        'TRIGGERED',
        'USED_RUNTIME',
        'CREATED_CONTAINER',
        'FAILED_WITH',
        'EMITTED_EVENT',
        'FOLLOWED_BY',
        'PARENT_OF',
      ])
    );
  });

  it('adds operational nodes from execution metadata and event references', () => {
    const document = executionEventsToSigmaGraph(
      {
        id: 'run-2',
        status: 'completed',
        metadata: {
          agent_ids: ['review-agent'],
        },
      },
      [
        {
          id: 'event-1',
          execution_id: 'run-2',
          agent_id: 'review-agent',
          task_id: 'draft-summary',
          tool_call_id: 'tool-call-1',
          event_type: 'tool.call.completed',
          sequence: 1,
          timestamp: '2026-05-27T01:09:39Z',
          payload: { tool_name: 'Shell' },
        },
        {
          id: 'event-2',
          execution_id: 'run-2',
          model_request_id: 'model-request-1',
          event_type: 'model.request.completed',
          sequence: 2,
          timestamp: '2026-05-27T01:09:40Z',
          payload: { provider: 'OpenAI', model: 'gpt-5' },
        },
        {
          id: 'event-3',
          execution_id: 'run-2',
          event_type: 'artifact.created',
          sequence: 3,
          timestamp: '2026-05-27T01:09:41Z',
          payload: { artifact_id: 'artifact-1', name: 'review-report.md' },
        },
      ]
    );

    expect(document.nodes.map((node) => node.type)).toEqual(
      expect.arrayContaining([
        'Run',
        'Agent',
        'ExecutionEvent',
        'Task',
        'ToolCall',
        'ModelRequest',
        'Artifact',
      ])
    );
    expect(document.nodes.find((node) => node.type === 'Agent')?.label).toBe('Review');
    expect(document.nodes.find((node) => node.type === 'ToolCall')?.label).toBe('Shell');
    expect(document.nodes.find((node) => node.type === 'ModelRequest')?.label).toBe('OpenAI gpt-5');
    expect(document.nodes.find((node) => node.type === 'Artifact')?.label).toBe('review-report.md');
    expect(document.edges.map((edge) => edge.type)).toEqual(
      expect.arrayContaining(['PARTICIPATED_IN', 'OCCURRED_IN', 'PRODUCED_ARTIFACT'])
    );
  });

  it('keeps heavy event details out of the default graph payload', () => {
    const document = executionEventsToSigmaGraph(
      {
        id: 'run-3',
        status: 'failed',
      },
      [
        {
          id: 'event-1',
          execution_id: 'run-3',
          event_type: 'tool.call.failed',
          sequence: 1,
          timestamp: '2026-05-27T01:09:39Z',
          payload: { command: 'large command output', secret_like: 'redacted-upstream' },
          metrics: { tokens: 1000 },
        },
      ]
    );

    const eventNode = document.nodes.find((node) => node.id === 'execution-event:event-1');
    expect(eventNode?.data).not.toHaveProperty('payload');
    expect(eventNode?.data).not.toHaveProperty('metrics');
    expect(eventNode?.metadata).toMatchObject({ event_details_deferred: true });
  });

  it('tolerates malformed event payloads and missing parent source records', () => {
    const document = executionEventsToSigmaGraph(
      {
        id: 'run-4',
        status: 'completed',
      },
      [
        {
          id: 'event-1',
          execution_id: 'run-4',
          event_type: 'artifact.created',
          parent_event_id: 'missing-parent-event',
          sequence: 1,
          timestamp: 'not-a-date',
          payload: 'not an object' as never,
        },
      ]
    );

    expect(document.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining(['run:run-4', 'execution-event:event-1', 'artifact:event-1:artifact'])
    );
    expect(document.edges.map((edge) => edge.type)).not.toContain('PARENT_OF');
  });
});

describe('workflowExecutionsToSigmaGraph', () => {
  it('adds operational execution context for workflow run fallback graphs', () => {
    const document = workflowExecutionsToSigmaGraph('workflow-1', [
      {
        id: 'run-1',
        workflow_id: 'workflow-1',
        status: 'failed',
        trigger_type: 'schedule',
        trigger_payload: { schedule_id: 'schedule-1' },
        runtime_revision_id: 'revision-1',
        container_id: 'container-1',
        error: 'Workflow failed',
        metadata: { agent_ids: ['review-agent'] },
      },
    ]);

    expect(document.nodes.map((node) => node.type)).toEqual(
      expect.arrayContaining([
        'Workflow',
        'WorkflowHealth',
        'Run',
        'Schedule',
        'RuntimeRevision',
        'RuntimeContainer',
        'Error',
        'Agent',
      ])
    );
    expect(document.edges.map((edge) => edge.type)).toEqual(
      expect.arrayContaining([
        'STARTED',
        'HAS_HEALTH',
        'TRIGGERED',
        'USED_RUNTIME',
        'CREATED_CONTAINER',
        'FAILED_WITH',
        'PARTICIPATED_IN',
      ])
    );
    expect(document.metadata).toMatchObject({
      projection_mode: 'execution-events-fallback',
      root_type: 'Workflow',
      root_id: 'workflow-1',
      run_count: 1,
    });
  });
});

describe('recentExecutionsToSigmaGraph', () => {
  it('groups recent executions by workflow while preserving issues, agents, and health summaries', () => {
    const document = recentExecutionsToSigmaGraph([
      {
        id: 'run-1',
        workflow_id: 'workflow-1',
        status: 'completed',
        created_at: '2026-06-10T10:00:00Z',
        metadata: { agent_ids: ['planner-agent'] },
      },
      {
        id: 'run-2',
        workflow_id: 'workflow-1',
        status: 'failed',
        created_at: '2026-06-11T10:00:00Z',
        error: 'Coordinator failed',
      },
      {
        id: 'run-3',
        workflow_id: 'workflow-1',
        status: 'failed',
        created_at: '2026-06-12T10:00:00Z',
        error: 'Coordinator failed',
      },
    ]);

    expect(document.nodes.map((node) => node.type)).toEqual(
      expect.arrayContaining([
        'Workflow',
        'WorkflowHealth',
        'RunStatusBucket',
        'WorkflowRunWindow',
        'IncidentCluster',
        'Run',
        'Error',
        'Agent',
      ])
    );
    expect(document.edges.map((edge) => edge.type)).toEqual(
      expect.arrayContaining([
        'STARTED',
        'HAS_HEALTH',
        'HAS_STATUS_BUCKET',
        'HAS_TIME_WINDOW',
        'HAS_INCIDENT',
        'FAILED_WITH',
        'PARTICIPATED_IN',
      ])
    );
    expect(document.nodes.filter((node) => node.type === 'Run')).toHaveLength(3);
    expect(document.nodes.filter((node) => node.type === 'Workflow')).toHaveLength(1);
    expect(document.nodes.find((node) => node.type === 'WorkflowHealth')?.data).toMatchObject({
      failed_count: 2,
      run_count: 3,
      status: 'failed',
    });
    expect(document.nodes.find((node) => node.type === 'RunStatusBucket')?.data).toMatchObject({
      run_count: 2,
      status: 'failed',
    });
    expect(document.nodes.filter((node) => node.type === 'WorkflowRunWindow')).toHaveLength(2);
    expect(
      document.nodes.find((node) => node.id === 'workflow-run-window:workflow-1:24h')?.data
    ).toMatchObject({
      failed_count: 2,
      run_count: 2,
      status: 'failed',
      window_label: 'Last 24h',
    });
    expect(
      document.nodes.find((node) => node.id === 'workflow-run-window:workflow-1:7d')?.data
    ).toMatchObject({
      failed_count: 2,
      run_count: 3,
      status: 'failed',
      window_label: 'Last 7d',
    });
    expect(document.nodes.find((node) => node.type === 'IncidentCluster')?.data).toMatchObject({
      failure_count: 2,
      severity: 'error',
      status: 'failed',
      workflow_id: 'workflow-1',
    });
    expect(document.metadata).toMatchObject({
      projection_mode: 'recent-executions-fallback',
      root_type: 'All',
      run_count: 3,
    });
  });
});
