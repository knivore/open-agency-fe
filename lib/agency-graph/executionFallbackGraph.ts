import {
  normalizeSigmaGraphDocument,
  sigmaGraphDocumentSchemaVersion,
} from '@/modules/sigma-graph/normalize';
import type {
  SigmaGraphDocument,
  SigmaGraphEdge,
  SigmaGraphJsonObject,
  SigmaGraphJsonValue,
  SigmaGraphNode,
} from '@/modules/sigma-graph/types';
import type { ExecutionEventRecord, ExecutionRecord } from '@/types/runtime';
import { canonicalGraphMetadata, sourceMetadata } from './domainModel';

const fallbackSourceMetadata = sourceMetadata({
  source_system: 'agency-backend',
  source_endpoint: '/executions/{executionId}/events',
  projection_mode: 'execution-events-fallback',
});

export function executionEventsToSigmaGraph(
  execution: ExecutionRecord,
  events: ExecutionEventRecord[]
): SigmaGraphDocument {
  const nodes = new Map<string, SigmaGraphNode>();
  const edges = new Map<string, SigmaGraphEdge>();
  const runNodeId = runNodeIdFor(execution.id);

  addNode(nodes, {
    id: runNodeId,
    type: 'Run',
    label: `Run ${shortId(execution.id)}`,
    clusterId: 'Run',
    startedAt: execution.started_at || execution.created_at || undefined,
    endedAt: execution.completed_at || execution.updated_at || undefined,
    size: 14,
    data: compactObject({
      id: execution.id,
      workflow_id: execution.workflow_id,
      status: execution.status,
      trigger_type: execution.trigger_type,
      created_at: execution.created_at,
      started_at: execution.started_at,
      completed_at: execution.completed_at,
      error: execution.error,
    }),
    metadata: {
      ...fallbackSourceMetadata,
      source_record_id: execution.id,
    },
  });

  if (execution.workflow_id) {
    const workflowNodeId = `workflow:${execution.workflow_id}`;
    addNode(nodes, {
      id: workflowNodeId,
      type: 'Workflow',
      label: `Workflow ${shortId(execution.workflow_id)}`,
      clusterId: 'Workflow',
      data: compactObject({ id: execution.workflow_id }),
      metadata: { ...fallbackSourceMetadata, source_record_id: execution.workflow_id },
    });
    addEdge(edges, {
      id: `${workflowNodeId}:STARTED:${runNodeId}`,
      source: workflowNodeId,
      target: runNodeId,
      type: 'STARTED',
      label: 'STARTED',
    });
  }

  const scheduleId = stringFromObject(execution.trigger_payload, 'schedule_id');
  if (scheduleId) {
    const scheduleNodeId = `schedule:${scheduleId}`;
    addNode(nodes, {
      id: scheduleNodeId,
      type: 'Schedule',
      label: `Schedule ${shortId(scheduleId)}`,
      clusterId: 'Schedule',
      data: compactObject({ id: scheduleId, trigger_type: execution.trigger_type }),
      metadata: { ...fallbackSourceMetadata, source_record_id: scheduleId },
    });
    addEdge(edges, {
      id: `${scheduleNodeId}:TRIGGERED:${runNodeId}`,
      source: scheduleNodeId,
      target: runNodeId,
      type: 'TRIGGERED',
      label: 'TRIGGERED',
    });
  }

  if (execution.runtime_revision_id) {
    const revisionNodeId = `runtime-revision:${execution.runtime_revision_id}`;
    addNode(nodes, {
      id: revisionNodeId,
      type: 'RuntimeRevision',
      label: `Runtime ${shortId(execution.runtime_revision_id)}`,
      clusterId: 'RuntimeRevision',
      data: compactObject({
        id: execution.runtime_revision_id,
        fingerprint: execution.runtime_fingerprint,
        adapter_id: execution.runtime_adapter_id,
      }),
      metadata: {
        ...fallbackSourceMetadata,
        source_record_id: execution.runtime_revision_id,
      },
    });
    addEdge(edges, {
      id: `${runNodeId}:USED_RUNTIME:${revisionNodeId}`,
      source: runNodeId,
      target: revisionNodeId,
      type: 'USED_RUNTIME',
      label: 'USED_RUNTIME',
    });
  }

  if (execution.container_id || execution.container_name) {
    const containerSourceId =
      execution.container_id || execution.container_name || `${execution.id}:container`;
    const containerNodeId = `runtime-container:${containerSourceId}`;
    addNode(nodes, {
      id: containerNodeId,
      type: 'RuntimeContainer',
      label: execution.container_name || `Container ${shortId(containerSourceId)}`,
      clusterId: 'RuntimeContainer',
      startedAt: execution.container_started_at || undefined,
      endedAt: execution.container_ended_at || undefined,
      data: compactObject({
        id: execution.container_id,
        name: execution.container_name,
        image: execution.container_image,
        status: execution.container_status,
        exit_code: execution.container_exit_code,
      }),
      metadata: { ...fallbackSourceMetadata, source_record_id: containerSourceId },
    });
    addEdge(edges, {
      id: `${runNodeId}:CREATED_CONTAINER:${containerNodeId}`,
      source: runNodeId,
      target: containerNodeId,
      type: 'CREATED_CONTAINER',
      label: 'CREATED_CONTAINER',
    });
  }

  if (execution.error) {
    const errorNodeId = `error:${execution.id}`;
    addNode(nodes, {
      id: errorNodeId,
      type: 'Error',
      label: truncateLabel(execution.error, 80),
      clusterId: 'Error',
      startedAt: execution.completed_at || execution.updated_at || undefined,
      data: compactObject({ error: execution.error, status: execution.status }),
      metadata: { ...fallbackSourceMetadata, source_record_id: execution.id },
    });
    addEdge(edges, {
      id: `${runNodeId}:FAILED_WITH:${errorNodeId}`,
      source: runNodeId,
      target: errorNodeId,
      type: 'FAILED_WITH',
      label: 'FAILED_WITH',
    });
  }

  for (const agentId of stringsFromObject(execution.metadata, [
    'agent_ids',
    'agentIds',
    'agents',
    'participants',
  ])) {
    addAgentNode(nodes, edges, agentId, runNodeId);
  }

  const sortedEvents = [...events].sort((left, right) => left.sequence - right.sequence);
  let previousEventNodeId: string | null = null;
  for (const event of sortedEvents) {
    const eventNodeId = eventNodeIdFor(event.id);
    const eventNodeType = eventTypeToNodeType(event.event_type);
    addNode(nodes, {
      id: eventNodeId,
      type: eventNodeType,
      label: `${event.sequence}. ${event.event_type}`,
      clusterId: event.event_type.split('.')[0] || 'ExecutionEvent',
      startedAt: event.timestamp,
      endedAt: event.timestamp,
      size: importantEventType(event.event_type) ? 9 : 6,
      data: compactObject({
        id: event.id,
        sequence: event.sequence,
        event_type: event.event_type,
        timestamp: event.timestamp,
        status: event.status,
        actor_type: event.actor_type,
        actor: event.actor,
        agent_id: event.agent_id,
        task_id: event.task_id,
        tool_call_id: event.tool_call_id,
        model_request_id: event.model_request_id,
      }),
      metadata: {
        ...fallbackSourceMetadata,
        event_details_deferred: Boolean(event.payload || event.metrics),
        source_record_id: event.id,
      },
    });
    addEdge(edges, {
      id: `${runNodeId}:EMITTED_EVENT:${eventNodeId}`,
      source: runNodeId,
      target: eventNodeId,
      type: 'EMITTED_EVENT',
      label: 'EMITTED_EVENT',
      startedAt: event.timestamp,
      endedAt: event.timestamp,
    });

    if (previousEventNodeId) {
      addEdge(edges, {
        id: `${previousEventNodeId}:FOLLOWED_BY:${eventNodeId}`,
        source: previousEventNodeId,
        target: eventNodeId,
        type: 'FOLLOWED_BY',
        label: 'FOLLOWED_BY',
        startedAt: event.timestamp,
        endedAt: event.timestamp,
      });
    }
    previousEventNodeId = eventNodeId;

    if (event.parent_event_id) {
      addEdge(edges, {
        id: `${eventNodeIdFor(event.parent_event_id)}:PARENT_OF:${eventNodeId}`,
        source: eventNodeIdFor(event.parent_event_id),
        target: eventNodeId,
        type: 'PARENT_OF',
        label: 'PARENT_OF',
        startedAt: event.timestamp,
        endedAt: event.timestamp,
      });
    }

    if (event.agent_id) {
      const agentNodeId = addAgentNode(nodes, edges, event.agent_id, runNodeId);
      addEdge(edges, {
        id: `${agentNodeId}:EMITTED_EVENT:${eventNodeId}`,
        source: agentNodeId,
        target: eventNodeId,
        type: 'EMITTED_EVENT',
        label: 'EMITTED_EVENT',
      });
    }

    if (event.task_id) {
      const taskNodeId = `task:${event.task_id}`;
      addNode(nodes, {
        id: taskNodeId,
        type: 'Task',
        label: `Task ${shortId(event.task_id)}`,
        clusterId: 'Task',
        data: compactObject({ id: event.task_id }),
        metadata: { ...fallbackSourceMetadata, source_record_id: event.task_id },
      });
      addEdge(edges, {
        id: `${taskNodeId}:OCCURRED_IN:${runNodeId}`,
        source: taskNodeId,
        target: runNodeId,
        type: 'OCCURRED_IN',
        label: 'OCCURRED_IN',
      });
    }

    const toolCallId =
      event.tool_call_id ||
      stringFromObject(event.payload, 'tool_call_id') ||
      stringFromObject(event.payload, 'toolCallId');
    if (toolCallId) {
      const toolName =
        stringFromObject(event.payload, 'tool_name') ||
        stringFromObject(event.payload, 'toolName') ||
        stringFromObject(event.payload, 'tool') ||
        stringFromObject(event.payload, 'name');
      const toolCallNodeId = `tool-call:${toolCallId}`;
      addNode(nodes, {
        id: toolCallNodeId,
        type: 'ToolCall',
        label: toolName || 'Tool call',
        clusterId: 'ToolCall',
        startedAt: event.timestamp,
        endedAt: event.timestamp,
        data: compactObject({
          id: toolCallId,
          tool_name: toolName,
          event_type: event.event_type,
          status: event.status,
        }),
        metadata: { ...fallbackSourceMetadata, source_record_id: toolCallId },
      });
      addEdge(edges, {
        id: `${toolCallNodeId}:OCCURRED_IN:${runNodeId}`,
        source: toolCallNodeId,
        target: runNodeId,
        type: 'OCCURRED_IN',
        label: 'OCCURRED_IN',
        startedAt: event.timestamp,
        endedAt: event.timestamp,
      });
    }

    const modelRequestId =
      event.model_request_id ||
      stringFromObject(event.payload, 'model_request_id') ||
      stringFromObject(event.payload, 'modelRequestId');
    if (modelRequestId) {
      const provider = stringFromObject(event.payload, 'provider');
      const model = stringFromObject(event.payload, 'model');
      const modelRequestNodeId = `model-request:${modelRequestId}`;
      addNode(nodes, {
        id: modelRequestNodeId,
        type: 'ModelRequest',
        label: [provider, model].filter(Boolean).join(' ') || 'Model request',
        clusterId: 'ModelRequest',
        startedAt: event.timestamp,
        endedAt: event.timestamp,
        data: compactObject({
          id: modelRequestId,
          provider,
          model,
          event_type: event.event_type,
          status: event.status,
        }),
        metadata: { ...fallbackSourceMetadata, source_record_id: modelRequestId },
      });
      addEdge(edges, {
        id: `${modelRequestNodeId}:OCCURRED_IN:${runNodeId}`,
        source: modelRequestNodeId,
        target: runNodeId,
        type: 'OCCURRED_IN',
        label: 'OCCURRED_IN',
        startedAt: event.timestamp,
        endedAt: event.timestamp,
      });
    }

    const isArtifactEvent = event.event_type.includes('artifact');
    const artifactId =
      stringFromObject(event.payload, 'artifact_id') ||
      stringFromObject(event.payload, 'artifactId') ||
      (isArtifactEvent ? stringFromObject(event.payload, 'id') : undefined);
    const artifactName =
      stringFromObject(event.payload, 'artifact_name') ||
      stringFromObject(event.payload, 'artifactName') ||
      (isArtifactEvent ? stringFromObject(event.payload, 'name') : undefined) ||
      basename(stringFromObject(event.payload, 'path') || stringFromObject(event.payload, 'uri'));
    if (isArtifactEvent || artifactId || artifactName) {
      const artifactSourceId = artifactId || `${event.id}:artifact`;
      const artifactNodeId = `artifact:${artifactSourceId}`;
      addNode(nodes, {
        id: artifactNodeId,
        type: 'Artifact',
        label: artifactName || 'Artifact',
        clusterId: 'Artifact',
        startedAt: event.timestamp,
        endedAt: event.timestamp,
        data: compactObject({
          id: artifactId,
          name: artifactName,
          path: stringFromObject(event.payload, 'path'),
          uri: stringFromObject(event.payload, 'uri'),
          event_type: event.event_type,
        }),
        metadata: { ...fallbackSourceMetadata, source_record_id: artifactSourceId },
      });
      addEdge(edges, {
        id: `${runNodeId}:PRODUCED_ARTIFACT:${artifactNodeId}`,
        source: runNodeId,
        target: artifactNodeId,
        type: 'PRODUCED_ARTIFACT',
        label: 'PRODUCED_ARTIFACT',
        startedAt: event.timestamp,
        endedAt: event.timestamp,
      });
    }
  }

  return normalizeSigmaGraphDocument({
    schemaVersion: sigmaGraphDocumentSchemaVersion,
    id: `execution-events-fallback:${execution.id}`,
    title: `Run ${shortId(execution.id)} event graph`,
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    metadata: canonicalGraphMetadata({
      source_system: 'agency-backend',
      source_endpoint: '/executions/{executionId}/events',
      projection_mode: 'execution-events-fallback',
      projection_available: true,
      root_type: 'Run',
      root_id: execution.id,
      event_count: events.length,
    }),
  });
}

export function workflowExecutionsToSigmaGraph(
  workflowId: string,
  executions: ExecutionRecord[]
): SigmaGraphDocument {
  const nodes = new Map<string, SigmaGraphNode>();
  const edges = new Map<string, SigmaGraphEdge>();
  const workflowNodeId = workflowId;

  addNode(nodes, {
    id: workflowNodeId,
    type: 'Workflow',
    label: `Workflow ${shortId(workflowId)}`,
    clusterId: 'Workflow',
    data: compactObject({ id: workflowId }),
    metadata: { ...fallbackSourceMetadata, source_record_id: workflowId },
  });

  executions.forEach((execution) => {
    addExecutionSummaryNodes(nodes, edges, execution, {
      addWorkflowNode: false,
      runClusterId: 'Run',
      workflowNodeId,
    });
  });
  addWorkflowOperationalSummary(nodes, edges, workflowNodeId, executions);

  return normalizeSigmaGraphDocument({
    schemaVersion: sigmaGraphDocumentSchemaVersion,
    id: `workflow-executions-fallback:${workflowId}`,
    title: `Workflow ${shortId(workflowId)} run graph`,
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    metadata: canonicalGraphMetadata({
      source_system: 'agency-backend',
      source_endpoint: '/workflows/{workflowId}/executions',
      projection_mode: 'execution-events-fallback',
      projection_available: true,
      root_type: 'Workflow',
      root_id: workflowId,
      run_count: executions.length,
    }),
  });
}

export function recentExecutionsToSigmaGraph(executions: ExecutionRecord[]): SigmaGraphDocument {
  const nodes = new Map<string, SigmaGraphNode>();
  const edges = new Map<string, SigmaGraphEdge>();
  const executionsByWorkflow = new Map<string, ExecutionRecord[]>();

  for (const execution of executions) {
    addExecutionSummaryNodes(nodes, edges, execution, {
      runClusterId: execution.workflow_id ? `workflow-orbit:${execution.workflow_id}` : 'Run',
      workflowNodeId: execution.workflow_id,
    });
    if (execution.workflow_id) {
      const workflowExecutions = executionsByWorkflow.get(execution.workflow_id) || [];
      workflowExecutions.push(execution);
      executionsByWorkflow.set(execution.workflow_id, workflowExecutions);
    }
  }

  for (const [workflowId, workflowExecutions] of executionsByWorkflow) {
    addWorkflowOperationalSummary(nodes, edges, workflowId, workflowExecutions);
  }

  return normalizeSigmaGraphDocument({
    schemaVersion: sigmaGraphDocumentSchemaVersion,
    id: 'recent-executions-fallback',
    title: 'Recent runs graph',
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    metadata: canonicalGraphMetadata({
      source_system: 'agency-backend',
      source_endpoint: '/executions',
      projection_mode: 'recent-executions-fallback',
      projection_available: true,
      root_type: 'All',
      root_id: 'recent-executions',
      run_count: executions.length,
    }),
  });
}

function addExecutionSummaryNodes(
  nodes: Map<string, SigmaGraphNode>,
  edges: Map<string, SigmaGraphEdge>,
  execution: ExecutionRecord,
  options: {
    addWorkflowNode?: boolean;
    runClusterId?: string;
    workflowNodeId?: string;
  } = {}
) {
  // Shared by All and Workflow fallback graphs so execution coverage stays consistent even
  // when the graph projection is unavailable or too sparse for operational triage.
  const runNodeId = runNodeIdFor(execution.id);
  addNode(nodes, {
    id: runNodeId,
    type: 'Run',
    label: `Run ${shortId(execution.id)}`,
    clusterId: options.runClusterId || 'Run',
    startedAt: execution.started_at || execution.created_at || undefined,
    endedAt: execution.completed_at || execution.updated_at || undefined,
    size: execution.status === 'failed' ? 15 : execution.status === 'running' ? 14 : 12,
    data: compactObject({
      id: execution.id,
      workflow_id: execution.workflow_id,
      status: execution.status,
      trigger_type: execution.trigger_type,
      created_at: execution.created_at,
      started_at: execution.started_at,
      completed_at: execution.completed_at,
      error: execution.error,
    }),
    metadata: {
      ...fallbackSourceMetadata,
      source_record_id: execution.id,
    },
  });

  const workflowNodeId = options.workflowNodeId || execution.workflow_id;
  if (workflowNodeId) {
    if (options.addWorkflowNode !== false) {
      addNode(nodes, {
        id: workflowNodeId,
        type: 'Workflow',
        label: `Workflow ${shortId(execution.workflow_id || workflowNodeId)}`,
        clusterId: 'Workflow',
        data: compactObject({ id: execution.workflow_id || workflowNodeId }),
        metadata: {
          ...fallbackSourceMetadata,
          source_record_id: execution.workflow_id || workflowNodeId,
        },
      });
    }
    addEdge(edges, {
      id: `${workflowNodeId}:STARTED:${runNodeId}`,
      source: workflowNodeId,
      target: runNodeId,
      type: 'STARTED',
      label: 'STARTED',
    });
  }

  const scheduleId = stringFromObject(execution.trigger_payload, 'schedule_id');
  if (scheduleId) {
    const scheduleNodeId = `schedule:${scheduleId}`;
    addNode(nodes, {
      id: scheduleNodeId,
      type: 'Schedule',
      label: `Schedule ${shortId(scheduleId)}`,
      clusterId: 'Schedule',
      data: compactObject({ id: scheduleId, trigger_type: execution.trigger_type }),
      metadata: { ...fallbackSourceMetadata, source_record_id: scheduleId },
    });
    addEdge(edges, {
      id: `${scheduleNodeId}:TRIGGERED:${runNodeId}`,
      source: scheduleNodeId,
      target: runNodeId,
      type: 'TRIGGERED',
      label: 'TRIGGERED',
    });
  }

  if (execution.runtime_revision_id) {
    const revisionNodeId = `runtime-revision:${execution.runtime_revision_id}`;
    addNode(nodes, {
      id: revisionNodeId,
      type: 'RuntimeRevision',
      label: `Runtime ${shortId(execution.runtime_revision_id)}`,
      clusterId: 'RuntimeRevision',
      data: compactObject({
        id: execution.runtime_revision_id,
        fingerprint: execution.runtime_fingerprint,
        adapter_id: execution.runtime_adapter_id,
      }),
      metadata: {
        ...fallbackSourceMetadata,
        source_record_id: execution.runtime_revision_id,
      },
    });
    addEdge(edges, {
      id: `${runNodeId}:USED_RUNTIME:${revisionNodeId}`,
      source: runNodeId,
      target: revisionNodeId,
      type: 'USED_RUNTIME',
      label: 'USED_RUNTIME',
    });
  }

  if (execution.container_id || execution.container_name) {
    const containerSourceId =
      execution.container_id || execution.container_name || `${execution.id}:container`;
    const containerNodeId = `runtime-container:${containerSourceId}`;
    addNode(nodes, {
      id: containerNodeId,
      type: 'RuntimeContainer',
      label: execution.container_name || `Container ${shortId(containerSourceId)}`,
      clusterId: 'RuntimeContainer',
      startedAt: execution.container_started_at || undefined,
      endedAt: execution.container_ended_at || undefined,
      data: compactObject({
        id: execution.container_id,
        name: execution.container_name,
        image: execution.container_image,
        status: execution.container_status,
        exit_code: execution.container_exit_code,
      }),
      metadata: { ...fallbackSourceMetadata, source_record_id: containerSourceId },
    });
    addEdge(edges, {
      id: `${runNodeId}:CREATED_CONTAINER:${containerNodeId}`,
      source: runNodeId,
      target: containerNodeId,
      type: 'CREATED_CONTAINER',
      label: 'CREATED_CONTAINER',
    });
  }

  if (execution.error) {
    const errorNodeId = `error:${execution.id}`;
    addNode(nodes, {
      id: errorNodeId,
      type: 'Error',
      label: truncateLabel(execution.error, 80),
      clusterId: 'Error',
      startedAt: execution.completed_at || execution.updated_at || undefined,
      data: compactObject({ error: execution.error, status: execution.status }),
      metadata: { ...fallbackSourceMetadata, source_record_id: execution.id },
    });
    addEdge(edges, {
      id: `${runNodeId}:FAILED_WITH:${errorNodeId}`,
      source: runNodeId,
      target: errorNodeId,
      type: 'FAILED_WITH',
      label: 'FAILED_WITH',
    });
  }

  for (const agentId of stringsFromObject(execution.metadata, [
    'agent_ids',
    'agentIds',
    'agents',
    'participants',
  ])) {
    addAgentNode(nodes, edges, agentId, runNodeId);
  }
}

function addWorkflowOperationalSummary(
  nodes: Map<string, SigmaGraphNode>,
  edges: Map<string, SigmaGraphEdge>,
  workflowNodeId: string,
  executions: ExecutionRecord[]
) {
  if (executions.length === 0) {
    return;
  }

  // Aggregate nodes let fallback views represent more execution history without rendering every
  // repeated run status as another high-detail branch.
  const summary = summarizeWorkflowExecutions(executions);
  const summaryNodeId = `workflow-health:${workflowNodeId}`;
  addNode(nodes, {
    id: summaryNodeId,
    type: 'WorkflowHealth',
    label: workflowHealthLabel(summary),
    clusterId: `workflow-orbit:${workflowNodeId}`,
    startedAt: summary.oldestStartedAt,
    endedAt: summary.latestEndedAt,
    size: summary.failed > 0 ? 17 : summary.running > 0 ? 15 : 13,
    data: compactObject({
      workflow_id: workflowNodeId,
      status: summary.status,
      severity: summary.severity,
      run_count: summary.total,
      failed_count: summary.failed,
      running_count: summary.running,
      completed_count: summary.completed,
      cancelled_count: summary.cancelled,
      error_count: summary.errored,
      latest_run_at: summary.latestRunAt,
    }),
    metadata: {
      ...fallbackSourceMetadata,
      aggregate_kind: 'workflow-health',
      source_record_id: workflowNodeId,
    },
  });
  addEdge(edges, {
    id: `${workflowNodeId}:HAS_HEALTH:${summaryNodeId}`,
    source: workflowNodeId,
    target: summaryNodeId,
    type: 'HAS_HEALTH',
    label: 'HAS_HEALTH',
  });

  for (const bucket of summary.statusBuckets) {
    if (bucket.count < 2) {
      continue;
    }
    const bucketNodeId = `run-status-bucket:${workflowNodeId}:${bucket.status}`;
    addNode(nodes, {
      id: bucketNodeId,
      type: 'RunStatusBucket',
      label: `${bucket.count} ${statusLabel(bucket.status)} runs`,
      clusterId: `workflow-orbit:${workflowNodeId}`,
      startedAt: bucket.oldestStartedAt,
      endedAt: bucket.latestEndedAt,
      size: Math.min(10 + bucket.count, 18),
      data: compactObject({
        workflow_id: workflowNodeId,
        status: bucket.status,
        run_count: bucket.count,
        run_ids: bucket.runIds.slice(0, 12),
        latest_run_at: bucket.latestRunAt,
      }),
      metadata: {
        ...fallbackSourceMetadata,
        aggregate_kind: 'run-status-bucket',
        aggregate_overflow_count: Math.max(bucket.runIds.length - 12, 0),
        source_record_id: `${workflowNodeId}:${bucket.status}`,
      },
    });
    addEdge(edges, {
      id: `${summaryNodeId}:HAS_STATUS_BUCKET:${bucketNodeId}`,
      source: summaryNodeId,
      target: bucketNodeId,
      type: 'HAS_STATUS_BUCKET',
      label: 'HAS_STATUS_BUCKET',
    });
  }

  for (const window of summary.timeWindows) {
    const windowNodeId = `workflow-run-window:${workflowNodeId}:${window.id}`;
    addNode(nodes, {
      id: windowNodeId,
      type: 'WorkflowRunWindow',
      label: `${window.label}: ${window.total} runs`,
      clusterId: `workflow-orbit:${workflowNodeId}`,
      startedAt: window.oldestStartedAt,
      endedAt: window.latestEndedAt,
      size: window.failed > 0 ? 15 : window.running > 0 ? 13 : 11,
      data: compactObject({
        workflow_id: workflowNodeId,
        status: window.status,
        severity: window.severity,
        window_id: window.id,
        window_label: window.label,
        run_count: window.total,
        failed_count: window.failed,
        running_count: window.running,
        completed_count: window.completed,
        error_count: window.errored,
        run_ids: window.runIds.slice(0, 12),
        anchor_run_at: summary.latestRunAt,
      }),
      metadata: {
        ...fallbackSourceMetadata,
        aggregate_kind: 'workflow-run-window',
        aggregate_overflow_count: Math.max(window.runIds.length - 12, 0),
        source_record_id: `${workflowNodeId}:${window.id}`,
      },
    });
    addEdge(edges, {
      id: `${summaryNodeId}:HAS_TIME_WINDOW:${windowNodeId}`,
      source: summaryNodeId,
      target: windowNodeId,
      type: 'HAS_TIME_WINDOW',
      label: 'HAS_TIME_WINDOW',
    });
  }

  for (const incident of summary.incidentClusters) {
    const incidentNodeId = `incident-cluster:${workflowNodeId}:${incident.signatureHash}`;
    addNode(nodes, {
      id: incidentNodeId,
      type: 'IncidentCluster',
      label: `${incident.count} failures: ${truncateLabel(incident.label, 56)}`,
      clusterId: `workflow-orbit:${workflowNodeId}`,
      startedAt: incident.firstSeenAt,
      endedAt: incident.lastSeenAt,
      size: Math.min(13 + incident.count, 20),
      data: compactObject({
        workflow_id: workflowNodeId,
        status: 'failed',
        severity: 'error',
        incident_signature: incident.signature,
        failure_count: incident.count,
        run_ids: incident.runIds.slice(0, 12),
        first_seen_at: incident.firstSeenAt,
        last_seen_at: incident.lastSeenAt,
        example_error: incident.exampleError,
      }),
      metadata: {
        ...fallbackSourceMetadata,
        aggregate_kind: 'incident-cluster',
        aggregate_overflow_count: Math.max(incident.runIds.length - 12, 0),
        source_record_id: `${workflowNodeId}:${incident.signatureHash}`,
      },
    });
    addEdge(edges, {
      id: `${summaryNodeId}:HAS_INCIDENT:${incidentNodeId}`,
      source: summaryNodeId,
      target: incidentNodeId,
      type: 'HAS_INCIDENT',
      label: 'HAS_INCIDENT',
    });
  }
}

function summarizeWorkflowExecutions(executions: ExecutionRecord[]) {
  const statusBuckets = new Map<
    string,
    {
      count: number;
      latestEndedAt?: string;
      latestRunAt?: string;
      oldestStartedAt?: string;
      runIds: string[];
      status: string;
    }
  >();
  let failed = 0;
  let running = 0;
  let completed = 0;
  let cancelled = 0;
  let errored = 0;
  let latestRunAt: string | undefined;
  let latestEndedAt: string | undefined;
  let oldestStartedAt: string | undefined;

  for (const execution of executions) {
    const status = normalizeExecutionStatus(execution.status);
    const runAt = executionRunTimestamp(execution);
    const endedAt = execution.completed_at || execution.updated_at || undefined;
    if (status === 'failed' || status === 'error') {
      failed += 1;
    } else if (status === 'running') {
      running += 1;
    } else if (status === 'completed' || status === 'success') {
      completed += 1;
    } else if (status === 'cancelled' || status === 'canceled') {
      cancelled += 1;
    }
    if (execution.error) {
      errored += 1;
    }
    latestRunAt = latestTimestamp(latestRunAt, runAt);
    latestEndedAt = latestTimestamp(latestEndedAt, endedAt);
    oldestStartedAt = oldestTimestamp(oldestStartedAt, runAt);

    const bucket = statusBuckets.get(status) || {
      count: 0,
      runIds: [],
      status,
    };
    bucket.count += 1;
    bucket.runIds.push(execution.id);
    bucket.latestRunAt = latestTimestamp(bucket.latestRunAt, runAt);
    bucket.latestEndedAt = latestTimestamp(bucket.latestEndedAt, endedAt);
    bucket.oldestStartedAt = oldestTimestamp(bucket.oldestStartedAt, runAt);
    statusBuckets.set(status, bucket);
  }

  const status =
    failed > 0
      ? 'failed'
      : running > 0
        ? 'running'
        : cancelled > 0
          ? 'cancelled'
          : completed === executions.length
            ? 'completed'
            : 'mixed';
  const severity = failed > 0 || errored > 0 ? 'error' : running > 0 ? 'warning' : 'info';

  return {
    cancelled,
    completed,
    errored,
    failed,
    latestEndedAt,
    latestRunAt,
    oldestStartedAt,
    running,
    severity,
    status,
    statusBuckets: [...statusBuckets.values()].sort(
      (left, right) => executionStatusOrder(left.status) - executionStatusOrder(right.status)
    ),
    incidentClusters: summarizeIncidentClusters(executions),
    timeWindows: summarizeWorkflowTimeWindows(executions, latestRunAt),
    total: executions.length,
  };
}

function workflowHealthLabel(summary: ReturnType<typeof summarizeWorkflowExecutions>) {
  if (summary.failed > 0) {
    return `${summary.failed}/${summary.total} runs failed`;
  }
  if (summary.running > 0) {
    return `${summary.running}/${summary.total} runs running`;
  }
  return `${summary.total} runs healthy`;
}

const workflowRunTimeWindows = [
  { durationMs: 24 * 60 * 60 * 1000, id: '24h', label: 'Last 24h' },
  { durationMs: 7 * 24 * 60 * 60 * 1000, id: '7d', label: 'Last 7d' },
  { durationMs: 30 * 24 * 60 * 60 * 1000, id: '30d', label: 'Last 30d' },
];

function summarizeWorkflowTimeWindows(executions: ExecutionRecord[], latestRunAt?: string) {
  if (!latestRunAt || executions.length < 3) {
    return [];
  }

  const anchorMs = timestampMs(latestRunAt);
  if (anchorMs <= 0) {
    return [];
  }

  const seenRunSets = new Set<string>();
  return workflowRunTimeWindows
    .map((window) => {
      const windowExecutions = executions.filter((execution) => {
        const runAt = executionRunTimestamp(execution);
        if (!runAt) {
          return false;
        }
        const ageMs = anchorMs - timestampMs(runAt);
        return ageMs >= 0 && ageMs <= window.durationMs;
      });
      return {
        ...summarizeExecutionSubset(windowExecutions),
        id: window.id,
        label: window.label,
      };
    })
    .filter((window) => window.total >= 2 || window.failed > 0 || window.running > 0)
    .filter((window) => {
      const runSetKey = window.runIds.join('|');
      if (seenRunSets.has(runSetKey)) {
        return false;
      }
      seenRunSets.add(runSetKey);
      return true;
    })
    .slice(0, 3);
}

function summarizeExecutionSubset(executions: ExecutionRecord[]) {
  let failed = 0;
  let running = 0;
  let completed = 0;
  let errored = 0;
  let latestEndedAt: string | undefined;
  let oldestStartedAt: string | undefined;
  const runIds: string[] = [];

  for (const execution of executions) {
    const status = normalizeExecutionStatus(execution.status);
    const runAt = executionRunTimestamp(execution);
    const endedAt = execution.completed_at || execution.updated_at || undefined;
    runIds.push(execution.id);
    if (status === 'failed' || status === 'error') {
      failed += 1;
    } else if (status === 'running') {
      running += 1;
    } else if (status === 'completed' || status === 'success') {
      completed += 1;
    }
    if (execution.error) {
      errored += 1;
    }
    latestEndedAt = latestTimestamp(latestEndedAt, endedAt);
    oldestStartedAt = oldestTimestamp(oldestStartedAt, runAt);
  }

  const status =
    failed > 0
      ? 'failed'
      : running > 0
        ? 'running'
        : completed === executions.length && executions.length > 0
          ? 'completed'
          : 'mixed';
  const severity = failed > 0 || errored > 0 ? 'error' : running > 0 ? 'warning' : 'info';

  return {
    completed,
    errored,
    failed,
    latestEndedAt,
    oldestStartedAt,
    running,
    runIds,
    severity,
    status,
    total: executions.length,
  };
}

function summarizeIncidentClusters(executions: ExecutionRecord[]) {
  const incidentBuckets = new Map<
    string,
    {
      exampleError: string;
      firstSeenAt?: string;
      lastSeenAt?: string;
      runIds: string[];
      signature: string;
      signatureHash: string;
    }
  >();

  for (const execution of executions) {
    const status = normalizeExecutionStatus(execution.status);
    const rawError = execution.error?.trim();
    if (!rawError && status !== 'failed' && status !== 'error') {
      continue;
    }

    const signature = incidentSignature(rawError || status);
    const signatureHash = stableHash(signature);
    const runAt = executionRunTimestamp(execution);
    const bucket = incidentBuckets.get(signatureHash) || {
      exampleError: rawError || statusLabel(status),
      runIds: [],
      signature,
      signatureHash,
    };
    bucket.runIds.push(execution.id);
    bucket.firstSeenAt = oldestTimestamp(bucket.firstSeenAt, runAt);
    bucket.lastSeenAt = latestTimestamp(bucket.lastSeenAt, runAt);
    incidentBuckets.set(signatureHash, bucket);
  }

  return [...incidentBuckets.values()]
    .filter((bucket) => bucket.runIds.length >= 2)
    .sort(
      (left, right) =>
        right.runIds.length - left.runIds.length ||
        timestampMs(right.lastSeenAt || '') - timestampMs(left.lastSeenAt || '') ||
        left.signature.localeCompare(right.signature)
    )
    .slice(0, 5)
    .map((bucket) => ({
      ...bucket,
      count: bucket.runIds.length,
      label: readableIncidentLabel(bucket.exampleError),
    }));
}

function incidentSignature(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '<uuid>')
      .replace(/[0-9a-f]{24,}/gi, '<hex>')
      .replace(/\b\d+\b/g, '<number>')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120) || 'failed'
  );
}

function readableIncidentLabel(value: string) {
  return value.replace(/\s+/g, ' ').trim() || 'Repeated failure';
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function addNode(nodes: Map<string, SigmaGraphNode>, node: SigmaGraphNode) {
  if (!nodes.has(node.id)) {
    nodes.set(node.id, node);
  }
}

function addEdge(edges: Map<string, SigmaGraphEdge>, edge: SigmaGraphEdge) {
  if (!edges.has(edge.id)) {
    edges.set(edge.id, {
      ...edge,
      metadata: {
        ...fallbackSourceMetadata,
        ...(edge.metadata || {}),
      },
    });
  }
}

function addAgentNode(
  nodes: Map<string, SigmaGraphNode>,
  edges: Map<string, SigmaGraphEdge>,
  agentId: string,
  runNodeId: string
) {
  const agentNodeId = `agent:${agentId}`;
  addNode(nodes, {
    id: agentNodeId,
    type: 'Agent',
    label: readableIdentifier(agentId) || 'Agent',
    clusterId: 'Agent',
    data: compactObject({ id: agentId, agent_id: agentId }),
    metadata: { ...fallbackSourceMetadata, source_record_id: agentId },
  });
  addEdge(edges, {
    id: `${agentNodeId}:PARTICIPATED_IN:${runNodeId}`,
    source: agentNodeId,
    target: runNodeId,
    type: 'PARTICIPATED_IN',
    label: 'PARTICIPATED_IN',
  });
  return agentNodeId;
}

function runNodeIdFor(executionId: string) {
  return `run:${executionId}`;
}

function eventNodeIdFor(eventId: string) {
  return `execution-event:${eventId}`;
}

function shortId(value: string) {
  return value.length > 12 ? value.slice(0, 8) : value;
}

function truncateLabel(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}...`;
}

function importantEventType(eventType: string) {
  return (
    eventType.includes('failed') ||
    eventType.includes('error') ||
    eventType === 'execution.created' ||
    eventType === 'execution.completed'
  );
}

function eventTypeToNodeType(eventType: string) {
  return eventType.startsWith('container.') ? 'ContainerEvent' : 'ExecutionEvent';
}

function stringFromObject(value: unknown, key: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === 'string' && raw.trim() ? raw : undefined;
}

function stringsFromObject(value: unknown, keys: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }
  const source = value as Record<string, unknown>;
  const found = new Set<string>();
  for (const key of keys) {
    const raw = source[key];
    if (typeof raw === 'string' && raw.trim()) {
      found.add(raw.trim());
    }
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item === 'string' && item.trim()) {
          found.add(item.trim());
        } else if (item && typeof item === 'object') {
          const id = stringFromObject(item, 'id') || stringFromObject(item, 'agent_id');
          if (id) {
            found.add(id);
          }
        }
      }
    }
  }
  return [...found];
}

function readableIdentifier(value: string) {
  const normalized = value
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '')
    .replace(/[0-9a-f]{24,}/gi, '')
    .replace(/\b(agent|user|execution|run|workflow)\b/gi, '')
    .replace(/[_:./-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) {
    return undefined;
  }
  return normalized
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function normalizeExecutionStatus(status?: string | null) {
  const cleanStatus = status?.trim().toLowerCase();
  return cleanStatus || 'unknown';
}

function executionRunTimestamp(execution: ExecutionRecord) {
  return execution.started_at || execution.created_at || execution.updated_at || undefined;
}

function executionStatusOrder(status: string) {
  const order: Record<string, number> = {
    failed: 0,
    error: 1,
    running: 2,
    pending: 3,
    completed: 4,
    success: 5,
    cancelled: 6,
    canceled: 7,
    unknown: 8,
  };
  return order[status] ?? 9;
}

function statusLabel(status: string) {
  return readableIdentifier(status) || status;
}

function latestTimestamp(current?: string, candidate?: string) {
  if (!candidate) {
    return current;
  }
  if (!current) {
    return candidate;
  }
  return timestampMs(candidate) > timestampMs(current) ? candidate : current;
}

function oldestTimestamp(current?: string, candidate?: string) {
  if (!candidate) {
    return current;
  }
  if (!current) {
    return candidate;
  }
  return timestampMs(candidate) < timestampMs(current) ? candidate : current;
}

function timestampMs(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function basename(value?: string) {
  if (!value) {
    return undefined;
  }
  const clean = value.split('?')[0]?.split('#')[0] || value;
  return clean.split('/').filter(Boolean).pop() || clean;
}

function compactObject(value: Record<string, unknown>) {
  const entries = Object.entries(value).filter(
    ([, item]) => item !== undefined && item !== null && item !== ''
  );
  return Object.fromEntries(entries.map(([key, item]) => [key, jsonValue(item)]));
}

function jsonValue(value: unknown): SigmaGraphJsonValue {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
    return value as SigmaGraphJsonValue;
  }
  if (Array.isArray(value)) {
    return value.map(jsonValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, jsonValue(item)])
    ) as SigmaGraphJsonObject;
  }
  return String(value);
}
